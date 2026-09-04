import { describe, expect, it } from 'vitest';
import { buildEvidencePlan } from '../evidence';
import { parseUseCaseIntent } from '../intent';
import { fallbackDatasets } from '../data/fallback';
import { BENCHMARK_USE_CASES } from '../benchmarks/useCases';
import { resolveTrustedEvidence } from './resolver';
import { providerById, resourceById } from './registry';

const runningPlan = () => buildEvidencePlan(parseUseCaseIntent(BENCHMARK_USE_CASES[0].prompt), fallbackDatasets);

describe('trusted evidence resolver', () => {
  it('keeps adequate local evidence and does not add a national replacement', () => {
    const resolution = resolveTrustedEvidence(runningPlan(), fallbackDatasets);
    const shade = resolution.roles.find(role => role.roleId === 'shade_exposure')!;
    expect(shade.localStatus).toBe('locally_available');
    expect(shade.candidates).toEqual([]);
  });

  it('fills missing pollen and elevation roles with curated national candidates', () => {
    const resolution = resolveTrustedEvidence(runningPlan(), fallbackDatasets);
    expect(resolution.roles.find(role => role.roleId === 'allergen_exposure')?.candidates.map(item => item.resourceId)).toContain('meteoswiss-pollen');
    expect(resolution.roles.find(role => role.roleId === 'elevation_context')?.candidates.map(item => item.resourceId)).toContain('swisstopo-swissalti3d');
  });

  it('recommends a stronger network when the selected local route backbone is materially weak', () => {
    const plan = runningPlan();
    const route = plan.roles.find(role => role.id === 'route_geometry')!;
    expect(route.datasetId).toBeDefined();
    const datasets = fallbackDatasets.map(dataset => dataset.id === route.datasetId ? { ...dataset, recordsCount: 21, hasRecords: true } : dataset);
    const resolved = resolveTrustedEvidence(plan, datasets).roles.find(role => role.roleId === 'route_geometry')!;
    expect(resolved.localStatus).toBe('locally_weak');
    expect(resolved.candidates.map(item => item.resourceId)).toContain('swisstopo-swisstne-base');
  });

  it('preserves verified retrieval state without implying inspection or validation', () => {
    const candidates = resolveTrustedEvidence(runningPlan(), fallbackDatasets).roles.flatMap(role => role.candidates);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.find(item => item.resourceId === 'meteoswiss-pollen')?.status).toBe('retrievable');
    expect(candidates.find(item => item.resourceId === 'swisstopo-swissalti3d')?.status).toBe('metadata_resolved');
    expect(candidates.every(item => item.status !== 'inspected' && item.origin === 'system_inference')).toBe(true);
    expect(candidates.every(item => item.scope === 'national')).toBe(true);
    expect(candidates.every(item => !('compatible' in item) && !('validated' in item))).toBe(true);
    expect(providerById('meteoswiss')?.attribution).toBe('Source: MeteoSwiss');
    expect(providerById('swisstopo')?.attribution).toBe('© swisstopo');
    expect(resourceById('meteoswiss-pollen')?.notes.join(' ')).toContain('not a continuous exposure surface');
  });

  it('does not turn a known-source registry match into compatibility evidence', () => {
    const pollen = { ...resourceById('meteoswiss-pollen')!, status: 'known_source' as const };
    const candidate = resolveTrustedEvidence(runningPlan(), fallbackDatasets, [pollen]).roles
      .find(role => role.roleId === 'allergen_exposure')!.candidates[0];
    expect(candidate.status).toBe('known_source');
    expect(candidate).not.toHaveProperty('compatible');
    expect(candidate).not.toHaveProperty('validated');
  });

  it('keeps sparse local air-quality evidence visible as weak', () => {
    const air = resolveTrustedEvidence(runningPlan(), fallbackDatasets).roles.find(role => role.roleId === 'air_exposure')!;
    expect(air.localStatus).toBe('locally_weak');
    expect(air.localReason).toContain('fixed-station evidence');
  });

  it('suggests weather as optional context for the running question', () => {
    expect(resolveTrustedEvidence(runningPlan(), fallbackDatasets).supplemental.map(item => item.resourceId)).toContain('meteoswiss-weather');
  });

  it('can fill a missing public-service population denominator from BFS', () => {
    const useCase = BENCHMARK_USE_CASES.find(item => item.id === 'public_service_equity')!;
    const plan = buildEvidencePlan(parseUseCaseIntent(useCase.prompt), fallbackDatasets);
    const population = plan.roles.find(role => role.id === 'population_denominator')!;
    const withoutLocalPopulation = fallbackDatasets.filter(dataset => dataset.id !== population.datasetId);
    population.datasetId = undefined;
    const candidate = resolveTrustedEvidence(plan, withoutLocalPopulation).roles.find(role => role.roleId === 'population_denominator')!;
    expect(candidate.candidates.map(item => item.resourceId)).toContain('bfs-statpop');
  });

  it('does not add arbitrary sources to roles outside the curated mapping', () => {
    const plan = buildEvidencePlan(parseUseCaseIntent('Something about trees near streets'), fallbackDatasets);
    const resolution = resolveTrustedEvidence(plan, fallbackDatasets);
    expect(resolution.roles.flatMap(role => role.candidates)).toEqual([]);
  });

  it('leaves an unsupported missing role unresolved', () => {
    const plan = runningPlan();
    plan.roles.push({ id: 'perceived_route_comfort', label: 'Perceived route comfort', roleType: 'external_dependency', required: false, reason: 'User perception is not observed.', candidates: [], gap: { kind: 'not_in_catalogue' }, origin: 'system_inference' });
    const resolution = resolveTrustedEvidence(plan, fallbackDatasets);
    expect(resolution.unresolved.map(role => role.roleId)).toContain('perceived_route_comfort');
  });
});
