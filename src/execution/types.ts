import type { CompatibilityAssessment, CompatibilityRelation, EvidenceLevel } from '../types';

/**
 * Contracts for executable spatial operations.
 *
 * This is a small, explicit intermediate representation — not a workflow
 * system. The one rule that matters: no operation exists without referencing
 * the CompatibilityAssessment that justified it. A UI-drawn edge is never the
 * source of truth; if a graph is rendered later it is a view of these objects.
 */

export type SpatialOperationType = 'spatial_join' | 'nearest' | 'aggregate';

export type OperationInputRole = 'left' | 'right' | 'source' | 'target';

export interface OperationInput {
  datasetId: string;
  /** Structure fingerprint the operation was planned against. */
  structureRef?: string;
  role: OperationInputRole;
}

export interface SpatialOperation {
  id: string;
  type: SpatialOperationType;

  /** The assessment that justified this operation. Never optional. */
  assessmentId: string;

  inputs: OperationInput[];
  parameters: Record<string, unknown>;

  /** What the assessment claimed, so execution can confirm or reject it. */
  expectedRelation: CompatibilityRelation;

  createdFrom: 'compatibility_assessment' | 'execution_result';
  createdAt: string;
}

/** Parameters for a point-in-polygon / containment join. */
export interface SpatialJoinParameters {
  /** Dataset whose features are tested for containment. */
  sourceDatasetId: string;
  /** Dataset providing the areas. */
  targetDatasetId: string;
  maxFeatures: number;
}

/** Parameters for a nearest-feature attachment. */
export interface NearestParameters {
  sourceDatasetId: string;
  targetDatasetId: string;
  /**
   * Beyond this, a "nearest" match is not an analytical relationship. The
   * compatibility engine warns that a threshold must be chosen; this is where
   * it is chosen, explicitly and on the record.
   */
  maxDistanceMeters: number;
  /**
   * Share of source features that must have a target within the threshold for
   * the nearest hypothesis to count as confirmed.
   */
  minCoverage: number;
  maxFeatures: number;
}

/** Parameters for a bounded derived measure over an executed relationship. */
export interface AggregateParameters {
  /** Execution whose matches are being summarised. */
  sourceExecutionId: string;
  measure: 'count_per_target' | 'distance_summary';
  maxGroups: number;
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export type ExecutionStatus = 'confirmed' | 'rejected' | 'failed' | 'partial';

/** Exactly what was read, when, and how much of it. */
export interface SourceSnapshot {
  datasetId: string;
  sourceUrl?: string;
  retrievedAt: string;
  recordCount?: number;
  /** Records the source reports in total, so truncation is visible. */
  totalRecordCount?: number;
  truncated?: boolean;
  fingerprint?: string;
  geometryTypes?: string[];
}

export interface ExecutionOutput {
  type: string;
  recordCount?: number;
  summary?: Record<string, unknown>;
  /** Key into the in-memory artifact store; not persisted in this milestone. */
  artifactRef?: string;
}

export interface ExecutionValidation {
  originalRelation: CompatibilityRelation;
  /** Did the original compatibility hypothesis survive execution? */
  confirmed: boolean;
  reasons: string[];
  warnings: string[];
}

export interface ExecutionResult {
  id: string;
  operationId: string;
  assessmentId: string;

  status: ExecutionStatus;

  startedAt: string;
  completedAt: string;

  sourceSnapshots: SourceSnapshot[];

  output?: ExecutionOutput;

  /** Always execution_validated: this is the rung execution occupies. */
  evidenceLevel: Extract<EvidenceLevel, 'execution_validated'>;

  validation: ExecutionValidation;

  /** Engine identity, so an old record stays interpretable. */
  engine: { name: string; version: string };

  error?: { code: string; message: string };
}

export interface ExecutionEngine {
  readonly name: string;
  readonly version: string;
  execute(operation: SpatialOperation): Promise<ExecutionResult>;
}

// ---------------------------------------------------------------------------
// Geometry sourcing
// ---------------------------------------------------------------------------

export interface LoadedFeatures {
  datasetId: string;
  features: GeoJsonFeature[];
  retrievedAt: string;
  sourceUrl?: string;
  /** Total the source reports, when known, so truncation can be detected. */
  totalRecordCount?: number;
  truncated: boolean;
  fingerprint: string;
}

/**
 * Where geometry comes from. Abstracted so the offline tests and the live app
 * run the same engine code over the same shapes.
 */
export interface GeometrySource {
  load(datasetId: string, options: { maxFeatures: number }): Promise<LoadedFeatures>;
}

// Minimal GeoJSON shapes. We only need what Turf accepts and what ODS returns.
export interface GeoJsonFeature {
  type: 'Feature';
  geometry: GeoJsonGeometry | null;
  properties: Record<string, unknown> | null;
}

export type GeoJsonGeometry =
  | { type: 'Point'; coordinates: number[] }
  | { type: 'MultiPoint'; coordinates: number[][] }
  | { type: 'LineString'; coordinates: number[][] }
  | { type: 'MultiLineString'; coordinates: number[][][] }
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] }
  | { type: 'GeometryCollection'; geometries: GeoJsonGeometry[] };

export interface FeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

/** Convenience alias used when an assessment travels with its operation. */
export interface JustifiedOperation {
  operation: SpatialOperation;
  assessment: CompatibilityAssessment;
}
