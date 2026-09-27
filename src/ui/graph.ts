import * as d3 from 'd3';
import { categoryIcon, type AtlasHierarchyDatum } from '../atlas';
import { CADENCES, CADENCE_LABEL, SHAPES, SHAPE_LABEL, profile, type Shape } from '../catalogue-profile';
import type { DatasetMatch, EvidenceClass } from '../types';
import { escapeHtml, formatCount } from './dom';
import { icon } from './icons';

export interface AtlasGraphData { root: AtlasHierarchyDatum; matches: DatasetMatch[]; searchActive: boolean; }
export interface AtlasGraphActions { onFocus: (path: string[], id: string) => void; onSelect: (id: string) => void; onWorkspace: (id: string) => void; }

export interface AtlasTileRect { node: AtlasHierarchyDatum; x: number; y: number; width: number; height: number; }

/**
 * The Atlas is a semantic-zoom treemap: it only ever draws the focused node's
 * children and a preview of their children. Two levels at a time keeps every
 * label legible; deeper structure is one click away, never on screen as noise.
 */
const GAP = 6;
/** Tiny categories keep a clickable floor; the printed count stays exact. */
const MIN_SHARE = 0.03;
/** Beyond this many sub-tiles a preview stops being a preview; the rest fold into one tile. */
const MAX_PREVIEW = 10;
const EVIDENCE_ORDER: Record<EvidenceClass | 'none', number> = { direct: 0, supporting: 1, contextual: 2, missing: 3, none: 4 };

interface State {
  canvas: HTMLElement;
  data: AtlasGraphData;
  selectedId: string | null;
  workspace: Set<string>;
  actions: AtlasGraphActions;
  focusId: string;
  parents: Map<string, AtlasHierarchyDatum | null>;
  nodes: Map<string, AtlasHierarchyDatum>;
  matchById: Map<string, DatasetMatch>;
}

let state: State | null = null;

/** Squarified layout of sibling nodes, area proportional to dataset count. */
export function layoutTiles(nodes: AtlasHierarchyDatum[], width: number, height: number, gap = GAP): AtlasTileRect[] {
  if (!nodes.length || width <= 0 || height <= 0) return [];
  const total = nodes.reduce((sum, node) => sum + node.total, 0);
  const floor = total * MIN_SHARE;
  const parent = { children: nodes } as AtlasHierarchyDatum;
  const root = d3.hierarchy<AtlasHierarchyDatum>(parent, node => node === parent ? node.children : undefined)
    .sum(node => node === parent ? 0 : Math.max(node.total, floor, 1))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0) || a.data.label.localeCompare(b.data.label));
  return d3.treemap<AtlasHierarchyDatum>().tile(d3.treemapSquarify.ratio(1.2)).size([width, height]).paddingInner(gap).round(true)(root)
    .leaves()
    .map(leaf => ({ node: leaf.data, x: leaf.x0, y: leaf.y0, width: leaf.x1 - leaf.x0, height: leaf.y1 - leaf.y0 }));
}

export function renderGraph(canvas: HTMLElement, data: AtlasGraphData, selectedId: string | null, workspace: Set<string>, actions: AtlasGraphActions, focusId?: string): void {
  const nodes = new Map<string, AtlasHierarchyDatum>();
  const parents = new Map<string, AtlasHierarchyDatum | null>();
  const index = (node: AtlasHierarchyDatum, parent: AtlasHierarchyDatum | null): void => {
    nodes.set(node.id, node);
    parents.set(node.id, parent);
    node.children?.forEach(child => index(child, node));
  };
  index(data.root, null);
  const focus = focusId && nodes.get(focusId)?.kind !== 'dataset' && nodes.has(focusId) ? focusId : data.root.id;
  state = { canvas, data, selectedId, workspace, actions, focusId: focus, parents, nodes, matchById: new Map(data.matches.map(match => [match.dataset.id, match])) };
  canvas.onkeydown = event => {
    if (event.key === 'Escape' || (event.key === 'Backspace' && !(event.target instanceof HTMLInputElement))) { event.preventDefault(); zoomAtlasOut(actions); }
  };
  draw(false);
}

export function zoomAtlasOut(actions?: AtlasGraphActions): void {
  const parent = state && state.parents.get(state.focusId);
  if (parent) focusOn(parent.id, actions);
}
export function resetAtlasZoom(actions?: AtlasGraphActions): void { if (state) focusOn(state.data.root.id, actions); }
export function zoomAtlasTo(id: string, actions?: AtlasGraphActions): void { focusOn(id, actions); }
export function stopGraph(): void { /* Static layout: nothing runs between renders. */ }

