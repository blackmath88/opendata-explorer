import type { DatasetRecord, EvidencePlan, UseCaseIntent } from './types';
import type { ExecutionResult } from './execution/types';
import type { WorkspaceAnalysis } from './workspace';

export type RepresentationType =
  | 'point_map'
  | 'choropleth'
  | 'relationship_map'
  | 'route_comparison'
  | 'ranked_bar'
  | 'time_series'
  | 'comparison_cards'
  | 'evidence_brief';

export interface RepresentationInput {
  datasetId?: string;
  roleId: string;
  label: string;
  status: 'selected' | 'available' | 'missing' | 'external';
}

export interface RepresentationSpec {
  id: string;
  type: RepresentationType;
  title: string;
  method: string;
  inputs: RepresentationInput[];
  requiredAssessmentIds: string[];
  validationState: 'proposed' | 'partially_validated' | 'validated' | 'rejected';
}

export function recommendRepresentations(options: {
  intent: UseCaseIntent;
  plan: EvidencePlan;
  selected: DatasetRecord[];
  analysis: WorkspaceAnalysis | null;
  executions: Map<string, ExecutionResult>;
}): RepresentationSpec[] {
  const { intent, plan, selected, analysis, executions } = options;
  const selectedIds = new Set(selected.map(dataset => dataset.id));
  const inputs: RepresentationInput[] = plan.roles.map(role => ({
    datasetId: role.datasetId,
    roleId: role.id,
    label: role.label,
    status: role.datasetId ? (selectedIds.has(role.datasetId) ? 'selected' : 'available') : role.gap?.kind === 'not_in_catalogue' ? 'external' : 'missing',
  }));
  const statement = intent.statement.toLocaleLowerCase();
  const hasLines = selected.some(dataset => dataset.characteristics.geometryTypes.some(type => /line/i.test(type)));
  const hasPoints = selected.some(dataset => dataset.characteristics.geometryTypes.some(type => /point/i.test(type)));
  const hasPolygons = selected.some(dataset => dataset.characteristics.geometryTypes.some(type => /polygon|surface/i.test(type)));
  const hasTime = selected.some(dataset => dataset.characteristics.timeSeries || dataset.characteristics.temporalCoverage.length);
  const specs: Array<Omit<RepresentationSpec, 'inputs' | 'requiredAssessmentIds' | 'validationState' | 'id'>> = [];

  if (/route|running|cycling|walking|comfort/.test(statement) && hasLines) specs.push({ type: 'route_comparison', title: 'Interactive route-comparison map', method: 'Score candidate routes using the selected environmental, access and mobility evidence.' });
  if ((hasLines && (hasPoints || hasPolygons)) || (hasPoints && hasPolygons)) specs.push({ type: 'relationship_map', title: 'Evidence relationship map', method: 'Show selected spatial evidence together and state whether the proposed relationship survived validation.' });
  if (hasPolygons && (/count|per area|district|zone|neighbou?rhood/.test(statement) || hasPoints)) {
    specs.push({ type: 'choropleth', title: 'Area comparison map', method: 'Aggregate evidence into comparable areas and shade them by the resulting measure.' });
    specs.push({ type: 'ranked_bar', title: 'Ranked area comparison', method: 'Rank areas using the same validated aggregate used by the map.' });
  }
  if (hasTime) specs.push({ type: 'time_series', title: 'Change over time', method: 'Plot a quantitative measure over the available temporal coverage.' });
  if (!specs.length && hasPoints) specs.push({ type: 'point_map', title: 'Interactive location map', method: 'Display selected locations and inspect their published attributes.' });
  if (!specs.length) specs.push({ type: selected.length > 1 ? 'comparison_cards' : 'evidence_brief', title: selected.length > 1 ? 'Dataset comparison' : 'Evidence brief', method: 'Summarise available evidence, gaps and provenance without claiming an analytical result.' });

  return unique(specs).map((spec, index) => {
    const requiredAssessmentIds = relevantAssessments(spec.type, analysis);
    const results = requiredAssessmentIds.map(id => executions.get(id)).filter((result): result is ExecutionResult => Boolean(result));
    const validationState = results.some(result => result.status === 'rejected') ? 'rejected'
      : requiredAssessmentIds.length && results.length === requiredAssessmentIds.length && results.every(result => result.status === 'confirmed') ? 'validated'
        : results.length ? 'partially_validated' : 'proposed';
    return { ...spec, id: `representation-${spec.type}-${index}`, inputs, requiredAssessmentIds, validationState };
  });
}

function relevantAssessments(type: RepresentationType, analysis: WorkspaceAnalysis | null): string[] {
  if (!analysis || ['evidence_brief', 'comparison_cards', 'point_map', 'time_series'].includes(type)) return [];
  return analysis.pairs.filter(pair => pair.assessment.relation !== 'incompatible' && pair.assessment.relation !== 'unknown').map(pair => pair.assessment.id);
}

function unique<T extends { type: RepresentationType }>(items: T[]): T[] {
  return items.filter((item, index) => items.findIndex(candidate => candidate.type === item.type) === index);
}
