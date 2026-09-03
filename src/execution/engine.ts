import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import distance from '@turf/distance';
import pointToLineDistance from '@turf/point-to-line-distance';
import { canonicalJson, hashString } from '../fingerprint';
import type {
  AggregateParameters,
  ExecutionEngine,
  ExecutionResult,
  ExecutionStatus,
  GeoJsonFeature,
  GeoJsonGeometry,
  GeometrySource,
  LoadedFeatures,
  NearestParameters,
  SourceSnapshot,
  SpatialJoinParameters,
  SpatialOperation,
} from './types';

/**
 * Deterministic GeoJSON execution engine.
 *
 * Runs Turf predicates over GeoJSON in-process — the same code path in the
 * browser and in vitest, no server and no WASM. Everything ODS serves is
 * already GeoJSON in WGS84, so there is no conversion step to get wrong.
 *
 * The engine's job is to *test* a hypothesis, not to satisfy it. A run that
 * produces no matches is a successful execution reporting a rejected
 * hypothesis, and is reported as such.
 */

export const ENGINE_NAME = 'geojson-turf';
export const ENGINE_VERSION = '1.0.0';

/** Everything ODS Explore v2.1 serves is WGS84 lon/lat. Distances are geodesic. */
export const ASSUMED_CRS = 'EPSG:4326';

/** Matches held for a later aggregate. In-memory only; no persistence yet. */
export interface MatchRecord {
  sourceIndex: number;
  targetIndex: number;
  targetKey: string;
  distanceMeters?: number;
}

export interface Artifact {
  matches: MatchRecord[];
  sourceCount: number;
  targetCount: number;
}

export class GeoJsonExecutionEngine implements ExecutionEngine {
  readonly name = ENGINE_NAME;
  readonly version = ENGINE_VERSION;

  /** Outputs of previous executions, so an aggregate can reference them. */
  private artifacts = new Map<string, Artifact>();

  constructor(private readonly source: GeometrySource) {}

  getArtifact(ref: string): Artifact | undefined {
    return this.artifacts.get(ref);
  }

  async execute(operation: SpatialOperation): Promise<ExecutionResult> {
    const startedAt = new Date().toISOString();
    try {
      switch (operation.type) {
        case 'spatial_join':
          return await this.executeSpatialJoin(operation, startedAt);
        case 'nearest':
          return await this.executeNearest(operation, startedAt);
        case 'aggregate':
          return this.executeAggregate(operation, startedAt);
        default:
          return this.fail(operation, startedAt, 'unsupported_operation', `Unknown operation type.`);
      }
    } catch (error) {
      return this.fail(
        operation,
        startedAt,
        'execution_error',
        error instanceof Error ? error.message : 'Unknown execution error',
      );
    }
  }

  // -------------------------------------------------------------------------
  // Spatial join / within
  // -------------------------------------------------------------------------

