# Open Data Explorer / DataFit

A use-case-first interface for public data catalogues.

Instead of asking users to know dataset names, publishers or administrative terminology, DataFit starts with a real-world question:

> What are you trying to understand or build?

The first catalogue is Basel-Stadt Open Government Data (`data.bs.ch`). The longer-term platform goal is to support multiple catalogues through source adapters.

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

Compose and Materialize are visible in the interaction model but intentionally locked until their substrate exists.

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
catalogue adapter -> normalized metadata -> relevance -> evidence workspace -> composition graph -> materialized artefact
```

See `docs/ARCHITECTURE.md` and `docs/ROADMAP.md`.

## Principles

1. The catalogue is the canonical evidence source; an LLM is not.
2. Missing data must be represented explicitly.
3. AI improves interpretation and composition, not provenance.
4. Source-specific APIs stop at the adapter boundary.
5. Composition operations must be inspectable and eventually executable.
6. The UI follows `DESIGN.md`.
7. Basel is the first implementation, not a hard-coded product boundary.

## Basel API

Base API:

`https://data.bs.ch/api/explore/v2.1`

Catalogue:

`GET /catalog/datasets`

Dataset records:

`GET /catalog/datasets/{dataset_id}/records`

The first build attempts live browser-side catalogue loading. If that fails, it clearly enters fallback mode using a small representative Basel dataset set.
