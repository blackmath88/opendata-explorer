# Knowledge discovery: Questions, Chat, Landscape

Status: product concept and research handoff, not an assertion that every feature below is implemented. Read alongside [ARCHITECTURE.md](ARCHITECTURE.md), [MCP.md](MCP.md), [UX_EVALUATION.md](UX_EVALUATION.md), and [PRIOR_ART.md](PRIOR_ART.md). This document focuses on how people discover evidence; it does not replace the existing Discover -> Build -> Result workflow or the rule that compatibility must be validated.

## Product thesis

Open-data portals largely make people browse lists of datasets. DataFit instead helps them form a mental picture of the available evidence, turn a concrete question into candidate sources, and learn where data is absent or inadequate. The three complementary entrances are:

| Entrance | Starts with | Gives the person | Must not imply |
| --- | --- | --- | --- |
| Questions | A curated example such as a comfortable running route | An editable evidence plan and useful example datasets | That the example generalizes to every location or season |
| Chat | Their own question in natural language, potentially through an external MCP host | Ranked candidates, evidence roles, limitations and follow-up inspections | That a plausible match is a validated join or a computed answer |
| Landscape | No question at all | Intuitive orientation in the entire catalogue: what exists, its structure, rich/thin regions and directions to explore | That only the prominent or labeled items exist |

All three entrances converge on the same canonical dataset identifiers, inspector, evidence-role vocabulary, provenance and Build/Result path. The user can move between entrances without losing selected datasets or question context. Questions is editorial, Chat is intent-driven, Landscape is catalogue-driven. No entrance should silently replace the catalogue with a subset.

## Existing foundation and boundaries

The repository already has `src/mcp/tools.ts`, `src/mcp/schemas.ts`, and [MCP.md](MCP.md): `search_datasets`, `build_evidence_plan`, `resolve_missing_evidence`, `inspect_dataset`, `assess_compatibility`, `validate_relationship`, `suggest_representation`, and `build_result`. `search_datasets` ranks local Basel catalogue evidence; it does not search the web or prove compatibility. Chat is an interface for those capabilities, not a proposed replacement ranking engine. MCP support for external LLM hosts does not, by itself, mean an embedded chat frontend exists.

The UI already distinguishes List and Landscape; preserve List as the complete, stable, exact-title route. Previous graph and circle-packing evaluations and the current category-card direction are documented in [UX_EVALUATION.md](UX_EVALUATION.md). Do not revive a moving graph to make the product look like Open Knowledge Maps. The questions canvas and the catalogue landscape solve different problems.

A catalogue count is source-dependent and time-dependent. Do not hard-code the previously observed 361 live / 44 offline counts into UI claims. Display `N live datasets`, or `N in offline snapshot; live catalogue unavailable`, with retrieval time, applied filters, shown count, and a link to all included records. Missing evidence is a status of a question requirement, not a dataset category. Never confuse dataset records with rows within one dataset.

## 1. Questions: curated evidence canvases

A question canvas is a worked, editable example, not an infographic that merely advertises use cases. It states the question, place, time assumptions, required evidence roles, candidate datasets, proxy relationships, gaps, uncertainty, and a path into Build. Example: Basel running comfort needs a route network, fountains, air quality, traffic and shade. Tree positions may be a shade proxy but do not establish shade on a route at a chosen hour; a station measurement does not establish air quality on every street.

Each requirement shows: `need -> dataset candidates -> what is actually measured -> fit (direct/supporting/contextual) -> structural readiness -> gap/limitation`. Selecting a candidate opens the shared inspector. A user can edit assumptions, replace a candidate, ask Chat about a gap, or reveal the relevant location in Landscape. Curated examples should link to versioned dataset IDs and be rechecked as the source catalogue changes; never silently use an old selection with a new metadata interpretation.

## 2. Chat: grounded, navigable discovery

The LLM can clarify intent and narrate findings, but DataFit owns the retrieval, evidence plan and validation statuses. Suggested orchestration: parse question and scope -> call `search_datasets` and `build_evidence_plan` -> inspect important candidates -> resolve weak/missing roles if warranted -> assess compatibility only for proposed relationships -> validate only relationships needed for a specific output. Mark each claim as catalogue fact, DataFit inference, sampled observation, validated result or unresolved assumption. Show dataset IDs, publisher links, source/snapshot provenance and why each candidate was proposed.

