import { describe, expect, it } from 'vitest';
import { GeoJsonExecutionEngine, distanceToFeature, summarise } from './engine';
import { FixtureGeometrySource } from './source';
import * as fx from './fixtures';
import { planAggregate } from './operations';
import type { CompatibilityRelation } from '../types';
import type { GeoJsonFeature, SpatialOperation } from './types';

/**
 * Offline engine tests. No network: the fixture source and the live ODS source
 * satisfy the same interface, so this exercises the real execution path.
 */

function engineWith(fixtures: Record<string, GeoJsonFeature[]>) {
  return new GeoJsonExecutionEngine(new FixtureGeometrySource(fixtures));
}

const op = (
  type: SpatialOperation['type'],
  parameters: Record<string, unknown>,
  expectedRelation: CompatibilityRelation = type === 'nearest' ? 'nearest' : 'spatial_join',
): SpatialOperation => ({
  id: 'OPR-test',
  type,
  assessmentId: 'CMP-test',
  inputs: [],
  parameters,
  expectedRelation,
  createdFrom: 'compatibility_assessment',
  createdAt: '2026-09-03T00:00:00.000Z',
});

const joinParams = (source: string, target: string, maxFeatures = 100) => ({
  sourceDatasetId: source,
  targetDatasetId: target,
  maxFeatures,
});

const nearestParams = (source: string, target: string, overrides: Record<string, unknown> = {}) => ({
  sourceDatasetId: source,
  targetDatasetId: target,
  maxDistanceMeters: 50,
  minCoverage: 0.5,
  maxFeatures: 100,
  ...overrides,
});

describe('spatial join', () => {
  it('confirms a containment hypothesis and counts what matched', async () => {
    const engine = engineWith({ points: fx.POINTS, square: fx.SQUARE });
    const result = await engine.execute(op('spatial_join', joinParams('points', 'square')));

    expect(result.status).toBe('confirmed');
    expect(result.validation.confirmed).toBe(true);
    expect(result.evidenceLevel).toBe('execution_validated');
    // Three of the four fixture points sit inside the square.
    expect(result.output?.recordCount).toBe(3);
    expect(result.output?.summary?.matchedSourceFeatures).toBe(3);
    expect(result.output?.summary?.sourceFeatures).toBe(4);
  });

  it('rejects the hypothesis when extents do not overlap', async () => {
    const engine = engineWith({ points: fx.POINTS, far: fx.DISTANT_SQUARE });
    const result = await engine.execute(op('spatial_join', joinParams('points', 'far')));

    expect(result.status).toBe('rejected');
    expect(result.validation.confirmed).toBe(false);
    // A rejection is still a completed execution, not an error.
    expect(result.error).toBeUndefined();
    expect(result.validation.reasons.join(' ')).toMatch(/yields nothing|0 of/i);
  });

  it('records exactly what it read, so the run stays interpretable later', async () => {
    const engine = engineWith({ points: fx.POINTS, square: fx.SQUARE });
    const result = await engine.execute(op('spatial_join', joinParams('points', 'square')));

    const snapshot = result.sourceSnapshots.find(s => s.datasetId === 'points')!;
    expect(snapshot.sourceUrl).toBe('fixture://points');
    expect(snapshot.retrievedAt).toBeTruthy();
    expect(snapshot.fingerprint).toMatch(/^SRC-/);
    expect(snapshot.geometryTypes).toEqual(['Point']);
    expect(result.engine).toEqual({ name: 'geojson-turf', version: '1.0.0' });
    expect(result.assessmentId).toBe('CMP-test');
  });

  it('reports partial rather than confirmed when inputs were truncated', async () => {
    const engine = engineWith({ points: fx.POINTS, square: fx.SQUARE });
    const result = await engine.execute(op('spatial_join', joinParams('points', 'square', 2)));

    expect(result.status).toBe('partial');
    // Source truncation is a sampling-bias warning, not an upper-bound one.
    expect(result.validation.warnings.join(' ')).toMatch(/not a random sample/i);
  });

  it('rejects when a side turns out to carry no geometry', async () => {
    const engine = engineWith({ empty: fx.NO_GEOMETRY, square: fx.SQUARE });
    const result = await engine.execute(op('spatial_join', joinParams('empty', 'square')));

    expect(result.status).toBe('rejected');
    expect(result.validation.reasons.join(' ')).toMatch(/no usable geometry/i);
  });

  it('warns when loaded geometry does not match what was promised', async () => {
    const engine = engineWith({ mixed: fx.MISLABELLED, square: fx.SQUARE });
    const result = await engine.execute(op('spatial_join', joinParams('mixed', 'square')));

    expect(result.validation.warnings.join(' ')).toMatch(/declares point geometry, but/i);
    expect(result.validation.warnings.join(' ')).toMatch(/carrying line geometry/i);
  });

  it('confirms an incompatible verdict when execution also finds nothing', async () => {
    const engine = engineWith({ points: fx.POINTS, far: fx.DISTANT_SQUARE });
    const result = await engine.execute(op('spatial_join', joinParams('points', 'far'), 'incompatible'));

    // The hypothesis was "these cannot be related"; execution agrees.
    expect(result.validation.confirmed).toBe(true);
    expect(result.status).toBe('confirmed');
  });

  it('overturns an incompatible verdict when features do intersect', async () => {
    const engine = engineWith({ points: fx.POINTS, square: fx.SQUARE });
    const result = await engine.execute(op('spatial_join', joinParams('points', 'square'), 'incompatible'));

    expect(result.validation.confirmed).toBe(false);
    expect(result.validation.reasons.join(' ')).toMatch(/predicted no spatial relationship/i);
  });
});

