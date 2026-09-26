import * as d3 from 'd3';
import { categoryIcon, type AtlasHierarchyDatum } from '../atlas';
import type { DatasetMatch } from '../types';
import { truncate } from './dom';
import { icon } from './icons';

export interface AtlasGraphData { root: AtlasHierarchyDatum; matches: DatasetMatch[]; searchActive: boolean; }
export interface AtlasGraphActions { onFocus: (path: string[], id: string) => void; onSelect: (id: string) => void; onWorkspace: (id: string) => void; }

type Packed = d3.HierarchyCircularNode<AtlasHierarchyDatum>;
let currentSvg: d3.Selection<SVGSVGElement, unknown, HTMLElement, unknown> | null = null;
let currentZoom: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null;
let nodesById = new Map<string, Packed>();
let currentFocusId = '';
let currentSize = { width: 0, height: 0 };

export function renderGraph(container: HTMLElement, svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, unknown>, data: AtlasGraphData, selectedId: string | null, workspace: Set<string>, actions: AtlasGraphActions, focusId?: string): void {
  const rect = container.getBoundingClientRect();
  const width = Math.max(480, rect.width);
  const height = Math.max(440, rect.height);
  currentSvg = svg;
  currentSize = { width, height };
  svg.attr('viewBox', `0 0 ${width} ${height}`).style('min-height', '').selectAll('*').remove();

  const matchById = new Map(data.matches.map(match => [match.dataset.id, match]));
  const hierarchy = d3.hierarchy(data.root, node => node.children)
    .sum(node => node.kind === 'dataset' ? 1 : 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0) || a.data.id.localeCompare(b.data.id));
  const packed = d3.pack<AtlasHierarchyDatum>().size([width, height]).padding(node => node.depth < 2 ? 12 : node.depth < 4 ? 6 : 3)(hierarchy);
  const descendants = packed.descendants();
  nodesById = new Map(descendants.map(node => [node.data.id, node]));

  svg.append('defs').append('clipPath').attr('id', 'atlas-clip').append('rect').attr('width', width).attr('height', height);
  const viewport = svg.append('g').attr('class', 'atlas-viewport').attr('clip-path', 'url(#atlas-clip)');
  const nodeClass = (item: Packed): string => `zoom-node zoom-${item.data.kind} ${item.data.direct ? 'branch-direct' : item.data.supporting ? 'branch-supporting' : ''} ${data.searchActive && item.data.matching === 0 ? 'zero-match' : ''} ${selectedId === item.data.dataset?.id ? 'selected' : ''}`;
  const node = viewport.selectAll<SVGGElement, Packed>('g').data(descendants.slice(1), item => item.data.id).join('g')
    .attr('class', nodeClass)
    .attr('transform', item => `translate(${item.x},${item.y})`);

  node.append('circle').attr('r', item => item.r).attr('class', item => item.data.kind === 'dataset' ? `zoom-circle evidence-${matchById.get(item.data.dataset!.id)?.evidenceClass ?? 'contextual'}` : 'zoom-circle')
    .on('click', (event, item) => {
      event.stopPropagation();
      if (item.data.kind === 'dataset') actions.onSelect(item.data.dataset!.id);
      else zoomToNode(item, true, actions);
    });
  node.append('title').text(item => tooltip(item.data, matchById));
  // the add button keeps its screen size: positioned on the circle, counter-scaled in updateLabels
  const add = node.filter(item => item.data.kind === 'dataset').append('g').attr('class', 'zoom-add-group');
  add.append('circle').attr('class', item => `zoom-add ${workspace.has(item.data.dataset!.id) ? 'added' : ''}`).attr('r', 10).on('click', (event, item) => { event.stopPropagation(); actions.onWorkspace(item.data.dataset!.id); });
  add.append('text').attr('class', 'zoom-add-label').attr('y', 3).text(item => workspace.has(item.data.dataset!.id) ? '✓' : '+');
  // Topic categories carry an icon on the top of their rim, where dataset circles never cover it.
  // labels and badges live in their own layer above every circle, so child circles never paint over them
  const labels = viewport.append('g').attr('class', 'atlas-labels').selectAll<SVGGElement, Packed>('g').data(descendants.slice(1), item => item.data.id).join('g')
    .attr('class', nodeClass).attr('transform', item => `translate(${item.x},${item.y})`);
  const badge = labels.filter(item => Boolean(categoryIcon(item.data))).append('g').attr('class', 'zoom-icon');
  badge.append('circle').attr('class', 'zoom-icon-disc').attr('r', 14);
  badge.append('g').attr('transform', 'translate(-9,-9)').html(item => icon(categoryIcon(item.data)!, 18));
  labels.append('text').attr('class', 'zoom-label').each(function(item) {
    const text = d3.select(this);
    text.append('tspan').attr('class', 'zoom-label-title').text(truncate(item.data.label, 34));
    text.attr('data-full', item.data.label);
    text.append('tspan').attr('class', 'zoom-label-meta').attr('x', 0).attr('dy', '1.25em').text(item.data.kind === 'dataset' ? item.data.dataset!.id : `${data.searchActive ? `${item.data.matching} / ` : ''}${item.data.total} dataset${item.data.total === 1 ? '' : 's'}`);
    if (item.data.kind === 'dataset') text.append('tspan').attr('class', 'zoom-label-detail').attr('x', 0).attr('dy', '1.2em').text(() => { const match = matchById.get(item.data.dataset!.id); return match ? `${match.evidenceClass} · ${match.relevance.score}` : 'catalogue'; });
  });

  const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([1, 36]).translateExtent([[-width * .8, -height * .8], [width * 1.8, height * 1.8]]).extent([[0, 0], [width, height]])
    .on('zoom', event => { viewport.attr('transform', event.transform.toString()); updateLabels(node, labels, event.transform.k); });
  currentZoom = zoom;
  svg.call(zoom).on('dblclick.zoom', null).on('click.atlas-background', event => { if (event.target === svg.node()) zoomAtlasOut(actions); });
  const focus = focusId ? nodesById.get(focusId) : undefined;
  if (focus) zoomToNode(focus, false, actions); else { currentFocusId = data.root.id; updateLabels(node, labels, 1); actions.onFocus([], data.root.id); }
}

