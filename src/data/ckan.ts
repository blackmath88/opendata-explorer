/**
 * CKAN with DCAT-AP CH metadata, as served by opendata.swiss: the national catalogue every
 * canton can publish into, including cantons that run no portal of their own.
 *
 * What this source gives, compared with Opendatasoft:
 *  - metadata only: title, description, keywords and groups in up to four languages,
 *    publisher, licence, accrual periodicity (EU frequency URIs), temporal coverage and
 *    a list of distributions (resources) with formats;
 *  - no field schema, no record count, no record API. Structure stays at catalogue-metadata
 *    level, and the profile shows "unknown" where Opendatasoft would know.
 *
 * The package shape below follows the published DCAT-AP CH / CKAN API. It has NOT been
 * checked against the live API from this code (the build environment had no network), so
 * the portal entry that uses it must stay `verified: false` until it has.
 */
import { activePortal, datasetPageUrl, type Portal, type PortalLanguage } from '../portal';
import type { CatalogueAdapter, DatasetFormat, DatasetRecord, DatasetStructure } from '../types';
import { asNumber, asObject, asString, asStringArray, Json, normalizeFrequency, stripHtml } from './ods';
import type { CatalogLoadResult } from './ods-adapter';

/** CKAN caps `rows` at 1000. */
const PAGE_ROWS = 1000;
const MAX_PAGES = 20;

const LANGUAGES: readonly PortalLanguage[] = ['de', 'fr', 'it', 'en'];

/**
 * A multilingual CKAN value: `{ de, fr, it, en }`, a plain string, or (for some fields) that
 * object serialised as a JSON string. Returns the values in the portal's language order.
 */
export function localized(value: unknown, order: readonly PortalLanguage[] = LANGUAGES): string[] {
  let raw = value;
  if (typeof raw === 'string' && raw.trim().startsWith('{')) {
    try { raw = JSON.parse(raw); } catch { /* a string that only looks like JSON */ }
  }
  if (typeof raw === 'string') return raw ? [raw] : [];
  const object = asObject(raw);
  const languages = [...order, ...LANGUAGES.filter(language => !order.includes(language))];
  return [...new Set(languages.flatMap(language => {
    const entry = object[language];
    return typeof entry === 'string' ? [entry] : asStringArray(entry);
  }).filter(Boolean))];
}

/** Formats that mean the distribution carries geometry. */
const GEO_FORMATS = /^(geojson|shp|shapefile|esri shapefile|gpkg|geopackage|kml|kmz|gml|interlis|itf|xtf|wms|wmts|wfs|dxf|geotiff|tiff|gpx)$/i;
/** Formats that are services or files without rows DataFit can read. */
const SERVICE_FORMATS = /^(wms|wmts|wfs|api|service|html|pdf|zip|geotiff|tiff)$/i;

function formatOf(resource: Json): string {
  const format = asString(resource.format) || asString(resource.media_type).split('/').pop() || '';
  return format.trim().toLowerCase();
}

function datasetFormats(formats: string[]): DatasetFormat[] {
  const out = new Set<DatasetFormat>();
  for (const format of formats) {
    if (format === 'csv') out.add('csv');
    else if (format === 'json') out.add('json');
    else if (format === 'geojson') out.add('geojson');
    else if (format === 'parquet') out.add('parquet');
    else if (format === 'gpx') out.add('gpx');
    else out.add('other');
  }
  if (!out.size) out.add('other');
  return [...out];
}

/** `publisher` is an object, a JSON string, or (older records) a `publishers` list. */
function publisherOf(raw: Json, order: readonly PortalLanguage[]): string {
  const candidates: unknown[] = [raw.publisher, ...(Array.isArray(raw.publishers) ? raw.publishers : [])];
  for (const candidate of candidates) {
    let value = candidate;
    if (typeof value === 'string' && value.trim().startsWith('{')) {
      try { value = JSON.parse(value); } catch { /* plain name */ }
    }
    if (typeof value === 'string' && value) return value;
    const name = asObject(value).name ?? asObject(value).label;
    const text = localized(name, order)[0];
    if (text) return text;
  }
  return localized(asObject(raw.organization).title, order)[0] ?? asString(asObject(raw.organization).name);
}

