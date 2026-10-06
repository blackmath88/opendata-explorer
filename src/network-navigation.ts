import { atlasSegments } from './atlas';
import { filterCatalogue, DEFAULT_CATALOGUE_FILTERS } from './catalogue-ui';
import type { DatasetRecord } from './types';

export type NetworkLens = 'topic' | 'publisher' | 'space' | 'time';
export const NETWORK_LENSES: Record<NetworkLens, string> = {
  topic: 'Topic', publisher: 'Publisher', space: 'Data shape', time: 'Time',
};
export interface NetworkLocation { lens: NetworkLens; path: string[] }
export interface NetworkNode {
  id: string; kind: 'group' | 'dataset' | 'scope'; label: string; color: string;
  radius: number; count: number; matching: number; path: string[]; datasetId?: string;
  x: number; y: number; z: number; fx: number; fy: number; fz: number;
}
export interface NetworkLink { source: string; target: string; label: string }
export interface CatalogueNetwork {
  nodes: NetworkNode[]; links: NetworkLink[]; includedIds: string[];
  groups: NetworkNode[]; datasets: DatasetRecord[]; matchingIds: Set<string>;
}
const COLORS = ['#168b83', '#3269af', '#ac7933', '#9272aa', '#af6474', '#638952', '#467b8e', '#b27147', '#7078ab', '#778477'];
function hash(value: string): number {
  let result = 2166136261;
  for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return result >>> 0;
}
export function networkPath(dataset: DatasetRecord, lens: NetworkLens): string[] {
  if (lens === 'publisher') return [dataset.publisher.trim() || 'Publisher not declared', atlasSegments(dataset, 'topic')[0]];
  return atlasSegments(dataset, lens).slice(0, 2);
}
export function networkColor(label: string): string { return COLORS[hash(label) % COLORS.length]; }
export function searchNetwork(datasets: DatasetRecord[], query: string): DatasetRecord[] {
  return filterCatalogue(datasets, { ...DEFAULT_CATALOGUE_FILTERS, query })
    .sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
}

/** One canonical dataset node per scope. Edges mean membership, never joinability.
 * Search changes highlighting only; source ordering and searches never move nodes.
 * Fixed coordinates keep this a navigable place, rather than a reheating simulation.
 */
export function buildCatalogueNetwork(all: DatasetRecord[], location: NetworkLocation, query = '', flat = false): CatalogueNetwork {
  const datasets = all.filter(dataset => location.path.every((part, index) => networkPath(dataset, location.lens)[index] === part))
    .sort((a, b) => a.id.localeCompare(b.id));
  const matchingIds = new Set(searchNetwork(all, query).map(dataset => dataset.id));
  const buckets = new Map<string, DatasetRecord[]>();
  for (const dataset of datasets) {
    const label = networkPath(dataset, location.lens)[location.path.length] ?? location.path.at(-1) ?? 'Datasets';
    const items = buckets.get(label) ?? [];
    items.push(dataset); buckets.set(label, items);
  }
  const groups: NetworkNode[] = [];
  const nodes: NetworkNode[] = [];
  const links: NetworkLink[] = [];
  const labels = [...buckets.keys()].sort((a, b) => a.localeCompare(b));
  const radius = labels.length > 1 ? Math.max(135, labels.length * 35) : 0;
  labels.forEach((label, index) => {
    const items = buckets.get(label)!;
    const angle = -Math.PI / 2 + index * 2 * Math.PI / labels.length;
    const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius * .68;
    const z = flat ? 0 : Math.sin(angle * 2) * 40;
    const path = [...location.path, label].slice(0, 2);
    const id = `group:${JSON.stringify([location.lens, ...path])}`;
    const color = networkColor(location.lens === 'topic' ? networkPath(items[0], 'topic')[0] : label);
    const group: NetworkNode = {
      id, kind: location.path.length >= 2 ? 'scope' : 'group', label, color,
      radius: 7 + Math.min(8, Math.sqrt(items.length)), count: items.length,
      matching: items.filter(item => matchingIds.has(item.id)).length, path,
      x, y, z, fx: x, fy: y, fz: z,
    };
    groups.push(group); nodes.push(group);
    items.forEach(dataset => {
      // Stable hash position on a disk/spherical shell; no semantic distance claim.
      const seed = hash(dataset.id), theta = (seed % 10000) / 10000 * Math.PI * 2;
      const band = 26 + Math.sqrt((seed >>> 8) % 1000 / 1000) * (36 + Math.sqrt(items.length) * 5);
      const dx = x + Math.cos(theta) * band, dy = y + Math.sin(theta) * band;
      const dz = flat ? 0 : z + ((seed >>> 16) % 1000 / 1000 - .5) * 85;
      nodes.push({
        id: `dataset:${dataset.id}`, kind: 'dataset', label: dataset.title,
        datasetId: dataset.id, color: networkColor(networkPath(dataset, 'topic')[0]), radius: 2.7, count: 1,
        matching: matchingIds.has(dataset.id) ? 1 : 0,
        path: networkPath(dataset, location.lens),
        x: dx, y: dy, z: dz, fx: dx, fy: dy, fz: dz,
      });
      links.push({ source: id, target: `dataset:${dataset.id}`, label: `Grouped under ${label}. Catalogue navigation, not a validated data relationship.` });
    });
  });
  return { nodes, links, groups, datasets, includedIds: datasets.map(dataset => dataset.id), matchingIds };
}

export interface NetworkAddress extends NetworkLocation { dataset?: string; query: string }
export function networkHash(address: NetworkAddress): string {
  const params = new URLSearchParams({ lens: address.lens });
  for (const part of address.path) params.append('path', part);
  if (address.dataset) params.set('dataset', address.dataset);
  if (address.query) params.set('q', address.query);
  return `#${params}`;
}
export function parseNetworkHash(hash: string): NetworkAddress {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const lens = params.get('lens') as NetworkLens;
  return { lens: Object.hasOwn(NETWORK_LENSES, lens) ? lens : 'topic', path: params.getAll('path').slice(0, 2), dataset: params.get('dataset') || undefined, query: params.get('q') ?? '' };
}
