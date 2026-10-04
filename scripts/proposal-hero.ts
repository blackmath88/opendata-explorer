/**
 * Writes the "Unentdeckt" block into v2/index.html (version 2 of the proposal page): npx tsx scripts/proposal-hero.ts [--portal bs] [--category "Mobility & Transport"] [--count 3]
 * The doorways of the largest groups, with their generated covers. No live requests: snapshot,
 * cover samples and usage figures only. Re-running replaces the block between its markers.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { atlasPath } from '../src/atlas';
import { ATLAS_SPECS, dataForm, subcategoryGlyph } from '../src/atlas-spec';
import { coverSvg, overdue, type CoverSample } from '../src/cover';
import { snapshotDatasets } from '../src/data/snapshot';
import { pickDoorway } from '../src/doorway';
import { portalById, setActivePortal } from '../src/portal';
import { heroHtml, spliceHero, type HeroPick } from '../src/proposal-hero';
import { icon } from '../src/ui/icons';
import { parseUsageRows } from '../src/usage';

const args = process.argv.slice(2);
const flag = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const portal = portalById(flag('portal') ?? 'bs')!;
setActivePortal(portal);
const category = flag('category') ?? 'Mobility & Transport';
const howMany = Number(flag('count') ?? 3);
const asOf = flag('date') ?? '2026-09-27';
const now = new Date(asOf);

const { datasets } = snapshotDatasets(portal);
const samplesFile = `src/data/portals/${portal.id}/cover-samples.json`;
const samples: Record<string, CoverSample> = existsSync(samplesFile) ? JSON.parse(readFileSync(samplesFile, 'utf8')).samples : {};
const usageFile = `docs/audit-data/${portal.id}-usage-100057.json`;
const usage = existsSync(usageFile) ? parseUsageRows(JSON.parse(readFileSync(usageFile, 'utf8')).rows) : null;
const spec = ATLAS_SPECS[category];
const outlineFile = `src/data/portals/${portal.id}/outline.json`;
const frame = existsSync(outlineFile) ? JSON.parse(readFileSync(outlineFile, 'utf8')).outline : undefined;

const inCategory = datasets.filter(dataset => atlasPath(dataset, 'topic').category === category);
const bySub = new Map<string, typeof inCategory>();
for (const dataset of inCategory) {
  const sub = atlasPath(dataset, 'topic').subcategory;
  bySub.set(sub, [...(bySub.get(sub) ?? []), dataset]);
}
const groups = [...bySub].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));

const picks: HeroPick[] = [];
for (const [name, list] of groups) {
  if (picks.length >= howMany) break;
  const doorway = pickDoorway(list, usage, now);
  if (!doorway) continue;
  const { dataset } = doorway;
  const late = overdue(dataset, now);
  picks.push({
    group: name,
    groupSize: list.length,
    glyph: spec ? icon(subcategoryGlyph(spec, name), { size: 18 }) : '',
    doorway,
    form: dataForm(dataset),
    cover: coverSvg({ dataset, category, subcategory: name, sample: samples[dataset.id], frame, signals: { reuses: usage?.get(dataset.id)?.reuses ?? 0, overdue: late.level, overdueNote: late.note, doorway: true } }),
    catalogueUrl: `/catalogue/?portal=${encodeURIComponent(portal.id)}#dataset=${encodeURIComponent(dataset.id)}`,
  });
}

const block = heroHtml(picks, { category, categorySize: inCategory.length, groupCount: groups.length, asOf, libraryUrl: `/library/?portal=${encodeURIComponent(portal.id)}` });
const page = flag('page') ?? 'v2/index.html';
writeFileSync(page, spliceHero(readFileSync(page, 'utf8'), block));
console.log(`${picks.map(pick => `${pick.group}: ${pick.doorway.dataset.id}`).join(', ')} -> ${page}`);
