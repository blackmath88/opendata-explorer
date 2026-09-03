# Roadmap — the levels we are climbing

The platform should grow by proving one capability layer at a time. The key update after prior-art research is that **semantic dataset discovery is necessary infrastructure, but not the core differentiator**.

The stronger product bet is:

```text
INTENT
  ↓
DISCOVER EVIDENCE
  ↓
DESIGN EVIDENCE ROLES
  ↓
VALIDATE COMPATIBILITY
  ↓
BUILD EXECUTABLE COMPOSITION
  ↓
MATERIALIZE THE RIGHT FORM
```

The system should therefore spend less effort trying to out-invent semantic search and more effort proving that heterogeneous public datasets can be turned into a valid, inspectable, executable evidence architecture.

---

## Level 0 — Better index

**Question:** Can we expose the catalogue better than the source portal does?

Capabilities:
- ingest a real public catalogue
- normalize metadata
- search / filter / inspect
- show provenance, formats, licence and freshness
- visualize the catalogue landscape

Exit condition:
> A user can understand what exists without knowing the administrative vocabulary.

Status: **foundation implemented in first build**.

Important note:
This layer is increasingly commodity infrastructure. Projects such as Magda, Ceres and large data catalogues already solve much of harvesting, indexing and semantic retrieval. Keep our adapter architecture clean, but do not over-invest here.

---

## Level 1 — Data Fit / Discover

**Question:** Which available evidence fits my use case?

Capabilities:
- natural-language use-case input
- deterministic + semantic ranking
- direct / supporting / contextual evidence labels
- transparent relevance reasons
- explicit missing-data detection
- temporary evidence workspace
- compare candidate datasets
- distinguish source facts from inferred usefulness

Exit condition:
> Given a concrete use case, the system produces a defensible shortlist of evidence with provenance and gaps.

Status: **first deterministic version implemented; semantic enrichment remains**.

Prior-art lesson:
Public Data Lens, DataHunter, Data Commons and enterprise catalogues already demonstrate variants of intent → dataset recommendation. Treat this as required substrate, not the novelty claim.

---

## Level 2 — Evidence Design

**Question:** What roles do the selected datasets play in answering the use case?

Capabilities:
- define a structured `UseCaseIntent`
- assign evidence roles such as primary measure, context, denominator, geography, constraint, validation source
- represent missing roles explicitly
- inspect dataset schema, spatial type, temporal grain and coverage
- propose candidate relationships
- produce an inspectable evidence plan before execution

Example:

```text
Use case: heat-safe running routes

ROUTE GEOMETRY       → analysis backbone
TREE CANOPY          → shade exposure
AIR QUALITY          → environmental exposure
TRAFFIC              → stress / avoidance
FOUNTAINS            → amenity proximity
CONSTRUCTION         → temporary constraint
ELEVATION            → effort / difficulty
POLLEN                → missing external evidence
```

Exit condition:
> The workspace explains not only which datasets are relevant, but why each one exists in the analysis.

Build milestone name: **Evidence Plan**.

Status: **implemented deterministically**. `UseCaseIntent`, role templates per
outcome archetype, evidence classes, required/optional roles, unresolved roles
and named external dependencies are all in place and covered by benchmarks. What
remains for this level is model-assisted role proposal, which must be labelled
as inference and validated by the layers below it.

---

## Level 3 — Join Validation

**Question:** Can these datasets actually be combined in a defensible way?

This is a core differentiation target.

Capabilities:
- field/schema inspection
- geometry compatibility checks
- spatial extent overlap
- temporal coverage overlap
- granularity/resolution comparison
- identifier/key compatibility
- candidate join fields
- direct join vs spatial transformation vs interpolation
- explicit uncertainty and invalid-join states
- sample-level validation where possible

Example output:

```text
Tree canopy + street segments
Spatial compatibility: YES
Coverage: high
Method: polygon intersection
Confidence: high

Air sensors + street segments
Direct join: NO
Method: nearest / interpolation
Sensor density: sparse
Confidence: medium

Population + temperature
Geography mismatch: YES
Suggested transformation: normalize to common grid
Confidence: medium
```

Exit condition:
> The system can distinguish “these datasets sound related” from “these datasets can actually support this method.”

Build milestone name: **Compatibility Engine**.

Status: **first implementation complete**, up to `sample validated`. Geometry,
temporal and key rules produce typed assessments with confidence, reasons,
warnings and an evidence level; `unknown` and `incompatible` are ordinary
results. Value-level key validation is real (one Basel join is validated, not
assumed). What is *not* validated is whether geometries actually intersect —
that needs the execution layer. See `docs/BASEL_API_FINDINGS.md`.

---

## Level 4 — Executable Composition

**Question:** Can the validated method run?

Capabilities:
- typed composition graph
- deterministic operation schema
- operation nodes such as intersect, nearest, buffer, aggregate, normalize, calculate, temporal align
- deterministic execution engine
- derived datasets
- provenance per transformation
- caching and reproducibility
- optional Spatial Data MCP tool interface

The graph is not decorative. It is an intermediate representation that can execute.

Likely first engine:
- DuckDB + spatial extension or equivalent
- GeoJSON / Parquet-friendly pipeline

Exit condition:
> A validated composition graph can produce a real derived result from real source data.

Build milestone name: **Spatial Workbench**.

---

## Level 5 — Materialize

