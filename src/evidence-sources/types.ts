import type { ClaimOrigin } from '../types';

export type EvidenceScope = 'local' | 'national' | 'external';
export type TrustedAccessType = 'opendatasoft' | 'ckan' | 'stac' | 'geo_admin' | 'rest' | 'download';
export type TrustedFormat = 'csv' | 'json' | 'geotiff' | 'geopackage' | 'parquet' | 'other';

export interface TrustedProvider {
  id: string;
  label: string;
  scope: EvidenceScope;
  trust: 'official';
  homepage: string;
  attribution: string;
}

export interface TrustedEvidenceResource {
  id: string;
  providerId: string;
  label: string;
  description: string;
  topics: string[];
  evidenceRoleIds: string[];
  accessType: TrustedAccessType;
  catalogueUrl: string;
  endpoint?: string;
  formats: TrustedFormat[];
  geographicScope: string[];
  spatial?: { geometry: string; baselFilter: 'bbox' | 'tile' | 'none' };
  temporal?: { mode?: string; frequency?: string; freshness?: string };
  browserAccess: 'direct' | 'metadata_only' | 'impractical';
  /** Highest access state verified during curation; never a compatibility claim. */
  status: ExternalCandidateStatus;
  licence: string;
  curatedReason: string;
  notes: string[];
}

export type LocalEvidenceStatus = 'locally_available' | 'locally_weak' | 'missing';
export type ExternalCandidateStatus = 'known_source' | 'metadata_resolved' | 'retrievable' | 'inspected';

export interface ExternalEvidenceCandidate {
  roleId: string;
  resourceId: string;
  providerId: string;
  scope: Extract<EvidenceScope, 'national' | 'external'>;
  reason: string;
  status: ExternalCandidateStatus;
  origin: Extract<ClaimOrigin, 'system_inference'>;
}

export interface ResolvedEvidenceRole {
  roleId: string;
  label: string;
  localDatasetId?: string;
  localStatus: LocalEvidenceStatus;
  localReason: string;
  candidates: ExternalEvidenceCandidate[];
}

export interface EvidenceResolution {
  roles: ResolvedEvidenceRole[];
  supplemental: ExternalEvidenceCandidate[];
  unresolved: ResolvedEvidenceRole[];
}
