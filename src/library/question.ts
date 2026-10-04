/**
 * The question shelf: what the catalogue holds for one use case, as shelf groups (docs/LIBRARY.md).
 *
 * Deterministic and built from the same pieces as the catalogue's "question" view:
 * parseUseCaseIntent -> buildEvidencePlan, plus the shared vocabulary. No model.
 *
 *   1. "The plan": one book per role of the evidence plan, in role order (only when a concept was
 *      recognised; otherwise the plan is a generic template and would only add noise). A role without a
 *      dataset stays on the shelf as an empty slot; it says whether the gap was checked.
 *   2. One group per recognised concept: every other dataset whose title or keywords start a word
 *      with one of the concept's catalogue terms, alphabetically.
 *   3. One group per word the vocabulary does not know, when a title has a word starting with it.
 *      Filler words ("gibt", "meiner") are skipped.
 *
 * Each dataset appears once (first group wins). Words that match nothing are reported, never
 * dropped silently. A group longer than the shelf takes folds to a "+N" slot; the list has all.
 */
import { buildEvidencePlan } from '../evidence';
import { parseUseCaseIntent } from '../intent';
import { literalTerms } from '../relevance';
import type { DatasetRecord, EvidencePlan, UseCaseIntent } from '../types';
import { conceptById, matchesIntentTerm, normalizeText } from '../vocabulary';

export const MAX_ON_SHELF = 14;

/** Question words that carry no subject (the ranking's own stoplist covers the shortest ones). */
const FILLER = new Set([
  'gibt', 'sind', 'wird', 'werden', 'kann', 'können', 'koennen', 'soll', 'sollte', 'habe', 'haben', 'hätte', 'wäre',
  'gute', 'guter', 'gutes', 'guten', 'mein', 'meine', 'meiner', 'meinem', 'meinen', 'unser', 'unsere', 'einer', 'eines', 'einem',
  'viel', 'viele', 'sehr', 'auch', 'noch', 'oder', 'aber', 'wenn', 'dann', 'dort', 'hier', 'heute', 'immer', 'alle', 'welche',
  'welcher', 'welches', 'warum', 'wieso', 'where', 'when', 'what', 'good', 'best', 'there', 'near', 'many', 'much', 'most',
]);

export type QuestionSlot =
  | { kind: 'dataset'; datasetId: string; why: string }
  | { kind: 'gap'; label: string; text: string; verified: boolean }
  | { kind: 'fold'; count: number };

export interface QuestionGroup {
  id: string;
  name: string;
  kind: 'plan' | 'concept' | 'word';
  /** Every dataset of the group, including those folded away on the shelf. */
  datasetIds: string[];
  slots: QuestionSlot[];
}

export interface QuestionShelf {
  statement: string;
  intent: UseCaseIntent;
  plan: EvidencePlan;
  recognised: Array<{ id: string; label: string }>;
  /** Words matched literally in titles (unknown to the vocabulary). */
  words: string[];
  /** Words that matched nothing at all. */
  unmatched: string[];
  groups: QuestionGroup[];
  /** Distinct datasets on the shelf or folded, never counted twice. */
  total: number;
}

/**
 * A catalogue term that starts a word of the title or a keyword. Stricter than the ranking's
 * substring match on purpose: "sport" must not match "Transport", nor "bewegung" "Flugbewegungen".
 * German compound heads still match ("Sportanlagen"); compound tails ("Baumkronen*bedeckung*") do not.
 */
export function startsWord(text: string, term: string): boolean {
  const hay = text.toLowerCase();
  for (let i = hay.indexOf(term); i >= 0; i = hay.indexOf(term, i + 1)) {
    if (i === 0 || !/[\p{L}\p{N}]/u.test(hay[i - 1])) return true;
  }
  return false;
}

const byTitle = (datasets: Map<string, DatasetRecord>) => (a: string, b: string): number =>
  datasets.get(a)!.title.localeCompare(datasets.get(b)!.title, 'de');

function fold(ids: string[], why: (id: string) => string): QuestionSlot[] {
  const shown = ids.length > MAX_ON_SHELF ? ids.slice(0, MAX_ON_SHELF - 1) : ids;
  const slots: QuestionSlot[] = shown.map(datasetId => ({ kind: 'dataset', datasetId, why: why(datasetId) }));
  if (shown.length < ids.length) slots.push({ kind: 'fold', count: ids.length - shown.length });
  return slots;
}

