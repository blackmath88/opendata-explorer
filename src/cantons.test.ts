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
  });
});
