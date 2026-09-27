/**
 * The doorway: one real dataset per subcategory that invites a first click. The rule is the
 * mission: surface what is **ready but rarely used**, not what everyone already finds.
 *
 * Ready = has records (at least 10), a known data form and a description of some substance.
 * With usage counters: the lowest age-normalised downloads among ready datasets, preferring
 * those without documented reuse. Without counters: the most completely described ready dataset,
 * and the reason says so. Deterministic: ties break by id.
 */
import { dataForm, FORM_LABEL } from './atlas-spec';
import type { DatasetRecord } from './types';
import { downloadsPerMonth, type UsageIndex } from './usage';

export interface Doorway { dataset: DatasetRecord; basis: 'usage' | 'metadata'; reason: string }

const MIN_RECORDS = 10;
const MIN_DESCRIPTION = 80;

export function isReady(dataset: DatasetRecord): boolean {
  return dataset.hasRecords && (dataset.recordsCount ?? 0) >= MIN_RECORDS
    && dataForm(dataset) !== 'unknown' && dataset.description.trim().length >= MIN_DESCRIPTION;
}

const count = (value: number): string => new Intl.NumberFormat('de-CH').format(value);
const readiness = (dataset: DatasetRecord): string => `${count(dataset.recordsCount ?? 0)} records · ${FORM_LABEL[dataForm(dataset)]}`;

function completeness(dataset: DatasetRecord): number {
  return Math.min(dataset.description.length, 600) / 100
    + (dataset.fieldCount ?? 0) / 5
    + (dataset.characteristics.updateFrequency ? 2 : 0)
    + (dataset.characteristics.temporalCoverage.length ? 1 : 0)
    + (dataset.keywords.length ? 1 : 0);
}

export function pickDoorway(datasets: readonly DatasetRecord[], usage: UsageIndex | null, now: Date): Doorway | null {
  const ready = datasets.filter(isReady).sort((a, b) => a.id.localeCompare(b.id));
  if (!ready.length) return null;
  if (usage) {
    const scored = ready
      .map(dataset => ({ dataset, row: usage.get(dataset.id) }))
      .map(item => ({ ...item, rate: item.row ? downloadsPerMonth(item.row, now) : undefined }))
      .filter((item): item is typeof item & { row: NonNullable<typeof item.row>; rate: number } => !!item.row && item.rate !== undefined);
    if (scored.length) {
      const pool = scored.some(item => item.row.reuses === 0) ? scored.filter(item => item.row.reuses === 0) : scored;
      const best = pool.reduce((low, item) => (item.rate < low.rate ? item : low));
      const reuse = best.row.reuses === 0 ? 'no documented reuse' : `${best.row.reuses} documented reuse${best.row.reuses === 1 ? '' : 's'}`;
      return {
        dataset: best.dataset,
        basis: 'usage',
        reason: `Ready: ${readiness(best.dataset)}. Rarely used: about ${count(Math.round(best.rate))} downloads a month, ${reuse}.`,
      };
    }
  }
  const best = ready.reduce((top, dataset) => (completeness(dataset) > completeness(top) ? dataset : top));
  return {
    dataset: best,
    basis: 'metadata',
    reason: `Ready: ${readiness(best)}. The most completely described dataset here; ${usage ? 'its usage cannot be compared (no publication date)' : 'this portal publishes no usage figures'}.`,
  };
}
