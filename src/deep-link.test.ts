import { describe, expect, it } from 'vitest';
import { formatDeepLink, missingLinkNotice, parseDeepLink } from './deep-link';
import { filterCatalogue } from './catalogue-ui';
import { fallbackDatasets } from './data/fallback';

describe('deep links', () => {
  it('round-trips dataset and lens, and ignores junk', () => {
    expect(parseDeepLink(formatDeepLink({ dataset: '100052', lens: 'space' }))).toEqual({ dataset: '100052', lens: 'space' });
    expect(formatDeepLink({ dataset: '100052', lens: 'topic' })).toBe('#dataset=100052');
    expect(parseDeepLink('#dataset=<script>&lens=nope')).toEqual({ dataset: undefined, lens: undefined });
    expect(parseDeepLink('')).toEqual({ dataset: undefined, lens: undefined });
  });

  it('never turns a snapshot gap into a claim of global absence', () => {
    expect(missingLinkNotice('999999', 'fallback', 44)).toMatch(/not in the offline snapshot \(44 datasets\).*live .* may contain it/);
    expect(missingLinkNotice('999999', 'live', 361)).toMatch(/as loaded \(361 datasets\)/);
  });
});

describe('catalogue completeness (KNOWLEDGE_DISCOVERY acceptance test)', () => {
  it('finds every loaded dataset by its exact title and by its id in the List search', () => {
    for (const dataset of fallbackDatasets) {
      const filters = { topic: 'all', geospatial: false, temporal: false };
      expect(filterCatalogue(fallbackDatasets, { ...filters, query: dataset.title }).map(d => d.id), dataset.title).toContain(dataset.id);
      expect(filterCatalogue(fallbackDatasets, { ...filters, query: dataset.id }).map(d => d.id)).toContain(dataset.id);
    }
  });
});
