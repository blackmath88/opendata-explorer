/**
 * The same dataset in two catalogues: a canton's own portal and its copy on opendata.swiss.
 * opendata.swiss identifiers read `<local id>@<publisher>`, so Basel's `100052` reappears as
 * `100052@kanton-basel-stadt`. The richer source (the canton's portal) wins; the national copy
 * is linked, never counted twice.
 *
 * Deterministic and conservative: only an exact local id under one of the canton's own
 * publishers links. Anything else stays separate and is reported, not guessed.
 */
import type { DatasetRecord } from '../types';

export interface CatalogueMerge {
  /** Primary datasets, then national-only ones: every dataset exactly once. */
  datasets: DatasetRecord[];
  /** primary id -> national id */
  linked: Map<string, string>;
  nationalOnly: string[];
  /** National records that name the canton's publisher but whose local id is not in the primary catalogue. */
  unmatched: string[];
}

export function splitIdentifier(identifier: string | undefined): { local: string; publisher: string } | undefined {
  const at = identifier?.lastIndexOf('@') ?? -1;
  if (!identifier || at <= 0 || at === identifier.length - 1) return undefined;
  return { local: identifier.slice(0, at), publisher: identifier.slice(at + 1) };
}

export function mergeCatalogues(primary: readonly DatasetRecord[], national: readonly DatasetRecord[], publishers: readonly string[]): CatalogueMerge {
  const primaryIds = new Set(primary.map(dataset => dataset.id));
  const own = new Set(publishers);
  const linked = new Map<string, string>();
  const nationalOnly: DatasetRecord[] = [];
  const unmatched: string[] = [];
  for (const dataset of national) {
    const parts = splitIdentifier(dataset.identifier);
    if (parts && own.has(parts.publisher) && primaryIds.has(parts.local) && !linked.has(parts.local)) {
      linked.set(parts.local, dataset.id);
      continue;
    }
    if (parts && own.has(parts.publisher)) unmatched.push(dataset.id);
    nationalOnly.push(dataset);
  }
  const collisions = nationalOnly.filter(dataset => primaryIds.has(dataset.id));
  if (collisions.length) throw new Error(`national ids collide with primary ids: ${collisions.map(dataset => dataset.id).join(', ')}`);
  return { datasets: [...primary, ...nationalOnly], linked, nationalOnly: nationalOnly.map(dataset => dataset.id), unmatched };
}
