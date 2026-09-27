# Catalogue metadata audit (slice 1 of KNOWLEDGE_DISCOVERY.md)

Status, 2026-09-27: **offline snapshot audited; live catalogue and usage fields pending.** The build environment could not reach `data.bs.ch`, so everything below comes from the 44-dataset fallback snapshot that DataFit ships, not from the live catalogue. No figure here is a claim about Basel-Stadt OGD as a whole.

## What the Landscape can rely on (snapshot, n = 44)

| Signal | Coverage | Notes |
|---|---|---|
| Declared geometry | 43 of 44 classified | 19 point, 5 line, 5 area, 7 mixed, 1 raster/external, 6 non-spatial, **1 unknown** |
| Declared update frequency | 43 of 44 | Raw codes: `daily`, `hourly`, `cont`, `monthly`, `quarterly`, `annual`, `annual_2`, `triennial`, `irreg`, `as needed`, `never`; 1 missing |
| Record count | 44 of 44 | 6 under 10, 15 under 1k, 11 under 100k, 12 at 100k+; one dataset has `hasRecords: false` |
| Usage (reuses, API calls, downloads, popularity) | **not ingested** | See "Pending" below |

These drive the card profile (`src/catalogue-profile.ts`). Each dataset falls into exactly one shape bucket and exactly one cadence bucket, so every row adds up to the card's count. That's pinned by tests, including the rule that a question overlay never changes card membership or layout.

## Findings

1. **The `realtime` flag doesn't describe update cadence.** It is set on 2 monthly datasets and 1 irregular one. The profile therefore reads cadence from the *declared* frequency only. Whatever the flag means (live sensor feed? observation granularity?), it shouldn't be shown as "updated frequently".
2. **The cadence data needs five buckets, not the concept doc's four:**

   | Bucket | Count |
   |---|---|
   | frequent | 16 |
   | periodic | 10 |
   | irregular / as needed | 15 |
   | no updates | 2 |
   | unknown | 1 |

   Folding the 15 irregular ones into "periodic" or "static" would misstate a third of the snapshot.
3. **Topic rules: catch-alls took precedence over specific rules (fixed).** Rules were matched first-hit in category order, so Environment's catch-all `/umwelt|environment/` took any dataset whose *theme list* says "Raum und Umwelt" or "Territory and environment". That applied even to datasets tagged only "Mobilität und Verkehr".
   - Before: "Environment (other)" held 13 of 44, mostly traffic counts, accidents, bike routes and parking.
   - Fix: within each text, specific subcategories are tried before any "(other)" rule. 16 datasets moved.
   - Topic totals changed from Environment 30 / Mobility 12 / People 1 / Government 1 to Mobility 19 / Environment 17 / People 4 / Government 2 / Built City 2.
   - No dataset moved from a correct category to a wrong one.
4. **Remaining precision problems (not fixed, by design).** These are rule-design decisions for the taxonomy's owner. Scoring (title hits over keyword hits, word boundaries, matches counted) would address most of them.

   | Dataset | Assigned to | Should be | Cause |
   |---|---|---|---|
   | 100006, 100356 (motor-traffic counts, speed classes) | "Public transport" | Road traffic | Keyword vehicle lists contain "Busse" / "Bus" |
   | 100120 (traffic accidents) | "Cycling" | Road traffic | "velo" in the keywords |
   | 100040 (statistical units) | "Economy & labour" | Statistics | The English theme list contains "economy" |
   | 100030 (Schulstandorte) | Population | Schools | `/schule/` doesn't match "Schul-standorte" |
   | 100151 (Sport- und Bewegungsanlagen) | Utilities | Sports | Built City's `netz` rule is tried before Public Space's `sport` |
   | 100018 (Allmendbewilligungen) | Housing | Construction / public space | |

## Pending: needs live access to `data.bs.ch`

- **Denominator.** The live catalogue reported 361 datasets on 2026-09-02, while *OGD Datensätze* (dataset **100057**, the catalogue of the catalogue) listed **362** records. Resolve before showing any live total: is the extra one 100057 itself, a restricted dataset, or a duplicate?
- **Usage fields from 100057.** Reuse count, API-call count, download count and popularity score, joined by `dataset_id`.
  - Measure how many are missing and how values are distributed before designing anything on top.
  - Wording: these are *portal activity* counters. They miss use through opendata.swiss, bulk exports and mirrors, and they include automated traffic. Low activity is a weak signal, never "unused".
- **Rerun this audit on the live catalogue.** Geometry, cadence and record-count coverage at 361, plus the topic distribution after the rule fix.

The tables above can now be regenerated with `npx tsx scripts/portals.ts audit --portal bs` (and for any other portal; see MULTI_CANTON.md).

To unblock: allow `data.bs.ch` in the environment's network settings, or commit exports of `catalog/datasets` (all pages, `order_by=dataset_id`) and of dataset 100057 under `docs/audit-data/`.
