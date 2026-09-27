/**
 * Turns a question shelf (question.ts) into the books the library page draws: the same generated
 * covers and spines as the category shelves, plus two placeholders that carry no invented art.
 *   gap:  an empty, dashed slot for a role no dataset fills; its text says whether that was checked.
 *   fold: a plain paper slot for "N more", the list below the shelf names them all.
 * Pure: the page passes in the catalogue, the samples it loaded and the date.
 */
import { dataForm, FORM_LABEL } from '../atlas-spec';
import { BAND_LABEL, CATEGORY_CLOTH, COVER_H, COVER_W, SPINE_WIDTH, coverSvg, overdue, recordBand, spineSvg, type CoverSample } from '../cover';
import { pickDoorway } from '../doorway';
import type { DatasetRecord } from '../types';
import { icon, type IconName } from '../ui/icons';
import type { UsageRecord } from '../usage';
import type { QuestionGroup, QuestionShelf } from './question';
import type { CatalogueData, LibraryBook, LibraryData } from './types';

const PAPER = '#f4f0e6';
const INK = '#52606d';
const esc = (text: string): string => text.replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]!));

const GROUP_ICON: Record<QuestionGroup['kind'], IconName> = { plan: 'evidence-direct', concept: 'evidence-supporting', word: 'search' };

function placeholderSpine(width: number, dashed: boolean, text: string): string {
  return `<svg class="spine" xmlns="http://www.w3.org/2000/svg" viewBox="0 -10 ${width} ${COVER_H + 10}" width="${width}" height="${COVER_H + 10}" role="img" aria-label="${esc(text)}">
    <rect x=".6" y=".6" width="${width - 1.2}" height="${COVER_H - 1.2}" rx="2" fill="${PAPER}" stroke="${INK}" stroke-width="1" ${dashed ? 'stroke-dasharray="4 3"' : ''}/>
    <text transform="translate(${width / 2 + 2.2} 12) rotate(90)" font-size="6.4" font-weight="600" fill="${INK}" font-family="Inter,system-ui,sans-serif">${esc(text.length > 34 ? `${text.slice(0, 33)}…` : text)}</text>
  </svg>`;
}

function placeholderCover(heading: string, lines: string[], dashed: boolean): string {
  const words = lines.join(' ').split(/\s+/);
  const wrapped: string[] = [];
  let line = '';
  for (const word of words) {
    if ((`${line} ${word}`).trim().length > 24 && line) { wrapped.push(line); line = word; } else line = `${line} ${word}`.trim();
  }
  if (line) wrapped.push(line);
  return `<svg class="cover" xmlns="http://www.w3.org/2000/svg" viewBox="0 -10 ${COVER_W} ${COVER_H + 10}" width="${COVER_W}" height="${COVER_H + 10}" role="img" aria-label="${esc(`${heading}. ${lines.join(' ')}`)}">
    <rect x=".6" y=".6" width="${COVER_W - 1.2}" height="${COVER_H - 1.2}" rx="3" fill="${PAPER}" stroke="${INK}" stroke-width="1" ${dashed ? 'stroke-dasharray="5 4"' : ''}/>
    <text x="10" y="24" font-size="9" font-weight="700" fill="${INK}" font-family="Inter,system-ui,sans-serif">${esc(heading)}</text>
    <text x="10" y="42" font-size="7.2" fill="${INK}" font-family="Inter,system-ui,sans-serif">${wrapped.slice(0, 12).map((l, i) => `<tspan x="10" dy="${i ? 10 : 0}">${esc(l)}</tspan>`).join('')}</text>
  </svg>`;
}

function blankBook(id: string, title: string, description: string, spine: string, cover: string, placeholder: 'gap' | 'fold', why: string): LibraryBook {
  return {
    id, title, description, publisher: '', form: placeholder === 'gap' ? 'no dataset' : 'more in the list', records: null, band: 0, bandLabel: '',
    spineWidth: SPINE_WIDTH[2], reuses: 0, cadence: null, modified: null, overdueNote: null, overdue: 0, doorway: false, doorwayReason: null,
    sourceUrl: '', spine, cover, why, placeholder,
  };
}