  private async executeSpatialJoin(operation: SpatialOperation, startedAt: string): Promise<ExecutionResult> {
    const params = operation.parameters as unknown as SpatialJoinParameters;
    const [source, target] = await Promise.all([
      this.source.load(params.sourceDatasetId, { maxFeatures: params.maxFeatures }),
      this.source.load(params.targetDatasetId, { maxFeatures: params.maxFeatures }),
    ]);

    const reasons: string[] = [];
    const warnings: string[] = [];

    const points = source.features.filter(f => geometryFamily(f.geometry) === 'point');
    const areas = target.features.filter(f => geometryFamily(f.geometry) === 'polygon');

    // Execution checks what the declared types promised.
    noteGeometryDrift(source, 'point', points.length, warnings);
    noteGeometryDrift(target, 'polygon', areas.length, warnings);

    if (!points.length || !areas.length) {
      return this.finish(operation, startedAt, [snapshot(source, points), snapshot(target, areas)], 'rejected', {
        originalRelation: operation.expectedRelation,
        confirmed: operation.expectedRelation === 'incompatible',
        reasons: [
          `After loading, one side had no usable geometry (${points.length} point features, ${areas.length} area features).`,
        ],
        warnings,
      });
    }

    const matches: MatchRecord[] = [];
    points.forEach((point, sourceIndex) => {
      const coords = pointCoords(point.geometry);
      if (!coords) return;
      areas.forEach((area, targetIndex) => {
        if (!area.geometry) return;
        if (booleanPointInPolygon(coords, area.geometry as never)) {
          matches.push({ sourceIndex, targetIndex, targetKey: featureKey(area, targetIndex) });
        }
      });
    });

    const matchedSources = new Set(matches.map(m => m.sourceIndex)).size;
    const matchedTargets = new Set(matches.map(m => m.targetKey)).size;

    reasons.push(
      `${matches.length} containment matches: ${matchedSources} of ${points.length} source features fell inside ${matchedTargets} of ${areas.length} areas.`,
    );

    const confirmed = operation.expectedRelation === 'incompatible' ? matches.length === 0 : matches.length > 0;
    if (!confirmed && operation.expectedRelation !== 'incompatible') {
      reasons.push('No source feature fell inside any area, so the proposed containment join yields nothing.');
    }
    if (operation.expectedRelation === 'incompatible' && matches.length > 0) {
      reasons.push('The assessment predicted no spatial relationship, but features do intersect.');
    }

    const truncated = source.truncated || target.truncated;
    if (truncated) {
      warnings.push(
        'Inputs were truncated to the feature budget, so counts are a lower bound and coverage is not exhaustive.',
      );
    }

    const artifactRef = this.storeArtifact(operation, { matches, sourceCount: points.length, targetCount: areas.length });

    return this.finish(
      operation,
      startedAt,
      [snapshot(source, points), snapshot(target, areas)],
      confirmed ? (truncated ? 'partial' : 'confirmed') : 'rejected',
      { originalRelation: operation.expectedRelation, confirmed, reasons, warnings },
      {
        type: 'match_set',
        recordCount: matches.length,
        artifactRef,
        summary: {
          sourceFeatures: points.length,
          targetFeatures: areas.length,
          matchedSourceFeatures: matchedSources,
          matchedTargetFeatures: matchedTargets,
          crs: ASSUMED_CRS,
        },
      },
    );
  }

  // -------------------------------------------------------------------------
  // Nearest
  // -------------------------------------------------------------------------

