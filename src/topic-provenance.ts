/**
 * What the topic lens rests on, for this portal: keyword rules, validated decisions, and
 * whether anyone has checked the result. Shown in the UI so a canton that was never evaluated
 * is not presented with the same confidence as one that was.
 */
import { topicDecisionFile, topicGold } from './data/portals';
import { activePortal, type Portal } from './portal';
import { indexDecisions, resolveTopic } from './topic-decisions';
import type { DatasetRecord } from './types';

export interface TopicProvenance {
  byRules: number;
  byModel: number;
  byHuman: number;
  /** Agreement with gold labels, over the loaded datasets that have one. */
  evaluation?: { agree: number; labelled: number; confirmed: boolean };
  label: string;
}

export function topicProvenance(datasets: readonly DatasetRecord[], portal: Portal = activePortal()): TopicProvenance {
  const decisions = indexDecisions(topicDecisionFile(portal.id));
  const counts = { rules: 0, model: 0, human: 0 };
  for (const dataset of datasets) counts[resolveTopic(dataset, decisions).source]++;
  const gold = topicGold(portal.id);
  const labelled = gold ? datasets.filter(dataset => gold.labels[dataset.id]) : [];
  const evaluation = gold && labelled.length
    ? {
      agree: labelled.filter(dataset => gold.labels[dataset.id].includes(resolveTopic(dataset, decisions).subcategory)).length,
      labelled: labelled.length,
      confirmed: !/^draft/i.test(gold.status),
    }
    : undefined;
  const decided = counts.model + counts.human;
  const basis = decided
    ? `Keyword rules + ${decided} validated decision${decided === 1 ? '' : 's'}${counts.human ? ` (${counts.human} by a person)` : ''}`
    : 'Keyword rules only';
  const checked = evaluation
    ? `${evaluation.agree}/${evaluation.labelled} agree with ${evaluation.confirmed ? 'gold labels' : 'draft gold labels, not yet confirmed by a person'}`
    : `not evaluated for ${portal.shortLabel}`;
  return { byRules: counts.rules, byModel: counts.model, byHuman: counts.human, evaluation, label: `${basis} · ${checked}` };
}
