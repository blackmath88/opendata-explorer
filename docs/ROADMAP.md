# Roadmap — the levels we are climbing

The platform should grow by proving one capability layer at a time. Do not jump directly to an LLM-generated app builder; each level must leave behind a reusable substrate for the next.

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

Exit condition:
> Given a concrete use case, the system produces a defensible shortlist of evidence with provenance and gaps.

Status: **first deterministic version implemented; semantic/LLM enrichment remains**.

---

## Level 2 — Compose

**Question:** How can these datasets actually work together?

Capabilities:
- typed data/geometry/time inspection
- compatibility checks
- spatial and temporal join suggestions
- composition graph
- operation nodes: intersect, nearest, buffer, aggregate, normalize, calculate, etc.
- show invalid or uncertain joins explicitly
- generate an analysis plan

Exit condition:
> The system can turn selected evidence into an inspectable method, not just a list of datasets.

Build milestone name: **Evidence Graph**.

---

## Level 3 — Execute

**Question:** Can the proposed composition actually run?

Capabilities:
- deterministic execution engine
- sample records / schemas
- spatial operations
- derived datasets
- query results with provenance
- caching and reproducibility
- optional Spatial Data MCP tool interface

Exit condition:
> A composition graph can produce a real derived result from real source data.

Build milestone name: **Spatial Workbench**.

---

## Level 4 — Materialize

**Question:** What is the right form for the result?

Capabilities:
- infer useful output modes from data shape + user intent
- map / dashboard / report / ranked table / API proposals
- preview output
- generate a standalone artefact or implementation brief
- retain source and transformation provenance in the output

Exit condition:
> A user can go from a question to a useful, inspectable artefact without manually translating the analysis into a separate tool.

Build milestone name: **Evidence to Artefact**.

---

## Level 5 — Multi-catalogue platform

**Question:** Does the model generalize beyond Basel?

Capabilities:
- source-adapter registry
- multiple public catalogues
- entity/schema alignment
- cross-catalogue discovery
- source quality and trust signals
- reusable workspaces

Exit condition:
> Basel is simply one source in a larger open-data evidence fabric.

Build milestone name: **Open Data Fabric**.

---

# Recommended build order

### Milestone A — Stabilize Level 1
1. verify Vite build and browser runtime
2. inspect actual Basel catalogue response schema and harden normalizer
3. confirm CORS behaviour
4. add pagination/count accuracy
5. add catalogue search and filters
6. improve graph layout and dataset detail
7. add URL/deep-link state for use-case + selection

### Milestone B — Semantic Data Fit
1. define structured `UseCaseIntent`
2. add evidence roles: direct / supporting / contextual / missing
3. add embeddings or LLM reranking behind an interface
4. preserve deterministic score/reason alongside semantic ranking
5. test with 6 canonical demo use cases

### Milestone C — Composition prototype
1. fetch schema/sample records for selected datasets
2. infer spatial/temporal characteristics from real fields
3. define typed operation schema
4. create first composition graph UI
5. support 3 operations end-to-end: `nearest`, `intersect`, `aggregate`

### Milestone D — Execute one real use case
Use the running-route example only as an integration test:
- route geometry as external input
- canopy intersection
- fountain proximity
- construction intersection
- air sensor nearest/interpolation
- return a derived route report

### Milestone E — Materialize
Generate a real map/report prototype from that same composition.

---

# Rule for adding AI

Add AI only when the deterministic layer has enough structure to constrain it.

Bad sequence:
`prompt -> LLM -> invented answer`

Preferred sequence:
`prompt -> intent -> catalogue evidence -> structured candidates -> LLM reasoning -> validated composition -> deterministic execution -> artefact`
