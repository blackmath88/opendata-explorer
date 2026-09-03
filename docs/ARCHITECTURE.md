# Architecture

## Product progression

```text
QUESTION
  ↓
DISCOVER evidence
  ↓
DESIGN evidence roles
  ↓
VALIDATE compatibility
  ↓
COMPOSE executable method
  ↓
EXECUTE analysis
  ↓
MATERIALIZE output
```

The important boundary is between **published source data** and **derived intelligence**. The application may enrich, rank, connect and transform data, but must retain provenance and make derived claims distinguishable from source metadata.

The key architectural update after prior-art research is that **semantic discovery is not the core moat**. The strongest platform layer is the ability to test whether heterogeneous datasets can support a shared method and then turn that validated method into an executable graph.

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

Source-specific concepts should not leak into downstream features unless preserved as optional metadata.

Do not assume we should build all multi-catalogue harvesting ourselves. Ceres, Magda, DCAT and similar infrastructure should be evaluated before expanding this layer.

### 2. Canonical catalogue

`DatasetRecord` is the durable catalogue object.

It contains:
- identity and provenance
- title / description
- publisher
- themes / keywords
- licence
- freshness
- formats
- known spatial / temporal characteristics
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

The output of discovery should evolve from a flat score into evidence classes:
- direct
- supporting
- contextual
- missing

### 4. Structured use-case intent

Introduce a source-independent `UseCaseIntent` before deeper AI integration.

Suggested shape:

```ts
interface UseCaseIntent {
  statement: string;
  domainHints: string[];
  geographicScope?: string;
  temporalNeed?: 'current' | 'historical' | 'forecast' | 'mixed';
  spatialNeed?: boolean;
  desiredOutcome?: string;
  constraints: string[];
}
```

The structure does not need to capture all human meaning. It exists to make downstream reasoning inspectable and testable.

### 5. Evidence workspace

A workspace is a selected set of datasets attached to one use case.

It should grow to contain:
- `UseCaseIntent`
- selected datasets
- evidence role of each dataset
- unresolved evidence roles
- compatibility assessments
- composition graph
- derived outputs

### 6. Evidence plan

Before datasets are joined, define **why each dataset exists in the method**.

Suggested roles:

```ts
type EvidenceRoleType =
  | 'analysis_backbone'
  | 'primary_measure'
  | 'context'
  | 'constraint'
  | 'denominator'
  | 'geography'
  | 'validation'
  | 'external_dependency'
  | 'missing';

interface EvidenceRole {
  id: string;
  label: string;
  roleType: EvidenceRoleType;
  datasetId?: string;
  required: boolean;
  reason: string;
}
```

Example for a running comfort use case:
- route geometry → analysis backbone
- canopy → primary shade measure
- air quality → environmental exposure
- traffic → contextual stress
- construction → temporary constraint
- fountains → amenity access
- elevation → effort
- pollen → missing / external dependency

This plan is a better boundary for LLM reasoning than an unconstrained prompt over the whole catalogue.

### 7. Data structure inspection

Level 2/3 requires more than catalogue metadata.

For selected datasets, build a `DatasetStructure` from source schema and safe sample observations where available.

Suggested shape:

```ts
interface DatasetStructure {
  datasetId: string;
  fields: FieldProfile[];
  geometry?: {
    type: string;
    crs?: string;
    extent?: [number, number, number, number];
  };
  temporal?: {
    fields: string[];
    start?: string;
    end?: string;
    grain?: string;
  };
  candidateKeys: string[];
  recordCount?: number;
  observedFrom: 'catalog_metadata' | 'schema' | 'sample_records';
}
```

Keep metadata-derived and observation-derived claims distinct.

### 8. Compatibility engine

This is a core differentiation layer.

A relationship between two datasets is not accepted merely because titles or descriptions are semantically similar.

The engine should assess:
- spatial extent overlap
- geometry compatibility
- CRS compatibility
- temporal overlap
- temporal grain mismatch
- granularity/resolution mismatch
- candidate identifier/key compatibility
- units where relevant
- record/sample evidence

Suggested model:

```ts
type CompatibilityRelation =
  | 'direct_join'
  | 'spatial_join'
  | 'nearest'
  | 'interpolation_required'
  | 'aggregate_required'
  | 'resample_required'
  | 'incompatible'
  | 'unknown';

interface CompatibilityAssessment {
  leftDatasetId: string;
  rightDatasetId: string;
  relation: CompatibilityRelation;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
  warnings: string[];
  candidateKeys?: Array<{left: string; right: string}>;
  proposedOperation?: string;
  evidenceLevel: 'metadata_only' | 'schema_observed' | 'sample_validated';
}
```

A strong UI should show when a relationship is only a candidate.

### 9. Composition graph

After compatibility is assessed, Level 4 introduces typed operations between evidence sources.

Example primitives:
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

A composition edge should reference the compatibility assessment that justified it.

### 10. Execution layer

Turns a validated composition graph into deterministic computation.

