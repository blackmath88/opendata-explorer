/**
 * Deterministic topic scoring. Every rule hit is kept with the field it matched in, so a
 * title hit ("Verkehrszähldaten") outweighs a keyword-list hit ("Busse") and a theme label
 * ("Raum und Umwelt") only counts a little. The status says whether the rules are enough
 * or whether the dataset needs a typed decision (topic-decisions.ts).
 */
import { OTHER_TOPIC, TOPIC_RULES, UNCLASSIFIED } from './topic-rules';
import type { DatasetRecord } from './types';

export type TopicField = 'title' | 'keywords' | 'topics' | 'themes' | 'description';
export const FIELD_WEIGHT: Record<TopicField, number> = { title: 3, keywords: 2, topics: 1, themes: 1, description: 0.5 };
// topics and themes carry the portal's broad classification (and repeat each other), so they weigh little.

export interface TopicHit { category: string; subcategory: string; field: TopicField; term: string; weight: number }
export interface TopicScore { category: string; subcategory: string; score: number; catchAll: boolean; hits: TopicHit[] }
/** clear: rules suffice. Everything else is a candidate for a typed decision. */
export type TopicStatus = 'clear' | 'conflict' | 'weak' | 'catch_all_only' | 'none';

export interface TopicAssessment {
  pick: { category: string; subcategory: string };
  status: TopicStatus;
  /** Specific subcategories first, then catch-alls; each by score, then rule order. */
  ranked: TopicScore[];
}

export function topicFields(dataset: DatasetRecord): Record<TopicField, string> {
  return {
    title: dataset.title,
    keywords: dataset.keywords.join(' · '),
    topics: dataset.semantic.topics.join(' · '),
    themes: dataset.themes.join(' · '),
    description: dataset.description,
  };
}

const CLEAR_SCORE = 2;

export function assessTopic(dataset: DatasetRecord): TopicAssessment {
  const fields = topicFields(dataset);
  const lower = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.toLocaleLowerCase()])) as Record<TopicField, string>;
  const scores: TopicScore[] = [];
  let order = 0;
  const rank = new Map<string, number>();
  for (const [category, subcategories] of TOPIC_RULES) {
    for (const [subcategory, pattern] of subcategories) {
      rank.set(subcategory, order++);
      const hits: TopicHit[] = [];
      for (const field of Object.keys(FIELD_WEIGHT) as TopicField[]) {
        const match = lower[field].match(pattern);
        if (match) hits.push({ category, subcategory, field, term: match[0], weight: FIELD_WEIGHT[field] });
      }
      if (hits.length) scores.push({ category, subcategory, catchAll: subcategory.endsWith('(other)'), score: hits.reduce((sum, hit) => sum + hit.weight, 0), hits });
    }
  }
  const byScore = (a: TopicScore, b: TopicScore) => b.score - a.score || rank.get(a.subcategory)! - rank.get(b.subcategory)!;
  const specific = scores.filter(score => !score.catchAll).sort(byScore);
  const catchAll = scores.filter(score => score.catchAll).sort(byScore);
  const ranked = [...specific, ...catchAll];
  if (!scores.length) return { pick: { category: OTHER_TOPIC, subcategory: UNCLASSIFIED }, status: 'none', ranked };
  if (!specific.length) return { pick: { category: catchAll[0].category, subcategory: catchAll[0].subcategory }, status: 'catch_all_only', ranked };
  const [top, second] = specific;
  const status: TopicStatus = top.score < CLEAR_SCORE ? 'weak' : second && top.score < second.score * 2 ? 'conflict' : 'clear';
  return { pick: { category: top.category, subcategory: top.subcategory }, status, ranked };
}
