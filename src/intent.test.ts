import { describe, expect, it } from 'vitest';
import { parseUseCaseIntent } from './intent';
import { BENCHMARK_USE_CASES } from './benchmarks/useCases';

describe('parseUseCaseIntent', () => {
  it('always retains the original statement verbatim', () => {
    const statement = '  Where is access to public FOUNTAINS, benches or green spaces weakest?  ';
    expect(parseUseCaseIntent(statement).statement).toBe(statement);
  });

  it.each(BENCHMARK_USE_CASES)('parses the $id benchmark', useCase => {
    const intent = parseUseCaseIntent(useCase.prompt);

    expect(intent.statement).toBe(useCase.prompt);
    expect(intent.desiredOutcome).toBe(useCase.expectedOutcome);
    expect(intent.spatialNeed).toBe(useCase.expectedSpatialNeed);
    // Extra hints are allowed; the listed ones are the ones we rely on.
    expect(intent.domainHints).toEqual(expect.arrayContaining(useCase.expectedHints));
    if (useCase.expectedTemporalNeed) expect(intent.temporalNeed).toBe(useCase.expectedTemporalNeed);
    for (const constraint of useCase.expectedConstraints ?? []) {
      expect(intent.constraints).toContain(constraint);
    }
  });

  it('is stable: the same statement always parses the same way', () => {
    const prompt = BENCHMARK_USE_CASES[0].prompt;
    expect(parseUseCaseIntent(prompt)).toEqual(parseUseCaseIntent(prompt));
  });

  it('reports nothing rather than guessing on an unrecognised statement', () => {
    const intent = parseUseCaseIntent('qwertyuiop asdfghjkl');
    expect(intent.domainHints).toEqual([]);
    expect(intent.desiredOutcome).toBeUndefined();
    expect(intent.spatialNeed).toBe(false);
    expect(intent.temporalNeed).toBeUndefined();
    expect(intent.constraints).toEqual([]);
  });

  it('detects temporal need and marks conflicting signals as mixed', () => {
    expect(parseUseCaseIntent('Show me current air quality now').temporalNeed).toBe('current');
    expect(parseUseCaseIntent('How has traffic developed over time since 2015?').temporalNeed).toBe('historical');
    expect(parseUseCaseIntent('Forecast future heat exposure').temporalNeed).toBe('forecast');
    expect(parseUseCaseIntent('Compare current values with the historical trend').temporalNeed).toBe('mixed');
  });

  it('scopes constraint verbs to their own clause', () => {
    const intent = parseUseCaseIntent('Plan a route that avoids heavy traffic, shows fountains and warns about construction.');
    expect(intent.constraints).toContain('avoid:traffic');
    expect(intent.constraints).toContain('warn:construction');
    // "avoids" governs traffic, not the fountains clause that follows it.
    expect(intent.constraints).not.toContain('avoid:water_access');
  });

  it('recognises a geographic scope only when one is named', () => {
    expect(parseUseCaseIntent('Tree cover in Riehen').geographicScope).toBe('Riehen');
    expect(parseUseCaseIntent('Tree cover').geographicScope).toBeUndefined();
  });
});
