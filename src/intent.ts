import type { TemporalNeed, UseCaseIntent } from './types';
import { conceptById, detectConcepts, matchesIntentTerm, normalizeText } from './vocabulary';

/**
 * Deterministic first-pass intent parser.
 *
 * No LLM. Everything here is a lookup or a regular expression, so the output is
 * reproducible and testable. When a signal is not recognised the field stays
 * undefined — the parser must never invent an intent the user did not express.
 *
 * A later model-based parser should produce the same shape and be labelled as
 * `model_inference`, so the two can be compared rather than confused.
 */

/** Phrases that mean "this analysis happens somewhere on a map". */
const SPATIAL_TERMS = [
  'where', 'route', 'routes', 'street', 'streets', 'road', 'corridor', 'corridors',
  'near', 'nearby', 'around', 'along', 'proximity', 'access', 'accessible', 'distance',
  'area', 'areas', 'zone', 'zones', 'district', 'neighbourhood', 'neighborhood',
  'map', 'location', 'locations', 'site', 'sites', 'spatial', 'geographic',
  'wo', 'strasse', 'strassen', 'weg', 'wege', 'nähe', 'naehe', 'umkreis', 'quartier', 'karte',
];

/**
 * Concepts that are inherently spatial once they appear in a question. In this
 * catalogue every mobility, amenity and facility dataset is either a network or
 * a point layer, so naming one of them implies a spatial analysis.
 */
const SPATIAL_CONCEPTS = new Set([
  'network', 'geography', 'water_access', 'green_space', 'seating', 'schools',
  'buildings', 'transit', 'elevation', 'mobility',
]);

/**
 * Concepts that describe *what is being done* rather than a property of a
 * place. A constraint over these ("prefer running") is noise, so they are
 * excluded from constraint extraction.
 */
const NON_CONSTRAINT_CONCEPTS = new Set(['running', 'cycling', 'walking', 'network', 'geography', 'mobility']);

const TEMPORAL_PATTERNS: ReadonlyArray<readonly [Exclude<TemporalNeed, 'mixed'>, RegExp]> = [
  ['current', /\b(current|currently|now|today|live|real.?time|at the moment|aktuell|heute|jetzt|momentan)\b/],
  ['historical', /\b(historic|historical|history|trend|trends|over time|since|past|previous|development|evolution|verlauf|entwicklung|seit|bisher|vergangen)\b/],
  ['forecast', /\b(forecast|forecasts|predict|prediction|projected|projection|future|expected|scenario|prognose|vorhersage|zukunft|szenario)\b/],
];

/** Place names the Basel catalogue actually distinguishes. */
const SCOPE_PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
  ['Riehen', /\briehen\b/],
  ['Bettingen', /\bbettingen\b/],
  ['Kleinbasel', /\bkleinbasel\b/],
  ['Grossbasel', /\bgrossbasel\b/],
  ['Basel-Stadt', /\b(basel[- ]stadt|canton of basel|kanton basel)\b/],
  ['Basel', /\bbasel\b/],
];

/**
 * Outcome archetypes. These drive the evidence-role template, so the match has
 * to be conservative: an unrecognised statement gets no outcome rather than a
 * wrong one.
 */
const OUTCOME_PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
  ['route_planner', /\b(route|routes|routing|itinerary|planner|planning a route|navigate|strecke|wegplan)\b/],
  ['intervention_prioritisation', /\b(intervention|interventions|invest|prioriti[sz]|biggest impact|most impact|where should|where would|measures|maßnahme|massnahme|priorit)\b/],
  ['access_gap_analysis', /\b(access|accessibility|underserved|weakest|gap|gaps|coverage|provision|versorgung|zugang|erreichbarkeit)\b/],
  ['impact_assessment', /\b(impact|effect|effects|influence|consequence|disruption|auswirkung|einfluss|folgen)\b/],
  ['risk_screening', /\b(dangerous|danger|risk|risky|unsafe|hazard|uncomfortable|safety|gefährlich|gefaehrlich|risiko|sicherheit)\b/],
  ['condition_assessment', /\b(condition|conditions|assess|assessment|monitor|monitoring|quality|state of|environment around|zustand|beurteil|bewerten)\b/],
];

