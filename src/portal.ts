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
  /**
   * CKAN with DCAT-AP CH metadata (opendata.swiss): catalogue metadata only, no record API.
   * A canton usually publishes through several organizations (statistics office, geo office, ...).
   */
  | { kind: 'ckan'; base: string; site: string; organizations: string[] };

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
  /** For a portal of its own: the canton's publishers on opendata.swiss, where its datasets reappear. */
  nationalPublishers?: string[];
  /** A dataset on the portal that publishes per-dataset activity counters (src/usage.ts). */
  usageDataset?: string;
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
  nationalPublishers: ['kanton-basel-stadt'],
  usageDataset: '100057',
};

/** Basel-Landschaft runs its own Opendatasoft portal (reachable, 184 datasets on 2026-09-27). */
export const BASEL_LANDSCHAFT: Portal = {
  id: 'bl',
  canton: 'BL',
  label: 'Basel-Landschaft Open Government Data',
  shortLabel: 'Basel-Landschaft OGD',
  place: 'Basel-Landschaft',
  languages: ['de'],
  api: { kind: 'ods', base: 'https://data.bl.ch/api/explore/v2.1', site: 'https://data.bl.ch' },
  // swisstopo SearchServer, canton boundary box (WGS84), 2026-09-27
  bbox: [7.324906, 47.337222, 7.963223, 47.564362],
  places: [
    ['Liestal', /\bliestal\b/], ['Allschwil', /\ballschwil\b/], ['Reinach', /\breinach\b/], ['Muttenz', /\bmuttenz\b/],
    ['Pratteln', /\bpratteln\b/], ['Binningen', /\bbinningen\b/], ['Münchenstein', /\bm(ü|ue)nchenstein\b/], ['Laufen', /\blaufen\b/],
    ['Basel-Landschaft', /\b(basel[- ]landschaft|baselland|baselbiet)\b/],
  ],
  verified: false,
  snapshot: false,
  nationalPublishers: ['kanton-basel-landschaft'],
};

/** Geneva publishes through opendata.swiss (French); publishers from `portals.ts discover`, 2026-09-27. */
export const GENEVE: Portal = {
  id: 'ge',
  canton: 'GE',
  label: 'Canton de Genève on opendata.swiss',
  shortLabel: 'Genève (opendata.swiss)',
  place: 'Genève',
  languages: ['fr', 'de', 'en'],
  api: {
    kind: 'ckan',
    base: 'https://ckan.opendata.swiss',
    site: 'https://opendata.swiss/fr',
    // Not included, awaiting a decision: geneve-aeroport, hes-so-geneve, services-industriels-geneve, fti-ge, sitg (0 datasets).
    organizations: ['canton-geneve', 'administration-cantonale-geneve', 'chancellerie-etat-geneve'],
  },
  bbox: [5.94964, 46.128531, 6.312594, 46.365919],
  places: [
    ['Carouge', /carouge/], ['Vernier', /vernier/], ['Lancy', /lancy/], ['Meyrin', /meyrin/], ['Onex', /(?<!\p{L})onex(?!\p{L})/u],
    ['Thônex', /th[oô]nex/], ['Plainpalais', /plainpalais/], ['Eaux-Vives', /eaux-vives/],
    ['Genève', /gen[eè]ve|geneva|genf/],
  ],
  verified: false,
  snapshot: false,
};

/** St. Gallen runs its own Opendatasoft portal (221 datasets on 2026-09-27); ids are slugs, not numbers. */
export const ST_GALLEN: Portal = {
  id: 'sg',
  canton: 'SG',
  label: 'Kanton St. Gallen Open Government Data',
  shortLabel: 'St. Gallen OGD',
  place: 'St. Gallen',
  languages: ['de'],
  api: { kind: 'ods', base: 'https://daten.sg.ch/api/explore/v2.1', site: 'https://daten.sg.ch' },
  // swisstopo SearchServer, canton boundary box (WGS84), 2026-09-27
  bbox: [8.786604, 46.869125, 9.680754, 47.560163],
  places: [
    ['Rapperswil-Jona', /rapperswil|jona/], ['Wil', /\bwil\b/], ['Gossau', /\bgossau\b/], ['Rorschach', /rorschach/],
    ['Buchs', /\bbuchs\b/], ['Uzwil', /uzwil/], ['Toggenburg', /toggenburg/], ['Rheintal', /rheintal/],
    ['St. Gallen', /\bst\.? ?gallen|sankt gallen\b/],
  ],
  verified: false,
  snapshot: false,
  nationalPublishers: ['amt-fuer-raumentwicklung-und-geoinformation-areg-kanton-st-gallen', 'kanton-st-gallen', 'fachstelle-fur-statistik-kanton-st-gallen', 'staatskanzlei-kanton-st-gallen'],
};

export const PORTALS: readonly Portal[] = [BASEL_STADT, BASEL_LANDSCHAFT, ST_GALLEN, GENEVE];

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
