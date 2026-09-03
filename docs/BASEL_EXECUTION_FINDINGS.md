# Basel execution findings

What happened when the compatibility engine's structural hypotheses were run
against real Basel geometry, on **2026-09-03**.

The milestone question was:

> When the system proposes a spatial relationship, can we execute that operation
> against the real source data and confirm or reject the proposal while
> preserving provenance?

Yes — and the interesting part is how often the answer was *no*.

Reproduce with `npm run test:live` (excluded from `npm test`, which stays
offline).

## Execution substrate

**Chosen: Turf predicates over GeoJSON, in-process.**

| Option | Verdict |
| --- | --- |
| **GeoJSON + Turf (chosen)** | The data already *is* GeoJSON, so there is no conversion layer to get wrong. Same code path in the browser and in vitest, so offline fixture tests exercise the real engine. No server, no WASM, ~32 KB added to the bundle. |
| DuckDB Spatial (WASM) | Tens of megabytes of WASM plus fragile extension loading, to compute over at most a few thousand features. The cost is dominated by the bundle, not the work. |
| DuckDB Spatial (Node) | Requires a server. The app is a static SPA; introducing a backend is the largest piece of infrastructure in the milestone and buys nothing at this data size. |

The decisive argument is that **ingest, not compute, is the bottleneck.** How
much data we are willing to pull from a public API caps the problem at a few
thousand features, which is far below where a columnar engine starts to pay for
itself. `ExecutionEngine` is an interface, so DuckDB can replace Turf when
volumes justify it without touching the operation contracts.

### Limitations of the choice

- All geometry is assumed **WGS84 (EPSG:4326)** — an adapter-level guarantee of
  the Opendatasoft API, not a per-dataset declaration. Distances are geodesic
  metres. There is no reprojection, so a source in another CRS would be wrong,
  silently. Nothing in the Basel catalogue currently is.
- **Everything is in memory.** The 5,000-feature per-dataset budget is what
  keeps that safe.
- No spatial index. Nearest is O(source × target); at these sizes it runs in
  well under a second, but it will not scale to city-wide line networks.
- No true polygon-polygon overlay, no buffering, no interpolation.

### The API capability that made client-side execution viable

`/catalog/datasets/{id}/exports/geojson` returns an entire dataset as one
FeatureCollection, with `access-control-allow-origin: *`, and it accepts
`limit`, `where` and `select`. That is a different endpoint from `/records`,
which caps at 100 rows per request — paging that would have made this milestone
an infrastructure exercise instead of an analytical one.

One reliability caveat: under sustained sequential use a large export
occasionally fails at the transport level (`fetch failed`) while the same
request succeeds moments later. Transport failures are now retried with
backoff; HTTP error responses are not, because a 400 is an answer.

## Executions

| # | Pair | Proposal | Evidence before | Operation | Result | Hypothesis |
| --- | --- | --- | --- | --- | --- | --- |
| A | Fountains ↔ Tempo-30 zones | `spatial_join` / high | schema observed | containment | **confirmed** | held |
| B | Bicycle parking ↔ Pedestrian zones | `spatial_join` / high | schema observed | containment | **confirmed, weak** | held, but thin |
| C | Bike pumps ↔ Everyday cycle routes | `nearest` / high | schema observed | nearest, 50 m | **rejected** | failed |
| D | Fountains ↔ Everyday cycle routes | `nearest` / high | schema observed | nearest, 50 m | **rejected** | failed |
| E | Trees ↔ Everyday cycle routes | `nearest` / high | schema observed | nearest, 50 m | **rejected** | failed |
| F | Smart-street parking ↔ Rhine fishing-ban zones | `incompatible` / high | metadata only | containment | **confirmed** | rejection was right |
| G | Fountains per Tempo-30 zone | — | execution validated | aggregate | **confirmed** | — |
| H | Trees ↔ Tempo-30 zones | `spatial_join` / high | schema observed | containment | **partial** | held over a biased subset |
| I | School locations ↔ Tempo-30 zones | `spatial_join` / low | schema observed | — | **refused** | untestable as posed |

### A. Fountains within traffic-calmed zones — confirmed

`100008` (305 points) × `100252` (187 polygons) → **234 of 305 fountains (77%)
fell inside 61 of 186 zones.**

The strongest result in the set: a high-confidence, schema-observed containment
proposal that survived contact with the data at a rate high enough to build on.

It also surfaced something no amount of schema inspection could have found:
**one of the 187 published Tempo-30 features carries no geometry at all**, in a
layer that declares `Polygon` throughout. Execution reports the drift and
processes the 186 usable features.

### B. Bicycle parking within pedestrian zones — confirmed, and nearly useless

`100241` (1,437 points) × `100251` (48 polygons) → **15 of 1,437 (1.0%)**.

The operation executed cleanly. The join is real. It also describes one percent
of the data. This forced a distinction the engine now makes explicitly:
*"the operation works"* and *"the relationship is substantial"* are different
claims, and a result that reports only the first is misleading. Any containment
join below a 5% match rate now carries that warning.

