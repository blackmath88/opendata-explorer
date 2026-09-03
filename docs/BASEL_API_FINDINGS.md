# Basel OGD API and compatibility findings

Observations from working directly against `https://data.bs.ch/api/explore/v2.1`
(Opendatasoft Explore API v2.1) on **2026-09-02**. Everything below was checked
against live responses, not against the Swagger description.

## Catalogue endpoint

`GET /catalog/datasets`

- **361 datasets**, all `visibility: "domain"`.
- Response shape is `{ total_count, results[] }`. Each result carries
  `dataset_id`, `dataset_uid`, `has_records`, `features`, `attachments`,
  `alternative_exports`, `fields`, and `metas`.
- `metas` splits into `default`, `dcat`, `dcat_ap_ch`, `custom`, `semantic`,
  `reuses`. The useful material is almost entirely in `metas.default` and
  `metas.dcat`.

### The listing already contains the full field schema

`results[].fields` is the complete schema for every dataset, with `name`,
`type`, `label`, `description` and `annotations`. **Dataset structure inspection
therefore costs zero extra requests.** This is the single most consequential
finding for the architecture: the whole catalogue can be lifted to
`schema`-level evidence in four HTTP requests.

The cost is payload size: the full catalogue is ~5.2 MB across four pages.
`select` cannot be used to trim it without losing `metas` nesting and `fields`
entirely (`select=metas` returns `Unknown field: metas`; `select=default.title`
flattens the response into a different shape).

### Pagination is not stable without `order_by`

`limit` is capped at **100** on this endpoint. Paging four pages *without*
`order_by` returned **361 rows containing only 360 distinct datasets** — one
dataset (`100030`) appeared twice and another was dropped. The bug was visible
in the app as a dataset count of 362 on one load and 361 on the next.

Adding `order_by=dataset_id` yields 361 distinct datasets reproducibly. The
adapter now sends it and additionally de-duplicates by id.

### CORS

`access-control-allow-origin: *` on every endpoint tested, with
`access-control-allow-methods: POST, GET, OPTIONS`. **No proxy is needed** —
the browser can call the API directly, which is how the app runs.

Rate limiting is advertised through `x-ratelimit-limit: 500000` per day.

### Metadata coverage across all 361 datasets

| Field | Coverage | Notes |
| --- | --- | --- |
| `default.title` / `description` / `publisher` / `license` / `theme` | 361/361 | reliable |
| `default.records_count` | 361/361 | reliable |
| `default.geometry_types` | 141/361 | source-declared; `Point` 86, `Polygon` 46, `LineString` 12, `MultiPolygon` 10, `GeometryCollection` 8, `MultiLineString` 3 |
| `default.bbox` | 141/361 | a GeoJSON **Feature**, not a bbox array |
| `dcat.temporal_coverage_start/end` | 152/361 | |
| `dcat.accrualperiodicity` | 349/361 | EU authority URI (`.../frequency/DAILY`) |
| `default.territory`, `geographic_reference` | present | `Basel-Stadt`, `ch_40_12` |
| `default.update_frequency`, `attributions`, `source_domain` | always null | not used |
| `metas.semantic.*` | always null | the RML/class/property block is unpopulated |

### Fields we expected but did not find

- **No `distinct_count`, cardinality or null-rate statistics** per field. Value
  distribution has to be sampled.
- **No declared CRS per dataset.** ODS serves `geo_point_2d` / `geo_shape` as
  WGS84 lon/lat, so `EPSG:4326` is recorded as an *adapter-level* guarantee
  rather than a source fact.
- **No station/site count** for measurement time series, which is exactly the
  number needed to judge sensor density (see *Compatibility* below).
- `alternative_exports` is empty everywhere, so export formats are inferred
  from `has_records` plus geometry rather than enumerated.

### Metadata quirks that had to be handled

1. **Descriptions are HTML.** They contain `<div>`, `<p>`, `<a href>` and even
   `<font face="Arial">`. The previous build rendered them escaped, so raw
   markup appeared in the UI. They are now stripped to text in the normalizer,
   including unterminated tags left by truncation.
