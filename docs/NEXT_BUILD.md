# Next build — from Discover to validated evidence

The next build should **stabilize Level 1 and create the substrate for compatibility validation**. Do not build a polished Compose graph yet.

## Goal

At the end of the next build, a user should be able to:

1. load the real Basel-Stadt catalogue reliably
2. enter a use case
3. get a defensible dataset shortlist
4. add datasets to a workspace
5. see the intended role of each dataset
6. inspect real fields/schema/sample records for selected datasets
7. see structured compatibility assessments between selected datasets

The system does **not** need to execute spatial joins yet.

## Phase 1 — Verify the build

- run `npm install`
- run `npm run build`
- run the app locally
- fix TypeScript/runtime errors
- verify D3 rendering and responsive shell
- preserve `DESIGN.md` as the visual source of truth

Acceptance:
- clean build
- no first-load console errors
- fallback mode still works

## Phase 2 — Harden the Basel adapter

Inspect actual responses from:
- `/catalog/datasets`
- `/catalog/datasets/{dataset_id}`
- `/catalog/datasets/{dataset_id}/records`

Verify:
- response shape
- browser CORS
- pagination and total counts
- optional/missing fields
- field/schema information exposed by metadata

Normalize reliably:
- id/title/description
- publisher
- themes/keywords
- licence
- modified/freshness
- formats/features
- record count when available
- source URL/provenance

Acceptance:
- live catalogue loads in normal browser use
- source mode is visible
- count is accurate
- normalizer safely handles missing fields

## Phase 3 — Structured use-case intent

Introduce:

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

Start deterministic.

Benchmark use cases:
1. running comfort
2. urban heat interventions
3. cycling safety/comfort
4. public fountain access
5. construction/mobility impact
6. environmental conditions around schools

Acceptance:
- every benchmark produces a stable intent
- raw statement is retained
- parser has tests

## Phase 4 — Evidence classes and roles

```ts
export type EvidenceClass = 'direct' | 'supporting' | 'contextual' | 'missing';

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
```

Show in the inspector/workspace:
- evidence class
- proposed analytical role
- why it matters
- required/optional state
- unresolved missing roles

Running benchmark should include at least:
- route geometry → backbone / external
- canopy → primary measure
- air quality → primary/context exposure
- traffic → context
- fountains → context/amenity
- construction → constraint
- elevation → context
- pollen → missing/external

Mark inferred roles as proposed, not source facts.

## Phase 5 — Dataset structure inspection

Extend the adapter concept:

```ts
interface CatalogueAdapter {
  listDatasets(): Promise<DatasetRecord[]>;
  getDataset(id: string): Promise<DatasetRecord>;
  inspectDataset(id: string): Promise<DatasetStructure>;
}
```

Suggested structure model:

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
  geometry?: { type: string; crs?: string; extent?: [number, number, number, number] };
  temporal?: { fields: string[]; start?: string; end?: string; grain?: string };
  candidateKeys: string[];
  recordCount?: number;
  observedFrom: 'catalog_metadata' | 'schema' | 'sample_records';
}
```

Keep distinctions visible between:
- metadata claim
- schema observation
- sample observation

Use bounded samples only for selected datasets.

## Phase 6 — First compatibility engine

Do not use an LLM for the first version.

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

Initial deterministic checks:
- both datasets have geometry → candidate spatial relation
- point + polygon → candidate spatial join / within
- point + line → nearest candidate
- temporal overlap/no-overlap
- same/similar candidate field names → candidate direct join
- obvious grain mismatch → aggregate/resample warning
- insufficient structure → `unknown`
- known mismatch → `incompatible`

The system must be able to return `unknown` and `incompatible`.

Compose UI should show pairwise compatibility records, not a polished node editor.

## Phase 7 — Benchmarks

Create fixtures/tests for the six canonical use cases.

Each benchmark should specify:
- prompt
- expected intent hints
- expected evidence roles
- expected top-N datasets/titles where known
- expected missing roles

Do not demand exact score numbers; test structural outcomes.

## What not to build in this pass

- production authentication
- persistent projects/workspaces
- full LLM integration
- generic node editor
- DuckDB spatial execution
- MCP server
- multi-catalogue federation
- Materialize generator
- elaborate graph animation

## Recommended commit sequence

1. `chore: verify build and harden app shell`
2. `fix: normalize live Basel catalogue metadata`
3. `feat: add structured use-case intent`
4. `feat: add evidence classes and analytical roles`
5. `feat: inspect selected dataset structures`
6. `feat: add deterministic compatibility assessments`
7. `test: add canonical use-case benchmarks`
8. `docs: report findings and remaining unknowns`

## Required engineering report

At the end report:

### Build
- build/runtime status
- errors fixed

### Basel API
- actual catalogue schema observations
- CORS result
- pagination behaviour
- reliably normalized fields
- expected fields that were absent

### Dataset inspection
- exposed schema/field metadata
- usefulness of sample records
- reliability of geometry/temporal inference

### Compatibility
- relationships tested
- what is metadata-only vs schema-observed vs sample-validated
- what remains candidate-only/unknown

### Architecture concerns
- model changes recommended before execution work

### Recommendation
Explicitly answer:

> Is the repository ready to begin the first executable spatial composition milestone?
