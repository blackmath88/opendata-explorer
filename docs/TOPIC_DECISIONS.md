# Topic decisions: rules first, a model only where rules conflict

The Landscape's topic lens needs one subcategory per dataset. Keyword rules decide as much as they can, and a model (or a person) decides only the rest. Code then checks every such decision before trusting it. **Nothing calls a model at runtime.**

## Pipeline

1. **Rules as a scorer** (`src/topic-scoring.ts`).
   - Each subcategory scores its hits, weighted by field: title 3, keywords 2, topics 1, themes 1, description 0.5.
   - Each dataset gets a status:
     - `clear`
     - `conflict`: the runner-up scores more than half of the winner
     - `weak`: the top score is below 2
     - `catch_all_only`
     - `none`
2. **Requests** (`npx tsx scripts/topic-decisions.ts requests`). Only datasets that aren't `clear` get one. A request carries:
   - the dataset's fields,
   - the closed list of allowed subcategories,
   - the rules' top candidates, as context only.

   The prompt (`TOPIC_INSTRUCTIONS`) and output schema live in `src/topic-decisions.ts` and are versioned (`topic-decision/v1`).
3. **Validation** (`validateDecision`). A decision is accepted only if all of these hold:
   - its subcategory is in the taxonomy,
   - its confidence is `high`, `medium` or `low`,
   - it quotes evidence, and every quote appears verbatim in the field it cites,
   - it was made on the dataset's current metadata hash and taxonomy version.
4. **Decisions as data** (`src/data/topic-decisions.json`). Each decision records who decided, with which prompt version, and when.
   - If the metadata or taxonomy changes, the decision goes stale and the rules apply again. The dataset also reappears in `requests`.
5. **Precedence** (`resolveTopic`): human > model at high/medium confidence > rules. A low-confidence model answer is kept for review but not used.
6. **Evaluation** (`npx tsx scripts/topic-decisions.ts eval`). Accuracy is measured against the gold labels in `src/data/topic-gold.json`, which may list several acceptable subcategories per dataset. The script exits 1 if any decision turns a correct rule answer into a wrong one. The same check runs in vitest.

## Current state (offline snapshot, n = 44)

| Method | Correct on gold |
|---|---|
| Rules, first hit (before #15) | 22 / 44 |
| Rules, scored | 38 / 44 |
| Scored + decisions | 42 / 44, no regressions |

- 23 datasets needed a decision. 22 are now resolved by decisions; 100013 was answered at low confidence, so the rules still apply.
- The remaining errors:
  - **100013** (bike and pedestrian counts): Cycling vs Walking is a genuine tie, so the model answered low and the rules' "Road traffic" stands. A human decision closes it.
  - **100288** (cleanliness index per street segment): the rules call it `clear` for Road traffic because the taxonomy has **no waste/cleanliness subcategory**. That's a taxonomy gap, not a classifier error. Status `clear` is not proof of correctness.

## Caveats before trusting the numbers

- **One author.** The draft gold labels and the 23 decisions were both made by the same Claude Code session, and the gold was written first. The score above therefore measures consistency, not correctness. A person should confirm or correct `topic-gold.json`. Human decisions go in with `apply <file> --by <name> --kind human`.
- **44 is small.** Rerun `requests` and `eval` on the live catalogue (361) once `data.bs.ch` is reachable.
- **A real model labeller** needs an API key in the environment. It would send `TOPIC_INSTRUCTIONS` plus each request with `TOPIC_OUTPUT_SCHEMA` as structured output, and pipe the answers into `apply`. The validator already treats its output as untrusted.
