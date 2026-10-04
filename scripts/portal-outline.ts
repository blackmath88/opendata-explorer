/**
 * The portal's outline, drawn faintly behind every map cover so positions read as "where in the
 * canton": npx tsx scripts/portal-outline.ts --portal bs --dataset 100017   (behind a proxy: NODE_USE_ENV_PROXY=1)
 * Writes src/data/portals/<id>/outline.json: the commune polygons, thinned and rounded. One request.
 */
import { writeFileSync } from 'node:fs';
import { odsFetch } from '../src/data/ods';
import { portalById, setActivePortal } from '../src/portal';
import { parseGeometries, type Geometry } from '../src/portrait';

const args = process.argv.slice(2);
const flag = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const portal = portalById(flag('portal') ?? 'bs');
const dataset = flag('dataset');
if (!portal || portal.api.kind !== 'ods' || !dataset) throw new Error('usage: --portal <ods portal> --dataset <id of a boundary dataset>');
setActivePortal(portal);

const round = ([x, y]: number[]) => [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4];
const thin = (ring: number[][]) => { const step = Math.max(1, Math.ceil(ring.length / 120)); return ring.filter((_, i) => i % step === 0 || i === ring.length - 1).map(round); };
const rings = (g: Geometry): number[][][] => g.type === 'Polygon' ? g.coordinates : g.type === 'MultiPolygon' ? g.coordinates.flat() : [];

const geometries = parseGeometries(await odsFetch<unknown>(`/catalog/datasets/${dataset}/exports/geojson`, { limit: 20 }, { portal }));
const outline: Geometry[] = geometries.flatMap(rings).map(ring => ({ type: 'Polygon', coordinates: [thin(ring)] }));
writeFileSync(`src/data/portals/${portal.id}/outline.json`, JSON.stringify({ portal: portal.id, dataset, takenAt: new Date().toISOString(), outline }) + '\n');
console.log(`${outline.length} rings, ${outline.reduce((n, g) => n + (g.type === 'Polygon' ? g.coordinates[0].length : 0), 0)} points -> src/data/portals/${portal.id}/outline.json`);