  private async executeNearest(operation: SpatialOperation, startedAt: string): Promise<ExecutionResult> {
    const params = operation.parameters as unknown as NearestParameters;
    const [source, target] = await Promise.all([
      this.source.load(params.sourceDatasetId, { maxFeatures: params.maxFeatures }),
      this.source.load(params.targetDatasetId, { maxFeatures: params.maxFeatures }),
    ]);

    const reasons: string[] = [];
    const warnings: string[] = [];

    const points = source.features.filter(f => geometryFamily(f.geometry) === 'point');
    const targets = target.features.filter(f => f.geometry !== null);
    noteGeometryDrift(source, 'point', points.length, warnings);

    if (!points.length || !targets.length) {
      return this.finish(operation, startedAt, [snapshot(source, points), snapshot(target, targets)], 'rejected', {
        originalRelation: operation.expectedRelation,
        confirmed: operation.expectedRelation === 'incompatible',
        reasons: [`After loading, there was nothing to compare (${points.length} points, ${targets.length} targets).`],
        warnings,
      });
    }

    const matches: MatchRecord[] = [];
    const distances: number[] = [];

    points.forEach((point, sourceIndex) => {
      const coords = pointCoords(point.geometry);
      if (!coords) return;
      let best: { index: number; metres: number } | undefined;
      targets.forEach((candidate, targetIndex) => {
        const metres = distanceToFeature(coords, candidate.geometry);
        if (metres === undefined) return;
        if (!best || metres < best.metres) best = { index: targetIndex, metres };
      });
      if (!best) return;
      distances.push(best.metres);
      if (best.metres <= params.maxDistanceMeters) {
        matches.push({
          sourceIndex,
          targetIndex: best.index,
          targetKey: featureKey(targets[best.index], best.index),
          distanceMeters: best.metres,
        });
      }
    });

    const stats = summarise(distances);
    const coverage = distances.length ? matches.length / distances.length : 0;

    reasons.push(
      `Nearest distances over ${distances.length} source features: min ${fmt(stats.min)} m, median ${fmt(stats.median)} m, p90 ${fmt(stats.p90)} m, max ${fmt(stats.max)} m.`,
    );
    reasons.push(
      `${matches.length} of ${distances.length} (${(coverage * 100).toFixed(1)}%) fell within the ${params.maxDistanceMeters} m threshold.`,
    );

    // The hypothesis is that these datasets relate by proximity. It fails when
    // most features have no neighbour close enough to describe them, however
    // dutifully a nearest feature can always be found.
    const meetsCoverage = coverage >= params.minCoverage;
    const confirmed = operation.expectedRelation === 'incompatible' ? !meetsCoverage : meetsCoverage;

    if (!meetsCoverage) {
      reasons.push(
        `Coverage is below the ${(params.minCoverage * 100).toFixed(0)}% required, so a nearest join would describe a minority of the data.`,
      );
    }
    if (stats.median > params.maxDistanceMeters * 4) {
      warnings.push(
        `The median nearest distance (${fmt(stats.median)} m) is far beyond the threshold; the two layers are unlikely to describe the same places.`,
      );
    }

    const truncated = source.truncated || target.truncated;
    if (truncated) {
      warnings.push(
        'Inputs were truncated to the feature budget; the true nearest feature may lie outside the loaded subset, so distances are an upper bound.',
      );
    }

    const artifactRef = this.storeArtifact(operation, {
      matches,
      sourceCount: points.length,
      targetCount: targets.length,
    });

    return this.finish(
      operation,
      startedAt,
      [snapshot(source, points), snapshot(target, targets)],
      confirmed ? (truncated ? 'partial' : 'confirmed') : 'rejected',
      { originalRelation: operation.expectedRelation, confirmed, reasons, warnings },
      {
        type: 'nearest_set',
        recordCount: matches.length,
        artifactRef,
        summary: {
          sourceFeatures: points.length,
          targetFeatures: targets.length,
          withinThreshold: matches.length,
          coverage: Number(coverage.toFixed(4)),
          thresholdMeters: params.maxDistanceMeters,
          minMeters: round(stats.min),
          medianMeters: round(stats.median),
          p90Meters: round(stats.p90),
          maxMeters: round(stats.max),
          crs: ASSUMED_CRS,
        },
      },
    );
  }

  // -------------------------------------------------------------------------
  // Aggregate
  // -------------------------------------------------------------------------

