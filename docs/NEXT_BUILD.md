# Next build — from Discover to validated evidence

This document is intentionally implementation-focused. The next build should **stabilize Level 1 and create the substrate for compatibility validation**. Do not build a polished Compose graph yet.

## Goal

At the end of the next build, a user should be able to:

1. load the real Basel-Stadt catalogue reliably
2. enter a use case
3. get a defensible dataset shortlist
4. add datasets to a workspace
5. see the intended role of each dataset
6. inspect real fields/schema/sample records for selected datasets
7. see first structured compatibility assessments between selected datasets

The system does **not** need to execute spatial joins yet.

---

# Phase 1 — Build/runtime verification

## Tasks

- run `npm install`
- run `npm run build`
- run app locally
- fix all TypeScript/runtime errors
- verify D3 rendering
- verify responsive shell
- preserve `DESIGN.md` exactly as the visual source of truth

## Acceptance

- clean build
- no console errors on first load
- fallback mode still works

---

# Phase 2 — Harden the Basel adapter

## Inspect real endpoints

Base:
`https://data.bs.ch/api/explore/v2.1`

Required:
- `/catalog/datasets`
- `/catalog/datasets/{dataset_id}`
- `/catalog/datasets/{dataset_id}/records`

## Tasks

- inspect real JSON response shape
- remove assumptions that do not match source response
- normalize title, description, publisher, theme, keyword, licence, modified time, features/formats
- preserve source URL/id
- verify pagination and catalogue total
- add explicit loading / live / fallback / failed status
- verify CORS in browser

## Acceptance

- live catalogue loads from Basel on normal browser run
- source mode is visible
- catalogue count is accurate
- normalizer handles missing optional metadata safely

---

# Phase 3 — Introduce structured use-case intent

Create:

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

Start deterministic. Do not require an LLM.

Create a parser that extracts useful hints from the current example use cases.

Canonical examples:
1. running comfort
2. urban heat interventions
3. cycling safety/comfort
4. public fountain access
5. construction/mobility impact
6. school environmental conditions

## Acceptance

- every benchmark prompt creates a stable `UseCaseIntent`
- parser has unit tests
- raw statement is always retained

---

# Phase 4 — Evidence classes and roles

Add two related concepts.

## Relevance class

```ts
export type EvidenceClass =
  | 'direct'
  | 'supporting'
  | 'contextual'
  | 'missing';
```

## Analytical role

```ts
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

## UI

In the inspector/workspace show:
- evidence class
- proposed analytical role
- why the role is useful
- whether the role is required
- unresolved/missing roles

Do not make the model's proposal look authoritative. Mark inferred roles clearly.

## Acceptance

For the running example, expected plan includes at least:
- route geometry → backbone / external
- canopy → primary measure
- air quality → primary/context exposure
- traffic → context
- fountains → context/amenity
- construction → constraint
- elevation → context
- pollen → missing/external

---

# Phase 5 — Dataset structure inspection

Create a new source-adapter method for selected datasets only.

Suggested API:

```ts
interface CatalogueAdapter {
  listDatasets(): Promise<DatasetRecord[]>;
  getDataset(id: string): Promise<DatasetRecord>;
  inspectDataset(id: string): Promise<DatasetStructure>;
}
```

Suggested model:

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

Use source metadata first. Add a small safe record sample only when required.

## Important

Clearly distinguish:
- metadata claim
- schema observation
- sample observation

## Acceptance

Selecting a Basel dataset can display:
- available fields
- geometry signal if available
- likely temporal fields
- sample values for a bounded number of fields/records
- evidence level

---

# Phase 6 — First compatibility engine

Do not use an LLM for the first implementation.

Create:

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

## First checks

Implement simple deterministic rules for:
- both datasets have geometry → candidate spatial relation
- point + polygon → candidate spatial join / within
- point + line → nearest candidate
- both have temporal coverage → overlap/no overlap
- same/similar candidate field names → candidate direct join
- obvious grain mismatch → aggregate/resample warning
- insufficient structure → unknown, never fake confidence

## UI

In Compose, show selected dataset pairs and compatibility cards/edges.

Example:

```text
Tree canopy ↔ route geometry
SPATIAL JOIN
Confidence: high
Evidence: schema observed
Reason: polygon coverage can be intersected with route geometry

Air quality ↔ route geometry
INTERPOLATION REQUIRED
Confidence: medium
Evidence: schema observed
Warning: sensor point density may be insufficient for precise route-level claims
```

## Acceptance

Test at least six relationships:
- 3 expected useful
- 3 expected uncertain/incompatible

The system must be able to return `unknown` and `incompatible`.

---

# Phase 7 — Benchmarks

Create fixtures/tests for six canonical use cases.

Each benchmark should specify:
- prompt
- expected intent hints
- expected evidence roles
- datasets/titles expected in top-N where known
- expected missing roles

Do not demand exact ranking numbers. Test semantic outcome.

Suggested path:

`src/benchmarks/useCases.ts`

---

# What NOT to build in this pass

- production authentication
- persistent projects/workspaces
- full LLM integration
- embeddings infrastructure unless trivial
- executable DuckDB spatial pipeline
- generic visual node editor
- Materialize generator
- MCP server
- multiple data portals
- elaborate graph animation

These are later milestones.

---

# Recommended commit sequence for Codex

1. `chore: verify build and harden app shell`
2. `fix: normalize live Basel catalogue metadata`
3. `feat: add structured use-case intent`
4. `feat: add evidence classes and analytical roles`
5. `feat: inspect selected dataset structures`
6. `feat: add deterministic compatibility assessments`
7. `test: add canonical use-case benchmarks`
8. `docs: report findings and remaining unknowns`

---

# Required Codex report

At the end, report:

## Build
- build status
- runtime status
- errors fixed

## Basel API
- actual catalogue schema observations
- CORS result
- pagination behaviour
- fields/features we can reliably normalize
- fields we expected but could not find

## Dataset inspection
- what schema/field metadata the API exposes
- how useful sample records are
- whether geometry type / temporal coverage can be inferred reliably

## Compatibility
- relationships tested
- what can be validated deterministically now
- what remains candidate-only

## Architecture concerns
- anything in the current model that should change before execution work

## Recommendation
- whether the repo is ready to begin the first executable spatial composition