### C, D, E. Nearest — three rejections in a row

| Pair | n | within 50 m | min | median | p90 | max |
| --- | --- | --- | --- | --- | --- | --- |
| Bike pumps ↔ cycle routes | 32 | 7 (21.9%) | 5.7 m | **103.9 m** | 393.6 m | 711.4 m |
| Fountains ↔ cycle routes | 305 | 97 (31.8%) | 2.2 m | **124.9 m** | 482.6 m | 1,477.4 m |
| Trees ↔ cycle routes | 5,000 | 1,045 (20.9%) | 0.2 m | **185.8 m** | 665.2 m | 1,669.6 m |

Every one of these was proposed as `nearest` with **high** confidence on
schema-observed evidence, and every one fails.

The reason is the same in all three cases and it is structural, not accidental:
**Alltagsvelorouten is 21 curated route lines, not a street network.** Anything
measured against it finds a nearest feature — a nearest feature always exists —
but for four fifths of the data that feature is a hundred metres or more away
and describes somewhere else entirely.

This is precisely the failure mode the compatibility engine warned about in
prose ("a distance threshold must be chosen; without one, far-away points still
find a nearest segment") and could not quantify. Execution quantifies it.

The engine does not reject on distance alone. It rejects because fewer than half
the source features have any target inside the threshold, which is the honest
test of whether a proximity join would describe the dataset or a corner of it.
Widening the threshold flips the verdict, and the threshold used is recorded on
every result — so a confirmation at 500 m cannot be mistaken for one at 50 m.

### F. Verifying a rejection

`100176` (6 points) × `100278` (7 polygons) → **0 matches.**

The compatibility engine had called this `incompatible` from bounding boxes
alone — metadata-only evidence, the weakest rung. Execution agrees. A negative
that has been checked is worth more than one that has been assumed, and this is
the cheapest possible way to check one.

### G. Aggregate — fountains per zone

Over execution A: **234 matches across 61 zones; 125 of 186 zones contain no
fountain at all; the median zone has 2; the largest has 81.**

That 81 is worth a second look before anyone builds on it — one zone holding a
third of all matched fountains suggests a single large old-town polygon rather
than a meaningful concentration. The aggregate reports it; it does not
interpret it.

### H. Truncation as a first-class outcome

`100052` (32,416 trees, truncated to 5,000) × `100252` → 2,481 of 5,000 matched
(49.6%), status **partial**, not confirmed.

ODS returns the first N rows, not a random sample, so a rate computed over the
first 5,000 trees need not hold for all 32,416. The result says so. This is why
`partial` exists as a status: reporting a lower bound as a clean confirmation
would be the same category of error as reporting a candidate join as validated.

### I. Refusing to guess

`100029 Schulstandorte` publishes **Point *and* Polygon** geometry in one layer.
There is no single correct containment operation, so the planner declines rather
than picking one. Two other classes of proposal are refused outright:
`interpolation_required` (needs a surface we have not built) and `direct_join`
(an attribute join, not a spatial one). Executing something adjacent and
reporting it as validation of the original claim would be worse than declining.

## Which structural assumptions survived?

**Survived:**

- **Point-in-polygon proposals.** All three containment executions produced real
  matches. Where the compatibility engine said `spatial_join` from two declared
  geometry types plus overlapping bounding boxes, geometry agreed.
- **Bounding-box rejection.** The one `incompatible` verdict tested was correct,
  from metadata-only evidence.
- **CRS.** The assumption that everything is WGS84 held on every dataset touched.
- **Declared geometry types**, with one exception (below).

**Did not survive:**

- **`nearest` at high confidence.** Three for three rejected. The engine assigns
  `nearest` high confidence whenever two layers have compatible geometry
  families and overlapping extents — but proximity is not a property of
  geometry types, it is a property of *density*, and nothing in the schema
  reveals density. **High confidence on a `nearest` proposal is not currently
  justified**, and this is the clearest thing to change in the compatibility
  engine.
- **"Declared geometry is what you get."** The Tempo-30 layer declares Polygon
  and ships a feature with no geometry.
- **Match existence implying analytical usefulness.** B executed perfectly and
  matched 1% of its input.

**Still untested:** interpolation, temporal alignment, aggregate/resample
mismatches, and every `direct_join` — key joins were sample-validated in the
previous milestone but have never been executed.

## Provenance retained per execution

Every `ExecutionResult` records: the assessment id that justified it, the
operation id and its full parameters, per-dataset source snapshots (dataset id,
source URL, retrieval timestamp, features used, total available, truncation
flag, geometry fingerprint, observed geometry types), engine name and version,
the output summary, and whether the original relation was confirmed — with the
reasons and warnings that led there.

Assessment ids are content-derived from both structure fingerprints plus the
rule version, so an execution referencing an assessment that no longer
reproduces is detectably stale rather than quietly wrong.

Nothing is persisted. Results live in memory for the session; that is
deliberate for this milestone.
