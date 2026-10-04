/**
 * Collect the small, bounded samples that generated covers draw from, once, into a static file:
 *   npx tsx scripts/cover-samples.ts --portal bs [--category "Mobility & Transport"]
 * (behind a proxy: NODE_USE_ENV_PROXY=1)
 *
 * Per dataset at most one request: 60 geometries (thinned to <= 40 coordinates per shape and
 * rounded to 5 decimals) or records per month (last 100 months). Column types come from the
 * snapshot, no request. Output: src/data/portals/<id>/cover-samples.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { atlasPath } from '../src/atlas';
import { dataForm } from '../src/atlas-spec';
import type { CoverSample } from '../src/cover';
import { asObject, asString, odsFetch, type Json } from '../src/data/ods';
import { snapshotDatasets, snapshotPath, type PortalSnapshot } from '../src/data/snapshot';
import { portalById, setActivePortal } from '../src/portal';
import { fillMonths, parseGeometries, type Geometry } from '../src/portrait';

const args = process.argv.slice(2);
const flag = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const portal = portalById(flag('portal') ?? 'bs');
if (!portal || portal.api.kind !== 'ods') throw new Error('an Opendatasoft portal is required (--portal bs|bl|sg)');
setActivePortal(portal);
const category = flag('category');

const { datasets } = snapshotDatasets(portal);
const raw = (JSON.parse(gunzipSync(readFileSync(snapshotPath(portal))).toString('utf8')) as PortalSnapshot).entries.map(asObject);
const fieldsById = new Map(raw.map(entry => [asString(entry.dataset_id), (Array.isArray(entry.fields) ? entry.fields : []).map(asObject).map(field => ({ name: asString(field.name), type: asString(field.type) }))]));

const round = (point: number[]) => [Math.round(point[0] * 1e5) / 1e5, Math.round(point[1] * 1e5) / 1e5];
/** A cover is ~96 x 70 units: 800 coordinates per dataset, shared across its shapes, is plenty. */
const BUDGET = 800;
const lineCount = (g: Geometry): number => g.type === 'Point' ? 0 : g.type === 'MultiPoint' || g.type === 'LineString' ? 1 : g.type === 'MultiPolygon' ? g.coordinates.flat().length : g.coordinates.length;
const thinTo = (max: number) => (line: number[][]) => { const step = Math.max(1, Math.ceil(line.length / max)); return line.filter((_, i) => i % step === 0 || i === line.length - 1).map(round); };
function thinGeometry(g: Geometry, max: number): Geometry {
  const thin = thinTo(max);
  switch (g.type) {
    case 'Point': return { type: 'Point', coordinates: round(g.coordinates) };
    case 'MultiPoint': case 'LineString': return { type: g.type, coordinates: thin(g.coordinates) };
    case 'Polygon': case 'MultiLineString': return { type: g.type, coordinates: g.coordinates.map(thin) };
    case 'MultiPolygon': return { type: 'MultiPolygon', coordinates: g.coordinates.map(poly => poly.map(thin)) };
  }
}
function thinAll(geometries: Geometry[]): Geometry[] {
  const lines = geometries.reduce((sum, g) => sum + lineCount(g), 0);
  const max = Math.max(4, Math.min(40, Math.floor(BUDGET / Math.max(1, lines))));
  return geometries.map(g => thinGeometry(g, max));
}

const chosen = datasets.filter(dataset => !category || atlasPath(dataset, 'topic').category === category);
const samples: Record<string, CoverSample> = {};
for (const dataset of chosen) {
  const form = dataForm(dataset);
  const fields = (fieldsById.get(dataset.id) ?? []).filter(field => field.name);
  const sample: CoverSample = { fields };
  const path = `/catalog/datasets/${encodeURIComponent(dataset.id)}`;
  try {
    if (dataset.hasRecords && ['point', 'line', 'area', 'mixed'].includes(form)) {
      sample.geometries = thinAll(parseGeometries(await odsFetch<unknown>(`${path}/exports/geojson`, { limit: 60 }, { portal })));
    } else if (dataset.hasRecords && form === 'series') {
      const time = fields.find(field => field.type === 'date' || field.type === 'datetime')?.name;
      if (time) {
        const body = await odsFetch<{ results?: Json[] }>(`${path}/records`, { select: 'count(*) as n', group_by: `date_format(${time}, 'yyyy-MM') as period`, order_by: 'period desc', limit: 100 }, { portal });
        sample.periods = fillMonths((body.results ?? []).map(row => ({ period: asString(row.period), n: Number(row.n) || 0 })).filter(row => /^\d{4}-\d{2}$/.test(row.period))).slice(-100);
      }
    }
  } catch (error) {
    console.error(`  ${dataset.id}: no sample (${error instanceof Error ? error.message : 'error'})`);
  }
  samples[dataset.id] = sample;
  process.stderr.write('.');
}
const out = `src/data/portals/${portal.id}/cover-samples.json`;
writeFileSync(out, JSON.stringify({ portal: portal.id, takenAt: new Date().toISOString(), category: category ?? 'all', samples }) + '\n');
console.error(`\n${Object.keys(samples).length} samples -> ${out}`);
