import { describe, expect, it } from 'vitest';
import { normalizeCkanPackage } from './data/ckan';
import { BASEL_STADT, type Portal } from './portal';
import { ROMANCE_TERMS, TOPIC_RULES } from './topic-rules';
import { assessTopic } from './topic-scoring';

const romand: Portal = { ...BASEL_STADT, id: 'fr-test', languages: ['fr', 'de'], api: { kind: 'ckan', base: 'https://x.test', site: 'https://x.test', organizations: [] }, verified: false, snapshot: false };
const ticino: Portal = { ...romand, id: 'it-test', languages: ['it'] };

/** Minimal opendata.swiss-shaped package; group names as opendata.swiss carries them in all languages. */
const pkg = (title: Record<string, string>, keywords: Record<string, string[]> = {}, group?: Record<string, string>) => ({
  name: 'x', title, keywords, description: {}, groups: group ? [{ name: 'g', display_name: group }] : [], resources: [],
});

const topicOf = (portal: Portal, ...args: Parameters<typeof pkg>) => assessTopic(normalizeCkanPackage(pkg(...args), portal)!);

describe('French and Italian topic terms', () => {
  it('every term table names a real subcategory', () => {
    const subcategories = new Set(TOPIC_RULES.flatMap(([, subs]) => subs.map(([name]) => name)));
    for (const name of Object.keys(ROMANCE_TERMS)) expect(subcategories.has(name)).toBe(true);
  });

  it.each([
    [romand, { fr: 'Arbres isolés' }, { fr: ['arbre', 'patrimoine arboré'] }, 'Urban nature'],
    [romand, { fr: 'Emplacements des écoles' }, { fr: ['école', 'scolaire'] }, 'Schools'],
    [romand, { fr: 'Comptages vélo' }, { fr: ['vélo', 'cyclistes'] }, 'Cycling'],
    [romand, { fr: 'Cadastre du bruit routier' }, { fr: ['bruit', 'sonore'] }, 'Noise'],
    [ticino, { it: 'Fermate dei trasporti pubblici' }, { it: ['fermate', 'trasporto pubblico'] }, 'Public transport'],
    [ticino, { it: 'Qualità dell\'aria' }, { it: ['inquinamento', 'polveri sottili'] }, 'Air & emissions'],
    [ticino, { it: 'Parcheggi pubblici' }, { it: ['parcheggio'] }, 'Parking'],
  ])('%#: %j reads as %s', (portal, title, keywords, expected) => {
    expect(topicOf(portal, title, keywords).pick.subcategory).toBe(expected);
  });

  it('matches at word starts only, accented words included', () => {
    expect(ROMANCE_TERMS['Schools'].test('écoles primaires')).toBe(true);
    expect(ROMANCE_TERMS['Water'].test('niveau des lacs')).toBe(true);
    expect(ROMANCE_TERMS['Water'].test('bureau')).toBe(false);
    expect(ROMANCE_TERMS['Water'].test('plateau')).toBe(false);
    expect(ROMANCE_TERMS['Utilities & networks'].test('rete idrica')).toBe(true);
    expect(ROMANCE_TERMS['Utilities & networks'].test('interessi')).toBe(false);
  });

  it('with no French or Italian hit, the German/English theme names still give a weak signal', () => {
    const assessment = topicOf(romand, { fr: 'Jeu de données sans mots clés' }, {}, { fr: 'Mobilité et transports', de: 'Mobilität und Verkehr', en: 'Mobility and Transport' });
    expect(assessment.status).toBe('weak');
    expect(assessment.pick.category).toBe('Mobility & Transport');
  });
});
