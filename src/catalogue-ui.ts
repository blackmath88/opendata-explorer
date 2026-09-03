import type { CatalogState, DatasetMatch, DatasetRecord } from './types';

export type CatalogueView = 'list' | 'landscape';

export interface CatalogueFilters {
  query: string;
  topic: string;
  geospatial: boolean;
  temporal: boolean;
}

export const DEFAULT_CATALOGUE_FILTERS: CatalogueFilters = {
  query: '',
  topic: 'all',
  geospatial: false,
  temporal: false,
};

export function filterCatalogue(datasets: DatasetRecord[], filters: CatalogueFilters): DatasetRecord[] {
  const needle = filters.query.trim().toLocaleLowerCase();
  return datasets.filter(dataset => {
    if (filters.topic !== 'all') {
      const topics = [...dataset.semantic.topics, ...dataset.themes].map(value => value.toLocaleLowerCase());
      if (!topics.some(value => value.includes(filters.topic.toLocaleLowerCase()))) return false;
    }
    if (filters.geospatial && !dataset.characteristics.geospatial) return false;
    if (filters.temporal && !dataset.characteristics.timeSeries && !dataset.characteristics.temporalCoverage.length) return false;
    if (!needle) return true;
    const searchable = [
      dataset.id,
      dataset.title,
      dataset.description,
      dataset.publisher,
      ...dataset.keywords,
      ...dataset.themes,
      ...dataset.semantic.topics,
    ].join(' ').toLocaleLowerCase();
    return searchable.includes(needle);
  });
}

export function catalogueStatus(catalog: CatalogState): { label: string; complete: boolean } {
  const complete = catalog.reportedTotal === undefined || catalog.reportedTotal === catalog.datasets.length;
  return {
    complete,
    label: catalog.source === 'live'
      ? `LIVE · Basel-Stadt OGD · ${catalog.datasets.length} / ${catalog.reportedTotal ?? catalog.datasets.length} datasets loaded${complete ? '' : ' · partial'}`
      : `FALLBACK · ${catalog.datasets.length} cached datasets`,
  };
}

export const GRAPH_NODE_LIMIT = 80;
export const GRAPH_LABEL_LIMIT = 24;

/** Stable graph input: score first, dataset id as deterministic tie-breaker. */
export function selectGraphMatches(matches: DatasetMatch[]): DatasetMatch[] {
  return [...matches]
    .sort((a, b) => b.relevance.score - a.relevance.score || a.dataset.id.localeCompare(b.dataset.id))
    .slice(0, GRAPH_NODE_LIMIT);
}

export function canCompose(workspaceSize: number): boolean {
  return workspaceSize >= 2;
}

export function selectCatalogueView(view: CatalogueView): CatalogueView {
  return view;
}

export function workspaceLabel(size: number): string {
  return `Workspace · ${size}`;
}
