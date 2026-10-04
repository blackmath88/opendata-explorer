/**
 * Static data for question shelves: npx tsx scripts/library-catalogue.ts [--portal bs]
 * Writes public/library/<portal>-catalogue.json (every dataset, its topic path and usage figures)
 * and public/library/samples/<portal>-<category>.json (cover samples, one file per category, so a
 * question loads only the categories it touches). No live requests.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { atlasPath } from '../src/atlas';
import type { CoverSample } from '../src/cover';
import { snapshotDatasets } from '../src/data/snapshot';
import type { CatalogueData } from '../src/library/types';
import { portalById, setActivePortal } from '../src/portal';
import { parseUsageRows, type UsageRecord } from '../src/usage';
import { categorySlug } from '../src/library/types';

const args = process.argv.slice(2);
const flag = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const portal = portalById(flag('portal') ?? 'bs')!;
setActivePortal(portal);
const asOf = flag('date') ?? '2026-09-27';

const { datasets, source } = snapshotDatasets(portal);
const samplesFile = `src/data/portals/${portal.id}/cover-samples.json`;
const samples: Record<string, CoverSample> = existsSync(samplesFile) ? JSON.parse(readFileSync(samplesFile, 'utf8')).samples : {};
const usageFile = `docs/audit-data/${portal.id}-usage-100057.json`;
const usage = existsSync(usageFile) ? parseUsageRows(JSON.parse(readFileSync(usageFile, 'utf8')).rows) : null;

const paths: CatalogueData['paths'] = {};
const outlineFile = `src/data/portals/${portal.id}/outline.json`;
const frame = existsSync(outlineFile) ? JSON.parse(readFileSync(outlineFile, 'utf8')).outline : undefined;
const byCategory = new Map<string, Record<string, CoverSample>>();
for (const dataset of datasets) {
  const { category, subcategory } = atlasPath(dataset, 'topic');
  paths[dataset.id] = [category, subcategory];
  if (samples[dataset.id]) byCategory.set(category, { ...(byCategory.get(category) ?? {}), [dataset.id]: samples[dataset.id] });
}

const data: CatalogueData = {
  portal: { id: portal.id, label: portal.label, site: portal.api.kind === 'ods' ? portal.api.site : '' },
  asOf,
  source,
  usageNote: usage ? 'dataset 100057 (portal activity counters)' : 'not available',
  datasets,
  paths,
  outline: frame ?? null,
  usage: usage ? Object.fromEntries([...usage].filter(([id]) => paths[id])) as Record<string, UsageRecord> : null,
};
mkdirSync('public/library/samples', { recursive: true });
writeFileSync(`public/library/${portal.id}-catalogue.json`, JSON.stringify(data));
for (const [category, entries] of byCategory) writeFileSync(`public/library/samples/${portal.id}-${categorySlug(category)}.json`, JSON.stringify(entries));
console.log(`${datasets.length} datasets, ${byCategory.size} sample files -> public/library/`);
