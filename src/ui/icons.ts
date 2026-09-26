/**
 * DataFit icon set.
 *
 * DESIGN.md: geometric, minimalist, one consistent stroke. Every glyph is drawn
 * on a 24-unit grid with a 1.5 stroke, round caps and joins, and inherits
 * `currentColor`, so state colour always comes from CSS rather than the icon.
 * Evidence and validation glyphs differ by *shape* as well as colour, so they
 * stay distinguishable in greyscale and for colour-blind readers.
 */

const dot = (cx: number, cy: number, r = 1.5): string => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="currentColor" stroke="none"/>`;

export const ICONS = {
  // Stages
  discover: `<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>`,
  build: `<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/><path d="M10.5 7h3.5a3 3 0 0 1 3 3v3.5"/>`,
  materialize: `<path d="M12 3.5l8.5 4.5-8.5 4.5-8.5-4.5z"/><path d="M3.5 12l8.5 4.5 8.5-4.5"/><path d="M3.5 16l8.5 4.5 8.5-4.5"/>`,
  help: `<circle cx="12" cy="12" r="8.5"/><path d="M9.75 9.5a2.25 2.25 0 1 1 3.2 2.05c-.6.3-.95.8-.95 1.45v.5"/>${dot(12, 16.4, 0.9)}`,

  // Atlas lenses and views
  topic: `<path d="M3.5 12V4.5a1 1 0 0 1 1-1H12l8.5 8.5-8.5 8.5z"/><circle cx="8" cy="8" r="1.5"/>`,
  space: `<path d="M12 20.5s-6-5.4-6-10a6 6 0 0 1 12 0c0 4.6-6 10-6 10z"/><circle cx="12" cy="10.5" r="2"/>`,
  time: `<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>`,
  readiness: `<path d="M3.5 16.5a8.5 8.5 0 0 1 17 0"/><path d="M12 16.5l3.5-4.5"/>${dot(12, 16.5, 1.25)}`,
  landscape: `<rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><path d="M11 3.5v17M11 12h9.5M15.5 12v8.5"/>`,
  list: `<path d="M9 6.5h11M9 12h11M9 17.5h11"/>${dot(4.75, 6.5, 1)}${dot(4.75, 12, 1)}${dot(4.75, 17.5, 1)}`,

  // Evidence classes: fill level encodes strength
  'evidence-direct': `<circle cx="12" cy="12" r="8"/>${dot(12, 12, 4)}`,
  'evidence-supporting': `<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none"/>`,
  'evidence-contextual': `<circle cx="12" cy="12" r="8"/>${dot(12, 12, 1.5)}`,
  'evidence-missing': `<circle cx="12" cy="12" r="8" stroke-dasharray="2.5 2.6"/>`,

  // Provenance: who is making the claim
  'prov-source': `<path d="M3.5 9.5L12 4.5l8.5 5"/><path d="M6 10.5v7M10 10.5v7M14 10.5v7M18 10.5v7"/><path d="M3.5 19.5h17"/>`,
  'prov-schema': `<path d="M9 4.5c-2 0-2.5 1-2.5 2.5v2.5c0 1.2-.8 2.5-2 2.5 1.2 0 2 1.3 2 2.5V17c0 1.5.5 2.5 2.5 2.5M15 4.5c2 0 2.5 1 2.5 2.5v2.5c0 1.2.8 2.5 2 2.5-1.2 0-2 1.3-2 2.5V17c0 1.5-.5 2.5-2.5 2.5"/>`,
  'prov-sample': `<path d="M4 6.5h16M4 11.5h8M4 16.5h6"/><circle cx="16.5" cy="15" r="3"/><path d="M18.7 17.2l2 2"/>`,
  'prov-execution': `<circle cx="12" cy="12" r="8.5"/><path d="M10 8.5v7l5.5-3.5z"/>`,
  'prov-system': `<path d="M12 3.5l8.5 8.5-8.5 8.5L3.5 12z"/><path d="M9 12h6"/>`,
  'prov-ai': `<path d="M11 4q.8 7.2 8 8-7.2.8-8 8-.8-7.2-8-8 7.2-.8 8-8z"/><path d="M19 3.5v4M17 5.5h4"/>`,

  // Geometry families
  'geo-point': `${dot(7, 8, 1.75)}${dot(16, 6.5, 1.75)}${dot(11, 16.5, 1.75)}${dot(18, 16, 1.75)}`,
  'geo-line': `<path d="M4 17.5l5-7 5 4 6-8"/>`,
  'geo-polygon': `<path d="M5 7.5l7-3.5 7.5 5-2 9.5H6.5z"/>`,
  'geo-mixed': `<path d="M3.5 9l4.5-4.5 5 2.5-1.5 5H5z"/><path d="M13 20l7-5"/>${dot(17.5, 8.5, 1.75)}`,
  'geo-raster': `<rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><path d="M3.5 9.17h17M3.5 14.83h17M9.17 3.5v17M14.83 3.5v17"/><rect x="9.17" y="9.17" width="5.66" height="5.66" fill="currentColor" stroke="none"/>`,
  'geo-none': `<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 4.5v15"/>`,

  // Build: how two datasets can relate (CompatibilityRelation)
  'rel-direct-join': `<rect x="3" y="5" width="7" height="14" rx="1.5"/><rect x="14" y="5" width="7" height="14" rx="1.5"/><path d="M3 9.5h7M14 9.5h7M10 12h4"/>`,
  'rel-spatial-join': `<path d="M4.5 7l7.5-3.5L19.5 8l-1.5 10H6z"/>${dot(10, 11)}${dot(14.5, 14)}`,
  'rel-nearest': `<path d="M4 18l16-8"/><path d="M9.8 8.3l2.7 5.3" stroke-dasharray="1.5 2"/>${dot(9, 6.5, 1.75)}`,
  'rel-interpolate': `<path d="M3.5 16c3-8 6-8 8.5-4s5.5 4 8.5-4"/>${dot(4.5, 19.5)}${dot(12, 7.5)}${dot(19.5, 18)}`,
  'rel-aggregate': `${dot(5, 6)}${dot(5, 12)}${dot(5, 18)}<path d="M7 6.5l6.5 5M7 12h6.5M7 17.5l6.5-5"/><rect x="14.5" y="9" width="6" height="6" rx="1.5"/>`,
  'rel-resample': `<path d="M4 7h16M4 7v3M9.33 7v3M14.67 7v3M20 7v3M4 17h16M4 14v3M8 14v3M12 14v3M16 14v3M20 14v3"/>`,
  'rel-incompatible': `<rect x="3" y="6" width="7" height="12" rx="1.5"/><rect x="14" y="6" width="7" height="12" rx="1.5"/><path d="M10.75 15l2.5-6"/>`,

  // Build: validation state of a relationship
  confirmed: `<circle cx="12" cy="12" r="8.5"/><path d="M8 12.25l2.75 2.75L16 9.5"/>`,
  rejected: `<circle cx="12" cy="12" r="8.5"/><path d="M9 9l6 6M15 9l-6 6"/>`,
  weak: `<path d="M12 4l8.5 15h-17z"/><path d="M12 10v4"/>${dot(12, 16.6, 0.9)}`,
  unchecked: `<circle cx="12" cy="12" r="8.5"/>${dot(8.5, 12, 0.9)}${dot(12, 12, 0.9)}${dot(15.5, 12, 0.9)}`,
  stale: `<path d="M19 12a7 7 0 1 1-2.05-4.95"/><path d="M19.5 4v3.5H16"/>`,

  // Representations (RepresentationType)
  'rep-point-map': `<rect x="3.5" y="3.5" width="17" height="17" rx="2"/>${dot(8.5, 9)}${dot(15, 8)}${dot(11, 15.5)}`,
  'rep-choropleth': `<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 11l6-1.5 3 3.5 8-2M9.5 9.5L11 3.5M12.5 13l-1 7.5"/>`,
  'rep-relationship-map': `<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><circle cx="8" cy="15" r="1.75"/><circle cx="16" cy="9" r="1.75"/><path d="M9.4 13.95l5.2-3.9"/>`,
  'rep-route-comparison': `<circle cx="5" cy="18.5" r="1.5"/><circle cx="19" cy="5.5" r="1.5"/><path d="M6.2 17.5C9 12 8 6 17.5 5.8"/><path d="M6.5 18.8c6 .2 11-2 12.3-11.8" stroke-dasharray="2 2.2"/>`,
  'rep-ranked-bar': `<rect x="4" y="4" width="16" height="3" rx="1"/><rect x="4" y="10.5" width="11" height="3" rx="1"/><rect x="4" y="17" width="6" height="3" rx="1"/>`,
  'rep-time-series': `<path d="M4 4v16h16"/><path d="M7.5 15l3.5-4 3 2.5 4.5-6"/>`,
  'rep-comparison-cards': `<rect x="3.5" y="5" width="7.5" height="14" rx="1.5"/><rect x="13" y="5" width="7.5" height="14" rx="1.5"/><path d="M6 9h2.5M15.5 9h2.5"/>`,
  'rep-evidence-brief': `<path d="M6 3.5h8l4.5 4.5v12.5H6z"/><path d="M14 3.5V8h4.5M9 12h6M9 15.5h6"/>`,

  // Catalogue source
  live: `${dot(12, 12, 1.75)}<path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8"/>`,
  snapshot: `<rect x="3.5" y="4.5" width="17" height="4" rx="1"/><path d="M5 8.5v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-10M10 12.5h4"/>`,

  // Actions
  search: `<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>`,
  add: `<path d="M12 5v14M5 12h14"/>`,
  close: `<path d="M6 6l12 12M18 6L6 18"/>`,
  check: `<path d="M5 12.5l4.5 4.5L19 7.5"/>`,
  up: `<path d="M12 19V5M6 11l6-6 6 6"/>`,
  overview: `<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>`,
  inspect: `<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>`,
  panel: `<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M14.5 4.5v15"/>`,
  filter: `<path d="M4 5h16l-6 7.5V19l-4-2v-4.5z"/>`,
  workspace: `<path d="M3.5 13.5l2.5-8h12l2.5 8v5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z"/><path d="M3.5 13.5h5l1 2h5l1-2h5"/>`,
  external: `<path d="M13.5 4.5h6v6M19.5 4.5L11 13"/><path d="M17 14v5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1H10"/>`,
} as const;

