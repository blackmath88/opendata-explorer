import * as d3 from 'd3';
import type { AtlasHierarchyDatum } from '../atlas';
import type { DatasetMatch } from '../types';
import { truncate } from './dom';

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
  const node = viewport.selectAll<SVGGElement, Packed>('g').data(descendants.slice(1), item => item.data.id).join('g')
    .attr('class', item => `zoom-node zoom-${item.data.kind} ${item.data.direct ? 'branch-direct' : item.data.supporting ? 'branch-supporting' : ''} ${data.searchActive && item.data.matching === 0 ? 'zero-match' : ''} ${selectedId === item.data.dataset?.id ? 'selected' : ''}`)
    .attr('transform', item => `translate(${item.x},${item.y})`);

  node.append('circle').attr('r', item => item.r).attr('class', item => item.data.kind === 'dataset' ? `zoom-circle evidence-${matchById.get(item.data.dataset!.id)?.evidenceClass ?? 'contextual'}` : 'zoom-circle')
    .on('click', (event, item) => {
      event.stopPropagation();
      if (item.data.kind === 'dataset') actions.onSelect(item.data.dataset!.id);
      else zoomToNode(item, true, actions);
    });
  node.append('title').text(item => tooltip(item.data, matchById));
  node.filter(item => item.data.kind === 'dataset').append('circle').attr('class', item => `zoom-add ${workspace.has(item.data.dataset!.id) ? 'added' : ''}`).attr('cx', item => item.r * .58).attr('cy', item => item.r * .58).attr('r', item => Math.min(10, item.r * .18)).on('click', (event, item) => { event.stopPropagation(); actions.onWorkspace(item.data.dataset!.id); });
  node.filter(item => item.data.kind === 'dataset').append('text').attr('class', 'zoom-add-label').attr('x', item => item.r * .58).attr('y', item => item.r * .58 + 3).text(item => workspace.has(item.data.dataset!.id) ? '✓' : '+');
  node.append('text').attr('class', 'zoom-label').each(function(item) {
    const text = d3.select(this);
    text.append('tspan').attr('class', 'zoom-label-title').text(truncate(item.data.label, 34));
    text.append('tspan').attr('class', 'zoom-label-meta').attr('x', 0).attr('dy', '1.25em').text(item.data.kind === 'dataset' ? item.data.dataset!.id : `${data.searchActive ? `${item.data.matching} / ` : ''}${item.data.total} datasets`);
    if (item.data.kind === 'dataset') text.append('tspan').attr('class', 'zoom-label-detail').attr('x', 0).attr('dy', '1.2em').text(() => { const match = matchById.get(item.data.dataset!.id); return match ? `${match.evidenceClass} · ${match.relevance.score}` : 'catalogue'; });
  });

  const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([1, 36]).translateExtent([[-width * .8, -height * .8], [width * 1.8, height * 1.8]]).extent([[0, 0], [width, height]])
    .on('zoom', event => { viewport.attr('transform', event.transform.toString()); updateLabels(node, event.transform.k); });
  currentZoom = zoom;
  svg.call(zoom).on('dblclick.zoom', null).on('click.atlas-background', event => { if (event.target === svg.node()) zoomAtlasOut(actions); });
  const focus = focusId ? nodesById.get(focusId) : undefined;
  if (focus) zoomToNode(focus, false, actions); else { currentFocusId = data.root.id; updateLabels(node, 1); actions.onFocus([], data.root.id); }
}

function updateLabels(nodes: d3.Selection<SVGGElement, Packed, SVGGElement, unknown>, scale: number): void {
  const categoryDepth = scale < 1.7 ? 1 : scale < 3.5 ? 2 : scale < 7 ? 3 : Number.POSITIVE_INFINITY;
  nodes.select<SVGTextElement>('.zoom-label').style('display', item => {
    const screenRadius = item.r * scale;
    if (item.data.kind === 'dataset') return screenRadius >= 30 ? null : 'none';
    return item.depth <= categoryDepth && screenRadius >= 25 && screenRadius <= 420 ? null : 'none';
  });
  nodes.selectAll<SVGTSpanElement, Packed>('.zoom-label-meta').style('display', item => item.data.kind === 'dataset' ? (item.r * scale >= 46 ? null : 'none') : null);
  nodes.selectAll<SVGTSpanElement, Packed>('.zoom-label-detail').style('display', item => item.r * scale >= 68 ? null : 'none');
  nodes.selectAll<SVGCircleElement, Packed>('.zoom-add').style('display', item => item.r * scale >= 45 ? null : 'none');
  nodes.selectAll<SVGTextElement, Packed>('.zoom-add-label').style('display', item => item.r * scale >= 45 ? null : 'none');
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
