/**
 * Canonical, source-independent models.
 *
 * Everything Opendatasoft/Basel-specific stops at the adapter boundary
 * (`src/data/basel.ts`). Nothing in this file may assume a particular
 * catalogue implementation.
 */

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

/**
 * Where a structural observation came from. This is the evidence ladder the
 * whole product is built on; never collapse these into one confidence number.
 *
 *   catalog_metadata  the catalogue *claims* it (publisher-supplied metadata)
 *   schema            the dataset's field schema was read
 *   sample_records    actual stored records (or a server-side aggregate over
 *                     them) were observed
 */
export type ObservationSource = 'catalog_metadata' | 'schema' | 'sample_records';

/**
 * The same ladder expressed for a relationship between two datasets.
 *
 *   metadata_only       the publishers' claims are consistent with the relation
 *   schema_observed     both schemas were read and support it
 *   sample_validated    stored values were compared and support it
 *   execution_validated the operation was actually run against real geometry
 *
 * `execution_validated` is deliberately a separate rung, not a strong flavour
 * of `sample_validated`: sampling shows that values *look* joinable, execution
 * shows that the operation *produced a result*, and only the latter can reject
 * a structurally plausible hypothesis.
 */
export type EvidenceLevel =
  | 'metadata_only'
  | 'schema_observed'
  | 'sample_validated'
  | 'execution_validated';

/**
 * Who is responsible for a statement shown in the UI. Source facts, system
 * inference and (later) model inference must never look alike.
 */
export type ClaimOrigin = 'source_metadata' | 'system_inference' | 'model_inference';

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export type DatasetFormat = 'json' | 'csv' | 'geojson' | 'gpx' | 'parquet' | 'other';

export interface DatasetCharacteristics {
  /** True when the source declares geometry or the schema exposes a geo field. */
  geospatial: boolean;
  timeSeries: boolean;
  realtime: boolean;
  /** Primary source-declared geometry type, kept for display convenience. */
  geometryType?: string;
  /** All source-declared geometry types (catalogue claim, not observed). */
  geometryTypes: string[];
  /** `[start, end]` ISO strings when the catalogue declares temporal coverage. */
  temporalCoverage: string[];
  /** Source-declared bounding box as `[minLon, minLat, maxLon, maxLat]`. */
  bbox?: [number, number, number, number];
  /** Source-declared update cadence, normalized to a short human label. */
  updateFrequency?: string;
  /** Administrative areas the source associates with the dataset. */
  territory: string[];
}

export interface SemanticHints {
  summary: string;
  topics: string[];
  possibleUses: string[];
  possibleJoins: string[];
}

export interface DatasetRecord {
  id: string;
  title: string;
  description: string;
  publisher: string;
  themes: string[];
  keywords: string[];
  license: string;
  licenseUrl?: string;
  modified?: string;
  recordsCount?: number;
  sourceUrl: string;
  /** Machine-readable endpoint for the dataset's records, when the source has one. */
  apiUrl?: string;
  formats: DatasetFormat[];
  characteristics: DatasetCharacteristics;
  semantic: SemanticHints;
  /** Lowercased multilingual blob used by deterministic matching only. */
  searchText: string;
  /** False when the source publishes metadata but no queryable records. */
  hasRecords: boolean;
  /** Number of fields the catalogue exposes, when the listing includes a schema. */
  fieldCount?: number;
}

export interface MatchReason {
  score: number;
  matchedTerms: string[];
  explanation: string;
}

export interface DatasetMatch {
  dataset: DatasetRecord;
  relevance: MatchReason;
  /** Deterministic relevance class; see `EvidenceClass`. */
  evidenceClass: EvidenceClass;
  /** Evidence-plan role slots this dataset is proposed for, if any. */
  roleIds: string[];
}

export type CatalogSource = 'live' | 'fallback';

export interface CatalogState {
  source: CatalogSource;
  loadedAt: string;
  datasets: DatasetRecord[];
  /** Total the catalogue reported, so we can flag partial loads honestly. */
  reportedTotal?: number;
  error?: string;
  notes: string[];
}

// ---------------------------------------------------------------------------
// Use-case intent
// ---------------------------------------------------------------------------

export type TemporalNeed = 'current' | 'historical' | 'forecast' | 'mixed';

export interface UseCaseIntent {
  /** The user's words, always retained verbatim. */
  statement: string;
  domainHints: string[];
  spatialNeed: boolean;
  temporalNeed?: TemporalNeed;
  geographicScope?: string;
  desiredOutcome?: string;
  constraints: string[];
}

// ---------------------------------------------------------------------------
// Evidence plan
// ---------------------------------------------------------------------------

export type EvidenceClass = 'direct' | 'supporting' | 'contextual' | 'missing';

export type EvidenceRoleType =
  | 'analysis_backbone'
  | 'primary_measure'
  | 'context'
  | 'constraint'
  | 'denominator'
  | 'geography'
  | 'validation'
  | 'external_dependency'
  | 'missing';

export interface EvidenceRole {
  id: string;
  label: string;
  roleType: EvidenceRoleType;
  datasetId?: string;
  required: boolean;
  reason: string;
}

/** Everything the UI needs to render a role slot without re-deriving it. */
export interface PlannedRole extends EvidenceRole {
  /** Ranked alternatives the deterministic resolver considered. */
  candidates: Array<{ datasetId: string; title: string; score: number; note: string }>;
  /** Set when no catalogue dataset can fill the slot. */
  gap?: { kind: 'not_in_catalogue' | 'no_candidate_selected'; suggestion?: string };
  /** Always `system_inference` today; reserved for a future model proposer. */
  origin: ClaimOrigin;
}

