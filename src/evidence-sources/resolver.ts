import type { DatasetRecord, EvidencePlan, PlannedRole } from '../types';
import { TRUSTED_EVIDENCE_RESOURCES } from './registry';
import type { EvidenceResolution, ExternalEvidenceCandidate, LocalEvidenceStatus, TrustedEvidenceResource } from './types';

export function resolveTrustedEvidence(plan: EvidencePlan, localDatasets: DatasetRecord[], registry: TrustedEvidenceResource[] = TRUSTED_EVIDENCE_RESOURCES): EvidenceResolution {
  const byId = new Map(localDatasets.map(dataset => [dataset.id, dataset]));
  const roles = plan.roles.map(role => {
    const dataset = role.datasetId ? byId.get(role.datasetId) : undefined;
    const localStatus = localEvidenceStatus(role, dataset);
    const candidates = localStatus === 'locally_available' ? [] : registry.filter(resource => resource.evidenceRoleIds.includes(role.id)).map(resource => candidate(role.id, resource, localStatus));
    return { roleId: role.id, label: role.label, localDatasetId: dataset?.id, localStatus, localReason: localReason(role, dataset, localStatus), candidates };
  });
  const statement = plan.intent.statement.toLocaleLowerCase();
  const supplemental = /weather|temperature|heat|outdoor|running|cycling/.test(statement)
    ? registry.filter(resource => resource.id === 'meteoswiss-weather').map(resource => candidate('weather_context', resource, 'missing'))
    : [];
  return { roles, supplemental, unresolved: roles.filter(role => role.localStatus !== 'locally_available' && !role.candidates.length) };
}

function localEvidenceStatus(role: PlannedRole, dataset?: DatasetRecord): LocalEvidenceStatus {
  if (!dataset || !dataset.hasRecords || dataset.recordsCount === 0) return 'missing';
  if (role.id === 'air_exposure' && /luftqualit.t station/i.test(dataset.title)) return 'locally_weak';
  if ((role.id === 'route_geometry' || role.id === 'screened_network') && (dataset.recordsCount ?? 0) < 100) return 'locally_weak';
  if ((dataset.recordsCount ?? Number.POSITIVE_INFINITY) < 10) return 'locally_weak';
  return 'locally_available';
}

function localReason(role: PlannedRole, dataset: DatasetRecord | undefined, status: LocalEvidenceStatus): string {
  if (!dataset) return role.gap?.suggestion ?? 'No Basel catalogue candidate was selected.';
  if (!dataset.hasRecords || dataset.recordsCount === 0) return 'The Basel catalogue record has no queryable records.';
  if (status === 'locally_weak' && role.id === 'air_exposure') return `${dataset.title} is fixed-station evidence, not continuous route-level coverage.`;
  if (status === 'locally_weak' && (role.id === 'route_geometry' || role.id === 'screened_network')) return `${dataset.title} has ${dataset.recordsCount ?? 'few'} curated features and is weak as a general network backbone.`;
  if (status === 'locally_weak') return `${dataset.title} is available but materially sparse.`;
  return `${dataset.title} is the preferred Basel evidence for this role.`;
}

function candidate(roleId: string, resource: TrustedEvidenceResource, localStatus: LocalEvidenceStatus): ExternalEvidenceCandidate {
  return {
    roleId, resourceId: resource.id, providerId: resource.providerId, scope: 'national',
    reason: localStatus === 'locally_weak' ? `Suggested because the local evidence is materially weak. ${resource.curatedReason}` : resource.curatedReason,
    status: resource.status, origin: 'system_inference',
  };
}
