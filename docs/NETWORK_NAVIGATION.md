# Catalogue network navigation prototype

Run `npm ci` and `npm run dev`, then open `/explore/?portal=bs`.
The catalogue toolbar also links to **Explore network**. This is an additive
experiment; the proposal and existing catalogue/evidence workbench remain the
primary workflow. It is independent of the library/book-shelf branches.

## Navigation

- Start with labelled topic hubs, each containing every dataset assigned to it.
- Select a hub to enter its subtopics, then enter a subtopic to inspect datasets.
- Switch grouping to publisher, data shape or time. From a selected dataset,
  these lenses open the corresponding neighbourhood.
- Search all loaded datasets by existing catalogue search semantics. Matches are
  highlighted without removing graph nodes or moving their positions. The list
  shows complete global results, including matches outside the current scope.
- Inspect a dataset's published metadata and original source, or continue to its
  evidence-workbench inspector. Discovery edges are not evidence validation.
- Breadcrumbs, browser back/forward and copied URLs retain the lens, path, search
  and selected dataset. A stale path returns to the overview; an absent dataset
  produces the existing coverage-aware missing-link message.

The left list contains all scoped datasets without a display cap. It supports
keyboard navigation, mobile browsing and browsers without WebGL. `/` focuses
search; Escape closes the details or moves up a level. A flat 2D layout and
Fit view control are available. Reduced motion suppresses camera animation.

## What the graph means

`3d-force-graph` supplies orbit navigation and Three.js rendering; SpriteText
supplies labels. Dataset coordinates are deterministic and fixed. Search and
selection do not restart a force simulation or rearrange the map.

Every dataset is represented once per view. Group counts partition the loaded
catalogue. Topic, shape and time paths reuse the existing Atlas classifications;
publisher paths use published metadata followed by topic. Undeclared values
remain discoverable through the existing unknown categories. Edges express
group membership. Distance, colour and shared membership do not prove semantic
similarity, joinability or geographic/temporal compatibility.

Only disposable projection objects enter the renderer. Canonical catalogue
records are never passed to the graph library.

## Coverage and limits

The route uses `openCatalogue`, including live/partial status and adapter notes.
Basel-Stadt falls back to its existing **44-dataset frozen snapshot** on failure;
other portals have no snapshot and display their loading failure with no data.
Coverage is visible at all times. Search covers loaded metadata, not full dataset
records. No LLM, embedding index, invented cross-dataset relationship, schema
validation or automatic composition is introduced.

3D dependencies load only on this route and add roughly 425 KB gzip (Three.js
and the graph bundle) plus labels. Large catalogues can still be visually dense;
drill-down and the full list remain the reliable route to individual datasets.
This prototype needs user testing before it replaces any default view.

## Verification

`npm test` covers existing catalogue/evidence behaviour and adds network checks
for complete coverage at each level, stable layout across searches and ordering,
undeclared publishers, flat layout, metadata isolation and URL round-tripping.
`npm run build` validates TypeScript and builds the three routes. Vite's existing
`BASE_PATH` setting applies to the new route and links for GitHub Pages.

Browser visual/interactions review remains outstanding: the available browser
could not reach the local server and policy blocked opening a local HTML preview.
The passing checks do not establish rendered layout quality or WebGL behaviour.
