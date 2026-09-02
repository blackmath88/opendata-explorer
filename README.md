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

**Level 1 — Discover foundation**

Implemented in `feat/level-1-discover-foundation`:
- Vite + TypeScript + D3 scaffold
- Basel Opendatasoft Explore API adapter
- normalized catalogue model independent of Basel/Opendatasoft
- browser-side live catalogue loading with explicit fallback mode
- deterministic use-case relevance scoring
- semantic landscape visualization
- topic filters
- dataset detail inspection
- temporary workspace selection
- canonical `DESIGN.md`

The next build does **not** jump straight to a visual Compose editor. It adds:
- structured `UseCaseIntent`
- evidence classes and analytical roles
- real dataset schema/sample inspection
- first deterministic compatibility assessments

See `docs/NEXT_BUILD.md` for the engineering plan and `docs/CODEX_NEXT_PROMPT.md` for the ready-to-run Codex handoff.

## Run locally

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
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
- `docs/CODEX_NEXT_PROMPT.md`

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

The first build attempts live browser-side catalogue loading. If that fails, it clearly enters fallback mode using a small representative Basel dataset set.

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
