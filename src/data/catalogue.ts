import type { CatalogState, CatalogueAdapter } from '../types';
import { activePortal, type Portal } from '../portal';
import { CkanDcatAdapter } from './ckan';
import { OpendatasoftAdapter } from './ods-adapter';
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
export async function openCatalogue(portal: Portal = activePortal()): Promise<CatalogueSession> {
  const live = portal.api.kind === 'ods' ? new OpendatasoftAdapter(portal) : new CkanDcatAdapter(portal);
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
    // The only shipped snapshot is Basel-Stadt's; another portal must not silently show Basel
    // data. It gets an empty catalogue that says why, rather than a page stuck on "Loading".
    if (!portal.snapshot) {
      return {
        adapter: live,
        state: {
          source: 'fallback',
          loadedAt: loadedAt(),
          datasets: [],
          error: error instanceof Error ? error.message : 'Unknown catalogue error',
          notes: [`${portal.shortLabel} could not be loaded and has no offline snapshot, so no datasets are shown.`],
        },
      };
    }
    const fallback = new FallbackCatalogueAdapter();
    return {
      adapter: fallback,
      state: {
        source: 'fallback',
        loadedAt: loadedAt(),
        datasets: await fallback.listDatasets(),
        error: error instanceof Error ? error.message : 'Unknown catalogue error',
        notes: [
          `Showing a frozen offline snapshot of a small ${portal.shortLabel} dataset set.`,
          'Sample-level evidence is unavailable in fallback mode.',
        ],
      },
    };
  }
}
