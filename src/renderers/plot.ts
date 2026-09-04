import type { RepresentationRenderer } from './types';
import { claimsFrom, provenanceFrom } from './shared';

export const plotRenderer: RepresentationRenderer = {
  id: 'plot',
  supports: spec => spec.type === 'ranked_bar' || spec.type === 'time_series',
  render(input) {
    const observations = (input.observations ?? []).filter(item => Number.isFinite(item.value));
    const common = { requestedType: input.spec.type, title: input.spec.title, method: input.spec.method,
      validationState: input.spec.validationState, claims: claimsFrom(input), sources: provenanceFrom(input), renderer: 'plot' as const };
    if (!observations.length) return { ...common, status: 'blocked' as const,
      reason: 'No deterministic numeric observations are available; a quantitative chart would be unsupported.', caveats: [] };
    if (input.spec.type === 'time_series' && observations.some(item => !item.time)) return { ...common, status: 'blocked' as const,
      reason: 'Time-series rendering requires a timestamp for every observation.', caveats: [] };
    const chart = input.spec.type === 'time_series' ? 'time_series' as const : 'ranked_bar' as const;
    return { ...common, status: input.spec.validationState === 'validated' ? 'ready' : 'partial',
      caveats: input.spec.validationState === 'validated' ? [] : ['Quantitative values are shown with their current validation state.'],
      view: { kind: 'plot' as const, chart, observations } };
  },
};
