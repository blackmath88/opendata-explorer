import { assessCompatibility } from '../compatibility';
import { openCatalogue } from '../data/catalogue';
import { FallbackCatalogueAdapter, fallbackDatasets } from '../data/fallback';
import { buildEvidencePlan } from '../evidence';
import { resolveTrustedEvidence } from '../evidence-sources/resolver';
import { GeoJsonExecutionEngine } from '../execution/engine';
import { planOperation } from '../execution/operations';
import { FixtureGeometrySource, OdsGeoJsonSource } from '../execution/source';
import type { ExecutionEngine, ExecutionResult, GeoJsonFeature, GeometrySource } from '../execution/types';
import { canonicalJson, hashString } from '../fingerprint';
import { parseUseCaseIntent } from '../intent';
import { rankDatasets } from '../relevance';
import { recommendRepresentations, type RepresentationSpec, type RepresentationType } from '../representation';
import { observationsFromExecutions, renderRepresentation, type PreviewLayer, type RepresentationResult } from '../renderers';
import type { CatalogState, CatalogueAdapter, CompatibilityAssessment, DatasetStructure, EvidencePlan } from '../types';
import type { PairAssessment, WorkspaceAnalysis } from '../workspace';

interface StoredAssessment { assessment: CompatibilityAssessment; left: DatasetStructure; right: DatasetStructure; }

/** Shared application service used by MCP; every analytical step delegates to the same functions as the web UI. */
export class DataFitOrchestrator {
  private plans = new Map<string, EvidencePlan>();
  private inspections = new Map<string, DatasetStructure>();
  private assessments = new Map<string, StoredAssessment>();
  private executions = new Map<string, ExecutionResult>();

  constructor(readonly catalog: CatalogState, private readonly adapter: CatalogueAdapter,
    private readonly geometrySource?: GeometrySource, private readonly engine?: ExecutionEngine) {}

  searchDatasets(query: string, limit = 10) {
    const intent = parseUseCaseIntent(query);
    const plan = buildEvidencePlan(intent, this.catalog.datasets);
    return rankDatasets(intent, this.catalog.datasets, { plan }).slice(0, Math.max(1, Math.min(limit, 50))).map(match => ({
      datasetId: match.dataset.id, title: match.dataset.title, provider: match.dataset.publisher,
      relevance: match.relevance, evidenceClass: match.evidenceClass, roleIds: match.roleIds,
      scope: 'local' as const, sourceUrl: match.dataset.sourceUrl,
      availability: match.dataset.hasRecords ? 'records_available' : 'metadata_only',
    }));
  }

  buildPlan(question: string) {
    const plan = buildEvidencePlan(parseUseCaseIntent(question), this.catalog.datasets);
    const planId = `PLN-${hashString(canonicalJson({ question, roles: plan.roles.map(role => ({ id: role.id, datasetId: role.datasetId })) }))}`;
    this.plans.set(planId, plan);
    return { planId, plan };
  }

  resolveEvidence(input: { planId?: string; question?: string }) {
    const plan = input.planId ? this.plans.get(input.planId) : undefined;
    if (input.planId && !plan) throw new Error(`Unknown plan ${input.planId}; supply the question or call build_evidence_plan first.`);
    const built = plan ? { planId: input.planId!, plan } : this.buildPlan(input.question ?? '');
    return { ...built, resolution: resolveTrustedEvidence(built.plan, this.catalog.datasets) };
  }

  async inspectDataset(datasetId: string, sample = false) {
    const dataset = this.catalog.datasets.find(item => item.id === datasetId);
    if (!dataset) throw new Error(`Unknown dataset ${datasetId}`);
    const structure = await this.adapter.inspectDataset(datasetId, { sample });
    this.inspections.set(datasetId, structure);
    return { dataset: { id: dataset.id, title: dataset.title, publisher: dataset.publisher, sourceUrl: dataset.sourceUrl }, structure };
  }

  async checkCompatibility(leftDatasetId: string, rightDatasetId: string) {
    const [left, right] = await Promise.all([this.structure(leftDatasetId), this.structure(rightDatasetId)]);
    const assessment = assessCompatibility(left, right);
    this.assessments.set(assessment.id, { assessment, left, right });
    return { assessment, executable: planOperation(assessment, left, right).ok,
      execution: this.executions.get(assessment.id) };
  }

  async validateRelationship(assessmentId: string) {
    const stored = this.assessments.get(assessmentId);
    if (!stored) throw new Error(`Unknown assessment ${assessmentId}; call assess_compatibility first in this session.`);
    if (!this.engine) throw new Error('Execution is unavailable in offline snapshot mode. Start with DATAFIT_LIVE=1 or use mcp:demo.');
    const planned = planOperation(stored.assessment, stored.left, stored.right);
    if (!planned.ok) throw new Error(planned.reason);
    const result = await this.engine.execute(planned.operation);
    this.executions.set(assessmentId, result);
    return { operation: planned.operation, result };
  }