export interface QuestionBooksInput {
  shelf: QuestionShelf;
  catalogue: CatalogueData;
  samples: Record<string, CoverSample>;
  now: Date;
}

/** Categories whose samples the page must load for this shelf. */
export function categoriesNeeded(shelf: QuestionShelf, catalogue: CatalogueData): string[] {
  const ids = shelf.groups.flatMap(group => group.slots.flatMap(slot => (slot.kind === 'dataset' ? [slot.datasetId] : [])));
  return [...new Set(ids.map(id => catalogue.paths[id]?.[0]).filter((c): c is string => !!c))].sort();
}

export function questionLibrary({ shelf, catalogue, samples, now }: QuestionBooksInput): LibraryData {
  const byId = new Map(catalogue.datasets.map(dataset => [dataset.id, dataset]));
  const usage = catalogue.usage ? new Map<string, UsageRecord>(Object.entries(catalogue.usage)) : null;

  const book = (dataset: DatasetRecord, why: string, doorwayReason: string | null): LibraryBook => {
    const [category, subcategory] = catalogue.paths[dataset.id] ?? ['Other / review needed', 'Other'];
    const late = overdue(dataset, now);
    const reuses = usage?.get(dataset.id)?.reuses ?? 0;
    const input = { dataset, category, subcategory, sample: samples[dataset.id], frame: catalogue.outline ?? undefined, signals: { reuses, overdue: late.level, overdueNote: late.note, doorway: !!doorwayReason } };
    const band = recordBand(dataset.recordsCount);
    return {
      id: dataset.id, title: dataset.title,
      description: dataset.description.length > 420 ? `${dataset.description.slice(0, 419)}…` : dataset.description,
      publisher: dataset.publisher, form: FORM_LABEL[dataForm(dataset)], records: dataset.recordsCount ?? null,
      band, bandLabel: BAND_LABEL[band], spineWidth: SPINE_WIDTH[band], reuses,
      cadence: dataset.characteristics.updateFrequency ?? null, modified: dataset.modified ?? null,
      overdueNote: late.note ?? null, overdue: late.level, doorway: !!doorwayReason, doorwayReason,
      sourceUrl: dataset.sourceUrl, spine: spineSvg(input), cover: coverSvg(input), why, cloth: CATEGORY_CLOTH[category],
    };
  };

  const groups = shelf.groups.map(group => {
    // Concept and word groups mark their "ready, rarely used" book, as the category shelves do.
    const members = group.datasetIds.map(id => byId.get(id)!).filter(Boolean);
    const door = group.kind === 'plan' ? null : pickDoorway(members, usage, now);
    const books: LibraryBook[] = group.slots.map((slot, i) => {
      if (slot.kind === 'dataset') {
        const dataset = byId.get(slot.datasetId)!;
        return book(dataset, slot.why, door?.dataset.id === dataset.id ? door.reason : null);
      }
      if (slot.kind === 'gap') {
        const heading = slot.verified ? 'Not in the catalogue' : 'No dataset found';
        return blankBook(`${group.id}#gap${i}`, `${heading}: ${slot.label}`, slot.text,
          placeholderSpine(SPINE_WIDTH[2], true, slot.label), placeholderCover(slot.label, [heading, '', slot.text], true), 'gap',
          `An empty slot: the plan needs “${slot.label}”. ${slot.text}`);
      }
      return blankBook(`${group.id}#more`, `${slot.count} more in the list`, `${group.name} has ${group.datasetIds.length} datasets; the shelf shows ${group.datasetIds.length - slot.count}. The list below names every one.`,
        placeholderSpine(SPINE_WIDTH[2], false, `+${slot.count} more`), placeholderCover(`+${slot.count} more`, [`in “${group.name}”.`, 'The list below the shelf names every one.'], false), 'fold',
        'Not every match fits on a board; this slot stands for the rest.');
    });
    const all = members.map(dataset => ({ id: dataset.id, title: dataset.title, form: FORM_LABEL[dataForm(dataset)] }));
    return { name: group.name, glyph: icon(GROUP_ICON[group.kind], { size: 16 }), books, all };
  });

  return {
    portal: catalogue.portal,
    category: shelf.statement,
    asOf: catalogue.asOf,
    source: catalogue.source,
    usage: catalogue.usageNote,
    groups,
  };
}

