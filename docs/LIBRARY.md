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

## Question shelves

`/library/?q=<use case>` fills a shelf with the datasets that fit a question, across the whole
catalogue (all 363 Basel datasets). It is rule-based and runs no model; the code is in
`src/library/question.ts`.

1. **Recognise concepts.** `parseUseCaseIntent` turns words into concepts using the shared
   vocabulary (`src/vocabulary.ts`).
2. **Build the plan.** `buildEvidencePlan` picks one dataset per role. The first group, "The
   plan", holds these books in role order. A role that no dataset fills stays on the shelf as a
   **dashed, empty slot**, and its text says whether the gap was checked.
3. **One group per recognised concept.** It holds every other dataset whose title or keywords
   start a word with one of the concept's catalogue terms, sorted alphabetically.
   - Word start, not substring: "sport" must not match "Transport", and "bewegung" must not
     match "Flugbewegungen".
   - A book that is there only because of a publisher keyword says so.
4. **One group per unknown word** that starts a word in some title. Filler words ("gibt",
   "meiner") are skipped.

Rules the shelf keeps:
- Every dataset appears once.
- A group longer than 14 books ends in a paper "+N more" slot. The list below the shelf names
  every dataset, folded ones included, and the page header gives the count ("50 of 363 fit, 30
  on the shelf").
- Words the vocabulary does not know are shown as "Not recognised", never guessed.
- Without a recognised concept there is no plan: the shelf shows only literal title matches, or
  an empty state.

Known limits:
- The vocabulary has 23 concepts. Unusual phrasing misses, and the chips show that. New words
  are added when a real question misses: "Laufroute", "laut", "Schulweg" and "Sitzbänke" were
  added this way.
- The evidence planner still scores by substring, so a plan slot can be weaker than the concept
  groups. Each plan book shows the role's reason.
- The page loads `public/library/bs-catalogue.json`, about 1.2 MB raw and about 250 KB with
  gzip. Samples load per category, and only for the categories on the shelf.

## Data

`npx tsx scripts/library-data.ts --portal bs --category "Mobility & Transport"` writes
`public/library/bs-mobility-transport.json`. The script makes no live requests. It reads:

- the snapshot
- `src/data/portals/bs/cover-samples.json`
- the usage figures (dataset 100057)

Each book in the file carries its spine and cover as SVG. The page turns them into textures.

Question shelves use a different set of files:
- `npx tsx scripts/library-catalogue.ts --portal bs` writes `public/library/bs-catalogue.json`
  (every dataset, its topic path, its usage figures and the canton outline) and
  `public/library/samples/bs-<category>.json`.
- The covers are generated in the browser with the same `coverSvg`.
- `scripts/portal-outline.ts` fetched the canton outline (dataset 100017, the three communes).

## Code

- `src/library/layout.ts`: packs groups onto boards (pure, tested).
- `src/library/main.ts`: the three.js scene, the 2D fallback, the panel, search and keyboard.
- `library/index.html`, `src/library/library.css`: the page.

## Limits

- The data is a snapshot (see `asOf` in the JSON), not live.
- Spine glyphs are small at the default distance. Hover or focus shows the title.
- There is one category shelf so far (Mobility). Question shelves cover every category.