/**
 * One CKAN package as the canonical record. Returns null without a usable identity.
 * `id` is the package `name` (the URL slug), which is unique within the catalogue.
 */
export function normalizeCkanPackage(value: unknown, portal: Portal = activePortal()): DatasetRecord | null {
  const raw = asObject(value);
  const id = asString(raw.name) || asString(raw.id);
  if (!id) return null;
  const order = portal.languages;

  const titles = localized(raw.title, order);
  const descriptions = localized(raw.description ?? raw.notes, order).map(stripHtml);
  const keywords = [...new Set([
    ...localized(raw.keywords, order),
    ...(Array.isArray(raw.tags) ? raw.tags.map(tag => asString(asObject(tag).name) || asString(asObject(tag).display_name)) : []),
  ].filter(Boolean))];
  const groups = Array.isArray(raw.groups) ? raw.groups.map(asObject) : [];
  const themes = [...new Set(groups.flatMap(group => [...localized(group.display_name ?? group.title, order), asString(group.name)]).filter(Boolean))];

  const resources = Array.isArray(raw.resources) ? raw.resources.map(asObject) : [];
  const formats = resources.map(formatOf).filter(Boolean);
  const geoFormats = formats.filter(format => GEO_FORMATS.test(format));
  const readable = formats.filter(format => !SERVICE_FORMATS.test(format));

  const firstResource = resources[0] ?? {};
  const license = asString(raw.license_title) || asString(firstResource.rights) || asString(firstResource.license) || asString(raw.license_id);
  const temporals = Array.isArray(raw.temporals) ? raw.temporals.map(asObject) : [];
  const temporalCoverage = temporals.length
    ? [asString(temporals[0].start_date), asString(temporals[temporals.length - 1].end_date)].filter(Boolean)
    : [];
  const frequency = normalizeFrequency(raw.accrual_periodicity);
  const publisher = publisherOf(raw, order);
  const description = descriptions[0] ?? '';

  const searchText = [...titles, ...descriptions, publisher, ...themes, ...keywords].join(' ').toLowerCase();

  return {
    id,
    title: titles[0] ?? id,
    description,
    publisher,
    themes,
    keywords,
    license,
    licenseUrl: undefined,
    modified: asString(raw.modified) || asString(raw.metadata_modified) || undefined,
    // DCAT has no record count; unknown stays unknown.
    recordsCount: asNumber(raw.num_records),
    sourceUrl: datasetPageUrl(portal, id),
    apiUrl: undefined,
    formats: datasetFormats(formats),
    characteristics: {
      // Inferred from published formats: a CSV with coordinate columns reads as non-spatial here,
      // because DCAT does not describe columns.
      geospatial: geoFormats.length > 0,
      timeSeries: temporalCoverage.length > 0,
      realtime: /^(cont|update cont|hourly|\d+ ?min|1hour)$/.test(frequency ?? ''),
      geometryType: undefined,
      geometryTypes: [],
      temporalCoverage,
      bbox: undefined,
      updateFrequency: frequency,
      territory: localized(raw.spatial, order),
    },
    semantic: { summary: description.slice(0, 280), topics: [], possibleUses: [], possibleJoins: [] },
    searchText,
    // "Has records" here means a downloadable data file exists, not a queryable API.
    hasRecords: readable.length > 0,
    fieldCount: undefined,
  };
}

interface CkanResponse<T> { success?: boolean; result?: T; error?: { message?: string } }
interface CkanSearch { count?: number; results?: unknown[] }