Likely first implementation:
- DuckDB + spatial extension or equivalent local/server data engine
- GeoJSON / Parquet-friendly pipelines
- typed operation definitions
- transformation provenance

An MCP server may expose these operations to an LLM, but MCP is an interface to the execution layer, not the architecture itself.

### 11. Materialization

Once data + validated method + output schema exist, the system can propose and generate the appropriate form:
- map
- dashboard
- ranked table
- report / brief
- standalone app
- GeoJSON / CSV / Parquet
- reusable API/data layer

Materialization should follow the data and decision context rather than defaulting to a dashboard.

## Evidence levels

Borrow the useful discipline seen in adjacent systems: every claim should make clear what it is grounded in.

Proposed evidence levels:

```text
CATALOG_METADATA_ONLY
SCHEMA_OBSERVED
SAMPLE_VALIDATED
EXECUTED_RESULT
MODEL_INFERENCE
```

Examples:
- “dataset is geospatial” may come from metadata or schema
- “these fields share names” may come from schema
- “these values actually join” requires sample validation
- “this operation produced 312 matching records” is an executed result
- “this dataset would likely provide useful context” is model inference

Never collapse these into a single confidence score.

## AI boundary

AI may:
- interpret intent
- identify candidate evidence
- assign/propose evidence roles
- explain relevance
- hypothesize joins and transformations
- identify likely gaps
- recommend output forms
- draft implementation specifications

AI must not:
- fabricate datasets
- silently invent source fields
- erase provenance
- promote candidate joinability to validated joinability
- claim an unsupported spatial/temporal join is valid
- execute transformations outside the deterministic operation layer

Preferred responsibility split:

```text
LLM
  hypothesis / interpretation
       ↓
structured evidence plan
       ↓
deterministic compatibility checks
       ↓
validated composition
       ↓
deterministic execution
```

## Prior-art implications

### Public Data Lens
Strong reference for discovery and judgement over a public-data portal. Its deterministic plan generation and explicit evidence levels validate our Level 1 direction.

Architectural opportunity:
- go beyond candidate join fields
- inspect actual schema/sample data
- validate spatial/temporal/key compatibility
- turn a validated plan into executable composition

### Data Commons
Useful reference for metadata-first agent discovery and normalized public evidence, but it operates on an already-aligned knowledge graph. Our composition layer is for heterogeneous source datasets that may not naturally align.

### Magda / Ceres
Potential upstream infrastructure or reference implementations for catalogue ingestion, federation and retrieval. Do not duplicate mature catalogue infrastructure unless necessary.

### CARTO
Strong reference for spatial execution and workflow primitives. Our value is not inventing `buffer` or `intersect`; it is going from intent → evidence → validated method → execution with provenance.

## Implementation status

Built and running:

`Basel API -> normalized catalogue -> intent -> evidence plan -> structure inspection -> compatibility assessments -> workbench`

Layer by layer:

| Layer | State | Module |
| --- | --- | --- |
| 1 Source adapters | implemented for Basel/Opendatasoft behind `CatalogueAdapter`, plus an offline fallback adapter | `src/data/basel.ts`, `src/data/fallback.ts` |
| 2 Canonical catalogue | implemented | `src/types.ts`, `src/data/normalize.ts` |
| 3 Discovery / relevance | deterministic, driven by the shared vocabulary; emits evidence classes | `src/relevance.ts` |
| 4 Structured intent | deterministic parser, no LLM | `src/intent.ts` |
| 5 Evidence workspace | in-memory, bounded orchestration | `src/workspace.ts` |
| 6 Evidence plan | role templates per outcome archetype, with gaps and external dependencies | `src/evidence.ts` |
| 7 Structure inspection | schema for free from the listing; bounded record sampling on request | `src/data/ods-structure.ts` |
| 8 Compatibility engine | implemented, pure, deterministic | `src/compatibility.ts` |
| 9 Composition graph | **not started** — the workbench lists assessments, it does not compose | — |
| 10 Execution | **not started** | — |
| 11 Materialization | **not started** | — |

### Notes the model gained from contact with a real API

- **Provenance is per claim, not per object.** One `observedFrom` on
  `DatasetStructure` was not enough: geometry can be a metadata claim while the
  field list is a schema observation and the coverage window a record
  observation. Each block carries its own `observedFrom`, and
  `candidateKeys` is backed by `keyProfiles` recording whether the publisher
  declared the identifier or we guessed it from the name.
- **An assessment's evidence level is the level of the evidence the winning
  relation rests on**, not the best level reached anywhere. Sampling both sides
  does not make a geometry rule sample-validated.
- **Bounded observation must not produce unbounded claims.** A capped value
  comparison that finds no overlap reports "unverified", never "disproved".
- **`unknown` and `incompatible` are load-bearing outputs.** Three of eight
  tested Basel pairs land there, and each names what is missing.

## Next architecture increment

`validated assessments -> typed composition graph -> deterministic execution`

The graph should carry the compatibility assessment on the edge, not re-derive
it. Nothing should render an edge that has no assessment behind it.
