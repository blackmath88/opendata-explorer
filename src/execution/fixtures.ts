import type { GeoJsonFeature } from './types';

/**
 * Small hand-built GeoJSON fixtures for offline engine tests.
 *
 * Coordinates sit on central Basel so distances are realistic: at this
 * latitude 0.001 degrees of longitude is about 75 m and 0.001 degrees of
 * latitude about 111 m.
 */

const point = (lon: number, lat: number, props: Record<string, unknown> = {}): GeoJsonFeature => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [lon, lat] },
  properties: props,
});

const polygon = (
  [west, south, east, north]: [number, number, number, number],
  props: Record<string, unknown> = {},
): GeoJsonFeature => ({
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]],
  },
  properties: props,
});

const line = (coordinates: number[][], props: Record<string, unknown> = {}): GeoJsonFeature => ({
  type: 'Feature',
  geometry: { type: 'LineString', coordinates },
  properties: props,
});

/** Three points inside the test square, one clearly outside it. */
export const POINTS: GeoJsonFeature[] = [
  point(7.5885, 47.5595, { id: 'p1' }),
  point(7.589, 47.5597, { id: 'p2' }),
  point(7.5895, 47.5592, { id: 'p3' }),
  point(7.6, 47.57, { id: 'p4-outside' }),
];

/** One area covering the first three points. */
export const SQUARE: GeoJsonFeature[] = [polygon([7.588, 47.559, 7.59, 47.56], { id: 'zone-a' })];

/** Two adjacent areas, so a count-per-target aggregate has something to rank. */
export const TWO_SQUARES: GeoJsonFeature[] = [
  polygon([7.588, 47.559, 7.5892, 47.56], { id: 'zone-a' }),
  polygon([7.5892, 47.559, 7.59, 47.56], { id: 'zone-b' }),
];

/** An area nowhere near the points, for the no-overlap case. */
export const DISTANT_SQUARE: GeoJsonFeature[] = [polygon([7.7, 47.65, 7.702, 47.651], { id: 'far-zone' })];

/** An east-west street segment through the middle of the test square. */
export const STREET: GeoJsonFeature[] = [
  line([[7.588, 47.5595], [7.59, 47.5595]], { id: 'street-1' }),
];

/** Points a few metres from the street: nearest is analytically meaningful. */
export const POINTS_NEAR_STREET: GeoJsonFeature[] = [
  point(7.5885, 47.55955, { id: 'near-1' }),
  point(7.589, 47.5594, { id: 'near-2' }),
  point(7.5895, 47.55952, { id: 'near-3' }),
];

/** Points over a kilometre away: a nearest feature exists but means nothing. */
export const POINTS_FAR_FROM_STREET: GeoJsonFeature[] = [
  point(7.5885, 47.57, { id: 'far-1' }),
  point(7.589, 47.572, { id: 'far-2' }),
  point(7.5895, 47.574, { id: 'far-3' }),
];

/** Half close, half distant — exercises the coverage threshold. */
export const POINTS_MIXED_FROM_STREET: GeoJsonFeature[] = [
  ...POINTS_NEAR_STREET.slice(0, 1),
  ...POINTS_FAR_FROM_STREET,
];

/** Features the catalogue lists but which carry no geometry at all. */
export const NO_GEOMETRY: GeoJsonFeature[] = [
  { type: 'Feature', geometry: null, properties: { id: 'ng-1' } },
  { type: 'Feature', geometry: null, properties: { id: 'ng-2' } },
];

/** A layer whose declared type is points but which actually holds lines. */
export const MISLABELLED: GeoJsonFeature[] = [
  ...POINTS.slice(0, 2),
  line([[7.588, 47.5591], [7.5899, 47.5591]], { id: 'unexpected-line' }),
];
