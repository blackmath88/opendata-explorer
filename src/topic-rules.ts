/**
 * The Topic taxonomy: editorial categories and the keyword rules that point at them.
 * Categories are a human decision; rules and the typed LLM decisions (topic-decisions.ts)
 * only choose among them, they never add or rename one.
 */
import type { DatasetRecord } from './types';

export type Rule = readonly [string, RegExp];

export const TOPIC_RULES: ReadonlyArray<readonly [string, ReadonlyArray<Rule>]> = [
  ['Environment & Climate', [
    ['Urban nature', /baum|tree|grün|gruen|green|\bnatur|biodiv|wald|forests?\b|\bparks?\b|parkanlage|vegetation|flora|fauna/],
    ['Air & emissions', /luft|air quality|emission|co2|stickstoff|feinstaub|ozon/],
    ['Climate / heat', /klima|climate|temperatur|temperature|hitze|heat|wetter|weather/],
    ['Water', /wasser|water|rhein|rhine|brunnen|fountain|gewässer|gewaesser|grundwasser/],
    ['Noise', /lärm|laerm|noise|schall/],
    ['Energy', /energie|energy|solar|strom|photovoltaik|wärme|waerme/],
    ['Environment (other)', /umwelt|environment|nachhalt|sustainab/],
  ]],
  ['Mobility & Transport', [
    ['Cycling', /velo|bike|bicycle|radweg|cycling/],
    ['Public transport', /tram|bus|haltestelle|öV|oev|public transport|bvb/],
    ['Walking', /fuss|fuß|pedestrian|walking|trottoir/],
    ['Road traffic', /verkehr|traffic|strasse|straße|street|fahrzeug|vehicle/],
    ['Parking', /parking|parkplatz|parkhaus/],
    ['Mobility (other)', /mobilit|transport/],
  ]],
  ['People & Society', [
    ['Population', /bevölkerung|bevoelkerung|population|demograph|einwohner|wohnbevölkerung/],
    ['Social services', /sozial|social|familie|family|jugend|youth|alter|senior|integration/],
    ['Housing', /wohnung|wohnen|housing|haushalt/],
  ]],
  ['Built City & Infrastructure', [
    ['Buildings', /gebäude|gebaeude|building|bauinventar|adresse|address/],
    ['Construction', /baustelle|construction|bauprojekt|bewilligung/],
    ['Utilities & networks', /infrastruktur|infrastructure|leitung|kanal|beleuchtung|lighting|netz/],
    ['Planning & parcels', /planung|planning|parzell|kataster|zoning|nutzungsplan/],
  ]],
  ['Public Space & Leisure', [
    ['Sports', /sport|schwimm|swim|running|fitness|spielplatz/],
    ['Parks & public space', /freizeit|leisure|public space|allmend|\bplatz|\bparks?\b/],
    ['Tourism', /touris|hotel|visitor/],
  ]],
  ['Health', [['Health services', /gesundheit|health|spital|hospital|arzt|doctor|pflege/], ['Public health', /corona|covid|krank|disease|epidem/]]],
  ['Education', [['Schools', /schule|school|kindergarten/], ['Higher education', /universit|hochschule|college/], ['Education (other)', /bildung|education|lern/]]],
  ['Culture', [['Museums & heritage', /museum|denkmal|heritage|archä|archae/], ['Events & venues', /kultur|culture|theater|musik|bibliothek|library|veranstaltung|event/]]],
  ['Government & Economy', [
    ['Administration', /verwaltung|government|behörde|behoerde|abstimmung|wahl|election|politik/],
    ['Economy & labour', /wirtschaft|economy|arbeit|beschäftig|beschaeftig|betrieb|handel|business/],
    ['Finance & statistics', /steuer|tax|finanz|budget|statistik|statistic/],
    ['Safety & justice', /polizei|kriminal|straftat|unfall|accident|feuerwehr|sicherheit|safety/],
  ]],
];

/**
 * French and Italian terms per subcategory, for cantons that publish in those languages. Kept
 * apart from the German/English rules so they cannot disturb them. Each term matches at the
 * start of a word (`\b` is ASCII-only and fails before "é"); a trailing `$` in a term means
 * "whole word". Measured against Basel's gold set only; unmeasured in French or Italian yet.
 */
const words = (...terms: string[]): RegExp =>
  new RegExp(`(?<!\\p{L})(?:${terms.map(term => term.endsWith('$') ? `${term.slice(0, -1)}(?!\\p{L})` : term).join('|')})`, 'u');

