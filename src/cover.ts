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
import { TOPIC_ICON } from './topic-icons';
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
  /** The portal's outline (scripts/portal-outline.ts): every map cover shares this frame. */
  frame?: Geometry[];
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

const bounds = (points: number[][]) => {
  const lons = points.map(p => p[0]), lats = points.map(p => p[1]);
  return { minLon: Math.min(...lons), maxLon: Math.max(...lons), minLat: Math.min(...lats), maxLat: Math.max(...lats) };
};

/**
 * Positions on a shared frame: the portal's outline, so every map cover is drawn at the same scale
 * and a point reads as "here in the canton", not as a scatter of its own extent. Data reaching well
 * beyond the outline (the Rhine, the airport) widens the frame rather than being cut.
 */
function mapArt(geometries: Geometry[], box: Box, frame: Geometry[] = []): string {
  const all = geometries.flatMap(positions).filter(point => Number.isFinite(point[0]) && Number.isFinite(point[1]));
  if (!all.length) return '';
  const data = bounds(all);
  const outline = frame.flatMap(positions);
  let b = data;
  if (outline.length) {
    const f = bounds(outline);
    const padLon = (f.maxLon - f.minLon) * 0.25, padLat = (f.maxLat - f.minLat) * 0.25;
    const inside = data.minLon >= f.minLon - padLon && data.maxLon <= f.maxLon + padLon && data.minLat >= f.minLat - padLat && data.maxLat <= f.maxLat + padLat;
    b = inside ? f : { minLon: Math.min(f.minLon, data.minLon), maxLon: Math.max(f.maxLon, data.maxLon), minLat: Math.min(f.minLat, data.minLat), maxLat: Math.max(f.maxLat, data.maxLat) };
  }
  const { minLon, maxLon, minLat, maxLat } = b;
  const k = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
  const spanX = Math.max((maxLon - minLon) * k, 1e-9), spanY = Math.max(maxLat - minLat, 1e-9);
  const scale = Math.min(box.w / spanX, box.h / spanY);
  const ox = box.x + (box.w - spanX * scale) / 2, oy = box.y + (box.h - spanY * scale) / 2;
  const xy = (lon: number, lat: number): [string, string] => [(ox + (lon - minLon) * k * scale).toFixed(1), (oy + (maxLat - lat) * scale).toFixed(1)];
  const p = (lon: number, lat: number) => xy(lon, lat).join(' ');
  const path = (ring: number[][]) => ring.map(([lon, lat], i) => `${i ? 'L' : 'M'}${p(lon, lat)}`).join('');
  const base = frame.length
    ? `<path d="${frame.map(g => (g.type === 'Polygon' ? g.coordinates : g.type === 'MultiPolygon' ? g.coordinates.flat() : []).map(r => `${path(r)}Z`).join('')).join('')}" fill="${PAPER}" fill-opacity=".07" stroke="${PAPER}" stroke-opacity=".38" stroke-width=".6" stroke-dasharray="1.6 1.2"/>`
    : '';
  const dot = (lon: number, lat: number) => { const [x, y] = xy(lon, lat); return `<circle cx="${x}" cy="${y}" r="1.6" fill="${PAPER}"/>`; };
  return base + geometries.map(g => {
    switch (g.type) {
      case 'Point': return dot(g.coordinates[0], g.coordinates[1]);
      case 'MultiPoint': return g.coordinates.map(([lon, lat]) => dot(lon, lat)).join('');
      case 'LineString': return `<path d="${path(g.coordinates)}" fill="none" stroke="${PAPER}" stroke-width="1" stroke-linejoin="round"/>`;
      case 'MultiLineString': return `<path d="${g.coordinates.map(path).join('')}" fill="none" stroke="${PAPER}" stroke-width="1" stroke-linejoin="round"/>`;
      case 'Polygon': return `<path d="${g.coordinates.map(r => `${path(r)}Z`).join('')}" fill="${PAPER}" fill-opacity=".22" stroke="${PAPER}" stroke-width=".7"/>`;
      case 'MultiPolygon': return `<path d="${g.coordinates.map(poly => poly.map(r => `${path(r)}Z`).join('')).join('')}" fill="${PAPER}" fill-opacity=".22" stroke="${PAPER}" stroke-width=".7"/>`;
    }
  }).join('');
}

