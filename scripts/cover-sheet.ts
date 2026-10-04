/**
 * Review sheet for generated covers: npx tsx scripts/cover-sheet.ts --portal bs --category "Mobility & Transport"
 * Writes docs/covers/<slug>.html from the snapshot, the collected samples and the usage figures.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { atlasPath } from '../src/atlas';
import { ATLAS_SPECS, subcategoryGlyph } from '../src/atlas-spec';
import { BAND_LABEL, CATEGORY_CLOTH, SPINE_WIDTH, coverSvg, overdue, spineSvg, type CoverInput, type CoverSample } from '../src/cover';
import { snapshotDatasets } from '../src/data/snapshot';
import { pickDoorway } from '../src/doorway';
import { portalById, setActivePortal } from '../src/portal';
import { icon } from '../src/ui/icons';
import { parseUsageRows } from '../src/usage';

const args = process.argv.slice(2);
const flag = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const portal = portalById(flag('portal') ?? 'bs')!;
setActivePortal(portal);
const category = flag('category') ?? 'Mobility & Transport';
const now = new Date(flag('date') ?? '2026-09-27');

const { datasets, source } = snapshotDatasets(portal);
const samplesFile = `src/data/portals/${portal.id}/cover-samples.json`;
const samples: Record<string, CoverSample> = existsSync(samplesFile) ? JSON.parse(readFileSync(samplesFile, 'utf8')).samples : {};
const usageFile = `docs/audit-data/${portal.id}-usage-100057.json`;
const usage = existsSync(usageFile) ? parseUsageRows(JSON.parse(readFileSync(usageFile, 'utf8')).rows) : null;

const inCategory = datasets.filter(dataset => atlasPath(dataset, 'topic').category === category);
const bySub = new Map<string, typeof inCategory>();
for (const dataset of inCategory) {
  const sub = atlasPath(dataset, 'topic').subcategory;
  bySub.set(sub, [...(bySub.get(sub) ?? []), dataset]);
}
const subs = [...bySub].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
const spec = ATLAS_SPECS[category];

const inputFor = (dataset: (typeof inCategory)[number], sub: string, doorwayId?: string): CoverInput => {
  const late = overdue(dataset, now);
  return {
    dataset, category, subcategory: sub, sample: samples[dataset.id],
    signals: { reuses: usage?.get(dataset.id)?.reuses ?? 0, overdue: late.level, overdueNote: late.note, doorway: dataset.id === doorwayId },
  };
};

const sections = subs.map(([sub, list]) => {
  const sorted = [...list].sort((a, b) => a.title.localeCompare(b.title, 'de'));
  const door = pickDoorway(sorted, usage, now);
  const inputs = sorted.map(dataset => inputFor(dataset, sub, door?.dataset.id));
  return `<section><h2>${spec ? icon(subcategoryGlyph(spec, sub), { size: 22 }) : ''}${sub} <small>${list.length} datasets</small></h2>
    <div class="shelf">${inputs.map(spineSvg).join('')}</div>
    <div class="covers">${inputs.map(input => `<figure>${coverSvg(input)}<figcaption>${input.signals.overdueNote ? `<span class="late">${input.signals.overdueNote}</span>` : ''}</figcaption></figure>`).join('')}</div></section>`;
}).join('');

const cloth = CATEGORY_CLOTH[category];
const legend = `<table class="legend"><tr><th>Channel</th><th>Encodes</th></tr>
  <tr><td>Cloth colour</td><td>category (${category})</td></tr>
  <tr><td>Motif, top left</td><td>subcategory glyph</td></tr>
  <tr><td>Cover art</td><td>the dataset's own sample: real positions, records per month, or the column types (text = lines, numbers = dots, dates = ticks, geometry = rings)</td></tr>
  <tr><td>Spine width</td><td>record count: ${SPINE_WIDTH.map((w, i) => `<span class="band" style="width:${w}px;background:${cloth}"></span> ${BAND_LABEL[i]}`).join(' &nbsp; ')}</td></tr>
  <tr><td>Bookmark with notches</td><td>documented reuses (portal figures)</td></tr>
  <tr><td>Patina</td><td>overdue against its own declared rhythm (static or irregular datasets never age)</td></tr>
  <tr><td>Paper tab</td><td>doorway: ready, rarely used (one per group, rule in src/doorway.ts)</td></tr>
  <tr><td>Dashed, empty</td><td>form unknown; no sample: the form mark alone, never an invented pattern</td></tr></table>`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Generated covers: ${category}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>body{margin:0;padding:24px 28px 40px;font:14px/1.5 Inter,system-ui,sans-serif;color:#1f2933;background:#f6f4ef}
h1{margin:0 0 4px;color:#1e4557;font-size:24px}.note{color:#52606d;margin:0 0 18px;max-width:80ch}
section{margin:22px 0 8px}h2{display:flex;align-items:center;gap:8px;font-size:17px;color:#1e4557;margin:0 0 10px}h2 small{font-weight:400;color:#52606d;font-size:13px}
.shelf{display:flex;align-items:flex-end;gap:1px;padding:10px 12px 0;background:linear-gradient(#e9e4d8,#e9e4d8) bottom/100% 10px no-repeat;border-bottom:3px solid #b9ae95;overflow-x:auto;min-height:190px}
.covers{display:grid;grid-template-columns:repeat(auto-fill,minmax(124px,1fr));gap:14px 12px;margin-top:14px}
figure{margin:0}figcaption{font-size:10px;color:#7a5320;min-height:0}.late{display:block;margin-top:2px}
.legend{border-collapse:collapse;font-size:12px;background:#fff;border:1px solid #cbd2db;border-radius:6px;margin:6px 0 10px}.legend th,.legend td{text-align:left;padding:5px 10px;border-bottom:1px solid #e3e8ec;vertical-align:middle}
.band{display:inline-block;height:14px;vertical-align:middle;border-radius:1px}</style></head><body>
<h1>Generated covers: ${category}</h1>
<p class="note">${inCategory.length} datasets from ${portal.label} (${source}; usage: ${usage ? 'dataset 100057' : 'not available'}). Every cover and spine is generated from metadata and a small real sample; none is a publisher image. Order within each group is alphabetical.</p>
${legend}${sections}</body></html>`;

mkdirSync('docs/covers', { recursive: true });
const out = `docs/covers/${category.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')}.html`;
writeFileSync(out, html);
console.log(`${inCategory.length} covers -> ${out}`);
