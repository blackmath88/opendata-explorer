import { featuresFingerprint } from '../fingerprint';
import { asObject, odsFetch } from '../data/ods';
import type { FeatureCollection, GeoJsonFeature, GeometrySource, LoadedFeatures } from './types';

/**
 * Where execution gets its geometry.
 *
 * Two implementations behind one interface: the live Opendatasoft export
 * endpoint, and a fixture source for offline tests. The engine cannot tell them
 * apart, so the tests exercise the real code path.
 */

/**
 * `/exports/geojson` returns a whole dataset as one FeatureCollection and
 * accepts `limit`, `where` and `select` — unlike `/records`, which caps at 100
 * rows per request. It is the only reason client-side execution is affordable
 * here.
 */
export class OdsGeoJsonSource implements GeometrySource {
  private cache = new Map<string, LoadedFeatures>();

  constructor(private readonly recordCounts: Map<string, number | undefined> = new Map()) {}

  async load(datasetId: string, options: { maxFeatures: number }): Promise<LoadedFeatures> {
    const cacheKey = `${datasetId}:${options.maxFeatures}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const path = `/catalog/datasets/${encodeURIComponent(datasetId)}/exports/geojson`;
    const total = this.recordCounts.get(datasetId);

    // Ask for one more than the budget: if it comes back, we know we truncated
    // rather than having to trust the catalogue's record count.
    const body = await odsFetch<FeatureCollection>(
      path,
      { limit: options.maxFeatures + 1 },
      { timeoutMs: 60000 },
    );

    const all = Array.isArray(body.features) ? body.features.map(normalizeFeature) : [];
    const truncated = all.length > options.maxFeatures;
    const features = truncated ? all.slice(0, options.maxFeatures) : all;

    const loaded: LoadedFeatures = {
      datasetId,
      features,
      retrievedAt: new Date().toISOString(),
      sourceUrl: `https://data.bs.ch/api/explore/v2.1${path}?limit=${options.maxFeatures + 1}`,
      totalRecordCount: total ?? (truncated ? undefined : all.length),
      truncated,
      fingerprint: featuresFingerprint(features.map(f => f.geometry)),
    };
    this.cache.set(cacheKey, loaded);
    return loaded;
  }
}

/** Offline source backed by fixed GeoJSON, so engine tests need no network. */
export class FixtureGeometrySource implements GeometrySource {
  constructor(private readonly fixtures: Record<string, GeoJsonFeature[]>) {}

  async load(datasetId: string, options: { maxFeatures: number }): Promise<LoadedFeatures> {
    const all = this.fixtures[datasetId];
    if (!all) throw new Error(`No fixture for dataset ${datasetId}`);
    const truncated = all.length > options.maxFeatures;
    const features = truncated ? all.slice(0, options.maxFeatures) : all;
    return {
      datasetId,
      features,
      // Fixed so fixture-driven results are byte-stable.
      retrievedAt: '2026-09-03T00:00:00.000Z',
      sourceUrl: `fixture://${datasetId}`,
      totalRecordCount: all.length,
      truncated,
      fingerprint: featuresFingerprint(features.map(f => f.geometry)),
    };
  }
}

/**
 * ODS emits `geo_point_2d` as a `{lon, lat}` property alongside the real
 * geometry, and occasionally a feature with null geometry. Normalise to plain
 * GeoJSON so the engine never has to know where the data came from.
 */
function normalizeFeature(value: unknown): GeoJsonFeature {
  const raw = asObject(value);
  const geometry = raw.geometry && typeof raw.geometry === 'object' ? (raw.geometry as GeoJsonFeature['geometry']) : null;
  return {
    type: 'Feature',
    geometry,
    properties: raw.properties && typeof raw.properties === 'object' ? (raw.properties as Record<string, unknown>) : null,
  };
}
