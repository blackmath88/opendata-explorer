import type { TemporalNeed, UseCaseIntent } from './types';

const DOMAIN_HINTS: Record<string, string[]> = {
  mobility: ['run', 'running', 'route', 'cycling', 'bike', 'traffic', 'pedestrian', 'mobility', 'street'],
  environment: ['shade', 'tree', 'green', 'park', 'air', 'pollution', 'noise', 'environment', 'pollen'],
  climate: ['heat', 'temperature', 'hot', 'climate', 'weather', 'cooler'],
  infrastructure: ['construction', 'fountain', 'water', 'school', 'facility', 'infrastructure'],
  population: ['population', 'resident', 'demographic', 'people', 'neighbourhood', 'quartier'],
};

const SPATIAL_TERMS = ['where', 'route', 'street', 'area', 'location', 'near', 'access', 'corridor', 'neighbourhood', 'map', 'spatial'];
const CURRENT_TERMS = ['current', 'now', 'today', 'live', 'ongoing', 'forecast'];
const HISTORICAL_TERMS = ['historical', 'history', 'trend', 'over time', 'past'];
const FORECAST_TERMS = ['forecast', 'future', 'tomorrow', 'predict'];

function includesAny(text: string, terms: string[]): boolean {
  return terms.some(term => text.includes(term));
}

function inferTemporalNeed(text: string): TemporalNeed | undefined {
  const current = includesAny(text, CURRENT_TERMS);
  const historical = includesAny(text, HISTORICAL_TERMS);
  const forecast = includesAny(text, FORECAST_TERMS);
  const count = [current, historical, forecast].filter(Boolean).length;
  if (count > 1) return 'mixed';
  if (forecast) return 'forecast';
  if (historical) return 'historical';
  if (current) return 'current';
  return undefined;
}

export function parseUseCaseIntent(statement: string): UseCaseIntent {
  const text = statement.trim().toLowerCase();
  const domainHints = Object.entries(DOMAIN_HINTS)
    .filter(([, terms]) => includesAny(text, terms))
    .map(([domain]) => domain);

  const constraints: string[] = [];
  if (includesAny(text, ['avoid', 'low traffic', 'less traffic'])) constraints.push('avoid traffic exposure');
  if (includesAny(text, ['shade', 'cooler', 'heat'])) constraints.push('prefer lower heat exposure');
  if (includesAny(text, ['clean air', 'pollution', 'air quality'])) constraints.push('prefer cleaner air');
  if (includesAny(text, ['construction', 'roadworks', 'works'])) constraints.push('avoid active construction');
  if (includesAny(text, ['water', 'fountain', 'drinking'])) constraints.push('include water access');

  let desiredOutcome: string | undefined;
  if (includesAny(text, ['route', 'running', 'cycling'])) desiredOutcome = 'compare or design routes';
  else if (includesAny(text, ['prioritise', 'prioritize', 'where should', 'intervention'])) desiredOutcome = 'prioritise interventions';
  else if (includesAny(text, ['understand', 'assess', 'analyse', 'analyze'])) desiredOutcome = 'assess conditions';

  return {
    statement: statement.trim(),
    domainHints,
    spatialNeed: includesAny(text, SPATIAL_TERMS),
    temporalNeed: inferTemporalNeed(text),
    geographicScope: text.includes('basel') ? 'Basel' : undefined,
    desiredOutcome,
    constraints,
  };
}
