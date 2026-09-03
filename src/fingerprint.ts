import type { DatasetStructure } from './types';

/**
 * Deterministic fingerprints and ids.
 *
 * These exist so that an execution result can say *exactly* what it was
 * computed from, and so a later reader can tell whether the assessment it
 * references still describes the data. Nothing here is security-sensitive; the
 * requirement is reproducibility, not resistance to a forged collision.
 */

/**
 * Bumped whenever a compatibility rule changes in a way that could alter an
 * outcome. It is part of the assessment id, so assessments produced by an older
 * rule set are distinguishable rather than silently conflated with new ones.
 */
export const COMPATIBILITY_RULE_VERSION = '2026-09-03.1';

/**
 * 53-bit string hash (cyrb53). Deterministic across browser and Node, no
 * dependency, and wide enough that accidental collisions across a few hundred
 * datasets are not a practical concern.
 */
export function hashString(input: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const value = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return value.toString(16).padStart(14, '0');
}

/**
 * Canonical JSON: object keys sorted, so two structurally equal values always
 * serialise identically regardless of construction order.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

/**
 * Fingerprint of the structural facts the compatibility rules actually read.
 *
 * Deliberately excludes `sampleValues` and `notes`: no rule reads them, so
 * re-sampling a dataset should not invalidate an assessment that could not have
 * been affected. `recordCount` and every provenance marker *are* included,
 * because the rules do read those and a change in them is a real input change.
 */
export function structureFingerprint(structure: DatasetStructure): string {
  const material = {
    datasetId: structure.datasetId,
    observedFrom: structure.observedFrom,
    recordCount: structure.recordCount,
    recordCountObservedFrom: structure.recordCountObservedFrom,
    fields: structure.fields
      .map(field => ({
        name: field.name,
        type: field.type,
        unit: field.unit,
        roleHints: [...(field.roleHints ?? [])].sort(),
      }))
      .sort((a, b) => (a.name < b.name ? -1 : 1)),
    geometry: structure.geometry && {
      type: structure.geometry.type,
      crs: structure.geometry.crs,
      extent: structure.geometry.extent,
      observedFrom: structure.geometry.observedFrom,
      declaredTypes: [...(structure.geometry.declaredTypes ?? [])].sort(),
      fields: [...(structure.geometry.fields ?? [])].sort(),
    },
    temporal: structure.temporal && {
      fields: [...structure.temporal.fields].sort(),
      start: structure.temporal.start,
      end: structure.temporal.end,
      grain: structure.temporal.grain,
      observedFrom: structure.temporal.observedFrom,
      coverageObservedFrom: structure.temporal.coverageObservedFrom,
    },
    keyProfiles: structure.keyProfiles
      .map(key => ({ field: key.field, source: key.source, type: key.type }))
      .sort((a, b) => (a.field < b.field ? -1 : 1)),
  };
  return `STR-${hashString(canonicalJson(material))}`;
}

/**
 * Fingerprint of a fetched feature collection, so an execution result can be
 * compared against a later re-fetch of the same source.
 */
export function featuresFingerprint(features: unknown[]): string {
  return `SRC-${hashString(canonicalJson(features))}`;
}
