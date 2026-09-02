# Codex prompt — validated evidence substrate

Continue work in `blackmath88/opendata-explorer`.

Before changing code read:
- `README.md`
- `DESIGN.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `docs/PRIOR_ART.md`
- `docs/NEXT_BUILD.md`
- `PROJECT BRIEF — Open Data Use-Case Explorer.md`

## Product direction

This is a use-case-first public-data workbench.

Do not treat semantic dataset search as the core novelty. Prior art already covers much of that. The stronger product direction is:

```text
intent
 -> discover candidate evidence
 -> assign evidence roles
 -> inspect real structure
 -> validate compatibility
 -> compose executable analysis
 -> execute
 -> materialize output
```

The key distinction is:

> datasets that sound related

versus

> datasets that can actually support a defensible analytical relationship.

## Design rule

`DESIGN.md` is fixed and is the visual source of truth.

Do not redesign the application or introduce a new component language. Preserve the current Public Service Intelligence UI.

## Goal of this pass

At the end, the user must be able to:
1. load the real Basel catalogue reliably
2. submit one of the canonical use cases
3. receive a defensible shortlist
4. see proposed evidence roles and missing roles
5. select datasets into a workspace
6. inspect real fields/schema/sample observations
7. see deterministic compatibility assessments between dataset pairs

Do not execute spatial joins yet.

## Work sequence

### 1. Verify the existing build

Run:

```bash
npm install
npm run build
npm run dev
```

Fix all TypeScript/runtime/D3 issues first.

Acceptance:
- clean build
- no first-load console errors
- fallback mode works
- visual design remains intact

### 2. Harden the Basel adapter

Inspect actual responses from:
- `https://data.bs.ch/api/explore/v2.1/catalog/datasets`
- `/catalog/datasets/{dataset_id}`
- `/catalog/datasets/{dataset_id}/records`

Verify browser CORS, pagination, totals, optional fields, and schema metadata.

Normalize source data safely while keeping Basel/Opendatasoft-specific code inside the adapter.

### 3. Add `UseCaseIntent`

Implement a deterministic structured intent model with:
- raw statement
- domain hints
- spatial need
- temporal need
- geographic scope
- desired outcome
- constraints

Create benchmark fixtures for:
1. running comfort
2. urban heat
3. cycling safety/comfort
4. public fountain access
5. construction/mobility impact
6. school environmental conditions

Add tests.

### 4. Add evidence classes and analytical roles

Use:

```ts
type EvidenceClass = 'direct' | 'supporting' | 'contextual' | 'missing';

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
```

Show inferred role, reason, required state, and unresolved gaps in the existing inspector/workspace.

Mark inferred roles as proposed, not factual source metadata.

### 5. Add real dataset structure inspection

Extend the adapter toward:

```ts
interface CatalogueAdapter {
  listDatasets(): Promise<DatasetRecord[]>;
  getDataset(id: string): Promise<DatasetRecord>;
  inspectDataset(id: string): Promise<DatasetStructure>;
}
```

`DatasetStructure` should capture:
- fields/types/labels
- bounded sample values
- geometry type/CRS/extent when available
- temporal fields/coverage/grain
- candidate keys
- record count
- evidence source

Preserve evidence distinctions:
- catalog metadata
- schema observed
- sample observed

### 6. Add deterministic compatibility assessment

Implement first-class results for:
- direct join
- spatial join
- nearest
- interpolation required
- aggregate required
- resample required
- incompatible
- unknown

Each assessment needs:
- left/right dataset
- relation
- confidence
- reasons
- warnings
- candidate keys if relevant
- proposed operation
- evidence level

Initial deterministic checks should cover geometry pairings, temporal overlap, candidate keys, grain mismatch, and insufficient evidence.

The system MUST be able to say `unknown` and `incompatible`.

### 7. Reuse Compose only as a compatibility view

Do not build a polished node editor yet.

Show selected dataset pairs and structured compatibility assessments.

A future graph edge should only exist when it can carry:
- relation type
- proposed operation
- confidence
- reasons
- warnings
- evidence level

The graph must earn its edges.

### 8. Add benchmark tests

Test semantic/structural outcomes, not brittle exact scores.

## Out of scope

Do not build:
- auth
- persistent projects
- multiple portals
- full embeddings infrastructure
- generic chatbot
- generic node editor
- DuckDB/spatial execution
- MCP server
- materialization generator
- elaborate graph animation

## Final report required

Report:

### Build
- install/build/runtime status
- issues fixed

### Basel API
- actual response/schema observations
- CORS result
- pagination behavior
- reliable normalized fields
- missing/unexpected fields

### Structure inspection
- exposed field/schema metadata
- what required sample inference
- geometry/temporal reliability

### Compatibility engine
- relationships tested
- evidence level of each
- what remains candidate-only/unknown

### Architecture concerns
- model changes needed before execution

### Go/no-go
Explicitly answer:

> Is the repo ready for the first executable spatial composition milestone?

Do not start that next milestone in this pass.
