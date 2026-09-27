import { describe, expect, it } from 'vitest';
import { buildAtlasHierarchy, type AtlasHierarchyDatum } from './atlas';
import { fallbackDatasets } from './data/fallback';
import { CADENCES, SHAPES, cadenceOf, profile, shapeOf } from './catalogue-profile';
import type { DatasetRecord } from './types';

const leaves = (node: AtlasHierarchyDatum): string[] => node.kind === 'dataset' ? [node.dataset!.id] : (node.children ?? []).flatMap(leaves);

describe('catalogue profile', () => {
  it('conserves counts: every row sums to the total', () => {
    const fp = profile(fallbackDatasets);
    expect(fp.total).toBe(fallbackDatasets.length);
    expect(SHAPES.reduce((sum, key) => sum + fp.shape[key], 0)).toBe(fp.total);
    expect(CADENCES.reduce((sum, key) => sum + fp.cadence[key], 0)).toBe(fp.total);
  });

  it('conserves counts per top-level card: card fingerprints add up to the catalogue', () => {
    const root = buildAtlasHierarchy(fallbackDatasets, [], 'topic', new Set());
    const byId = new Map(fallbackDatasets.map(dataset => [dataset.id, dataset]));
    const cards = root.children!.map(card => profile(leaves(card).map(id => byId.get(id)!)));
    expect(cards.reduce((sum, fp) => sum + fp.total, 0)).toBe(fallbackDatasets.length);
    for (const key of SHAPES) expect(cards.reduce((sum, fp) => sum + fp.shape[key], 0)).toBe(profile(fallbackDatasets).shape[key]);
  });

  it('reads cadence from the declared frequency, not the realtime flag', () => {
    const base = fallbackDatasets[0];
    const declared = (updateFrequency: string | undefined, realtime = false): DatasetRecord => ({ ...base, characteristics: { ...base.characteristics, updateFrequency, realtime } });
    expect(cadenceOf(declared('monthly', true))).toBe('periodic');
    expect(cadenceOf(declared('hourly'))).toBe('frequent');
    expect(cadenceOf(declared('irreg', true))).toBe('irregular');
    expect(cadenceOf(declared('as needed'))).toBe('irregular');
    expect(cadenceOf(declared('never'))).toBe('none');
    expect(cadenceOf(declared('triennial'))).toBe('periodic');
    expect(cadenceOf(declared(undefined))).toBe('unknown');
  });

  it('makes unknown a real bucket, not a gap', () => {
    const base = fallbackDatasets[0];
    const bare: DatasetRecord = { ...base, recordsCount: undefined, characteristics: { ...base.characteristics, geospatial: true, geometryType: undefined, geometryTypes: [], updateFrequency: undefined } };
    expect(shapeOf(bare)).toBe('unknown');
    const fp = profile([bare]);
    expect(fp.shape.unknown).toBe(1);
    expect(fp.cadence.unknown).toBe(1);
    expect(fp.recordsUnknown).toBe(1);
    expect(fp.recordsMedian).toBeNull();
  });
});

describe('question overlay', () => {
  it('highlights without reflowing: same cards, same counts, same rectangles with or without a question', async () => {
    const { layoutTiles } = await import('./ui/graph');
    const matches = fallbackDatasets.slice(0, 6).map((dataset, index) => ({
      dataset, evidenceClass: index < 2 ? 'direct' as const : 'supporting' as const, roleIds: ['r'], relevance: { score: 90 - index, matchedTerms: [], explanation: '' },
    }));
    const plain = buildAtlasHierarchy(fallbackDatasets, [], 'topic', new Set());
    const asked = buildAtlasHierarchy(fallbackDatasets, matches, 'topic', new Set(matches.map(match => match.dataset.id)));
    expect(asked.children!.map(card => [card.id, card.total])).toEqual(plain.children!.map(card => [card.id, card.total]));
    const rects = (root: AtlasHierarchyDatum) => layoutTiles(root.children!, 1000, 640).map(tile => [tile.node.id, tile.x, tile.y, tile.width, tile.height]);
    expect(rects(asked)).toEqual(rects(plain));
    expect(asked.children!.some(card => card.direct > 0)).toBe(true);
  });
});
