/**
 * Data portraits: let a dataset introduce itself before anyone downloads it. One or two bounded
 * requests, made only when a dataset is selected, never for a whole list.
 *
 *  - map:    up to 60 real features drawn as shapes (no basemap), with "N of total";
 *  - series: records per month over the last 100 months, aggregated by the portal;
 *  - table:  the field labels and three real rows;
 *  - none:   why there is no preview (no record API, no records), said plainly.
 *
 * A portrait shows what the data looks like, not what it proves: a few points are not coverage,
 * a line sample is not a routable network.
 */
import { dataForm } from './atlas-spec';
import { asObject, asString, odsFetch, type Json } from './data/ods';
import type { Portal } from './portal';
import type { DatasetRecord } from './types';

export const MAP_FEATURES = 60;
export const SERIES_PERIODS = 100;
export const TABLE_ROWS = 3;
const TABLE_FIELDS = 6;

export type Geometry = { type: 'Point'; coordinates: number[] } | { type: 'LineString' | 'MultiPoint'; coordinates: number[][] } | { type: 'Polygon' | 'MultiLineString'; coordinates: number[][][] } | { type: 'MultiPolygon'; coordinates: number[][][][] };

export type Portrait =
  | { kind: 'map'; geometries: Geometry[]; total?: number }
  | { kind: 'series'; field: string; periods: Array<{ period: string; n: number }>; truncated: boolean }
  | { kind: 'table'; fields: Array<{ name: string; label: string }>; fieldTotal: number; rows: Array<Record<string, string>>; total?: number }
  | { kind: 'none'; reason: string };

const GEOMETRY_TYPES = new Set(['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon']);

export function parseGeometries(collection: unknown): Geometry[] {
  const features = asObject(collection).features;
  if (!Array.isArray(features)) return [];
  return features
    .map(feature => asObject(asObject(feature).geometry))
    .filter(geometry => GEOMETRY_TYPES.has(asString(geometry.type)) && Array.isArray(geometry.coordinates)) as unknown as Geometry[];
}

type Entry = { fields?: Array<{ name?: string; label?: string; type?: string }> };

export async function loadPortrait(dataset: DatasetRecord, portal: Portal): Promise<Portrait> {
  if (portal.api.kind !== 'ods') return { kind: 'none', reason: 'This source publishes files but no record interface, so there is nothing to preview here. Open the source to see the distributions.' };
  if (!dataset.hasRecords || dataset.recordsCount === 0) return { kind: 'none', reason: 'The catalogue lists this dataset but it publishes no records.' };
  const path = `/catalog/datasets/${encodeURIComponent(dataset.id)}`;
  const form = dataForm(dataset);
  if (form === 'point' || form === 'line' || form === 'area' || form === 'mixed') {
    const collection = await odsFetch<unknown>(`${path}/exports/geojson`, { limit: MAP_FEATURES }, { portal });
    const geometries = parseGeometries(collection);
    if (geometries.length) return { kind: 'map', geometries, total: dataset.recordsCount };
  }
  const entry = await odsFetch<Entry>(path, { select: 'fields' }, { portal }).catch(() => ({} as Entry));
  const fields = (entry.fields ?? []).filter(field => field.name);
  const timeField = fields.find(field => field.type === 'date' || field.type === 'datetime')?.name;
  if (form === 'series' && timeField) {
    const body = await odsFetch<{ results?: Json[] }>(`${path}/records`, {
      select: 'count(*) as n',
      group_by: `date_format(${timeField}, 'yyyy-MM') as period`,
      order_by: 'period desc',
      limit: SERIES_PERIODS,
    }, { portal });
    const returned = (body.results ?? [])
      .map(row => ({ period: asString(row.period), n: Number(row.n) || 0 }))
      .filter(row => /^\d{4}-\d{2}$/.test(row.period));
    const periods = fillMonths(returned).slice(-SERIES_PERIODS);
    if (periods.length) return { kind: 'series', field: timeField, periods, truncated: returned.length >= SERIES_PERIODS || periods.length >= SERIES_PERIODS };
  }
  const body = await odsFetch<{ results?: Json[] }>(`${path}/records`, { limit: TABLE_ROWS }, { portal });
  const shown = fields.filter(field => !/geo_(shape|point)/.test(field.type ?? '')).slice(0, TABLE_FIELDS);
  return {
    kind: 'table',
    fields: shown.map(field => ({ name: field.name!, label: field.label || field.name! })),
    fieldTotal: fields.length,
    rows: (body.results ?? []).map(row => Object.fromEntries(shown.map(field => [field.name!, cell(row[field.name!])]))),
    total: dataset.recordsCount,
  };
}

/**
 * The portal's grouping leaves out months without records. Put them back as zero, so a gap in
 * the data shows as a gap in the portrait instead of being silently closed.
 */
export function fillMonths(periods: ReadonlyArray<{ period: string; n: number }>): Array<{ period: string; n: number }> {
  if (!periods.length) return [];
  const byPeriod = new Map(periods.map(item => [item.period, item.n]));
  const sorted = [...byPeriod.keys()].sort();
  const [fy, fm] = sorted[0].split('-').map(Number), [ly, lm] = sorted[sorted.length - 1].split('-').map(Number);
  const out: Array<{ period: string; n: number }> = [];
  for (let y = fy, m = fm; y < ly || (y === ly && m <= lm); m === 12 ? (y++, m = 1) : m++) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    out.push({ period: key, n: byPeriod.get(key) ?? 0 });
  }
  return out;
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return text.length > 28 ? `${text.slice(0, 27)}…` : text;
}

