/**
 * Typed topic decisions: where keyword rules are not enough, a model (or a person) chooses
 * among the existing subcategories, and code decides whether to believe it.
 *
 * - The vocabulary is closed: a decision names one subcategory from TOPIC_RULES, or none.
 * - Every decision quotes its evidence, and each quote must appear verbatim in the field it
 *   cites. A decision whose quotes are not in the metadata is rejected.
 * - Decisions are data (src/data/topic-decisions.json), keyed by dataset id, a hash of the
 *   metadata they were made on and the taxonomy version. Nothing calls a model at runtime;
 *   a changed dataset or taxonomy makes its decision stale, and the rules apply again.
 * - Precedence: human > model (high/medium confidence) > rules.
 */
import { canonicalJson, hashString } from './fingerprint';
import { OTHER_TOPIC, TOPIC_RULES } from './topic-rules';
import { assessTopic, topicFields, type TopicAssessment, type TopicField, type TopicStatus } from './topic-scoring';
import type { DatasetRecord } from './types';

export const TOPIC_PROMPT_VERSION = 'topic-decision/v1';
export const CONFIDENCES = ['high', 'medium', 'low'] as const;
export type DecisionConfidence = (typeof CONFIDENCES)[number];

export interface TopicEvidence { field: TopicField; quote: string }

export interface TopicDecision {
  datasetId: string;
  metadataHash: string;
  taxonomyVersion: string;
  /** One of the taxonomy's subcategories, or null for "none fits". */
  subcategory: string | null;
  confidence: DecisionConfidence;
  evidence: TopicEvidence[];
  /** One sentence for the reviewer. Code never reads it. */
  rationale: string;
  decidedBy: { kind: 'model' | 'human'; source: string; promptVersion: string };
  decidedAt: string;
  /** Earlier metadata this decision was carried over from by `rebaseDecision`, oldest first. */
  rebasedFrom?: Array<{ metadataHash: string; on: string }>;
}

export interface TopicDecisionFile { version: 1; decisions: TopicDecision[] }

/** subcategory -> category, straight from the taxonomy. */
export const SUBCATEGORY_CATEGORY: ReadonlyMap<string, string> = new Map(
  TOPIC_RULES.flatMap(([category, subcategories]) => subcategories.map(([subcategory]) => [subcategory, category] as const)),
);

/** Changes only when category or subcategory names change, not when a regex is tuned. */
export const TAXONOMY_VERSION = hashString(canonicalJson(TOPIC_RULES.map(([category, subs]) => [category, subs.map(([name]) => name)])));

export function metadataHash(dataset: DatasetRecord): string {
  return hashString(canonicalJson(topicFields(dataset)));
}

export type DecisionCheck = { ok: true } | { ok: false; reasons: string[] };

export function validateDecision(decision: TopicDecision, dataset: DatasetRecord): DecisionCheck {
  const reasons: string[] = [];
  if (decision.datasetId !== dataset.id) reasons.push(`decision is for ${decision.datasetId}, not ${dataset.id}`);
  // A rebased decision stays valid for the metadata it was carried over from.
  const hash = metadataHash(dataset);
  if (decision.metadataHash !== hash && !decision.rebasedFrom?.some(item => item.metadataHash === hash)) reasons.push('stale: dataset metadata changed since the decision');
  if (decision.taxonomyVersion !== TAXONOMY_VERSION) reasons.push('stale: taxonomy changed since the decision');
  if (decision.subcategory !== null && !SUBCATEGORY_CATEGORY.has(decision.subcategory)) reasons.push(`"${decision.subcategory}" is not a subcategory of the taxonomy`);
  if (!CONFIDENCES.includes(decision.confidence)) reasons.push(`confidence "${decision.confidence}" is not high|medium|low`);
  if (decision.subcategory !== null && !decision.evidence.length) reasons.push('no evidence quoted');
  const fields = topicFields(dataset);
  for (const { field, quote } of decision.evidence) {
    if (!(field in fields)) reasons.push(`evidence cites unknown field "${field}"`);
    else if (quote.trim().length < 3) reasons.push(`evidence quote "${quote}" is too short to check`);
    else if (!fields[field].toLocaleLowerCase().includes(quote.trim().toLocaleLowerCase())) reasons.push(`quote "${quote}" does not appear in ${field}`);
  }
  if (decision.rationale.length > 300) reasons.push('rationale longer than 300 characters');
  return reasons.length ? { ok: false, reasons } : { ok: true };
}

/**
 * Carry a decision over to changed metadata, when what it rests on did not change.
 *
 * Publishers edit metadata for reasons unrelated to topic (Basel added French theme names to
 * every dataset in 2026), and a plain hash check then throws away every decision. A decision
 * is rebased only if its metadata hash is the one problem, every quote is still verbatim in its
 * field, and at least one quote comes from the title or keywords (what the dataset is, not prose
 * around it). Otherwise it stays stale and the dataset goes back to `requests`.
 */