// Everything text-like keeps its screen size: it is counter-scaled against the zoom (scale(1/k)), so labels read
// at 10px at every depth instead of growing with the circles. Category labels sit just inside the top of their rim
// (below the icon badge, if any) where child circles never cover them; dataset labels stay centred.
const CHAR_PX = 6.1; // average width of a 10px/650 Inter character
const RIM_OFFSET = (item: Packed): number => (categoryIcon(item.data) ? 34 : 15);
function chord(radius: number, depth: number): number { return depth >= radius ? 0 : 2 * Math.sqrt(radius * radius - (radius - depth) ** 2); }
function fit(label: string, px: number): string { return truncate(label, Math.max(4, Math.floor(px / CHAR_PX))); }

function updateLabels(nodes: d3.Selection<SVGGElement, Packed, SVGGElement, unknown>, labels: d3.Selection<SVGGElement, Packed, SVGGElement, unknown>, scale: number): void {
  const categoryDepth = scale < 1.7 ? 1 : scale < 3.5 ? 2 : scale < 7 ? 3 : Number.POSITIVE_INFINITY;
  labels.select<SVGTextElement>('.zoom-label')
    .attr('transform', item => item.data.kind === 'dataset' ? `scale(${1 / scale})` : `translate(0,${-item.r}) scale(${1 / scale}) translate(0,${RIM_OFFSET(item)})`)
    .each(function(item) {
      const screen = item.r * scale;
      const room = item.data.kind === 'dataset' ? screen * 1.7 : chord(screen, RIM_OFFSET(item) + 4) * .9;
      d3.select(this).select('.zoom-label-title').text(fit(this.getAttribute('data-full') ?? item.data.label, room));
      this.classList.toggle('too-small', room < 7 * CHAR_PX);
    });
  nodes.select<SVGGElement>('.zoom-add-group').attr('transform', item => `translate(${item.r * .58},${item.r * .58}) scale(${1 / scale})`);
  // One category label per branch: a parent and its child would share the same rim, so the deepest labelled level
  // wins. A top-level category keeps its icon badge meanwhile, which is what identifies it.
  const labelled = (item: Packed): boolean => item.data.kind !== 'dataset' && item.depth <= categoryDepth && item.r * scale >= 25 && item.r * scale <= 420;
  labels.select<SVGTextElement>('.zoom-label').style('display', item => {
    if (item.data.kind === 'dataset') return item.r * scale >= 36 ? null : 'none';
    return labelled(item) && !item.children?.some(labelled) ? null : 'none';
  });
  labels.select<SVGGElement>('.zoom-icon')
    .attr('transform', item => `translate(0,${-item.r}) scale(${1 / scale})`)
    .style('display', item => labelled(item) ? null : 'none');
  labels.selectAll<SVGTSpanElement, Packed>('.zoom-label-meta').style('display', item => item.data.kind === 'dataset' ? (item.r * scale >= 46 ? null : 'none') : null);
  labels.selectAll<SVGTSpanElement, Packed>('.zoom-label-detail').style('display', item => item.r * scale >= 68 ? null : 'none');
  nodes.select<SVGGElement>('.zoom-add-group').style('display', item => item.r * scale >= 45 ? null : 'none');
}

