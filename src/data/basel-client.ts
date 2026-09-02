import type { CatalogState, DatasetRecord } from '../types';
import { normalizeOdsDataset } from './normalize';
import { fallbackDatasets } from './fallback';

const API_BASE = 'https://data.bs.ch/api/explore/v2.1';
const PAGE_SIZE = 100;
const MAX_DATASETS = 1000;

interface OdsCatalogResponse {
  total_count?: number;
  results?: unknown[];
}

export async function loadBaselCatalog(): Promise<CatalogState> {
  try {
    const datasets: DatasetRecord[] = [];
    let offset = 0;
    let total = Infinity;

    while (offset < total && offset < MAX_DATASETS) {
      const url = new URL(`${API_BASE}/catalog/datasets`);
      url.searchParams.set('limit', String(PAGE_SIZE));
      url.searchParams.set('offset', String(offset));
      url.searchParams.set('lang', 'en');

      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Basel OGD returned HTTP ${response.status}`);

      const body = (await response.json()) as OdsCatalogResponse;
      const page = Array.isArray(body.results) ? body.results : [];
      total = typeof body.total_count === 'number' ? body.total_count : page.length;
      datasets.push(...page.map(normalizeOdsDataset).filter((d): d is DatasetRecord => Boolean(d)));

      if (page.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    if (!datasets.length) throw new Error('Basel OGD catalogue returned no datasets');

    return { source: 'live', loadedAt: new Date().toISOString(), datasets };
  } catch (error) {
    return {
      source: 'fallback',
      loadedAt: new Date().toISOString(),
      datasets: fallbackDatasets,
      error: error instanceof Error ? error.message : 'Unknown catalogue error',
    };
  }
}