/** Verb families that turn a mentioned concept into an explicit constraint. */
const CONSTRAINT_VERBS: ReadonlyArray<readonly [string, RegExp]> = [
  ['avoid', /\b(avoid|avoids|avoiding|away from|without|minimi[sz]e|reduce|less|low|vermeide|meiden|ohne|weniger|geringe)\b/],
  ['prefer', /\b(prefer|prefers|preferring|favour|favor|more|pleasant|comfortable|shaded|clean|bevorzug|angenehm|lieber)\b/],
  ['warn', /\b(warn|warns|warning|alert|flag|notify|hinweis|warnung)\b/],
  ['require', /\b(must|need|needs|require|requires|should have|has to|muss|benötig|erforderlich)\b/],
];

/** Distance in characters within which a verb is taken to govern a concept. */
const CONSTRAINT_WINDOW = 70;

export function parseUseCaseIntent(statement: string): UseCaseIntent {
  const haystack = normalizeText(statement);
  const lower = statement.toLowerCase();

  const domainHints = detectConcepts(statement);

  const spatialNeed =
    SPATIAL_TERMS.some(term => matchesIntentTerm(haystack, term)) ||
    domainHints.some(hint => SPATIAL_CONCEPTS.has(hint));

  const temporalMatches = TEMPORAL_PATTERNS.filter(([, pattern]) => pattern.test(lower)).map(([need]) => need);
  const temporalNeed: TemporalNeed | undefined =
    temporalMatches.length === 0 ? undefined : temporalMatches.length > 1 ? 'mixed' : temporalMatches[0];

  const geographicScope = SCOPE_PATTERNS.find(([, pattern]) => pattern.test(lower))?.[0];
  const desiredOutcome = pickOutcome(lower);

  return {
    // Never rewritten, never normalized away.
    statement,
    domainHints,
    spatialNeed,
    temporalNeed,
    geographicScope,
    desiredOutcome,
    constraints: extractConstraints(statement, domainHints),
  };
}

/**
 * Several outcome families can match one sentence ("biggest impact" reads as
 * both prioritisation and impact assessment). Score by how many distinct
 * trigger phrases each family matched and break ties by declaration order,
 * which puts the more specific families first.
 */
function pickOutcome(lower: string): string | undefined {
  let best: { outcome: string; hits: number } | undefined;
  for (const [outcome, pattern] of OUTCOME_PATTERNS) {
    const hits = new Set(lower.match(new RegExp(pattern.source, 'g')) ?? []).size;
    if (hits > 0 && (!best || hits > best.hits)) best = { outcome, hits };
  }
  return best?.outcome;
}

/**
 * Pair constraint verbs with the concept they govern, producing entries like
 * `avoid:traffic` or `prefer:shade`.
 *
 * Scoped to the clause containing the concept, because these use cases are
 * written as comma-separated clause chains ("avoids heavy traffic, shows
 * fountains") where the previous clause's verb must not leak forward.
 *
 * This is intentionally shallow, and stays silent on sentence structures it
 * does not recognise.
 */
function extractConstraints(statement: string, domainHints: string[]): string[] {
  const lower = statement.toLowerCase();
  const constraints = new Set<string>();

  for (const clause of splitClauses(lower)) {
    for (const hint of domainHints) {
      if (NON_CONSTRAINT_CONCEPTS.has(hint)) continue;
      const concept = conceptById(hint);
      if (!concept) continue;
      for (const term of concept.intentTerms) {
        const at = clause.indexOf(term);
        if (at < 0) continue;
        const before = clause.slice(Math.max(0, at - CONSTRAINT_WINDOW), at);
        const verb = lastVerbIn(before);
        if (verb) constraints.add(`${verb}:${hint}`);
      }
    }
  }
  return [...constraints].sort();
}

/** Split on clause boundaries so a verb only governs its own clause. */
function splitClauses(lower: string): string[] {
  return lower
    .split(/[,;.]|\band\b|\bbut\b|\bwhile\b|\bund\b|\baber\b/)
    .map(clause => clause.trim())
    .filter(Boolean);
}

/** The constraint verb closest to the concept wins, so later clauses override. */
function lastVerbIn(text: string): string | undefined {
  let best: { verb: string; at: number } | undefined;
  for (const [verb, pattern] of CONSTRAINT_VERBS) {
    const global = new RegExp(pattern.source, 'g');
    let match: RegExpExecArray | null;
    while ((match = global.exec(text)) !== null) {
      if (!best || match.index > best.at) best = { verb, at: match.index };
    }
  }
  return best?.verb;
}