function transformFor(node: Packed): d3.ZoomTransform {
  const scale = Math.min(32, Math.max(1, .88 * Math.min(currentSize.width, currentSize.height) / (node.r * 2)));
  return d3.zoomIdentity.translate(currentSize.width / 2 - node.x * scale, currentSize.height / 2 - node.y * scale).scale(scale);
}

function zoomToNode(node: Packed, animate: boolean, actions?: AtlasGraphActions): void {
  if (!currentSvg || !currentZoom) return;
  currentFocusId = node.data.id;
  const selection = animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? currentSvg.transition().duration(550) : currentSvg;
  selection.call(currentZoom.transform, transformFor(node));
  actions?.onFocus(node.ancestors().reverse().slice(1).filter(item => item.data.kind !== 'dataset').map(item => item.data.label), node.data.id);
}

export function zoomAtlasIn(): void { if (currentSvg && currentZoom) currentSvg.transition().duration(180).call(currentZoom.scaleBy, 1.5); }
export function zoomAtlasOut(actions?: AtlasGraphActions): void {
  const current = nodesById.get(currentFocusId);
  const parent = current?.parent;
  if (parent) zoomToNode(parent, true, actions); else if (currentSvg && currentZoom) currentSvg.transition().duration(180).call(currentZoom.scaleBy, 1 / 1.5);
}
export function resetAtlasZoom(actions?: AtlasGraphActions): void { const root = [...nodesById.values()].find(node => node.depth === 0); if (root) zoomToNode(root, true, actions); }
export function zoomAtlasTo(id: string, actions?: AtlasGraphActions): void { const node = nodesById.get(id); if (node) zoomToNode(node, true, actions); }
export function stopGraph(): void { currentSvg?.interrupt(); }

function tooltip(node: AtlasHierarchyDatum, matches: Map<string, DatasetMatch>): string {
  if (node.kind !== 'dataset') return `${node.label}\n${node.total} datasets\n${node.direct} direct · ${node.supporting} supporting · ${node.contextual} contextual`;
  const match = matches.get(node.dataset!.id);
  return `${node.dataset!.title}\n${node.dataset!.id}${match ? `\n${match.evidenceClass} · relevance ${match.relevance.score}` : ''}`;
}
