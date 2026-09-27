/**
 * Which open-data portal DataFit is reading. Everything that used to say "Basel" reads it
 * from here, so another canton is a new entry, not a code change.
 *
 * One portal per page load: the app, the MCP tools and the scripts all read `activePortal()`.
 * Only portals with `verified: true` have had their API checked against this code.
 */
export type PortalLanguage = 'de' | 'fr' | 'it' | 'en';

export type PortalApi =
  /** Opendatasoft Explore API v2.1: records, schemas and exports per dataset. */
  | { kind: 'ods'; base: string; site: string }
  /** CKAN with DCAT-AP CH metadata (opendata.swiss): catalogue metadata only, no record API. */
  | { kind: 'ckan'; base: string; site: string; organization: string };

export interface Portal {
  /** Short, stable, used in URLs and file paths: `?portal=bs`, `src/data/portals/bs/`. */
  id: string;
  /** Canton abbreviation. */
  canton: string;
  /** "Basel-Stadt Open Government Data" */
  label: string;
  /** "Basel-Stadt OGD", for status lines. */
  shortLabel: string;
  /** How people name the place: "Basel". Used in sentences and as a query stopword. */
  place: string;
  languages: PortalLanguage[];
  api: PortalApi;
  /** WGS84 [minLon, minLat, maxLon, maxLat], used to cut national sources (MeteoSwiss, swisstopo) to the canton. */
  bbox: [number, number, number, number];
  /** Place names a question can scope to, most specific first. */
  places: ReadonlyArray<readonly [string, RegExp]>;
  verified: boolean;
  /** Whether an offline snapshot ships with the app. */
  snapshot: boolean;
}

export const BASEL_STADT: Portal = {
  id: 'bs',
  canton: 'BS',
  label: 'Basel-Stadt Open Government Data',
  shortLabel: 'Basel-Stadt OGD',
  place: 'Basel',
  languages: ['de', 'en', 'fr'],
  api: { kind: 'ods', base: 'https://data.bs.ch/api/explore/v2.1', site: 'https://data.bs.ch' },
  bbox: [7.5, 47.5, 7.7, 47.65],
  places: [
    ['Riehen', /\briehen\b/],
    ['Bettingen', /\bbettingen\b/],
    ['Kleinbasel', /\bkleinbasel\b/],
    ['Grossbasel', /\bgrossbasel\b/],
    ['Basel-Stadt', /\b(basel[- ]stadt|canton of basel|kanton basel)\b/],
    ['Basel', /\bbasel\b/],
  ],
  verified: true,
  snapshot: true,
};

export const PORTALS: readonly Portal[] = [BASEL_STADT];

export function portalById(id: string | null | undefined): Portal | undefined {
  return PORTALS.find(portal => portal.id === id);
}

let active: Portal = BASEL_STADT;

/** The portal this page load reads. Defaults to Basel-Stadt. */
export function activePortal(): Portal {
  return active;
}

/** Set once at startup (from `?portal=`); tests may set it and reset it. */
export function setActivePortal(portal: Portal): void {
  active = portal;
}

/** `?portal=bs` in the page URL; unknown ids fall back to the default rather than failing. */
export function portalFromSearch(search: string): Portal {
  return portalById(new URLSearchParams(search).get('portal')) ?? BASEL_STADT;
}

export const datasetPageUrl = (portal: Portal, id: string): string =>
  portal.api.kind === 'ods'
    ? `${portal.api.site}/explore/dataset/${encodeURIComponent(id)}/information/`
    : `${portal.api.site}/dataset/${encodeURIComponent(id)}`;
