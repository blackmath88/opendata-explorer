/**
 * Catalogue profile (the "fingerprint" of docs/KNOWLEDGE_DISCOVERY.md; not to be confused with fingerprint.ts, which hashes dataset structure): what a set of datasets *looks like*, before anyone opens one.
 *
 * Every dataset lands in exactly one shape bucket and exactly one cadence bucket, so
 * each row of a fingerprint sums to the set's total (the count-conservation rule in
 * docs/KNOWLEDGE_DISCOVERY.md). Buckets describe catalogue metadata, not observed
 * content: "point" means the publisher declares point geometry, not that it covers Basel.
 */
import { atlasPath } from './atlas';
import type { DatasetRecord } from './types';

export type Shape = 'point' | 'line' | 'area' | 'mixed' | 'raster' | 'table' | 'unknown';
export type Cadence = 'frequent' | 'periodic' | 'irregular' | 'none' | 'unknown';

export const SHAPES: readonly Shape[] = ['point', 'line', 'area', 'mixed', 'raster', 'table', 'unknown'];
export const CADENCES: readonly Cadence[] = ['frequent', 'periodic', 'irregular', 'none', 'unknown'];

export const SHAPE_LABEL: Record<Shape, string> = {
  point: 'points', line: 'lines', area: 'areas', mixed: 'mixed geometry', raster: 'raster / external', table: 'tables', unknown: 'geometry unknown',
};
export const CADENCE_LABEL: Record<Cadence, string> = {
  frequent: 'frequent', periodic: 'periodic', irregular: 'irregular', none: 'no updates', unknown: 'unknown',
};

const SPACE_TO_SHAPE: Record<string, Shape> = {
  Point: 'point', Line: 'line', Polygon: 'area', Mixed: 'mixed', 'Raster / external asset': 'raster', 'Non-spatial': 'table',
};

export function shapeOf(dataset: DatasetRecord): Shape {
  return SPACE_TO_SHAPE[atlasPath(dataset, 'space').category] ?? 'unknown';
}

/**
 * From the *declared* update frequency only. The source's `realtime` flag is not used:
 * in the Basel snapshot it is set on monthly and irregular datasets too, so it describes
 * something else (live sensors, observation granularity) than how often a dataset changes.
 */
export function cadenceOf(dataset: DatasetRecord): Cadence {
  const f = dataset.characteristics.updateFrequency?.toLocaleLowerCase().trim() ?? '';
  if (!f || f === 'unknown') return 'unknown';
  // EU frequency vocabulary (DCAT-AP, opendata.swiss) plus Basel's own codes.
  if (/^(cont|continuous|update cont|hourly|minute|daily|realtime|\d+ ?(min|hour))/.test(f)) return 'frequent';
  if (/never|no updates/.test(f)) return 'none';
  if (/irreg|as needed|update/.test(f)) return 'irregular';
  if (/week|month|quarter|annual|year|biennial|triennial|period|decennial|quinquennial/.test(f)) return 'periodic';
  return 'unknown';
}

export interface CatalogueProfile {
  total: number;
  shape: Record<Shape, number>;
  cadence: Record<Cadence, number>;
  /** Median declared record count among datasets that declare one. */
  recordsMedian: number | null;
  recordsUnknown: number;
}

export function profile(datasets: readonly DatasetRecord[]): CatalogueProfile {
  const shape = Object.fromEntries(SHAPES.map(key => [key, 0])) as Record<Shape, number>;
  const cadence = Object.fromEntries(CADENCES.map(key => [key, 0])) as Record<Cadence, number>;
  const counts: number[] = [];
  for (const dataset of datasets) {
    shape[shapeOf(dataset)]++;
    cadence[cadenceOf(dataset)]++;
    if (dataset.recordsCount !== undefined) counts.push(dataset.recordsCount);
  }
  counts.sort((a, b) => a - b);
  const mid = counts.length >> 1;
  const recordsMedian = !counts.length ? null : counts.length % 2 ? counts[mid] : Math.round((counts[mid - 1] + counts[mid]) / 2);
  return { total: datasets.length, shape, cadence, recordsMedian, recordsUnknown: datasets.length - counts.length };
}
