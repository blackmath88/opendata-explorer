import type {
  CatalogueAdapter,
  DatasetRecord,
  DatasetStructure,
  InspectOptions,
  KeyOverlapEvidence,
  KeyRef,
} from '../types';
import { asObject, asString, asNumber, Json, ODS_MAX_LIMIT, odsFetch } from './ods';
import { normalizeOdsDataset } from './normalize';
import { applyRecordSample, structureFromCatalogEntry } from './ods-structure';

interface OdsCatalogResponse {
  total_count?: number;
  results?: unknown[];
}

interface OdsRecordsResponse {
  total_count?: number;
  results?: Json[];
}

/** Hard ceiling so a catalogue that grows unexpectedly cannot hang the app. */
const MAX_PAGES = 20;

/** Rows read when upgrading a structure to sample evidence. */
const SAMPLE_ROWS = 5;

/** Distinct key values read per side when validating a candidate join. */
const KEY_SAMPLE_LIMIT = ODS_MAX_LIMIT;

export interface CatalogLoadResult {
  datasets: DatasetRecord[];
  reportedTotal?: number;
  notes: string[];
}

/**
 * Basel-Stadt Open Government Data, served through the Opendatasoft Explore
 * API v2.1.
 *
 * The adapter caches raw catalogue entries because that response already
 * carries the full field schema — dataset structure inspection therefore needs
 * no extra network round-trip unless record sampling is explicitly requested.
 */
export class BaselOpendatasoftAdapter implements CatalogueAdapter {
  readonly id = 'basel-ods';
  readonly label = 'Basel-Stadt Open Government Data';

  private rawById = new Map<string, unknown>();
  private structureCache = new Map<string, DatasetStructure>();

  async listDatasets(): Promise<DatasetRecord[]> {
    return (await this.loadCatalog()).datasets;
  }

  /**
   * Page the whole catalogue.
   *
   * `order_by` is not optional: without it the Explore API returned overlapping
   * pages (one dataset twice, another missing) across a 4-page walk. The
   * de-duplication below is a second belt-and-braces guard.
   */
  async loadCatalog(): Promise<CatalogLoadResult> {
    const datasets: DatasetRecord[] = [];
    const seen = new Set<string>();
    const notes: string[] = [];
    let reportedTotal: number | undefined;
    let offset = 0;
    let skipped = 0;

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const body = await odsFetch<OdsCatalogResponse>('/catalog/datasets', {
        limit: ODS_MAX_LIMIT,
        offset,
        order_by: 'dataset_id',
      });

      const results = Array.isArray(body.results) ? body.results : [];
      if (typeof body.total_count === 'number') reportedTotal = body.total_count;

      for (const entry of results) {
        const record = normalizeOdsDataset(entry);
        if (!record) {
          skipped += 1;
          continue;
        }
        if (seen.has(record.id)) continue;
        seen.add(record.id);
        this.rawById.set(record.id, entry);
        datasets.push(record);
      }

      offset += results.length;
      if (results.length < ODS_MAX_LIMIT) break;
      if (reportedTotal !== undefined && offset >= reportedTotal) break;
    }

