import { describe, expect, it } from 'vitest';
import { normalizeOdsDataset } from './normalize';
import { bboxFromFeature, collectLocalized, normalizeFrequency, stripHtml } from './ods';
import { fallbackDatasets } from './fallback';

/** A catalogue entry shaped like the real Explore API response. */
const entry = (overrides: Record<string, unknown> = {}) => ({
  dataset_id: '100000',
  has_records: true,
  features: ['geo', 'analyze'],
  fields: [
    { name: 'geo_point_2d', type: 'geo_point_2d' },
    { name: 'id_thing', type: 'text', annotations: { id: true } },
    { name: 'datum', type: 'date', annotations: { timeserie_precision: 'day' } },
  ],
  metas: {
    default: {
      title: 'Testdatensatz',
      description: '<div>Ein <a href="https://x">Link</a> und &amp; ein Absatz.</div>',
      theme: ['Raum und Umwelt'],
      theme_en: ['Territory and environment'],
      keyword: ['Baum'],
      license: 'CC BY 4.0',
      modified: '2026-01-02T03:04:05+00:00',
      records_count: 42,
      geometry_types: ['Point'],
      publisher: 'Stadtgärtnerei',
      territory: ['Basel-Stadt'],
    },
    dcat: { accrualperiodicity: 'http://publications.europa.eu/resource/authority/frequency/DAILY' },
    ...(overrides.metas as object ?? {}),
  },
  ...overrides,
});

describe('stripHtml', () => {
  it('renders Basel descriptions as text, not markup', () => {
    expect(stripHtml('<div>Ein <a href="https://x">Link</a> und &amp; mehr.</div>')).toBe('Ein Link und & mehr.');
  });

  it('turns block boundaries into line breaks rather than running words together', () => {
    expect(stripHtml('<p>Erste Zeile</p><p>Zweite Zeile</p>')).toBe('Erste Zeile\nZweite Zeile');
  });
});

describe('bboxFromFeature', () => {
  it('reduces the GeoJSON Feature Basel publishes to a numeric extent', () => {
    const feature = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[7.67, 47.59], [7.55, 47.59], [7.55, 47.52], [7.67, 47.52], [7.67, 47.59]]],
      },
    };
    expect(bboxFromFeature(feature)).toEqual([7.55, 47.52, 7.67, 47.59]);
  });

  it('returns undefined rather than a fabricated box when none is published', () => {
    expect(bboxFromFeature(null)).toBeUndefined();
    expect(bboxFromFeature({ type: 'Feature' })).toBeUndefined();
  });
});

describe('normalizeFrequency', () => {
  it('keeps the readable tail of the EU authority URI', () => {
    expect(normalizeFrequency('http://publications.europa.eu/resource/authority/frequency/UPDATE_CONT')).toBe('update cont');
    expect(normalizeFrequency(null)).toBeUndefined();
  });
});

describe('collectLocalized', () => {
  it('gathers every language variant so English questions can match German metadata', () => {
    expect(collectLocalized({ theme: ['A'], theme_en: ['B'], theme_fr: ['A'] }, 'theme')).toEqual(['A', 'B']);
  });
});

describe('normalizeOdsDataset', () => {
  it('normalizes a complete entry', () => {
    const record = normalizeOdsDataset(entry())!;
    expect(record.id).toBe('100000');
    expect(record.title).toBe('Testdatensatz');
    expect(record.description).toBe('Ein Link und & ein Absatz.');
    expect(record.publisher).toBe('Stadtgärtnerei');
    expect(record.license).toBe('CC BY 4.0');
    expect(record.recordsCount).toBe(42);
    expect(record.characteristics.geospatial).toBe(true);
    expect(record.characteristics.geometryTypes).toEqual(['Point']);
    expect(record.characteristics.timeSeries).toBe(true);
    expect(record.characteristics.updateFrequency).toBe('daily');
    expect(record.formats).toContain('geojson');
  });

  it('indexes the English theme so an English question can reach a German dataset', () => {
    expect(normalizeOdsDataset(entry())!.searchText).toContain('territory and environment');
  });

  it('survives an entry with nothing but an id', () => {
    const record = normalizeOdsDataset({ dataset_id: '1' })!;
    expect(record.title).toBe('1');
    expect(record.description).toBe('');
    expect(record.publisher).toBe('');
    expect(record.characteristics.geospatial).toBe(false);
    expect(record.characteristics.geometryTypes).toEqual([]);
    expect(record.recordsCount).toBeUndefined();
  });

  it('rejects an entry with no identity instead of inventing one', () => {
    expect(normalizeOdsDataset({ metas: { default: { title: 'Nameless' } } })).toBeNull();
    expect(normalizeOdsDataset(null)).toBeNull();
  });

  it('calls a dataset realtime from its cadence, not from words in the title', () => {
    const marketing = normalizeOdsDataset(
      entry({ metas: { default: { title: 'Live Realtime Aktuell', records_count: 1 }, dcat: { accrualperiodicity: '.../ANNUAL' } } }),
    )!;
    expect(marketing.characteristics.realtime).toBe(false);

    const hourly = normalizeOdsDataset(
      entry({ metas: { default: { title: 'Messreihe' }, dcat: { accrualperiodicity: '.../HOURLY' } } }),
    )!;
    expect(hourly.characteristics.realtime).toBe(true);
  });

  it('does not claim exports for a dataset that has no records', () => {
    const record = normalizeOdsDataset(entry({ has_records: false, features: [] }))!;
    expect(record.hasRecords).toBe(false);
    expect(record.apiUrl).toBeUndefined();
    expect(record.formats).toEqual(['other']);
  });
});

describe('the frozen fallback snapshot', () => {
  it('normalizes every captured entry', () => {
    expect(fallbackDatasets.length).toBeGreaterThan(20);
    expect(fallbackDatasets.every(dataset => dataset.id && dataset.title)).toBe(true);
  });

  it('keeps the datasets published with zero records, because they are evidence too', () => {
    expect(fallbackDatasets.some(dataset => dataset.recordsCount === 0)).toBe(true);
  });

  it('contains no HTML in any description', () => {
    expect(fallbackDatasets.some(dataset => /<[a-z]/i.test(dataset.description))).toBe(false);
  });
});
