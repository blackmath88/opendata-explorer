import type { DatasetMatch, DatasetRecord, EvidenceClass } from './types';

export type AtlasLens = 'topic' | 'space' | 'time' | 'readiness';

export interface AtlasPath {
  category: string;
  subcategory: string;
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
  category?: string;
  subcategory?: string;
}

export const ATLAS_LENS_LABEL: Record<AtlasLens, string> = {
  topic: 'Topic',
  space: 'Space',
  time: 'Time',
  readiness: 'Readiness',
};

type Rule = readonly [string, RegExp];

const TOPIC_RULES: ReadonlyArray<readonly [string, ReadonlyArray<Rule>]> = [
  ['Environment & Climate', [
    ['Urban nature', /baum|tree|grün|gruen|green|natur|biodiv|wald|forest|park|vegetation|flora|fauna/],
    ['Air & emissions', /luft|air quality|emission|co2|stickstoff|feinstaub|ozon/],
    ['Climate / heat', /klima|climate|temperatur|temperature|hitze|heat|wetter|weather/],
    ['Water', /wasser|water|rhein|rhine|brunnen|fountain|gewässer|gewaesser|grundwasser/],
    ['Noise', /lärm|laerm|noise|schall/],
    ['Energy', /energie|energy|solar|strom|photovoltaik|wärme|waerme/],
    ['Environment (other)', /umwelt|environment|nachhalt|sustainab/],
  ]],
  ['Mobility & Transport', [
    ['Cycling', /velo|bike|bicycle|radweg|cycling/],
    ['Public transport', /tram|bus|haltestelle|öV|oev|public transport|bvb/],
    ['Walking', /fuss|fuß|pedestrian|walking|trottoir/],
    ['Road traffic', /verkehr|traffic|strasse|straße|street|fahrzeug|vehicle/],
    ['Parking', /parking|parkplatz|parkhaus/],
    ['Mobility (other)', /mobilit|transport/],
  ]],
  ['People & Society', [
    ['Population', /bevölkerung|bevoelkerung|population|demograph|einwohner|wohnbevölkerung/],
    ['Social services', /sozial|social|familie|family|jugend|youth|alter|senior|integration/],
    ['Housing', /wohnung|wohnen|housing|haushalt/],
  ]],
  ['Built City & Infrastructure', [
    ['Buildings', /gebäude|gebaeude|building|bauinventar|adresse|address/],
    ['Construction', /baustelle|construction|bauprojekt|bewilligung/],
    ['Utilities & networks', /infrastruktur|infrastructure|leitung|kanal|beleuchtung|lighting|netz/],
    ['Planning & parcels', /planung|planning|parzell|kataster|zoning|nutzungsplan/],
  ]],
  ['Public Space & Leisure', [
    ['Sports', /sport|schwimm|swim|running|fitness|spielplatz/],
    ['Parks & public space', /freizeit|leisure|public space|allmend|platz|park/],
    ['Tourism', /touris|hotel|visitor/],
  ]],
  ['Health', [['Health services', /gesundheit|health|spital|hospital|arzt|doctor|pflege/], ['Public health', /corona|covid|krank|disease|epidem/]]],
  ['Education', [['Schools', /schule|school|kindergarten/], ['Higher education', /universit|hochschule|college/], ['Education (other)', /bildung|education|lern/]]],
  ['Culture', [['Museums & heritage', /museum|denkmal|heritage|archä|archae/], ['Events & venues', /kultur|culture|theater|musik|bibliothek|library|veranstaltung|event/]]],
  ['Government & Economy', [
    ['Administration', /verwaltung|government|behörde|behoerde|abstimmung|wahl|election|politik/],
    ['Economy & labour', /wirtschaft|economy|arbeit|beschäftig|beschaeftig|betrieb|handel|business/],
    ['Finance & statistics', /steuer|tax|finanz|budget|statistik|statistic/],
    ['Safety & justice', /polizei|kriminal|straftat|unfall|accident|feuerwehr|sicherheit|safety/],
  ]],
];

function text(dataset: DatasetRecord): string {
  return `${dataset.title} ${dataset.description} ${dataset.themes.join(' ')} ${dataset.keywords.join(' ')} ${dataset.semantic.topics.join(' ')}`.toLocaleLowerCase();
}

function topicPath(dataset: DatasetRecord): AtlasPath {
  const haystack = text(dataset);
  for (const [category, subcategories] of TOPIC_RULES) {
    for (const [subcategory, pattern] of subcategories) if (pattern.test(haystack)) return { category, subcategory };
  }
  return { category: 'Other / review needed', subcategory: 'Unclassified' };
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

function timePath(dataset: DatasetRecord): AtlasPath {
  const frequency = dataset.characteristics.updateFrequency?.toLocaleLowerCase() ?? '';
  if (dataset.characteristics.realtime || /cont|hour|minute|daily/.test(frequency)) return { category: 'Near-live / frequent', subcategory: frequency || 'Frequent feed' };
  if (dataset.characteristics.timeSeries) return { category: 'Time series', subcategory: frequency || 'Cadence not declared' };
  if (/week|month|quarter|annual|year|period/.test(frequency)) return { category: 'Periodic snapshot', subcategory: frequency };
  if (/histor|archive/.test(text(dataset))) return { category: 'Historical', subcategory: frequency || 'Historical collection' };
  if (dataset.characteristics.temporalCoverage.length) return { category: 'Current/reference', subcategory: 'Declared temporal coverage' };
  if (frequency) return { category: 'Current/reference', subcategory: frequency };
  return { category: 'Unknown', subcategory: 'Temporal status not declared' };
}

function readinessPath(dataset: DatasetRecord): AtlasPath {
  const types = normalizedGeometry(dataset);
  if (!dataset.hasRecords) return { category: 'Empty / external', subcategory: dataset.formats.includes('other') ? 'External asset' : 'No queryable records' };
  if (dataset.recordsCount !== undefined && dataset.recordsCount < 10) return { category: 'Sparse', subcategory: `${dataset.recordsCount} records` };
  if (types.length > 1) return { category: 'Mixed geometry', subcategory: types.join(' + ') };
  if (dataset.characteristics.geospatial && types.length) return { category: 'Ready spatial', subcategory: types[0] };
  if (!dataset.characteristics.geospatial && dataset.fieldCount) return { category: 'Ready tabular', subcategory: `${dataset.fieldCount} fields` };
  if (dataset.characteristics.geospatial) return { category: 'Needs transformation', subcategory: 'Geometry not declared' };
  return { category: 'Unknown', subcategory: 'Structure not available' };
}

export function atlasPath(dataset: DatasetRecord, lens: AtlasLens): AtlasPath {
  if (lens === 'topic') return topicPath(dataset);
  if (lens === 'space') return spacePath(dataset);
  if (lens === 'time') return timePath(dataset);
  return readinessPath(dataset);
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
    const path = atlasPath(dataset, state.lens);
    if (state.category && path.category !== state.category) continue;
    const label = state.category ? path.subcategory : path.category;
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
  if (!state.category || !state.subcategory) return [];
  return datasets.filter(dataset => {
    const path = atlasPath(dataset, state.lens);
    return path.category === state.category && path.subcategory === state.subcategory;
  });
}
