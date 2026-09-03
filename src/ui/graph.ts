import * as d3 from 'd3';
import type { DatasetMatch } from '../types';
import { truncate } from './dom';
import { GRAPH_LABEL_LIMIT, selectGraphMatches } from '../catalogue-ui';

/**
 * The semantic landscape.
 *
 * One live simulation at a time: earlier builds started a new force simulation
 * on every render and every resize event without stopping the previous one, so
 * detached nodes kept ticking in the background.
 */
let simulation: d3.Simulation<LandscapeNode, undefined> | null = null;

interface LandscapeNode extends d3.SimulationNodeDatum {
  match: DatasetMatch;
  topic: string;
}

/**
 * Labelling every node produced unreadable overlap on a 361-dataset catalogue,
 * so only the strongest matches (and the selection) carry text.
 */

export function renderGraph(
  container: HTMLElement,
  svgSelection: d3.Selection<SVGSVGElement, unknown, HTMLElement, unknown>,
  matches: DatasetMatch[],
  selectedId: string | null,
  onSelect: (id: string) => void,
): void {
  simulation?.stop();
  simulation = null;

  const rect = container.getBoundingClientRect();
  const width = Math.max(480, rect.width);
  const height = Math.max(360, rect.height);
  svgSelection.attr('viewBox', `0 0 ${width} ${height}`);
  svgSelection.selectAll('*').remove();

  const data = selectGraphMatches(matches);
  if (!data.length) {
    svgSelection.append('text').attr('x', 24).attr('y', 42).attr('class', 'empty-note')
      .text('No datasets match this filter.');
    return;
  }

  const nodes: LandscapeNode[] = data.map(match => ({
    match,
    topic: match.dataset.semantic.topics[0] ?? match.dataset.themes[0]?.toLowerCase() ?? 'other',
    x: width * (0.2 + seeded(match.dataset.id, 0) * 0.6),
    y: height * (0.18 + seeded(match.dataset.id, 1) * 0.64),
  }));

  const topics = [...new Set(nodes.map(node => node.topic))];
  const centers = new Map(
    topics.map((topic, index) => {
      const angle = (index / topics.length) * Math.PI * 2;
      return [topic, { x: width / 2 + Math.cos(angle) * width * 0.24, y: height / 2 + Math.sin(angle) * height * 0.24 }];
    }),
  );

  const radius = (node: LandscapeNode) => 9 + Math.max(4, node.match.relevance.score * 0.13);
  const labelCutoff = [...nodes]
    .sort((a, b) => b.match.relevance.score - a.match.relevance.score)
    .slice(0, GRAPH_LABEL_LIMIT)
    .at(-1)?.match.relevance.score ?? 0;
  const isLabelled = (node: LandscapeNode) =>
    node.match.relevance.score >= labelCutoff || selectedId === node.match.dataset.id;

  const group = svgSelection.append('g');
  const node = group
    .selectAll<SVGGElement, LandscapeNode>('g')
    .data(nodes)
    .enter()
    .append('g')
    .attr('class', d => `node ${selectedId === d.match.dataset.id ? 'selected' : ''}`)
    .style('cursor', 'pointer')
    .on('click', (_, d) => onSelect(d.match.dataset.id));

  node.append('title').text(d => `${d.match.dataset.title} · ${d.match.relevance.score}`);
  node
    .append('circle')
    .attr('r', radius)
    .attr('fill', d => fill(d.match));

  const labelled = node.filter(isLabelled);
  labelled
    .append('text')
    .attr('class', 'node-label')
    .attr('y', d => radius(d) + 13)
    .text(d => truncate(d.match.dataset.title, 24));
  labelled
    .append('text')
    .attr('class', 'node-sub')
    .attr('y', d => radius(d) + 23)
    .text(d => `${d.match.relevance.score} · ${d.match.dataset.id}`);

  simulation = d3
    .forceSimulation(nodes)
    .force('x', d3.forceX<LandscapeNode>(d => centers.get(d.topic)?.x ?? width / 2).strength(0.2))
    .force('y', d3.forceY<LandscapeNode>(d => centers.get(d.topic)?.y ?? height / 2).strength(0.2))
    .force('charge', d3.forceManyBody().strength(-48))
    .force('collide', d3.forceCollide<LandscapeNode>(d => radius(d) + (isLabelled(d) ? 40 : 12)))
    .stop();

  // Compute the layout before paint. The landscape is an index, not an
  // animation: it must be still while a user reads or selects a dataset.
  simulation.tick(260);
  node.attr(
    'transform',
    d => `translate(${clamp(d.x ?? 0, 40, width - 40)},${clamp(d.y ?? 0, 30, height - 46)})`,
  );
  simulation = null;
}

export function stopGraph(): void {
  simulation?.stop();
  simulation = null;
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

function seeded(value: string, salt: number): number {
  let hash = 2166136261 ^ salt;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) / 4294967295;
}

function fill(match: DatasetMatch): string {
  switch (match.evidenceClass) {
    case 'direct':
      return '#2d5b49';
    case 'supporting':
      return '#7fa694';
    default:
      return match.relevance.score >= 30 ? '#c0c8c2' : '#dcdad3';
  }
}
