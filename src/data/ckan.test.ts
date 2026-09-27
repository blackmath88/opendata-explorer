import { describe, expect, it } from 'vitest';
import { atlasPath } from '../atlas';
import { cadenceOf, shapeOf } from '../catalogue-profile';
import { BASEL_STADT, type Portal } from '../portal';
import { CkanDcatAdapter, localized, normalizeCkanPackage } from './ckan';
import pkg from './fixtures/ckan-package.json';

const swiss: Portal = {
  ...BASEL_STADT,
  id: 'test-ckan',
  label: 'Kanton Beispiel on opendata.swiss',
  shortLabel: 'Beispiel (opendata.swiss)',
  place: 'Beispiel',
  languages: ['fr', 'de'],
  api: { kind: 'ckan', base: 'https://ckan.example.test', site: 'https://opendata.example.test/de', organizations: ['kanton-beispiel'] },
  verified: false,
  snapshot: false,
};

describe('CKAN / DCAT-AP CH normalizer', () => {
  const record = normalizeCkanPackage(pkg, swiss)!;

  it('reads multilingual values in the portal\'s language order', () => {
    expect(record.title).toBe('Points de comptage vélo');
    expect(record.searchText).toContain('velozählstellen');
    expect(record.searchText).toContain('bicycle counting stations');
    expect(localized({ de: 'A', fr: '', it: 'C' }, ['it'])).toEqual(['C', 'A']);
    expect(localized('{"de": "JSON als Text"}')).toEqual(['JSON als Text']);
  });

  it('keeps the identity, link, publisher and themes', () => {
    expect(record.id).toBe('velozaehlstellen-beispiel');
    expect(record.sourceUrl).toBe('https://opendata.example.test/de/dataset/velozaehlstellen-beispiel');
    expect(record.publisher).toBe('Tiefbauamt Kanton Beispiel');
    expect(record.themes).toContain('Mobilité et transports');
    expect(record.keywords).toEqual(expect.arrayContaining(['Velo', 'vélo', 'bicycle']));
  });

  it('strips HTML from descriptions', () => {
    const german = normalizeCkanPackage({ ...pkg, description: { de: '<p>Standorte der <b>Zählstellen</b>.</p>' } }, { ...swiss, languages: ['de'] })!;
    expect(german.description).toBe('Standorte der Zählstellen .');
  });

  it('maps EU frequency URIs into the same cadence buckets as Opendatasoft', () => {
    expect(record.characteristics.updateFrequency).toBe('daily');
    expect(cadenceOf(record)).toBe('frequent');
    const cadence = (uri: string) => cadenceOf(normalizeCkanPackage({ ...pkg, accrual_periodicity: `http://publications.europa.eu/resource/authority/frequency/${uri}` }, swiss)!);
    expect(cadence('ANNUAL_2')).toBe('periodic');
    expect(cadence('IRREG')).toBe('irregular');
    expect(cadence('UPDATE_CONT')).toBe('frequent');
    expect(cadence('NEVER')).toBe('none');
    expect(cadenceOf(normalizeCkanPackage({ ...pkg, accrual_periodicity: undefined }, swiss)!)).toBe('unknown');
  });

  it('claims only what DCAT says: geo from formats, geometry type and record count unknown', () => {
    expect(record.characteristics.geospatial).toBe(true);
    expect(record.recordsCount).toBeUndefined();
    expect(record.apiUrl).toBeUndefined();
    expect(shapeOf(record)).toBe('unknown');
    expect(atlasPath(record, 'space')).toEqual({ category: 'Unknown', subcategory: 'Geometry type not declared' });
    expect(record.formats).toEqual(expect.arrayContaining(['csv', 'geojson', 'other']));
    expect(record.hasRecords).toBe(true);
  });

  it('a package with only a map service has no readable records', () => {
    const wmsOnly = normalizeCkanPackage({ ...pkg, resources: [{ format: 'WMS', url: 'https://example.test/wms' }] }, swiss)!;
    expect(wmsOnly.hasRecords).toBe(false);
    expect(atlasPath(wmsOnly, 'space').category).toBe('Raster / external asset');
  });

  it('a package without geo formats reads as a table; one without a name is dropped', () => {
    expect(shapeOf(normalizeCkanPackage({ ...pkg, resources: [{ format: 'CSV' }] }, swiss)!)).toBe('table');
    expect(normalizeCkanPackage({ title: { de: 'Namenlos' } }, swiss)).toBeNull();
  });

  it('the adapter refuses a non-CKAN portal', () => {
    expect(() => new CkanDcatAdapter(BASEL_STADT)).toThrow(/not a CKAN portal/);
  });
});
