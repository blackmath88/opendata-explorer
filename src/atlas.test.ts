import { describe, expect, it } from 'vitest';
import { buildAtlasIndex, catalogueSearch, recentlyModified } from './atlas';
import type { DatasetRecord } from './types';

function dataset(overrides: Partial<DatasetRecord> & Pick<DatasetRecord, 'id' | 'title'>): DatasetRecord {
  return {
    id: overrides.id,
    title: overrides.title,
    description: overrides.description ?? '',
    publisher: overrides.publisher ?? 'Basel-Stadt',
    themes: overrides.themes ?? [],
    keywords: overrides.keywords ?? [],
    license: overrides.license ?? '',
    modified: overrides.modified,
    recordsCount: overrides.recordsCount ?? 100,
    sourceUrl: overrides.sourceUrl ?? `https://data.bs.ch/${overrides.id}`,
    formats: overrides.formats ?? ['json'],
    characteristics: overrides.characteristics ?? {
      geospatial: false,
      timeSeries: false,
      realtime: false,
      geometryTypes: [],
      temporalCoverage: [],
      territory: [],
    },
    semantic: overrides.semantic ?? { summary: '', topics: [], possibleUses: [], possibleJoins: [] },
    searchText: overrides.searchText ?? `${overrides.title} ${overrides.description ?? ''}`.toLowerCase(),
    hasRecords: overrides.hasRecords ?? true,
    fieldCount: overrides.fieldCount ?? 4,
  };
}

describe('atlas projections', () => {
  it('classifies civic topic, space, time and readiness independently', () => {
    const fountains = dataset({
      id: '100008',
      title: 'Öffentliche Brunnen',
      keywords: ['Wasser', 'Brunnen'],
      modified: '2026-09-02T10:00:00Z',
      characteristics: {
        geospatial: true,
        timeSeries: false,
        realtime: false,
        geometryType: 'Point',
        geometryTypes: ['Point'],
        temporalCoverage: [],
        territory: ['Basel-Stadt'],
      },
    });
    const index = buildAtlasIndex([fountains]);
    const assignment = index.assignments[0];
    expect(assignment.topic).toBe('environment');
    expect(assignment.space).toBe('point');
    expect(assignment.time).toBe('current-state');
    expect(assignment.readiness).toBe('ready-spatial');
  });

  it('keeps unknown topic data visible instead of guessing', () => {
    const obscure = dataset({ id: 'x1', title: 'XYZ Referenztabelle 17' });
    expect(buildAtlasIndex([obscure]).assignments[0].topic).toBe('other');
  });
});

describe('catalogue search', () => {
  const data = [
    dataset({ id: '100008', title: 'Öffentliche Brunnen', publisher: 'Tiefbauamt' }),
    dataset({ id: '100051', title: 'Luftqualität Station', publisher: 'Lufthygieneamt' }),
  ];

  it('finds exact dataset ids', () => expect(catalogueSearch(data, '100008').map(item => item.id)).toEqual(['100008']));
  it('finds title terms', () => expect(catalogueSearch(data, 'Brunnen').map(item => item.id)).toEqual(['100008']));
  it('finds publisher terms', () => expect(catalogueSearch(data, 'Lufthygieneamt').map(item => item.id)).toEqual(['100051']));
});

describe('recently modified', () => {
  it('sorts by actual modified timestamp rather than input order', () => {
    const data = [
      dataset({ id: 'a', title: 'A', modified: '2026-08-01T00:00:00Z' }),
      dataset({ id: 'b', title: 'B', modified: '2026-09-01T00:00:00Z' }),
    ];
    expect(recentlyModified(data, 1)[0].id).toBe('b');
  });
});
