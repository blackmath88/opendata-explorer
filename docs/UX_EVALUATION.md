# UX evaluation — catalogue and evidence workbench

Evaluated on 2026-09-03 against `main` at `a75bf1d`. The live Basel-Stadt
Explore API reported **361 datasets**, and the adapter's ordered, de-duplicated
pagination also loads 361 unique records. The frozen fallback contains 44.

The baseline passed 131 offline tests and a production build. Interactive
browser automation was unavailable in the evaluation environment, so the
desktop (1440 px) and mobile (390 px) findings below are based on source/layout
inspection and the responsive rules rather than screenshots. This limitation is
recorded so visual QA is not overstated.

## First-time-user account

The opening view looks polished and immediately suggests that datasets are

clustered by topic. It does not, however, behave like a complete catalogue. The
question box changes a semantic ranking, the graph shows only its first 80
matches, only 24 nodes are labelled, and the inspector shows only ten cards.
There is no independent catalogue search. A user therefore cannot prove that a
known dataset exists, distinguish the visible subset from the loaded total, or
navigate all 361 records. The source pill contains a count, but the relationship
between “361 loaded” and “80 drawn” is not explained.

The path becomes clearer after datasets are added: the existing evidence-plan,
structure, compatibility and execution models are unusually strong. Most of
that value is below the fold, in the inspector, or only appears after a user has
already guessed the workflow. On mobile the inspector becomes a dismissible
drawer, which is workable, but it also hides the shortlist and workspace that
explain what the canvas means.

## Findings

| Area | Finding | Severity |
| --- | --- | --- |
| Catalogue | 361 live unique datasets load; the adapter uses `order_by=dataset_id` and de-duplicates. The header count is visible but does not state completeness against `reportedTotal`. | High |
| Catalogue | Only 80 datasets are rendered in D3 and at most 24 receive labels. The ten-card shortlist is the only textual index. This creates a credible false impression that records are missing. | Critical |
| Catalogue | A user cannot access every dataset from the baseline UI. There is no paging/complete list. | Critical |
| Search | The prompt is semantic intent input, not catalogue navigation. Exact id (`100008`), title/keyword (`Brunnen`) and publisher lookup are not guaranteed or independently available. | Critical |
| Landscape | A new force simulation starts on each render, selection and debounced resize. It visibly moves until natural cooling and interactions destabilize it. All nodes start at the centre, amplifying the initial burst. | High |
| Landscape | Topic centres are meaningful at cluster level, but individual positions are force artefacts. Labels overlap and a 300+ dataset catalogue cannot be navigated reliably through 80 circles. | High |
| Dataset detail | Title, id, publisher, licence, modified date, record count, update frequency, geometry, territory, temporal coverage, description and source link are shown. | Medium |
| Dataset detail | Themes, keywords, formats/features, all fields, field descriptions, licence link and clear source/schema/sample/system grouping are available in the model but incomplete, truncated, or visually mixed. | High |
| Use-case flow | All six benchmark prompts have deterministic regression expectations and defensible role plans. Direct/supporting/contextual classes appear on shortlist cards; missing/external roles appear only in Compose. | High |
| Use-case flow | There is no compact question/evidence summary. Users must infer the plan from graph color, ten cards and a later role grid. | High |
| Workspace | Add/remove works, but the selected set is at the bottom of a scrolling inspector. Compose activates with one dataset even though compatibility requires two. | High |
| Compose | Relation, confidence, evidence level, proposed operation, reasons, warnings and candidate keys are already rendered. `unknown` and `incompatible` have distinct treatments. | Medium |
| Execution | “Validate with real data” exists and preserves the assessment above the result. The result exposes raw summary keys, engine/version and notes, but proposal vs execution is not labelled strongly enough for non-developers. | High |
| Source state | Fallback is explicitly labelled and warns that it is offline. It needs a persistent diagnostic block with source, loaded count, reported total and timestamp; fallback must remain unmistakable. | High |
| Mobile | At 390 px the inspector is an overlay and the graph remains at a 480 px internal minimum. This makes the primary catalogue especially difficult to scan and hides the journey behind the Panel button. | High |

## Benchmark use cases

The six canonical cases are covered by deterministic tests rather than
subjective score snapshots:

| Case | Shortlist/plan assessment | Visible gaps |
| --- | --- | --- |
| Running comfort | Tree inventory, fountains and air-quality evidence are sensible; the evidence plan correctly separates route backbone, measures, context and constraints. | Pollen, elevation and a running-specific network are explicit gaps in the plan, but baseline discovery does not summarize them. |
| Urban heat | Tree/canopy and climate evidence are appropriate; the catalogue's three-row raster-link “canopy” dataset requires structural caution. | Land-surface temperature raster can remain unresolved. |
| Cycling safety | Cycle network, crashes and exposure denominator form a sensible method. | Perceived risk / near-miss reports are external. |
| Public fountain access | Fountains are a strong direct match and pair well with demand geography. | Public benches are absent. |
| Construction impact | Mobility counts and affected-network evidence are sensible; the obvious construction table lacks geometry, while permit polygons can be usable. | Closure/detour geometry is incomplete. |
| School environment | School locations plus air/noise context is reasonable. | School-site measurements are external and some school-safety datasets contain zero records. |

