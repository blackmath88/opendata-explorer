import type { DatasetFormat, DatasetRecord } from '../types';

type Json = Record<string, unknown>;

const asObject = (value: unknown): Json => (value && typeof value === 'object' ? value as Json : {});
const asString = (value: unknown): string => typeof value === 'string' ? value : '';
const asStringArray = (value: unknown): string[] => Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

function inferFormats(raw: Json, geospatial: boolean): DatasetFormat[] {
  const text = JSON.stringify(raw).toLowerCase();
  const formats = new Set<DatasetFormat>(['json', 'csv']);
  if (geospatial || text.includes('geojson')) formats.add('geojson');
  if (text.includes('gpx')) formats.add('gpx');
  if (text.includes('parquet')) formats.add('parquet');
  return [...formats];
}

export function normalizeOdsDataset(value: unknown): DatasetRecord | null {
  const raw = asObject(value);
  const metas = asObject(raw.metas);
  const defaults = asObject(metas.default);
  const fields = Array.isArray(raw.fields) ? raw.fields.map(asObject) : [];

  const id = asString(raw.dataset_id) || asString(raw.datasetid) || asString(raw.id);
  if (!id) return null;

  const title = asString(defaults.title) || asString(raw.title) || id;
  const description = asString(defaults.description) || asString(raw.description);
  const publisher = asString(defaults.publisher) || asString(raw.publisher);
  const themes = asStringArray(defaults.theme).concat(asStringArray(raw.theme));
  const keywords = asStringArray(defaults.keyword).concat(asStringArray(raw.keyword));
  const license = asString(defaults.license) || asString(raw.license);
  const modified = asString(defaults.modified) || asString(raw.modified);

  const fieldTypes = fields.map(f => `${asString(f.type)} ${asString(f.name)} ${asString(f.label)}`.toLowerCase());
  const geospatial = fieldTypes.some(v => /geo|point|shape|polygon|coordinates/.test(v)) || /geo|spatial|karte|map/i.test(description);
  const timeSeries = fieldTypes.some(v => /date|datetime|timestamp|zeit|year|jahr/.test(v));
  const realtime = /real.?time|live|aktuell|hourly|minute|sensor/i.test(`${title} ${description}`);

  const sourceUrl = `https://data.bs.ch/explore/dataset/${encodeURIComponent(id)}/information/`;
  const text = `${title} ${description} ${themes.join(' ')} ${keywords.join(' ')}`.toLowerCase();
  const topicHints = [
    ['environment', /baum|tree|green|grün|nature|natur|biodiv/],
    ['mobility', /verkehr|traffic|velo|bike|fuss|pedestrian|parking|strasse|street/],
    ['climate', /klima|climate|temperatur|temperature|luft|air|noise|lärm|weather|wetter/],
    ['water', /wasser|water|rhein|rhine|brunnen|fountain/],
    ['infrastructure', /bau|construction|infrastruktur|infrastructure|lighting|beleuchtung/],
    ['population', /bevölkerung|population|demograph/],
    ['energy', /energie|energy|solar|strom/],
  ] as const;
  const inferredTopics = topicHints.filter(([, pattern]) => pattern.test(text)).map(([topic]) => topic);

  return {
    id,
    title,
    description,
    publisher,
    themes: [...new Set(themes)],
    keywords: [...new Set(keywords)],
    license,
    modified,
    sourceUrl,
    formats: inferFormats(raw, geospatial),
    characteristics: { geospatial, timeSeries, realtime, temporalCoverage: [] },
    semantic: {
      summary: description.slice(0, 280),
      topics: inferredTopics,
      possibleUses: [],
      possibleJoins: [],
    },
  };
}
