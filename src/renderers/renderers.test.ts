import { describe, expect, it } from 'vitest';
import { fallbackDatasets } from '../data/fallback';
import { buildEvidencePlan } from '../evidence';
import { resolveTrustedEvidence } from '../evidence-sources/resolver';
import type { ExecutionResult, GeoJsonFeature } from '../execution/types';
import { parseUseCaseIntent } from '../intent';
import type { RepresentationSpec, RepresentationType } from '../representation';
import { renderRepresentation, selectRenderer, type RepresentationRenderInput } from '.';

const intent = parseUseCaseIntent('Build a comfortable running route in Basel with shade, clean air, fountains and sensible effort.');
const plan = buildEvidencePlan(intent, fallbackDatasets);

function spec(type: RepresentationType, validationState: RepresentationSpec['validationState'] = 'proposed'): RepresentationSpec {
  return { id: `test-${type}`, type, title: type.replaceAll('_', ' '), method: 'Render only deterministic evidence.',
    inputs: plan.roles.map(role => ({ datasetId: role.datasetId, roleId: role.id, label: role.label, status: role.datasetId ? 'available' : 'external' })),
    requiredAssessmentIds: [], validationState };
}

function input(type: RepresentationType, additions: Partial<RepresentationRenderInput> = {}): RepresentationRenderInput {
  return { spec: spec(type), intent, plan, datasets: fallbackDatasets,
    trusted: resolveTrustedEvidence(plan, fallbackDatasets), analysis: null, executions: new Map(), ...additions };
}

function execution(status: ExecutionResult['status']): ExecutionResult {
  return { id: `execution-${status}`, operationId: 'operation', assessmentId: 'assessment', status,
    startedAt: '2026-09-03T00:00:00Z', completedAt: '2026-09-03T00:00:01Z', sourceSnapshots: [{ datasetId: '100008', sourceUrl: 'https://data.bs.ch/execution-source', retrievedAt: '2026-09-03T00:00:00Z' }],
    evidenceLevel: 'execution_validated', engine: { name: 'fixture', version: '1' },
    validation: { originalRelation: 'spatial_join', confirmed: status === 'confirmed' || status === 'partial',
      reasons: [`The relationship was ${status}.`], warnings: status === 'partial' ? ['The source was truncated.'] : [] } };
}

const point: GeoJsonFeature = { type: 'Feature', geometry: { type: 'Point', coordinates: [7.59, 47.56] }, properties: { name: 'Fixture fountain' } };

describe('representation renderers', () => {
  it('selects the expected renderer family', () => {
    expect(selectRenderer(spec('point_map'))?.id).toBe('map');
    expect(selectRenderer(spec('ranked_bar'))?.id).toBe('plot');
    expect(selectRenderer(spec('evidence_brief'))?.id).toBe('evidence_brief');
  });

  it('reports unsupported specs and makes its evidence-brief fallback explicit', () => {
    const result = renderRepresentation(input('route_comparison'));
    expect(result.status).toBe('unsupported');
    expect(result.reason).toContain('no defensible routable network');
    expect(result.fallback?.renderer).toBe('evidence_brief');
  });

  it.each(['rejected', 'partial'] as const)('preserves %s execution status in a brief', status => {
    const result = renderRepresentation(input('evidence_brief', { executions: new Map([['assessment', execution(status)]]) }));
    expect(result.claims).toContainEqual(expect.objectContaining({ status, evidenceLevel: 'execution_validated' }));
    expect(result.claims).not.toContainEqual(expect.objectContaining({ status: 'confirmed', text: expect.stringContaining(status) }));
  });

  it('keeps proposed and unresolved evidence visible', () => {
    const result = renderRepresentation(input('evidence_brief'));
    expect(result.claims.some(claim => claim.status === 'proposed')).toBe(true);
    expect(result.status).toBe('partial');
  });

  it('blocks charts when deterministic numbers are absent', () => {
    expect(renderRepresentation(input('ranked_bar')).status).toBe('blocked');
    expect(renderRepresentation(input('time_series')).reason).toContain('numeric observations');
  });

  it('renders deterministic numeric fixtures without network access', () => {
    const result = renderRepresentation(input('ranked_bar', { spec: spec('ranked_bar', 'validated'),
      observations: [{ label: 'Zone A', value: 12, unit: 'fountains', sourceId: 'fixture' }] }));
    expect(result.status).toBe('ready');
    expect(result.view).toEqual(expect.objectContaining({ kind: 'plot', chart: 'ranked_bar' }));
  });

  it('blocks incomplete time-series values', () => {
    const result = renderRepresentation(input('time_series', { observations: [{ label: 'Reading', value: 12, unit: '°C', sourceId: 'fixture' }] }));
    expect(result.status).toBe('blocked');
    expect(result.reason).toContain('timestamp');
  });

  it('renders deterministic GeoJSON and retains layer provenance', () => {
    const result = renderRepresentation(input('point_map', { layers: [{ id: 'fountains', label: 'Fountains', datasetId: '100008',
      sourceUrl: 'fixture://fountains', scope: 'local', features: [point] }] }));
    expect(result.status).toBe('ready');
    expect(result.view).toEqual(expect.objectContaining({ kind: 'map', layers: [expect.objectContaining({ sourceUrl: 'fixture://fountains' })] }));
  });

  it('blocks a map rather than drawing without geometry', () => {
    const result = renderRepresentation(input('relationship_map'));
    expect(result.status).toBe('blocked');
    expect(result.reason).toContain('GeoJSON geometry');
  });

  it('preserves local publisher links and national trusted scope', () => {
    const result = renderRepresentation(input('evidence_brief'));
    expect(result.sources.some(source => source.scope === 'local' && source.sourceUrl.startsWith('https://'))).toBe(true);
    expect(result.sources.some(source => source.scope === 'national' && source.state.includes('system curation'))).toBe(true);
  });

  it('upgrades source provenance only when an execution snapshot exists', () => {
    const result = renderRepresentation(input('evidence_brief', { executions: new Map([['assessment', execution('confirmed')]]) }));
    expect(result.sources).toContainEqual(expect.objectContaining({ id: '100008', state: 'execution validated', timestamp: '2026-09-03T00:00:00Z' }));
  });
});
