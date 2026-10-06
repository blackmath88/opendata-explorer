import { describe, expect, it } from 'vitest';
import { fallbackDatasets } from './data/fallback';
import { buildCatalogueNetwork, NETWORK_LENSES, networkPath, networkHash, parseNetworkHash, type NetworkLens } from './network-navigation';

describe('complete, stable catalogue navigation', () => {
  it.each(Object.keys(NETWORK_LENSES) as NetworkLens[])('includes each dataset exactly once in the %s overview and drill-down', lens => {
    const root = buildCatalogueNetwork(fallbackDatasets, { lens, path: [] });
    const ids = fallbackDatasets.map(dataset => dataset.id).sort();
    expect(root.includedIds.slice().sort()).toEqual(ids);
    expect(root.nodes.filter(node => node.kind === 'dataset')).toHaveLength(ids.length);
    const leafIds = root.groups.flatMap(group => {
      const children = buildCatalogueNetwork(fallbackDatasets, { lens, path: group.path });
      expect(children.datasets).toHaveLength(group.count);
      return children.groups.flatMap(child => {
        const leaf = buildCatalogueNetwork(fallbackDatasets, { lens, path: child.path });
        expect(leaf.datasets).toHaveLength(child.count);
        return leaf.includedIds;
      });
    });
    expect(leafIds.sort()).toEqual(ids);
  });

  it('preserves all datasets and positions during search and source reordering', () => {
    const location = { lens: 'topic' as const, path: [] };
    const original = buildCatalogueNetwork(fallbackDatasets, location);
    const searched = buildCatalogueNetwork([...fallbackDatasets].reverse(), location, 'zz-no-such-dataset');
    expect(searched.includedIds).toEqual(original.includedIds);
    expect(searched.matchingIds.size).toBe(0);
    expect(searched.nodes.map(({ matching, ...node }) => node)).toEqual(original.nodes.map(({ matching, ...node }) => node));
    expect(searched.links).toEqual(original.links);
  });

  it('searches the whole catalogue even from a scoped view', () => {
    const dataset = fallbackDatasets[0];
    const path = networkPath(dataset, 'topic');
    const scoped = buildCatalogueNetwork(fallbackDatasets, { lens: 'topic', path }, dataset.id);
    expect(scoped.matchingIds.has(dataset.id)).toBe(true);
    expect(scoped.datasets.every(item => networkPath(item, 'topic').join('/') === path.join('/'))).toBe(true);
  });

  it('retains undeclared publishers and flattens without hiding datasets', () => {
    const unknown = { ...fallbackDatasets[0], publisher: ' ' };
    const graph = buildCatalogueNetwork([unknown], { lens: 'publisher', path: [] }, '', true);
    expect(graph.groups[0].label).toBe('Publisher not declared');
    expect(graph.includedIds).toEqual([unknown.id]);
    expect(graph.nodes.every(node => node.z === 0 && node.fz === 0)).toBe(true);
  });

  it('does not mutate canonical catalogue records', () => {
    const before = JSON.stringify(fallbackDatasets);
    const graph = buildCatalogueNetwork(fallbackDatasets, { lens: 'topic', path: [] });
    graph.nodes[0].x = 999;
    graph.links[0].source = 'mutated-renderer-object';
    expect(JSON.stringify(fallbackDatasets)).toBe(before);
    expect(graph.links.every(link => /not a validated data relationship/.test(link.label))).toBe(true);
  });
});

describe('shareable catalogue location', () => {
  it('round-trips Unicode, reserved characters, search and selection', () => {
    const address = { lens: 'publisher' as const, path: ['Département / A&B', 'People & Society'], dataset: 'dataset/a?b', query: 'école + espace' };
    expect(parseNetworkHash(networkHash(address))).toEqual(address);
  });
  it.each(['invalid', '__proto__', 'toString', 'constructor'])('rejects invalid lens %s', lens => {
    expect(parseNetworkHash(`#lens=${lens}&path=one&path=two&path=three`).lens).toBe('topic');
    expect(parseNetworkHash('#path=one&path=two&path=three').path).toEqual(['one', 'two']);
  });
});
