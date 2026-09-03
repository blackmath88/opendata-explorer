import * as d3 from 'd3';
import type { AtlasBucket } from '../atlas';

interface AtlasHierarchyDatum {
  bucket?: AtlasBucket;
  children?: AtlasHierarchyDatum[];
}

export function renderAtlasBuckets(
  container: HTMLElement,
  svgSelection: d3.Selection<SVGSVGElement, unknown, HTMLElement, unknown>,
  buckets: AtlasBucket[],
  selectedBucket: string | null,
  onSelect: (id: string) => void,
): void {
  const rect = container.getBoundingClientRect();
  const width = Math.max(480, rect.width);
  const height = Math.max(360, rect.height);
  svgSelection.attr('viewBox', `0 0 ${width} ${height}`);
  svgSelection.selectAll('*').remove();

  const active = buckets.filter(bucket => bucket.datasetIds.length > 0);
  if (!active.length) {
    svgSelection.append('text').attr('x', 24).attr('y', 42).attr('class', 'empty-note').text('No datasets in this atlas view.');
    return;
  }

  const rootData: AtlasHierarchyDatum = { children: active.map(bucket => ({ bucket })) };
  const root = d3
    .hierarchy<AtlasHierarchyDatum>(rootData, datum => datum.children)
    .sum(datum => datum.bucket?.datasetIds.length ?? 0);
  const packed = d3.pack<AtlasHierarchyDatum>().size([width - 28, height - 28]).padding(12)(root).leaves();
  const g = svgSelection.append('g').attr('transform', 'translate(14,14)');

  const node = g
    .selectAll<SVGGElement, d3.HierarchyCircularNode<AtlasHierarchyDatum>>('g')
    .data(packed)
    .enter()
    .append('g')
    .attr('class', d => `atlas-node ${selectedBucket === d.data.bucket?.id ? 'selected' : ''}`)
    .attr('transform', d => `translate(${d.x},${d.y})`)
    .style('cursor', 'pointer')
    .on('click', (_, d) => d.data.bucket && onSelect(d.data.bucket.id));

  node.append('circle').attr('r', d => d.r).attr('class', 'atlas-circle');
  node
    .append('text')
    .attr('class', 'atlas-label')
    .attr('text-anchor', 'middle')
    .attr('y', -5)
    .text(d => truncate(d.data.bucket?.label ?? '', Math.max(12, Math.floor(d.r / 4))));
  node
    .append('text')
    .attr('class', 'atlas-count')
    .attr('text-anchor', 'middle')
    .attr('y', 14)
    .text(d => `${d.data.bucket?.datasetIds.length ?? 0} datasets`);
  node.append('title').text(d => {
    const bucket = d.data.bucket;
    return bucket ? `${bucket.label} · ${bucket.datasetIds.length} datasets\n${bucket.description}` : '';
  });
}

const truncate = (value: string, max: number): string => (value.length <= max ? value : `${value.slice(0, Math.max(8, max - 1))}…`);
