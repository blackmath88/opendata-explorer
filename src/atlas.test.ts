import { describe, expect, it } from 'vitest';
import { atlasPath, atlasSummaries, datasetsAtPath, type AtlasLens } from './atlas';
import { fallbackDatasets } from './data/fallback';
import type { DatasetMatch } from './types';

const matches: DatasetMatch[] = fallbackDatasets.map((dataset, index) => ({
  dataset,
  evidenceClass: index === 0 ? 'direct' : index === 1 ? 'supporting' : 'contextual',
  roleIds: [],
  relevance: { score: Math.max(0, 80 - index), matchedTerms: [], explanation: '' },
}));

describe('hierarchical Atlas', () => {
  it.each<AtlasLens>(['topic', 'space', 'time', 'readiness'])('assigns every dataset to one %s path', lens => {
    const paths = fallbackDatasets.map(dataset => atlasPath(dataset, lens));
    expect(paths.every(path => path.category && path.subcategory)).toBe(true);
    const summaries = atlasSummaries(fallbackDatasets, matches, { lens }, new Set(fallbackDatasets.map(dataset => dataset.id)));
    expect(summaries.reduce((sum, node) => sum + node.total, 0)).toBe(fallbackDatasets.length);
  });

  it('only exposes populated subcategories and preserves their complete dataset count', () => {
    const top = atlasSummaries(fallbackDatasets, matches, { lens: 'topic' }, new Set());
    const category = top[0];
    const children = atlasSummaries(fallbackDatasets, matches, { lens: 'topic', category: category.label }, new Set());
    expect(children.length).toBeGreaterThan(0);
    expect(children.every(child => child.total > 0)).toBe(true);
    expect(children.reduce((sum, child) => sum + child.total, 0)).toBe(category.total);
  });

  it('reports independent search counts without removing taxonomy nodes', () => {
    const searchedId = fallbackDatasets[0].id;
    const summaries = atlasSummaries(fallbackDatasets, matches, { lens: 'topic' }, new Set([searchedId]));
    expect(summaries.reduce((sum, node) => sum + node.matching, 0)).toBe(1);
    expect(summaries.reduce((sum, node) => sum + node.total, 0)).toBe(fallbackDatasets.length);
    expect(summaries.some(node => node.matching === 0)).toBe(true);
  });

  it('drills to exactly the datasets assigned to a subcategory', () => {
    const first = fallbackDatasets[0];
    const path = atlasPath(first, 'topic');
    const datasets = datasetsAtPath(fallbackDatasets, { lens: 'topic', ...path });
    expect(datasets).toContain(first);
    expect(datasets.every(dataset => atlasPath(dataset, 'topic').category === path.category && atlasPath(dataset, 'topic').subcategory === path.subcategory)).toBe(true);
  });
});