  private executeAggregate(operation: SpatialOperation, startedAt: string): ExecutionResult {
    const params = operation.parameters as unknown as AggregateParameters;
    const artifact = this.artifacts.get(artifactRefFor(params.sourceExecutionId));

    if (!artifact) {
      return this.fail(
        operation,
        startedAt,
        'missing_input',
        `No stored match set for execution ${params.sourceExecutionId}.`,
      );
    }

    const reasons: string[] = [];
    const warnings: string[] = [];

    if (params.measure === 'count_per_target') {
      const counts = new Map<string, number>();
      for (const match of artifact.matches) counts.set(match.targetKey, (counts.get(match.targetKey) ?? 0) + 1);
      const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
      const shown = ranked.slice(0, params.maxGroups);
      if (ranked.length > params.maxGroups) {
        warnings.push(`${ranked.length} groups exist; the ${params.maxGroups} largest are reported.`);
      }
      const values = ranked.map(([, count]) => count);
      reasons.push(`${artifact.matches.length} matches across ${ranked.length} target features.`);

      return this.finish(
        operation,
        startedAt,
        [],
        ranked.length ? 'confirmed' : 'rejected',
        { originalRelation: operation.expectedRelation, confirmed: ranked.length > 0, reasons, warnings },
        {
          type: 'count_per_target',
          recordCount: ranked.length,
          summary: {
            groups: ranked.length,
            totalMatches: artifact.matches.length,
            targetsWithNoMatch: artifact.targetCount - ranked.length,
            max: values[0] ?? 0,
            median: round(summarise(values).median),
            top: shown.slice(0, 10).map(([key, count]) => ({ target: key, count })),
          },
        },
      );
    }

    const distances = artifact.matches
      .map(match => match.distanceMeters)
      .filter((value): value is number => typeof value === 'number');
    if (!distances.length) {
      return this.fail(operation, startedAt, 'missing_input', 'The stored match set carries no distances.');
    }
    const stats = summarise(distances);
    reasons.push(`Distance summary over ${distances.length} matched features.`);

    return this.finish(
      operation,
      startedAt,
      [],
      'confirmed',
      { originalRelation: operation.expectedRelation, confirmed: true, reasons, warnings },
      {
        type: 'distance_summary',
        recordCount: distances.length,
        summary: {
          count: distances.length,
          minMeters: round(stats.min),
          medianMeters: round(stats.median),
          p90Meters: round(stats.p90),
          maxMeters: round(stats.max),
          meanMeters: round(stats.mean),
        },
      },
    );
  }

  // -------------------------------------------------------------------------

  private storeArtifact(operation: SpatialOperation, artifact: Artifact): string {
    const ref = artifactRefFor(executionIdFor(operation));
    this.artifacts.set(ref, artifact);
    return ref;
  }

  private finish(
    operation: SpatialOperation,
    startedAt: string,
    sourceSnapshots: SourceSnapshot[],
    status: ExecutionStatus,
    validation: ExecutionResult['validation'],
    output?: ExecutionResult['output'],
  ): ExecutionResult {
    return {
      id: executionIdFor(operation),
      operationId: operation.id,
      assessmentId: operation.assessmentId,
      status,
      startedAt,
      completedAt: new Date().toISOString(),
      sourceSnapshots,
      output,
      evidenceLevel: 'execution_validated',
      validation,
      engine: { name: this.name, version: this.version },
    };
  }