2. **The catalogue is German.** `metadata_languages` is `["de"]` for effectively
   all datasets: `title_en` and `description_en` are usually copies of the
   German. Only `theme_en` is genuinely translated. All language variants are
   folded into one lowercase `searchText` blob so an English question can reach
   a German dataset.
3. **`bbox` is a Feature.** It must be reduced to `[minLon, minLat, maxLon, maxLat]`.
   A single-point dataset gets padded to roughly a 0.001° box, so an exact
   degenerate-extent test never fires; a ~200 m threshold is used instead.
4. **"Realtime" cannot be read off the title.** It is derived from
   `accrualperiodicity` (`CONT`, `UPDATE_CONT`, `HOURLY`, `10MIN`, `1MIN`) and
   from declared time grain.

## Dataset endpoint

`GET /catalog/datasets/{dataset_id}` returns exactly the same object as one
listing row. It is only needed for a dataset that was not in the cached listing.

## Records endpoint

`GET /catalog/datasets/{dataset_id}/records`

- `limit` capped at **100**; `limit=101` is rejected with
  `InvalidRESTParameterError`.
- Rows expand `geo_point_2d` to `{lon, lat}` and `geo_shape` to a GeoJSON Feature.
- **ODSQL aggregation works and is the most valuable capability here:**
  `select=min(f) as a, max(f) as b, count(*) as n` runs server-side over the
  whole dataset. Real temporal coverage is one request, not a paging exercise.
- **`group_by` returns distinct values** without downloading records.
- **`where field in (...)` performs an exact membership test** against the whole
  dataset. Numeric fields reject quoted literals
  (`IncompatibleTypesInComparisonFilter`), so the literal form depends on the
  field type.

### Sampling budget actually used

| Purpose | Requests |
| --- | --- |
| Full catalogue + every schema | 4 |
| Structure of one dataset (schema level) | 0 |
| Upgrade one dataset to sample level | ≤ 2 (one 5-row page, one min/max aggregate) |
| Validate one candidate key pair | 3 (left distinct, membership, right distinct) |

Per analysis pass the workspace orchestrator caps sampling at 8 datasets,
21 pairs and 6 key probes.

## Dataset structure inspection

**What the schema gives us for free**

- Field names, types, labels and descriptions for every dataset.
- `annotations.id: true` — the publisher's own identifier marking. Present on
  75 fields across 50 of 361 datasets. These are the only *declared* candidate
  keys; everything else is a name heuristic and is labelled as such.
- `annotations.unit` — 294 fields (`μg/m3`, `°C`, `km/h`, `m3/s`, …). This is
  what distinguishes a measurement from an attribute.
- `annotations.timeserie_precision` — 149 fields (`minute` 41, `hour` 20,
  `day` 48, `month` 13, `year` 27). This is the declared time grain.

**Geometry inference: reliable, with two caveats**

`geometry_types` plus the presence of `geo_shape` / `geo_point_2d` fields agree
in every case checked. Observing the field is treated as stronger evidence than
the metadata claim, and the two provenances are reported separately.

- Some datasets declare `GeometryCollection` *alongside* `LineString` and
  `MultiLineString` (e.g. `100189 Strassennamen`). The collection is a container,
  not a family; treating it as its own type made the street network
  unclassifiable and produced `unknown` for pairs that are plainly relatable.
- A few datasets declare geometry types the schema does not back with a
  geometry field. That mismatch is now surfaced as a note.

**Temporal inference: only partly reliable**

- Time *fields* are reliable (`date` / `datetime` types).
- Time *grain* is only declared for 149 of 361 datasets. `100050 Luftqualität
  Station Feldbergstrasse` is an hourly series with no `timeserie_precision`
  annotation at all, while its sibling `100048 Chrischona` has one. Grain
  detection therefore cannot be the only signal for anything important.
- Coverage windows from `dcat` are a **claim**. Sampling `min()`/`max()` over
  `100052` returned `0960-01-01` as the earliest planting date — a real data
  error that the metadata does not mention. Metadata-claimed and
  record-observed coverage are stored with separate provenance.

**Candidate keys: usable, never trusted**

