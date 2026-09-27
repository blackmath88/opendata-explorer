import type { DatasetMatch, DatasetRecord, EvidenceClass } from './types';
import type { IconName } from './ui/icons';
import { OTHER_TOPIC, TOPIC_RULES, datasetText, labelText, type Rule } from './topic-rules';
import { indexDecisions, resolveTopic, type TopicDecisionFile } from './topic-decisions';
import decisionFile from './data/topic-decisions.json';

const TOPIC_DECISIONS = indexDecisions(decisionFile as TopicDecisionFile);

export type AtlasLens = 'topic' | 'space' | 'time' | 'readiness';

export interface AtlasPath {
  category: string;
  subcategory: string;
  detail?: string;
}

export interface AtlasNodeSummary {
  id: string;
  label: string;
  datasets: DatasetRecord[];
  total: number;
  matching: number;
  direct: number;
  supporting: number;
  contextual: number;
  aggregateRelevance: number;
}

export interface AtlasState {
  lens: AtlasLens;
  path: string[];
  showDatasets?: boolean;
}

export const ATLAS_BROWSE_LIMIT = 25;

export interface AtlasHierarchyDatum {
  id: string;
  label: string;
  kind: 'lens' | 'category' | 'dataset';
  depth: number;
  total: number;
  matching: number;
  direct: number;
  supporting: number;
  contextual: number;
  aggregateRelevance: number;
  dataset?: DatasetRecord;
  children?: AtlasHierarchyDatum[];
}

export const ATLAS_LENS_LABEL: Record<AtlasLens, string> = {
  topic: 'Topic',
  space: 'Space',
  time: 'Time',
  readiness: 'Readiness',
};



/** Top-level Topic categories, in rule order, plus the fallback bucket. */
export const TOPIC_CATEGORIES: readonly string[] = [...TOPIC_RULES.map(([category]) => category), OTHER_TOPIC];

/**
 * Icons for top-level Atlas categories. Topic icons were added with pikto (sources and reasoning in
 * .pikto/provenance.json); Space reuses the set's own geometry glyphs. Time and Readiness buckets and all
 * subcategories stay text: there an icon would be decoration, not recognition.
 */
export const CATEGORY_ICON: Readonly<Partial<Record<AtlasLens, Readonly<Record<string, IconName>>>>> = {
  topic: {
    'Environment & Climate': 'topic-environment',
    'Mobility & Transport': 'topic-mobility',
    'People & Society': 'topic-people',
    'Built City & Infrastructure': 'topic-built',
    'Public Space & Leisure': 'topic-public-space',
    Health: 'topic-health',
    Education: 'topic-education',
    Culture: 'topic-culture',
    'Government & Economy': 'topic-government',
    'Other / review needed': 'topic-other',
  },
  space: {
    Point: 'geo-point',
    Line: 'geo-line',
    Polygon: 'geo-polygon',
    Mixed: 'geo-mixed',
    'Raster / external asset': 'geo-raster',
    'Non-spatial': 'geo-none',
  },
};