Offer actions in a chat answer: `Open dataset`, `Show in Landscape`, `Add to evidence plan`, `Inspect fields`, `Check this combination`. A tool result is not permission to say a route was computed. If the offline snapshot lacks a dataset, report a snapshot limitation rather than declaring a global absence. External trusted-source resolution must be labeled separately from Basel catalogue coverage. Preserve the boundaries in [MCP.md](MCP.md), including that registry candidates do not establish compatibility.

Technical opportunity: the MCP specification supports machine-readable `structuredContent` and optional output schemas; the repo already uses structured content. Prefer typed IDs, reason codes and evidence-status fields over parsing chat prose. A read-only aggregate/landscape tool could be added later only if an external host needs catalogue overview; it is not required for the browser UI. Do not expose raw unbounded records or execute expensive scans for every chat turn.

## 3. Landscape: Anschauung of the catalogue

Success criterion: on first view someone can say which kinds of datasets exist, where the catalogue is rich or thin, what the data *looks like structurally*, and where to dig next. Showing every title simultaneously is neither required nor desirable. Making a category card large solely because it has many datasets is insufficient. The first screen must contain meaningful labels, counts, representative subtopics and data-character cues.

Keep the existing legible category-card geometry, but make each card a **catalogue fingerprint** with a stable grammar:

- **Identity:** human-readable topic, count and two to four meaningful subtopic labels. An `Other (N)` remainder must open its N named records; it cannot be blank space.
- **Shape:** a short count profile for point / line / area / raster / table / unknown. This means metadata about the dataset, not a map claiming actual geographic coverage.
- **Time:** static / periodically updated / frequently updated / unknown, derived from available cadence metadata; distinguish update cadence from the actual observation period.
- **Depth:** optional record-count range or median with unknowns clearly labeled; three link rows to a raster are not three raster pixels. Avoid implying record count alone equals quality.
- **Question overlay:** only when a question is active, add direct/supporting/contextual match counts. Highlight rather than reflow the cards; keep unmatched cards reachable.

Illustrative card, with deliberately fictional counts:

```text
MOBILITY                                        62 datasets
Street network 24 | Traffic 16 | Transit 14 | Other 8 ->
Geometry: lines 31 | points 19 | tables 12
Cadence: static 35 | periodic 18 | frequent 9
For this question: 2 direct + 5 supporting -> inspect 7
```

The numbers and classifications above are *not Basel catalogue facts*. Use a single-primary-topic partition if topic card counts must sum to the catalogue total; for multi-valued tags, explicitly say that facets overlap and counts do not sum. `Unknown` is a first-class bucket. Preserve a separate exact-title List view and avoid representing a cropped 80-item visualization as all 361 datasets.

Interaction: first view of all cards -> select subtopic or structure filter -> keep global total plus filtered count visible -> show full dataset list and inspector -> return to the same location. Optional second lens: `By topic | By data shape`. Both use the same records and stable IDs. On mobile, stack cards with the same information order; on keyboard, use real buttons/headings and a list fallback. Colour never carries fit or status alone.

## Shared contract and implementation path

Treat the canonical catalogue as the source of truth and derive three projections from it: a complete `LandscapeProfile`, a `QuestionPlan`, and `SearchMatches`. At minimum, a normalized record needs stable ID, title, source URL, source type (live/snapshot/registry), primary topic, tags, geometry type or unknown, temporal cadence or unknown, row-count metadata or unknown, publisher, licence, and field/schema metadata where available. Keep source facts separate from inferred roles and verified compatibility. An aggregate profile contains `source`, `fetchedAt`, `total`, `includedIds`, facet counts and missing-metadata counts. Filtered aggregates must retain the unfiltered denominator and use identical dataset IDs in list and landscape.

Implement deterministic profile generation from the already loaded catalogue first; ~hundreds of metadata records do not justify a new graph backend. Compute aggregations once on refresh and derive filtered counts from ID sets, not display-only subsets. Inspect the existing Basel Opendatasoft adapter before adding calls; the Explore API has catalogue endpoints and facet support, but its record-level `total_count` is not a count of catalogue datasets. A tiny local text index such as MiniSearch is an *optional* later improvement for typo-tolerant known-item search, not a replacement for the existing deterministic ranking. Use CSS/SVG bars or a small Plot chart only where visual comparisons add value; do not import a heavyweight visualization library just for cards.

