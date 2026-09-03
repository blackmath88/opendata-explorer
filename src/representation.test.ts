import { describe, expect, it } from 'vitest';
import { fallbackDatasets } from './data/fallback';
import { buildEvidencePlan } from './evidence';
import { parseUseCaseIntent } from './intent';
import { recommendRepresentations } from './representation';

describe('representation recommendations', () => {
  it('recommends route-oriented views for a route plus spatial context', () => {
    const intent = parseUseCaseIntent('I want a running route planner with shade and fountains.');
    const selected = fallbackDatasets.filter(dataset => dataset.characteristics.geospatial);
    const plan = buildEvidencePlan(intent, fallbackDatasets, { selectedIds: selected.map(dataset => dataset.id) });
    const types = recommendRepresentations({ intent, plan, selected, analysis: null, executions: new Map() }).map(spec => spec.type);
    if (selected.some(dataset => dataset.characteristics.geometryTypes.some(type => /line/i.test(type)))) expect(types).toContain('route_comparison');
    expect(types.length).toBeGreaterThan(0);
  });

  it('always returns a clearly proposed renderer-independent spec', () => {
    const intent = parseUseCaseIntent('Summarise what evidence is available.');
    const plan = buildEvidencePlan(intent, fallbackDatasets, { selectedIds: [] });
    const [spec] = recommendRepresentations({ intent, plan, selected: [], analysis: null, executions: new Map() });
    expect(spec.type).toBe('evidence_brief');
    expect(spec.validationState).toBe('proposed');
    expect(spec.inputs.length).toBe(plan.roles.length);
  });
});
