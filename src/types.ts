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
