# From Basel to every canton

Status, 2026-09-27: **groundwork built, no second canton loaded yet.** The code no longer assumes Basel (a test enforces it), and it can read opendata.swiss. The build environment could not reach any portal, so every canton-specific number below still has to be measured.

## The problem, restated for 26 cantons

DataFit's goal is to surface free datasets that exist but aren't used. Basel was a good place to design this: one portal, a rich API, 361 datasets, mostly German. Scaling it to every canton changes the problem in four ways.

1. **Different sources, different depth.**
   - Some cantons run their own Opendatasoft portal (the same API as Basel). That gives field schemas, record counts, record queries and sometimes usage counters.
   - Every canton can publish on **opendata.swiss** (CKAN, DCAT-AP CH). That gives metadata only: titles, descriptions, keywords, themes, frequency and file formats. There are no columns, record counts or usage figures.
   - Much free data also sits in cantonal geoportals (geocat.ch / geodienste.ch). That's a possible third adapter later.
2. **Languages.** German, French and Italian cantons, plus bilingual ones (FR, VS, BE, GR). The topic rules are German and English regular expressions.
3. **The same dataset twice.** A canton with its own portal is usually harvested into opendata.swiss too. Basel's `100052` reappears there as `100052@kanton-basel-stadt`.
4. **Honesty at a different scale.** Every claim DataFit makes was checked for Basel, for example "the catalogue has no pollen data". Such a claim must not silently turn into a claim about Ticino.

## What is built

| Piece | What it does |
|---|---|
| `src/portal.ts` | A portal entry holds: id, labels, place name, languages, API (`ods` or `ckan`), bbox, place names for questions, `verified`. Basel-Stadt is the first. Selected per page load with `?portal=`. |
| Guard test (`src/portal.test.ts`) | Fails if code outside an explicit list of Basel content files names Basel or `data.bs.ch`. A second canton stays a config entry. |
| Scoped gaps | "The {catalogue} does not provide pollen measurements" is a fact where it was checked (`gapCheckedIn: ['bs']`). In other portals it reads "Not yet checked for the … catalogue", and a role with scored candidates is never reported as "not in catalogue". |
| `src/data/ckan.ts` | opendata.swiss adapter and normaliser. Reads multilingual fields in the portal's language order and maps EU frequency URIs into the same cadence buckets. Infers "geospatial" from published formats. Leaves geometry type and record count **unknown** rather than guessing. Tested on a hand-written fixture; the live shape still needs checking. |
| `src/cantons.ts` | The 26 cantons with names in each language, plus `cantonOfPublisher()`, which assigns opendata.swiss publishers to cantons and separates city publishers such as `stadt-zuerich`. |
| `scripts/portals.ts` | `discover`: publishers per canton, as draft portal entries. `snapshot --portal`: freezes a catalogue. `audit --portal`: coverage table. It reproduces the Basel audit exactly. |
| Per-portal data | `src/data/portals/<id>/`: snapshot, topic decisions, gold labels. Dataset ids are unique only within a portal. |

## The rollout pipeline per canton

Each step is deterministic and has a gate. A canton is only as far along as the last gate it passed.

| Level | Step | Gate |
|---|---|---|
| L0 listed | `portals.ts discover`, then a person reviews the draft entry: publishers, languages, bbox from swissBOUNDARIES3D, place names | Entry merged in `src/portal.ts` with `verified: false` |
| L1 audited | `portals.ts snapshot` + `audit` | Coverage table committed. Every shape and cadence bucket sums to n. |
| L2 topics | `topic-decisions.ts requests`, then a labeller, then `apply` | Every stored decision passes the validator, i.e. quotes verbatim from that canton's metadata. |
| L3 evaluated | A person labels ~40 datasets as gold, then `eval` | No regressions from decisions. Accuracy is published with the canton. |
| L4 live | App loads the portal live; `verified: true` | Live count matches reported total, or the difference is explained. |
| L5 activity | Usage counters, where the portal has them (Basel: dataset 100057) | Coverage and distribution measured before anything ranks on them. |

A canton shows in the product from **L1**. The topic lens shows "rules only, not evaluated" until **L3**.

## Where the semantic step pays off most

The topic pipeline was built for Basel's German metadata, but it matters more elsewhere:

- **French and Italian cantons.** The German rules will mostly miss. opendata.swiss groups carry German and English names in every canton, so a weak signal exists, but most datasets will come out `weak` or `none` and go to a decision. That's the intended path: the model reads French or Italian, while the validator only checks that its quotes appear verbatim in that canton's metadata. The validator doesn't care which language they are in.
- **Cost stays bounded.** One request per dataset whose rules aren't clear, done once, and cached by metadata hash and taxonomy version. Later runs only touch datasets whose metadata changed. In Basel 23 of 44 needed one; the share will be higher in French and Italian cantons. It gets measured at L1, not assumed.
- **Gold stays human.** In Basel the labeller wrote both gold labels and decisions. For other cantons, a person should label the ~40-dataset gold sample, ideally before any model decision is made.

Everything else stays deterministic: portal discovery, normalisation, profile buckets, validation and precedence.

## What gets harder, and the decisions it needs

1. **Duplicates: cantonal portal vs opendata.swiss.**
   - Proposal: when both exist, use the cantonal portal (it's richer) and link the opendata.swiss copy by DCAT `identifier` (`<id>@<publisher>`).
   - Never count a dataset twice in a total.
   - Needs one measured check per canton: do identifiers really line up?
2. **The taxonomy becomes shared infrastructure.**
   - It was derived from Basel and already misses a waste/cleanliness subcategory (100288).
   - Any rename invalidates every decision in every canton, because `TAXONOMY_VERSION` changes. That's correct, but expensive.
   - So taxonomy changes should be batched and reviewed, not tuned per canton.
3. **Capabilities differ, so the UI must say what is unknown.**
   - A metadata-only canton has no schemas, record counts, compatibility checks or map previews.
   - The profile already has "unknown" buckets. The UI must show them as unknown, not as zero, and not as "non-spatial".
4. **"Unused" needs usage data, which only some portals publish.** Without counters, the honest statement is "no activity data", not "unused".

## The new discovery this unlocks: cantons side by side

A shared taxonomy and profile across cantons enable a view no single portal can offer: a **canton × subcategory coverage grid**, like HDX's Data Grids from the research doc.

- **Cells** hold counts, and empty cells show explicit gaps:
  - "Tree inventory: BS, ZH, GE — not found in 8 cantons at L2+"
  - "Noise measurements: only BS publishes sensor data"
- **"Same kind of data elsewhere"** on every dataset card: discovery by analogy, which is exactly how an unused dataset in one canton becomes visible to someone who knows its twin in another.
- **Gaps stay qualified by level.** "Not found" only counts for cantons that passed L2, the same honesty rule as the scoped gaps above.
- **Icons carry over.** Topic icons are keyed by category, so every canton gets them without new work.

## Next steps

1. **Allow network access** to `ckan.opendata.swiss` (and `data.bs.ch`). Then run `discover`, review the draft entries for two contrasting cantons (one French-speaking, e.g. GE or VD, and one with its own Opendatasoft portal) and take them to L1.
2. **Measure opendata.swiss.** Check the real package shape against `src/data/fixtures/ckan-package.json`, whether identifiers line up with Basel's portal, and CORS for browser loading.
3. **Human gold for the second canton**, then topic decisions via a real API labeller. That needs an API key in the environment.
4. **Coverage grid prototype** once two or more cantons are at L2.
