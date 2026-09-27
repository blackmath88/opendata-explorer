import type { DatasetRecord } from '../types';
import type { UsageRecord } from '../usage';
import type { Geometry } from '../portrait';

/** Static data behind the library page (scripts/library-data.ts). */
export interface LibraryBook {
  id: string;
  title: string;
  description: string;
  publisher: string;
  form: string;
  records: number | null;
  band: number;
  bandLabel: string;
  spineWidth: number;
  reuses: number;
  cadence: string | null;
  modified: string | null;
  overdueNote: string | null;
  overdue: number;
  doorway: boolean;
  doorwayReason: string | null;
  sourceUrl: string;
  spine: string;
  cover: string;
  /** Cloth colour (category); the 3D back cover uses it. */
  cloth?: string;
  /** Question shelves: why the book is on this shelf. */
  why?: string;
  /** Question shelves: an empty slot for a gap, or a fold standing for books only the list shows. */
  placeholder?: 'gap' | 'fold';
}

export interface LibraryGroup {
  name: string;
  glyph: string;
  books: LibraryBook[];
  /** Question shelves: every dataset of the group, including those folded away (the list shows all). */
  all?: Array<{ id: string; title: string; form: string }>;
}

export interface LibraryData {
  portal: { id: string; label: string; site: string };
  category: string;
  asOf: string;
  source: string;
  usage: string;
  groups: LibraryGroup[];
}

/** Everything a question shelf needs, loaded once (scripts/library-catalogue.ts). */
export interface CatalogueData {
  portal: { id: string; label: string; site: string };
  asOf: string;
  source: string;
  usageNote: string;
  datasets: DatasetRecord[];
  /** Topic path per dataset: [category, subcategory]. */
  paths: Record<string, [string, string]>;
  usage: Record<string, UsageRecord> | null;
  /** The portal outline behind map covers (scripts/portal-outline.ts). */
  outline: Geometry[] | null;
}

export const categorySlug = (category: string): string => category.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
