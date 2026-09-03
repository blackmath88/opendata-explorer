import type { DatasetMatch, DatasetRecord, EvidencePlan, UseCaseIntent } from './types';
import { classifyEvidence } from './evidence';
import { conceptById, matchesCatalogueTerm, normalizeText } from './vocabulary';

/**
 * Deterministic relevance ranking.
 *
 * Scores come from the same domain vocabulary the intent parser and the
 * evidence planner use, so a user can trace a match back to the words they
 * wrote. There is no embedding model here and the explanation is generated
 * from the actual matched terms, never from a template that sounds confident.
 */

/** Words that carry no discriminating signal in this catalogue. */
const STOP = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'where', 'what', 'want', 'build',
  'could', 'would', 'help', 'find', 'show', 'shows', 'datasets', 'dataset', 'data', 'basel',
  'about', 'which', 'their', 'there', 'have', 'need', 'like', 'make', 'using', 'understand',
  'ich', 'und', 'mit', 'die', 'der', 'das', 'ein', 'eine', 'für', 'von', 'den', 'dem',
]);

const CONCEPT_TITLE_HIT = 16;
const CONCEPT_TEXT_HIT = 5;
const LITERAL_TITLE_HIT = 10;
const LITERAL_TEXT_HIT = 2;
const SPATIAL_BONUS = 12;
const TEMPORAL_BONUS = 8;
const REALTIME_BONUS = 8;
const NO_RECORDS_PENALTY = 25;

export interface RankOptions {
  /** When supplied, matches carry their evidence class and role assignments. */
  plan?: EvidencePlan;
}

export function rankDatasets(
  intent: UseCaseIntent,
  datasets: DatasetRecord[],
  options: RankOptions = {},
): DatasetMatch[] {
  const literals = literalTerms(intent.statement);

  return datasets
    .map(dataset => {
      const title = dataset.title.toLowerCase();
      const matched = new Set<string>();
      let score = 0;

      for (const hint of intent.domainHints) {
        const concept = conceptById(hint);
        if (!concept) continue;
        const inTitle = concept.catalogueTerms.some(term => matchesCatalogueTerm(title, term));
        const inText = concept.catalogueTerms.some(term => matchesCatalogueTerm(dataset.searchText, term));
        if (inTitle) {
          score += CONCEPT_TITLE_HIT;
          matched.add(concept.label.toLowerCase());
        } else if (inText) {
          score += CONCEPT_TEXT_HIT;
          matched.add(concept.label.toLowerCase());
        }
      }

      for (const term of literals) {
        if (matchesCatalogueTerm(title, term)) {
          score += LITERAL_TITLE_HIT;
          matched.add(term);
        } else if (matchesCatalogueTerm(dataset.searchText, term)) {
          score += LITERAL_TEXT_HIT;
          matched.add(term);
        }
      }

      // Structural fit with what the question actually needs.
      if (intent.spatialNeed && dataset.characteristics.geospatial) score += SPATIAL_BONUS;
      if (intent.temporalNeed && dataset.characteristics.timeSeries) score += TEMPORAL_BONUS;
      if (intent.temporalNeed === 'current' && dataset.characteristics.realtime) score += REALTIME_BONUS;
      // A dataset with no records cannot answer anything, however well it reads.
      if (!dataset.hasRecords || dataset.recordsCount === 0) score -= NO_RECORDS_PENALTY;

      score = Math.max(0, Math.min(100, score));
      const matchedTerms = [...matched];

      return {
        dataset,
        relevance: { score, matchedTerms, explanation: explain(dataset, matchedTerms, intent) },
        ...(options.plan
          ? classifyEvidence(dataset.id, options.plan)
          : { evidenceClass: 'contextual' as const, roleIds: [] }),
      };
    })
    .sort((a, b) => b.relevance.score - a.relevance.score || a.dataset.title.localeCompare(b.dataset.title));
}

/** Residual keywords the vocabulary does not cover, so novel terms still match. */
function literalTerms(statement: string): string[] {
  return [
    ...new Set(
      normalizeText(statement)
        .split(' ')
        .filter(term => term.length > 3 && !STOP.has(term)),
    ),
  ];
}

function explain(dataset: DatasetRecord, matchedTerms: string[], intent: UseCaseIntent): string {
  if (!dataset.hasRecords || dataset.recordsCount === 0) {
    return 'The catalogue publishes this dataset without records, so it cannot currently support analysis.';
  }
  if (!matchedTerms.length) {
    return 'No deterministic term match; shown only as catalogue context.';
  }
  const parts = [`Matches ${matchedTerms.slice(0, 4).join(', ')}`];
  if (intent.spatialNeed && dataset.characteristics.geospatial) {
    const geometry = dataset.characteristics.geometryTypes.join('/') || 'geometry';
    parts.push(`and declares ${geometry} for the spatial part of the question`);
  }
  if (intent.temporalNeed && dataset.characteristics.timeSeries) parts.push('and carries a time dimension');
  return `${parts.join(' ')}.`;
}
