/**
 * Per-portal data that ships with the app. Decisions and gold labels are keyed by dataset id,
 * and ids are only unique within one portal, so each portal has its own files.
 */
import type { TopicDecisionFile } from '../../topic-decisions';
import bsDecisions from './bs/topic-decisions.json';
import bsGold from './bs/topic-gold.json';

const DECISIONS: Record<string, TopicDecisionFile> = {
  bs: bsDecisions as TopicDecisionFile,
};

const EMPTY: TopicDecisionFile = { version: 1, decisions: [] };

/** A portal without stored decisions simply falls back to the rules. */
export function topicDecisionFile(portalId: string): TopicDecisionFile {
  return DECISIONS[portalId] ?? EMPTY;
}

export interface TopicGold {
  /** dataset id -> acceptable subcategories */
  labels: Record<string, string[]>;
  /** Free text; "draft…" until a person has confirmed the labels. */
  status: string;
}

const GOLD: Record<string, TopicGold> = {
  bs: bsGold as TopicGold,
};

/** Gold labels for evaluating topic assignment, if anyone has labelled this portal. */
export function topicGold(portalId: string): TopicGold | undefined {
  return GOLD[portalId];
}
