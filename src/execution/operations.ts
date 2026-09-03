import type { CompatibilityAssessment, DatasetStructure } from '../types';
import { primaryGeometryClass, type GeometryClass } from '../geometry';
import { canonicalJson, hashString } from '../fingerprint';
import type {
  AggregateParameters,
  ExecutionResult,
  NearestParameters,
  SpatialJoinParameters,
  SpatialOperation,
} from './types';

/**
 * Turning an assessment into an executable operation.
 *
 * The only way to obtain a SpatialOperation. Every path through this module
 * requires an assessment, so an operation can never exist without the
 * justification that produced it.
 */

/** Per-dataset ingest ceiling. Public API, bounded experiment. */
export const MAX_FEATURES = 5000;

/**
 * Default distance beyond which "nearest" stops being an analytical
 * relationship. 50 m is roughly a Basel street block's width: a tree or sensor
 * further than that from a route segment is not describing that segment.
 * Callers can override it; the value used is always recorded on the operation.
 */
export const DEFAULT_NEAREST_METERS = 50;

/**
 * Share of source features that must find a target inside the threshold before
 * a nearest hypothesis counts as confirmed. Below this the relation exists for
 * a minority of the data and should not be presented as a usable join.
 */
export const DEFAULT_MIN_COVERAGE = 0.5;

export type OperationPlan =
  | { ok: true; operation: SpatialOperation }
  | { ok: false; reason: string };

export interface PlanOptions {
  maxFeatures?: number;
  maxDistanceMeters?: number;
  minCoverage?: number;
  /** Fixed timestamp, for reproducible tests. */
  now?: string;
}

/**
 * Which relations this milestone can execute.
 *
 * `interpolation_required` and `direct_join` are deliberately absent: the first
 * needs an interpolation surface we have not built, the second is an attribute
 * join rather than a spatial one. Saying so is better than executing something
 * adjacent and reporting it as validation of the original claim.
 */
export function planOperation(
  assessment: CompatibilityAssessment,
  left: DatasetStructure,
  right: DatasetStructure,
  options: PlanOptions = {},
): OperationPlan {
  if (assessment.leftDatasetId !== left.datasetId || assessment.rightDatasetId !== right.datasetId) {
    return { ok: false, reason: 'The supplied structures are not the ones this assessment refers to.' };
  }

  const leftClass = primaryGeometryClass(left);
  const rightClass = primaryGeometryClass(right);

  if (leftClass === 'none' || rightClass === 'none') {
    return { ok: false, reason: 'One side exposes no geometry, so there is no spatial operation to run.' };
  }

  const shape = spatialShape(leftClass, rightClass);
  if (!shape) {
    return {
      ok: false,
      reason: `Geometry combination ${leftClass}/${rightClass} has no executable operation in this milestone.`,
    };
  }

  switch (assessment.relation) {
    case 'spatial_join':
    case 'nearest':
      break;
    case 'incompatible':
      // Executing a rejection is worthwhile: it tests whether the engine was
      // right to refuse, rather than leaving the negative unverified.
      break;
    default:
      return {
        ok: false,
        reason: `Relation "${assessment.relation}" is not executable in this milestone.`,
      };
  }

  const now = options.now ?? new Date().toISOString();
  const maxFeatures = options.maxFeatures ?? MAX_FEATURES;

  // Orientation matters: containment tests points against areas, never the
  // reverse, whichever way round the assessment happens to be written.
  const source = shape.sourceSide === 'left' ? left : right;
  const target = shape.sourceSide === 'left' ? right : left;

  const parameters: SpatialJoinParameters | NearestParameters =
    shape.type === 'spatial_join'
      ? { sourceDatasetId: source.datasetId, targetDatasetId: target.datasetId, maxFeatures }
      : {
          sourceDatasetId: source.datasetId,
          targetDatasetId: target.datasetId,
          maxDistanceMeters: options.maxDistanceMeters ?? DEFAULT_NEAREST_METERS,
          minCoverage: options.minCoverage ?? DEFAULT_MIN_COVERAGE,
          maxFeatures,
        };

  const operation: SpatialOperation = {
    id: '',
    type: shape.type,
    assessmentId: assessment.id,
    inputs: [
      { datasetId: source.datasetId, structureRef: fingerprintFor(assessment, source.datasetId), role: 'source' },
      { datasetId: target.datasetId, structureRef: fingerprintFor(assessment, target.datasetId), role: 'target' },
    ],
    parameters: parameters as unknown as Record<string, unknown>,
    expectedRelation: assessment.relation,
    createdFrom: 'compatibility_assessment',
    createdAt: now,
  };
  return { ok: true, operation: { ...operation, id: operationId(operation) } };
}

/**
 * A bounded derived measure over an executed relationship. Requires the
 * execution, which in turn requires the assessment, so provenance stays intact
 * all the way down.
 */
export function planAggregate(
  execution: ExecutionResult,
  options: { measure?: AggregateParameters['measure']; maxGroups?: number; now?: string } = {},
): OperationPlan {
  if (execution.status === 'failed') {
    return { ok: false, reason: 'Cannot aggregate over an execution that failed.' };
  }
  if (!execution.output?.artifactRef) {
    return { ok: false, reason: 'The execution produced no matches to aggregate.' };
  }

  const parameters: AggregateParameters = {
    sourceExecutionId: execution.id,
    measure: options.measure ?? 'count_per_target',
    maxGroups: options.maxGroups ?? 200,
  };

  const operation: SpatialOperation = {
    id: '',
    type: 'aggregate',
    assessmentId: execution.assessmentId,
    inputs: execution.sourceSnapshots.map((snapshot, index) => ({
      datasetId: snapshot.datasetId,
      structureRef: snapshot.fingerprint,
      role: index === 0 ? ('source' as const) : ('target' as const),
    })),
    parameters: parameters as unknown as Record<string, unknown>,
    expectedRelation: execution.validation.originalRelation,
    createdFrom: 'execution_result',
    createdAt: options.now ?? new Date().toISOString(),
  };
  return { ok: true, operation: { ...operation, id: operationId(operation) } };
}

/** Content-derived, like assessment ids, so replanning is idempotent. */
export function operationId(operation: Omit<SpatialOperation, 'id'> & { id?: string }): string {
  const { id: _ignored, createdAt: _also, ...material } = operation;
  return `OPR-${hashString(canonicalJson(material))}`;
}

interface Shape {
  type: 'spatial_join' | 'nearest';
  sourceSide: 'left' | 'right';
}

/**
 * Which operation the two geometry families support, and which side plays the
 * source role.
 */
function spatialShape(left: GeometryClass, right: GeometryClass): Shape | undefined {
  const area = (c: GeometryClass) => c === 'polygon';
  const point = (c: GeometryClass) => c === 'point';
  const line = (c: GeometryClass) => c === 'line';

  if (point(left) && area(right)) return { type: 'spatial_join', sourceSide: 'left' };
  if (area(left) && point(right)) return { type: 'spatial_join', sourceSide: 'right' };
  if (point(left) && line(right)) return { type: 'nearest', sourceSide: 'left' };
  if (line(left) && point(right)) return { type: 'nearest', sourceSide: 'right' };
  if (point(left) && point(right)) return { type: 'nearest', sourceSide: 'left' };
  return undefined;
}

const fingerprintFor = (assessment: CompatibilityAssessment, datasetId: string): string | undefined =>
  datasetId === assessment.leftDatasetId
    ? assessment.leftStructureRef
    : datasetId === assessment.rightDatasetId
      ? assessment.rightStructureRef
      : undefined;