export function categoryIcon(node: AtlasHierarchyDatum): IconName | undefined {
  if (node.kind !== 'category' || node.depth !== 1) return undefined;
  const lens = node.id.match(/^lens:(\w+)\//)?.[1] as AtlasLens | undefined;
  return lens ? CATEGORY_ICON[lens]?.[node.label] : undefined;
}


/** Resolved through topic-decisions.ts: human > validated model decision > scored rules. */
function topicPath(dataset: DatasetRecord): AtlasPath {
  const { category, subcategory } = resolveTopic(dataset, TOPIC_DECISIONS);
  const detail = topicDetail(subcategory, labelText(dataset));
  return { category, subcategory, detail: detail?.endsWith('(other)') ? topicDetail(subcategory, datasetText(dataset)) : detail };
}

function topicDetail(subcategory: string, haystack: string): string | undefined {
  const rules: Record<string, ReadonlyArray<Rule>> = {
    'Urban nature': [
      ['Trees & canopy', /baum|tree|canopy|allee|gehölz|gehoelz/],
      ['Parks & green space', /park|grünanlage|gruenanlage|green space|garten|garden|wiese/],
      ['Biodiversity', /biodiv|flora|fauna|artenschutz|species|biotop|habitat/],
      ['Urban maintenance', /pflege|maintenance|unterhalt|schnitt|bewässer|bewaesser/],
    ],
    'Road traffic': [['Traffic counts', /zähl|zaehl|count|frequenz/], ['Road network', /strasse|straße|street|route|netz/], ['Incidents & safety', /unfall|accident|sicherheit|safety/]],
    Population: [['Residents', /einwohner|resident|wohnbevölkerung/], ['Demographics', /alter|age|geschlecht|gender|demograph/], ['Households', /haushalt|household/]],
    Buildings: [['Building inventory', /inventar|bestand|inventory/], ['Addresses', /adresse|address/], ['Energy & condition', /energie|energy|zustand|condition/]],
    Administration: [['Elections & votes', /wahl|election|abstimmung|vote/], ['Services & offices', /dienst|service|amt|office|behörde|behoerde/]],
  };
  const candidates = rules[subcategory];
  if (!candidates) return undefined;
  return candidates.find(([, pattern]) => pattern.test(haystack))?.[0] ?? `${subcategory} (other)`;
}

function normalizedGeometry(dataset: DatasetRecord): string[] {
  return dataset.characteristics.geometryTypes.map(value => value.toLocaleLowerCase());
}

function spacePath(dataset: DatasetRecord): AtlasPath {
  const types = normalizedGeometry(dataset);
  if (!dataset.hasRecords && dataset.formats.includes('other')) return { category: 'Raster / external asset', subcategory: 'External asset' };
  if (!dataset.characteristics.geospatial) return { category: 'Non-spatial', subcategory: 'Tabular / metadata' };
  if (!types.length) return { category: 'Unknown', subcategory: 'Geometry type not declared' };
  if (types.length > 1) return { category: 'Mixed', subcategory: types.join(' + ') };
  const type = types[0];
  if (/point/.test(type)) return { category: 'Point', subcategory: type };
  if (/line|curve/.test(type)) return { category: 'Line', subcategory: type };
  if (/polygon|surface/.test(type)) return { category: 'Polygon', subcategory: type };
  if (/raster|image|wms|wmts|geotiff/.test(type)) return { category: 'Raster / external asset', subcategory: type };
  return { category: 'Unknown', subcategory: type };
}

/** DCAT/opendata.swiss frequency codes as people read them. */
const FREQUENCY_LABEL: Record<string, string> = {
  cont: 'Continuous', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly',
  annual: 'Annual', annual_2: 'Every 2 years', annual_3: 'Every 3 years', irreg: 'Irregular',
  never: 'No updates planned', update: 'Updated as needed', 'as needed': 'Updated as needed', unknown: 'Cadence not declared',
};

function frequencyLabel(frequency: string): string {
  const key = frequency.trim().replace(/\s+/g, '_');
  const label = FREQUENCY_LABEL[frequency] ?? FREQUENCY_LABEL[key] ?? frequency.replace(/_/g, ' ');
  return label.charAt(0).toLocaleUpperCase() + label.slice(1);
}

function timePath(dataset: DatasetRecord): AtlasPath {
  const raw = dataset.characteristics.updateFrequency?.toLocaleLowerCase() ?? '';
  const frequency = raw ? frequencyLabel(raw) : '';
  if (dataset.characteristics.realtime || /cont|hour|minute|daily/.test(raw)) return { category: 'Near-live / frequent', subcategory: frequency || 'Frequent feed' };
  if (dataset.characteristics.timeSeries) return { category: 'Time series', subcategory: frequency || 'Cadence not declared' };
  if (/week|month|quarter|annual|year|period/.test(raw)) return { category: 'Periodic snapshot', subcategory: frequency };
  if (/histor|archive/.test(datasetText(dataset))) return { category: 'Historical', subcategory: frequency || 'Historical collection' };
  if (dataset.characteristics.temporalCoverage.length) return { category: 'Current/reference', subcategory: 'Declared temporal coverage' };
  if (frequency) return { category: 'Current/reference', subcategory: frequency };
  return { category: 'Unknown', subcategory: 'Temporal status not declared' };
}

function readinessPath(dataset: DatasetRecord): AtlasPath {
  const types = normalizedGeometry(dataset);
  if (!dataset.hasRecords) return { category: 'Empty / external', subcategory: dataset.formats.includes('other') ? 'External asset' : 'No queryable records' };
  if (dataset.recordsCount !== undefined && dataset.recordsCount < 10) return { category: 'Sparse', subcategory: dataset.recordsCount < 3 ? '1–2 records' : '3–9 records' };
  if (types.length > 1) return { category: 'Mixed geometry', subcategory: types.join(' + ') };
  if (dataset.characteristics.geospatial && types.length) return { category: 'Ready spatial', subcategory: types[0] };
  if (!dataset.characteristics.geospatial && dataset.fieldCount) return { category: 'Ready tabular', subcategory: fieldBand(dataset.fieldCount) };
  if (dataset.characteristics.geospatial) return { category: 'Needs transformation', subcategory: 'Geometry not declared' };
  return { category: 'Unknown', subcategory: 'Structure not available' };
}

/** Exact field counts fragment the Atlas into dozens of one-off buckets; bands keep it navigable. */
function fieldBand(count: number): string {
  if (count <= 5) return '1–5 fields';
  if (count <= 12) return '6–12 fields';
  if (count <= 25) return '13–25 fields';
  return '26+ fields';
}

export function atlasPath(dataset: DatasetRecord, lens: AtlasLens): AtlasPath {
  if (lens === 'topic') return topicPath(dataset);
  if (lens === 'space') return spacePath(dataset);
  if (lens === 'time') return timePath(dataset);
  return readinessPath(dataset);
}

export function atlasSegments(dataset: DatasetRecord, lens: AtlasLens): string[] {
  const path = atlasPath(dataset, lens);
  return [path.category, path.subcategory, path.detail].filter((value): value is string => Boolean(value));
}

export function atlasSummaries(
  datasets: DatasetRecord[],
  matches: DatasetMatch[],
  state: AtlasState,
  searchMatches: Set<string>,
): AtlasNodeSummary[] {
  const matchById = new Map(matches.map(match => [match.dataset.id, match]));
  const groups = new Map<string, DatasetRecord[]>();
  for (const dataset of datasets) {
    const segments = atlasSegments(dataset, state.lens);
    if (!state.path.every((part, index) => segments[index] === part)) continue;
    const label = segments[state.path.length];
    if (!label) continue;
    const group = groups.get(label) ?? [];
    group.push(dataset);
    groups.set(label, group);
  }
  return [...groups].map(([label, items]) => summarize(label, items, matchById, searchMatches))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
}

function summarize(label: string, datasets: DatasetRecord[], matches: Map<string, DatasetMatch>, searchMatches: Set<string>): AtlasNodeSummary {
  const counts: Record<EvidenceClass, number> = { direct: 0, supporting: 0, contextual: 0, missing: 0 };
  let aggregateRelevance = 0;
  for (const dataset of datasets) {
    const match = matches.get(dataset.id);
    if (match) {
      counts[match.evidenceClass] += 1;
      aggregateRelevance += match.relevance.score;
    }
  }
  return {
    id: label,
    label,
    datasets,
    total: datasets.length,
    matching: datasets.filter(dataset => searchMatches.has(dataset.id)).length,
    direct: counts.direct,
    supporting: counts.supporting,
    contextual: counts.contextual,
    aggregateRelevance,
  };
}

export function datasetsAtPath(datasets: DatasetRecord[], state: AtlasState): DatasetRecord[] {
  return datasets.filter(dataset => state.path.every((part, index) => atlasSegments(dataset, state.lens)[index] === part));
}

export function shouldSubdivide(datasets: DatasetRecord[], state: AtlasState): boolean {
  if (datasets.length <= ATLAS_BROWSE_LIMIT) return false;
  const segments = datasets.map(dataset => atlasSegments(dataset, state.lens));
  const next = new Set(segments.map(parts => parts[state.path.length]).filter(Boolean));
  if (next.size >= 2) return true;
  // A single semantic child is worth traversing only when it unlocks a real
  // split one level later; otherwise it is a redundant label, not navigation.
  const deeper = new Set(segments.map(parts => parts[state.path.length + 1]).filter(Boolean));
  return next.size === 1 && deeper.size >= 2;
}

/** One stable hierarchy powers the full semantic-zoom Atlas. */
export function buildAtlasHierarchy(datasets: DatasetRecord[], matches: DatasetMatch[], lens: AtlasLens, searchMatches: Set<string>): AtlasHierarchyDatum {
  const matchById = new Map(matches.map(match => [match.dataset.id, match]));
  const root: AtlasHierarchyDatum = blank(`lens:${lens}`, ATLAS_LENS_LABEL[lens], 'lens', 0);
  root.children = [];
  for (const dataset of [...datasets].sort((a, b) => a.id.localeCompare(b.id))) {
    let parent = root;
    for (const [index, label] of atlasSegments(dataset, lens).entries()) {
      parent.children ??= [];
      let child = parent.children.find(node => node.kind === 'category' && node.label === label);
      if (!child) {
        child = blank(`${parent.id}/${slug(label)}`, label, 'category', index + 1);
        child.children = [];
        parent.children.push(child);
      }
      parent = child;
    }
    const match = matchById.get(dataset.id);
    parent.children ??= [];
    parent.children.push({
      ...blank(`dataset:${dataset.id}`, dataset.title, 'dataset', parent.depth + 1),
      dataset,
      total: 1,
      matching: searchMatches.has(dataset.id) ? 1 : 0,
      direct: match?.evidenceClass === 'direct' ? 1 : 0,
      supporting: match?.evidenceClass === 'supporting' ? 1 : 0,
      contextual: match?.evidenceClass === 'contextual' ? 1 : 0,
      aggregateRelevance: match?.relevance.score ?? 0,
    });
  }
  aggregate(root);
  sortTree(root);
  return root;
}

function blank(id: string, label: string, kind: AtlasHierarchyDatum['kind'], depth: number): AtlasHierarchyDatum {
  return { id, label, kind, depth, total: 0, matching: 0, direct: 0, supporting: 0, contextual: 0, aggregateRelevance: 0 };
}

function aggregate(node: AtlasHierarchyDatum): void {
  if (!node.children?.length) return;
  node.children.forEach(aggregate);
  for (const key of ['total', 'matching', 'direct', 'supporting', 'contextual', 'aggregateRelevance'] as const) node[key] = node.children.reduce((sum, child) => sum + child[key], 0);
}

function sortTree(node: AtlasHierarchyDatum): void {
  node.children?.sort((a, b) => b.total - a.total || a.label.localeCompare(b.label)).forEach(sortTree);
}

const slug = (value: string): string => value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
