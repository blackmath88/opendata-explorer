/**
 * Bringing a canton into DataFit, one gated step at a time
 * (npx tsx scripts/portals.ts <command>):
 *
 *   discover [out.json]         opendata.swiss publishers grouped by canton, as draft CKAN portal
 *                               entries. A person reviews them before anything goes into src/portal.ts.
 *   snapshot --portal <id>      freeze the portal's raw catalogue to src/data/portals/<id>/snapshot.json
 *   audit --portal <id>         what the Landscape can rely on for that portal, as a Markdown table
 *   duplicates --portal <id> [out.json]
 *                               for a portal of its own: which of its datasets reappear on opendata.swiss,
 *                               and what exists only there (see src/data/duplicates.ts)
 *
 * Then, per portal: topic-decisions.ts requests / apply / eval (see docs/MULTI_CANTON.md).
 * Nothing here needs a model; discover and snapshot need network access to the portal. Behind an
 * HTTPS proxy, run with NODE_USE_ENV_PROXY=1 (Node's fetch ignores HTTPS_PROXY otherwise).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { CANTONS, cantonOfPublisher, type PublisherLevel } from '../src/cantons';
import { CkanDcatAdapter, ckanFetch, localized } from '../src/data/ckan';
import { OpendatasoftAdapter } from '../src/data/ods-adapter';
import { topicDecisionFile } from '../src/data/portals';
import { mergeCatalogues, splitIdentifier } from '../src/data/duplicates';
import { snapshotDatasets, snapshotPath, writeSnapshot } from '../src/data/snapshot';
import { CADENCES, CADENCE_LABEL, SHAPES, SHAPE_LABEL, profile, shapeOf } from '../src/catalogue-profile';
import { BASEL_STADT, portalById, setActivePortal, type Portal } from '../src/portal';
import { rolloutLevel } from '../src/coverage';
import { topicGold } from '../src/data/portals';
import { indexDecisions, needsDecision, resolveTopic } from '../src/topic-decisions';
import { assessTopic, type TopicStatus } from '../src/topic-scoring';

/** The national catalogue's CKAN API. Checked against the documentation, not yet against this code. */
const OPENDATA_SWISS: Portal = {
  ...BASEL_STADT,
  id: 'opendata-swiss',
  canton: 'CH',
  label: 'opendata.swiss',
  shortLabel: 'opendata.swiss',
  place: 'Switzerland',
  api: { kind: 'ckan', base: 'https://ckan.opendata.swiss', site: 'https://opendata.swiss/de', organizations: [] },
  places: [],
  verified: false,
  snapshot: false,
};

const [command, ...rest] = process.argv.slice(2);
const flag = (name: string) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : undefined; };
const positional = rest.find((arg, i) => !arg.startsWith('--') && !rest[i - 1]?.startsWith('--'));

function requirePortal(): Portal {
  const portal = portalById(flag('portal'));
  if (!portal) throw new Error(`--portal must be one of the entries in src/portal.ts (got "${flag('portal')}")`);
  setActivePortal(portal);
  return portal;
}

const pct = (part: number, total: number) => (total ? `${Math.round((part / total) * 100)}%` : '–');

