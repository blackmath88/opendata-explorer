# Next build — trusted evidence beyond Basel

The core prototype now has enough internal machinery to move beyond manual dataset composition.

Current `main` already contains:

- live Basel-Stadt catalogue loading and normalization
- complete catalogue List/search
- hierarchical Atlas projections across Topic / Space / Time / Readiness
- one deterministic D3 hierarchy containing every dataset
- semantic zoom controls and Atlas focus state
- use-case intent + evidence-role planning
- schema/structure inspection
- deterministic compatibility assessments
- executable spatial validation against real Basel geometry
- user-facing **Build** framing instead of exposing `Compose` as the main mental model
- renderer-independent `RepresentationSpec`
- deterministic representation recommendations

The product direction is now:

```text
QUESTION
  ↓
LOCAL EVIDENCE — BASEL-STADT
  ↓
MISSING / WEAK EVIDENCE ROLES
  ↓
TRUSTED SWISS SUPPORTING SOURCES
  ↓
BUILD PLAN + REPRESENTATION
  ↓
BACKGROUND COMPATIBILITY / VALIDATION
  ↓
PREVIEW / RESULT
  ↓
MCP ORCHESTRATOR
```

`Compose` remains an internal system process. A normal user should not have to experiment with arbitrary dataset pairs.

---

# Current UX rule

The normal user journey should answer:

1. What do you want to understand or build?
2. What local Basel evidence supports it?
3. What important evidence is missing or too weak locally?
4. Can a trusted Swiss public source fill that gap?
5. What can DataFit build from the resulting evidence?
6. What relationships need checking before the proposed result is trustworthy?
7. What was confirmed, rejected, partial, or still unknown?

Detailed pairwise compatibility, schemas and provenance remain inspectable as technical detail, not the primary workflow.

---

# Next milestone — Trusted Evidence Registry v1

## Goal

When an evidence role is unresolved or materially weak in the Basel catalogue, DataFit should be able to propose a small curated set of official Swiss public-data sources that are known to be useful for that role.

This is **not** full multi-catalogue search.

This is an opinionated, testable registry of trusted supporting evidence.

Example for the running-route use case:

```text
LOCAL — BASEL-STADT
✓ trees / urban nature
✓ fountains
✓ traffic / mobility context
✓ construction context
△ local air measurements are sparse

SWISS PUBLIC DATA
+ swisstopo road/path network      → route backbone
+ swisstopo elevation / terrain    → slope / effort
+ MeteoSwiss weather               → current weather context
+ MeteoSwiss pollen                → allergen exposure

STILL MISSING
? evidence that cannot be defensibly resolved
```

The UI must make source scope and provenance obvious.

---

## 1. Research the real national sources first

Verify current official access patterns, metadata and licensing before implementing adapters.

Prioritize:

### MeteoSwiss

Research exact official sources for:
- weather observations
- temperature
- precipitation
- wind
- humidity
- pollen

Determine:
- catalogue/resource URL
- actual machine-readable endpoint
- STAC/REST/download access pattern
- geometry
- temporal resolution
- freshness
- Basel-area query/filter strategy
- CORS/browser viability
- licence / attribution requirements

### swisstopo / geo.admin.ch

Research exact official sources for:
- road/path network suitable as a route backbone
- elevation / terrain suitable for slope/effort

Determine:
- API/download endpoint
- available geometry/format
- whether Basel bounding-box extraction is practical
- browser CORS
- licence / attribution
- whether the source is suitable for direct execution or only download/materialization

### Federal Statistical Office — BFS/FSO

Research one or two high-value sources for:
- population denominators
- spatial population/geostatistics
- demographic context

This is secondary to MeteoSwiss + swisstopo for v1.

### opendata.swiss

Use it primarily as:
- national metadata discovery
- source validation
- catalogue linking

Do not ingest the whole national catalogue into DataFit.

Create:

`docs/TRUSTED_EVIDENCE_FINDINGS.md`

Record exact endpoints, formats, CORS, scope, freshness, licensing and caveats. Do not document guessed URLs or capabilities.

---

## 2. Introduce a curated registry

Suggested model — adapt if the current type system suggests a cleaner shape:

```ts
export type EvidenceScope = 'local' | 'national' | 'external';

export type TrustedAccessType =
  | 'opendatasoft'
  | 'ckan'
  | 'stac'
  | 'geo_admin'
  | 'rest'
  | 'download';

export interface TrustedEvidenceSource {
  id: string;
  label: string;
  provider: string;
  scope: EvidenceScope;
  trust: 'official';
  topics: string[];
  evidenceRoleIds: string[];
  accessType: TrustedAccessType;
  catalogueUrl: string;
  endpoint?: string;
  notes: string[];
}
```

If useful, distinguish provider/source from an individual curated resource.

The important thing is that the registry knows **why** a resource is useful:

```text
pollen          → MeteoSwiss pollen
weather         → MeteoSwiss observations
route backbone  → swisstopo roads / paths
elevation       → swisstopo terrain
population      → BFS geostatistics
```

This mapping is system curation, not source metadata. Preserve that provenance distinction.

---

## 3. Add an Evidence Resolver

Create a source-independent resolver boundary.

Conceptually:

```text
EvidencePlan
   ↓
role already filled adequately by Basel?
   ├─ yes → retain local evidence
   └─ no
       ↓
Trusted Evidence Registry
       ↓
rank only curated candidates for that role
       ↓
ExternalEvidenceCandidate[]
```

Rules:

- local adequate evidence wins by default
- national sources fill gaps; they do not automatically replace suitable Basel data
- a national candidate is a **candidate**, not a validated relationship
- never turn a registry match into compatibility evidence without inspection/validation
- do not search arbitrary internet sources
- do not silently claim retrieval succeeded when only metadata was found

Suggested candidate state:

```ts
interface ExternalEvidenceCandidate {
  roleId: string;
  sourceId: string;
  reason: string;
  scope: 'national' | 'external';
  status: 'known_source' | 'metadata_resolved' | 'retrievable' | 'inspected';
  origin: 'system_inference';
}
```

Exact types may differ.

---

## 4. Keep proxy/server infrastructure minimal

Do **not** add a Worker or proxy merely because the source APIs differ.

First verify direct browser access.

Preferred prototype architecture:

```text
frontend / DataFit core
  ├─ Basel adapter
  ├─ trusted registry
  ├─ MeteoSwiss adapter
  └─ swisstopo adapter
```

If a source cannot be used safely/reliably from the browser because of CORS, request shape or credentials, introduce the smallest normalization/proxy boundary needed and document exactly why.

Long-term we may expose a normalized API such as:

```text
/api/sources
/api/search
/api/datasets/:id
/api/data/:id
```

but that is not a requirement for this showcase milestone.

---

## 5. Integrate into Build, not a new catalogue screen

Do not make users browse a second national-data catalogue.

The normal Build summary should become something like:

```text
EVIDENCE FOR YOUR IDEA

Local · Basel-Stadt
✓ Tree inventory
✓ Fountains
✓ Traffic context

Swiss public data
+ MeteoSwiss pollen
  Fills: pollen / allergen exposure

+ swisstopo terrain
  Fills: elevation / slope

Still unresolved
✕ perceived route comfort
```

Each national candidate should show:
- provider
- scope (`Swiss public data`)
- role it fills
- why it was proposed
- retrieval/inspection status
- source link

Allow technical users to inspect details, but keep this compact by default.

---

## 6. Running demo acceptance case

The canonical running prompt should demonstrate the value of external resolution.

Expected behavior:

- Basel evidence is resolved first
- route-network weakness is explicitly recognized
- swisstopo roads/paths is proposed as a stronger route-backbone candidate if verified by research
- elevation gap resolves to a verified swisstopo source
- pollen gap resolves to MeteoSwiss pollen
- weather is offered as useful optional/current context
- local air-quality limitations remain honest rather than being hidden

Do not force an external candidate if the verified source does not actually support the role.

---

## 7. Tests

Add deterministic offline fixtures and tests for:

- local evidence wins when adequate
- external resolution happens only for unresolved/weak roles
- pollen → curated MeteoSwiss source
- elevation → curated swisstopo source
- route backbone → curated swisstopo source only if research validates suitability
- provenance/scope labels
- candidate status never implies compatibility validation
- missing remains missing when no curated source exists
- resolver works with no network

Add opt-in live tests only for stable official endpoints where useful.

Do not make the normal test suite depend on public APIs.

---

# Small parallel UX cleanup allowed

While integrating the resolver, clean up remaining implementation-language leaks in the user-facing Build flow:

- replace `Compose evidence` with `Build` / `Continue` / `Check data fit` language
- do not show the full pairwise relationship matrix by default
- keep the recommended `RepresentationSpec` visible as the purpose of the evidence plan
- show compatibility/validation only for relationships required by the chosen representation
- preserve technical detail behind an expandable section

Do not redesign the Atlas in this milestone unless an actual regression is discovered.

---

# Explicitly out of scope

Do not build yet:

- MCP server
- full opendata.swiss federation
- embeddings over the whole Swiss catalogue
- arbitrary web search
- live LLM classification
- Worker/history service
- auth/accounts
- persistent projects
- generic dashboard builder
- arbitrary generated HTML

---

# After this milestone

## Next — Representation preview/rendering

Use the existing `RepresentationSpec` contract to prove a very small renderer library:

- MapLibre map
- Observable Plot chart
- HTML evidence brief / comparison

Keep generation client-side.

## Then — MCP orchestrator

Expose the proven core to external LLM hosts:

```text
search_datasets
build_evidence_plan
resolve_missing_evidence
inspect_dataset
assess_compatibility
validate_relationship
suggest_representation
get_representation_spec
```

The MCP is an evidence/data orchestrator, not merely a retrieval API.

## Later

- Worker/history/change feed
- broader trusted-source registry
- multi-catalogue federation
- optional LLM-assisted taxonomy/evidence enrichment

---

# Showcase success condition

A non-technical reviewer should be able to complete this story in roughly five minutes:

```text
Explore Basel's data Atlas
  ↓
Describe an idea
  ↓
See useful local Basel evidence
  ↓
See important gaps
  ↓
See trusted Swiss sources fill appropriate gaps
  ↓
See what DataFit proposes to build
  ↓
Let DataFit check the necessary relationships in the background
  ↓
Understand what is confirmed, rejected or unresolved
```

That is enough to make the showcase prototype demonstrate the larger platform idea without prematurely building MCP or infrastructure.