export function questionShelf(statement: string, datasets: readonly DatasetRecord[]): QuestionShelf {
  const intent = parseUseCaseIntent(statement);
  const plan = buildEvidencePlan(intent, [...datasets]);
  const index = new Map(datasets.map(dataset => [dataset.id, dataset]));
  const sort = byTitle(index);
  const placed = new Set<string>();
  const groups: QuestionGroup[] = [];

  const recognised = intent.domainHints.map(id => conceptById(id)).filter((concept): concept is NonNullable<typeof concept> => !!concept);

  // 1. The plan, in role order; without a recognised concept it would be a generic template.
  if (plan.roles.length && recognised.length) {
    const slots: QuestionSlot[] = plan.roles.map(role => {
      if (role.datasetId && index.has(role.datasetId) && !placed.has(role.datasetId)) {
        placed.add(role.datasetId);
        return { kind: 'dataset', datasetId: role.datasetId, why: `${role.label}${role.required ? ' (required)' : ''}: ${role.reason}` };
      }
      if (role.datasetId) {
        return { kind: 'gap', label: role.label, text: `Filled by “${index.get(role.datasetId)!.title}”, already on this shelf.`, verified: true };
      }
      const verified = role.gap?.kind === 'not_in_catalogue';
      return {
        kind: 'gap',
        label: role.label,
        text: verified ? `Not in the catalogue.${role.gap?.suggestion ? ` ${role.gap.suggestion}` : ''}` : `No dataset scored high enough; not checked by hand.${role.gap?.suggestion ? ` ${role.gap.suggestion}` : ''}`,
        verified,
      };
    });
    groups.push({ id: 'plan', name: 'The plan', kind: 'plan', datasetIds: slots.flatMap(slot => (slot.kind === 'dataset' ? [slot.datasetId] : [])), slots });
  }

  // 2. One group per recognised concept.
  for (const concept of recognised) {
    const hits = new Map<string, string>();
    for (const dataset of datasets) {
      if (placed.has(dataset.id)) continue;
      const inTitle = concept.catalogueTerms.find(t => startsWord(dataset.title, t));
      if (inTitle) { hits.set(dataset.id, `Its title uses “${inTitle}”, a term for ${concept.label.toLowerCase()}.`); continue; }
      const keyword = dataset.keywords.find(k => concept.catalogueTerms.some(t => startsWord(k, t)));
      if (keyword) hits.set(dataset.id, `The publisher's keyword “${keyword}” is a term for ${concept.label.toLowerCase()}; the title does not say so.`);
    }
    const ids = [...hits.keys()].sort(sort);
    ids.forEach(id => placed.add(id));
    if (ids.length) groups.push({ id: `concept:${concept.id}`, name: concept.label, kind: 'concept', datasetIds: ids, slots: fold(ids, id => hits.get(id)!) });
  }

  // 3. Words the vocabulary does not know: title matches only, so a common word cannot flood the shelf.
  const known = (word: string) => recognised.some(concept => concept.intentTerms.some(term => matchesIntentTerm(` ${word} `, term) || word.startsWith(term)));
  const words: string[] = [];
  const unmatched: string[] = [];
  for (const word of literalTerms(statement).filter(word => !known(word) && !FILLER.has(word))) {
    const ids = datasets.filter(dataset => !placed.has(dataset.id) && startsWord(dataset.title, word)).map(dataset => dataset.id).sort(sort);
    const already = datasets.some(dataset => startsWord(dataset.title, word));
    if (!already) { unmatched.push(word); continue; }
    words.push(word);
    ids.forEach(id => placed.add(id));
    if (ids.length) groups.push({ id: `word:${word}`, name: `“${word}” in the title`, kind: 'word', datasetIds: ids, slots: fold(ids, () => `Its title contains “${word}”; the vocabulary does not know this word.`) });
  }

  return { statement, intent, plan, recognised: recognised.map(({ id, label }) => ({ id, label })), words, unmatched, groups, total: placed.size };
}

/** For the page: normalised text of the question, used as a stable cache key. */
export const questionKey = (statement: string): string => normalizeText(statement).trim();
