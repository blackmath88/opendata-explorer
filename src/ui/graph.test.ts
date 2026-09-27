import { describe, expect, it } from 'vitest';
import { buildAtlasHierarchy } from '../atlas';
import { fallbackDatasets } from '../data/fallback';
import { layoutTiles } from './graph';

describe('Atlas treemap layout', () => {
  const root = buildAtlasHierarchy(fallbackDatasets, [], 'topic', new Set());

  it('tiles every child inside the canvas without overlap', () => {
    const tiles = layoutTiles(root.children!, 900, 560);
    expect(tiles).toHaveLength(root.children!.length);
    for (const tile of tiles) {
      expect(tile.x).toBeGreaterThanOrEqual(0);
      expect(tile.y).toBeGreaterThanOrEqual(0);
      expect(tile.x + tile.width).toBeLessThanOrEqual(900);
      expect(tile.y + tile.height).toBeLessThanOrEqual(560);
    }
    for (const [i, a] of tiles.entries()) for (const b of tiles.slice(i + 1)) {
      const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      expect(overlap).toBe(false);
    }
  });

  it('gives larger categories more area but keeps tiny ones clickable', () => {
    const tiles = layoutTiles(root.children!, 900, 560);
    const area = (index: number) => tiles.find(tile => tile.node === root.children![index])!;
    const largest = area(0);
    const smallest = area(root.children!.length - 1);
    expect(largest.width * largest.height).toBeGreaterThan(smallest.width * smallest.height);
    expect(smallest.width * smallest.height).toBeGreaterThan(900 * 560 * 0.01);
  });

  it('returns nothing for an empty canvas', () => {
    expect(layoutTiles(root.children!, 0, 400)).toEqual([]);
  });
});