if (command === 'discover') {
  interface Organization { name?: string; title?: unknown; package_count?: number }
  // With all_fields the server returns at most 25 per call (observed: 25 of 176), so page.
  const organizations: Organization[] = [];
  for (let offset = 0; offset < 5000; offset += 25) {
    const page = await ckanFetch<Organization[]>(OPENDATA_SWISS, 'organization_list', { all_fields: 'true', limit: 25, offset });
    organizations.push(...page);
    if (page.length < 25) break;
  }
  console.error(`${organizations.length} organizations on opendata.swiss`);
  const byCanton = new Map<string, Array<{ name: string; title: string; datasets: number; level: PublisherLevel }>>();
  const unassigned: string[] = [];
  for (const organization of organizations) {
    const name = organization.name ?? '';
    const title = localized(organization.title)[0] ?? '';
    const match = cantonOfPublisher(name, title);
    if (!match) { unassigned.push(name); continue; }
    byCanton.set(match.canton.code, [...(byCanton.get(match.canton.code) ?? []), { name, title, datasets: organization.package_count ?? 0, level: match.level }]);
  }
  const drafts = CANTONS.map(canton => {
    const publishers = (byCanton.get(canton.code) ?? []).sort((a, b) => b.datasets - a.datasets);
    // Only publishers that name themselves cantonal go into the draft; "unclear" ones (a university,
    // an airport, a utility named after the place) are listed for a person to decide.
    const cantonal = publishers.filter(publisher => publisher.level === 'canton');
    const review = publishers.filter(publisher => publisher.level === 'unclear');
    return {
      canton: canton.code,
      name: canton.names[0],
      datasets: cantonal.reduce((sum, publisher) => sum + publisher.datasets, 0),
      draftPortal: {
        id: `${canton.code.toLowerCase()}-ods-swiss`,
        label: `Kanton ${canton.names[0]} on opendata.swiss`,
        languages: canton.languages,
        api: { kind: 'ckan', base: OPENDATA_SWISS.api.base, site: OPENDATA_SWISS.api.site, organizations: cantonal.map(publisher => publisher.name) },
        verified: false,
        todo: [...(review.length ? [`decide on ${review.map(publisher => publisher.name).join(', ')}`] : []), 'bbox from swissBOUNDARIES3D', 'place names for questions'],
      },
      // Municipal publishers (e.g. a city portal) are listed but not folded into the canton.
      publishers,
    };
  });
  const out = JSON.stringify({ source: `${OPENDATA_SWISS.api.base} organization_list`, takenAt: new Date().toISOString(), cantons: drafts, unassigned }, null, 2);
  if (positional) { mkdirSync(dirname(positional), { recursive: true }); writeFileSync(positional, out + '\n'); } else console.log(out);
  console.error(drafts.map(draft => `${draft.canton} ${String(draft.datasets).padStart(5)} datasets  ${draft.draftPortal.api.organizations.length} cantonal publishers  (${draft.publishers.length - draft.draftPortal.api.organizations.length} municipal/unclear)`).join('\n'));
  console.error(`${unassigned.length} publishers not assigned to a canton (federal, municipal without canton name, other)`);
} else if (command === 'snapshot') {
  const portal = requirePortal();
  const adapter = portal.api.kind === 'ods' ? new OpendatasoftAdapter(portal) : new CkanDcatAdapter(portal);
  const result = await adapter.loadCatalog();
  mkdirSync(dirname(snapshotPath(portal)), { recursive: true });
  const path = writeSnapshot(portal, adapter.rawEntries(), result.reportedTotal);
  console.log(`${portal.shortLabel}: ${result.datasets.length} datasets (reported ${result.reportedTotal ?? 'n/a'}) -> ${path}`);
  for (const note of result.notes) console.log(`  note: ${note}`);
} else if (command === 'audit') {
  const portal = requirePortal();
  const { datasets, source } = snapshotDatasets(portal);
  const fp = profile(datasets);
  const decisions = indexDecisions(topicDecisionFile(portal.id));
  const status: Record<TopicStatus, number> = { clear: 0, conflict: 0, weak: 0, catch_all_only: 0, none: 0 };
  for (const dataset of datasets) status[assessTopic(dataset).status]++;
  const open = datasets.filter(dataset => needsDecision(dataset, decisions)).length;
  const gold = topicGold(portal.id);
  const labelled = gold ? datasets.filter(dataset => gold.labels[dataset.id]) : [];
  const regressions = labelled.filter(dataset => gold!.labels[dataset.id].includes(assessTopic(dataset).pick.subcategory) && !gold!.labels[dataset.id].includes(resolveTopic(dataset, decisions).subcategory));
  const level = rolloutLevel({
    snapshot: true,
    decisionsOpen: open,
    goldConfirmed: !!gold && labelled.length > 0 && !/^draft/i.test(gold.status),
    evalPassed: labelled.length > 0 && regressions.length === 0,
    liveVerified: portal.verified && source.startsWith('src/data/portals'),
    usageMeasured: false,
  });
  const lines = [
    `# Catalogue audit: ${portal.label}`,
    '',
    `Source: ${source}. n = ${datasets.length}. API: ${portal.api.kind}${portal.verified ? '' : ' (portal entry not verified)'}.`,
    '',
    '| Signal | Coverage |',
    '|---|---|',
    `| Declared geometry | ${datasets.length - fp.shape.unknown} of ${datasets.length} classified (${SHAPES.map(key => `${fp.shape[key]} ${SHAPE_LABEL[key]}`).join(', ')}) |`,
    `| Declared update frequency | ${datasets.length - fp.cadence.unknown} of ${datasets.length} (${CADENCES.map(key => `${fp.cadence[key]} ${CADENCE_LABEL[key]}`).join(', ')}) |`,
    `| Record count | ${datasets.length - fp.recordsUnknown} of ${datasets.length}${fp.recordsMedian !== null ? `, median ${fp.recordsMedian}` : ''} |`,
    `| Readable records | ${datasets.filter(dataset => dataset.hasRecords).length} of ${datasets.length} |`,
    '',
    '| Topic (rules) | Datasets |',
    '|---|---|',
    ...(Object.keys(status) as TopicStatus[]).map(key => `| ${key} | ${status[key]} (${pct(status[key], datasets.length)}) |`),
    '',
    `Topic decisions still open: ${open} of ${datasets.length}.`,
    `Gold labels: ${labelled.length ? `${labelled.length}${/^draft/i.test(gold!.status) ? ' (draft, not confirmed by a person)' : ''}, ${regressions.length} regressions from decisions` : 'none'}.`,
    '',
    `**Rollout level: L${level}** (L0 listed, L1 audited, L2 topics decided, L3 evaluated, L4 live, L5 activity; docs/MULTI_CANTON.md).`,
  ];
  console.log(lines.join('\n'));
} else if (command === 'duplicates') {
  const portal = requirePortal();
  if (!portal.nationalPublishers?.length) throw new Error(`${portal.label} lists no nationalPublishers`);
  const { datasets: primary, source } = snapshotDatasets(portal);
  const national = await new CkanDcatAdapter({ ...OPENDATA_SWISS, id: `${portal.id}-national`, api: { ...OPENDATA_SWISS.api, organizations: portal.nationalPublishers } } as Portal).listDatasets();
  const merge = mergeCatalogues(primary, national, portal.nationalPublishers);
  const byId = new Map(national.map(dataset => [dataset.id, dataset]));
  // What exists only nationally: group by the shape of the identifier's local part.
  const kinds: Record<string, number> = {};
  for (const id of merge.nationalOnly) {
    const local = splitIdentifier(byId.get(id)?.identifier)?.local ?? '(no identifier)';
    const kind = /^\d+$/.test(local) ? 'numeric id, not in the portal'
      : /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(local) ? 'uuid (geodata catalogue)'
      : /^vote-/.test(local) ? 'vote-* (one per ballot)'
      : local === '(no identifier)' ? local : 'other identifier';
    kinds[kind] = (kinds[kind] ?? 0) + 1;
  }
  const onlyRecords = merge.nationalOnly.map(id => byId.get(id)!);
  const shapes: Record<string, number> = {};
  for (const dataset of onlyRecords) shapes[shapeOf(dataset)] = (shapes[shapeOf(dataset)] ?? 0) + 1;
  const downloadable = onlyRecords.filter(dataset => dataset.hasRecords).length;
  const primaryOnly = primary.filter(dataset => !merge.linked.has(dataset.id)).map(dataset => dataset.id);
  const report = {
    portal: portal.id, primarySource: source, takenAt: new Date().toISOString(),
    primary: primary.length, national: national.length, linked: merge.linked.size,
    primaryOnly, nationalOnly: merge.nationalOnly.length, nationalOnlyKinds: kinds, nationalOnlyShapes: shapes, nationalOnlyDownloadable: downloadable,
    nationalOnlySample: merge.nationalOnly.slice(0, 40).map(id => ({ id, identifier: byId.get(id)?.identifier, title: byId.get(id)?.title, publisher: byId.get(id)?.publisher })),
    total: merge.datasets.length,
  };
  if (positional) writeFileSync(positional, JSON.stringify(report, null, 2) + '\n');
  console.log(`${portal.shortLabel}: ${primary.length} on the portal, ${national.length} on opendata.swiss`);
  console.log(`  linked by identifier: ${merge.linked.size}; portal only: ${primaryOnly.length}; opendata.swiss only: ${merge.nationalOnly.length} ${JSON.stringify(kinds)}`);
  console.log(`  opendata.swiss only, by shape: ${JSON.stringify(shapes)}; with a downloadable file: ${downloadable}`);
  console.log(`  distinct datasets: ${merge.datasets.length}`);
} else {
  console.log('usage: npx tsx scripts/portals.ts discover [out.json] | snapshot --portal <id> | audit --portal <id> | duplicates --portal <id> [out.json]');
  process.exit(command ? 1 : 0);
}
