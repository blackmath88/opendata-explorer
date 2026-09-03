/**
 * One shared, deterministic domain vocabulary.
 *
 * `intentTerms` are matched against what the user wrote.
 * `catalogueTerms` are matched against dataset metadata, which for Basel is
 * predominantly German — so both languages are listed everywhere.
 *
 * This is a lookup table, not a model. Anything it cannot recognise must
 * surface as "not detected" rather than as a guess.
 */
export interface DomainConcept {
  id: string;
  label: string;
  intentTerms: string[];
  catalogueTerms: string[];
}

export const DOMAIN_CONCEPTS: DomainConcept[] = [
  {
    id: 'running',
    label: 'Running',
    intentTerms: ['running', 'run', 'runner', 'jog', 'jogging', 'laufen', 'joggen', 'lauf'],
    catalogueTerms: ['sport', 'bewegung', 'laufen', 'joggen'],
  },
  {
    id: 'cycling',
    label: 'Cycling',
    intentTerms: ['cycling', 'cyclist', 'bike', 'biking', 'bicycle', 'velo', 'radfahren', 'fahrrad'],
    catalogueTerms: ['velo', 'fahrrad', 'radweg', 'veloroute'],
  },
  {
    id: 'walking',
    label: 'Walking & pedestrians',
    intentTerms: ['walk', 'walking', 'pedestrian', 'footpath', 'fussgänger', 'fussgaenger', 'zu fuss', 'gehen'],
    catalogueTerms: ['fussgänger', 'fussgaenger', 'fussweg', 'trottoir', 'zu fuss'],
  },
  {
    id: 'network',
    label: 'Street & path network',
    intentTerms: ['route', 'routes', 'street', 'streets', 'road', 'roads', 'corridor', 'corridors', 'path', 'network', 'strasse', 'strassen', 'weg', 'wege', 'strecke'],
    catalogueTerms: ['strasse', 'strassen', 'strassenname', 'weg', 'wege', 'veloroute', 'durchgangsstrasse', 'kantonsstrasse', 'strassenabschnitt'],
  },
  {
    id: 'shade',
    label: 'Shade & tree canopy',
    intentTerms: ['shade', 'shaded', 'shading', 'shady', 'canopy', 'tree', 'trees', 'schatten', 'baum', 'bäume', 'baeume', 'baumkrone', 'begrünung'],
    catalogueTerms: ['baum', 'bäume', 'baumkataster', 'baumkrone', 'baumbestand', 'stadtbaum', 'kronendeckung'],
  },
  {
    id: 'heat',
    label: 'Heat & temperature',
    intentTerms: ['heat', 'hot', 'heatwave', 'temperature', 'warming', 'cooling', 'hitze', 'temperatur', 'klima', 'wärme', 'waerme'],
    catalogueTerms: ['temperatur', 'klima', 'hitze', 'wärme', 'waerme', 'luftklima'],
  },
  {
    id: 'air_quality',
    label: 'Air quality',
    intentTerms: ['air', 'pollution', 'polluted', 'pollutant', 'emissions', 'smog', 'no2', 'pm10', 'pm2.5', 'ozone', 'luft', 'luftqualität', 'feinstaub', 'schadstoff', 'abgase'],
    catalogueTerms: ['luftqualität', 'luftqualitaet', 'luft', 'immission', 'feinstaub', 'stickstoffdioxid', 'ozon', 'schadstoff'],
  },
  {
    id: 'noise',
    label: 'Noise',
    intentTerms: ['noise', 'noisy', 'quiet', 'loud', 'lärm', 'laerm', 'ruhig', 'leise'],
    catalogueTerms: ['lärm', 'laerm', 'schall', 'akustik'],
  },
  {
    id: 'traffic',
    label: 'Motorised traffic',
    intentTerms: ['traffic', 'car', 'cars', 'vehicle', 'vehicles', 'congestion', 'motorised', 'motorized', 'verkehr', 'autos', 'stau'],
    catalogueTerms: ['verkehr', 'verkehrszähl', 'motorisiert', 'individualverkehr', 'fahrzeug', 'tagesverkehr'],
  },
  {
    id: 'speed',
    label: 'Speed',
    intentTerms: ['speed', 'speeding', 'fast', 'tempo', 'geschwindigkeit', 'schnell'],
    catalogueTerms: ['geschwindigkeit', 'tempo', 'smiley', 'v85'],
  },
  {
    id: 'safety',
    label: 'Safety & accidents',
    intentTerms: ['dangerous', 'danger', 'safe', 'safety', 'unsafe', 'accident', 'accidents', 'crash', 'collision', 'risk', 'unfall', 'gefährlich', 'gefaehrlich', 'sicherheit'],
    catalogueTerms: ['unfall', 'unfälle', 'sicherheit', 'verkehrsunfall', 'kollision'],
  },
  {
    id: 'construction',
    label: 'Construction activity',
    intentTerms: ['construction', 'roadworks', 'works', 'building site', 'baustelle', 'baustellen', 'bauarbeiten', 'umbau'],
    catalogueTerms: ['baustelle', 'bauprojekt', 'allmendbewilligung', 'bauarbeiten', 'sanierung'],
  },
  {
    id: 'water_access',
    label: 'Drinking water & fountains',
    intentTerms: ['fountain', 'fountains', 'drinking water', 'water', 'brunnen', 'trinkwasser', 'wasser'],
    catalogueTerms: ['brunnen', 'trinkwasser', 'wasserstelle'],
  },
  {
    id: 'green_space',
    label: 'Green & public space',
    intentTerms: ['park', 'parks', 'green space', 'green spaces', 'greenery', 'garden', 'playground', 'grünfläche', 'gruenflaeche', 'park', 'spielplatz', 'öffentlicher raum', 'public space'],
    catalogueTerms: ['grünfläche', 'gruenanlage', 'park', 'spielplatz', 'freiraum', 'öffentlicher raum', 'allmend'],
  },
  {
    id: 'seating',
    label: 'Benches & seating',
    intentTerms: ['bench', 'benches', 'seating', 'sitzbank', 'sitzgelegenheit', 'bank'],
    catalogueTerms: ['sitzbank', 'sitzgelegenheit', 'bänke'],
  },
  {
    id: 'schools',
    label: 'Schools',
    intentTerms: ['school', 'schools', 'pupil', 'pupils', 'classroom', 'kindergarten', 'schule', 'schulen', 'schüler', 'schueler'],
    catalogueTerms: ['schule', 'schulstandort', 'schulhaus', 'kindergarten', 'schulweg'],
  },
  {
    id: 'elevation',
    label: 'Elevation & terrain',
    intentTerms: ['elevation', 'slope', 'hill', 'hilly', 'climb', 'gradient', 'steep', 'terrain', 'höhe', 'hoehe', 'steigung', 'gelände'],
    catalogueTerms: ['höhenmodell', 'hoehenmodell', 'terrain', 'dhm', 'gelände', 'topograf'],
  },
  {
    id: 'pollen',
    label: 'Pollen & allergens',
    intentTerms: ['pollen', 'allergy', 'allergies', 'allergen', 'hay fever', 'pollenflug', 'allergie', 'heuschnupfen'],
    catalogueTerms: ['pollen', 'allergen', 'pollenflug'],
  },
  {
    id: 'population',
    label: 'Population',
    intentTerms: ['population', 'residents', 'inhabitants', 'people', 'density', 'bevölkerung', 'bevoelkerung', 'einwohner', 'wohnbevölkerung'],
    catalogueTerms: ['bevölkerung', 'bevoelkerung', 'wohnbevölkerung', 'einwohner', 'haushalt'],
  },
  {
    id: 'geography',
    label: 'Statistical & administrative areas',
    intentTerms: ['neighbourhood', 'neighborhood', 'district', 'quarter', 'area', 'areas', 'block', 'blocks', 'quartier', 'bezirk', 'gemeinde'],
    catalogueTerms: ['statistische raumeinheiten', 'raumeinheit', 'wohnviertel', 'gemeindegrenze', 'perimeter'],
  },
  {
    id: 'buildings',
    label: 'Buildings & land use',
    intentTerms: ['building', 'buildings', 'land use', 'surface', 'gebäude', 'gebaeude', 'bodennutzung', 'versiegelung'],
    catalogueTerms: ['gebäude', 'gebaeude', 'bodenbedeckung', 'bodennutzung', 'liegenschaft', 'areal'],
  },
  {
    id: 'mobility',
    label: 'Mobility & travel',
    intentTerms: ['mobility', 'transport', 'transportation', 'commute', 'commuting', 'travel', 'getting around', 'mobilität', 'mobilitaet', 'verkehrsmittel', 'fortbewegung'],
    catalogueTerms: ['mobilität', 'mobilitaet', 'verkehr', 'fahrten', 'wegzeit', 'pendler'],
  },
  {
    id: 'transit',
    label: 'Public transport',
    intentTerms: ['tram', 'bus', 'public transport', 'transit', 'öv', 'haltestelle'],
    catalogueTerms: ['haltestelle', 'tram', 'bus', 'öffentlicher verkehr', 'bvb', 'linien'],
  },
];

