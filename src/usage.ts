/**
 * Portal activity counters, where a portal publishes them (Basel-Stadt: dataset 100057).
 * They include automated traffic and miss use through other channels (docs/CATALOGUE_AUDIT.md),
 * so they only ever rank "rarely used" within a group, age-normalised; never "unused".
 */
import { asNumber, asObject, asString, odsFetch } from './data/ods';
import type { Portal } from './portal';

export interface UsageRecord { downloads: number; apiCalls: number; reuses: number; created?: string }
export type UsageIndex = ReadonlyMap<string, UsageRecord>;

/** Downloads per month since publication; at least one month, so a new dataset is not "rare" by default. */
export function downloadsPerMonth(usage: UsageRecord, now: Date): number | undefined {
  if (!usage.created) return undefined;
  const created = new Date(usage.created);
  if (Number.isNaN(created.getTime())) return undefined;
  const months = Math.max(1, (now.getTime() - created.getTime()) / (30.44 * 24 * 3600 * 1000));
  return usage.downloads / months;
}

export function parseUsageRows(rows: unknown[]): Map<string, UsageRecord> {
  const index = new Map<string, UsageRecord>();
  for (const value of rows) {
    const row = asObject(value);
    const id = asString(row.dataset_identifier);
    if (!id) continue;
    index.set(id, {
      downloads: asNumber(row.download_count) ?? 0,
      apiCalls: asNumber(row.api_call_count) ?? 0,
      reuses: asNumber(row.reuse_count) ?? 0,
      created: asString(row.created) || undefined,
    });
  }
  return index;
}

/** Null when the portal publishes no counters or they cannot be read: callers fall back to metadata. */
export async function loadUsage(portal: Portal): Promise<UsageIndex | null> {
  if (!portal.usageDataset || portal.api.kind !== 'ods') return null;
  try {
    const rows: unknown[] = [];
    for (let offset = 0; offset < 2000; offset += 100) {
      const page = await odsFetch<{ results?: unknown[] }>(`/catalog/datasets/${portal.usageDataset}/records`, {
        select: 'dataset_identifier,download_count,api_call_count,reuse_count,created',
        limit: 100, offset, order_by: 'dataset_identifier',
      }, { portal });
      const results = Array.isArray(page.results) ? page.results : [];
      rows.push(...results);
      if (results.length < 100) break;
    }
    return parseUsageRows(rows);
  } catch {
    return null;
  }
}