function focusOn(id: string, actions?: AtlasGraphActions): void {
  if (!state || !state.nodes.has(id) || state.nodes.get(id)!.kind === 'dataset' || id === state.focusId) return;
  state.focusId = id;
  if (actions) state.actions = actions;
  draw(true);
}

function focusPath(current: State): string[] {
  const path: string[] = [];
  for (let node = current.nodes.get(current.focusId); node && current.parents.get(node.id); node = current.parents.get(node.id)!) path.unshift(node.label);
  return path;
}

function draw(animate: boolean): void {
  const current = state;
  if (!current) return;
  const paint = (): void => {
    const focus = current.nodes.get(current.focusId)!;
    const children = focus.children ?? [];
    current.canvas.innerHTML = '';
    current.canvas.classList.toggle('atlas-leaf', children.every(child => child.kind === 'dataset'));
    if (!children.length) current.canvas.innerHTML = '<p class="atlas-empty">No datasets in this category.</p>';
    else if (children.every(child => child.kind === 'dataset')) drawCards(current, children);
    else drawTiles(current, children);
    current.actions.onFocus(focusPath(current), current.focusId);
  };
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const transition = (document as Document & { startViewTransition?: (update: () => void) => unknown }).startViewTransition;
  if (animate && !reduced && transition) transition.call(document, paint); else paint();
}

// ---------------------------------------------------------------------------
// Category level
// ---------------------------------------------------------------------------

function drawTiles(current: State, children: AtlasHierarchyDatum[]): void {
  const { canvas, data } = current;
  const tiles = layoutTiles(children, canvas.clientWidth, canvas.clientHeight);
  for (const tile of tiles) {
    const node = tile.node;
    const size = tile.width < 110 || tile.height < 64 ? 'xs' : tile.width < 190 || tile.height < 120 ? 'sm' : 'lg';
    const element = document.createElement('div');
    element.className = `atlas-tile size-${size} ${evidenceClassName(node)} ${data.searchActive && node.matching === 0 ? 'dim' : ''}`;
    Object.assign(element.style, { left: `${tile.x}px`, top: `${tile.y}px`, width: `${tile.width}px`, height: `${tile.height}px` });
    element.innerHTML = `
      <button class="atlas-tile-head" title="${escapeHtml(tooltip(node))}">
        ${categoryIcon(node) && iconFits(node.label, tile.width, size) ? icon(categoryIcon(node)!, { size: size === 'lg' ? 18 : 16 }) : ''}<span class="atlas-tile-title">${escapeHtml(node.label)}</span>
        <span class="atlas-tile-count">${data.searchActive ? `<em>${node.matching}</em> / ` : ''}${node.total}</span>
      </button>
      ${size === 'xs' ? '' : `<div class="atlas-tile-evidence">${evidenceBadges(node)}</div>`}
      ${node.kind === 'category' && (size === 'lg' || tile.height >= 96) ? profileRows(node, size === 'lg' ? 'full' : 'shape') : ''}
      ${size === 'lg' ? '<div class="atlas-tile-body"></div>' : ''}`;
    if (node.kind === 'dataset') element.querySelector('button')!.addEventListener('click', () => current.actions.onSelect(node.dataset!.id));
    else element.addEventListener('click', () => focusOn(node.id));
    canvas.append(element);
    const body = element.querySelector<HTMLElement>('.atlas-tile-body');
    if (body && node.children?.length) drawPreview(current, body, node.children);
  }
}

