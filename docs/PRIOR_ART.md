# Prior art and positioning

This project should not be positioned as "AI search for open data." That capability already exists in several forms.

The more defensible direction is:

> **turn a real-world question into an evidence architecture, validate whether heterogeneous datasets can actually work together, execute the method, and materialize the right output.**

## Closest references

### Public Data Lens
Repository: `hike-lab/public-data-lens`

Closest Level 1 prior art found so far.

Relevant capabilities:
- purpose-first public dataset discovery
- deterministic judgement/ranking layer
- normalized JSON-LD/DCAT metadata
- explicit evidence levels
- compare datasets
- inspect observed file structure
- search by columns
- `build_data_plan` for purpose → candidate data roles / datasets / expected join items / limitations
- MCP + REST exposure

Important lesson:
Their planned join items are explicitly candidates, not validated value-level joins.

Our strongest extension target is therefore:

```text
candidate relationship
  ↓
inspect schema / geometry / time / samples
  ↓
validate compatibility
  ↓
choose typed transformation
  ↓
execute
```

### DataHunter
Research prior art for problem-description → dataset recommendation.

Lesson:
Intent-based dataset recommendation is established prior art and should not be treated as the project's core novelty.

### Data Commons
Useful reference for:
- metadata-first discovery
- public-data graph normalization
- agent/MCP access
- statistical entity alignment

Difference:
Data Commons has already normalized source evidence into a common graph. This project focuses on heterogeneous published datasets that may require spatial, temporal or schema transformations before they can answer one question together.

### Magda
Useful reference for:
- government/open-data catalogue architecture
- federation
- semantic/vector search
- metadata indexing

Lesson:
Do not over-invest in rebuilding generic catalogue/search infrastructure.

### Ceres
Useful reference for:
- harvesting many public-data portal types
- Opendatasoft / CKAN / Socrata / ArcGIS / DCAT / STAC
- multi-portal normalization
- embeddings / semantic search

Potential future direction:
Evaluate Ceres as a Level 0/6 substrate before building our own large-scale harvester.

### CARTO
Useful reference for:
- deterministic spatial workflows
- spatial operations
- visual workflow composition
- data observatory patterns

Lesson:
`buffer`, `intersect`, `nearest`, `aggregate` and graph-based spatial execution are not the novelty.

Our value should be how a user reaches a justified workflow from a real-world question.

### DataHub / OpenMetadata / Atlan
Useful references for:
- metadata detail
- lineage
- ownership
- trust signals
- enterprise semantic discovery

Difference:
This product is not primarily enterprise governance. Its organizing object is a real-world use case and the evidence required to support it.

## Positioning after research

### Weak claim
> Describe what you want to do and AI finds relevant datasets.

Already well covered.

### Better claim
> Describe what you want to understand. The system finds candidate evidence, explains the role of each source, tests whether the sources can actually be combined, builds an executable method, and proposes the right output.

### Strong technical claim
> Semantic relevance is not enough. Open Data Explorer distinguishes **candidate evidence relationships** from **validated analytical compatibility**.

This distinction should be visible in the data model, UI and evaluation.

## Product layers vs prior art

| Layer | Market/prior-art maturity | Our strategy |
| --- | --- | --- |
| Catalogue ingestion | mature | keep adapter clean; reuse where possible |
| Semantic discovery | increasingly mature | implement well, do not overbuild |
| Purpose → data plan | emerging / already demonstrated | adopt useful patterns |
| Evidence roles | less standardized | make explicit and inspectable |
| Join compatibility validation | core opportunity | invest heavily |
| Executable composition | existing tools, but analyst-driven | derive from validated evidence plan |
| Materialization | increasingly common for known data | tie output choice to validated evidence + intent |

## Evaluation direction

The platform should eventually be benchmarked on more than retrieval precision.

Suggested evaluation questions:

### Discovery
- Did the shortlist include the expected datasets?
- Did it identify expected missing evidence?
- Did it avoid hallucinating unavailable datasets?

### Evidence design
- Did it assign sensible roles to each dataset?
- Did it distinguish required from optional evidence?

### Compatibility
- Did it correctly reject invalid joins?
- Did it identify when interpolation/aggregation/resampling is required?
- Did confidence reflect the evidence level actually observed?

### Execution
- Did the graph execute reproducibly?
- Is source/transformation provenance preserved?

### Materialization
- Is the proposed output appropriate to the question and result structure?
- Does the final artefact preserve caveats and provenance?

## Current positioning sentence

> Open Data Explorer turns civic questions into validated evidence workflows: discover what data fits, test how it can actually work together, execute the analysis, and turn the result into the right artefact.