  suggestRepresentations(question: string, selectedDatasetIds: string[]) {
    const { planId, plan } = this.buildPlan(question);
    return { planId, specifications: recommendRepresentations({ intent: plan.intent, plan,
      selected: this.datasets(selectedDatasetIds), analysis: this.analysisFor(selectedDatasetIds), executions: this.executions }) };
  }

  async buildResult(question: string, selectedDatasetIds: string[], requestedType?: RepresentationType): Promise<{ spec: RepresentationSpec; result: RepresentationResult }> {
    const { plan } = this.buildPlan(question);
    const selected = this.datasets(selectedDatasetIds);
    const analysis = this.analysisFor(selectedDatasetIds);
    const specs = recommendRepresentations({ intent: plan.intent, plan, selected, analysis, executions: this.executions });
    const spec = specs.find(item => item.type === requestedType) ?? specs[0];
    if (!spec) throw new Error('No representation could be recommended.');
    let layers: PreviewLayer[] | undefined;
    if (this.geometrySource && (spec.type === 'point_map' || spec.type === 'relationship_map')) {
      layers = await Promise.all(selected.filter(dataset => dataset.characteristics.geospatial).slice(0, 4).map(async dataset => {
        const loaded = await this.geometrySource!.load(dataset.id, { maxFeatures: 500 });
        return { id: `preview-${dataset.id}`, label: dataset.title, datasetId: dataset.id,
          sourceUrl: loaded.sourceUrl ?? dataset.sourceUrl, scope: 'local' as const, features: loaded.features, truncated: loaded.truncated };
      }));
    }
    const result = renderRepresentation({ spec, intent: plan.intent, plan, datasets: selected,
      trusted: resolveTrustedEvidence(plan, this.catalog.datasets), analysis, executions: this.executions,
      layers, observations: observationsFromExecutions(spec.type, this.executions) });
    return { spec, result };
  }

  stateSummary() {
    return { catalogueSource: this.catalog.source, plans: this.plans.size, inspections: this.inspections.size,
      assessments: this.assessments.size, executions: this.executions.size, persistence: 'in_memory' as const };
  }

  private async structure(datasetId: string) {
    return this.inspections.get(datasetId) ?? (await this.inspectDataset(datasetId)).structure;
  }

  private datasets(ids: string[]) {
    const requested = new Set(ids);
    return this.catalog.datasets.filter(dataset => requested.has(dataset.id));
  }

  private analysisFor(ids: string[]): WorkspaceAnalysis | null {
    const selected = new Set(ids);
    const pairs: PairAssessment[] = [...this.assessments.values()].filter(item => selected.has(item.assessment.leftDatasetId) && selected.has(item.assessment.rightDatasetId)).map(item => ({
      left: this.catalog.datasets.find(dataset => dataset.id === item.assessment.leftDatasetId)!,
      right: this.catalog.datasets.find(dataset => dataset.id === item.assessment.rightDatasetId)!, assessment: item.assessment,
    })).filter(pair => pair.left && pair.right);
    return pairs.length ? { entries: ids.map(id => ({ dataset: this.catalog.datasets.find(dataset => dataset.id === id)!, structure: this.inspections.get(id) })).filter(entry => entry.dataset), pairs, notes: [] } : null;
  }
}

export async function createDataFitOrchestrator(options: { live?: boolean; fixtureGeometry?: Record<string, GeoJsonFeature[]> } = {}) {
  if (options.fixtureGeometry) {
    const adapter = new FallbackCatalogueAdapter();
    const source = new FixtureGeometrySource(options.fixtureGeometry);
    return new DataFitOrchestrator(fallbackState('Deterministic offline fixture mode.'), adapter, source, new GeoJsonExecutionEngine(source));
  }
  if (options.live) {
    const session = await openCatalogue();
    if (session.state.source !== 'live') return new DataFitOrchestrator(session.state, session.adapter);
    const source = new OdsGeoJsonSource(new Map(session.state.datasets.map(dataset => [dataset.id, dataset.recordsCount])));
    return new DataFitOrchestrator(session.state, session.adapter, source, new GeoJsonExecutionEngine(source));
  }
  const adapter = new FallbackCatalogueAdapter();
  return new DataFitOrchestrator(fallbackState('Offline catalogue snapshot; execution disabled.'), adapter);
}

const fallbackState = (note: string): CatalogState => ({ source: 'fallback', loadedAt: '2026-09-04T00:00:00.000Z', datasets: fallbackDatasets, notes: [note] });
