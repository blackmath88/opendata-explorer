/**
 * Static data for the 3D library page: npx tsx scripts/library-data.ts --portal bs --category "Mobility & Transport"
 * Writes public/library/<portal>-<category>.json with each book's facts and its generated cover
 * and spine (SVG), from the snapshot, the cover samples and the usage figures. No live requests.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { atlasPath } from '../src/atlas';
import { ATLAS_SPECS, dataForm, FORM_LABEL, subcategoryGlyph } from '../src/atlas-spec';
import { BAND_LABEL, SPINE_WIDTH, coverSvg, overdue, recordBand, spineSvg, type CoverSample } from '../src/cover';
import { snapshotDatasets } from '../src/data/snapshot';
import { pickDoorway } from '../src/doorway';
import type { LibraryData } from '../src/library/types';
import { portalById, setActivePortal } from '../src/portal';
import { icon } from '../src/ui/icons';
import { parseUsageRows } from '../src/usage';

const args = process.argv.slice(2);
const flag = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const portal = portalById(flag('portal') ?? 'bs')!;
setActivePortal(portal);
const category = flag('category') ?? 'Mobility & Transport';
const asOf = flag('date') ?? '2026-09-27';
const now = new Date(asOf);

const { datasets, source } = snapshotDatasets(portal);
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

const data: LibraryData = {
  portal: { id: portal.id, label: portal.label, site: portal.api.kind === 'ods' ? portal.api.site : '' },
  category,
  asOf,
  source,
  usage: usage ? 'dataset 100057 (portal activity counters)' : 'not available',
  groups: groups.map(([name, list]) => {
    const sorted = [...list].sort((a, b) => a.title.localeCompare(b.title, 'de'));
    const door = pickDoorway(sorted, usage, now);
    return {
      name,
      glyph: spec ? icon(subcategoryGlyph(spec, name), { size: 20 }) : '',
      books: sorted.map(dataset => {
        const late = overdue(dataset, now);
        const reuses = usage?.get(dataset.id)?.reuses ?? 0;
        const input = { dataset, category, subcategory: name, sample: samples[dataset.id], frame, signals: { reuses, overdue: late.level, overdueNote: late.note, doorway: dataset.id === door?.dataset.id } };
        const band = recordBand(dataset.recordsCount);
        return {
          id: dataset.id,
          title: dataset.title,
          description: dataset.description.length > 420 ? `${dataset.description.slice(0, 419)}…` : dataset.description,
          publisher: dataset.publisher,
          form: FORM_LABEL[dataForm(dataset)],
          records: dataset.recordsCount ?? null,
          band,
          bandLabel: BAND_LABEL[band],
          spineWidth: SPINE_WIDTH[band],
          reuses,
          cadence: dataset.characteristics.updateFrequency ?? null,
          modified: dataset.modified ?? null,
          overdueNote: late.note ?? null,
          overdue: late.level,
          doorway: dataset.id === door?.dataset.id,
          doorwayReason: dataset.id === door?.dataset.id ? door!.reason : null,
          sourceUrl: dataset.sourceUrl,
          spine: spineSvg(input),
          cover: coverSvg(input),
        };
      }),
    };
  }),
};

mkdirSync('public/library', { recursive: true });
const out = `public/library/${portal.id}-${category.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')}.json`;
writeFileSync(out, JSON.stringify(data));
console.log(`${inCategory.length} books in ${groups.length} groups -> ${out}`);
