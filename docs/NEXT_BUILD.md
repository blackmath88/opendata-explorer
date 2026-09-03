# Next build — make the prototype understandable, then broaden its evidence

The evidence engine is no longer the missing piece. The repository can already load the Basel catalogue, build evidence plans, inspect real structure, assess compatibility and execute selected spatial validations.

The immediate problem is product translation:

> the system knows more than the user can currently understand or use.

The next build therefore shifts from exposing internal composition machinery to guiding a normal user from an idea to a credible build plan.

## Product sequence from here

```text
ZOOMABLE ATLAS
  ↓
ASK WHAT YOU WANT TO BUILD
  ↓
EVIDENCE RESOLUTION
  ↓
BUILD PLAN / REPRESENTATION
  ↓
BACKGROUND COMPATIBILITY + VALIDATION
  ↓
PREVIEW / RESULT
  ↓
TRUSTED SUPPORTING SOURCES
  ↓
MCP ORCHESTRATOR
```

`Compose` remains an internal system concept, but should stop being the primary mental model presented to normal users.

---

# Milestone 1 — Zoomable Atlas v2

## Goal

Turn the current category bubbles into a true navigable data landscape.

The first screen must answer:

> What kinds of public data does Basel publish?

The next level:

> What exists inside this territory?

Only the final level:

> Which datasets are these?

## Interaction model

Use one deterministic hierarchy per Atlas lens:

```text
root
  → top-level category
    → subcategory
      → additional semantic subdivision when needed
        → datasets
```

The depth is adaptive. Do not force the same number of levels across every branch.

If a category still contains roughly more than 20–25 datasets, subdivide it when there is a meaningful deterministic split. If no defensible split exists, show the dataset constellation rather than inventing weak categories.

## D3 behavior

Use D3 hierarchy + circle packing as the main interaction model.

Requirements:
- deterministic hierarchy and sort order
- semantic click-to-zoom
- smooth zoom transitions
- wheel / trackpad zoom
- touch pinch where practical
- constrained pan/zoom extents
- visible `+`, `−`, `reset` controls
- breadcrumb navigation at arbitrary depth
- no continuously drifting simulation
- dataset leaves remain D3 nodes at final level

Labels must be zoom-dependent:
- far: category + count
- medium: subcategory labels
- close: dataset titles
- closest: title + id + relevance/evidence class

Question relevance affects emphasis, not topology.

Catalogue search should work through the hierarchy:
- unmatched branches fade
- branches show matching counts
- clicking a branch navigates toward matching datasets

The complete List remains the authoritative flat index.

## Layout

Give the Atlas substantially more viewport.

Reduce vertical chrome after a user has submitted a question:
- compact header
- compact evidence/question strip
- search + lens controls
- Atlas fills remaining height
- example prompts collapse into a secondary `Try an example` control

---

# Milestone 2 — Replace user-facing Compose with Build

## Principle

Normal users do not want to experiment with arbitrary dataset pairings.

They want to say:

> I want to build or understand this.

The system should do composition in the background and surface only the relationships that matter for the proposed result.

Internally retain:
- evidence plan
- compatibility assessments
- relationship planning
- execution validation
- provenance

Externally present a guided `Build` stage.

## Build stage must answer

1. What are we trying to build?
2. What evidence is available?
3. What evidence is missing?
4. What method is proposed?
5. What output form fits?
6. What needs validation before the result is trustworthy?

Example:

```text
BUILD
Running comfort map

Evidence coverage
5 / 7 needs covered

Available
✓ route backbone
✓ shade / urban nature
✓ fountains
✓ traffic context
✓ air / weather context

Missing
✕ elevation
✕ pollen

Proposed method
Score candidate route segments from available comfort evidence.

Recommended output
Interactive route-comparison map

3 relationships need validation
[ Check data fit ]
```

Detailed evidence-role cards and the full pairwise matrix move behind technical details.

## Build layout

Discover and Build do not need the same panel geometry.

Prefer desktop Build layout around:

```text
| rail | build flow ~65% | analysis/detail ~35% |
```

The right analysis/detail area may be roughly 420–480 px where useful.

It should show only the currently relevant:
- representation proposal
- required relationships
- validation state
- execution result
- caveats/provenance

Mobile stacks the workflow vertically.

---

# Milestone 3 — Representation recommendation

## Why now

Compatibility is hard to understand when the user does not yet know what the datasets are supposed to produce.

Representation should therefore be proposed before exposing technical validation details.

Create a library-independent `RepresentationSpec`.

Initial representation types:
- point_map
- choropleth
- relationship_map
- route_comparison
- ranked_bar
- time_series
- distribution
- comparison_cards
- evidence_brief

Recommendation inputs:
- user intent
- evidence roles
- geometry
- temporal structure
- compatibility assessments
- execution result where available

Examples:
- point geography + spatial question → point map
- polygon + numeric aggregate → choropleth
- category + numeric measure → ranked bar
- temporal field + measure → time series
- route/network + contextual spatial layers → route comparison
- any analysis with meaningful caveats → evidence brief