const CONCEPTS_BY_ID = new Map(DOMAIN_CONCEPTS.map(concept => [concept.id, concept]));

export const conceptById = (id: string): DomainConcept | undefined => CONCEPTS_BY_ID.get(id);

/** Lowercase and flatten punctuation, keeping umlauts so German terms still match. */
export function normalizeText(input: string): string {
  return ` ${input.toLowerCase().replace(/[^\p{L}\p{N}.]+/gu, ' ').replace(/\s+/g, ' ').trim()} `;
}

/**
 * Whole-word match against a normalized haystack, tolerating a short
 * inflectional suffix on longer terms ("route" -> "routes", "shade" -> "shaded").
 */
export function matchesIntentTerm(haystack: string, term: string): boolean {
  if (haystack.includes(` ${term} `)) return true;
  if (term.length < 5) return false;
  const index = haystack.indexOf(` ${term}`);
  if (index < 0) return false;
  const rest = haystack.slice(index + term.length + 1);
  return /^[a-zäöüßé]{0,3}[\s.]/.test(rest);
}

/**
 * Catalogue matching uses plain substring containment on purpose: German
 * compounds ("Baumkataster", "Luftqualitaetsmessung") only match that way.
 */
export const matchesCatalogueTerm = (haystack: string, term: string): boolean => haystack.includes(term);

/** Concept ids whose trigger terms appear in the given text. */
export function detectConcepts(text: string): string[] {
  const haystack = normalizeText(text);
  return DOMAIN_CONCEPTS.filter(concept =>
    concept.intentTerms.some(term => matchesIntentTerm(haystack, term)),
  ).map(concept => concept.id);
}