Open Knowledge Maps' Headstart is technically instructive because it combines generated clusters with a synchronized document list and details on demand. Its backend clusters and labels papers from text/metadata; those algorithms should not define a complete civic dataset catalogue or conceal records that do not fit a cluster. If experimental semantic neighborhoods are explored, put them behind an optional lens, show coverage and membership rules, and retain the canonical topic/shape route. Elastic Lists suggests the most useful Landscape behavior: show the metadata profile of the whole set alongside the currently filtered set, so people can understand what changed without losing orientation. The D3 example is illustrative, not a maintained drop-in dependency.

Suggested delivery slices: (1) verify live/snapshot coverage and counts, normalize metadata and test count conservation; (2) enrich existing cards with subtopic and geometry/cadence profiles while retaining List; (3) connect question/chat match overlays through IDs; (4) build editable curated canvases and cross-view deep links; (5) only then test optional semantic clusters against the clearer baseline. No code change is authorized by this document.

## Acceptance tests and research questions

- Every known catalogue ID remains findable by title in List even if it has no relevance match or metadata category. A missing-metadata dataset appears in a named unknown bucket.
- A card's primary-topic dataset IDs are exactly the IDs in its opened list; primary-topic card counts sum to the current included catalogue count, with any uncategorized records explicitly counted. Multi-tag counts disclose overlap.
- Live API failure swaps the visible denominator and source label to the snapshot; no screen says an absent snapshot record is absent from Basel-Stadt OGD.
- Query overlays change match cues, not the underlying catalogue membership or spatial arrangement; clearing the question restores the original overview.
- In user tests, compare current cards, fingerprint cards and optional knowledge-map lens on: known-item find rate, time to choose a sensible category, correct recall of catalogue structure, recognition of an unrepresented dataset or evidence gap, false belief that data is missing, and keyboard/mobile navigation. Measure whether people can describe *what* is in a category before opening it; clicks alone do not establish understanding.

## Research and technical precedents

| Source | Transferable idea | Limit |
| --- | --- | --- |
| [Open Knowledge Maps / Headstart](https://github.com/OpenKnowledgeMaps/Headstart) | Overview clusters plus synchronized list and details; open-source D3 frontend | Academic paper clustering is not authoritative catalogue coverage; backend includes PHP/R and is not a drop-in UI |
| [Headstart search-flow](https://github.com/OpenKnowledgeMaps/search-flow) | Separate search, waiting and map/detail flow | PHP/JavaScript integration does not match this repo directly |
| [Elastic Lists research](http://archive.stefaner.eu/downloads/papers/Stefaner-2008-Elastic%20Lists%20for%20Facet%20Browsing.pdf) and [D3 example](https://github.com/sirisacademic/d3-elastic-list) | Whole-set versus filtered-set metadata profiles | Old demo, conceptually reusable rather than a production dependency |
| [Information scent](https://www.nngroup.com/articles/information-scent/) | Accurate labels and snippets predict what lies behind a card | Aesthetic category imagery without descriptive value is insufficient |
| [Treemap usability](https://www.nngroup.com/articles/treemaps/) | Broad hierarchy and quantity overview | Area and nested labels are hard to compare or read precisely |
| [Observable Plot facets](https://observablehq.github.io/plot/features/facets) | Small, comparable metadata distributions | Optional; simple DOM bars may suffice |
| [Basel Explore API](https://data.bs.ch/api-console/explore/v2.1/) and [API reference](https://help.opendatasoft.com/apis/ods-explore-v2/) | Source catalogue metadata, filters and facets | Validate dataset-level counts and null semantics; do not equate records with datasets |
| [MCP tools specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) | Structured tool results and schemas for grounded LLM navigation | MCP does not mandate a chat UI or warrant unvalidated conclusions |

Agent instruction: preserve the three distinct entry points and their shared catalogue IDs. Before implementing a new view, read the existing UX evaluation and MCP boundaries, write down the denominator and membership rules, and design a test that would reveal a falsely missing dataset. Prefer demonstrable understanding over visual novelty.
