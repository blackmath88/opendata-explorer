import { describe, expect, it } from 'vitest';
import { CANTONS, cantonOfPublisher, slug } from './cantons';

describe('cantons', () => {
  it('lists all 26 once', () => {
    expect(CANTONS).toHaveLength(26);
    expect(new Set(CANTONS.map(canton => canton.code)).size).toBe(26);
  });

  it('slugs names the way CKAN does', () => {
    expect(slug('Zürich')).toBe('zuerich');
    expect(slug('St. Gallen')).toBe('st-gallen');
    expect(slug('Genève')).toBe('geneve');
    expect(slug('Bâle-Campagne')).toBe('bale-campagne');
  });

  it('assigns publishers to cantons, most specific name first', () => {
    expect(cantonOfPublisher('kanton-basel-landschaft')).toMatchObject({ canton: { code: 'BL' }, level: 'canton' });
    expect(cantonOfPublisher('kanton-basel-stadt')).toMatchObject({ canton: { code: 'BS' }, level: 'canton' });
    expect(cantonOfPublisher('statistisches-amt-kanton-zuerich')).toMatchObject({ canton: { code: 'ZH' }, level: 'canton' });
    expect(cantonOfPublisher('stadt-zuerich')).toMatchObject({ canton: { code: 'ZH' }, level: 'municipal' });
    expect(cantonOfPublisher('etat-de-geneve')).toMatchObject({ canton: { code: 'GE' }, level: 'canton' });
    expect(cantonOfPublisher('x', 'Appenzell Innerrhoden')?.canton.code).toBe('AI');
    expect(cantonOfPublisher('bundesamt-fuer-statistik')).toBeUndefined();
    // Forms seen on opendata.swiss (2026-09-27)
    expect(cantonOfPublisher('x', 'Amt für Geoinformation des Kantons Bern')).toMatchObject({ canton: { code: 'BE' }, level: 'canton' });
    expect(cantonOfPublisher('staatskanzlei-zug', 'Staatskanzlei Zug')).toMatchObject({ canton: { code: 'ZG' }, level: 'canton' });
    expect(cantonOfPublisher('buwd-rawi', 'Luzern: Dienststelle Raum und Wirtschaft')).toMatchObject({ canton: { code: 'LU' }, level: 'canton' });
    expect(cantonOfPublisher('administration-cantonale-geneve', 'Kantonale Verwaltung Genf')).toMatchObject({ canton: { code: 'GE' }, level: 'canton' });
    expect(cantonOfPublisher('ville-geneve', 'Stadt Genf')).toMatchObject({ canton: { code: 'GE' }, level: 'municipal' });
    // Institutions named after a place are not the canton: a person decides.
    expect(cantonOfPublisher('eth-zuerich', 'ETH Zürich')).toMatchObject({ canton: { code: 'ZH' }, level: 'unclear' });
  });
});
