# Open Data Explorer / DataFit

A use-case-first interface for public data catalogues.

Instead of asking users to know dataset names, publishers or administrative terminology, DataFit starts with a real-world question:

> What are you trying to understand or build?

The first catalogue is Basel-Stadt Open Government Data (`data.bs.ch`). The longer-term platform goal is to support multiple catalogues through source adapters.

## Current milestone

**Validated evidence foundation**

Level 1 Discover is merged. The current branch `feat/evidence-validation-foundation` adds the substrate needed before a real Compose graph is justified:

- structured deterministic `UseCaseIntent`
- inferred evidence classes and analytical roles
- explicit unresolved/missing evidence roles
- bounded real-record inspection for selected Basel datasets
- observed field, geometry, temporal and candidate-key signals
- deterministic pairwise compatibility assessments
- compatibility results that can return `unknown`
- canonical benchmark fixtures for six civic use cases

The important product boundary is now:

```text
semantic relevance != analytical compatibility
```

A dataset can be relevant to a question without being safely or directly joinable with another relevant dataset.

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
catalogue adapter -> normalized metadata -> use-case intent -> evidence plan -> observed structure -> compatibility assessment -> executable composition -> artefact
```

See `docs/ARCHITECTURE.md` and `docs/ROADMAP.md`.

## Principles

1. The catalogue is the canonical evidence source; an LLM is not.
2. Missing data must be represented explicitly.
3. AI improves interpretation and composition, not provenance.
4. Source-specific APIs stop at the adapter boundary.
5. Semantic relevance does not prove joinability.
6. Compatibility confidence must state its evidence level.
7. Composition operations must be inspectable and eventually executable.
8. The UI follows `DESIGN.md`.
9. Basel is the first implementation, not a hard-coded product boundary.

## Basel API

Base API:

`https://data.bs.ch/api/explore/v2.1`

Catalogue:

`GET /catalog/datasets`

Dataset records:

`GET /catalog/datasets/{dataset_id}/records`

The app attempts live browser-side catalogue loading. If that fails, it clearly enters fallback mode using a small representative Basel dataset set. Structure inspection always identifies itself as an observation from bounded sample records; it is not presented as complete source truth.

## Current validation boundary

The compatibility engine is intentionally conservative. It can currently identify candidate signals such as:

- matching candidate-key names
- point ↔ polygon spatial joins
- point ↔ line nearest relations
- general geometry-to-geometry compatibility candidates
- temporal grain mismatch
- insufficient evidence (`unknown`)

It does **not** yet prove value-level key overlap, geographic coverage overlap, CRS compatibility, sensor density sufficiency, or executable join correctness. Those belong to the next validation/execution milestones.
