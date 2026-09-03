import { describe, expect, it } from 'vitest';
import { buildEvidencePlan, classifyEvidence } from './evidence';
import { parseUseCaseIntent } from './intent';
import { fallbackDatasets } from './data/fallback';
import { geometryClasses } from './geometry';
import { BENCHMARK_USE_CASES } from './benchmarks/useCases';
import type { DatasetRecord } from './types';

/**
 * Planning is tested against the frozen Basel snapshot rather than the live
 * catalogue: the assertions are about structure and semantics, and they must
 * not fail because a publisher renamed a dataset overnight.
 */
const datasets = fallbackDatasets;
const byId = new Map(datasets.map(dataset => [dataset.id, dataset] as const));

describe('buildEvidencePlan', () => {
  it.each(BENCHMARK_USE_CASES)('plans the $id benchmark', useCase => {
    const plan = buildEvidencePlan(parseUseCaseIntent(useCase.prompt), datasets);

    for (const expectation of useCase.roles) {
      const role = plan.roles.find(item => item.id === expectation.id);
      expect(role, `role ${expectation.id} missing from plan`).toBeDefined();
      expect(role!.roleType).toBe(expectation.roleType);
      expect(role!.required).toBe(expectation.required);

      if (expectation.expect === 'resolved') {
        expect(role!.datasetId, `role ${expectation.id} should resolve to a dataset`).toBeDefined();
        if (expectation.titlePattern) {
          expect(byId.get(role!.datasetId!)!.title).toMatch(new RegExp(expectation.titlePattern, 'i'));
        }
      }
      if (expectation.expect === 'gap') {
        expect(role!.datasetId, `role ${expectation.id} should stay unresolved`).toBeUndefined();
        expect(role!.gap).toBeDefined();
      }
    }
  });

  it('never proposes a dataset the catalogue publishes without records', () => {
    const empty = datasets.filter(dataset => dataset.recordsCount === 0 || !dataset.hasRecords);
    expect(empty.length, 'snapshot should contain at least one empty dataset').toBeGreaterThan(0);

    for (const useCase of BENCHMARK_USE_CASES) {
      const plan = buildEvidencePlan(parseUseCaseIntent(useCase.prompt), datasets);
      for (const role of plan.roles) {
        if (!role.datasetId) continue;
        expect(empty.some(dataset => dataset.id === role.datasetId)).toBe(false);
      }
    }
  });

  it('only fills a line-geometry backbone with a dataset that declares lines', () => {
    const plan = buildEvidencePlan(parseUseCaseIntent(BENCHMARK_USE_CASES[0].prompt), datasets);
    const backbone = plan.roles.find(role => role.id === 'route_geometry')!;
    if (backbone.datasetId) {
      const geometry = geometryClasses(byId.get(backbone.datasetId)!.characteristics.geometryTypes);
      expect(geometry).toContain('line');
    }
  });

  it('rejects a semantically perfect title that has no geometry, and says why', () => {
    // Baumkronenbedeckung is literally "tree canopy coverage" but publishes
    // three rows of raster download links, so it cannot carry a shade measure
    // that has to be intersected with a route.
    const plan = buildEvidencePlan(parseUseCaseIntent(BENCHMARK_USE_CASES[0].prompt), datasets);
    const shade = plan.roles.find(role => role.id === 'shade_exposure')!;
    expect(shade.datasetId).not.toBe('100357');
    const rejected = shade.candidates.find(candidate => candidate.datasetId === '100357');
    expect(rejected?.note).toMatch(/geometry/i);
  });

  it('reports pollen and elevation as gaps with an external suggestion', () => {
    const plan = buildEvidencePlan(parseUseCaseIntent(BENCHMARK_USE_CASES[0].prompt), datasets);
    const pollen = plan.roles.find(role => role.id === 'allergen_exposure')!;
    expect(pollen.roleType).toBe('external_dependency');
    expect(pollen.datasetId).toBeUndefined();
    expect(pollen.gap?.suggestion).toBeTruthy();

    expect(plan.externalDependencies.map(role => role.id)).toContain('elevation_context');
  });

  it('marks every proposed role as system inference, never as a source fact', () => {
    const plan = buildEvidencePlan(parseUseCaseIntent(BENCHMARK_USE_CASES[0].prompt), datasets);
    expect(plan.roles.every(role => role.origin === 'system_inference')).toBe(true);
  });

  it('lets a workspace selection outrank the system proposal', () => {
    const intent = parseUseCaseIntent(BENCHMARK_USE_CASES[0].prompt);
    const base = buildEvidencePlan(intent, datasets);
    const shade = base.roles.find(role => role.id === 'shade_exposure')!;
    const alternative = shade.candidates.find(
      candidate => candidate.datasetId !== shade.datasetId && candidate.datasetId !== '100357',
    );
    expect(alternative, 'expected an alternative canopy candidate in the snapshot').toBeDefined();

    const pinned = buildEvidencePlan(intent, datasets, { selectedIds: [alternative!.datasetId] });
    expect(pinned.roles.find(role => role.id === 'shade_exposure')!.datasetId).toBe(alternative!.datasetId);
  });

  it('falls back to context-only roles when no method template matches', () => {
    const plan = buildEvidencePlan(parseUseCaseIntent('Something about trees near streets'), datasets);
    expect(plan.roles.length).toBeGreaterThan(0);
    expect(plan.roles.every(role => role.roleType === 'context' || role.roleType === 'geography')).toBe(true);
  });
});

describe('classifyEvidence', () => {
  const intent = parseUseCaseIntent(BENCHMARK_USE_CASES[0].prompt);
  const plan = buildEvidencePlan(intent, datasets);

  it('calls a dataset filling a required role direct evidence', () => {
    const required = plan.roles.find(role => role.required && role.datasetId)!;
    expect(classifyEvidence(required.datasetId!, plan).evidenceClass).toBe('direct');
  });

  it('calls a dataset filling only an optional role supporting', () => {
    const optional = plan.roles.find(
      role => !role.required && role.datasetId && !plan.roles.some(other => other.required && other.datasetId === role.datasetId),
    );
    if (optional) expect(classifyEvidence(optional.datasetId!, plan).evidenceClass).toBe('supporting');
  });

  it('calls an unassigned dataset contextual', () => {
    const unassigned = datasets.find(
      (dataset: DatasetRecord) => !plan.roles.some(role => role.datasetId === dataset.id),
    )!;
    expect(classifyEvidence(unassigned.id, plan).evidenceClass).toBe('contextual');
  });
});
