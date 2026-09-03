import * as d3 from 'd3';
import type { AtlasNodeSummary } from '../atlas';
import type { DatasetMatch, DatasetRecord } from '../types';
import { truncate } from './dom';

export interface AtlasGraphData { level: 1 | 2 | 3; summaries?: AtlasNodeSummary[]; datasets?: DatasetRecord[]; matches: DatasetMatch[]; searchActive: boolean; searchMatches: Set<string>; }
export interface AtlasGraphActions { onDrill: (label: string) => void; onSelect: (id: string) => void; onWorkspace: (id: string) => void; }

export function renderGraph(container: HTMLElement, svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, unknown>, data: AtlasGraphData, selectedId: string | null, workspace: Set<string>, actions: AtlasGraphActions): void {
  const rect = container.getBoundingClientRect();
  const width = Math.max(480, rect.width);
  const height = Math.max(360, rect.height);
  svg.attr('viewBox', `0 0 ${width} ${height}`).style('min-height', '').selectAll('*').remove();
  if (data.level === 3) renderDatasets(svg, width, height, data, selectedId, workspace, actions);
  else renderCategories(svg, width, height, data, actions);
}

function renderCategories(svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, unknown>, width: number, height: number, data: AtlasGraphData, actions: AtlasGraphActions): void {
  const summaries = data.summaries ?? [];
  if (!summaries.length) return empty(svg, 'No Atlas categories are available.');
  const maxCount = d3.max(summaries, item => item.total) ?? 1;
  const columns = Math.max(2, Math.ceil(Math.sqrt(summaries.length * width / height)));
  const rows = Math.ceil(summaries.length / columns);
  const cellW = width / columns;
  const cellH = Math.max(120, (height - 24) / rows);
  const radius = d3.scaleSqrt().domain([1, maxCount]).range([38, Math.min(78, cellW * .31, cellH * .32)]);
  const maxRelevance = d3.max(summaries, item => item.aggregateRelevance) || 1;
  const nodes = svg.append('g').attr('class', `atlas-level atlas-level-${data.level}`).selectAll<SVGGElement, AtlasNodeSummary>('g').data(summaries, item => item.id).enter().append('g')
    .attr('class', item => `atlas-node ${data.searchActive && item.matching === 0 ? 'zero-match' : ''}`)
    .attr('transform', (_, index) => `translate(${cellW * (index % columns + .5)},${cellH * (Math.floor(index / columns) + .5) + 8})`)
    .style('cursor', 'pointer').on('click', (_, item) => actions.onDrill(item.label));
  nodes.append('circle').attr('r', item => radius(item.total)).attr('class', 'atlas-category-circle').attr('fill-opacity', item => .12 + .62 * (item.aggregateRelevance / maxRelevance));
  nodes.append('text').attr('class', 'atlas-count').attr('y', 5).text(item => data.searchActive ? item.matching : item.total);
  nodes.append('text').attr('class', 'atlas-label').attr('y', item => radius(item.total) + 18).text(item => truncate(item.label, 34));
  nodes.append('text').attr('class', 'atlas-meta').attr('y', item => radius(item.total) + 32).text(item => `${item.total} datasets${data.searchActive ? ` · ${item.matching} search matches` : ''}`);
  nodes.append('text').attr('class', 'atlas-evidence').attr('y', item => radius(item.total) + 45).text(evidenceText);
  nodes.append('title').text(item => `${item.label}\n${item.total} datasets\n${evidenceText(item) || 'No strong evidence matches'}`);
}

function renderDatasets(svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, unknown>, width: number, height: number, data: AtlasGraphData, selectedId: string | null, workspace: Set<string>, actions: AtlasGraphActions): void {
  const matchById = new Map(data.matches.map(match => [match.dataset.id, match]));
  const datasets = [...(data.datasets ?? [])].filter(dataset => !data.searchActive || data.searchMatches.has(dataset.id)).sort((a, b) => (matchById.get(b.id)?.relevance.score ?? 0) - (matchById.get(a.id)?.relevance.score ?? 0) || a.title.localeCompare(b.title));
  if (!datasets.length) return empty(svg, data.searchActive ? 'No datasets in this subcategory match the search.' : 'No datasets in this subcategory.');
  type PackDatum = { children?: PackDatum[]; dataset?: DatasetRecord };
  const packed = d3.pack<PackDatum>().size([width - 24, height - 24]).padding(8)(
    d3.hierarchy<PackDatum>({ children: datasets.map(dataset => ({ dataset })) }, node => node.children).sum(node => node.dataset ? 28 + (matchById.get(node.dataset.id)?.relevance.score ?? 0) : 0),
  );
  const leaves = packed.leaves();
  const labelled = new Set(datasets.filter((dataset, index) => index < 10 || ['direct', 'supporting'].includes(matchById.get(dataset.id)?.evidenceClass ?? '')).map(dataset => dataset.id));
  const nodes = svg.append('g').attr('transform', 'translate(12,12)').selectAll<SVGGElement, d3.HierarchyCircularNode<PackDatum>>('g').data(leaves).enter().append('g')
    .attr('class', node => `atlas-dataset ${selectedId === node.data.dataset!.id ? 'selected' : ''}`)
    .attr('transform', node => `translate(${node.x},${node.y})`);
  nodes.append('circle').attr('r', node => node.r).attr('class', node => `dataset-orb evidence-${matchById.get(node.data.dataset!.id)?.evidenceClass ?? 'contextual'}`).style('cursor', 'pointer').on('click', (_, node) => actions.onSelect(node.data.dataset!.id));
  nodes.append('title').text(node => { const dataset = node.data.dataset!; const match = matchById.get(dataset.id); return `${dataset.title}\n${dataset.id}${match ? `\n${match.evidenceClass} · relevance ${match.relevance.score}` : ''}`; });
  const labels = nodes.filter(node => labelled.has(node.data.dataset!.id));
  labels.append('text').attr('class', 'dataset-title').attr('y', -4).text(node => truncate(node.data.dataset!.title, Math.max(12, Math.floor(node.r / 2.3))));
  labels.append('text').attr('class', 'dataset-id').attr('y', 12).text(node => node.data.dataset!.id);
  labels.append('text').attr('class', 'dataset-relevance').attr('y', 26).text(node => { const match = matchById.get(node.data.dataset!.id); return match ? `${match.evidenceClass} · ${match.relevance.score}` : 'catalogue'; });
  nodes.append('circle').attr('class', node => `dataset-add ${workspace.has(node.data.dataset!.id) ? 'added' : ''}`).attr('cx', node => node.r * .62).attr('cy', node => node.r * .62).attr('r', 11).style('cursor', 'pointer').on('click', (event, node) => { event.stopPropagation(); actions.onWorkspace(node.data.dataset!.id); });
  nodes.append('text').attr('class', 'dataset-add-label').attr('x', node => node.r * .62).attr('y', node => node.r * .62 + 3).text(node => workspace.has(node.data.dataset!.id) ? '✓' : '+');
}

function evidenceText(item: AtlasNodeSummary): string { const parts = []; if (item.direct) parts.push(`${item.direct} direct`); if (item.supporting) parts.push(`${item.supporting} supporting`); if (item.contextual) parts.push(`${item.contextual} contextual`); return parts.join(' · '); }
function empty(svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, unknown>, message: string): void { svg.append('text').attr('x', 24).attr('y', 42).attr('class', 'empty-note').text(message); }
export function stopGraph(): void { /* deterministic layout has no running simulation */ }