A proposed view is not a validated result. Label it clearly as a proposal until relevant relationships have executed successfully.

## Initial renderers

Keep the first renderer set small:
- MapLibre GL JS for maps
- Observable Plot for charts
- HTML/CSS for comparison cards and evidence briefs
- D3 reserved for the Atlas and genuinely custom exploratory views

Do not build a dashboard framework.

---

# Milestone 4 — Trusted Supporting Sources

## Product idea

Basel-Stadt remains the primary local evidence source.

When an evidence role cannot be filled locally, DataFit may resolve it from a small curated registry of official Swiss public sources.

Do not search the open internet indiscriminately.

UI language:

```text
LOCAL EVIDENCE
Basel-Stadt

SWISS PUBLIC DATA
trusted supporting source

STILL MISSING
no suitable source resolved
```

## Initial curated registry

Research and implement only high-value official sources that complement Basel questions:

### MeteoSwiss
Potential roles:
- temperature
- weather observations
- precipitation
- wind
- humidity
- pollen

### swisstopo / geo.admin.ch
Potential roles:
- road/path network
- elevation / terrain
- national geospatial reference layers

### Federal Statistical Office (BFS/FSO)
Potential roles:
- population denominators
- geostatistics
- demographic context

### opendata.swiss
Role:
- metadata discovery / source registry
- not automatically the runtime source for all data

## Trusted Evidence Registry

Create a small explicit registry rather than attempting full Swiss catalogue federation.

Suggested normalized concept:

```ts
interface TrustedEvidenceSource {
  id: string;
  label: string;
  provider: string;
  scope: 'local' | 'national';
  trust: 'official';
  topics: string[];
  evidenceRoles: string[];
  accessType: 'opendatasoft' | 'ckan' | 'stac' | 'geo_admin' | 'rest' | 'download';
  catalogueUrl?: string;
  endpoint?: string;
}
```

The value of the registry is opinionated knowledge:
- for weather, prefer this source
- for pollen, prefer this source
- for elevation, prefer this source
- for routing backbone, prefer this source
- for population denominators, prefer this source

## Adapter/proxy direction

The frontend should eventually see one normalized contract even when source APIs differ.

Potential architecture:

```text
EvidenceResolver
  ├─ Basel Opendatasoft adapter
  ├─ MeteoSwiss STAC adapter
  ├─ geo.admin / swisstopo adapter
  └─ BFS adapter
```

A thin proxy/API may later normalize these heterogeneous sources, but it is not required merely to demonstrate curated evidence in the showcase prototype.

Resolution order:

```text
user question
  ↓
required evidence roles
  ↓
Basel catalogue first
  ↓
unresolved role?
  ↓
Trusted Evidence Registry
  ↓
curated national candidate
  ↓
compatibility / representation
```

Do not label this full multi-catalogue support yet.

---

# Milestone 5 — MCP orchestrator

MCP comes after the website proves the semantic flow.

The MCP should expose the same core capabilities already demonstrated by the reference web client.

Candidate tools:
- search_datasets
- build_evidence_plan
- resolve_missing_evidence
- inspect_dataset
- assess_compatibility
- validate_relationship
- suggest_analysis
- suggest_representation
- get_representation_spec

The MCP is not merely a public-data retrieval service.

Its role is:

> return a defensible evidence architecture for a user's idea: what data fits, where it comes from, how it can work together, what has been validated, what remains missing, and how the result can be represented.

Expensive generative rendering should remain with the user's LLM host/client where possible.

---

# Worker/history remains later

A Worker is not required for the showcase prototype or for detecting datasets available in the current live catalogue.

A future scheduled service is useful for:
- catalogue snapshots
- true new/changed/disappeared detection
- change feeds
- cached model enrichment
- persisted derived results

This is an operational enhancement, not the current product bottleneck.

---

# Current build order

## Now

1. Zoomable hierarchical Atlas v2
2. tighter Discover layout
3. Build UX replacing user-facing Compose
4. RepresentationSpec + deterministic recommendations
5. minimal client-side previews

## Then

6. Trusted Evidence Registry
7. MeteoSwiss + swisstopo first integrations
8. BFS where useful for public-service/equity examples
9. evidence resolver that fills missing local roles from curated national sources

## After showcase flow is coherent

10. MCP orchestrator over the proven core

## Later

11. Worker/history
12. broader catalogue federation
13. optional LLM-assisted taxonomy/evidence enrichment

---

# Showcase success condition

A non-technical reviewer should be able to complete this story in roughly 3–5 minutes:

```text
Explore Basel's open-data landscape
  ↓
Describe something to understand or build
  ↓
See which local evidence supports it
  ↓
See missing roles filled by trusted Swiss public data where appropriate
  ↓
See the proposed output form
  ↓
Let DataFit check the required data relationships in the background
  ↓
Understand what is confirmed, rejected or still uncertain
  ↓
Preview a credible map/chart/brief
```

The technical evidence and compatibility machinery remains inspectable, but it should no longer be the primary experience.