/** Records per month on a time axis: a tick at each January, the first and last year written out. */
function seriesArt(periods: Array<{ period: string; n: number }>, box: Box): string {
  if (!periods.length) return '';
  const axis = box.y + box.h - 8;
  const plot = { ...box, h: box.h - 10 };
  const max = Math.max(...periods.map(period => period.n), 1);
  // At least two years of axis: a series of three months stays three thin bars at the recent end, not three blocks.
  const slots = Math.max(periods.length, 24);
  const step = box.w / slots;
  const x0 = box.x + (slots - periods.length) * step;
  const bars = periods.map((period, i) => {
    if (!period.n) return '';
    const h = Math.max(0.8, (period.n / max) * plot.h);
    return `<rect x="${(x0 + i * step).toFixed(2)}" y="${(plot.y + plot.h - h).toFixed(2)}" width="${Math.max(0.6, step * 0.72).toFixed(2)}" height="${h.toFixed(2)}" fill="${PAPER}"/>`;
  }).join('');
  const years = periods.map((period, i) => ({ year: period.period.slice(0, 4), month: period.period.slice(5, 7), x: x0 + i * step }));
  const ticks = years.filter(y => y.month === '01').map(y => `<path d="M${y.x.toFixed(1)} ${axis}v2.4" stroke="${PAPER}" stroke-width=".6"/>`).join('');
  const label = (text: string, x: number, anchor: string) => `<text x="${x.toFixed(1)}" y="${axis + 8}" font-size="5.6" text-anchor="${anchor}" fill="${PAPER}" fill-opacity=".85" font-family="Inter,system-ui,sans-serif">${text}</text>`;
  const first = years[0].year, last = years[years.length - 1].year;
  return bars + `<path d="M${box.x} ${axis}h${box.w}" stroke="${PAPER}" stroke-width=".6" opacity=".7"/>` + ticks
    + label(first, x0, x0 > box.x + box.w * 0.7 ? 'end' : 'start') + (last !== first ? label(last, box.x + box.w, 'end') : '');
}

const FIELD_KIND = (type: string): 'text' | 'number' | 'date' | 'geo' | 'other' =>
  /text|string/.test(type) ? 'text' : /int|double|decimal|float|number/.test(type) ? 'number' : /date/.test(type) ? 'date' : /geo/.test(type) ? 'geo' : 'other';

/** The table's own columns, named: a type mark (text = line, number = dot, date = tick, geometry = ring) and the column name. */
function tableArt(fields: Array<{ name?: string; type: string }>, box: Box): string {
  const rows = 7;
  const shown = fields.slice(0, fields.length > rows ? rows - 1 : rows);
  if (!shown.length) return '';
  const pitch = box.h / rows;
  const lines = shown.map((field, i) => {
    const y = box.y + (i + 0.5) * pitch;
    const x = box.x + 3;
    const kind = FIELD_KIND(field.type);
    const mark = kind === 'text' ? `<path d="M${x - 2.5} ${y.toFixed(1)}h5" stroke="${PAPER}" stroke-width="1"/>`
      : kind === 'number' ? `<circle cx="${x}" cy="${y.toFixed(1)}" r="1.3" fill="${PAPER}"/>`
      : kind === 'date' ? `<path d="M${x} ${(y - 2.4).toFixed(1)}v4.8" stroke="${PAPER}" stroke-width="1"/>`
      : kind === 'geo' ? `<circle cx="${x}" cy="${y.toFixed(1)}" r="2" fill="none" stroke="${PAPER}" stroke-width=".8"/>`
      : `<rect x="${x - 1.2}" y="${(y - 1.2).toFixed(1)}" width="2.4" height="2.4" fill="${PAPER}" opacity=".6"/>`;
    const name = (field.name ?? '').replace(/_/g, ' ');
    const text = name.length > 24 ? `${name.slice(0, 23)}…` : name;
    return `${mark}<text x="${x + 6}" y="${(y + 2).toFixed(1)}" font-size="5.8" fill="${PAPER}" fill-opacity=".9" font-family="ui-monospace,Menlo,monospace">${esc(text)}</text>`;
  });
  if (fields.length > shown.length) lines.push(`<text x="${box.x + 9}" y="${(box.y + (rows - 0.5) * pitch + 2).toFixed(1)}" font-size="5.6" fill="${PAPER}" fill-opacity=".7" font-family="Inter,system-ui,sans-serif">+${fields.length - shown.length} more columns</text>`);
  return lines.join('');
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
  if (sample?.geometries?.length && ['point', 'line', 'area', 'mixed'].includes(form)) return mapArt(sample.geometries, box, input.frame);
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
  // Categories without a checked subcategory family carry their topic icon, not a guessed glyph.
  return spec ? subcategoryGlyph(spec, input.subcategory) : TOPIC_ICON[input.category] ?? 'topic';
}