export async function ckanFetch<T>(portal: Portal, action: string, params: Record<string, string | number>, timeoutMs = 30000): Promise<T> {
  if (portal.api.kind !== 'ckan') throw new Error(`${portal.label} is not a CKAN portal`);
  const url = new URL(`${portal.api.base}/api/3/action/${action}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
    const text = await response.text();
    let body: CkanResponse<T>;
    try {
      body = JSON.parse(text) as CkanResponse<T>;
    } catch {
      // Proxies and error pages answer in HTML or plain text; say what came back.
      throw new Error(`${action} returned HTTP ${response.status}, not JSON: ${text.slice(0, 80).trim()}`);
    }
    if (!response.ok || body.success === false || body.result === undefined) {
      throw new Error(`${action} returned HTTP ${response.status}${body.error?.message ? ` — ${body.error.message}` : ''}`);
    }
    return body.result;
  } finally {
    clearTimeout(timer);
  }
}

/** One organization's packages on a CKAN catalogue (opendata.swiss: one canton). */
export class CkanDcatAdapter implements CatalogueAdapter {
  readonly id: string;
  readonly label: string;
  private records = new Map<string, DatasetRecord>();
  private raw = new Map<string, unknown>();

  /** Raw packages as the API returned them, for snapshots. */
  rawEntries(): unknown[] {
    return [...this.raw.values()];
  }

  constructor(readonly portal: Portal = activePortal()) {
    if (portal.api.kind !== 'ckan') throw new Error(`${portal.label} is not a CKAN portal`);
    this.id = `${portal.id}-ckan`;
    this.label = portal.label;
  }

  async loadCatalog(): Promise<CatalogLoadResult> {
    const api = this.portal.api as Extract<Portal['api'], { kind: 'ckan' }>;
    const datasets: DatasetRecord[] = [];
    const notes: string[] = ['Catalogue metadata only: this source publishes no field schemas or record counts.'];
    let reportedTotal: number | undefined;
    let skipped = 0;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const result = await ckanFetch<CkanSearch>(this.portal, 'package_search', {
        fq: `organization:(${api.organizations.join(' OR ')})`,
        rows: PAGE_ROWS,
        start: page * PAGE_ROWS,
        sort: 'name asc',
      });
      const results = Array.isArray(result.results) ? result.results : [];
      if (typeof result.count === 'number') reportedTotal = result.count;
      for (const entry of results) {
        const record = normalizeCkanPackage(entry, this.portal);
        if (!record) { skipped += 1; continue; }
        if (this.records.has(record.id)) continue;
        this.records.set(record.id, record);
        this.raw.set(record.id, entry);
        datasets.push(record);
      }
      if (results.length < PAGE_ROWS || (reportedTotal !== undefined && datasets.length + skipped >= reportedTotal)) break;
    }
    if (!datasets.length) throw new Error(`${this.portal.shortLabel} returned no usable datasets`);
    if (skipped) notes.push(`${skipped} packages had no name and were skipped.`);
    return { datasets, reportedTotal, notes };
  }

  async listDatasets(): Promise<DatasetRecord[]> {
    return (await this.loadCatalog()).datasets;
  }

  async getDataset(id: string): Promise<DatasetRecord> {
    const cached = this.records.get(id);
    if (cached) return cached;
    const record = normalizeCkanPackage(await ckanFetch<unknown>(this.portal, 'package_show', { id }), this.portal);
    if (!record) throw new Error(`Dataset ${id} could not be normalized`);
    this.records.set(id, record);
    return record;
  }

  /** Metadata is all there is: no fields, no keys, no counts. Said, not faked. */
  async inspectDataset(id: string): Promise<DatasetStructure> {
    const record = await this.getDataset(id);
    return {
      datasetId: id,
      fields: [],
      temporal: record.characteristics.temporalCoverage.length
        ? { fields: [], start: record.characteristics.temporalCoverage[0], end: record.characteristics.temporalCoverage[1], observedFrom: 'catalog_metadata' }
        : undefined,
      candidateKeys: [],
      keyProfiles: [],
      observedFrom: 'catalog_metadata',
      notes: [`${this.portal.shortLabel} publishes DCAT metadata only; open the distribution files for columns and records.`],
    };
  }
}
