import type { DatasetStructure } from './types';

/**
 * Coarse geometry families. Compatibility rules reason about families, not
 * about the exact OGC type, because `Polygon` and `MultiPolygon` behave
 * identically for the operations we propose.
 */
export type GeometryClass = 'point' | 'line' | 'polygon' | 'mixed' | 'none';

const FAMILIES: ReadonlyArray<readonly [GeometryClass, RegExp]> = [
  ['point', /^multipoint$|^point$/i],
  ['line', /^multilinestring$|^linestring$/i],
  ['polygon', /^multipolygon$|^polygon$/i],
];

export function classifyGeometryType(type: string): GeometryClass {
  const match = FAMILIES.find(([, pattern]) => pattern.test(type.trim()));
  if (match) return match[0];
  return /^geometrycollection$/i.test(type.trim()) ? 'mixed' : 'none';
}

/**
 * The geometry families a dataset declares. A dataset can legitimately declare
 * several (Basel's school locations publish points *and* site polygons).
 *
 * `GeometryCollection` is a container, not a family: Basel's street-name layer
 * declares `GeometryCollection`, `LineString` and `MultiLineString` for what is
 * a line network. Counting the container as its own family would make every
 * such dataset unclassifiable, so it is dropped when a concrete family is also
 * declared and only surfaces as `mixed` when nothing else is.
 */
export function geometryClasses(types: string[] | undefined): GeometryClass[] {
  const classes = new Set<GeometryClass>();
  let sawCollection = false;
  for (const type of types ?? []) {
    const family = classifyGeometryType(type);
    if (family === 'mixed') sawCollection = true;
    else if (family !== 'none') classes.add(family);
  }
  if (!classes.size && sawCollection) return ['mixed'];
  return [...classes];
}

/** The single family best describing a structure, or `none`. */
export function primaryGeometryClass(structure: DatasetStructure): GeometryClass {
  if (!structure.geometry) return 'none';
  const classes = geometryClasses(structure.geometry.declaredTypes ?? [structure.geometry.type]);
  if (classes.length === 1) return classes[0];
  if (classes.length > 1) return 'mixed';
  // Schema showed a geometry field but the source declared no type.
  return structure.geometry.fields?.length ? 'mixed' : 'none';
}

/** Do two WGS84 bounding boxes overlap at all? */
export function extentsOverlap(
  a: [number, number, number, number],
  b: [number, number, number, number],
): boolean {
  return !(a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1]);
}
