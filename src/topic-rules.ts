/**
 * The Topic taxonomy: editorial categories and the keyword rules that point at them.
 * Categories are a human decision; rules and the typed LLM decisions (topic-decisions.ts)
 * only choose among them, they never add or rename one.
 */
import type { DatasetRecord } from './types';

export type Rule = readonly [string, RegExp];

export const TOPIC_RULES: ReadonlyArray<readonly [string, ReadonlyArray<Rule>]> = [
  ['Environment & Climate', [
    ['Urban nature', /baum|tree|grün|gruen|green|\bnatur|biodiv|wald|forest|\bparks?\b|parkanlage|vegetation|flora|fauna/],
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

export const OTHER_TOPIC = 'Other / review needed';
export const UNCLASSIFIED = 'Unclassified';

export function datasetText(dataset: DatasetRecord): string {
  return `${dataset.title} ${dataset.description} ${dataset.themes.join(' ')} ${dataset.keywords.join(' ')} ${dataset.semantic.topics.join(' ')}`.toLocaleLowerCase();
}

/** What the publisher says the dataset *is*, as opposed to prose that merely mentions things. */
export function labelText(dataset: DatasetRecord): string {
  return `${dataset.title} ${dataset.themes.join(' ')} ${dataset.keywords.join(' ')} ${dataset.semantic.topics.join(' ')}`.toLocaleLowerCase();
}
