/**
 * Generated covers and spines: every dataset gets a face, computed from its metadata and a
 * small real sample. Nothing is drawn by hand per dataset; same input, same cover.
 *
 * One channel per fact (docs/COVERS.md):
 *   colour        category                      spine width   record count, 5 log bands
 *   motif         subcategory glyph             bookmark      documented reuses (notches)
 *   cover art     the data's own sample         patina        overdue against its own declared rhythm
 *   paper tab     doorway: ready, rarely used   dashed, empty unknown form
 */
import { ATLAS_SPECS, dataForm, FORM_LABEL, FORM_MARK, subcategoryGlyph, type DataForm } from './atlas-spec';
import type { Geometry } from './portrait';
import type { DatasetRecord } from './types';
import { ICONS, type IconName } from './ui/icons';

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/** A bounded sample, collected once by scripts/cover-samples.ts. */
export interface CoverSample {
  geometries?: Geometry[];
  periods?: Array<{ period: string; n: number }>;
  fields?: Array<{ name: string; type: string }>;
}

export interface CoverSignals {
  reuses: number;
  /** 0 = on time or no declared rhythm; up to 1 = far overdue. */
  overdue: number;
  overdueNote?: string;
  doorway: boolean;
}

export interface CoverInput {
  dataset: DatasetRecord;
  category: string;
  subcategory: string;
  sample?: CoverSample;
  signals: CoverSignals;
}

// ---------------------------------------------------------------------------
// Facts -> channels
// ---------------------------------------------------------------------------

/** Cloth colours per category: muted, distinct in hue and lightness, paper-coloured ink on top. */
export const CATEGORY_CLOTH: Readonly<Record<string, string>> = {
  'Mobility & Transport': '#2b5c73',
  'Environment & Climate': '#3f6b4a',
  'People & Society': '#74506b',
  'Built City & Infrastructure': '#6b5a48',
  'Public Space & Leisure': '#a8692f',
  Health: '#8a3f3f',
  Education: '#3f4f8a',
  Culture: '#86692a',
  'Government & Economy': '#4a4a52',
  'Other / review needed': '#7d838a',
};
const PAPER = '#f4f0e6';
const FALLBACK_CLOTH = '#7d838a';

/** Record count in five log bands: <30, <1k, <30k, <1M, >=1M. Unknown counts are band 0 and flagged. */
export function recordBand(count: number | undefined): 0 | 1 | 2 | 3 | 4 {
  if (!count || count < 30) return 0;
  if (count < 1_000) return 1;
  if (count < 30_000) return 2;
  if (count < 1_000_000) return 3;
  return 4;
}
export const SPINE_WIDTH = [9, 12, 15, 19, 24] as const;
export const BAND_LABEL = ['under 30 records', '30 to 1k', '1k to 30k', '30k to 1M', '1M or more'] as const;
/** Compact labels for the cover footer, where space is short. */
export const BAND_SHORT = ['<30', '30–1k', '1k–30k', '30k–1M', '≥1M'] as const;

/** Days a declared rhythm allows between changes. Undeclared, irregular or "no updates" allow any gap. */
const RHYTHM_DAYS: ReadonlyArray<readonly [RegExp, number, string]> = [
  [/^(cont|update cont|hourly|\d+ ?(min|hour)|daily|realtime)/, 1, 'daily'],
  [/week/, 7, 'weekly'],
  [/^month|bimonth/, 31, 'monthly'],
  [/quarter/, 92, 'quarterly'],
  [/semiannual|biannual/, 183, 'half-yearly'],
  [/^annual 2|biennial/, 731, 'every two years'],
  [/^annual 3|triennial/, 1096, 'every three years'],
  [/^annual/, 366, 'yearly'],
];

/**
 * Overdue only against the dataset's own declared rhythm, with a grace of twice the interval.
 * A dataset declared "no updates" or "irregular" is never overdue: static is not stale.
 */
export function overdue(dataset: DatasetRecord, now: Date): { level: number; note?: string } {
  const f = dataset.characteristics.updateFrequency?.toLowerCase().trim() ?? '';
  const rhythm = RHYTHM_DAYS.find(([pattern]) => pattern.test(f));
  if (!rhythm || !dataset.modified) return { level: 0 };
  const modified = new Date(dataset.modified);
  if (Number.isNaN(modified.getTime())) return { level: 0 };
  const days = (now.getTime() - modified.getTime()) / 86_400_000;
  const allowed = rhythm[1] * 2;
  if (days <= allowed) return { level: 0 };
  const level = Math.min(1, (days - allowed) / (allowed * 4));
  const age = days >= 60 ? `${Math.round(days / 30.44)} months` : `${Math.round(days)} days`;
  return { level: Math.max(0.15, level), note: `Declared ${rhythm[2]}, last changed ${age} ago.` };
}

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------