export function rebaseDecision(decision: TopicDecision, dataset: DatasetRecord, on: string): { decision: TopicDecision } | { reasons: string[] } {
  const check = validateDecision(decision, dataset);
  if (check.ok) return { decision };
  const other = check.reasons.filter(reason => reason !== 'stale: dataset metadata changed since the decision');
  if (other.length) return { reasons: other };
  if (!decision.evidence.some(item => item.field === 'title' || item.field === 'keywords')) return { reasons: ['no title or keyword evidence to anchor a rebase'] };
  return {
    decision: {
      ...decision,
      metadataHash: metadataHash(dataset),
      rebasedFrom: [...(decision.rebasedFrom ?? []), { metadataHash: decision.metadataHash, on }],
    },
  };
}

export type TopicSource = 'human' | 'model' | 'rules';

export interface ResolvedTopic {
  category: string;
  subcategory: string;
  source: TopicSource;
  /** What the rules alone said, kept for review and evaluation. */
  rules: TopicAssessment;
  decision?: TopicDecision;
}

export function indexDecisions(file: TopicDecisionFile): Map<string, TopicDecision[]> {
  const index = new Map<string, TopicDecision[]>();
  for (const decision of file.decisions) index.set(decision.datasetId, [...(index.get(decision.datasetId) ?? []), decision]);
  return index;
}

export function resolveTopic(dataset: DatasetRecord, decisions: ReadonlyMap<string, TopicDecision[]>): ResolvedTopic {
  const rules = assessTopic(dataset);
  const valid = (decisions.get(dataset.id) ?? []).filter(decision => validateDecision(decision, dataset).ok);
  const human = valid.find(decision => decision.decidedBy.kind === 'human');
  const model = valid.find(decision => decision.decidedBy.kind === 'model' && decision.confidence !== 'low');
  for (const [decision, source] of [[human, 'human'], [model, 'model']] as const) {
    if (!decision) continue;
    if (decision.subcategory === null) return { category: OTHER_TOPIC, subcategory: 'Unclassified', source, rules, decision };
    return { category: SUBCATEGORY_CATEGORY.get(decision.subcategory)!, subcategory: decision.subcategory, source, rules, decision };
  }
  return { ...rules.pick, source: 'rules', rules };
}

/** Which datasets want a decision: the rules are not clear and nothing valid covers them. */
export function needsDecision(dataset: DatasetRecord, decisions: ReadonlyMap<string, TopicDecision[]>): TopicStatus | null {
  const { status } = assessTopic(dataset);
  if (status === 'clear') return null;
  return (decisions.get(dataset.id) ?? []).some(decision => validateDecision(decision, dataset).ok) ? null : status;
}

// ---------------------------------------------------------------------------
// The request a model receives. Kept here so the prompt is versioned with the validator.
// ---------------------------------------------------------------------------

export const TOPIC_INSTRUCTIONS = `You classify one open-data dataset into an existing editorial taxonomy.
Choose exactly one subcategory from "allowed", or null if none fits. Never invent a category.
Decide by what the dataset primarily IS (its records), not by what it is related to: a count of
cars is road traffic even if its keyword list mentions buses; a tree inventory is urban nature
even though it is a cadastre. Portal themes are broad and often generic; weigh title and
keywords over themes and description.
Quote your evidence: each quote must be copied verbatim from the named field of the dataset.
Use confidence "low" when two subcategories fit about equally.
Answer with JSON only, matching the output schema.`;

export const TOPIC_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['subcategory', 'confidence', 'evidence', 'rationale'],
  properties: {
    subcategory: { type: ['string', 'null'] },
    confidence: { enum: [...CONFIDENCES] },
    evidence: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['field', 'quote'], properties: { field: { enum: ['title', 'keywords', 'topics', 'themes', 'description'] }, quote: { type: 'string' } } } },
    rationale: { type: 'string', maxLength: 300 },
  },
} as const;

export interface TopicRequest {
  datasetId: string;
  status: TopicStatus;
  dataset: Record<TopicField, string>;
  allowed: Array<{ category: string; subcategory: string }>;
  /** The rules' top candidates with their hits: context, not an answer. */
  ruleCandidates: Array<{ subcategory: string; score: number; hits: string[] }>;
}

export function buildTopicRequest(dataset: DatasetRecord, status: TopicStatus): TopicRequest {
  const fields = topicFields(dataset);
  return {
    datasetId: dataset.id,
    status,
    dataset: { ...fields, description: fields.description.slice(0, 1200) },
    allowed: [...SUBCATEGORY_CATEGORY].map(([subcategory, category]) => ({ category, subcategory })),
    ruleCandidates: assessTopic(dataset).ranked.slice(0, 4).map(score => ({ subcategory: score.subcategory, score: score.score, hits: score.hits.map(hit => `${hit.field}: ${hit.term}`) })),
  };
}
