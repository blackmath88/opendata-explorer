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
  const cardW = Math.min(250, Math.max(180, width / Math.min(4, datasets.length) - 18));
  const cardH = 88;
  const columns = Math.max(1, Math.floor(width / (cardW + 16)));
  const contentHeight = Math.max(height, Math.ceil(datasets.length / columns) * (cardH + 14) + 20);
  svg.attr('viewBox', `0 0 ${width} ${contentHeight}`).style('min-height', `${contentHeight}px`);
  const nodes = svg.append('g').selectAll<SVGGElement, DatasetRecord>('g').data(datasets, item => item.id).enter().append('g').attr('class', item => `atlas-dataset ${selectedId === item.id ? 'selected' : ''}`).attr('transform', (_, index) => {
    const used = columns * cardW + (columns - 1) * 16;
    return `translate(${(width - used) / 2 + (index % columns) * (cardW + 16)},${12 + Math.floor(index / columns) * (cardH + 14)})`;
  });
  nodes.append('rect').attr('width', cardW).attr('height', cardH).attr('rx', 10).attr('class', item => `dataset-card evidence-${matchById.get(item.id)?.evidenceClass ?? 'contextual'}`).style('cursor', 'pointer').on('click', (_, item) => actions.onSelect(item.id));
  nodes.append('text').attr('class', 'dataset-title').attr('x', 12).attr('y', 22).text(item => truncate(item.title, 35));
  nodes.append('text').attr('class', 'dataset-id').attr('x', 12).attr('y', 40).text(item => item.id);
  nodes.append('text').attr('class', 'dataset-relevance').attr('x', 12).attr('y', 61).text(item => { const match = matchById.get(item.id); return match ? `${match.evidenceClass} · relevance ${match.relevance.score}` : 'catalogue dataset'; });
  nodes.append('rect').attr('class', item => `dataset-add ${workspace.has(item.id) ? 'added' : ''}`).attr('x', cardW - 52).attr('y', 53).attr('width', 40).attr('height', 23).attr('rx', 6).style('cursor', 'pointer').on('click', (event, item) => { event.stopPropagation(); actions.onWorkspace(item.id); });
  nodes.append('text').attr('class', 'dataset-add-label').attr('x', cardW - 32).attr('y', 68).text(item => workspace.has(item.id) ? 'Added' : 'Add');
}

function evidenceText(item: AtlasNodeSummary): string { const parts = []; if (item.direct) parts.push(`${item.direct} direct`); if (item.supporting) parts.push(`${item.supporting} supporting`); if (item.contextual) parts.push(`${item.contextual} contextual`); return parts.join(' · '); }
function empty(svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, unknown>, message: string): void { svg.append('text').attr('x', 24).attr('y', 42).attr('class', 'empty-note').text(message); }
export function stopGraph(): void { /* deterministic layout has no running simulation */ }