const esc = (text: string): string => text.replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]!));

/** An icon body placed at (x, y) and scaled from its 24-unit grid. */
function glyph(name: IconName, x: number, y: number, size: number, stroke = PAPER, width = 1.5): string {
  const scale = size / 24;
  const body = ICONS[name].replace(/fill="currentColor"/g, `fill="${stroke}"`);
  return `<g transform="translate(${x} ${y}) scale(${scale})" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;
}

/** Greedy word wrap by an average glyph width; long words are cut, the last line gets an ellipsis. */
export function wrapTitle(title: string, maxChars: number, maxLines: number): string[] {
  const words = title.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const piece = word.length > maxChars ? `${word.slice(0, maxChars - 1)}…` : word;
    if (!line) line = piece;
    else if ((line + ' ' + piece).length <= maxChars) line += ' ' + piece;
    else { lines.push(line); line = piece; }
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && line) lines.push(line);
  const used = lines.join(' ').replace(/…/g, '').length;
  if (used < title.replace(/\s+/g, ' ').trim().length - 1 && lines.length) {
    const last = lines[lines.length - 1];
    lines[lines.length - 1] = `${last.slice(0, Math.max(0, maxChars - 1)).replace(/[\s,.:;-]+$/, '')}…`;
  }
  return lines.slice(0, maxLines);
}

type Box = { x: number; y: number; w: number; h: number };

function positions(geometry: Geometry): number[][] {
  switch (geometry.type) {
    case 'Point': return [geometry.coordinates];
    case 'MultiPoint': case 'LineString': return geometry.coordinates;
    case 'Polygon': case 'MultiLineString': return geometry.coordinates.flat();
    case 'MultiPolygon': return geometry.coordinates.flat(2);
  }
}

function mapArt(geometries: Geometry[], box: Box): string {
  const all = geometries.flatMap(positions).filter(point => Number.isFinite(point[0]) && Number.isFinite(point[1]));
  if (!all.length) return '';
  const lons = all.map(p => p[0]), lats = all.map(p => p[1]);
  const [minLon, maxLon, minLat, maxLat] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)];
  const k = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
  const spanX = Math.max((maxLon - minLon) * k, 1e-9), spanY = Math.max(maxLat - minLat, 1e-9);
  const scale = Math.min(box.w / spanX, box.h / spanY);
  const ox = box.x + (box.w - spanX * scale) / 2, oy = box.y + (box.h - spanY * scale) / 2;
  const p = (lon: number, lat: number) => `${(ox + (lon - minLon) * k * scale).toFixed(1)} ${(oy + (maxLat - lat) * scale).toFixed(1)}`;
  const path = (ring: number[][]) => ring.map(([lon, lat], i) => `${i ? 'L' : 'M'}${p(lon, lat)}`).join('');
  return geometries.map(g => {
    switch (g.type) {
      case 'Point': return `<circle cx="${p(g.coordinates[0], g.coordinates[1]).split(' ')[0]}" cy="${p(g.coordinates[0], g.coordinates[1]).split(' ')[1]}" r="1.6" fill="${PAPER}"/>`;
      case 'MultiPoint': return g.coordinates.map(([lon, lat]) => { const [x, y] = p(lon, lat).split(' '); return `<circle cx="${x}" cy="${y}" r="1.6" fill="${PAPER}"/>`; }).join('');
      case 'LineString': return `<path d="${path(g.coordinates)}" fill="none" stroke="${PAPER}" stroke-width="1" stroke-linejoin="round"/>`;
      case 'MultiLineString': return `<path d="${g.coordinates.map(path).join('')}" fill="none" stroke="${PAPER}" stroke-width="1" stroke-linejoin="round"/>`;
      case 'Polygon': return `<path d="${g.coordinates.map(r => `${path(r)}Z`).join('')}" fill="${PAPER}" fill-opacity=".22" stroke="${PAPER}" stroke-width=".7"/>`;
      case 'MultiPolygon': return `<path d="${g.coordinates.map(poly => poly.map(r => `${path(r)}Z`).join('')).join('')}" fill="${PAPER}" fill-opacity=".22" stroke="${PAPER}" stroke-width=".7"/>`;
    }
  }).join('');
}

function seriesArt(periods: Array<{ n: number }>, box: Box): string {
  if (!periods.length) return '';
  const max = Math.max(...periods.map(period => period.n), 1);
  const step = box.w / periods.length;
  return periods.map((period, i) => {
    if (!period.n) return '';
    const h = Math.max(0.8, (period.n / max) * box.h);
    return `<rect x="${(box.x + i * step).toFixed(2)}" y="${(box.y + box.h - h).toFixed(2)}" width="${Math.max(0.6, step * 0.72).toFixed(2)}" height="${h.toFixed(2)}" fill="${PAPER}"/>`;
  }).join('') + `<path d="M${box.x} ${box.y + box.h + 1.5}h${box.w}" stroke="${PAPER}" stroke-width=".6" opacity=".6"/>`;
}

/** Column types as a weave: text = hairlines, numbers = dots, dates = ticks, geometry = rings. */
function tableArt(fields: Array<{ type: string }>, box: Box): string {
  const shown = fields.slice(0, 12);
  if (!shown.length) return '';
  const col = box.w / shown.length;
  return shown.map((field, i) => {
    const x = box.x + i * col + col / 2;
    const rows = 9;
    const parts: string[] = [];
    for (let r = 0; r < rows; r++) {
      const y = box.y + (r + 0.5) * (box.h / rows);
      if (/text|string/.test(field.type)) parts.push(`<path d="M${(x - col * 0.34).toFixed(1)} ${y.toFixed(1)}h${(col * 0.68).toFixed(1)}" stroke="${PAPER}" stroke-width=".9"/>`);
      else if (/int|double|decimal|float|number/.test(field.type)) parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.1" fill="${PAPER}"/>`);
      else if (/date/.test(field.type)) parts.push(`<path d="M${x.toFixed(1)} ${(y - 2.2).toFixed(1)}v4.4" stroke="${PAPER}" stroke-width=".9"/>`);
      else if (/geo/.test(field.type)) parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.9" fill="none" stroke="${PAPER}" stroke-width=".7"/>`);
      else parts.push(`<rect x="${(x - 1).toFixed(1)}" y="${(y - 1).toFixed(1)}" width="2" height="2" fill="${PAPER}" opacity=".6"/>`);
    }
    return parts.join('');
  }).join('');
}

