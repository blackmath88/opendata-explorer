/**
 * Shelf layout, pure and deterministic. Groups stay contiguous and in their given order; books
 * keep their order inside a group (alphabetical, stated on screen). A group starts on the current
 * board if it fits whole, or if the board is still mostly empty; otherwise on a fresh board. A group
 * wider than a board wraps. Every book is placed exactly once.
 */
export interface ShelfItem { id: string; width: number }
export interface ShelfGroupIn { name: string; items: ShelfItem[] }
export interface PlacedBook { id: string; group: string; board: number; x: number; width: number }
export interface GroupStart { group: string; board: number; x: number }
export interface ShelfLayout { books: PlacedBook[]; starts: GroupStart[]; boards: number; boardWidth: number }

export const GAP = 1.2;
/** Space for a bookend between two groups sharing a board. */
export const BOOKEND = 8;

export function layoutShelf(groups: readonly ShelfGroupIn[], boardWidth: number): ShelfLayout {
  const books: PlacedBook[] = [];
  const starts: GroupStart[] = [];
  let board = 0;
  let x = 0;
  for (const group of groups) {
    const width = group.items.reduce((sum, item) => sum + item.width + GAP, 0);
    if (x > 0) {
      const room = boardWidth - x - BOOKEND;
      if (width <= room || x < boardWidth * 0.25) x += BOOKEND;
      else { board += 1; x = 0; }
    }
    starts.push({ group: group.name, board, x });
    for (const item of group.items) {
      if (x > 0 && x + item.width > boardWidth) { board += 1; x = 0; }
      books.push({ id: item.id, group: group.name, board, x, width: item.width });
      x += item.width + GAP;
    }
  }
  return { books, starts, boards: board + 1, boardWidth };
}
