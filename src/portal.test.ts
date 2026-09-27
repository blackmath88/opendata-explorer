import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildEvidencePlan, gapFor } from './evidence';
import { fallbackDatasets } from './data/fallback';
import { parseUseCaseIntent } from './intent';
import { normalizeOdsDataset } from './data/normalize';
import { BASEL_STADT, PORTALS, activePortal, portalFromSearch, setActivePortal, type Portal } from './portal';

/**
 * Files allowed to name Basel in code. Everything else must read the portal, so that a second
 * canton is a config entry. Referring to the `BASEL_STADT` entry by name is fine. Each exception is content that really is about Basel-Stadt.
 */
const BASEL_CONTENT = new Set([
  'portal.ts', // the Basel-Stadt portal entry itself
  'cantons.ts', // the names of all 26 cantons, Basel's among them
  'data/fallback.ts', // the offline snapshot of Basel-Stadt's catalogue
  'evidence-sources/registry.ts', // national sources curated for the Basel use cases (station ids)
  'benchmarks/useCases.ts', // benchmark questions asked about Basel
  'mcp/demo.ts', // demo questions asked about Basel
  'execution/fixtures.ts', // recorded Basel features
]);

const sourceFiles = (dir: string): string[] => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? sourceFiles(path) : /\.ts$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
});

const withoutComments = (code: string): string => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const dummy: Portal = {
  ...BASEL_STADT,
  id: 'test',
  canton: 'XX',
  label: 'Testkanton Open Data',
  shortLabel: 'Testkanton OGD',
  place: 'Testhausen',
  api: { kind: 'ods', base: 'https://data.example.test/api/explore/v2.1', site: 'https://data.example.test' },
  places: [['Testhausen', /\btesthausen\b/]],
  verified: false,
  snapshot: false,
};

afterEach(() => setActivePortal(BASEL_STADT));

describe('portal', () => {
  it('no code outside the Basel content files names Basel or data.bs.ch', () => {
    const root = join(__dirname);
    const leaks = sourceFiles(root)
      .map(path => relative(root, path).replace(/\\/g, '/'))
      .filter(path => !BASEL_CONTENT.has(path))
      .flatMap(path => withoutComments(readFileSync(join(root, path), 'utf8')).split('\n')
        .map((line, index) => ({ path, line: index + 1, text: line.trim() }))
        .filter(({ text }) => /basel(?!ine)|data\.bs\.ch/i.test(text.replace(/\bBASEL_STADT\b/g, ''))))
      .map(({ path, line, text }) => `${path}:${line}  ${text}`);
    expect(leaks).toEqual([]);
  });

  it('defaults to Basel-Stadt and ignores unknown ids', () => {
    expect(portalFromSearch('')).toBe(BASEL_STADT);
    expect(portalFromSearch('?portal=bs')).toBe(BASEL_STADT);
    expect(portalFromSearch('?portal=nowhere')).toBe(BASEL_STADT);
  });

  it('links datasets to the portal they came from', () => {
    const record = normalizeOdsDataset({ dataset_id: '42', metas: { default: { title: 'X' } }, has_records: true }, dummy)!;
    expect(record.sourceUrl).toBe('https://data.example.test/explore/dataset/42/information/');
    expect(record.apiUrl).toBe('https://data.example.test/api/explore/v2.1/catalog/datasets/42/records');
  });

  it('scopes questions with the portal\'s own place names', () => {
    expect(parseUseCaseIntent('Shade in Riehen').geographicScope).toBe('Riehen');
    setActivePortal(dummy);
    expect(activePortal().id).toBe('test');
    expect(parseUseCaseIntent('Shade in Riehen').geographicScope).toBeUndefined();
    expect(parseUseCaseIntent('Shade in Testhausen').geographicScope).toBe('Testhausen');
  });

  it('a gap checked in Basel is a fact there and an open question elsewhere', () => {
    const template = { knownGap: 'The {catalogue} does not provide pollen measurements.', gapCheckedIn: ['bs'] };
    expect(gapFor(template, BASEL_STADT)).toEqual({ text: 'The Basel catalogue does not provide pollen measurements.', verified: true });
    const elsewhere = gapFor(template, dummy)!;
    expect(elsewhere.verified).toBe(false);
    expect(elsewhere.text).toMatch(/^Not yet checked for the Testhausen catalogue\./);
    expect(gapFor({ knownGap: 'Collision records miss near misses.' }, dummy)).toEqual({ text: 'Collision records miss near misses.', verified: true });
  });

  it('an unchecked gap never reports "not in catalogue" when candidates scored', () => {
    const question = 'Build a comfortable running route with shade, clean air, fountains and low traffic, and avoid pollen.';
    const inBasel = buildEvidencePlan(parseUseCaseIntent(question), fallbackDatasets, { selectedIds: [] });
    setActivePortal(dummy);
    const elsewhere = buildEvidencePlan(parseUseCaseIntent(question), fallbackDatasets, { selectedIds: [] });
    const baselGaps = inBasel.roles.filter(role => role.gap?.suggestion?.startsWith('The Basel catalogue'));
    expect(baselGaps.length).toBeGreaterThan(0);
    const unchecked = elsewhere.roles.filter(item => item.gap?.suggestion?.startsWith('Not yet checked'));
    expect(unchecked.map(role => role.id)).toEqual(baselGaps.map(role => role.id));
    for (const role of unchecked) {
      expect(role.gap!.kind === 'not_in_catalogue' ? role.candidates.length : 0).toBe(0);
    }
  });
});

describe('portal entries', () => {
  it('have unique ids, a bbox inside Switzerland and at least one place name', () => {
    expect(new Set(PORTALS.map(portal => portal.id)).size).toBe(PORTALS.length);
    for (const portal of PORTALS) {
      const [minLon, minLat, maxLon, maxLat] = portal.bbox;
      expect([portal.id, minLon >= 5.9 && maxLon <= 10.5 && minLat >= 45.8 && maxLat <= 47.9 && minLon < maxLon && minLat < maxLat]).toEqual([portal.id, true]);
      expect(portal.places.length).toBeGreaterThan(0);
      if (portal.api.kind === 'ckan') expect(portal.api.organizations.length).toBeGreaterThan(0);
    }
  });

  it('only Basel-Stadt is verified and ships a snapshot so far', () => {
    expect(PORTALS.filter(portal => portal.verified).map(portal => portal.id)).toEqual(['bs']);
    expect(PORTALS.filter(portal => portal.snapshot).map(portal => portal.id)).toEqual(['bs']);
  });
});