function formFallbackArt(form: DataForm, box: Box): string {
  if (form === 'unknown') return `<rect x="${box.x + 12}" y="${box.y + 8}" width="${box.w - 24}" height="${box.h - 16}" rx="3" fill="none" stroke="${PAPER}" stroke-width="1" stroke-dasharray="3 3" opacity=".8"/>${glyph('form-unknown', box.x + box.w / 2 - 10, box.y + box.h / 2 - 10, 20)}`;
  if (form === 'raster') {
    const cells: string[] = [];
    for (let i = 1; i < 5; i++) cells.push(`<path d="M${box.x + (i * box.w) / 5} ${box.y}v${box.h}M${box.x} ${box.y + (i * box.h) / 5}h${box.w}" stroke="${PAPER}" stroke-width=".6" opacity=".7"/>`);
    return `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="none" stroke="${PAPER}" stroke-width=".8" opacity=".8"/>${cells.join('')}`;
  }
  // No sample available: the form mark alone, large and plain; never an invented pattern.
  return glyph(FORM_MARK[form], box.x + box.w / 2 - 16, box.y + box.h / 2 - 16, 32, PAPER, 1.2);
}

function coverArt(input: CoverInput, box: Box): string {
  const form = dataForm(input.dataset);
  const sample = input.sample;
  if (sample?.geometries?.length && ['point', 'line', 'area', 'mixed'].includes(form)) return mapArt(sample.geometries, box);
  if (sample?.periods?.length && form === 'series') return seriesArt(sample.periods, box);
  if (sample?.fields?.length && (form === 'table' || form === 'series')) return tableArt(sample.fields, box);
  return formFallbackArt(form, box);
}

// ---------------------------------------------------------------------------
// Cover and spine
// ---------------------------------------------------------------------------

export const COVER_W = 120, COVER_H = 168;

function motif(input: CoverInput): IconName {
  const spec = ATLAS_SPECS[input.category];
  return spec ? subcategoryGlyph(spec, input.subcategory) : 'topic';
}

function patina(level: number, w: number, h: number, id: string): string {
  if (!level) return '';
  return `<defs><linearGradient id="pat-${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8d9b0" stop-opacity="${(0.05 + level * 0.25).toFixed(2)}"/><stop offset="1" stop-color="#6b5a3a" stop-opacity="${(0.1 + level * 0.35).toFixed(2)}"/></linearGradient></defs><rect width="${w}" height="${h}" rx="3" fill="url(#pat-${id})"/>`;
}

function ribbon(reuses: number, x: number): string {
  if (!reuses) return '';
  const notches = Math.min(reuses, 5);
  const ticks = Array.from({ length: notches }, (_, i) => `<path d="M${x + 1.2} ${6 + i * 4}h3.6" stroke="#8a3f3f" stroke-width="1"/>`).join('');
  return `<path d="M${x} -6h6v34l-3-3-3 3z" fill="${PAPER}"/>${ticks}`;
}

