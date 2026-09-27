/**
 * Per-portal data that ships with the app. Decisions and gold labels are keyed by dataset id,
 * and ids are only unique within one portal, so each portal has its own files.
 */
import type { TopicDecisionFile } from '../../topic-decisions';
import bsDecisions from './bs/topic-decisions.json';

const DECISIONS: Record<string, TopicDecisionFile> = {
  bs: bsDecisions as TopicDecisionFile,
};

const EMPTY: TopicDecisionFile = { version: 1, decisions: [] };

/** A portal without stored decisions simply falls back to the rules. */
export function topicDecisionFile(portalId: string): TopicDecisionFile {
  return DECISIONS[portalId] ?? EMPTY;
}
