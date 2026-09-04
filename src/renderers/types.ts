import type { EvidenceResolution } from '../evidence-sources/types';
import type { ExecutionResult, GeoJsonFeature } from '../execution/types';
import type { RepresentationSpec, RepresentationType } from '../representation';
import type { DatasetRecord, EvidencePlan, UseCaseIntent } from '../types';
import type { WorkspaceAnalysis } from '../workspace';

export type RenderStatus = 'ready' | 'partial' | 'blocked' | 'unsupported';
export type RendererId = 'map' | 'plot' | 'evidence_brief';

export interface PreviewLayer {
  id: string;
  label: string;
  datasetId: string;
  sourceUrl: string;
  scope: 'local' | 'national';
  features: GeoJsonFeature[];
  truncated?: boolean;
}

export interface NumericObservation {
  label: string;
  value: number;
  time?: string;
  unit: string;
  sourceId: string;
}

export interface RepresentationRenderInput {
  spec: RepresentationSpec;
  intent: UseCaseIntent;
  plan: EvidencePlan;
  datasets: DatasetRecord[];
  trusted: EvidenceResolution;
  analysis: WorkspaceAnalysis | null;
  executions: Map<string, ExecutionResult>;
  layers?: PreviewLayer[];
  observations?: NumericObservation[];
}

export interface ProvenanceItem {
  id: string;
  label: string;
  provider: string;
  scope: 'local' | 'national';
  sourceUrl: string;
  state: string;
  timestamp?: string;
}

export interface RenderClaim {
  status: 'confirmed' | 'rejected' | 'partial' | 'proposed' | 'unresolved';
  text: string;
  evidenceLevel: string;
}

export interface MapViewModel { kind: 'map'; layers: PreviewLayer[]; center: [number, number]; zoom: number; }
export interface PlotViewModel { kind: 'plot'; chart: 'ranked_bar' | 'time_series'; observations: NumericObservation[]; }
export interface BriefViewModel { kind: 'brief'; sections: Array<{ title: string; items: string[] }>; }

export interface RepresentationResult {
  status: RenderStatus;
  renderer?: RendererId;
  requestedType: RepresentationType;
  title: string;
  reason?: string;
  method: string;
  validationState: RepresentationSpec['validationState'];
  claims: RenderClaim[];
  sources: ProvenanceItem[];
  caveats: string[];
  view?: MapViewModel | PlotViewModel | BriefViewModel;
  fallback?: RepresentationResult;
}

export interface RepresentationRenderer {
  id: RendererId;
  supports(spec: RepresentationSpec): boolean;
  render(input: RepresentationRenderInput): RepresentationResult;
}
