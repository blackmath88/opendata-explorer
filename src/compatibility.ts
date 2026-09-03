import type {
  CompatibilityAssessment,
  CompatibilityRelation,
  Confidence,
  DatasetStructure,
  EvidenceLevel,
  KeyOverlapEvidence,
  ObservationSource,
} from './types';
import { extentsOverlap, primaryGeometryClass, type GeometryClass } from './geometry';
import { GRAIN_ORDER } from './data/ods-structure';

/**
 * Deterministic compatibility assessment between two datasets.
 *
 * No LLM, no scoring model, no network access — a pure function over two
 * `DatasetStructure` values plus any value-level evidence a caller has already
 * gathered. The point of the module is to be *able to say no*: `unknown` and
 * `incompatible` are ordinary, expected results, and the engine never invents a
 * relationship to avoid returning one.
 *
 * The three sub-checks are evaluated independently and then reconciled:
 *
 *   keys      do the two schemas share an identifier that actually joins?
 *   geometry  can the two geometries be related spatially?
 *   time      do their coverages overlap, and at compatible grain?
 */

export interface AssessOptions {
  /** Value-level key evidence, when a caller has spent the requests to get it. */
  keyEvidence?: KeyOverlapEvidence[];
}

/** Minimum share of sampled left-side keys that must be found on the right. */
const STRONG_OVERLAP = 0.5;
const WEAK_OVERLAP = 0.1;

/**
 * Above this many distinct measurement locations, a point layer is dense
 * enough that nearest-neighbour attachment is defensible; below it, values have
 * to be interpolated and the uncertainty stated.
 */
const SPARSE_SENSOR_LIMIT = 50;

/** Grains at least this far apart on the ladder need explicit resampling. */
const GRAIN_GAP_FOR_RESAMPLE = 2;

export function assessCompatibility(
  left: DatasetStructure,
  right: DatasetStructure,
  options: AssessOptions = {},
): CompatibilityAssessment {
  const reasons: string[] = [];
  const warnings: string[] = [];

  const keys = assessKeys(left, right, options.keyEvidence ?? [], reasons, warnings);
  // Notes that only make sense if the geometry relation is the one we report
  // (a distance-threshold caveat is noise next to a validated attribute join).
  const geometryNotes: string[] = [];
  const geometryCaveats: string[] = [];
  const geometry = assessGeometry(left, right, reasons, warnings, geometryNotes, geometryCaveats);
  const time = assessTemporal(left, right, reasons, warnings);

  const structureEvidence = weakestEvidence(left.observedFrom, right.observedFrom);

  // --- reconcile -----------------------------------------------------------
  // A hard contradiction wins over any positive relation: two datasets that
  // cannot occupy the same place or the same time cannot be joined at all.
  if (geometry.relation === 'incompatible') {
    return finish('incompatible', 'high', reasons, warnings, keys, undefined, geometry.evidence, left, right);
  }
  if (time.relation === 'incompatible') {
    return finish('incompatible', 'high', reasons, warnings, keys, undefined, time.evidence, left, right);
  }

  let relation: CompatibilityRelation = 'unknown';
  let confidence: Confidence = 'low';
  let operation: string | undefined;
  // The evidence level reported is the level of the evidence the *winning*
  // relation actually rests on, not the best level reached anywhere.
  let evidence: EvidenceLevel = structureEvidence;

  if (keys.relation === 'direct_join') {
    relation = 'direct_join';
    confidence = keys.confidence;
    operation = keys.operation;
    evidence = keys.evidence;
  }

  // A validated key join is the strongest link there is; otherwise a geometry
  // relation is preferred over a name-similarity-only key candidate.
  if (geometry.relation !== 'unknown' && !(keys.sampleValidated && keys.confidence === 'high')) {
    relation = geometry.relation;
    confidence = geometry.confidence;
    operation = geometry.operation;
    evidence = geometry.evidence;
    reasons.push(...geometryNotes);
    warnings.push(...geometryCaveats);
    if (keys.relation === 'direct_join') {
      reasons.push('A candidate key pair also exists, which may allow a cheaper attribute join.');
    }
  }

  let relationFromTime = false;
  if (relation === 'unknown' && time.relation !== 'unknown') {
    relation = time.relation;
    confidence = time.confidence;
    operation = time.operation;
    evidence = time.evidence;
    relationFromTime = true;
  }

  // Temporal transformations qualify a spatial or key relation rather than
  // replacing it: you still do the join, you just have to align time first.
  if (relation !== 'unknown' && !relationFromTime && time.requiredOperation) {
    warnings.push(time.requiredOperation.warning);
    operation = operation ? `${time.requiredOperation.operation}, then ${operation}` : time.requiredOperation.operation;
  }

  if (relation === 'unknown') {
    reasons.push('No shared identifier, geometry relation or temporal alignment could be established.');
  }

  // Confidence never outranks the evidence it rests on.
  if (evidence === 'metadata_only' && confidence === 'high') {
    confidence = 'medium';
    warnings.push('Confidence is capped: both sides are catalogue claims that have not been schema-verified.');
  }

  return finish(relation, confidence, reasons, warnings, keys, operation, evidence, left, right);
}

