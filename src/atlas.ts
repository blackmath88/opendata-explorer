import type { DatasetRecord } from './types';

export type AtlasLens = 'topic' | 'space' | 'time' | 'readiness';

export interface AtlasBucket {
  id: string;
  label: string;
  description: string;
  datasetIds: string[];
}

export interface AtlasAssignment {
  datasetId: string;
  topic: string;
  space: string;
  time: string;
  readiness: string;
}

export interface AtlasIndex {
  assignments: AtlasAssignment[];
  buckets: Record<AtlasLens, AtlasBucket[]>;
}

const topicRules: Array<{ id: string; label: string; description: string; terms: string[] }> = [
  {
    id: 'mobility',
    label: 'Mobility & Transport',
    description: 'Walking, cycling, roads, traffic, public transport and movement through the city.',
    terms: ['velo', 'fahrrad', 'radweg', 'verkehr', 'tram', 'bus', 'haltestelle', 'strasse', 'strassen', 'parkplatz', 'parking', 'fussgänger', 'fussgaenger', 'mobilität', 'mobilitaet', 'unfall'],
  },
  {
    id: 'environment',
    label: 'Environment & Climate',
    description: 'Nature, climate, air, water, heat, noise, emissions and environmental conditions.',
    terms: ['baum', 'grün', 'gruen', 'klima', 'temperatur', 'hitze', 'luft', 'ozon', 'feinstaub', 'wasser', 'rhein', 'lärm', 'laerm', 'solar', 'energie', 'biodivers'],
  },
  {
    id: 'built-city',
    label: 'Built City & Infrastructure',
    description: 'Buildings, construction, permits, utilities, land use and physical city systems.',
    terms: ['gebäude', 'gebaeude', 'bau', 'baustelle', 'allmend', 'bewilligung', 'liegenschaft', 'boden', 'infrastruktur', 'leitung', 'netz', 'adresse'],
  },
  {
    id: 'people',
    label: 'People & Society',
    description: 'Population, households, neighbourhoods, demographics and social conditions.',
    terms: ['bevölkerung', 'bevoelkerung', 'einwohner', 'haushalt', 'wohnbevölkerung', 'wohnbevoelkerung', 'quartier', 'wohnviertel', 'sozial', 'alter', 'migration'],
  },
  {
    id: 'public-space',
    label: 'Public Space & Leisure',
    description: 'Parks, fountains, sports, recreation and everyday public amenities.',
    terms: ['brunnen', 'park', 'spielplatz', 'sport', 'freizeit', 'grünfläche', 'gruenflaeche', 'sitzbank', 'schwimmbad', 'anlage'],
  },
  {
    id: 'health',
    label: 'Health & Wellbeing',
    description: 'Health services, exposure, safety and wellbeing-related datasets.',
    terms: ['gesundheit', 'spital', 'medizin', 'pflege', 'krank', 'apotheke', 'rettung', 'sicherheit', 'luftqualität', 'luftqualitaet'],
  },
  {
    id: 'education-culture',
    label: 'Education, Research & Culture',
    description: 'Schools, research, libraries, museums, culture and heritage.',
    terms: ['schule', 'schul', 'kindergarten', 'universität', 'universitaet', 'bildung', 'bibliothek', 'museum', 'kultur', 'denkmal', 'archiv'],
  },
  {
    id: 'government-economy',
    label: 'Government & Economy',
    description: 'Administration, finance, business, work, elections and public management.',
    terms: ['steuer', 'budget', 'finanz', 'verwaltung', 'regierung', 'wahl', 'abstimmung', 'wirtschaft', 'unternehmen', 'arbeit', 'arbeitslos', 'statistik'],
  },
];

function text(dataset: DatasetRecord): string {
  return [dataset.title, dataset.description, dataset.publisher, ...dataset.themes, ...dataset.keywords, ...dataset.semantic.topics]
    .join(' ')
    .toLowerCase();
}

function topic(dataset: DatasetRecord): string {
  const haystack = text(dataset);
  let best = { id: 'other', score: 0 };
  for (const rule of topicRules) {
    const score = rule.terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
    if (score > best.score) best = { id: rule.id, score };
  }
  return best.id;
}

function space(dataset: DatasetRecord): string {
  const types = dataset.characteristics.geometryTypes.map(type => type.toLowerCase());
  if (!dataset.characteristics.geospatial) return 'non-spatial';
  if (types.length > 1) return 'mixed';
  const type = types[0] ?? '';
  if (type.includes('point')) return 'point';
  if (type.includes('line')) return 'line';
  if (type.includes('polygon')) return 'polygon';
  if (dataset.formats.includes('geojson')) return 'geospatial-other';
  return 'spatial-asset';
}

function time(dataset: DatasetRecord): string {
  if (dataset.characteristics.realtime) return 'near-live';
  if (dataset.characteristics.timeSeries) return 'time-series';
  const frequency = (dataset.characteristics.updateFrequency ?? '').toLowerCase();
  if (/(hour|stünd|stuend|daily|täglich|taeglich|week|wöch|woech)/.test(frequency)) return 'frequent';
  if (dataset.characteristics.temporalCoverage.length > 0) return 'periodic-or-historical';
  if (dataset.modified) return 'current-state';
  return 'static-or-unknown';
}