## Hidden but already-built capability

- Ordered, de-duplicated live pagination with reported-total diagnostics.
- A source-independent normalized catalogue and an honest 44-record fallback.
- Full schema inspection from catalogue rows without another request.
- Bounded sample observations, temporal aggregation and candidate-key checks.
- Deterministic intent parsing, evidence roles, unresolved roles and named
  external dependencies.
- Evidence classes and transparent relevance explanations.
- Geometry, temporal, identifier and extent compatibility assessment.
- Referenceable assessment ids, structure fingerprints and staleness checks.
- Real GeoJSON execution for containment, nearest and bounded aggregation.
- Confirmed, partial and rejected outcomes that preserve proposal provenance.

## Product recommendation

Make a complete, searchable **List** the default catalogue surface and retain
**Landscape** as a secondary exploration view. Put an evidence-plan summary
directly under the active question, keep the workspace persistently visible,
and enable Compose only at two selected datasets. In Compose, label the two
epistemic steps explicitly as **Proposal** and **Execution**, with plain-language
verdicts and metrics together. Freeze the force layout before it is displayed;
normal reading must not trigger motion.

This keeps the current public-service workbench and architecture intact while
making the strongest existing capabilities discoverable.

## Product Surface v1 results

Implemented on 2026-09-03. The public endpoint still reports **361 datasets**;
the ordered adapter loads **361 unique records**, all accessible in the default
scrolling List. The source control now states `361 / 361 datasets loaded` from
the actual `reportedTotal`; a mismatch is labelled partial. Fallback instead
states `44 cached datasets` and retains the live-unavailable warning.

### Catalogue and search

List is now the primary surface and Landscape is an explicit secondary toggle.
Rows remain dense while exposing title, id, publisher, topics, records,
geospatial/temporal signals, modification date and current evidence class.
Results retain relevance ordering for the active question. Independent search
operates over all loaded records and does not alter intent; regression tests
cover `100008`, `Brunnen`, and a real publisher value. Topic, geospatial and
temporal filters can be combined with it.

### Landscape

The previous graph started every node at the centre and painted every force
tick. It now derives deterministic positions from dataset ids, performs 260
ticks before paint, renders only the final coordinates and stops the
simulation. Selection rerenders to the same coordinates rather than visibly
reheating the graph. The view says exactly how many of the loaded catalogue it
shows and includes a Direct / Supporting / Contextual legend, hover titles and
selected state.

### Discover and inspector

The proposed evidence plan now sits above both catalogue views. It shows the
question, parsed spatial/temporal context, evidence-class counts, missing-role
count and an expandable role-to-dataset mapping. It is explicitly labelled as
system-inferred.

Dataset detail is separated into Overview, Catalogue, Structure, Observations
and Relevance concerns. It exposes themes, keywords, licence links, freshness,
records, formats, every published field with label/description and type,
geometry/CRS, temporal signals, candidate identifiers and bounded samples.
SOURCE, SCHEMA, SAMPLE and SYSTEM tags remain visually distinct.

### Workspace, Compose and execution

Workspace is now the first functional block in the inspector rather than being
buried below shortlist cards. Its count, inspect targets, remove actions and
Compose CTA remain together. Both the rail and CTA require two selected
datasets.

Compose opens with the plain-language question “How can these datasets work
together?” Each pair preserves a labelled PROPOSAL with relation, confidence,
evidence, reasons, warnings and operation. EXECUTION is appended rather than
replacing it. Confirmed, rejected, partial and failed now use separate labels
and interpretations; a runtime/transport failure is explicitly not treated as
evidence against a proposal.

### Demo and mobile behavior

Three compact demo cases sit beside the question with explanatory subtitles.
Running comfort exposes gaps and mixed evidence; Fountain access preloads the
real fountain/Tempo-30 pair that can confirm containment; Cycling safety leads
into spatial evidence and explains the rejection use case. No result is faked.

At approximately 390 px, List remains the default, search spans the available
width, row metadata collapses to a readable two-column hierarchy, and the
prompt remains separated from the scrollable list. Landscape requires explicit
selection. The inspector remains dismissible and contains Workspace plus its
Compose action at the top. This responsive assessment is code-led because an
interactive browser surface was unavailable in the execution environment.

### Verification and remaining gaps

Offline tests increased from **131 to 142**, across 11 files. They cover search,
complete/partial/fallback status, List/Landscape state, workspace count and
Compose thresholds, evidence-summary content, proposal retention, and
confirmed/rejected/partial/failed execution presentation. The production build
passes. Nine live execution integrations also passed against Basel during this
surface pass.

Remaining product gaps: browser-based visual and assistive-technology QA,
optional list sort controls beyond relevance order, and richer guidance for
choosing operation thresholds. Remaining engine gaps: reprojection, spatial
indexing, unbiased full-dataset execution above bounded budgets, interpolation
and polygon overlay. Later platform milestones remain unchanged: persistence,
multi-catalogue support, model assistance, MCP and Materialize. None were begun
here.

**Conclusion:** this is now a usable open-data workbench rather than merely an
engine demo. A user can establish catalogue completeness, find a known record,
understand a proposed evidence method, inspect its source structure, compose
two datasets and distinguish a proposal from its real execution outcome.