function patina(level: number, w: number, h: number, id: string): string {
  if (!level) return '';
  return `<defs><linearGradient id="pat-${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8d9b0" stop-opacity="${(0.05 + level * 0.25).toFixed(2)}"/><stop offset="1" stop-color="#6b5a3a" stop-opacity="${(0.1 + level * 0.35).toFixed(2)}"/></linearGradient></defs><rect width="${w}" height="${h}" rx="3" fill="url(#pat-${id})"/>`;
}

/** A stable small number per dataset, so the print texture differs per book but never between renders. */
export function printSeed(id: string): number {
  let h = 2166136261;
  for (const char of id) h = Math.imul(h ^ char.charCodeAt(0), 16777619) >>> 0;
  return h % 997;
}

/**
 * The print look (docs/COVERS.md): a linocut feel from two SVG filters, applied to the true
 * drawing. `ink` roughens edges by at most about one unit, too little to move a point, a bar or
 * a line in a way anyone could misread. `grain` lets the paper show through the cloth in specks.
 * No shape is added, removed or moved; text stays crisp and is never filtered.
 */
function printDefs(id: string, w: number, h: number): string {
  const seed = printSeed(id);
  return `<defs>
    <filter id="ink-${id}" x="-4%" y="-4%" width="108%" height="108%"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="1" seed="${seed}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="0.8" xChannelSelector="R" yChannelSelector="G"/></filter>
    <filter id="grain-${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.9" numOctaves="1" seed="${seed + 1}"/><feColorMatrix values="0 0 0 0 0.957  0 0 0 0 0.941  0 0 0 0 0.902  0 0 0 -4.2 2.35"/></filter>
    <filter id="wear-${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.035 0.6" numOctaves="2" seed="${seed + 2}"/><feColorMatrix values="0 0 0 0 0.957  0 0 0 0 0.941  0 0 0 0 0.902  0 0 0 -2.6 1.35"/></filter>
  </defs>
  <rect width="${w}" height="${h}" rx="3" filter="url(#grain-${id})" opacity=".16"/>
  <rect width="${w}" height="${h}" rx="3" filter="url(#wear-${id})" opacity=".07"/>`;
}

/** The art under the ink filter, its text (years, column names) kept out of it and crisp. */
function inkedArt(art: string, id: string): string {
  const texts = art.match(/<text[\s\S]*?<\/text>/g) ?? [];
  const shapes = art.replace(/<text[\s\S]*?<\/text>/g, '');
  return `<g opacity=".92" filter="url(#ink-${id})">${shapes}</g><g opacity=".92">${texts.join('')}</g>`;
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
    ${printDefs(id, COVER_W, COVER_H)}
    <rect x="3" y="3" width="${COVER_W - 6}" height="${COVER_H - 6}" rx="2" fill="none" stroke="${PAPER}" stroke-opacity=".28" stroke-width=".6" filter="url(#ink-${id})"/>
    <g filter="url(#ink-${id})">${glyph(motif(input), 9, 9, 22)}</g>
    <text x="${COVER_W - 10}" y="16" text-anchor="end" font-size="6" fill="${PAPER}" fill-opacity=".75" font-family="ui-monospace,Menlo,monospace">${esc(dataset.id)}</text>
    ${inkedArt(coverArt(input, { x: 12, y: 40, w: COVER_W - 24, h: 70 }), id)}
    <text x="10" y="128" font-size="${Math.max(...lines.map(line => line.length)) > 15 ? 8.2 : 9.2}" font-weight="650" fill="${PAPER}" font-family="Inter,system-ui,sans-serif">${title}</text>
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
    ${printDefs(id, w, COVER_H)}
    <path d="M0 3.5h${w}M0 ${COVER_H - 3.5}h${w}" stroke="${PAPER}" stroke-opacity=".35" stroke-width=".6" filter="url(#ink-${id})"/>
    <g filter="url(#ink-${id})">${glyph(motif(input), (w - icon) / 2, 7, icon, PAPER, 1.8)}</g>
    <text transform="translate(${(w / 2 + 2.3).toFixed(1)} ${22 + icon}) rotate(90)" font-size="6.4" font-weight="600" fill="${PAPER}" font-family="Inter,system-ui,sans-serif">${esc(title)}</text>
    ${glyph(FORM_MARK[form], (w - Math.min(w - 3, 9)) / 2, COVER_H - 15, Math.min(w - 3, 9), PAPER, 1.8)}
    ${patina(signals.overdue, w, COVER_H, id)}
    ${signals.reuses ? `<path d="M${w / 2 - 1.5} ${COVER_H}v7l1.5-1.5 1.5 1.5v-7z" fill="${PAPER}"/>` : ''}
  </svg>`;
}
