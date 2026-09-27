/**
 * The same dataset in two catalogues: a canton's own portal and its copy on opendata.swiss.
 * opendata.swiss identifiers read `<local id>@<publisher>`, so Basel's `100052` reappears as
 * `100052@kanton-basel-stadt`. The richer source (the canton's portal) wins; the national copy
 * is linked, never counted twice.
 *
 * Deterministic and conservative. Two rules, both only under one of the canton's own publishers:
 *  - identifier: the DCAT identifier's local part equals a portal id (Basel: `100052@kanton-basel-stadt`);
 *  - name: the opendata.swiss package name equals a portal id (St. Gallen publishes the same slugs,
 *    with identifiers that do not carry them).
 * Anything else stays separate and is reported, not guessed.
 */
import type { DatasetRecord } from '../types';

export interface CatalogueMerge {
  /** Primary datasets, then national-only ones: every dataset exactly once. */
  datasets: DatasetRecord[];
  /** primary id -> national id */
  linked: Map<string, string>;
  /** How each link was made, by primary id. */
  linkedBy: Map<string, 'identifier' | 'name'>;
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
  const linkedBy = new Map<string, 'identifier' | 'name'>();
  const nationalOnly: DatasetRecord[] = [];
  const unmatched: string[] = [];
  for (const dataset of national) {
    const parts = splitIdentifier(dataset.identifier);
    const ours = !!parts && own.has(parts.publisher);
    if (ours && primaryIds.has(parts!.local) && !linked.has(parts!.local)) {
      linked.set(parts!.local, dataset.id);
      linkedBy.set(parts!.local, 'identifier');
      continue;
    }
    if (ours && primaryIds.has(dataset.id) && !linked.has(dataset.id)) {
      linked.set(dataset.id, dataset.id);
      linkedBy.set(dataset.id, 'name');
      continue;
    }
    if (ours) unmatched.push(dataset.id);
    nationalOnly.push(dataset);
  }
  const collisions = nationalOnly.filter(dataset => primaryIds.has(dataset.id));
  if (collisions.length) throw new Error(`national ids collide with primary ids: ${collisions.map(dataset => dataset.id).join(', ')}`);
  return { datasets: [...primary, ...nationalOnly], linked, linkedBy, nationalOnly: nationalOnly.map(dataset => dataset.id), unmatched };
}
