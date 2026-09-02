# Architecture

## Product progression

```text
QUESTION
  ↓
DISCOVER evidence
  ↓
COMPOSE evidence
  ↓
EXECUTE analysis
  ↓
MATERIALIZE output
```

The important boundary is between **published source data** and **derived intelligence**. The application may enrich, rank, connect and transform data, but must retain provenance and make derived claims distinguishable from source metadata.

## Layers

### 1. Source adapters

A source adapter knows how to query one external catalogue and convert it into the canonical metadata model.

Current adapter:

- Basel-Stadt / Opendatasoft Explore API v2.1

Future adapters may include:

- opendata.swiss
- Stadt Zürich Open Data
- federal catalogues
- European Data Portal
- internal organizational catalogues

Source-specific concepts should not leak into downstream features unless they are preserved as optional metadata.

### 2. Canonical catalogue

`DatasetRecord` is the durable product object.

It contains:

- identity and provenance
- title / description
- publisher
- themes / keywords
- licence
- freshness
- formats
- spatial / temporal characteristics
- semantic enrichment

This is deliberately not a full copy of every source schema.

### 3. Discovery / relevance

Current implementation is deterministic and transparent:

- tokenize the user's use case
- expand a small synonym vocabulary
- match against normalized metadata
- add explicit bonuses for spatial/time characteristics when the question requires them
- expose the reason for a match

Future versions can add embeddings and LLM ranking, but deterministic evidence and provenance remain available.

### 4. Evidence workspace

A workspace is a user-selected set of datasets attached to one use case.

Level 1 only stores this client-side in memory.

Later it should include:

- selected datasets
- intended role of each dataset
- unresolved evidence gaps
- composition graph
- derived outputs

### 5. Composition graph

Level 2 introduces typed relationships and operations between datasets.

Example operation primitives:

- select / filter
- spatial intersect
- within
- nearest
- buffer
- spatial join
- temporal align
- resample
- aggregate
- normalize
- calculate
- route intersect

The graph is not merely a visualization. Its nodes and edges should become an executable intermediate representation.

### 6. Execution layer

Level 3 turns a composition graph into deterministic computation.

Likely first implementation:

- DuckDB + spatial extension or equivalent local/server data engine
- GeoJSON / Parquet-friendly pipelines
- operation definitions exposed through a small tool interface

An MCP server may expose these operations to an LLM, but MCP is an interface to the execution layer, not the architecture itself.

### 7. Materialization

Once data + method + output schema exist, the system can propose and generate the appropriate form:

- map
- dashboard
- ranked table
- report / brief
- standalone app
- GeoJSON / CSV / Parquet
- reusable API/data layer

Materialization should follow the data and decision context rather than defaulting to a dashboard.

## AI boundary

AI may:

- interpret intent
- identify candidate evidence
- explain relevance
- propose joins and transformations
- identify likely gaps
- recommend output forms
- draft implementation specifications

AI must not:

- fabricate datasets
- silently invent source fields
- erase provenance
- claim an unsupported spatial/temporal join is valid
- execute privileged transformations outside the deterministic operation layer

## Current first-build boundary

The first build ends at a real Level 1 workspace:

`Basel API -> normalized catalogue -> relevance ranking -> D3 landscape -> dataset inspection -> selected workspace`

Everything after that should build on this path rather than bypass it.