export const ROMANCE_TERMS: Readonly<Record<string, RegExp>> = {
  'Urban nature': words('arbre', 'espaces? verts?', 'nature$', 'biodiversit', 'forêt', 'végétation', 'alber[oi]$', 'verde pubblico', 'natura$', 'bosc[oh]', 'foresta', 'vegetazion'),
  'Air & emissions': words("qualité de l'air", 'pollu', 'émission', 'dioxyde', 'particules fines', 'ozone$', "qualità dell'aria", 'inquinament', 'emission', 'polveri sottili', 'ozono$'),
  'Climate / heat': words('climat', 'températur', 'chaleur', 'canicule', 'météo', 'clima$', 'climatic', 'calore', 'meteo'),
  'Water': words('eaux?$', 'fontaine', 'rivière', 'lacs?$', "cours d'eau", 'nappe', 'acqu[ae]$', 'fontan', 'fium', 'lag[oh]i?$'),
  'Noise': words('bruit', 'sonore', 'rumor', 'fonic'),
  'Energy': words('énergi', 'solaire', 'électricit', 'energia$', 'solare$', 'elettric'),
  'Environment (other)': words('environnement', 'durabl', 'ambiente$', 'ambiental', 'sostenibil'),
  'Cycling': words('vélo', 'cycl', 'bici', 'ciclabil'),
  'Public transport': words('transports? publics?', 'arrêt', 'trasport[oi] pubblic', 'fermat'),
  'Walking': words('piéton', 'pédestre', 'pedon', 'sentier'),
  'Road traffic': words('trafic', 'circulation routière', 'routi[eè]r', 'véhicule', 'traffico', 'circolazion', 'strad[ae]$', 'veicol'),
  'Parking': words('stationnement', 'parcheggi'),
  'Mobility (other)': words('trasport'),
  'Population': words('démograph', 'habitants', 'popolazion', 'demograf', 'abitanti'),
  'Social services': words('famille', 'jeunesse', 'personnes âgées', 'famigli', 'giovan', 'anzian'),
  'Housing': words('logement', 'allogg', 'abitazion'),
  'Buildings': words('bâtiment', 'batiment', 'edific', 'indirizz'),
  'Construction': words('chantier', 'permis de construire', 'cantier', 'licenz[ae] edilizi'),
  'Utilities & networks': words('réseau', 'canalisation', 'éclairage', 'ret[ei]$', 'canalizzazion', 'illuminazion'),
  'Planning & parcels': words('aménagement', 'cadastr', 'parcelle', "plans? d'affectation", 'catast', 'pianificazion', 'particell', 'piano regolatore'),
  'Sports': words('piscine', 'natation', 'piscin', 'nuoto'),
  'Parks & public space': words('loisirs', 'espaces? publics?', 'domaine public', 'tempo libero', 'spazi[oi] pubblic'),
  'Tourism': words('hôtel', 'turis', 'albergh'),
  'Health services': words('santé', 'hôpita', 'médecin', 'soins', 'sanitari', 'salute', 'ospedal', 'medic'),
  'Public health': words('maladie', 'épidém', 'malatti', 'epidem'),
  'Schools': words('écoles?$', 'scolaire', 'scuol', 'scolastic'),
  'Higher education': words('hautes? écoles?'),
  'Education (other)': words('formation', 'éducation', 'formazion', 'istruzion', 'educazion'),
  'Museums & heritage': words('musée', 'patrimoine', 'monument', 'muse[oi]$', 'patrimonio'),
  'Events & venues': words('théâtre', 'bibliothèque', 'manifestation', 'cultura$', 'teatr', 'bibliotec', 'manifestazion', 'event[oi]$'),
  'Administration': words('administration', 'votation', 'élection', 'politique', 'amministrazion', 'votazion', 'elezion', 'politic'),
  'Economy & labour': words('économi', 'emploi', 'entreprise', 'travail', 'economia$', 'lavoro$', 'impres[ae]$', 'occupazion'),
  'Finance & statistics': words('impôt', 'fiscal', 'finances', 'statistique', 'impost', 'statistic'),
  'Safety & justice': words('police$', 'criminalit', 'sécurité', 'pompiers', 'polizia', 'criminal', 'incident', 'sicurezza', 'pompier'),
};

export const OTHER_TOPIC = 'Other / review needed';
export const UNCLASSIFIED = 'Unclassified';

export function datasetText(dataset: DatasetRecord): string {
  return `${dataset.title} ${dataset.description} ${dataset.themes.join(' ')} ${dataset.keywords.join(' ')} ${dataset.semantic.topics.join(' ')}`.toLocaleLowerCase();
}

/** What the publisher says the dataset *is*, as opposed to prose that merely mentions things. */
export function labelText(dataset: DatasetRecord): string {
  return `${dataset.title} ${dataset.themes.join(' ')} ${dataset.keywords.join(' ')} ${dataset.semantic.topics.join(' ')}`.toLocaleLowerCase();
}
