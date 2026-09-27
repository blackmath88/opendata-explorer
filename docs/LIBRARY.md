# The library (3D shelf)

`/library/` shows one category of a catalogue as a shelf of generated books. The first shelf is
Basel-Stadt, Mobility & Transport: 58 datasets in 6 groups.

It is a view onto the catalogue, not a new catalogue. Every book is a real dataset with a link to
the catalogue and to its source page.

## What the shelf encodes

The encoding is the same as the covers (docs/COVERS.md). Nothing new is invented for 3D.

| Physical property | Fact |
|---|---|
| Cloth colour | category |
| Glyph on the spine, board label | subcategory |
| Spine width (5 bands) | record count |
| Cover art (seen when a book is pulled out) | the dataset's own sample |
| Bookmark notches | documented reuses |
| Patina | overdue against its own declared rhythm |
| Paper tab above the book | doorway: ready, rarely used (one per group) |
| Dashed spine | form unknown |

## Rules the view keeps

- **Count conservation.** Every dataset is on the shelf, and all of them are also in the plain
  list under the stage. Group labels show counts.
- **Order is alphabetical within a group.** Position never encodes a value.
- **Search highlights; it never reflows.** Matches light up, the rest dim, and no book moves.
- **Anything you must read is HTML:** labels, tooltip, the open-book panel and the list. There is
  no 3D text.
- **Fallbacks.** Without WebGL, or with `?mode=2d`, the same shelf is drawn in 2D.
  `prefers-reduced-motion` turns off the tweens and parallax.
- **Keyboard.** Arrow keys move focus along the shelf, Enter opens a book and Escape puts it back.

## Data

`npx tsx scripts/library-data.ts --portal bs --category "Mobility & Transport"` writes
`public/library/bs-mobility-transport.json`. The script makes no live requests. It reads:

- the snapshot
- `src/data/portals/bs/cover-samples.json`
- the usage figures (dataset 100057)

Each book in the file carries its spine and cover as SVG. The page turns them into textures.

## Code

- `src/library/layout.ts`: packs groups onto boards (pure, tested).
- `src/library/main.ts`: the three.js scene, the 2D fallback, the panel, search and keyboard.
- `library/index.html`, `src/library/library.css`: the page.

## Limits

- The data is a snapshot (see `asOf` in the JSON), not live.
- Spine glyphs are small at the default distance. Hover or focus shows the title.
- There is one category so far. More shelves only need the data script run with another
  `--category`, plus a covers sample for that category.