export type IconName = keyof typeof ICONS;

export interface IconOptions {
  size?: number;
  /** Accessible name. Omit for decorative icons next to visible text. */
  label?: string;
  className?: string;
}

export function icon(name: IconName, { size = 18, label, className = '' }: IconOptions = {}): string {
  const a11y = label ? `role="img" aria-label="${label.replace(/"/g, '&quot;')}"` : 'aria-hidden="true" focusable="false"';
  return `<svg class="icon icon-${name} ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" ${a11y}>${ICONS[name]}</svg>`;
}

export interface IconEntry { name: IconName; label: string; usage: string; }
export interface IconGroup { title: string; note: string; icons: IconEntry[]; }

/** The catalogue: every icon with what it means and where it belongs. */
export const ICON_CATALOGUE: IconGroup[] = [
  { title: 'Stages', note: 'Side rail. Replaces the ⌕ ⌘ ▣ text glyphs.', icons: [
    { name: 'discover', label: 'Discover', usage: 'Rail: find candidate evidence' },
    { name: 'build', label: 'Build', usage: 'Rail: compose and validate' },
    { name: 'materialize', label: 'Materialize', usage: 'Rail: produce the artefact' },
    { name: 'help', label: 'Help', usage: 'Rail: provenance legend' },
  ] },
  { title: 'Atlas', note: 'Lens switcher and view toggle.', icons: [
    { name: 'topic', label: 'Topic lens', usage: 'Group by subject' },
    { name: 'space', label: 'Space lens', usage: 'Group by geometry' },
    { name: 'time', label: 'Time lens', usage: 'Group by cadence' },
    { name: 'readiness', label: 'Readiness lens', usage: 'Group by usability' },
    { name: 'landscape', label: 'Landscape', usage: 'Treemap view' },
    { name: 'list', label: 'List', usage: 'Table view' },
  ] },
  { title: 'Evidence class', note: 'Fill level encodes strength, so it reads without colour.', icons: [
    { name: 'evidence-direct', label: 'Direct', usage: 'Fills a required role' },
    { name: 'evidence-supporting', label: 'Supporting', usage: 'Strengthens a role' },
    { name: 'evidence-contextual', label: 'Contextual', usage: 'Background only' },
    { name: 'evidence-missing', label: 'Missing', usage: 'Role with no candidate' },
  ] },
  { title: 'Provenance', note: 'Who makes the claim. Pairs with the provenance tags.', icons: [
    { name: 'prov-source', label: 'Source', usage: 'Published by the data owner' },
    { name: 'prov-schema', label: 'Schema observed', usage: 'Read from the dataset schema' },
    { name: 'prov-sample', label: 'Sample observed', usage: 'Seen in stored records' },
    { name: 'prov-execution', label: 'Execution validated', usage: 'Proven by running it' },
    { name: 'prov-system', label: 'System inference', usage: 'Deterministic rule, a proposal' },
    { name: 'prov-ai', label: 'AI inference', usage: 'Reserved; unused in this build' },
  ] },
  { title: 'Geometry', note: 'Space lens and dataset badges.', icons: [
    { name: 'geo-point', label: 'Point', usage: 'Point / MultiPoint' },
    { name: 'geo-line', label: 'Line', usage: 'LineString / MultiLineString' },
    { name: 'geo-polygon', label: 'Polygon', usage: 'Polygon / MultiPolygon' },
    { name: 'geo-mixed', label: 'Mixed', usage: 'Several families declared' },
    { name: 'geo-raster', label: 'Raster', usage: 'Raster or external asset' },
    { name: 'geo-none', label: 'Tabular', usage: 'No geometry' },
  ] },
  { title: 'Relations', note: 'Build: how two datasets can be combined.', icons: [
    { name: 'rel-direct-join', label: 'Key join', usage: 'direct_join on a shared identifier' },
    { name: 'rel-spatial-join', label: 'Spatial join', usage: 'spatial_join, points in polygons' },
    { name: 'rel-nearest', label: 'Nearest', usage: 'nearest within a distance' },
    { name: 'rel-interpolate', label: 'Interpolate', usage: 'interpolation_required' },
    { name: 'rel-aggregate', label: 'Aggregate', usage: 'aggregate_required' },
    { name: 'rel-resample', label: 'Resample', usage: 'resample_required, time grains differ' },
    { name: 'rel-incompatible', label: 'Incompatible', usage: 'incompatible' },
  ] },
  { title: 'Validation', note: 'Build: what execution concluded.', icons: [
    { name: 'confirmed', label: 'Confirmed', usage: 'Execution supports the relation' },
    { name: 'rejected', label: 'Rejected', usage: 'Execution disproved it' },
    { name: 'weak', label: 'Weak', usage: 'Holds, with caveats' },
    { name: 'unchecked', label: 'Not yet run', usage: 'Proposed, not executed' },
    { name: 'stale', label: 'Stale', usage: 'Structure changed since the check' },
  ] },
  { title: 'Representations', note: 'Result preview types.', icons: [
    { name: 'rep-point-map', label: 'Point map', usage: 'point_map' },
    { name: 'rep-choropleth', label: 'Choropleth', usage: 'choropleth' },
    { name: 'rep-relationship-map', label: 'Relationship map', usage: 'relationship_map' },
    { name: 'rep-route-comparison', label: 'Route comparison', usage: 'route_comparison' },
    { name: 'rep-ranked-bar', label: 'Ranked bars', usage: 'ranked_bar' },
    { name: 'rep-time-series', label: 'Time series', usage: 'time_series' },
    { name: 'rep-comparison-cards', label: 'Comparison cards', usage: 'comparison_cards' },
    { name: 'rep-evidence-brief', label: 'Evidence brief', usage: 'evidence_brief' },
  ] },
  { title: 'Catalogue source', note: 'Header source pill.', icons: [
    { name: 'live', label: 'Live', usage: 'Loaded from the live API' },
    { name: 'snapshot', label: 'Offline snapshot', usage: 'Frozen fallback catalogue' },
  ] },
  { title: 'Actions', note: 'Buttons and controls.', icons: [
    { name: 'search', label: 'Search', usage: 'Catalogue search' },
    { name: 'add', label: 'Add', usage: 'Add to workspace' },
    { name: 'check', label: 'Added', usage: 'In workspace' },
    { name: 'close', label: 'Close / remove', usage: 'Dismiss, remove' },
    { name: 'up', label: 'Up', usage: 'Atlas: one level up' },
    { name: 'overview', label: 'Overview', usage: 'Atlas: back to top' },
    { name: 'inspect', label: 'Inspect', usage: 'Open dataset detail' },
    { name: 'panel', label: 'Panel', usage: 'Toggle the inspector' },
    { name: 'filter', label: 'Filter', usage: 'Narrow a list' },
    { name: 'workspace', label: 'Workspace', usage: 'Selected evidence tray' },
    { name: 'external', label: 'Open source', usage: 'Link to data.bs.ch' },
  ] },
];
