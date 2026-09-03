import type { CatalogState, CatalogueAdapter } from '../types';
import { BaselOpendatasoftAdapter } from './basel';
import { FallbackCatalogueAdapter } from './fallback';

export interface CatalogueSession {
  state: CatalogState;
  /** The adapter that actually served the data — live or fallback. */
  adapter: CatalogueAdapter;
}

/**
 * Load the catalogue, degrading to the offline snapshot on any failure.
 *
 * The distinction is deliberately loud: `state.source` drives a persistent
 * badge, and fallback data is never described as live anywhere in the UI.
 */
export async function openCatalogue(): Promise<CatalogueSession> {
  const live = new BaselOpendatasoftAdapter();
  const loadedAt = () => new Date().toISOString();

  try {
    const result = await live.loadCatalog();
    return {
      adapter: live,
      state: {
        source: 'live',
        loadedAt: loadedAt(),
        datasets: result.datasets,
        reportedTotal: result.reportedTotal,
        notes: result.notes,
      },
    };
  } catch (error) {
    const fallback = new FallbackCatalogueAdapter();
    return {
      adapter: fallback,
      state: {
        source: 'fallback',
        loadedAt: loadedAt(),
        datasets: await fallback.listDatasets(),
        error: error instanceof Error ? error.message : 'Unknown catalogue error',
        notes: [
          'Showing a frozen offline snapshot of a small Basel dataset set.',
          'Sample-level evidence is unavailable in fallback mode.',
        ],
      },
    };
  }
}