**Question:** What is the right form for the result?

Capabilities:
- infer useful output modes from data shape + user intent
- map / dashboard / report / ranked table / API / app proposals
- explain why a representation fits
- preview output
- generate a standalone artefact or implementation brief
- retain source and transformation provenance in the output

Exit condition:
> A user can go from a question to a useful, inspectable artefact without manually translating the analysis into another tool.

Build milestone name: **Evidence to Artefact**.

---

## Level 6 — Multi-catalogue fabric

**Question:** Does the model generalize beyond Basel?

Capabilities:
- source-adapter registry
- multiple public catalogues
- entity/schema alignment
- cross-catalogue discovery
- source quality and trust signals
- reusable workspaces
- potentially reuse/federate existing catalogue infrastructure instead of rebuilding it

Potential substrates to evaluate:
- Ceres for multi-portal harvesting / normalization
- Magda for catalogue and semantic-search patterns
- DCAT / JSON-LD conventions for portable metadata

Exit condition:
> Basel is simply one source in a larger open-data evidence fabric.

Build milestone name: **Open Data Fabric**.

---

# Revised recommended build order

## Milestone A — Stabilize the current Level 1 slice

Do this first and keep it short.

1. run `npm install` and `npm run build`
2. fix TypeScript/runtime issues
3. inspect the actual Basel `/catalog/datasets` response
4. harden normalization against real metadata
5. verify browser CORS behaviour
6. verify pagination and total counts
7. ensure fallback mode is explicit and never confused with live data
8. test dataset detail and workspace interactions

**Stop condition:** a reliable live Basel catalogue appears in the supplied UI.

---

## Milestone B — Finish Data Fit without overbuilding it

1. define `UseCaseIntent`
2. define evidence classes: direct / supporting / contextual / missing
3. keep deterministic ranking as baseline
4. add semantic reranking behind an interface only if it materially improves recall
5. add dataset comparison
6. create 6 canonical benchmark use cases
7. record expected shortlist + expected missing evidence for each benchmark

**Stop condition:** recommendations are useful and testable. Do not spend weeks optimizing semantic search.

---

## Milestone C — Build the Evidence Plan

This is the first major product step beyond prior art.

1. define `EvidenceRole`
2. attach roles to selected datasets
3. add unresolved/missing roles
4. fetch dataset schema and sample records
5. derive structured characteristics:
   - geometry type
   - spatial extent
   - temporal fields
   - temporal coverage
   - candidate identifiers
   - granularity
   - units where available
6. render a first evidence-plan view in Compose

**Stop condition:** the workspace explains the analytical role of every selected source.

---

## Milestone D — Compatibility Engine

Build this before a fancy graph editor.

1. define a typed `CompatibilityAssessment`
2. implement checks for:
   - spatial overlap
   - geometry compatibility
   - temporal overlap
   - grain mismatch
   - candidate join keys
3. classify relation:
   - direct_join
   - spatial_join
   - nearest
   - interpolation_required
   - aggregate_required
   - resample_required
   - incompatible
   - unknown
4. expose confidence + reasons
5. validate assessments against real sample data when possible
6. test 3 Basel dataset pairs with known-good joins and 3 known-problematic pairs

**Stop condition:** the system can reject or qualify bad composition proposals.

---

## Milestone E — First executable composition

Only after validation exists:

1. define typed operation schema
2. choose execution engine
3. implement three operations end-to-end:
   - `intersect`
   - `nearest`
   - `aggregate`
4. execute one real Basel use case
5. preserve provenance through every result

Use the running-route example as the integration test, not the product definition.

---

## Milestone F — Materialize one real result

From the executed running-route composition:
- generate a map or route comparison
- generate a concise report
- explain why those forms fit
- preserve data sources and transformation trace

Then test Materialize with a second, non-routing use case to make sure the architecture generalizes.

---

# Prior-art strategy

We should explicitly learn from, and where useful reuse, adjacent projects rather than duplicating them.

### Public Data Lens
Closest Level 1 prior art. Important patterns:
- deterministic judgement layer
- explicit evidence levels
- normalized metadata
- MCP/REST exposure
- purpose → candidate datasets / planned join fields

Our differentiation should start where its results become `CANDIDATE_ONLY`: validate actual compatibility and build executable evidence composition.

### Data Commons
Useful patterns:
- metadata-first agent discovery
- graph-normalized public evidence
- agent/tool interfaces

Difference:
- Data Commons operates over already-aligned statistical entities; we target heterogeneous published datasets that may require transformations before they can answer a question together.

### Magda / Ceres
Useful infrastructure references for catalogue harvesting, federation and semantic retrieval. Evaluate before building a large multi-catalogue ingestion system ourselves.

### CARTO
Useful Level 4 reference for deterministic spatial workflows. Avoid claiming novelty for generic buffer/intersect/aggregate workflow editing.

### DataHub / OpenMetadata
Useful metadata, lineage and trust patterns, but enterprise governance is not the product framing.

---

# Rule for adding AI

Add AI only when the deterministic layer has enough structure to constrain it.

Bad sequence:

`prompt -> LLM -> invented answer`

Preferred sequence:

`prompt -> intent -> catalogue evidence -> evidence roles -> compatibility validation -> proposed composition -> deterministic execution -> artefact`

AI is strongest at interpretation and hypothesis generation. The platform must remain responsible for evidence, validation, execution and provenance.
