# Architecture

## Product progression

```text
QUESTION
  ↓
DISCOVER candidate evidence
  ↓
ASSIGN evidence roles
  ↓
INSPECT real structure / geography / time
  ↓
VALIDATE compatibility
  ↓
COMPOSE executable method
  ↓
EXECUTE analysis
  ↓
MATERIALIZE output
```

The important boundary is between **published source data**, **observed structure**, **model inference**, and **derived execution results**. The application may enrich, rank, connect and transform data, but must retain provenance and make those evidence levels distinguishable.

The graph is not the architecture. It is a visualization of structured evidence relationships that must exist first.

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

Source-specific concepts should not leak into downstream features unless preserved as optional source metadata.

Before building a large multi-catalogue harvester, evaluate existing infrastructure such as Ceres/Magda rather than rebuilding mature catalogue plumbing.

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
- spatial / temporal characteristics when source metadata supports them
- semantic enrichment

This is deliberately not a full copy of every source schema.

### 3. Use-case intent

The user's real-world question becomes a structured `UseCaseIntent`.

The raw statement is always retained. Structured hints may include:
- domain hints
- geographic scope
- spatial requirement
- temporal requirement
- desired outcome
- constraints

The first parser should be deterministic. LLM-based interpretation may be added later behind an interface.

### 4. Discovery / relevance

Current implementation is deterministic and transparent:
- tokenize the user's use case
- expand a small synonym vocabulary
- match against normalized metadata
- add explicit bonuses for spatial/time characteristics when relevant
- expose reasons for a match

Future versions can add embeddings and LLM reranking, but semantic relevance remains only a **candidate evidence signal**.

A high relevance score does not imply datasets can be joined.

### 5. Evidence plan

A workspace should evolve from a selected dataset list into an explicit evidence plan.

Each evidence item should have an analytical role such as:
- analysis backbone
- primary measure
- context
- constraint
- denominator
- geography
- validation
- external dependency
- missing evidence

This layer answers:

> What evidence does this question require, and what role would each source play?

Roles inferred by rules or AI are hypotheses, not source facts.

### 6. Dataset structure inspection

Selected datasets require deeper inspection before composition.

A `DatasetStructure` should capture observed or source-declared information such as:
- fields and types
- labels
- bounded sample values
- geometry type / CRS / extent where available
- temporal fields / coverage / grain
- candidate keys
- record count
- evidence source for each structural claim

Evidence levels must distinguish at least:
- `catalog_metadata`
- `schema_observed`
- `sample_observed`

Sampling should be bounded and performed only for selected datasets.

### 7. Compatibility validation

This is the central differentiation target.

For any proposed dataset relationship, create a structured `CompatibilityAssessment` before adding a meaningful edge to the composition graph.

Possible relation classes:
- direct join
- spatial join
- nearest
- interpolation required
- aggregate required
- resample required
- incompatible
- unknown

An assessment should include:
- left/right dataset
- relation
- confidence
- reasons
- warnings
- candidate keys where relevant
- proposed operation
- evidence level

The system must be comfortable saying `unknown` or `incompatible`.

Examples:

```text
Tree canopy ↔ route geometry
relation: spatial_join
confidence: high
evidence: schema_observed
reason: polygon coverage can be intersected with route geometry
```

```text
Air quality ↔ route geometry
relation: interpolation_required
confidence: medium
evidence: schema_observed
warning: point sensor density may be insufficient for precise route-level claims
```

Important distinction:

```text
semantic relation
  !=
analytical compatibility
```

### 8. Composition graph

Only after compatibility information exists should Level 2 introduce typed operation nodes and edges.

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

Every significant graph edge should be backed by a compatibility assessment.

The graph is an executable intermediate representation, not a decorative knowledge graph.

### 9. Execution layer

Level 3 turns a validated composition graph into deterministic computation.

Likely first implementation:
- DuckDB + spatial extension or equivalent local/server data engine
- GeoJSON / Parquet-friendly pipelines
- operation definitions exposed through a small tool interface

An MCP server may expose these operations to an LLM, but MCP is an interface to the execution layer, not the architecture itself.

Execution introduces a stronger evidence level: a relationship or transformation can be validated by actual computation rather than metadata/schema assumptions.

### 10. Materialization

Once data + method + result schema exist, the system can propose and generate the appropriate form:
- map
- dashboard
- ranked table
- report / brief
- standalone app
- GeoJSON / CSV / Parquet
- reusable API/data layer

Materialization should follow the data and decision context rather than defaulting to a dashboard.

The output must preserve source and transformation provenance and carry warnings/caveats forward.

## AI boundary

AI may:
- interpret intent
- identify candidate evidence
- propose evidence roles
- rerank candidates
- explain relevance
- propose joins and transformations
- identify likely gaps
- explain compatibility assessments
- recommend output forms
- draft implementation specifications

AI must not:
- fabricate datasets
- silently invent source fields
- erase provenance
- turn semantic similarity into claimed compatibility
- claim an unsupported spatial/temporal join is valid
- hide uncertainty
- execute transformations outside the deterministic operation layer

## Evidence ladder

Use an explicit evidence ladder across the system:

```text
CATALOG_METADATA
      ↓
SCHEMA_OBSERVED
      ↓
SAMPLE_VALIDATED
      ↓
EXECUTION_VALIDATED
```

Model suggestions are separate from this ladder and should be marked as inferred/proposed.

This lets the UI say not only *what* it believes, but *why it is entitled to believe it*.

## Current build boundary

The merged first build ends at:

```text
Basel API
  -> normalized catalogue
  -> deterministic relevance
  -> D3 landscape
  -> dataset inspection
  -> selected workspace
```

The next build should add:

```text
structured use-case intent
  -> evidence roles
  -> real dataset structure inspection
  -> first deterministic compatibility assessment
```

Do not jump directly to a polished Compose graph. First make the relationships defensible.