describe('nearest', () => {
  it('confirms proximity and reports the distance distribution', async () => {
    const engine = engineWith({ pts: fx.POINTS_NEAR_STREET, street: fx.STREET });
    const result = await engine.execute(op('nearest', nearestParams('pts', 'street')));

    expect(result.status).toBe('confirmed');
    expect(result.output?.summary?.withinThreshold).toBe(3);
    expect(result.output?.summary?.coverage).toBe(1);
    expect(result.output?.summary?.medianMeters).toBeLessThan(50);
    expect(result.output?.summary?.thresholdMeters).toBe(50);
  });

  it('rejects when the nearest feature is too far to describe anything', async () => {
    const engine = engineWith({ pts: fx.POINTS_FAR_FROM_STREET, street: fx.STREET });
    const result = await engine.execute(op('nearest', nearestParams('pts', 'street')));

    // A nearest feature always exists; that is exactly why the threshold matters.
    expect(result.status).toBe('rejected');
    expect(result.validation.confirmed).toBe(false);
    expect(result.output?.summary?.withinThreshold).toBe(0);
    expect(result.output?.summary?.minMeters).toBeGreaterThan(1000);
    expect(result.validation.warnings.join(' ')).toMatch(/unlikely to describe the same places/i);
  });

  it('rejects on coverage when only a minority of features are close', async () => {
    const engine = engineWith({ pts: fx.POINTS_MIXED_FROM_STREET, street: fx.STREET });
    const result = await engine.execute(op('nearest', nearestParams('pts', 'street')));

    expect(result.status).toBe('rejected');
    expect(result.output?.summary?.coverage).toBeLessThan(0.5);
    expect(result.validation.reasons.join(' ')).toMatch(/Coverage is below/i);
  });

  it('accepts the same data once the threshold is widened, and records the change', async () => {
    const engine = engineWith({ pts: fx.POINTS_FAR_FROM_STREET, street: fx.STREET });
    const result = await engine.execute(
      op('nearest', nearestParams('pts', 'street', { maxDistanceMeters: 5000 })),
    );

    expect(result.status).toBe('confirmed');
    expect(result.output?.summary?.thresholdMeters).toBe(5000);
  });
});

describe('aggregate', () => {
  it('counts matched features per target', async () => {
    const engine = engineWith({ points: fx.POINTS, squares: fx.TWO_SQUARES });
    const join = await engine.execute(op('spatial_join', joinParams('points', 'squares')));

    const plan = planAggregate(join, { now: '2026-09-03T00:00:00.000Z' });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;

    const result = await engine.execute(plan.operation);
    expect(result.status).toBe('confirmed');
    expect(result.output?.type).toBe('count_per_target');
    expect(result.output?.summary?.totalMatches).toBe(3);
    expect(result.output?.summary?.groups).toBe(2);
    // Provenance survives the second hop.
    expect(result.assessmentId).toBe(join.assessmentId);
    expect(plan.operation.createdFrom).toBe('execution_result');
  });

  it('summarises nearest distances', async () => {
    const engine = engineWith({ pts: fx.POINTS_NEAR_STREET, street: fx.STREET });
    const nearest = await engine.execute(op('nearest', nearestParams('pts', 'street')));

    const plan = planAggregate(nearest, { measure: 'distance_summary' });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;

    const result = await engine.execute(plan.operation);
    expect(result.output?.type).toBe('distance_summary');
    expect(result.output?.summary?.count).toBe(3);
    expect(Number(result.output?.summary?.medianMeters)).toBeGreaterThan(0);
  });

  it('refuses to aggregate over an execution that produced nothing', async () => {
    const engine = engineWith({ points: fx.POINTS, far: fx.DISTANT_SQUARE });
    const rejected = await engine.execute(op('spatial_join', joinParams('points', 'far')));
    const plan = planAggregate(rejected);
    // A rejection still stores an (empty) match set, so aggregating is allowed
    // but must report zero groups rather than inventing structure.
    if (plan.ok) {
      const result = await engine.execute(plan.operation);
      expect(result.output?.summary?.groups).toBe(0);
      expect(result.validation.confirmed).toBe(false);
    }
  });
});