/** One level of look-ahead inside a tile: sub-tiles, or the top datasets as a list. */
function drawPreview(current: State, body: HTMLElement, children: AtlasHierarchyDatum[]): void {
  const width = body.clientWidth;
  const height = body.clientHeight;
  if (height < 28) return;
  if (children.every(child => child.kind === 'dataset')) {
    const rows = Math.max(1, Math.floor((height - 4) / 24));
    const ranked = rankDatasets(current, children);
    const shown = ranked.length > rows ? ranked.slice(0, rows - 1) : ranked;
    body.innerHTML = `<ul class="atlas-preview-list">${shown.map(child => {
      const evidence = current.matchById.get(child.dataset!.id)?.evidenceClass;
      return `<li><button data-id="${escapeHtml(child.dataset!.id)}" class="${evidence ? `ev-${evidence}` : ''} ${current.selectedId === child.dataset!.id ? 'selected' : ''} ${current.data.searchActive && !child.matching ? 'dim' : ''}" title="${escapeHtml(child.label)}">${escapeHtml(child.label)}</button></li>`;
    }).join('')}${ranked.length > shown.length ? `<li class="atlas-more">+ ${ranked.length - shown.length} more</li>` : ''}</ul>`;
    body.querySelectorAll<HTMLButtonElement>('button[data-id]').forEach(button => button.addEventListener('click', event => {
      event.stopPropagation();
      current.actions.onSelect(button.dataset.id!);
    }));
    return;
  }
  const shown = children.length > MAX_PREVIEW ? children.slice(0, MAX_PREVIEW - 1) : children;
  const rest = children.slice(shown.length);
  const overflow: AtlasHierarchyDatum | null = rest.length
    ? { id: `${children[0].id}#more`, label: `+ ${rest.length} more`, kind: 'category', depth: children[0].depth, total: rest.reduce((sum, child) => sum + child.total, 0), matching: rest.reduce((sum, child) => sum + child.matching, 0), direct: 0, supporting: 0, contextual: 0, aggregateRelevance: 0 }
    : null;
  for (const tile of layoutTiles(overflow ? [...shown, overflow] : shown, width, height, 3)) {
    const node = tile.node;
    if (node === overflow) {
      const more = document.createElement('button');
      more.className = 'atlas-sub atlas-sub-more';
      const parent = current.parents.get(children[0].id);
      more.title = `Open all ${node.total} datasets in ${parent?.label ?? 'this category'}`;
      if (parent) more.addEventListener('click', event => { event.stopPropagation(); focusOn(parent.id); });
      Object.assign(more.style, { left: `${tile.x}px`, top: `${tile.y}px`, width: `${tile.width}px`, height: `${tile.height}px` });
      more.innerHTML = `<span>${escapeHtml(node.label)}</span><small>${node.total}</small>`;
      body.append(more);
      continue;
    }
    const roomy = tile.width >= 72 && tile.height >= 34;
    const button = document.createElement('button');
    button.className = `atlas-sub ${evidenceClassName(node)} ${current.data.searchActive && node.matching === 0 ? 'dim' : ''}`;
    button.title = tooltip(node);
    Object.assign(button.style, { left: `${tile.x}px`, top: `${tile.y}px`, width: `${tile.width}px`, height: `${tile.height}px` });
    button.innerHTML = roomy ? `<span>${escapeHtml(node.label)}</span><small>${node.total}</small>` : '';
    button.setAttribute('aria-label', `${node.label}, ${node.total} datasets`);
    button.addEventListener('click', event => {
      event.stopPropagation();
      if (node.kind === 'dataset') current.actions.onSelect(node.dataset!.id); else focusOn(node.id);
    });
    body.append(button);
  }
}

// ---------------------------------------------------------------------------
// Dataset level
// ---------------------------------------------------------------------------

function drawCards(current: State, children: AtlasHierarchyDatum[]): void {
  const grid = document.createElement('div');
  grid.className = 'atlas-cards';
  grid.innerHTML = rankDatasets(current, children).map(child => {
    const dataset = child.dataset!;
    const match = current.matchById.get(dataset.id);
    const added = current.workspace.has(dataset.id);
    const dim = current.data.searchActive && child.matching === 0;
    return `<article class="atlas-card ${match ? `ev-${match.evidenceClass}` : ''} ${current.selectedId === dataset.id ? 'selected' : ''} ${dim ? 'dim' : ''}" data-id="${escapeHtml(dataset.id)}">
      <button class="atlas-card-main" title="Inspect ${escapeHtml(dataset.title)}">
        <span class="atlas-card-evidence">${match ? `${match.evidenceClass} · ${match.relevance.score}` : 'catalogue'}</span>
        <span class="atlas-card-title">${escapeHtml(dataset.title)}</span>
        <span class="atlas-card-meta">${escapeHtml(dataset.id)} · ${escapeHtml(dataset.publisher)} · ${formatCount(dataset.recordsCount)} records</span>
      </button>
      <button class="atlas-card-add ${added ? 'added' : ''}" aria-label="${added ? 'Remove from' : 'Add to'} workspace" title="${added ? 'Remove from' : 'Add to'} workspace">${added ? icon('check', { size: 14 }) : icon('add', { size: 14 })}</button>
    </article>`;
  }).join('');
  grid.querySelectorAll<HTMLElement>('.atlas-card').forEach(card => {
    const id = card.dataset.id!;
    card.querySelector('.atlas-card-main')!.addEventListener('click', () => current.actions.onSelect(id));
    card.querySelector('.atlas-card-add')!.addEventListener('click', () => current.actions.onWorkspace(id));
  });
  current.canvas.append(grid);
}