function finish(
  relation: CompatibilityRelation,
  confidence: Confidence,
  reasons: string[],
  warnings: string[],
  keys: KeyResult,
  proposedOperation: string | undefined,
  evidenceLevel: EvidenceLevel,
  left: DatasetStructure,
  right: DatasetStructure,
): CompatibilityAssessment {
  return {
    leftDatasetId: left.datasetId,
    rightDatasetId: right.datasetId,
    relation,
    confidence,
    reasons,
    warnings,
    candidateKeys: keys.pairs.length ? keys.pairs : undefined,
    proposedOperation,
    evidenceLevel,
  };
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

interface KeyResult {
  relation: 'direct_join' | 'unknown';
  confidence: Confidence;
  operation?: string;
  pairs: Array<{ left: string; right: string }>;
  sampleValidated: boolean;
  evidence: EvidenceLevel;
}

/**
 * Candidate key pairing.
 *
 * Field-name similarity alone never produces better than `low` confidence, and
 * the reason text says so explicitly. Only observed value overlap raises it.
 */
function assessKeys(
  left: DatasetStructure,
  right: DatasetStructure,
  evidence: KeyOverlapEvidence[],
  reasons: string[],
  warnings: string[],
): KeyResult {
  const pairs: Array<{ left: string; right: string }> = [];

  for (const leftKey of left.keyProfiles) {
    for (const rightKey of right.keyProfiles) {
      if (!keyNamesRelated(leftKey.field, rightKey.field)) continue;
      if (!typesCompatible(leftKey.type, rightKey.type)) continue;
      pairs.push({ left: leftKey.field, right: rightKey.field });
    }
  }

  // Key candidacy is read off the schema; nothing weaker can support it.
  const schemaEvidence = weakestEvidence(left.observedFrom, right.observedFrom);
  if (!pairs.length) {
    return { relation: 'unknown', confidence: 'low', pairs, sampleValidated: false, evidence: schemaEvidence };
  }

  const declared = pairs.filter(pair =>
    left.keyProfiles.find(k => k.field === pair.left)?.source === 'schema_annotation' &&
    right.keyProfiles.find(k => k.field === pair.right)?.source === 'schema_annotation');

  reasons.push(
    `Candidate key pair${pairs.length > 1 ? 's' : ''} ${pairs.map(p => `${p.left} ↔ ${p.right}`).join(', ')}` +
      (declared.length ? ', both marked as identifiers by the publisher.' : ', matched on field naming.'),
  );

  const matched = evidence.find(item => pairs.some(pair => pair.left === item.leftField && pair.right === item.rightField));

  if (!matched) {
    warnings.push(
      'Candidate only: the field names line up but no values have been compared, so the join is not validated.',
    );
    return {
      relation: 'direct_join',
      confidence: 'low',
      operation: `join ${pairs[0].left} = ${pairs[0].right}`,
      pairs,
      sampleValidated: false,
      evidence: schemaEvidence,
    };
  }

  const share = matched.overlap / Math.max(1, matched.leftDistinct);
  if (share >= STRONG_OVERLAP) {
    reasons.push(
      `${matched.overlap} of ${matched.leftDistinct} sampled ${matched.leftField} values were found in ${matched.rightField}.`,
    );
    if (matched.bounded) {
      warnings.push('Value comparison was capped at a bounded sample, so the overlap share is indicative, not exhaustive.');
    }
    return {
      relation: 'direct_join',
      confidence: 'high',
      operation: `join ${matched.leftField} = ${matched.rightField}`,
      pairs,
      sampleValidated: true,
      evidence: 'sample_validated',
    };
  }

  if (share >= WEAK_OVERLAP) {
    warnings.push(
      `Only ${matched.overlap} of ${matched.leftDistinct} sampled ${matched.leftField} values matched; the join would drop most rows.`,
    );
    return {
      relation: 'direct_join',
      confidence: 'low',
      operation: `join ${matched.leftField} = ${matched.rightField}`,
      pairs,
      sampleValidated: true,
      evidence: 'sample_validated',
    };
  }

  if (matched.bounded) {
    // The left side hit its cap, so "none matched" describes the sample, not
    // the datasets. Reporting it as a disproof would be exactly the kind of
    // overclaim this engine exists to prevent.
    warnings.push(
      `None of the ${matched.leftDistinct} sampled ${matched.leftField} values were found in ${matched.rightField}, but the comparison was capped — treat the pairing as unverified rather than disproved.`,
    );
    return { relation: 'unknown', confidence: 'low', pairs, sampleValidated: false, evidence: schemaEvidence };
  }

  warnings.push(
    `None of the ${matched.leftDistinct} distinct ${matched.leftField} values appear in ${matched.rightField}; the similar names do not represent the same identifier.`,
  );
  return { relation: 'unknown', confidence: 'low', pairs, sampleValidated: true, evidence: 'sample_validated' };
}

/** Tokenised name comparison: `zst_nr` and `id_zst` share the meaningful token. */
export function keyNamesRelated(left: string, right: string): boolean {
  if (left.toLowerCase() === right.toLowerCase()) return true;
  const strip = (name: string) =>
    name
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(token => token.length > 2 && !['id', 'nr', 'key', 'code', 'the'].includes(token));
  const leftTokens = new Set(strip(left));
  const rightTokens = strip(right);
  return rightTokens.some(token => leftTokens.has(token));
}

/** Identifier types only need to agree on being scalar; open data mixes them. */
function typesCompatible(left?: string, right?: string): boolean {
  const scalar = new Set(['text', 'int', 'double', undefined]);
  return scalar.has(left) && scalar.has(right);
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

interface GeometryResult {
  relation: CompatibilityRelation;
  confidence: Confidence;
  operation?: string;
  evidence: EvidenceLevel;
}

function assessGeometry(
  left: DatasetStructure,
  right: DatasetStructure,
  reasons: string[],
  warnings: string[],
  relationNotes: string[],
  relationCaveats: string[],
): GeometryResult {
  const leftClass = primaryGeometryClass(left);
  const rightClass = primaryGeometryClass(right);
  // Geometry claims are only as strong as where each side's geometry came from.
  const evidence = weakestEvidence(
    left.geometry?.observedFrom ?? left.observedFrom,
    right.geometry?.observedFrom ?? right.observedFrom,
  );

  if (leftClass === 'none' && rightClass === 'none') {
    return { relation: 'unknown', confidence: 'low', evidence };
  }

  if (leftClass === 'none' || rightClass === 'none') {
    const without = leftClass === 'none' ? left.datasetId : right.datasetId;
    warnings.push(
      `${without} exposes no geometry, so the two cannot be related spatially; a geographic reference dataset would be needed to place it.`,
    );
    return { relation: 'unknown', confidence: 'low', evidence };
  }

  // Disjoint published extents are a genuine contradiction, not a caveat.
  const leftExtent = left.geometry?.extent;
  const rightExtent = right.geometry?.extent;
  if (leftExtent && rightExtent && !extentsOverlap(leftExtent, rightExtent)) {
    reasons.push(
      'The published bounding boxes do not intersect: the two datasets cover different areas, so no feature of one lies within or beside the other.',
    );
    for (const [structure, extent] of [[left, leftExtent], [right, rightExtent]] as const) {
      if (isSiteExtent(extent)) {
        warnings.push(
          `${structure.datasetId} covers a single site rather than an area, so this says the site lies outside the other dataset's extent — the two are not unrelated in subject matter, they simply do not overlap in space.`,
        );
      }
    }
    // Bounding boxes are a catalogue claim, whatever else we observed.
    return { relation: 'incompatible', confidence: 'high', evidence: 'metadata_only' };
  }

  const crsMatch = left.geometry?.crs && left.geometry.crs === right.geometry?.crs;
  if (crsMatch) reasons.push(`Both sides are served in ${left.geometry?.crs}, so no reprojection is required.`);
  else warnings.push('Coordinate reference systems could not be confirmed as identical; reprojection may be required.');

  const extentConfidence: Confidence = leftExtent && rightExtent ? 'high' : 'medium';
  if (extentConfidence === 'medium') {
    warnings.push('At least one side publishes no bounding box, so extent overlap could not be confirmed.');
  }

  // A sparse measurement point layer against a line or area target is the
  // classic "sounds joinable, is not" case: nearest-neighbour would silently
  // present one sensor's reading as if it described the whole geometry.
  const sparseLeft = isSparseMeasurementLayer(left, leftClass);
  const sparseRight = isSparseMeasurementLayer(right, rightClass);
  if ((sparseLeft && rightClass !== 'point') || (sparseRight && leftClass !== 'point')) {
    const sparse = sparseLeft ? left : right;
    warnings.push(
      `${sparse.datasetId} is a measurement series recorded at fixed stations. The catalogue does not publish how many distinct stations there are, so values cannot be attributed to arbitrary locations without interpolating between them, and the result must not be presented as a local measurement.`,
    );
    return {
      relation: 'interpolation_required',
      confidence: 'medium',
      operation: 'interpolate measurement surface, then sample along the target geometry',
      evidence,
    };
  }

  return {
    ...relateGeometryClasses(leftClass, rightClass, extentConfidence, relationNotes, relationCaveats),
    evidence,
  };
}

function relateGeometryClasses(
  left: GeometryClass,
  right: GeometryClass,
  confidence: Confidence,
  reasons: string[],
  warnings: string[],
): Omit<GeometryResult, 'evidence'> {
  // A layer that mixes families can still be joined, but which operation
  // applies depends on the individual feature, so say that rather than
  // pretending one rule covers it.
  if (left === 'mixed' || right === 'mixed') {
    reasons.push('The two layers overlap spatially and can be intersected.');
    warnings.push(
      'One side mixes geometry types, so the applicable operation varies per feature; the layer should be split by geometry type before execution.',
    );
    return { relation: 'spatial_join', confidence: 'low', operation: 'st_intersects, after splitting by geometry type' };
  }

  const pair = [left, right].sort().join('+');

  switch (pair) {
    case 'point+polygon':
      reasons.push('Point features can be tested for containment in the polygon coverage.');
      return { relation: 'spatial_join', confidence, operation: 'st_within(point, polygon)' };
    case 'polygon+polygon':
      reasons.push('Two area coverages can be intersected.');
      return { relation: 'spatial_join', confidence, operation: 'st_intersection(polygon, polygon)' };
    case 'line+polygon':
      reasons.push('Line geometry can be clipped by the polygon coverage to measure the share inside it.');
      return { relation: 'spatial_join', confidence, operation: 'st_intersection(line, polygon) with length share' };
    case 'line+point':
      reasons.push('Point features can be attached to the nearest line segment.');
      warnings.push('A distance threshold must be chosen; without one, far-away points still find a nearest segment.');
      return { relation: 'nearest', confidence, operation: 'st_nearest(point, line) within a distance threshold' };
    case 'point+point':
      reasons.push('Both sides are point layers, so they can only be related by proximity.');
      warnings.push('A distance threshold must be chosen; proximity is not identity.');
      return { relation: 'nearest', confidence, operation: 'st_nearest(point, point) within a distance threshold' };
    case 'line+line':
      reasons.push('Two line networks can be intersected, but shared topology is not guaranteed.');
      warnings.push('Line-to-line matching depends on geometric alignment between two independently produced networks; conflation may be required.');
      return { relation: 'spatial_join', confidence: 'low', operation: 'st_intersects(line, line) with conflation tolerance' };
    default:
      warnings.push(`Geometry combination ${left}/${right} is not covered by a deterministic rule.`);
      return { relation: 'unknown', confidence: 'low' };
  }
}

/**
 * A bounding box smaller than roughly 200 m describes a single site, not an
 * area. Opendatasoft pads a single point into a small box, so an exact
 * degenerate test never fires.
 */
const SITE_EXTENT_DEGREES = 0.002;

function isSiteExtent(extent: [number, number, number, number]): boolean {
  return extent[2] - extent[0] <= SITE_EXTENT_DEGREES && extent[3] - extent[1] <= SITE_EXTENT_DEGREES;
}

/**
 * Distinguish a measurement network from a feature inventory.
 *
 * A tree cadastre and an air-quality station both publish points with numeric
 * attributes, but only one of them is a sample of a continuous field. The
 * discriminator that works on this catalogue is the declared time grain: a
 * dataset recorded at day/hour/minute resolution is repeated readings from a
 * few fixed sites, whereas an inventory carries at most an undated attribute.
 *
 * Record count is deliberately not used as a density signal — for a time
 * series it counts observations, not locations.
 */
function isSparseMeasurementLayer(structure: DatasetStructure, geometry: GeometryClass): boolean {
  if (geometry !== 'point') return false;
  const hasMeasures = structure.fields.some(field => Boolean(field.unit));
  if (!hasMeasures) return false;

  const grain = structure.temporal?.grain;
  if (grain === 'minute' || grain === 'hour' || grain === 'day') return true;

  // Only 149 of Basel's 361 datasets annotate a time grain, so a second signal
  // is needed: an extent covering a single site is one measurement station
  // however many observations it holds.
  const extent = structure.geometry?.extent;
  if (extent && isSiteExtent(extent)) return true;

  return (structure.recordCount ?? Number.POSITIVE_INFINITY) <= SPARSE_SENSOR_LIMIT;
}

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

interface TemporalResult {
  relation: CompatibilityRelation;
  confidence: Confidence;
  operation?: string;
  /** A transformation the caller must apply before any other relation works. */
  requiredOperation?: { operation: string; warning: string };
  evidence: EvidenceLevel;
}

function assessTemporal(
  left: DatasetStructure,
  right: DatasetStructure,
  reasons: string[],
  warnings: string[],
): TemporalResult {
  const a = left.temporal;
  const b = right.temporal;
  const evidence = weakestEvidence(
    a?.coverageObservedFrom ?? a?.observedFrom ?? left.observedFrom,
    b?.coverageObservedFrom ?? b?.observedFrom ?? right.observedFrom,
  );
  if (!a || !b) return { relation: 'unknown', confidence: 'low', evidence };

  const overlap = coverageOverlap(a, b);
  if (overlap === 'disjoint') {
    reasons.push(
      `Temporal coverage does not overlap (${a.start ?? '?'}–${a.end ?? '?'} versus ${b.start ?? '?'}–${b.end ?? '?'}), so no observation of one can describe the other's period.`,
    );
    return { relation: 'incompatible', confidence: 'high', evidence };
  }
  if (overlap === 'overlapping') {
    reasons.push('Published temporal coverages overlap.');
  } else {
    warnings.push('Temporal coverage is not published on both sides, so overlap could not be checked.');
  }

  const gap = grainGap(a.grain, b.grain);
  if (gap === undefined) {
    return { relation: 'unknown', confidence: 'low', evidence };
  }
  if (gap === 0) {
    reasons.push(`Both sides are recorded at ${a.grain} grain, so their time fields align directly.`);
    warnings.push('Aligning on time relates two periods, not two places or entities; it is not evidence that the rows describe the same subject.');
    return {
      relation: 'direct_join',
      confidence: 'medium',
      operation: `join on the shared ${a.grain} time field (${a.fields[0] ?? 'time'} = ${b.fields[0] ?? 'time'})`,
      evidence,
    };
  }

  const finer = grainIndex(a.grain) < grainIndex(b.grain) ? a : b;
  const coarser = finer === a ? b : a;
  const requiredOperation = {
    operation: `aggregate ${finer.grain} values to ${coarser.grain}`,
    warning: `Time grain differs (${a.grain} versus ${b.grain}); the finer series must be aggregated before the two can be compared.`,
  };

  return {
    relation: gap >= GRAIN_GAP_FOR_RESAMPLE ? 'aggregate_required' : 'resample_required',
    confidence: 'medium',
    operation: requiredOperation.operation,
    requiredOperation,
    evidence,
  };
}

type Overlap = 'overlapping' | 'disjoint' | 'unknown';

function coverageOverlap(
  a: NonNullable<DatasetStructure['temporal']>,
  b: NonNullable<DatasetStructure['temporal']>,
): Overlap {
  const aStart = time(a.start);
  const aEnd = time(a.end);
  const bStart = time(b.start);
  const bEnd = time(b.end);
  if (aStart === undefined || bStart === undefined) return 'unknown';
  const aFinish = aEnd ?? Number.POSITIVE_INFINITY;
  const bFinish = bEnd ?? Number.POSITIVE_INFINITY;
  return aStart <= bFinish && bStart <= aFinish ? 'overlapping' : 'disjoint';
}

const time = (value?: string): number | undefined => {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const grainIndex = (grain?: string): number => (grain ? GRAIN_ORDER.indexOf(grain as never) : -1);

function grainGap(a?: string, b?: string): number | undefined {
  const left = grainIndex(a);
  const right = grainIndex(b);
  if (left < 0 || right < 0) return undefined;
  return Math.abs(left - right);
}

// ---------------------------------------------------------------------------
// Evidence level
// ---------------------------------------------------------------------------

const EVIDENCE_BY_SOURCE: Record<ObservationSource, EvidenceLevel> = {
  catalog_metadata: 'metadata_only',
  schema: 'schema_observed',
  sample_records: 'sample_validated',
};

const LEVEL_ORDER: EvidenceLevel[] = ['metadata_only', 'schema_observed', 'sample_validated'];

/** An assessment is only as good as its weaker input. */
export function weakestEvidence(left: ObservationSource, right: ObservationSource): EvidenceLevel {
  const a = EVIDENCE_BY_SOURCE[left];
  const b = EVIDENCE_BY_SOURCE[right];
  return LEVEL_ORDER.indexOf(a) <= LEVEL_ORDER.indexOf(b) ? a : b;
}
