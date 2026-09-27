import { describe, expect, it } from 'vitest';
import { BOOKEND, layoutShelf } from './layout';

const group = (name: string, n: number, width = 10) => ({ name, items: Array.from({ length: n }, (_, i) => ({ id: `${name}-${i}`, width })) });

describe('shelf layout', () => {
  const groups = [group('road', 34, 14), group('cycling', 13, 12), group('parking', 5), group('transit', 4), group('walking', 2)];
  const layout = layoutShelf(groups, 560);

  it('places every book exactly once, in order', () => {
    const ids = groups.flatMap(g => g.items.map(item => item.id));
    expect(layout.books.map(book => book.id)).toEqual(ids);
  });

  it('keeps each board within its width', () => {
    for (const book of layout.books) expect(book.x + book.width).toBeLessThanOrEqual(560);
  });

  it('keeps groups contiguous and lets small groups share a board with a bookend between', () => {
    expect(layout.starts.map(start => start.group)).toEqual(['road', 'cycling', 'parking', 'transit', 'walking']);
    const walking = layout.starts.find(start => start.group === 'walking')!;
    const transit = layout.starts.find(start => start.group === 'transit')!;
    expect(walking.board).toBe(transit.board);
    expect(walking.x).toBeGreaterThan(transit.x + BOOKEND);
    expect(layout.boards).toBe(2);
  });

  it('wraps a group wider than a board', () => {
    const wide = layoutShelf([group('wide', 30, 20)], 200);
    expect(wide.boards).toBe(4); // 9 books of 20 + gap fit a 200 board
    expect(new Set(wide.books.map(book => book.board))).toEqual(new Set([0, 1, 2, 3]));
  });

  it('is deterministic', () => {
    expect(layoutShelf(groups, 560)).toEqual(layout);
  });
});
