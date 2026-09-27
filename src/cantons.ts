/**
 * The 26 cantons, with their names in the national languages, used to find each canton's
 * publishers in national catalogues and, later, to lay cantons side by side.
 * `languages` are the official languages, main one first (Romansh aside: no catalogue uses it).
 */
import type { PortalLanguage } from './portal';

export interface Canton { code: string; names: string[]; languages: PortalLanguage[] }

export const CANTONS: readonly Canton[] = [
  { code: 'ZH', names: ['Zürich', 'Zurich', 'Zurigo'], languages: ['de'] },
  { code: 'BE', names: ['Bern', 'Berne', 'Berna'], languages: ['de', 'fr'] },
  { code: 'LU', names: ['Luzern', 'Lucerne', 'Lucerna'], languages: ['de'] },
  { code: 'UR', names: ['Uri'], languages: ['de'] },
  { code: 'SZ', names: ['Schwyz', 'Svitto'], languages: ['de'] },
  { code: 'OW', names: ['Obwalden', 'Obwald', 'Obvaldo'], languages: ['de'] },
  { code: 'NW', names: ['Nidwalden', 'Nidwald', 'Nidvaldo'], languages: ['de'] },
  { code: 'GL', names: ['Glarus', 'Glaris', 'Glarona'], languages: ['de'] },
  { code: 'ZG', names: ['Zug', 'Zoug', 'Zugo'], languages: ['de'] },
  { code: 'FR', names: ['Fribourg', 'Freiburg', 'Friburgo'], languages: ['fr', 'de'] },
  { code: 'SO', names: ['Solothurn', 'Soleure', 'Soletta'], languages: ['de'] },
  { code: 'BS', names: ['Basel-Stadt', 'Bâle-Ville', 'Basilea Città'], languages: ['de'] },
  { code: 'BL', names: ['Basel-Landschaft', 'Bâle-Campagne', 'Basilea Campagna'], languages: ['de'] },
  { code: 'SH', names: ['Schaffhausen', 'Schaffhouse', 'Sciaffusa'], languages: ['de'] },
  { code: 'AR', names: ['Appenzell Ausserrhoden', 'Appenzell Rhodes-Extérieures'], languages: ['de'] },
  { code: 'AI', names: ['Appenzell Innerrhoden', 'Appenzell Rhodes-Intérieures'], languages: ['de'] },
  { code: 'SG', names: ['St. Gallen', 'Saint-Gall', 'San Gallo'], languages: ['de'] },
  { code: 'GR', names: ['Graubünden', 'Grisons', 'Grigioni'], languages: ['de', 'it'] },
  { code: 'AG', names: ['Aargau', 'Argovie', 'Argovia'], languages: ['de'] },
  { code: 'TG', names: ['Thurgau', 'Thurgovie', 'Turgovia'], languages: ['de'] },
  { code: 'TI', names: ['Ticino', 'Tessin'], languages: ['it'] },
  { code: 'VD', names: ['Vaud', 'Waadt'], languages: ['fr'] },
  { code: 'VS', names: ['Valais', 'Wallis', 'Vallese'], languages: ['fr', 'de'] },
  { code: 'NE', names: ['Neuchâtel', 'Neuenburg'], languages: ['fr'] },
  { code: 'GE', names: ['Genève', 'Genf', 'Ginevra'], languages: ['fr'] },
  { code: 'JU', names: ['Jura'], languages: ['fr'] },
];

/** "St. Gallen" -> "st-gallen", "Genève" -> "geneve", "Zürich" -> "zuerich": CKAN slug style. */
export function slug(text: string): string {
  return text.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const CANTON_WORD = /\b(kanton|canton|cantone|etat|republique|stato)\b/;
const MUNICIPAL_WORD = /\b(stadt|ville|citta|gemeinde|commune|comune)\b/;

export type PublisherLevel = 'canton' | 'municipal' | 'unclear';

/**
 * Which canton a publisher belongs to, from its slug and title. Longer names are tried first,
 * so "Basel-Landschaft" is not read as "Basel". A guess for a person to confirm, never final.
 */
export function cantonOfPublisher(name: string, title = ''): { canton: Canton; level: PublisherLevel } | undefined {
  const text = ` ${slug(name).replace(/-/g, ' ')} ${slug(title).replace(/-/g, ' ')} `;
  const variants = CANTONS.flatMap(canton => canton.names.map(value => ({ canton, words: ` ${slug(value).replace(/-/g, ' ')} ` })))
    .sort((a, b) => b.words.length - a.words.length);
  const hit = variants.find(variant => text.includes(variant.words));
  if (!hit) return undefined;
  const level: PublisherLevel = CANTON_WORD.test(text) ? 'canton' : MUNICIPAL_WORD.test(text) ? 'municipal' : 'unclear';
  return { canton: hit.canton, level };
}
