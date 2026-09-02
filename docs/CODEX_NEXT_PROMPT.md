# Codex prompt — next build: validated evidence substrate

You are continuing work in this repository:

`blackmath88/opendata-explorer`

Branch context:

`feat/level-1-discover-foundation`

Read these files before changing code:

1. `README.md`
2. `DESIGN.md`
3. `docs/ARCHITECTURE.md`
4. `docs/ROADMAP.md`
5. `docs/PRIOR_ART.md`
6. `docs/NEXT_BUILD.md`
7. `PROJECT BRIEF — Open Data Use-Case Explorer.md`

## Product direction

This is a use-case-first public-data workbench.

The user should not need to know dataset names or administrative vocabulary. They should be able to describe what they want to understand or build and receive a defensible evidence plan.

The longer-term journey is:

```text
intent
  -> discover evidence
  -> assign evidence roles
  -> inspect real structure
  -> validate compatibility
  -> compose executable analysis
  -> execute
  -> materialize map/dashboard/report/app/data output
```

Important positioning update after prior-art research:

- semantic dataset recommendation alone is NOT the project's core novelty
- Level 1 discovery is necessary infrastructure
- the stronger product bet is evidence design + join/compatibility validation + executable composition + materialization
- do not spend this pass building a generic AI chat or a decorative graph

## Design constraint

`DESIGN.md` is the visual source of truth.

Do not redesign the application.

Preserve the supplied Public Service Intelligence direction:
- warm Basel-inspired neutral surfaces
- forest green primary actions
- Inter typography
- 72px stage rail
- 380px contextual inspector on desktop
- restrained cards and borders
- dense professional data-tool rhythm

Do not introduce a different visual language, editorial serif framing, generic AI SaaS patterns, or a new component system.

## Primary goal

Stabilize the Level 1 implementation and build the substrate required to make future dataset relationships evidence-based.

At the end of this pass a user should be able to:

1. load the real Basel-Stadt OGD catalogue reliably
2. enter one of the benchmark use cases
3. receive a defensible shortlist of relevant datasets
4. see inferred evidence roles and unresolved missing roles
5. add datasets to a workspace
6. inspect real fields/schema/sample observations for selected datasets
7. see deterministic compatibility assessments between selected dataset pairs

Do NOT execute spatial joins yet.

---

# Work in this order

## 1. Verify and stabilize the current build

Run:

```bash
npm install
npm run build
npm run dev
```

Fix all TypeScript, bundling, runtime and D3 issues before feature work.

Verify:
- no console errors on first load
- responsive shell works
- fallback catalogue mode works
- existing visual design remains intact

Commit suggestion:

`chore: verify build and harden app shell`

---

## 2. Inspect the real Basel API and harden the source adapter

Base API:

`https://data.bs.ch/api/explore/v2.1`

Inspect at minimum:

- `/catalog/datasets`
- `/catalog/datasets/{dataset_id}`
- `/catalog/datasets/{dataset_id}/records`

Do not infer the schema from docs alone. Inspect actual responses.

Harden normalization for:
- id
- title
- description
- publisher
- themes
- keywords
- licence
- modified/freshness
- formats/features
- record count where available
- source URL
- source metadata that may help later compatibility analysis

Verify:
- browser CORS behavior
- pagination semantics
- total count
- missing/optional fields
- whether field/schema information is available from dataset metadata

Keep source-specific logic inside the Basel/Opendatasoft adapter.

Commit suggestion:

`fix: normalize live Basel catalogue metadata`

---

## 3. Add a structured use-case intent model

Implement a deterministic first version of:

```ts
export interface UseCaseIntent {
  statement: string;
  domainHints: string[];
  spatialNeed: boolean;
  temporalNeed?: 'current' | 'historical' | 'forecast' | 'mixed';
  geographicScope?: string;
  desiredOutcome?: string;
  constraints: string[];
}
```

Do not require an LLM.

Support the six canonical benchmark cases:

1. running comfort
2. urban heat interventions
3. cycling safety/comfort
4. public fountain access
5. construction/mobility impact
6. environmental conditions around schools

Add unit tests.

Commit suggestion:

`feat: add structured use-case intent`

---

## 4. Add evidence classes and analytical roles

Implement:

```ts
export type EvidenceClass =
  | 'direct'
  | 'supporting'
  | 'contextual'
  | 'missing';

export type EvidenceRoleType =
  | 'analysis_backbone'
  | 'primary_measure'
  | 'context'
  | 'constraint'
  | 'denominator'
  | 'geography'
  | 'validation'
  | 'external_dependency'
  | 'missing';

export interface EvidenceRole {
  id: string;
  label: string;
  roleType: EvidenceRoleType;
  datasetId?: string;
  required: boolean;
  reason: string;
}
```

Show these in the existing inspector/workspace UI.

For the running benchmark the evidence plan should include at minimum:

