/**
 * Catalogue snapshots per portal: the raw API entries, frozen to a file, re-normalized on load.
 * Raw rather than normalized so that a normalizer fix applies to old snapshots too.
 * Node-only (scripts); the app itself ships only the Basel-Stadt fallback.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import type { Portal } from '../portal';
import type { DatasetRecord } from '../types';
import { normalizeCkanPackage } from './ckan';
import { fallbackDatasets } from './fallback';
import { normalizeOdsDataset } from './normalize';

export interface PortalSnapshot { portal: string; takenAt: string; reportedTotal?: number; entries: unknown[] }

/** Gzipped: raw API entries are large (Geneva: 13 MB of JSON, ~1.2 MB compressed). */
export const snapshotPath = (portal: Portal): string => `src/data/portals/${portal.id}/snapshot.json.gz`;

export function normalizeEntry(portal: Portal, entry: unknown): DatasetRecord | null {
  return portal.api.kind === 'ods' ? normalizeOdsDataset(entry, portal) : normalizeCkanPackage(entry, portal);
}

export function writeSnapshot(portal: Portal, entries: unknown[], reportedTotal?: number): string {
  const snapshot: PortalSnapshot = { portal: portal.id, takenAt: new Date().toISOString(), reportedTotal, entries };
  writeFileSync(snapshotPath(portal), gzipSync(JSON.stringify(snapshot) + '\n', { level: 9 }));
  return snapshotPath(portal);
}

/** The datasets a script should work on: a saved snapshot, else the shipped Basel fallback. */
export function snapshotDatasets(portal: Portal): { datasets: DatasetRecord[]; source: string } {
  if (existsSync(snapshotPath(portal))) {
    const snapshot = JSON.parse(gunzipSync(readFileSync(snapshotPath(portal))).toString('utf8')) as PortalSnapshot;
    return {
      datasets: snapshot.entries.map(entry => normalizeEntry(portal, entry)).filter((record): record is DatasetRecord => record !== null),
      source: `${snapshotPath(portal)} (${snapshot.takenAt.slice(0, 10)})`,
    };
  }
  if (portal.id === 'bs') return { datasets: fallbackDatasets, source: 'shipped offline fallback (src/data/fallback.ts)' };
  throw new Error(`${portal.label} has no snapshot; run: npx tsx scripts/portals.ts snapshot --portal ${portal.id}`);
}