export interface EvidencePlan {
  intent: UseCaseIntent;
  roles: PlannedRole[];
  /** Required roles with no dataset attached. */
  unresolved: PlannedRole[];
  /** Roles known to be unavailable in this catalogue. */
  externalDependencies: PlannedRole[];
}

// ---------------------------------------------------------------------------
// Dataset structure
// ---------------------------------------------------------------------------

export type FieldRoleHint =
  | 'geometry'
  | 'geopoint'
  | 'identifier'
  | 'temporal'
  | 'measure'
  | 'category'
  | 'reference'
  | 'free_text';

export interface FieldProfile {
  name: string;
  type?: string;
  label?: string;
  description?: string;
  unit?: string;
  sampleValues?: unknown[];
  roleHints?: string[];
  /** Where the field's role hints came from. */
  hintSource?: ObservationSource;
}

export interface CandidateKeyProfile {
  field: string;
  /**
   * `schema_annotation` means the publisher marked the field as an identifier.
   * `name_heuristic` means we guessed from the field name — always a candidate.
   */
  source: 'schema_annotation' | 'name_heuristic';
  type?: string;
  /** Bounded set of distinct values, only present after sampling. */
  distinctSample?: string[];
  /** Distinct value count reported by the source, when cheaply available. */
  distinctCount?: number;
}

export interface DatasetStructure {
  datasetId: string;
  fields: FieldProfile[];

  geometry?: {
    type: string;
    crs?: string;
    extent?: [number, number, number, number];
    /** Where the geometry claim came from. Never present metadata as observation. */
    observedFrom: ObservationSource;
    /** All geometry types the source declares. */
    declaredTypes?: string[];
    /** Fields that actually carry geometry in the schema. */
    fields?: string[];
  };

  temporal?: {
    fields: string[];
    start?: string;
    end?: string;
    grain?: string;
    observedFrom: ObservationSource;
    /** Separate provenance for the coverage window vs. the field list. */
    coverageObservedFrom?: ObservationSource;
  };

  candidateKeys: string[];
  /** Provenance-carrying detail behind `candidateKeys`. */
  keyProfiles: CandidateKeyProfile[];

  recordCount?: number;
  recordCountObservedFrom?: ObservationSource;

  /** Highest evidence level reached anywhere in this structure. */
  observedFrom: ObservationSource;

  /** Human-readable caveats produced while building the structure. */
  notes: string[];
}

// ---------------------------------------------------------------------------
// Compatibility
// ---------------------------------------------------------------------------

export type CompatibilityRelation =
  | 'direct_join'
  | 'spatial_join'
  | 'nearest'
  | 'interpolation_required'
  | 'aggregate_required'
  | 'resample_required'
  | 'incompatible'
  | 'unknown';

export type Confidence = 'high' | 'medium' | 'low';

/**
 * What an assessment was computed from.
 *
 * Recorded so that an execution result can name its justification precisely,
 * and so a later reader can tell whether the assessment still describes the
 * data. If either fingerprint no longer matches the current structure, the
 * assessment is stale — see `isAssessmentStale`.
 */
export interface AssessmentInputs {
  leftDatasetId: string;
  rightDatasetId: string;
  leftStructureFingerprint: string;
  rightStructureFingerprint: string;
  /** Digest of the value-level key evidence that was available, if any. */
  keyEvidenceFingerprint?: string;
  /** Rule set that produced the outcome. */
  ruleVersion: string;
}

export interface CompatibilityAssessment {
  /**
   * Derived from `inputs`, so the same inputs always yield the same id and any
   * change to the structures or the rules yields a different one. An execution
   * result referencing an id that no longer reproduces is visibly stale.
   */
  id: string;

  leftDatasetId: string;
  rightDatasetId: string;

  /** Fingerprint of each side's structure at assessment time. */
  leftStructureRef: string;
  rightStructureRef: string;

  relation: CompatibilityRelation;

  confidence: Confidence;

  reasons: string[];
  warnings: string[];

  candidateKeys?: Array<{ left: string; right: string }>;

  proposedOperation?: string;

  evidenceLevel: EvidenceLevel;

  assessedAt: string;

  inputs: AssessmentInputs;
}

/**
 * Value-level evidence for one candidate key pair.
 *
 * `leftDistinct` values were read from the left dataset (capped), and each was
 * tested against the *whole* right dataset — so `overlap` is exact for the
 * values compared. `bounded` says whether the left side hit its cap, which is
 * what stops a zero overlap from being read as proof.
 */
export interface KeyOverlapEvidence {
  leftField: string;
  rightField: string;
  leftDistinct: number;
  rightDistinct: number;
  overlap: number;
  bounded: boolean;
}

// ---------------------------------------------------------------------------
// Adapter boundary
// ---------------------------------------------------------------------------

export interface InspectOptions {
  /**
   * Allow a bounded number of record reads to upgrade the structure from
   * `schema` to `sample_records`. Off by default: inspection must stay cheap.
   */
  sample?: boolean;
}

/** One side of a candidate key pair, with the type needed to query it safely. */
export interface KeyRef {
  datasetId: string;
  field: string;
  type?: string;
}

export interface CatalogueAdapter {
  readonly id: string;
  readonly label: string;
  listDatasets(): Promise<DatasetRecord[]>;
  getDataset(id: string): Promise<DatasetRecord>;
  inspectDataset(id: string, options?: InspectOptions): Promise<DatasetStructure>;
  /**
   * Bounded value-level check for a candidate key pair. Optional so that
   * offline/fallback adapters can decline instead of faking evidence.
   */
  sampleKeyOverlap?(left: KeyRef, right: KeyRef): Promise<KeyOverlapEvidence | null>;
}
