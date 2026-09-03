import { describe, expect, it } from 'vitest';
import { assessCompatibility } from '../compatibility';
import { FallbackCatalogueAdapter } from '../data/fallback';
import { DEFAULT_NEAREST_METERS, MAX_FEATURES, operationId, planAggregate, planOperation } from './operations';
import type { NearestParameters, SpatialJoinParameters } from './types';

const adapter = new FallbackCatalogueAdapter();
const structure = (id: string) => adapter.inspectDataset(id);

// 100008 fountains (Point) x 100252 Tempo-30 zones (Polygon)
// 100052 trees (Point)    x 100032 cycle routes (LineString)
// 100357 canopy (no geometry)

describe('planOperation', () => {
  it('derives a containment join from a spatial_join assessment', async () => {
    const [left, right] = await Promise.all([structure('100008'), structure('100252')]);
    const assessment = assessCompatibility(left, right);
    expect(assessment.relation).toBe('spatial_join');

    const plan = planOperation(assessment, left, right);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;

    expect(plan.operation.type).toBe('spatial_join');
    // The operation must name the assessment that justified it.
    expect(plan.operation.assessmentId).toBe(assessment.id);
    expect(plan.operation.createdFrom).toBe('compatibility_assessment');
    expect(plan.operation.expectedRelation).toBe('spatial_join');

    const params = plan.operation.parameters as unknown as SpatialJoinParameters;
    expect(params.sourceDatasetId).toBe('100008');
    expect(params.targetDatasetId).toBe('100252');
    expect(params.maxFeatures).toBe(MAX_FEATURES);
  });

  it('carries the structure fingerprints the assessment was computed from', async () => {
    const [left, right] = await Promise.all([structure('100008'), structure('100252')]);
    const assessment = assessCompatibility(left, right);
    const plan = planOperation(assessment, left, right);
    if (!plan.ok) throw new Error(plan.reason);

    const source = plan.operation.inputs.find(i => i.datasetId === '100008')!;
    expect(source.structureRef).toBe(assessment.leftStructureRef);
    expect(source.role).toBe('source');
  });

  it('orients points against areas whichever way the assessment is written', async () => {
    const [points, areas] = await Promise.all([structure('100008'), structure('100252')]);
    const reversed = assessCompatibility(areas, points);
    const plan = planOperation(reversed, areas, points);
    if (!plan.ok) throw new Error(plan.reason);

    const params = plan.operation.parameters as unknown as SpatialJoinParameters;
    // Containment always tests the points, never the polygons.
    expect(params.sourceDatasetId).toBe('100008');
    expect(params.targetDatasetId).toBe('100252');
  });

  it('derives a nearest operation with an explicit distance threshold', async () => {
    const [left, right] = await Promise.all([structure('100052'), structure('100032')]);
    const assessment = assessCompatibility(left, right);
    expect(assessment.relation).toBe('nearest');

    const plan = planOperation(assessment, left, right);
    if (!plan.ok) throw new Error(plan.reason);

    expect(plan.operation.type).toBe('nearest');
    const params = plan.operation.parameters as unknown as NearestParameters;
    // The compatibility engine only warns that a threshold is needed; this is
    // where one is actually chosen, and it is on the record.
    expect(params.maxDistanceMeters).toBe(DEFAULT_NEAREST_METERS);
    expect(params.minCoverage).toBeGreaterThan(0);
  });

  it('honours an overridden threshold', async () => {
    const [left, right] = await Promise.all([structure('100052'), structure('100032')]);
    const assessment = assessCompatibility(left, right);
    const plan = planOperation(assessment, left, right, { maxDistanceMeters: 250 });
    if (!plan.ok) throw new Error(plan.reason);
    expect((plan.operation.parameters as unknown as NearestParameters).maxDistanceMeters).toBe(250);
  });

  it('refuses when a side has no geometry', async () => {
    const [left, right] = await Promise.all([structure('100357'), structure('100032')]);
    const assessment = assessCompatibility(left, right);
    const plan = planOperation(assessment, left, right);

    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.reason).toMatch(/no geometry/i);
  });

  it('refuses relations this milestone cannot execute, rather than running something adjacent', async () => {
    const [left, right] = await Promise.all([structure('100050'), structure('100189')]);
    const assessment = assessCompatibility(left, right);
    expect(assessment.relation).toBe('interpolation_required');

    const plan = planOperation(assessment, left, right);
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.reason).toMatch(/not executable/i);
  });

  it('allows executing an incompatible verdict, so the negative gets verified too', async () => {
    const [left, right] = await Promise.all([structure('100048'), structure('100032')]);
    const assessment = assessCompatibility(left, right);
    expect(assessment.relation).toBe('incompatible');

    const plan = planOperation(assessment, left, right);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.operation.expectedRelation).toBe('incompatible');
  });

  it('refuses structures that are not the ones the assessment refers to', async () => {
    const [left, right, other] = await Promise.all([structure('100008'), structure('100252'), structure('100052')]);
    const assessment = assessCompatibility(left, right);
    const plan = planOperation(assessment, left, other);

    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.reason).toMatch(/not the ones this assessment refers to/i);
  });

  it('gives identical plans an identical id', async () => {
    const [left, right] = await Promise.all([structure('100008'), structure('100252')]);
    const assessment = assessCompatibility(left, right);
    const a = planOperation(assessment, left, right, { now: '2026-01-01T00:00:00.000Z' });
    const b = planOperation(assessment, left, right, { now: '2026-06-01T00:00:00.000Z' });
    if (!a.ok || !b.ok) throw new Error('expected both plans to succeed');

    // Content-derived: the wall clock is not part of the identity.
    expect(a.operation.id).toBe(b.operation.id);
    expect(a.operation.id).toMatch(/^OPR-/);
  });

  it('changes the operation id when a parameter changes', async () => {
    const [left, right] = await Promise.all([structure('100052'), structure('100032')]);
    const assessment = assessCompatibility(left, right);
    const a = planOperation(assessment, left, right, { maxDistanceMeters: 50 });
    const b = planOperation(assessment, left, right, { maxDistanceMeters: 250 });
    if (!a.ok || !b.ok) throw new Error('expected both plans to succeed');
    expect(a.operation.id).not.toBe(b.operation.id);
  });
});

describe('planAggregate', () => {
  it('refuses to aggregate a failed execution', () => {
    const plan = planAggregate({
      id: 'EXE-x',
      operationId: 'OPR-x',
      assessmentId: 'CMP-x',
      status: 'failed',
      startedAt: '',
      completedAt: '',
      sourceSnapshots: [],
      evidenceLevel: 'execution_validated',
      validation: { originalRelation: 'spatial_join', confirmed: false, reasons: [], warnings: [] },
      engine: { name: 'x', version: '1' },
    });
    expect(plan.ok).toBe(false);
  });
});

describe('operationId', () => {
  it('ignores createdAt so replanning is idempotent', () => {
    const base = {
      type: 'spatial_join' as const,
      assessmentId: 'CMP-1',
      inputs: [],
      parameters: { a: 1 },
      expectedRelation: 'spatial_join' as const,
      createdFrom: 'compatibility_assessment' as const,
    };
    expect(operationId({ ...base, createdAt: 'a' })).toBe(operationId({ ...base, createdAt: 'b' }));
  });
});
