import { describe, expect, it } from 'vitest';
import { fallbackDatasets } from './data/fallback';
import type { Doorway } from './doorway';
import { HERO_END, HERO_START, heroHtml, reasonDe, spliceHero, type HeroPick } from './proposal-hero';

const dataset = { ...fallbackDatasets[0], id: '100418', title: 'Erwartete Besucherzahl <St. Jakob>', recordsCount: 366 };
const byUsage: Doorway = { dataset, basis: 'usage', reason: '', downloadsPerMonth: 30.6, reuses: 0 };
const byMetadata: Doorway = { dataset: { ...dataset, recordsCount: 1 }, basis: 'metadata', reason: '' };
const pick = (doorway: Doorway): HeroPick => ({ group: 'Road traffic', groupSize: 34, glyph: '', doorway, form: 'series', cover: '<svg class="cover"></svg>', catalogueUrl: '/catalogue/?portal=bs#dataset=100418' });
const meta = { category: 'Mobility & Transport', categorySize: 58, groupCount: 5, asOf: '2026-09-27', libraryUrl: '/library/?portal=bs' };

describe('proposal hero', () => {
  it('phrases the doorway reason in German from the figures', () => {
    expect(reasonDe(byUsage, 'series')).toBe("Bereit: 366 Einträge, Zeitreihe. Am wenigsten genutzt in der Gruppe: rund 31 Downloads pro Monat, keine dokumentierte Nutzung.");
    expect(reasonDe({ ...byUsage, reuses: 1 }, 'line')).toContain('1 dokumentierte Nutzung.');
    expect(reasonDe({ ...byUsage, reuses: 3 }, 'line')).toContain('3 dokumentierte Nutzungen.');
  });

  it('says so when the pick rests on metadata, not usage', () => {
    expect(reasonDe(byMetadata, 'area')).toBe('Bereit: 1 Eintrag, Flächen. Am vollständigsten beschrieben in dieser Gruppe; die Nutzung ist nicht vergleichbar.');
  });

  it('names the category, the rule and the date, and escapes titles', () => {
    const html = heroHtml([pick(byUsage)], meta);
    expect(html).toContain('Mobilität &amp; Verkehr');
    expect(html).toContain('Stand 27.09.2026');
    expect(html).toContain('Alle 58 Datensätze');
    expect(html).toContain('Strassenverkehr');
    expect(html).toContain('Erwartete Besucherzahl &lt;St. Jakob&gt;');
    expect(html).not.toContain('<St. Jakob>');
  });

  it('inserts before the first section once, then replaces in place', () => {
    const page = '<main><div class="hero"></div>\n    <section id="heute">x</section></main>';
    const once = spliceHero(page, `${HERO_START}A${HERO_END}`);
    expect(once.indexOf(HERO_START)).toBeLessThan(once.indexOf('<section id="heute">'));
    const twice = spliceHero(once, `${HERO_START}B${HERO_END}`);
    expect(twice).toContain(`${HERO_START}B${HERO_END}`);
    expect(twice.split(HERO_START)).toHaveLength(2);
    expect(() => spliceHero('<main></main>', 'x')).toThrow();
  });
});
