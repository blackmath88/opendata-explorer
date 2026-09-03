# Open Data Explorer / DataFit

A use-case-first interface for public data catalogues that aims to go beyond discovery into **validated evidence composition**.

Instead of asking users to know dataset names, publishers or administrative terminology, the platform starts with a real-world question:

> What are you trying to understand or build?

The first catalogue is Basel-Stadt Open Government Data (`data.bs.ch`). The longer-term platform goal is to support multiple catalogues through source adapters or reusable catalogue infrastructure.

## Current positioning

Semantic dataset discovery is useful, but it is not enough and it is not unique.

The stronger platform direction is:

```text
question
  ↓
discover candidate evidence
  ↓
assign evidence roles
  ↓
inspect structure / geography / time
  ↓
validate compatibility
  ↓
build executable composition
  ↓
materialize the right output
```

A key product principle is the distinction between:

> **these datasets sound relevant**

and

> **these datasets can actually support this analytical method**.

See `docs/PRIOR_ART.md` for the research that motivated this shift.

## Current milestone

**Level 2/3 — Evidence plan and compatibility validation**

Implemented:
- Vite + TypeScript + D3 scaffold
- hardened Basel Opendatasoft Explore API adapter behind a `CatalogueAdapter` boundary
- normalized catalogue model independent of Basel/Opendatasoft
- live browser-side catalogue loading, with a frozen 44-dataset offline snapshot as an explicitly marked fallback
- deterministic `UseCaseIntent` parser (no LLM)
- deterministic evidence plan: analytical roles, required/optional, unresolved roles and named external dependencies
- evidence classes: direct / supporting / contextual / missing
- real dataset structure inspection — fields, geometry, temporal grain and coverage, candidate identifiers — with per-claim provenance
- bounded record sampling and value-level key validation
- deterministic compatibility engine producing typed, evidence-levelled assessments between selected datasets
- Compose stage as an inspector/workbench, not a node editor
- six canonical benchmark use cases with unit tests

Not built yet, deliberately: DuckDB/spatial execution, MCP, Materialize, LLM
integration, multi-catalogue support, a visual node editor.

See `docs/BASEL_API_FINDINGS.md` for what the live API actually returns and what
the compatibility engine concluded, `docs/NEXT_BUILD.md` for the engineering plan
and `docs/CODEX_NEXT_PROMPT.md` for the Codex handoff.

## Run locally

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

Tests (offline; they run against the frozen catalogue snapshot, never the live API):

```bash
npm test
```

## Architecture in one line

```text
catalogue adapter -> normalized metadata -> data fit -> evidence plan -> compatibility validation -> executable composition -> materialized artefact
```

See:
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `docs/PRIOR_ART.md`
- `docs/NEXT_BUILD.md`
- `docs/BASEL_API_FINDINGS.md`
- `docs/CODEX_NEXT_PROMPT.md`

### Module map

```text
src/types.ts            canonical models and the adapter interface
src/vocabulary.ts       one shared DE/EN domain vocabulary
src/intent.ts           deterministic UseCaseIntent parser
src/evidence.ts         evidence-role templates and dataset resolution
src/relevance.ts        deterministic ranking
src/geometry.ts         geometry families and extent maths
src/compatibility.ts    deterministic compatibility engine (pure, no I/O)
src/workspace.ts        bounded orchestration of inspection + assessment
src/data/               Opendatasoft adapter, normalizer, structure builder, fallback
src/benchmarks/         six canonical use cases with expectations
src/ui/                 rendering only
```

## Principles

1. The catalogue is the canonical evidence source; an LLM is not.
2. Missing data must be represented explicitly.
3. Source facts, observations, execution results and model inferences must remain distinguishable.
4. AI improves interpretation and hypothesis generation, not provenance.
5. Source-specific APIs stop at the adapter boundary.
6. Semantic relevance does not prove joinability.
7. Candidate relationships must be validated before execution.
8. Composition operations must be inspectable and deterministic.
9. The UI follows `DESIGN.md`.
10. Basel is the first implementation, not a hard-coded product boundary.

## Basel API

Base API:

`https://data.bs.ch/api/explore/v2.1`

Catalogue:

`GET /catalog/datasets`

Dataset metadata:

`GET /catalog/datasets/{dataset_id}`

Dataset records:

`GET /catalog/datasets/{dataset_id}/records`

The app loads the catalogue directly from the browser — `access-control-allow-origin: *`
means no proxy is needed. If that fails it enters fallback mode, which is labelled
everywhere and cannot reach sample-level evidence.

Two behaviours of this API are load-bearing and easy to get wrong:

- `/catalog/datasets` **must** be paged with `order_by`. Without it, consecutive
  pages overlap: a four-page walk returned 361 rows containing 360 distinct datasets.
- the listing already embeds every dataset's **full field schema**, so structure
  inspection costs no extra requests.

Both are documented with evidence in `docs/BASEL_API_FINDINGS.md`.

## Prior-art stance

We should learn from and reuse adjacent work where sensible:
- Public Data Lens for public-data discovery/judgement patterns
- Data Commons for metadata-first agent discovery
- Magda / Ceres for catalogue/federation patterns
- CARTO for spatial workflow primitives
- DataHub / OpenMetadata / Atlan for metadata and trust patterns

The project should not claim novelty for semantic search, basic open-data catalogue browsing or generic spatial workflow nodes.

The main current differentiation target is **evidence compatibility validation between heterogeneous public datasets, followed by executable and provenance-preserving composition**.

## Next gate

Do not start the executable spatial-workbench milestone until the next build can answer these questions from real source evidence:

- what fields actually exist?
- what geometry does each selected dataset expose?
- what temporal grain/coverage can be observed?
- which apparent joins are direct, spatial, nearest-neighbour, interpolation-dependent, aggregate-dependent, incompatible, or simply unknown?
- what evidence level supports each assessment?

The composition graph should only visualize relationships that have this structured compatibility record behind them.
