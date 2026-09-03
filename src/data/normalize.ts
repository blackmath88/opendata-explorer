import type { DatasetFormat, DatasetRecord } from '../types';
import {
  asNumber,
  asObject,
  asString,
  asStringArray,
  bboxFromFeature,
  collectLocalized,
  Json,
  normalizeFrequency,
  ODS_BASE,
  stripHtml,
} from './ods';

/**
 * Opendatasoft `features` flags that tell us something structural.
 * `geo` is the source's own statement that the dataset is mappable.
 */
const GEO_FEATURE = 'geo';
const TIMESERIE_FEATURE = 'timeserie';

const GEO_FIELD_TYPES = new Set(['geo_shape', 'geo_point_2d']);
const TIME_FIELD_TYPES = new Set(['date', 'datetime']);

/**
 * Formats are not enumerated by the Explore API. Every dataset with records is
 * exportable as JSON/CSV, and geo datasets additionally as GeoJSON. Anything
 * beyond that is only claimed when the source mentions it.
 */
function inferFormats(raw: Json, geospatial: boolean, hasRecords: boolean): DatasetFormat[] {
  const formats = new Set<DatasetFormat>();
  if (hasRecords) {
    formats.add('json');
    formats.add('csv');
    formats.add('parquet');
  }
  // A dataset with no records exports nothing, whatever geometry it declares.
  if (geospatial && hasRecords) formats.add('geojson');
  const exports = asStringArray(raw.alternative_exports).join(' ').toLowerCase();
  if (exports.includes('gpx')) formats.add('gpx');
  if (!formats.size) formats.add('other');
  return [...formats];
}

const TOPIC_HINTS: ReadonlyArray<readonly [string, RegExp]> = [
  ['environment', /baum|tree|green|grün|gruen|nature|natur|biodiv|wald|park|umwelt/],
  ['mobility', /verkehr|traffic|velo|bike|fuss|pedestrian|parking|parkplatz|strasse|street|tram|bus|mobilit/],
  ['climate', /klima|climate|temperatur|temperature|luft|air|noise|lärm|laerm|weather|wetter|hitze|emission/],
  ['water', /wasser|water|rhein|rhine|brunnen|fountain|gewässer|grundwasser/],
  ['infrastructure', /^bau|baustelle|construction|infrastruktur|infrastructure|lighting|beleuchtung|gebäude|building|anlage/],
  ['population', /bevölkerung|bevoelkerung|population|demograph|wohnbevölkerung|haushalt/],
  ['energy', /energie|energy|solar|strom|photovoltaik|wärmepumpe/],
  ['health', /gesundheit|health|spital|corona|covid|krank/],
  ['safety', /unfall|accident|sicherheit|safety|polizei|kriminal|straftat/],
  ['education', /schule|school|bildung|education|kindergarten|universit/],
  ['economy', /wirtschaft|economy|arbeit|beschäftig|steuer|betrieb|handel/],
];

/**
 * Convert one Opendatasoft catalogue entry into the canonical record.
 * Returns null only when the entry has no usable identity.
 *
 * Every optional metadata block is treated as absent-by-default: Basel supplies
 * `publisher`, `license`, `theme` and `description` on all 361 datasets today,
 * but the normalizer must not depend on that.
 */
export function normalizeOdsDataset(value: unknown): DatasetRecord | null {
  const raw = asObject(value);
  const metas = asObject(raw.metas);
  const defaults = asObject(metas.default);
  const dcat = asObject(metas.dcat);
  const fields = Array.isArray(raw.fields) ? raw.fields.map(asObject) : [];
  const features = asStringArray(raw.features);

  const id = asString(raw.dataset_id) || asString(raw.datasetid) || asString(raw.id);
  if (!id) return null;

  const titles = collectLocalized(defaults, 'title');
  const title = asString(defaults.title) || titles[0] || asString(raw.title) || id;

  const descriptionsRaw = collectLocalized(defaults, 'description');
  const description = stripHtml(asString(defaults.description) || descriptionsRaw[0] || '');

  const publisher = asString(defaults.publisher) || asString(asObject(metas.custom)['publizierende-organisation']);
  const themes = collectLocalized(defaults, 'theme');
  const keywords = collectLocalized(defaults, 'keyword');
  const license = asString(defaults.license);
  const licenseUrl = asString(defaults.license_url) || undefined;
  const modified = asString(defaults.modified) || asString(defaults.data_processed) || undefined;
  const recordsCount = asNumber(defaults.records_count);
  const hasRecords = raw.has_records !== false;

  // Geometry: prefer the source's own declaration, fall back to the schema.
  const declaredGeometry = asStringArray(defaults.geometry_types);
  const geoFields = fields.filter(f => GEO_FIELD_TYPES.has(asString(f.type)));
  const geospatial = declaredGeometry.length > 0 || features.includes(GEO_FEATURE) || geoFields.length > 0;

  const timeFields = fields.filter(f => TIME_FIELD_TYPES.has(asString(f.type)));
  const timeSeries = features.includes(TIMESERIE_FEATURE) || timeFields.length > 0;

  const frequency = normalizeFrequency(dcat.accrualperiodicity);
  // "Realtime" is a claim we make from cadence and time grain, not from
  // marketing words in the title. Basel's `accrualperiodicity` vocabulary uses
  // CONT / UPDATE_CONT / HOURLY / 10MIN / 1MIN for continuously fed datasets.
  const grains = fields.map(f => asString(asObject(f.annotations).timeserie_precision));
  const liveCadence = /^(cont|update cont|hourly|\d+min)$/.test(frequency ?? '');
  const realtime = timeSeries && (liveCadence || grains.includes('minute') || grains.includes('hour'));

  const coverageStart = asString(dcat.temporal_coverage_start);
  const coverageEnd = asString(dcat.temporal_coverage_end);
  const temporalCoverage = [coverageStart, coverageEnd].filter(Boolean);

  const searchText = [
    ...titles,
    ...descriptionsRaw.map(stripHtml),
    publisher,
    ...themes,
    ...keywords,
    ...fields.map(f => `${asString(f.name)} ${asString(f.label)}`),
  ]
    .join(' ')
    .toLowerCase();

  const inferredTopics = TOPIC_HINTS.filter(([, pattern]) => pattern.test(searchText)).map(([topic]) => topic);

  return {
    id,
    title,
    description,
    publisher,
    themes: [...new Set(themes)],
    keywords: [...new Set(keywords)],
    license,
    licenseUrl,
    modified,
    recordsCount,
    sourceUrl: `https://data.bs.ch/explore/dataset/${encodeURIComponent(id)}/information/`,
    apiUrl: hasRecords ? `${ODS_BASE}/catalog/datasets/${encodeURIComponent(id)}/records` : undefined,
    formats: inferFormats(raw, geospatial, hasRecords),
    characteristics: {
      geospatial,
      timeSeries,
      realtime,
      geometryType: declaredGeometry[0],
      geometryTypes: declaredGeometry,
      temporalCoverage,
      bbox: bboxFromFeature(defaults.bbox),
      updateFrequency: frequency,
      territory: asStringArray(defaults.territory),
    },
    semantic: {
      summary: description.slice(0, 280),
      topics: inferredTopics,
      possibleUses: [],
      possibleJoins: [],
    },
    searchText,
    hasRecords,
    fieldCount: fields.length || undefined,
  };
}