function readiness(dataset: DatasetRecord): string {
  if (dataset.recordsCount === 0 || !dataset.hasRecords) return 'empty-or-external';
  if (dataset.characteristics.geometryTypes.length > 1) return 'mixed-geometry';
  if (dataset.recordsCount !== undefined && dataset.recordsCount <= 10) return 'sparse';
  if (dataset.characteristics.geospatial && dataset.characteristics.geometryTypes.length === 0) return 'needs-transformation';
  if (dataset.characteristics.geospatial) return 'ready-spatial';
  if (dataset.fieldCount && dataset.fieldCount > 0) return 'ready-tabular';
  return 'unknown';
}

const bucketMeta: Record<AtlasLens, Array<[string, string, string]>> = {
  topic: [
    ...topicRules.map(rule => [rule.id, rule.label, rule.description] as [string, string, string]),
    ['other', 'Other / review needed', 'Datasets that do not match the current deterministic civic taxonomy confidently.'],
  ],
  space: [
    ['point', 'Points', 'Locations, sensors and individual objects.'],
    ['line', 'Lines & networks', 'Routes, streets and other linear systems.'],
    ['polygon', 'Areas & zones', 'Boundaries, zones and area-based datasets.'],
    ['mixed', 'Mixed geometry', 'Datasets that publish more than one geometry family.'],
    ['geospatial-other', 'Other geospatial', 'Geospatial datasets without a single clear geometry family.'],
    ['spatial-asset', 'Spatial asset / transformation needed', 'Spatial resources that are not immediately usable as vector geometry.'],
    ['non-spatial', 'Non-spatial', 'Tabular or reference datasets without declared geometry.'],
  ],
  time: [
    ['near-live', 'Near-live', 'Datasets explicitly marked as realtime or near-live.'],
    ['frequent', 'Frequently updated', 'Datasets with a frequent declared update cadence.'],
    ['time-series', 'Time series', 'Datasets designed to capture observations over time.'],
    ['periodic-or-historical', 'Periodic / historical', 'Datasets with declared temporal coverage but not near-live behavior.'],
    ['current-state', 'Current state', 'Current catalogue datasets without a stronger temporal signal.'],
    ['static-or-unknown', 'Static / unknown', 'Reference datasets or datasets whose temporal behavior cannot be determined safely.'],
  ],
  readiness: [
    ['ready-spatial', 'Ready spatial layer', 'Queryable geospatial data with a declared geometry family.'],
    ['ready-tabular', 'Ready tabular data', 'Queryable structured data without a spatial dependency.'],
    ['needs-transformation', 'Needs transformation', 'Spatial intent is present but the geometry is not directly usable.'],
    ['mixed-geometry', 'Mixed geometry', 'Usable with caution because records contain multiple geometry families.'],
    ['sparse', 'Sparse / small', 'Very small datasets where coverage should be inspected before analytical use.'],
    ['empty-or-external', 'Empty / external asset', 'No queryable records or only externally linked assets.'],
    ['unknown', 'Unknown readiness', 'Insufficient metadata to classify safely.'],
  ],
};

export function buildAtlasIndex(datasets: DatasetRecord[]): AtlasIndex {
  const assignments = datasets.map(dataset => ({
    datasetId: dataset.id,
    topic: topic(dataset),
    space: space(dataset),
    time: time(dataset),
    readiness: readiness(dataset),
  }));

  const buckets = Object.fromEntries(
    (Object.keys(bucketMeta) as AtlasLens[]).map(lens => [
      lens,
      bucketMeta[lens].map(([id, label, description]) => ({
        id,
        label,
        description,
        datasetIds: assignments.filter(assignment => assignment[lens] === id).map(assignment => assignment.datasetId),
      })),
    ]),
  ) as Record<AtlasLens, AtlasBucket[]>;

  return { assignments, buckets };
}

export function catalogueSearch(datasets: DatasetRecord[], query: string): DatasetRecord[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return datasets;
  return datasets.filter(dataset =>
    dataset.id.toLowerCase().includes(needle) ||
    dataset.title.toLowerCase().includes(needle) ||
    dataset.description.toLowerCase().includes(needle) ||
    dataset.publisher.toLowerCase().includes(needle) ||
    dataset.keywords.some(keyword => keyword.toLowerCase().includes(needle)) ||
    dataset.themes.some(theme => theme.toLowerCase().includes(needle)),
  );
}

export function datasetsForBucket(index: AtlasIndex, datasets: DatasetRecord[], lens: AtlasLens, bucketId: string): DatasetRecord[] {
  const ids = new Set(index.buckets[lens].find(bucket => bucket.id === bucketId)?.datasetIds ?? []);
  return datasets.filter(dataset => ids.has(dataset.id));
}

export function recentlyModified(datasets: DatasetRecord[], limit = 6): DatasetRecord[] {
  return datasets
    .filter(dataset => dataset.modified)
    .slice()
    .sort((a, b) => Date.parse(b.modified!) - Date.parse(a.modified!))
    .slice(0, limit);
}
