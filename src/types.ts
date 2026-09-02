export type DatasetFormat = 'json' | 'csv' | 'geojson' | 'gpx' | 'parquet' | 'other';

export interface DatasetCharacteristics {
  geospatial: boolean;
  timeSeries: boolean;
  realtime: boolean;
  geometryType?: string;
  temporalCoverage: string[];
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
  modified?: string;
  recordsCount?: number;
  sourceUrl: string;
  formats: DatasetFormat[];
  characteristics: DatasetCharacteristics;
  semantic: SemanticHints;
}

export interface MatchReason {
  score: number;
  matchedTerms: string[];
  explanation: string;
}

export interface DatasetMatch {
  dataset: DatasetRecord;
  relevance: MatchReason;
}

export interface CatalogState {
  source: 'live' | 'fallback';
  loadedAt: string;
  datasets: DatasetRecord[];
  error?: string;
}

export type TemporalNeed = 'current' | 'historical' | 'forecast' | 'mixed';

export interface UseCaseIntent {
  statement: string;
  domainHints: string[];
  spatialNeed: boolean;
  temporalNeed?: TemporalNeed;
  geographicScope?: string;
  desiredOutcome?: string;
  constraints: string[];
}

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
  evidenceClass: EvidenceClass;
  inferred: boolean;
}

export interface FieldProfile {
  name: string;
  type?: string;
  label?: string;
  sampleValues?: unknown[];
  roleHints?: string[];
}

export interface DatasetStructure {
  datasetId: string;
  fields: FieldProfile[];
  geometry?: {
    type: string;
    crs?: string;
    extent?: [number, number, number, number];
  };
  temporal?: {
    fields: string[];
    start?: string;
    end?: string;
    grain?: string;
  };
  candidateKeys: string[];
  recordCount?: number;
  observedFrom: 'catalog_metadata' | 'schema' | 'sample_records';
}

export type CompatibilityRelation =
  | 'direct_join'
  | 'spatial_join'
  | 'nearest'
  | 'interpolation_required'
  | 'aggregate_required'
  | 'resample_required'
  | 'incompatible'
  | 'unknown';

export interface CompatibilityAssessment {
  leftDatasetId: string;
  rightDatasetId: string;
  relation: CompatibilityRelation;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
  warnings: string[];
  candidateKeys?: Array<{ left: string; right: string }>;
  proposedOperation?: string;
  evidenceLevel: 'metadata_only' | 'schema_observed' | 'sample_validated';
}
