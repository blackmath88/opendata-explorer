import { providerById, resourceById } from '../evidence-sources/registry';
import type { RepresentationRenderInput, RenderClaim, ProvenanceItem } from './types';

export function claimsFrom(input: RepresentationRenderInput): RenderClaim[] {
  const claims: RenderClaim[] = [];
  for (const result of input.executions.values()) {
    const text = [...result.validation.reasons, ...result.validation.warnings].join(' ') || `Execution ${result.id} produced ${result.status}.`;
    claims.push({ status: result.status === 'failed' ? 'partial' : result.status, text, evidenceLevel: result.evidenceLevel });
  }
  for (const role of input.trusted.roles) {
    if (role.localStatus === 'locally_weak') claims.push({ status: 'partial', text: role.localReason, evidenceLevel: 'system_inference' });
    if (role.localStatus === 'missing' && !role.candidates.length) claims.push({ status: 'unresolved', text: `${role.label}: ${role.localReason}`, evidenceLevel: 'system_inference' });
    for (const candidate of role.candidates) {
      const resource = resourceById(candidate.resourceId);
      claims.push({ status: 'proposed', text: `${resource?.label ?? candidate.resourceId} may fill ${role.label}; it is ${candidate.status.replace('_', ' ')} and not validated.`, evidenceLevel: candidate.origin });
    }
  }
  for (const candidate of input.trusted.supplemental) {
    const resource = resourceById(candidate.resourceId);
    claims.push({ status: 'proposed', text: `${resource?.label ?? candidate.resourceId} is optional context; it is not analytical validation.`, evidenceLevel: candidate.origin });
  }
  if (!claims.length) claims.push({ status: 'proposed', text: 'No analytical relationship has been execution-validated yet.', evidenceLevel: 'system_inference' });
  return claims;
}

export function provenanceFrom(input: RepresentationRenderInput): ProvenanceItem[] {
  const selectedIds = new Set(input.spec.inputs.map(item => item.datasetId).filter(Boolean));
  const snapshots = [...input.executions.values()].flatMap(result => result.sourceSnapshots);
  const local = input.datasets.filter(dataset => selectedIds.has(dataset.id)).map(dataset => {
    const snapshot = snapshots.find(item => item.datasetId === dataset.id);
    const structure = input.analysis?.entries.find(entry => entry.dataset.id === dataset.id)?.structure;
    return {
      id: dataset.id, label: dataset.title, provider: dataset.publisher, scope: 'local' as const,
      sourceUrl: snapshot?.sourceUrl ?? dataset.sourceUrl,
      state: snapshot ? 'execution validated' : structure ? structure.observedFrom.replace('_', ' ') : 'publisher metadata',
      timestamp: snapshot?.retrievedAt ?? dataset.modified,
    };
  });
  const candidates = [...input.trusted.roles.flatMap(role => role.candidates), ...input.trusted.supplemental];
  const national = candidates.map(candidate => {
    const resource = resourceById(candidate.resourceId)!;
    const provider = providerById(candidate.providerId)!;
    return { id: resource.id, label: resource.label, provider: provider.label, scope: 'national' as const,
      sourceUrl: resource.catalogueUrl, state: `${candidate.status.replace('_', ' ')} · system curation` };
  });
  return [...local, ...national].filter((item, index, all) => all.findIndex(other => other.id === item.id) === index);
}
