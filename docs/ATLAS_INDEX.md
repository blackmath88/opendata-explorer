# Atlas index — submission prototype

The Atlas is a **projection over the canonical catalogue**, not a replacement data model.

The live Basel-Stadt catalogue remains the source of truth. Whatever datasets the API returns are normalized into `DatasetRecord` and then classified at runtime into several navigation lenses.

No Worker is required for the showcase prototype. New catalogue entries fall into the index automatically on the next page load because classification runs over the freshly loaded catalogue.

## Current lenses

### Topic
A provisional Basel-focused civic taxonomy derived from title, description, official themes, keywords, publisher and existing semantic hints:

- Mobility & Transport
- Environment & Climate
- Built City & Infrastructure
- People & Society
- Public Space & Leisure
- Health & Wellbeing
- Education, Research & Culture
- Government & Economy
- Other / review needed

The classifier is deterministic and intentionally conservative. `Other / review needed` is a valid result; the system must not invent a category simply to make the visual complete.

The taxonomy should be refined after inspecting the actual distribution over the full live catalogue. A later optional LLM enrichment layer may propose categories for ambiguous datasets, but those assignments must remain marked as model inference rather than source metadata.

### Space
Derived from normalized geospatial metadata:

- Points
- Lines & networks
- Areas & zones
- Mixed geometry
- Other geospatial
- Spatial asset / transformation needed
- Non-spatial

### Time
Derived conservatively from realtime flags, time-series characteristics, update frequency and temporal coverage:

- Near-live
- Frequently updated
- Time series
- Periodic / historical
- Current state
- Static / unknown

This lens deliberately avoids calling an old dataset “archived” unless the source explicitly supports that claim.

### Readiness
A first navigation signal for analytical usability:

- Ready spatial layer
- Ready tabular data
- Needs transformation
- Mixed geometry
- Sparse / small
- Empty / external asset
- Unknown readiness

This is a **system inference**, not a data-quality certification.

## Product behavior

Discover now has two primary surfaces:

1. **List** — the complete, directly searchable catalogue. This is the default work surface.
2. **Atlas** — a stable D3 pack projection across Topic / Space / Time / Readiness.

Selecting an Atlas category drills into the complete list of datasets assigned to that bucket.

The use-case prompt remains separate from catalogue search. The question produces a proposed evidence plan and relevance ranking; direct catalogue search by id/title/publisher never mutates the user's intent.

## Recently updated

The prototype uses the normalized `modified` timestamp to show recently updated datasets. This does **not** imply the datasets are newly created.

A future change-history service or Worker could support true “new this week” detection, but that is outside the submission prototype.

## Future enrichment boundary

Preferred future sequence:

```text
source metadata
  -> deterministic atlas classifier
  -> ambiguous / other bucket
  -> optional LLM category proposal
  -> stored inference with confidence and rationale
```

LLM classification should improve navigation, never overwrite source facts.
