import type { ClaimOrigin, Confidence, EvidenceLevel, ObservationSource } from '../types';

export function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]!));
}

export const truncate = (value: string, max: number): string =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

export function formatCount(value?: number): string {
  if (value === undefined) return 'not published';
  return value.toLocaleString('de-CH');
}

export function formatDate(value?: string): string {
  if (!value) return 'not published';
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Date(parsed).toISOString().slice(0, 10);
}

/**
 * Provenance badges.
 *
 * The whole product rests on these staying visually distinct: a publisher's
 * claim, something we observed, and something this application inferred must
 * never look like the same kind of statement.
 */
export type Provenance = 'source' | 'schema' | 'sample' | 'execution' | 'system' | 'ai';

const PROVENANCE_LABEL: Record<Provenance, string> = {
  source: 'source',
  schema: 'schema observed',
  sample: 'sample observed',
  execution: 'execution validated',
  system: 'system inference',
  ai: 'ai inference',
};

const PROVENANCE_TITLE: Record<Provenance, string> = {
  source: 'Published by the data owner in the catalogue metadata.',
  schema: 'Read from the dataset schema exposed by the source API.',
  sample: 'Observed in stored records, or in a server-side aggregate over them.',
  execution: 'The operation was run against real geometry and produced this result.',
  system: 'Deterministic inference by this application. A proposal, not a source fact.',
  ai: 'Reserved for future model-generated proposals. Nothing in this build uses it.',
};

export function provenanceTag(kind: Provenance, suffix = ''): string {
  return `<span class="prov prov-${kind}" title="${escapeHtml(PROVENANCE_TITLE[kind])}">${escapeHtml(
    PROVENANCE_LABEL[kind] + (suffix ? ` · ${suffix}` : ''),
  )}</span>`;
}

export const observationProvenance = (source: ObservationSource): Provenance =>
  source === 'sample_records' ? 'sample' : source === 'schema' ? 'schema' : 'source';

export const evidenceProvenance = (level: EvidenceLevel): Provenance =>
  level === 'execution_validated'
    ? 'execution'
    : level === 'sample_validated'
      ? 'sample'
      : level === 'schema_observed'
        ? 'schema'
        : 'source';

export const originProvenance = (origin: ClaimOrigin): Provenance =>
  origin === 'source_metadata' ? 'source' : origin === 'model_inference' ? 'ai' : 'system';

export const EVIDENCE_LABEL: Record<EvidenceLevel, string> = {
  metadata_only: 'metadata only',
  schema_observed: 'schema observed',
  sample_validated: 'sample validated',
  execution_validated: 'execution validated',
};

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: 'high',
  medium: 'medium',
  low: 'low',
};

/** Relation names as the product speaks them, not as the enum spells them. */
export const RELATION_LABEL: Record<string, string> = {
  direct_join: 'DIRECT JOIN',
  spatial_join: 'SPATIAL JOIN',
  nearest: 'NEAREST',
  interpolation_required: 'INTERPOLATION REQUIRED',
  aggregate_required: 'AGGREGATE REQUIRED',
  resample_required: 'RESAMPLE REQUIRED',
  incompatible: 'INCOMPATIBLE',
  unknown: 'UNKNOWN',
};

export const ROLE_LABEL: Record<string, string> = {
  analysis_backbone: 'analysis backbone',
  primary_measure: 'primary measure',
  context: 'context',
  constraint: 'constraint',
  denominator: 'denominator',
  geography: 'geography',
  validation: 'validation',
  external_dependency: 'external dependency',
  missing: 'missing',
};