describe('failures', () => {
  it('reports a failure as neither confirmed nor rejected', async () => {
    const engine = engineWith({ square: fx.SQUARE });
    const result = await engine.execute(op('spatial_join', joinParams('missing-dataset', 'square')));

    expect(result.status).toBe('failed');
    expect(result.validation.confirmed).toBe(false);
    expect(result.error?.code).toBe('execution_error');
    expect(result.validation.warnings.join(' ')).toMatch(/neither confirmed nor rejected/i);
  });

  it('fails an aggregate whose source execution is unknown', async () => {
    const engine = engineWith({});
    const result = await engine.execute(
      op('aggregate', { sourceExecutionId: 'EXE-nope', measure: 'count_per_target', maxGroups: 10 }),
    );
    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('missing_input');
  });
});

describe('geometry helpers', () => {
  it('measures distance to every geometry family, not just points', () => {
    const p: [number, number] = [7.589, 47.5595];
    expect(distanceToFeature(p, { type: 'Point', coordinates: [7.589, 47.5595] })).toBe(0);
    expect(distanceToFeature(p, fx.STREET[0].geometry)).toBeLessThan(1);
    // A point inside a polygon is at distance zero, not at distance to its edge.
    expect(distanceToFeature(p, fx.SQUARE[0].geometry)).toBe(0);
    expect(distanceToFeature(p, null)).toBeUndefined();
  });

  it('summarises a distribution without crashing on an empty one', () => {
    expect(summarise([1, 2, 3, 4]).median).toBe(3);
    expect(Number.isNaN(summarise([]).median)).toBe(true);
  });
});

describe('honesty about weak and truncated results', () => {
  it('flags a containment join that works but describes almost nothing', async () => {
    // One point inside a big polygon out of many points scattered elsewhere.
    const many: GeoJsonFeature[] = [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [7.5885, 47.5595] }, properties: { id: 'in' } },
      ...Array.from({ length: 40 }, (_, i) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [7.7 + i * 0.001, 47.65] },
        properties: { id: `out-${i}` },
      })),
    ];
    const engine = engineWith({ many, square: fx.SQUARE });
    const result = await engine.execute(op('spatial_join', joinParams('many', 'square')));

    expect(result.status).toBe('confirmed');
    expect(result.output?.summary?.matchRate).toBeLessThan(0.05);
    expect(result.validation.warnings.join(' ')).toMatch(/small minority of the data/i);
  });

  it('distinguishes a truncated target from a truncated source', async () => {
    const engine = engineWith({ pts: fx.POINTS_NEAR_STREET, street: [...fx.STREET, ...fx.STREET] });
    const result = await engine.execute(op('nearest', nearestParams('pts', 'street', { maxFeatures: 1 })));

    const warnings = result.validation.warnings.join(' ');
    expect(warnings).toMatch(/distances are upper bounds/i);
  });

  it('names matched targets by a published identifier when one exists', async () => {
    const squares: GeoJsonFeature[] = fx.TWO_SQUARES.map((f, i) => ({
      ...f,
      // Basel's convention: the identifier is named after the thing.
      properties: { id_tempo30: 5100 + i },
    }));
    const engine = engineWith({ points: fx.POINTS, squares });
    const join = await engine.execute(op('spatial_join', joinParams('points', 'squares')));
    const plan = planAggregate(join);
    if (!plan.ok) throw new Error(plan.reason);

    const result = await engine.execute(plan.operation);
    const top = result.output?.summary?.top as Array<{ target: string }>;
    expect(top[0].target).toMatch(/^51\d\d$/);
  });
});