function rankDatasets(current: State, children: AtlasHierarchyDatum[]): AtlasHierarchyDatum[] {
  const key = (node: AtlasHierarchyDatum) => current.matchById.get(node.dataset!.id);
  return [...children].sort((a, b) =>
    (current.data.searchActive ? b.matching - a.matching : 0)
    || EVIDENCE_ORDER[key(a)?.evidenceClass ?? 'none'] - EVIDENCE_ORDER[key(b)?.evidenceClass ?? 'none']
    || (key(b)?.relevance.score ?? 0) - (key(a)?.relevance.score ?? 0)
    || a.label.localeCompare(b.label));
}

/** A category icon only where the title's longest word still fits beside it; a word must never break for an icon. */
function iconFits(label: string, width: number, size: 'xs' | 'sm' | 'lg'): boolean {
  if (size === 'xs') return false;
  const longest = Math.max(...label.split(/\s+/).map(word => word.length));
  const room = width - 24 /* padding */ - 34 /* count */ - 24 /* icon + gap */;
  return room >= longest * (size === 'lg' ? 8.6 : 7.6);
}

// ---------------------------------------------------------------------------
// Catalogue profile: what a card's datasets look like before opening one
// ---------------------------------------------------------------------------

const SHAPE_ICON: Partial<Record<Shape, 'geo-point' | 'geo-line' | 'geo-polygon' | 'geo-mixed' | 'geo-raster' | 'geo-none'>> = {
  point: 'geo-point', line: 'geo-line', area: 'geo-polygon', mixed: 'geo-mixed', raster: 'geo-raster', table: 'geo-none',
};

function datasetsUnder(node: AtlasHierarchyDatum): NonNullable<AtlasHierarchyDatum['dataset']>[] {
  return node.kind === 'dataset' ? [node.dataset!] : (node.children ?? []).flatMap(datasetsUnder);
}

/**
 * Metadata rows for a category card. Every row sums to the card's count; zero buckets are
 * omitted, unknown is always shown when present. Describes declared metadata, not coverage.
 */
function profileRows(node: AtlasHierarchyDatum, detail: 'full' | 'shape'): string {
  const fp = profile(datasetsUnder(node));
  if (!fp.total) return '';
  const shapes = SHAPES.filter(key => fp.shape[key] > 0).map(key => {
    const glyph = SHAPE_ICON[key];
    const label = `${fp.shape[key]} ${SHAPE_LABEL[key]}`;
    return `<span class="ap-v" title="${label}" aria-label="${label}">${glyph ? icon(glyph, { size: 13 }) : '<b>?</b>'}${fp.shape[key]}</span>`;
  }).join('');
  const rows = [`<div class="ap-row"><span class="ap-k">Shape</span>${shapes}</div>`];
  if (detail === 'full') {
    const cadence = CADENCES.filter(key => fp.cadence[key] > 0).map(key => `<span class="ap-v">${CADENCE_LABEL[key]} ${fp.cadence[key]}</span>`).join('<span class="ap-sep">·</span>');
    rows.push(`<div class="ap-row"><span class="ap-k">Updates</span>${cadence}</div>`);
    const records = fp.recordsMedian === null ? 'no counts published' : `median ${formatCount(fp.recordsMedian)} records`;
    rows.push(`<div class="ap-row"><span class="ap-k">Size</span><span class="ap-v">${records}${fp.recordsUnknown && fp.recordsMedian !== null ? ` · ${fp.recordsUnknown} without count` : ''}</span></div>`);
  }
  return `<div class="atlas-profile" aria-label="Catalogue profile">${rows.join('')}</div>`;
}

function evidenceClassName(node: AtlasHierarchyDatum): string {
  return node.direct ? 'has-direct' : node.supporting ? 'has-supporting' : node.contextual ? 'has-contextual' : '';
}

function evidenceBadges(node: AtlasHierarchyDatum): string {
  // Contextual is the catalogue's baseline, not a signal; only role evidence earns a badge.
  const parts = (['direct', 'supporting'] as const)
    .filter(key => node[key] > 0)
    .map(key => `<span class="ev-badge ev-${key}">${icon(`evidence-${key}`, { size: 12 })}${node[key]} ${key}</span>`);
  return parts.join('');
}

function tooltip(node: AtlasHierarchyDatum): string {
  if (node.kind === 'dataset') return `${node.label}\n${node.dataset!.id}`;
  return `${node.label}\n${node.total} datasets\n${node.direct} direct · ${node.supporting} supporting · ${node.contextual} contextual`;
}
