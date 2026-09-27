/**
 * Topic decisions, offline. Usage (npx tsx scripts/topic-decisions.ts <command>):
 *
 *   requests [out.json]                 datasets the rules cannot settle, as model requests
 *   apply <answers.json> --by <source> [--kind model|human]
 *                                       validate answers, store the accepted ones
 *   eval                                rules (first hit) vs scored rules vs scored + decisions,
 *                                       measured on src/data/topic-gold.json
 *
 * answers.json: [{ "datasetId", "subcategory", "confidence", "evidence": [{ "field", "quote" }], "rationale" }]
 * The same file shape is what a model returns for TOPIC_INSTRUCTIONS + a request.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fallbackDatasets } from '../src/data/fallback';
import { TOPIC_RULES } from '../src/topic-rules';
import { assessTopic } from '../src/topic-scoring';
import {
  TAXONOMY_VERSION, TOPIC_PROMPT_VERSION, buildTopicRequest, indexDecisions, metadataHash, needsDecision, resolveTopic, validateDecision,
  type TopicDecision, type TopicDecisionFile,
} from '../src/topic-decisions';
import { labelText, datasetText } from '../src/topic-rules';

const DECISIONS = 'src/data/topic-decisions.json';
const GOLD = 'src/data/topic-gold.json';
const [command, ...rest] = process.argv.slice(2);
const flag = (name: string) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : undefined; };
const load = (): TopicDecisionFile => JSON.parse(readFileSync(DECISIONS, 'utf8'));
const datasets = fallbackDatasets; // the live catalogue slots in here once reachable

if (command === 'requests') {
  const index = indexDecisions(load());
  const requests = datasets.flatMap(dataset => { const status = needsDecision(dataset, index); return status ? [buildTopicRequest(dataset, status)] : []; });
  const out = JSON.stringify(requests, null, 2);
  if (rest[0]) writeFileSync(rest[0], out + '\n'); else console.log(out);
  console.error(`${requests.length} of ${datasets.length} datasets need a decision (prompt ${TOPIC_PROMPT_VERSION})`);
} else if (command === 'apply') {
  const source = flag('by');
  if (!rest[0] || !source) throw new Error('usage: apply <answers.json> --by <source> [--kind model|human]');
  const kind = (flag('kind') ?? 'model') as 'model' | 'human';
  const answers: Array<Omit<TopicDecision, 'metadataHash' | 'taxonomyVersion' | 'decidedBy' | 'decidedAt'>> = JSON.parse(readFileSync(rest[0], 'utf8'));
  const file = load();
  let accepted = 0;
  for (const answer of answers) {
    const dataset = datasets.find(item => item.id === answer.datasetId);
    if (!dataset) { console.log(`REJECT ${answer.datasetId}: not in the catalogue`); continue; }
    const decision: TopicDecision = { ...answer, metadataHash: metadataHash(dataset), taxonomyVersion: TAXONOMY_VERSION, decidedBy: { kind, source, promptVersion: TOPIC_PROMPT_VERSION }, decidedAt: new Date().toISOString().slice(0, 10) };
    const check = validateDecision(decision, dataset);
    if (!check.ok) { console.log(`REJECT ${answer.datasetId}: ${check.reasons.join('; ')}`); continue; }
    file.decisions = file.decisions.filter(item => !(item.datasetId === decision.datasetId && item.decidedBy.kind === kind)).concat(decision);
    accepted++;
  }
  file.decisions.sort((a, b) => a.datasetId.localeCompare(b.datasetId));
  writeFileSync(DECISIONS, JSON.stringify(file, null, 2) + '\n');
  console.log(`accepted ${accepted} of ${answers.length}`);
} else if (command === 'eval') {
  const gold: Record<string, string[]> = JSON.parse(readFileSync(GOLD, 'utf8')).labels;
  const index = indexDecisions(load());
  // The pre-scoring behaviour (#15): first hit, specific before catch-all, label text before description.
  const firstHit = (id: string) => {
    const dataset = datasets.find(item => item.id === id)!;
    for (const haystack of [labelText(dataset), datasetText(dataset)]) for (const catchAll of [false, true]) for (const [, subs] of TOPIC_RULES) for (const [sub, pattern] of subs) {
      if (sub.endsWith('(other)') === catchAll && pattern.test(haystack)) return sub;
    }
    return 'Unclassified';
  };
  const methods: Record<string, (id: string) => string> = {
    'rules, first hit': firstHit,
    'rules, scored': id => assessTopic(datasets.find(item => item.id === id)!).pick.subcategory,
    'scored + decisions': id => resolveTopic(datasets.find(item => item.id === id)!, index).subcategory,
  };
  const ids = Object.keys(gold).filter(id => datasets.some(item => item.id === id));
  for (const [name, method] of Object.entries(methods)) {
    const wrong = ids.filter(id => !gold[id].includes(method(id)));
    console.log(`${name.padEnd(20)} ${ids.length - wrong.length}/${ids.length} correct${wrong.length ? `   wrong: ${wrong.map(id => `${id} -> ${method(id)}`).join(', ')}` : ''}`);
  }
  const scored = methods['rules, scored'], final = methods['scored + decisions'];
  const regressions = ids.filter(id => gold[id].includes(scored(id)) && !gold[id].includes(final(id)));
  console.log(regressions.length ? `REGRESSIONS by decisions: ${regressions.join(', ')}` : 'no regressions from decisions');
  const bySource: Record<string, number> = {};
  for (const dataset of datasets) { const source = resolveTopic(dataset, index).source; bySource[source] = (bySource[source] ?? 0) + 1; }
  console.log('resolved by', bySource);
  if (regressions.length) process.exitCode = 1;
} else {
  console.log('usage: requests [out.json] | apply <answers.json> --by <source> [--kind model|human] | eval');
}