    if (!datasets.length) throw new Error('Basel OGD catalogue returned no usable datasets');
    if (skipped) notes.push(`${skipped} catalogue entries had no dataset id and were skipped.`);
    if (reportedTotal !== undefined && datasets.length !== reportedTotal) {
      notes.push(
        `The catalogue reports ${reportedTotal} datasets; ${datasets.length} distinct records were loaded.`,
      );
    }
    return { datasets, reportedTotal, notes };
  }

  async getDataset(id: string): Promise<DatasetRecord> {
    const entry = await this.rawEntry(id);
    const record = normalizeOdsDataset(entry);
    if (!record) throw new Error(`Dataset ${id} could not be normalized`);
    return record;
  }

  /**
   * Structure for one dataset.
   *
   * Without `options.sample` this is free once the catalogue is loaded, and
   * reaches `schema` evidence. With sampling it spends at most two requests:
   * one bounded record page and one server-side min/max aggregate.
   */
  async inspectDataset(id: string, options: InspectOptions = {}): Promise<DatasetStructure> {
    const cacheKey = `${id}:${options.sample ? 'sample' : 'schema'}`;
    const cached = this.structureCache.get(cacheKey);
    if (cached) return cached;

    const entry = await this.rawEntry(id);
    let structure = structureFromCatalogEntry(entry);

    if (options.sample && structure.recordCount !== 0) {
      structure = await this.sampleStructure(id, structure);
    }

    this.structureCache.set(cacheKey, structure);
    return structure;
  }

  private async sampleStructure(id: string, structure: DatasetStructure): Promise<DatasetStructure> {
    const path = `/catalog/datasets/${encodeURIComponent(id)}/records`;
    try {
      const page = await odsFetch<OdsRecordsResponse>(path, { limit: SAMPLE_ROWS });
      const records = Array.isArray(page.results) ? page.results.map(asObject) : [];

      let aggregate: { start?: string; end?: string; count?: number; field?: string } | undefined = {
        count: asNumber(page.total_count),
      };

      const timeField = structure.temporal?.fields[0];
      if (timeField) {
        try {
          const agg = await odsFetch<OdsRecordsResponse>(path, {
            select: `min(${timeField}) as coverage_start, max(${timeField}) as coverage_end`,
            limit: 1,
          });
          const row = asObject(agg.results?.[0]);
          aggregate = {
            ...aggregate,
            start: asString(row.coverage_start) || undefined,
            end: asString(row.coverage_end) || undefined,
            field: timeField,
          };
        } catch (error) {
          structure.notes.push(
            `Temporal aggregate over "${timeField}" failed (${message(error)}); coverage remains a metadata claim.`,
          );
        }
      }

      return applyRecordSample(structure, records, aggregate);
    } catch (error) {
      return {
        ...structure,
        notes: [...structure.notes, `Record sampling failed (${message(error)}); structure stays at schema level.`],
      };
    }
  }

  /**
   * Value-level check for a candidate join key.
   *
   * Distinct values are read from the left side with `group_by` (no record
   * download), then tested against the *whole* right dataset with a
   * `where field in (...)` filter. That asymmetry matters: a zero result is
   * then a real absence for the values compared, rather than an artefact of two
   * independently truncated samples.
   */
  async sampleKeyOverlap(left: KeyRef, right: KeyRef): Promise<KeyOverlapEvidence | null> {
    try {
      const leftValues = await this.distinctValues(left.datasetId, left.field);
      if (!leftValues.length) return null;

      const filter = `${right.field} in (${leftValues.map(value => literal(value, right.type)).join(', ')})`;
      const matched = await this.distinctValues(right.datasetId, right.field, filter);
      const rightTotal = await this.distinctValues(right.datasetId, right.field);

      return {
        leftField: left.field,
        rightField: right.field,
        leftDistinct: leftValues.length,
        rightDistinct: rightTotal.length,
        overlap: matched.length,
        bounded: leftValues.length >= KEY_SAMPLE_LIMIT,
      };
    } catch {
      // A failed probe is not evidence of anything; say nothing rather than
      // letting the engine read silence as a negative result.
      return null;
    }
  }

  private async distinctValues(id: string, field: string, where?: string): Promise<string[]> {
    const body = await odsFetch<OdsRecordsResponse>(`/catalog/datasets/${encodeURIComponent(id)}/records`, {
      select: field,
      group_by: field,
      limit: KEY_SAMPLE_LIMIT,
      ...(where ? { where } : {}),
    });
    const rows = Array.isArray(body.results) ? body.results.map(asObject) : [];
    return rows
      .map(row => row[field])
      .filter(value => value !== null && value !== undefined && value !== '')
      // Keys cross type boundaries constantly in open data (text "354" vs int
      // 354), so compare on the string form.
      .map(value => String(value));
  }

  private async rawEntry(id: string): Promise<unknown> {
    const cached = this.rawById.get(id);
    if (cached) return cached;
    const entry = await odsFetch<unknown>(`/catalog/datasets/${encodeURIComponent(id)}`);
    this.rawById.set(id, entry);
    return entry;
  }
}

const message = (error: unknown): string => (error instanceof Error ? error.message : 'unknown error');

/**
 * ODSQL literal. Numeric fields reject quoted values outright
 * (`IncompatibleTypesInComparisonFilter`), so the field type decides the form.
 */
function literal(value: string, type?: string): string {
  if ((type === 'int' || type === 'double') && /^-?\d+(\.\d+)?$/.test(value)) return value;
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