export function coverSvg(input: CoverInput): string {
  const { dataset, signals } = input;
  const cloth = CATEGORY_CLOTH[input.category] ?? FALLBACK_CLOTH;
  const form = dataForm(dataset);
  const id = dataset.id.replace(/[^\w-]/g, '_');
  const lines = wrapTitle(dataset.title, 17, 3);
  const title = lines.map((line, i) => `<tspan x="10" dy="${i ? 11 : 0}">${esc(line)}</tspan>`).join('');
  const label = [dataset.title, `${FORM_LABEL[form]}, ${BAND_LABEL[recordBand(dataset.recordsCount)]}`,
    signals.reuses ? `${signals.reuses} documented reuse${signals.reuses === 1 ? '' : 's'}` : '',
    signals.overdueNote ?? '', signals.doorway ? 'Ready, rarely used' : ''].filter(Boolean).join('. ');
  return `<svg class="cover" xmlns="http://www.w3.org/2000/svg" viewBox="0 -10 ${COVER_W} ${COVER_H + 10}" width="${COVER_W}" height="${COVER_H + 10}" role="img" aria-label="${esc(label)}">
    ${signals.doorway ? `<path d="M10 -7h48a2 2 0 0 1 2 2v7H8v-7a2 2 0 0 1 2-2z" fill="${PAPER}" stroke="${cloth}" stroke-width=".8"/><text x="34" y="-1" text-anchor="middle" font-size="5.2" font-weight="700" letter-spacing=".4" fill="${cloth}">READY · RARE</text>` : ''}
    <rect width="${COVER_W}" height="${COVER_H}" rx="3" fill="${cloth}"/>
    <rect x="3" y="3" width="${COVER_W - 6}" height="${COVER_H - 6}" rx="2" fill="none" stroke="${PAPER}" stroke-opacity=".28" stroke-width=".6"/>
    ${glyph(motif(input), 9, 9, 22)}
    <text x="${COVER_W - 10}" y="16" text-anchor="end" font-size="6" fill="${PAPER}" fill-opacity=".75" font-family="ui-monospace,Menlo,monospace">${esc(dataset.id)}</text>
    <g opacity=".92">${coverArt(input, { x: 12, y: 40, w: COVER_W - 24, h: 70 })}</g>
    <text x="10" y="128" font-size="9.2" font-weight="650" fill="${PAPER}" font-family="Inter,system-ui,sans-serif">${title}</text>
    <g transform="translate(10 ${COVER_H - 15})">${glyph(FORM_MARK[form], 0, 0, 9, PAPER, 1.6)}<text x="12" y="7" font-size="6" fill="${PAPER}" fill-opacity=".85" font-family="Inter,system-ui,sans-serif">${esc(FORM_LABEL[form])} · ${esc(BAND_SHORT[recordBand(dataset.recordsCount)])} records</text></g>
    ${patina(signals.overdue, COVER_W, COVER_H, id)}
    ${ribbon(signals.reuses, COVER_W - 44)}
  </svg>`;
}

export function spineSvg(input: CoverInput): string {
  const { dataset, signals } = input;
  const cloth = CATEGORY_CLOTH[input.category] ?? FALLBACK_CLOTH;
  const form = dataForm(dataset);
  const w = SPINE_WIDTH[recordBand(dataset.recordsCount)];
  const id = `s-${dataset.id.replace(/[^\w-]/g, '_')}`;
  const title = wrapTitle(dataset.title, 30, 1)[0] ?? '';
  const icon = Math.min(w - 3, 12);
  return `<svg class="spine" xmlns="http://www.w3.org/2000/svg" viewBox="0 -10 ${w} ${COVER_H + 10}" width="${w}" height="${COVER_H + 10}" role="img" aria-label="${esc(dataset.title)}">
    ${signals.doorway ? `<rect x="1" y="-7" width="${w - 2}" height="8" rx="1.5" fill="${PAPER}" stroke="${cloth}" stroke-width=".8"/>` : ''}
    <rect width="${w}" height="${COVER_H}" rx="1.5" fill="${cloth}"/>
    <path d="M0 3.5h${w}M0 ${COVER_H - 3.5}h${w}" stroke="${PAPER}" stroke-opacity=".35" stroke-width=".6"/>
    ${glyph(motif(input), (w - icon) / 2, 7, icon, PAPER, 1.8)}
    <text transform="translate(${(w / 2 + 2.3).toFixed(1)} ${22 + icon}) rotate(90)" font-size="6.4" font-weight="600" fill="${PAPER}" font-family="Inter,system-ui,sans-serif">${esc(title)}</text>
    ${glyph(FORM_MARK[form], (w - Math.min(w - 3, 9)) / 2, COVER_H - 15, Math.min(w - 3, 9), PAPER, 1.8)}
    ${patina(signals.overdue, w, COVER_H, id)}
    ${signals.reuses ? `<path d="M${w / 2 - 1.5} ${COVER_H}v7l1.5-1.5 1.5 1.5v-7z" fill="${PAPER}"/>` : ''}
  </svg>`;
}
