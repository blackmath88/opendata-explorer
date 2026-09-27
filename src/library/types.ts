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
}

export interface LibraryGroup { name: string; glyph: string; books: LibraryBook[] }

export interface LibraryData {
  portal: { id: string; label: string; site: string };
  category: string;
  asOf: string;
  source: string;
  usage: string;
  groups: LibraryGroup[];
}