  private fail(
    operation: SpatialOperation,
    startedAt: string,
    code: string,
    message: string,
  ): ExecutionResult {
    return {
      ...this.finish(operation, startedAt, [], 'failed', {
        originalRelation: operation.expectedRelation,
        // A failure proves nothing either way; it must never read as a rejection.
        confirmed: false,
        reasons: [],
        warnings: ['Execution failed, so the compatibility hypothesis is neither confirmed nor rejected.'],
      }),
      error: { code, message },
    };
  }
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

export function geometryFamily(geometry: GeoJsonGeometry | null): 'point' | 'line' | 'polygon' | 'other' | 'none' {
  if (!geometry) return 'none';
  switch (geometry.type) {
    case 'Point':
    case 'MultiPoint':
      return 'point';
    case 'LineString':
    case 'MultiLineString':
      return 'line';
    case 'Polygon':
    case 'MultiPolygon':
      return 'polygon';
    default:
      return 'other';
  }
}

function pointCoords(geometry: GeoJsonGeometry | null): [number, number] | undefined {
  if (!geometry) return undefined;
  if (geometry.type === 'Point') return [geometry.coordinates[0], geometry.coordinates[1]];
  if (geometry.type === 'MultiPoint' && geometry.coordinates.length) {
    return [geometry.coordinates[0][0], geometry.coordinates[0][1]];
  }
  return undefined;
}

/**
 * Geodesic distance in metres from a point to any geometry.
 *
 * Turf's pointToLineDistance takes a single LineString, so multi-part and area
 * geometries are decomposed here rather than silently skipped.
 */
export function distanceToFeature(
  point: [number, number],
  geometry: GeoJsonGeometry | null,
): number | undefined {
  if (!geometry) return undefined;
  const opts = { units: 'meters' as const };
  switch (geometry.type) {
    case 'Point':
      return distance(point, geometry.coordinates as [number, number], opts);
    case 'MultiPoint':
      return min(geometry.coordinates.map(c => distance(point, c as [number, number], opts)));
    case 'LineString':
      return geometry.coordinates.length >= 2
        ? pointToLineDistance(point, { type: 'LineString', coordinates: geometry.coordinates } as never, opts)
        : undefined;
    case 'MultiLineString':
      return min(
        geometry.coordinates
          .filter(line => line.length >= 2)
          .map(line => pointToLineDistance(point, { type: 'LineString', coordinates: line } as never, opts)),
      );
    case 'Polygon':
      if (booleanPointInPolygon(point, geometry as never)) return 0;
      return min(
        geometry.coordinates
          .filter(ring => ring.length >= 2)
          .map(ring => pointToLineDistance(point, { type: 'LineString', coordinates: ring } as never, opts)),
      );
    case 'MultiPolygon':
      if (booleanPointInPolygon(point, geometry as never)) return 0;
      return min(
        geometry.coordinates.flat().filter(ring => ring.length >= 2)
          .map(ring => pointToLineDistance(point, { type: 'LineString', coordinates: ring } as never, opts)),
      );
    case 'GeometryCollection':
      return min(
        geometry.geometries
          .map(child => distanceToFeature(point, child))
          .filter((value): value is number => value !== undefined),
      );
    default:
      return undefined;
  }
}

/** Warn when loaded geometry does not match what the schema promised. */
function noteGeometryDrift(
  loaded: LoadedFeatures,
  expected: 'point' | 'polygon',
  usable: number,
  warnings: string[],
): void {
  if (usable === loaded.features.length) return;
  const families = [...new Set(loaded.features.map(f => geometryFamily(f.geometry)))].sort();
  warnings.push(
    `${loaded.datasetId}: ${loaded.features.length - usable} of ${loaded.features.length} loaded features are not ${expected} geometry (found ${families.join(', ')}); only the usable ones were processed.`,
  );
}

const featureKey = (feature: GeoJsonFeature, index: number): string => {
  const props = feature.properties ?? {};
  for (const candidate of ['id', 'gml_id', 'objectid', 'objid', 'name']) {
    const value = props[candidate];
    if (typeof value === 'string' || typeof value === 'number') return String(value);
  }
  return `#${index}`;
};

function snapshot(loaded: LoadedFeatures, used: GeoJsonFeature[]): SourceSnapshot {
  return {
    datasetId: loaded.datasetId,
    sourceUrl: loaded.sourceUrl,
    retrievedAt: loaded.retrievedAt,
    recordCount: used.length,
    totalRecordCount: loaded.totalRecordCount,
    truncated: loaded.truncated,
    fingerprint: loaded.fingerprint,
    geometryTypes: [...new Set(loaded.features.map(f => f.geometry?.type).filter(Boolean))] as string[],
  };
}

const executionIdFor = (operation: SpatialOperation): string =>
  `EXE-${hashString(canonicalJson({ operationId: operation.id, engine: `${ENGINE_NAME}@${ENGINE_VERSION}` }))}`;

const artifactRefFor = (executionId: string): string => `ART-${executionId.replace(/^EXE-/, '')}`;

interface Stats {
  min: number;
  median: number;
  p90: number;
  max: number;
  mean: number;
}

export function summarise(values: number[]): Stats {
  if (!values.length) return { min: NaN, median: NaN, p90: NaN, max: NaN, mean: NaN };
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return {
    min: sorted[0],
    median: at(0.5),
    p90: at(0.9),
    max: sorted[sorted.length - 1],
    mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
  };
}

const min = (values: number[]): number | undefined => (values.length ? Math.min(...values) : undefined);
const round = (value: number): number | null => (Number.isFinite(value) ? Number(value.toFixed(2)) : null);
const fmt = (value: number): string => (Number.isFinite(value) ? value.toFixed(1) : 'n/a');