Publisher-declared identifiers exist for 50 datasets. Everything else comes from
a name heuristic and is marked `name_heuristic` in the UI. Name similarity alone
never produces better than `low` confidence.

## Compatibility results

Eight real Basel pairs, assessed by the deterministic engine with record
sampling enabled.

| Pair | Relation | Confidence | Evidence |
| --- | --- | --- | --- |
| Baumkataster (point) ↔ Alltagsvelorouten (line) | `nearest` | high | schema observed |
| Tempo-30-Zonen (polygon) ↔ Brunnen (point) | `spatial_join` | high | schema observed |
| Verkehrszähldaten ↔ Standorte der Zählstellen | `direct_join` | high | **sample validated** |
| Baumkronenbedeckung ↔ Alltagsvelorouten | `unknown` | low | sample validated |
| Luftqualität Chrischona ↔ Strassennamen | `interpolation_required` | medium | schema observed |
| Baustellen ↔ Strassennamen | `unknown` | low | sample validated |
| Smarte Strasse Parkplatz-Zonen ↔ Fischereiverbotszonen Rhein | `incompatible` | high | metadata only |
| Geschwindigkeitsmonitoring (minute) ↔ Sauberkeitsindex (month) | `interpolation_required` | medium | schema observed |

**Only one relationship reached `sample_validated` as a positive result:**
`100013.zst_nr ↔ 100038.id_zst`, where 47 of 49 distinct counting-station
numbers were found in the station-location dataset. That is the only join in
this set that is validated rather than merely plausible.

### Three findings that justify the whole project

1. **Baumkronenbedeckung is not a canopy layer.** Every planning document for
   this project — including the original brief — assumes "tree canopy" can be
   intersected with a route. Dataset `100357 Baumkronenbedeckung` has **three
   records** and four fields: `jahr`, `url_png`, `url_pgw`, `url_tif`. It is a
   table of raster download links with no geometry. The semantically perfect
   answer cannot support the analytical method. The usable substitute is
   `100052 Baumkataster: Baumbestand`, 32,416 tree points.

2. **Baustellen has no geometry.** `100335 Baustellen` (96 records) publishes
   project names, descriptions and `datum_von`/`datum_bis`, but nothing spatial.
   The construction constraint in a route planner cannot be computed from it.
   The dataset that *can* serve that role is the far less obvious
   `100018 Allmendbewilligungen` — 260,350 polygon permits on public land.

3. **Air quality is measured at a handful of fixed stations.** The stations that
   publish geometry cover a single site each. `100048 Chrischona` sits outside
   the extent of the city street and cycle-route layers entirely, so the engine
   returns `incompatible` for it against those layers — correctly. Attributing
   any of these stations' readings to arbitrary street segments requires
   interpolation, and the engine says so rather than offering a nearest join.

Two more, smaller:

4. **Some datasets are published with zero records.** `100056 Schulwegsicherheit:
   Fusswege`, `100053 Schulwegsicherheit: Strassenquerungen` and
   `100250 Strassen und Wege: Strassentypen und Wege` all have
   `records_count: 0`; the last one still advertises the `geo` feature. They are
   excluded from role proposals with an explicit reason.

5. **No pollen and no elevation model exist in this catalogue.** Both are
   reported as gaps with a named external source, which is the behaviour the
   brief asks for.

### What remains candidate-only

- Every geometry relation. Geometry types and bounding boxes are metadata or
  schema evidence; whether features actually intersect is not known until
  something executes the operation.
- Every key pairing where only field names line up.
- Sensor density. The catalogue does not publish a station count, so
  "sparse" is inferred from declared grain, single-site extent, or a small
  record count, and the warning says the station count is unknown.
- Time-grain mismatches where neither side declares `timeserie_precision`.

### Bounded sampling can produce false negatives

An early implementation compared 100 distinct values from each side and reported
"no overlap" for `zst_nr ↔ id_zst` — a join that is in fact valid. The two
capped samples simply did not intersect. The engine now tests the left side's
values against the *whole* right dataset with `where … in (…)`, and when the
left sample is itself capped a zero result is reported as **unverified, not
disproved**.