// ---------------------------------------------------------------------------
// Rendering (pure, SVG/HTML strings)
// ---------------------------------------------------------------------------

const W = 320, H = 180, PAD = 10;
const esc = (text: string): string => text.replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]!));
const count = (value: number): string => new Intl.NumberFormat('de-CH').format(value);

function positions(geometry: Geometry): number[][] {
  switch (geometry.type) {
    case 'Point': return [geometry.coordinates];
    case 'MultiPoint': case 'LineString': return geometry.coordinates;
    case 'Polygon': case 'MultiLineString': return geometry.coordinates.flat();
    case 'MultiPolygon': return geometry.coordinates.flat(2);
  }
}

/** Equirectangular fit with a cos(latitude) correction: fine at canton scale, and it is a sketch, not a map. */
export function projector(geometries: Geometry[]): (lon: number, lat: number) => [number, number] {
  const all = geometries.flatMap(positions).filter(point => Number.isFinite(point[0]) && Number.isFinite(point[1]));
  const lons = all.map(point => point[0]), lats = all.map(point => point[1]);
  const [minLon, maxLon, minLat, maxLat] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)];
  const k = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
  const spanX = Math.max((maxLon - minLon) * k, 1e-9), spanY = Math.max(maxLat - minLat, 1e-9);
  const scale = Math.min((W - 2 * PAD) / spanX, (H - 2 * PAD) / spanY);
  const offX = (W - spanX * scale) / 2, offY = (H - spanY * scale) / 2;
  return (lon, lat) => [+(offX + (lon - minLon) * k * scale).toFixed(1), +(offY + (maxLat - lat) * scale).toFixed(1)];
}

function geometrySvg(geometry: Geometry, project: (lon: number, lat: number) => [number, number]): string {
  const line = (ring: number[][]) => ring.map(([lon, lat], i) => `${i ? 'L' : 'M'}${project(lon, lat).join(' ')}`).join('');
  switch (geometry.type) {
    case 'Point': { const [x, y] = project(geometry.coordinates[0], geometry.coordinates[1]); return `<circle cx="${x}" cy="${y}" r="2.6"/>`; }
    case 'MultiPoint': return geometry.coordinates.map(([lon, lat]) => { const [x, y] = project(lon, lat); return `<circle cx="${x}" cy="${y}" r="2.6"/>`; }).join('');
    case 'LineString': return `<path class="ln" d="${line(geometry.coordinates)}"/>`;
    case 'MultiLineString': return `<path class="ln" d="${geometry.coordinates.map(line).join('')}"/>`;
    case 'Polygon': return `<path class="ar" d="${geometry.coordinates.map(ring => `${line(ring)}Z`).join('')}"/>`;
    case 'MultiPolygon': return `<path class="ar" d="${geometry.coordinates.map(poly => poly.map(ring => `${line(ring)}Z`).join('')).join('')}"/>`;
  }
}

export function renderPortrait(portrait: Portrait): string {
  if (portrait.kind === 'none') return `<div class="portrait portrait-none"><p>${esc(portrait.reason)}</p></div>`;
  if (portrait.kind === 'map') {
    const project = projector(portrait.geometries);
    const shown = portrait.geometries.length;
    const total = portrait.total !== undefined ? ` of ${count(portrait.total)}` : '';
    return `<figure class="portrait portrait-map"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${shown}${total} features drawn by position">${portrait.geometries.map(geometry => geometrySvg(geometry, project)).join('')}</svg>
      <figcaption>${shown}${total} features, drawn by position only. No basemap; not a statement about coverage.</figcaption></figure>`;
  }
  if (portrait.kind === 'series') {
    const max = Math.max(...portrait.periods.map(period => period.n), 1);
    const bw = (W - 2 * PAD) / portrait.periods.length;
    const bars = portrait.periods.map((period, i) => {
      const h = Math.max(1, (period.n / max) * (H - 2 * PAD - 14));
      return `<rect x="${(PAD + i * bw).toFixed(1)}" y="${(H - PAD - 14 - h).toFixed(1)}" width="${Math.max(1, bw - 1).toFixed(1)}" height="${h.toFixed(1)}"><title>${esc(period.period)}: ${count(period.n)} records</title></rect>`;
    }).join('');
    const first = portrait.periods[0].period, last = portrait.periods[portrait.periods.length - 1].period;
    return `<figure class="portrait portrait-series"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Records per month from ${first} to ${last}">${bars}
      <text x="${PAD}" y="${H - 2}">${esc(first)}</text><text x="${W - PAD}" y="${H - 2}" text-anchor="end">${esc(last)}</text></svg>
      <figcaption>Records per month by <code>${esc(portrait.field)}</code>, ${esc(first)} to ${esc(last)}${portrait.truncated ? ` (last ${SERIES_PERIODS} months)` : ''}. Peak ${count(max)}; months without records show as gaps.</figcaption></figure>`;
  }
  const head = portrait.fields.map(field => `<th title="${esc(field.name)}">${esc(field.label)}</th>`).join('');
  const body = portrait.rows.map(row => `<tr>${portrait.fields.map(field => `<td>${esc(row[field.name] ?? '')}</td>`).join('')}</tr>`).join('');
  const more = portrait.fieldTotal > portrait.fields.length ? `, ${portrait.fields.length} of ${portrait.fieldTotal} fields` : '';
  return `<figure class="portrait portrait-table"><div class="pt-scroll"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>
    <figcaption>${portrait.rows.length}${portrait.total !== undefined ? ` of ${count(portrait.total)}` : ''} rows${more}.</figcaption></figure>`;
}
