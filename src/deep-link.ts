/**
 * Deep links into the Landscape: `#dataset=<id>` (optionally `&lens=space`).
 * The shared address for all three entrances; a Chat answer from an external MCP host can
 * point here with the same dataset ID the app, the inspector and Build use.
 */
import type { AtlasLens } from './atlas';
import { activePortal } from './portal';

const LENSES: readonly AtlasLens[] = ['topic', 'space', 'time', 'readiness'];

export interface DeepLink { dataset?: string; lens?: AtlasLens }

export function parseDeepLink(hash: string): DeepLink {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const dataset = params.get('dataset')?.trim() || undefined;
  const lens = params.get('lens') as AtlasLens | null;
  return { dataset: dataset && /^[\w.-]{1,64}$/.test(dataset) ? dataset : undefined, lens: lens && LENSES.includes(lens) ? lens : undefined };
}

export function formatDeepLink(link: DeepLink): string {
  const params = new URLSearchParams();
  if (link.dataset) params.set('dataset', link.dataset);
  if (link.lens && link.lens !== 'topic') params.set('lens', link.lens);
  const text = params.toString();
  return text ? `#${text}` : '';
}

/** What to say when a linked dataset is not loaded: a snapshot gap is not a global absence. */
export function missingLinkNotice(id: string, source: 'live' | 'fallback', loaded: number): string {
  return source === 'fallback'
    ? `Dataset ${id} is not in the offline snapshot (${loaded} datasets). The live ${activePortal().shortLabel} catalogue may contain it; the live catalogue is unavailable right now.`
    : `Dataset ${id} is not in the live catalogue as loaded (${loaded} datasets). It may have been withdrawn or renamed at the source.`;
}