- route geometry -> analysis backbone / external dependency
- canopy -> primary measure
- air quality -> primary/context exposure
- traffic -> context
- fountains -> amenity/context
- construction -> constraint
- elevation -> context
- pollen -> missing/external dependency

Clearly label inferred roles as proposed rather than factual source metadata.

Commit suggestion:

`feat: add evidence classes and analytical roles`

---

## 5. Add real dataset structure inspection

Extend the source adapter concept toward:

```ts
interface CatalogueAdapter {
  listDatasets(): Promise<DatasetRecord[]>;
  getDataset(id: string): Promise<DatasetRecord>;
  inspectDataset(id: string): Promise<DatasetStructure>;
}
```

Use a model along these lines:

```ts
export interface FieldProfile {
  name: string;
  type?: string;
  label?: string;
  sampleValues?: unknown[];
  roleHints?: string[];
}

export interface DatasetStructure {
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

Important provenance rule:

distinguish clearly between:
- source/catalog metadata claim
- schema observation
- bounded sample observation

Do not present sample-derived assumptions as catalogue facts.

Keep record sampling bounded and safe.

Commit suggestion:

`feat: inspect selected dataset structures`

---

## 6. Build the first deterministic compatibility engine

Do not use an LLM for this version.

Implement:

```ts
export type CompatibilityRelation =
  | 'direct_join'
  | 'spatial_join'
  | 'nearest'
  | 'interpolation_required'
  | 'aggregate_required'
  | 'resample_required'
  | 'incompatible'
  | 'unknown';

export interface CompatibilityAssessment {
  leftDatasetId: string;
  rightDatasetId: string;
  relation: CompatibilityRelation;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
  warnings: string[];
  candidateKeys?: Array<{ left: string; right: string }>;
  proposedOperation?: string;
  evidenceLevel: 'metadata_only' | 'schema_observed' | 'sample_validated';
}
```

Initial deterministic checks should cover:

- geometry presence on both datasets
- point + polygon -> candidate spatial join / within
- point + line -> nearest candidate
- temporal overlap / non-overlap
- similar candidate key/field names -> candidate direct join
- obvious grain mismatch -> aggregate/resample warning
- insufficient evidence -> unknown
- known mismatch -> incompatible

The system MUST support `unknown` and `incompatible` as first-class results.

Do not force a positive relationship just because two datasets are topically related.

### UI

Reuse the existing Compose stage, but keep it simple.

Show selected dataset pairs and their compatibility assessment.

Examples:

```text
Tree canopy <-> route geometry
SPATIAL JOIN
confidence: high
evidence: schema observed
reason: polygon coverage can be intersected with route geometry
```

```text
Air quality <-> route geometry
INTERPOLATION REQUIRED
confidence: medium
evidence: schema observed
warning: sparse sensor points may not support precise route-level claims
```

Do not build a polished node editor yet.

Commit suggestion:

`feat: add deterministic compatibility assessments`

---

## 7. Add benchmark fixtures/tests

Create something like:

`src/benchmarks/useCases.ts`

Each benchmark should contain:
- prompt
- expected intent hints
- expected evidence roles
- known dataset/title expectations where reasonable
- expected missing roles

Avoid brittle exact-score assertions.

Test semantic outcomes and structural behavior.

Commit suggestion:

`test: add canonical use-case benchmarks`

---

# Important architectural rules

## The graph must earn its edges

Do not add a relationship to the composition graph solely because an LLM or semantic scorer says two datasets are related.

An edge should eventually carry:
- relation type
- proposed operation
- evidence level
- reasons
- warnings
- confidence

## AI is not the source of truth

Future AI may:
- interpret user intent
- propose evidence roles
- rerank candidates
- suggest possible transformations
- explain compatibility assessments

But deterministic/source-derived evidence remains visible.

## Candidate is not validated

Preserve a distinction between:
- metadata-derived candidate
- schema-observed relation
- sample-validated relation
- later execution-validated relation

This distinction is central to the project's differentiation.

---

# Explicitly out of scope for this pass

Do NOT build:

- production auth
- persistent projects
- multiple data portals
- full embeddings infrastructure
- generic chatbot
- generic node editor
- DuckDB spatial execution
- MCP server
- map/dashboard/report generator
- Materialize implementation
- elaborate graph animation

---

# Required final report

When done, add/update a short engineering findings document and report in your final response:

## Build
- install/build status
- runtime status
- issues fixed

## Basel API observations
- actual catalogue response shape
- browser CORS result
- pagination behavior
- reliable normalized fields
- unexpected/missing fields

## Structure inspection
- what field/schema metadata exists
- what had to be inferred from sample records
- geometry reliability
- temporal-field reliability

## Compatibility engine
- relationships tested
- which assessments are metadata-only
- which are schema-observed
- what remains candidate-only/unknown

## Architecture concerns
- model changes recommended before executable composition

## Recommendation

Explicitly answer:

> Is the repository ready to begin the first executable spatial composition milestone?

Do not start that milestone in the same pass unless all of the above is complete and you only document the recommendation.
