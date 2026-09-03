import { describe, expect, it } from 'vitest';
import { fallbackDatasets as FALLBACK_DATASETS } from './data/fallback';
import { catalogueStatus, canCompose, filterCatalogue, selectCatalogueView, workspaceLabel } from './catalogue-ui';
import type { CatalogState } from './types';

const filters = { query: '', topic: 'all', geospatial: false, temporal: false };

describe('catalogue navigation', () => {
  it('searches independently by exact dataset id, keyword and publisher', () => {
    expect(filterCatalogue(FALLBACK_DATASETS, { ...filters, query: '100008' }).some(d => d.id === '100008')).toBe(true);
    expect(filterCatalogue(FALLBACK_DATASETS, { ...filters, query: 'Brunnen' }).some(d => /brunnen/i.test(d.title))).toBe(true);
    const publisher = FALLBACK_DATASETS.find(d => d.publisher)?.publisher ?? '';
    expect(filterCatalogue(FALLBACK_DATASETS, { ...filters, query: publisher }).length).toBeGreaterThan(0);
  });

  it('makes live completeness and fallback state explicit', () => {
    const live: CatalogState = { source: 'live', loadedAt: '', datasets: FALLBACK_DATASETS, reportedTotal: FALLBACK_DATASETS.length, notes: [] };
    const fallback: CatalogState = { source: 'fallback', loadedAt: '', datasets: FALLBACK_DATASETS, notes: [] };
    expect(catalogueStatus(live)).toEqual({ complete: true, label: `LIVE · Basel-Stadt OGD · ${FALLBACK_DATASETS.length} / ${FALLBACK_DATASETS.length} datasets loaded` });
    expect(catalogueStatus({ ...live, reportedTotal: live.datasets.length + 1 }).complete).toBe(false);
    expect(catalogueStatus(fallback).label).toContain('FALLBACK');
  });

  it('requires two datasets for Compose', () => {
    expect(canCompose(0)).toBe(false);
    expect(canCompose(1)).toBe(false);
    expect(canCompose(2)).toBe(true);
    expect(canCompose(3)).toBe(true);
    expect(workspaceLabel(3)).toBe('Workspace · 3');
  });

  it('retains explicit List and Landscape view state', () => {
    expect(selectCatalogueView('list')).toBe('list');
    expect(selectCatalogueView('landscape')).toBe('landscape');
  });

});
