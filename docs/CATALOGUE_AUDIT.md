# Catalogue metadata audit (slice 1 of KNOWLEDGE_DISCOVERY.md)

Status, 2026-09-27: **live catalogue and usage fields audited.** The live figures below come from `data.bs.ch` (snapshot in `src/data/portals/bs/snapshot.json.gz`, regenerate with `npx tsx scripts/portals.ts audit --portal bs`). The older 44-dataset offline section follows, because the app's fallback still uses that set.

## Live catalogue (n = 363)

| Signal | Coverage |
|---|---|
| Declared geometry | 358 of 363 classified: 83 point, 9 line, 30 area, 19 mixed, 3 raster/external, **214 non-spatial**, 5 unknown |
| Declared update frequency | 348 of 363: 65 frequent, 100 periodic, 107 irregular, **76 no updates**, 15 unknown |
| Record count | 363 of 363, median 684 |
| Readable records | 360 of 363 |
| Topic (rules) | 188 clear, 148 conflict, 25 weak, 2 none: **175 need a decision** |

- **The offline snapshot is not representative.** It holds 6 non-spatial datasets out of 44 (14%), while the live catalogue has 214 of 363 (59%). The snapshot also has 2 datasets with no updates, against 76 live. Anything tuned on the 44 (layout weights, card profiles) should be re-checked on the 363.
- **Denominator resolved.** The catalogue reports 363 and 363 load. *OGD Datensätze* (100057) lists 362: every catalogue dataset except the newest (100549, created after 100057's last refresh). 100057 lists itself.
- **Stored topic decisions all went stale, then were rebased.** Basel added French theme names and edited descriptions on every dataset, so all 23 metadata hashes changed. `topic-decisions.ts rebase` carried each one forward, because its quotes still appear verbatim in its title or keywords. The old hash stays recorded, so the offline fallback remains covered.

## Usage fields (dataset 100057, n = 362)

Saved in `docs/audit-data/bs-usage-100057.json`.

| Field | Missing | Zero | Median | p90 | Max |
|---|---|---|---|---|---|
| download_count | 0 | 0 | 11 326 | 31 504 | 841 947 |
| api_call_count | 0 | 0 | 45 506 | 850 607 | 20 945 541 |
| popularity_score | 0 | 0 | 13.3 | 37.8 | 157.7 |
| reuse_count | 0 | **337** | 0 | 0 | 3 |

- **No dataset looks unused by these counters.** The minimum is 187 downloads and 321 API calls, so the counters include automated traffic.
- **Low counts mostly mean "new".** The least-used datasets were created in 2025–2026. Any activity signal has to be normalised by age (per month since `created`) before it says anything.
- **Documented reuse is the rare, meaningful signal:** 25 of 362 datasets have one or more reuses. "No documented reuse" is a fair statement; "unused" is not.

## Offline snapshot (n = 44)

### What the Landscape can rely on

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

## Formerly pending

Resolved on 2026-09-27; see "Live catalogue" and "Usage fields" above. The denominator, the usage fields and the live rerun are all done. What's still open is age-normalising the activity counters before any UI uses them.
