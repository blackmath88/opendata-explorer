import type { RepresentationRenderer } from './types';
import { claimsFrom, provenanceFrom } from './shared';

export const evidenceBriefRenderer: RepresentationRenderer = {
  id: 'evidence_brief',
  supports: spec => spec.type === 'evidence_brief' || spec.type === 'comparison_cards',
  render(input) {
    const claims = claimsFrom(input);
    const sources = provenanceFrom(input);
    const local = input.trusted.roles.filter(role => role.localStatus !== 'missing').map(role => `${role.label}: ${role.localReason}`);
    const supporting = sources.filter(source => source.scope === 'national').map(source => `${source.label} — ${source.state}`);
    const checked = [...input.executions.values()].map(result => `${result.validation.originalRelation}: ${result.status} (${result.evidenceLevel.replace('_', ' ')})`);
    const by = (status: typeof claims[number]['status']) => claims.filter(claim => claim.status === status).map(claim => claim.text);
    const unresolved = by('unresolved');
    const sections = [
      { title: 'Question', items: [input.intent.statement] },
      { title: 'What we found', items: local.length ? local : ['No local evidence is selected yet.'] },
      { title: 'Swiss supporting evidence', items: supporting.length ? supporting : ['No national supporting source is needed.'] },
      { title: 'What was checked', items: checked.length ? checked : ['No relationship has been executed yet.'] },
      { title: 'Confirmed', items: by('confirmed') },
      { title: 'Rejected', items: by('rejected') },
      { title: 'Partial', items: by('partial') },
      { title: 'Unresolved', items: unresolved.length ? unresolved : ['No unsupported role is currently unresolved.'] },
      { title: 'Recommended interpretation', items: [input.spec.method, 'Treat proposed sources and relationships as candidates until their required validation succeeds.'] },
    ];
    const incomplete = claims.some(claim => ['partial', 'rejected', 'unresolved', 'proposed'].includes(claim.status));
    return { status: incomplete ? 'partial' : 'ready', renderer: 'evidence_brief', requestedType: input.spec.type,
      title: input.spec.title, method: input.spec.method, validationState: input.spec.validationState,
      claims, sources, caveats: input.analysis?.notes ?? [], view: { kind: 'brief', sections } };
  },
};
