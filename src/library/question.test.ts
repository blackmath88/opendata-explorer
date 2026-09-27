import { describe, expect, it } from 'vitest';
import { fallbackDatasets } from '../data/fallback';
import { portalById, setActivePortal } from '../portal';
import type { DatasetRecord } from '../types';
import { MAX_ON_SHELF, questionShelf, startsWord } from './question';
import { categoriesNeeded, questionLibrary } from './question-books';
import type { CatalogueData } from './types';

setActivePortal(portalById('bs')!);
const base = fallbackDatasets[0];
const make = (id: string, title: string, keywords: string[] = []): DatasetRecord =>
  ({ ...base, id, title, keywords, description: `${title}.`, searchText: `${title} ${keywords.join(' ')}`.toLowerCase(), hasRecords: true, recordsCount: 100 });

const air = Array.from({ length: MAX_ON_SHELF + 4 }, (_, i) => make(`air${String(i).padStart(2, '0')}`, `Luftqualität Station ${String.fromCharCode(65 + i)}`));
const datasets = [
  ...air,
  make('tree', 'Baumkataster: Baumbestand'),
  make('sport', 'Sport- und Bewegungsanlagen'),
  make('transport', 'Transportwege der Güter'),
  make('flight', 'Tägliche Flugbewegungen'),
  make('pool', 'Gartenbäder', ['Sport']),
  make('kids', 'Kinder- und Jugendangebote'),
  make('index', 'Sauberkeitsindex pro Monat'),
];

const catalogue: CatalogueData = {
  portal: { id: 'bs', label: 'Basel-Stadt', site: 'https://data.bs.ch' },
  asOf: '2026-09-27', source: 'test', usageNote: 'none', datasets,
  paths: Object.fromEntries(datasets.map(d => [d.id, [d.id.startsWith('air') || d.id === 'tree' ? 'Environment & Climate' : 'Public Space & Leisure', 'Other']])),
  usage: null,
  outline: null,
};

describe('question shelf', () => {
  it('matches catalogue terms only at the start of a word', () => {
    expect(startsWord('Sport- und Bewegungsanlagen', 'sport')).toBe(true);
    expect(startsWord('Transportwege', 'sport')).toBe(false);
    expect(startsWord('Tägliche Flugbewegungen', 'bewegung')).toBe(false);
    expect(startsWord('Sauberkeitsindex', 'sind')).toBe(false);
  });

  it('places every dataset once and conserves the count through folds', () => {
    const shelf = questionShelf('Eine Laufroute mit Schatten und guter Luft', datasets);
    const ids = shelf.groups.flatMap(group => group.datasetIds);
    expect(new Set(ids).size).toBe(ids.length);
    expect(shelf.total).toBe(ids.length);
    for (const group of shelf.groups) {
      const shown = group.slots.filter(slot => slot.kind === 'dataset').length;
      const folded = group.slots.reduce((n, slot) => n + (slot.kind === 'fold' ? slot.count : 0), 0);
      if (group.kind !== 'plan') expect(shown + folded).toBe(group.datasetIds.length);
      if (group.kind !== 'plan') expect(group.slots.length).toBeLessThanOrEqual(MAX_ON_SHELF);
    }
    // The concept groups match at word starts. (The evidence plan keeps its own substring scoring.)
    const grouped = shelf.groups.filter(group => group.kind !== 'plan').flatMap(group => group.datasetIds);
    expect(grouped).not.toContain('transport');
    expect(grouped).not.toContain('flight');
    expect(shelf.recognised.map(concept => concept.id)).toEqual(['running', 'shade', 'air_quality']);
  });

  it('says why a keyword match is there, and that the title does not say so', () => {
    const shelf = questionShelf('Wo kann ich joggen?', datasets);
    const pool = shelf.groups.flatMap(group => group.slots).find(slot => slot.kind === 'dataset' && slot.datasetId === 'pool');
    expect(pool && pool.kind === 'dataset' && pool.why).toMatch(/keyword “Sport”.*title does not say so/);
  });

  it('keeps unfilled roles on the shelf as gaps', () => {
    const shelf = questionShelf('Wo gibt es Sitzbänke im Park?', datasets);
    const gaps = shelf.groups.flatMap(group => group.slots).filter(slot => slot.kind === 'gap');
    expect(gaps.map(gap => gap.kind === 'gap' && gap.label)).toContain('Benches & seating');
  });

  it('builds no plan without a recognised concept, and lists unknown words instead of guessing', () => {
    const shelf = questionShelf('Wo sind die Pinguine?', datasets);
    expect(shelf.groups).toEqual([]);
    expect(shelf.unmatched).toEqual(['pinguine']);
    expect(shelf.words).toEqual([]);
  });

  it('collects title matches for words the vocabulary does not know', () => {
    const shelf = questionShelf('Angebote für Kinder', datasets);
    expect(shelf.words).toContain('kinder');
    expect(shelf.groups.find(group => group.kind === 'word')?.datasetIds).toEqual(['kids']);
  });
});

describe('question books', () => {
  const shelf = questionShelf('Eine Laufroute mit Schatten und guter Luft, Sitzbänke', datasets);
  const library = questionLibrary({ shelf, catalogue, samples: {}, now: new Date('2026-09-27') });

  it('turns slots into books one to one, placeholders without links', () => {
    expect(library.groups.map(group => group.books.length)).toEqual(shelf.groups.map(group => group.slots.length));
    const placeholders = library.groups.flatMap(group => group.books).filter(book => book.placeholder);
    expect(placeholders.map(book => book.placeholder).sort()).toEqual(['fold', 'gap']);
    for (const book of placeholders) expect(book.sourceUrl).toBe('');
  });

  it('lists every dataset of a group, folded ones too', () => {
    const airGroup = library.groups.find(group => group.name === 'Air quality')!;
    const inPlan = shelf.groups[0].datasetIds.filter(id => id.startsWith('air')).length;
    expect(airGroup.all).toHaveLength(air.length - inPlan);
  });

  it('loads samples only for the categories on the shelf', () => {
    expect(categoriesNeeded(shelf, catalogue)).toEqual(['Environment & Climate', 'Public Space & Leisure']);
  });
});
