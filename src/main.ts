import * as d3 from 'd3';
import './styles.css';
import { openCatalogue } from './data/catalogue';
import { parseUseCaseIntent } from './intent';
import { buildEvidencePlan } from './evidence';
import { rankDatasets } from './relevance';
import { analyseWorkspace, type WorkspaceAnalysis } from './workspace';
import { GeoJsonExecutionEngine } from './execution/engine';
import { OdsGeoJsonSource } from './execution/source';
import { planOperation } from './execution/operations';
import type { ExecutionResult } from './execution/types';
import { BENCHMARK_USE_CASES } from './benchmarks/useCases';
import { canCompose, catalogueStatus, filterCatalogue, type CatalogueView } from './catalogue-ui';
import { renderGraph, resetAtlasZoom, stopGraph, zoomAtlasIn, zoomAtlasOut, zoomAtlasTo, type AtlasGraphActions } from './ui/graph';
import { ATLAS_LENS_LABEL, buildAtlasHierarchy, type AtlasHierarchyDatum, type AtlasLens, type AtlasState } from './atlas';
import { recommendRepresentations, type RepresentationSpec, type RepresentationType } from './representation';
import { resolveTrustedEvidence } from './evidence-sources/resolver';
import { providerById, resourceById } from './evidence-sources/registry';
import type { EvidenceResolution } from './evidence-sources/types';
import { escapeHtml, provenanceTag } from './ui/dom';
import {
  renderDatasetDetail,
  renderCatalogueRows,
  renderEvidenceSummary,
  renderEvidencePlan,
  renderIntentSection,
  renderMatches,
  renderRelationships,
  renderSourceNotice,
  renderSourceDiagnostics,
  section,
} from './ui/panels';
import type {
  CatalogState,
  CatalogueAdapter,
  DatasetMatch,
  DatasetStructure,
  EvidencePlan,
  UseCaseIntent,
} from './types';

const DEFAULT_QUERY = BENCHMARK_USE_CASES[0].prompt;

const app = document.querySelector<HTMLDivElement>('#app')!;

type Stage = 'discover' | 'compose';

let adapter: CatalogueAdapter;
let catalog: CatalogState;
let query = DEFAULT_QUERY;
let intent: UseCaseIntent = parseUseCaseIntent(query);
let plan: EvidencePlan;
let matches: DatasetMatch[] = [];
const workspace = new Set<string>();
let selectedId: string | null = null;
let topicFilter = 'all';
let catalogueView: CatalogueView = 'landscape';
let catalogueQuery = '';
let atlas: AtlasState = { lens: 'topic', path: [] };
let atlasFocusId = 'lens:topic';
let atlasRoot: AtlasHierarchyDatum | null = null;
let geoOnly = false;
let temporalOnly = false;
let stage: Stage = 'discover';
let analysis: WorkspaceAnalysis | null = null;
let analysing = false;
/** Bumped on every workspace change so a stale in-flight analysis is discarded. */
let analysisToken = 0;
const structures = new Map<string, DatasetStructure>();
let inspectorOpen = false;
/** Execution results keyed by the assessment they validated. */
const executions = new Map<string, ExecutionResult>();
const executing = new Set<string>();
let engine: GeoJsonExecutionEngine | null = null;
let selectedRepresentationType: RepresentationType | null = null;

app.innerHTML = `
<div class="app">
  <header class="header">
    <div class="brand">
      <div class="logo">DF</div><h1>DataFit</h1>
      <div class="brand-meta">Basel-Stadt Open Data</div>
    </div>
    <div class="header-right">
      <button class="source-pill" id="sourcePill" aria-label="Show catalogue source diagnostics">Loading catalogue…</button>
      <button class="small-btn inspector-toggle" id="inspectorToggle" aria-expanded="false">Panel</button>
    </div>
  </header>
  <div class="shell">
    <nav class="rail">
      <button class="rail-btn active" id="stageDiscover"><span class="rail-icon">⌕</span><span>Discover</span></button>
      <button class="rail-btn" id="stageCompose" title="Build from the evidence plan"><span class="rail-icon">⌘</span><span>Build</span></button>
      <button class="rail-btn" disabled title="Milestone 5"><span class="rail-icon">▣</span><span>Materialize</span></button>
      <div class="rail-spacer"></div>
      <button class="rail-btn" id="legendBtn" title="What the provenance tags mean"><span class="rail-icon">?</span></button>
    </nav>
    <main class="main">
      <div class="canvas-toolbar">
        <div><strong id="stageTitle">Catalogue</strong> · <span id="datasetCount">0 datasets</span></div>
        <div class="view-toggle" id="viewToggle"><button data-view="list">List</button><button data-view="landscape" class="active">Landscape</button></div>
      </div>
      <div class="evidence-summary-wrap" id="evidenceSummary"></div>
      <div class="catalogue-controls" id="catalogueControls">
        <input id="catalogueSearch" type="search" placeholder="Search title, keyword, dataset id or publisher" aria-label="Search the full catalogue">
        <select id="topicSelect" aria-label="Filter catalogue by topic"><option value="all">All topics</option></select>
        <label><input id="geoOnly" type="checkbox"> Geospatial</label><label><input id="temporalOnly" type="checkbox"> Temporal</label>
      </div>
      <div class="catalogue-list" id="catalogueList"></div>
      <div class="viz-wrap" id="vizWrap">
        <div class="atlas-nav">
          <div class="atlas-lenses" id="atlasLenses" aria-label="Atlas lens"><button data-lens="topic" class="active">Topic</button><button data-lens="space">Space</button><button data-lens="time">Time</button><button data-lens="readiness">Readiness</button></div>
          <nav class="atlas-breadcrumb" id="atlasBreadcrumb" aria-label="Atlas breadcrumb"></nav>
          <div class="landscape-info"><b id="landscapeCount">Atlas categories</b><span id="landscapeTotal">all loaded datasets</span></div>
        </div>
        <div class="atlas-zoom-controls" aria-label="Atlas zoom controls"><button id="atlasZoomIn" aria-label="Zoom in">+</button><button id="atlasZoomOut" aria-label="Zoom out">−</button><button id="atlasZoomReset">Reset</button></div>
        <div class="viz-scroll"><svg class="viz" id="viz" aria-label="Hierarchical catalogue Atlas"></svg></div>
      </div>
      <div class="workbench" id="workbench" hidden></div>
      <div class="prompt-dock">
        <form class="prompt" id="promptForm">
          <input id="promptInput" value="${escapeHtml(DEFAULT_QUERY)}" aria-label="Describe what you want to understand or build"/>
          <button class="send" type="submit">Find evidence</button>
        </form>
        <details class="examples-menu"><summary>Try an example question</summary><div class="examples" id="examples"></div></details>
      </div>
    </main>
    <aside class="inspector" id="inspector">
      <h2 id="inspectorTitle">Discover</h2>
      <div class="sub" id="inspectorSub">Evidence shortlist and dataset detail</div>
      <div id="inspectorBody"></div>
    </aside>
  </div>
</div>`;

const inspectorBody = el<HTMLDivElement>('#inspectorBody');
const inspectorEl = el<HTMLElement>('#inspector');
const sourcePill = el<HTMLSpanElement>('#sourcePill');
const datasetCount = el<HTMLSpanElement>('#datasetCount');
const stageTitle = el<HTMLElement>('#stageTitle');
const evidenceSummary = el<HTMLDivElement>('#evidenceSummary');
const catalogueControls = el<HTMLDivElement>('#catalogueControls');
const catalogueList = el<HTMLDivElement>('#catalogueList');
const workbench = el<HTMLDivElement>('#workbench');
const vizWrap = el<HTMLDivElement>('#vizWrap');
const examples = el<HTMLDivElement>('#examples');
const composeBtn = el<HTMLButtonElement>('#stageCompose');
const discoverBtn = el<HTMLButtonElement>('#stageDiscover');
const svg = d3.select<SVGSVGElement, unknown>('#viz');

function el<T extends Element>(selector: string): T {
  return document.querySelector<T>(selector)!;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function activeMatches(): DatasetMatch[] {
  if (topicFilter === 'all') return matches;
  return matches.filter(
    match =>
      match.dataset.semantic.topics.includes(topicFilter) ||
      match.dataset.themes.some(theme => theme.toLowerCase().includes(topicFilter)),
  );
}

function filteredDatasets() {
  const filtered = filterCatalogue(catalog.datasets, { query: catalogueQuery, topic: topicFilter, geospatial: geoOnly, temporal: temporalOnly });
  const rank = new Map(matches.map((match, index) => [match.dataset.id, index]));
  return filtered.sort((a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER) || a.title.localeCompare(b.title));
}

function searchDatasetIds(): Set<string> {
  if (!catalogueQuery.trim()) return new Set(catalog.datasets.map(dataset => dataset.id));
  return new Set(filterCatalogue(catalog.datasets, { query: catalogueQuery, topic: 'all', geospatial: false, temporal: false }).map(dataset => dataset.id));
}

function renderAtlasBreadcrumb(): void {
  const breadcrumb = el<HTMLElement>('#atlasBreadcrumb');
  const parts = [`<button data-depth="0">${escapeHtml(ATLAS_LENS_LABEL[atlas.lens])}</button>`];
  atlas.path.forEach((label, index) => parts.push(`<span>›</span><button data-depth="${index + 1}" ${index === atlas.path.length - 1 ? 'aria-current="page"' : ''}>${escapeHtml(label)}</button>`));
  breadcrumb.innerHTML = parts.join('');
  breadcrumb.querySelectorAll<HTMLButtonElement>('button').forEach(button => button.addEventListener('click', () => {
    const depth = Number(button.dataset.depth);
    const targetPath = atlas.path.slice(0, depth);
    const target = findAtlasNode(atlasRoot, targetPath);
    if (target) zoomAtlasTo(target.id, atlasActions);
  }));
}

function findAtlasNode(root: AtlasHierarchyDatum | null, path: string[]): AtlasHierarchyDatum | null {
  let node = root;
  for (const label of path) node = node?.children?.find(child => child.label === label) ?? null;
  return node;
}

const atlasActions: AtlasGraphActions = {
  onFocus: (path, id) => { atlas = { lens: atlas.lens, path }; atlasFocusId = id; renderAtlasBreadcrumb(); },
  onSelect: selectDataset,
  onWorkspace: toggleWorkspace,
};

function renderAtlas(): void {
  const searchMatches = searchDatasetIds();
  atlasRoot = buildAtlasHierarchy(catalog.datasets, matches, atlas.lens, searchMatches);
  renderAtlasBreadcrumb();
  datasetCount.textContent = `${catalog.datasets.length} datasets in Atlas`;
  el<HTMLElement>('#landscapeCount').textContent = `${atlasRoot.children?.length ?? 0} ${ATLAS_LENS_LABEL[atlas.lens]} categories`;
  el<HTMLElement>('#landscapeTotal').textContent = catalogueQuery.trim() ? `${searchMatches.size} catalogue matches highlighted` : `${atlasRoot.total} datasets represented`;
  renderGraph(vizWrap, svg, { root: atlasRoot, matches, searchActive: Boolean(catalogueQuery.trim()) }, selectedId, workspace, atlasActions, atlasFocusId);
}

function renderFilters(): void {
  const topics = [...new Set(catalog.datasets.flatMap(dataset => dataset.semantic.topics))].sort().slice(0, 8);
  const select = el<HTMLSelectElement>('#topicSelect');
  select.innerHTML = ['all', ...topics].map(topic => `<option value="${escapeHtml(topic)}" ${topicFilter === topic ? 'selected' : ''}>${topic === 'all' ? 'All topics' : escapeHtml(topic)}</option>`).join('');
}

function renderExamples(): void {
  const demoIds = ['running', 'fountain_access', 'cycling_safety'];
  const demoWorkspaces: Record<string, string[]> = {
    running: ['100052', '100032'], // Trees ↔ cycle routes: executable nearest proposal, rejected at 50 m.
    fountain_access: ['100008', '100252'], // Fountains ↔ Tempo-30 zones: confirmed containment.
    cycling_safety: ['100213', '100032'], // Bike pumps ↔ cycle routes: rejected nearest proposal.
  };
  const demoSubtitles: Record<string, string> = {
    running: 'Explore roles, missing dependencies and mixed usefulness.',
    fountain_access: 'Validate a confirmed fountain-to-zone spatial join.',
    cycling_safety: 'See how plausible spatial evidence can fail execution.',
  };
  const demoLabels: Record<string, string> = { cycling_safety: 'Cycling comfort' };
  examples.innerHTML = BENCHMARK_USE_CASES.filter(useCase => demoIds.includes(useCase.id)).map(
    useCase => `<button class="example" data-id="${escapeHtml(useCase.id)}" data-prompt="${escapeHtml(useCase.prompt)}"><b>${escapeHtml(demoLabels[useCase.id] ?? useCase.label)}</b><span>${escapeHtml(demoSubtitles[useCase.id])}</span></button>`,
  ).join('');
  examples.querySelectorAll<HTMLButtonElement>('button').forEach(button =>
    button.addEventListener('click', () => {
      const prompt = button.dataset.prompt ?? '';
      workspace.clear();
      for (const id of demoWorkspaces[button.dataset.id ?? ''] ?? []) {
        if (catalog.datasets.some(dataset => dataset.id === id)) workspace.add(id);
      }
      el<HTMLInputElement>('#promptInput').value = prompt;
      applyQuery(prompt);
      if (canCompose(workspace.size)) setStage('compose');
    }),
  );
}

function renderInspector(): void {
  const selected = selectedId ? catalog.datasets.find(dataset => dataset.id === selectedId) : null;
  const selectedMatch = selected ? matches.find(match => match.dataset.id === selected.id) : undefined;
  const workspaceList = [...workspace]
    .map(id => catalog.datasets.find(dataset => dataset.id === id))
    .filter(Boolean);

  inspectorBody.innerHTML = `
    ${renderSourceNotice(catalog)}
    ${renderSourceDiagnostics(catalog)}
    ${section(
      'Workspace',
      workspaceList.length
        ? `<div class="workspace-heading"><b>Workspace · ${workspaceList.length}</b><button class="small-btn compose-now">Build with this evidence</button></div><ul class="workspace-list">${workspaceList
            .map(
              dataset =>
                `<li data-id="${escapeHtml(dataset!.id)}"><span>${escapeHtml(dataset!.title)}</span>
                 <button class="small-btn remove">Remove</button></li>`,
            )
            .join('')}</ul>`
        : '<div class="quiet">Workspace · 0. Build can start from the question; manually adding datasets is an expert override.</div>',
    )}
    ${renderIntentSection(intent)}
    ${selected ? renderDatasetDetail(selected, structures.get(selected.id), selectedMatch, plan) : ''}
    ${stage === 'discover' ? renderMatches(activeMatches().slice(0, 10), workspace, plan) : ''}
    `;

  inspectorBody.querySelectorAll<HTMLElement>('.card').forEach(card => {
    const id = card.dataset.id!;
    card.querySelector('.inspect')?.addEventListener('click', () => selectDataset(id));
    card.querySelector('.workspace')?.addEventListener('click', () => toggleWorkspace(id));
  });
  inspectorBody.querySelectorAll<HTMLElement>('.workspace-list li').forEach(item => {
    const id = item.dataset.id!;
    item.querySelector('span')?.addEventListener('click', () => selectDataset(id));
    item.querySelector('.remove')?.addEventListener('click', () => toggleWorkspace(id));
  });
  inspectorBody.querySelector<HTMLButtonElement>('.compose-now')?.addEventListener('click', () => setStage('compose'));
}

function renderWorkbench(): void {
  const datasets = [...workspace].map(id => catalog.datasets.find(d => d.id === id)!).filter(Boolean);
  const covered = plan.roles.filter(role => role.datasetId && workspace.has(role.datasetId)).length;
  const missing = plan.roles.filter(role => !role.datasetId).length;
  const possiblePairs = datasets.length * (datasets.length - 1) / 2;
  const latestExecution = [...executions.values()].at(-1);
  const recommendations = recommendRepresentations({ intent, plan, selected: datasets, analysis, executions });
  const evidenceResolution = resolveTrustedEvidence(plan, catalog.datasets);
  const selectedSpec = recommendations.find(spec => spec.type === selectedRepresentationType) ?? recommendations[0];
  selectedRepresentationType = selectedSpec.type;
  const executable = new Set<string>();
  for (const pair of analysis?.pairs ?? []) {
    const left = structures.get(pair.left.id);
    const right = structures.get(pair.right.id);
    if (left && right && planOperation(pair.assessment, left, right).ok) executable.add(pair.assessment.id);
  }
  const next = datasets.length === 0 ? 'Add datasets from Discover.'
    : datasets.length === 1 ? 'Add one more dataset to compare or combine.'
      : analysing ? 'Inspecting dataset structures and testing compatibility rules…'
        : !analysis ? 'Analyse compatibility to see how the selected datasets can work together.'
          : latestExecution?.status === 'confirmed' ? 'Validation confirmed the relationship. Use it as supported evidence for the question.'
            : latestExecution?.status === 'rejected' ? 'Validation rejected the relationship. Do not rely on it; inspect another proposal or add better evidence.'
              : latestExecution?.status === 'partial' ? 'Validation is partial. Review its limits before using the relationship.'
                : latestExecution?.status === 'failed' ? 'Validation failed technically. Review the caveats and retry when the source is available.'
            : 'Select a relationship to inspect or validate.';
  workbench.innerHTML = `
    ${renderBuildProposal(selectedSpec, recommendations, covered, plan.roles.length, missing, next, analysis, executable)}
    ${renderTrustedEvidence(evidenceResolution)}
    <div class="build-secondary"><details><summary>Technical evidence plan</summary>${renderEvidencePlan(plan, catalog.datasets, workspace)}</details>
    <details ${analysis ? 'open' : ''}><summary>Dataset relationships</summary>${renderRelationships(analysis, analysing, {
      results: executions,
      running: executing,
      available: engine !== null,
      executable,
      unavailableReason:
        'Execution needs live source geometry; the offline fallback snapshot cannot be executed against.',
    }, new Set(selectedSpec.requiredAssessmentIds))}</details>
    <details><summary>Provenance and full compatibility matrix</summary>${renderRelationships(analysis, analysing, { results: executions, running: executing, available: false, executable: new Set(), unavailableReason: 'Validation actions are shown in the focused relationship section above.' })}</details></div>
    ${
      datasets.length < 2
        ? '<div class="notice">Two or more datasets are needed before compatibility can be assessed.</div>'
        : ''
    }`;

  workbench.querySelectorAll<HTMLElement>('.role-dataset').forEach(row => {
    const id = row.dataset.id!;
    row.querySelector('.role-dataset-title')?.addEventListener('click', () => selectDataset(id));
    row.querySelector('.role-add')?.addEventListener('click', () => toggleWorkspace(id));
  });
  workbench.querySelectorAll<HTMLButtonElement>('.validate').forEach(button =>
    button.addEventListener('click', () => void validate(button.dataset.assessment!)),
  );
  workbench.querySelector<HTMLButtonElement>('.analyse-btn')?.addEventListener('click', () => void refreshAnalysis());
  workbench.querySelectorAll<HTMLButtonElement>('.representation-choice').forEach(button => button.addEventListener('click', () => { selectedRepresentationType = button.dataset.type as RepresentationType; renderWorkbench(); }));
  workbench.querySelector<HTMLButtonElement>('.validate-representation')?.addEventListener('click', () => void validateRepresentation(selectedSpec, executable));
}

function renderTrustedEvidence(resolution: EvidenceResolution): string {
  const local = resolution.roles.filter(role => role.localStatus !== 'missing');
  const external = [...resolution.roles.flatMap(role => role.candidates), ...resolution.supplemental]
    .filter((item, index, all) => all.findIndex(other => other.resourceId === item.resourceId && other.roleId === item.roleId) === index);
  const localRows = local.length ? local.map(role => {
    const dataset = catalog.datasets.find(item => item.id === role.localDatasetId);
    return `<li><span class="source-state ${role.localStatus === 'locally_available' ? 'ready' : 'weak'}">${role.localStatus === 'locally_available' ? '✓' : '△'}</span><b>${escapeHtml(role.label)}</b><span>${escapeHtml(dataset?.title ?? role.localReason)}</span></li>`;
  }).join('') : '<li><span class="source-state">—</span><span>No local role is resolved yet.</span></li>';
  const externalRows = external.length ? external.map(candidate => {
    const resource = resourceById(candidate.resourceId)!;
    const provider = providerById(candidate.providerId)!;
    const status = candidate.status.replace('_', ' ');
    return `<li><span class="source-state candidate">+</span><div><b>${escapeHtml(resource.label)}</b><span>${escapeHtml(provider.label)} · national · ${escapeHtml(status)} · not validated</span><small>Fills: ${escapeHtml(candidate.roleId.replaceAll('_', ' '))}</small><p>${escapeHtml(candidate.reason)}</p><details><summary>Technical source details</summary><p>Access: ${escapeHtml(resource.accessType)} · ${escapeHtml(resource.formats.join(', '))}</p><p>${escapeHtml(resource.notes.join(' '))}</p><a href="${escapeHtml(resource.catalogueUrl)}" target="_blank" rel="noreferrer">Official source</a></details></div></li>`;
  }).join('') : '<li><span class="source-state">—</span><span>No national gap-fill is needed.</span></li>';
  const missingRows = resolution.unresolved.length
    ? resolution.unresolved.map(role => `<li><span class="source-state missing">×</span><b>${escapeHtml(role.label)}</b><span>${escapeHtml(role.localReason)}</span></li>`).join('')
    : '<li><span class="source-state ready">✓</span><span>No unresolved roles without a known source.</span></li>';
  return `<section class="trusted-evidence"><div><span class="eyebrow">Local Basel evidence</span><ul>${localRows}</ul></div><div><span class="eyebrow">Swiss public data · proposed gap-fill</span><ul>${externalRows}</ul></div><div><span class="eyebrow">Still missing</span><ul>${missingRows}</ul></div></section>`;
}

function renderBuildProposal(spec: RepresentationSpec, recommendations: RepresentationSpec[], covered: number, totalRoles: number, missing: number, next: string, currentAnalysis: WorkspaceAnalysis | null, executable: Set<string>): string {
  const useRows = spec.inputs.map(input => `<li class="input-${input.status}"><span>${input.status === 'selected' ? '✓' : input.status === 'available' ? '△' : '✕'}</span>${escapeHtml(input.label)}${input.status === 'available' ? ' · available, not selected' : input.status === 'external' ? ' · external' : ''}</li>`).join('');
  const needsValidation = spec.requiredAssessmentIds.filter(id => !executions.has(id));
  return `<section class="build-proposal">
    <div class="build-kicker">Build · proposed view</div><div class="build-question">${escapeHtml(query)}</div>
    <div class="build-proposal-grid"><div><span class="eyebrow">What DataFit proposes</span><h2>${escapeHtml(spec.title)}</h2><p>${escapeHtml(spec.method)}</p></div>
      <div><span class="eyebrow">Evidence</span><strong>${covered} / ${totalRoles} needs covered</strong><span>${missing} missing or external</span></div>
      <div><span class="eyebrow">Needs validation</span><strong>${needsValidation.length} data relationships</strong><span>${escapeHtml(next)}</span></div></div>
    <div class="proposed-preview"><div><span class="eyebrow">Proposed view</span><h3>${escapeHtml(spec.title)}</h3><ul>${useRows}</ul></div><div class="preview-placeholder"><span>${escapeHtml(spec.type.replaceAll('_', ' '))}</span><small>Structural preview · no analytical result claimed</small></div></div>
    ${recommendations.length > 1 ? `<div class="representation-options"><span>Other suitable outputs</span>${recommendations.map(item => `<button class="representation-choice ${item.type === spec.type ? 'active' : ''}" data-type="${item.type}">${escapeHtml(item.title)}</button>`).join('')}</div>` : ''}
    <div class="build-action"><span>${escapeHtml(next)}</span>${!currentAnalysis && workspace.size >= 2 ? '<button class="analyse-btn">Check data fit</button>' : needsValidation.some(id => executable.has(id)) ? '<button class="validate-representation">Validate required relationships</button>' : ''}</div>
  </section>`;
}

async function validateRepresentation(spec: RepresentationSpec, executable: Set<string>): Promise<void> {
  for (const id of spec.requiredAssessmentIds) if (executable.has(id) && !executions.has(id)) await validate(id);
}

/**
 * Run the operation an assessment justifies, against real geometry.
 *
 * The result is stored beside the assessment, never merged into it: the
 * proposal and the execution that tested it must both stay readable.
 */
async function validate(assessmentId: string): Promise<void> {
  const pair = analysis?.pairs.find(item => item.assessment.id === assessmentId);
  if (!pair || !engine || executing.has(assessmentId)) return;

  const left = structures.get(pair.left.id);
  const right = structures.get(pair.right.id);
  if (!left || !right) return;

  const plan = planOperation(pair.assessment, left, right);
  if (!plan.ok) {
    workbench
      .querySelector(`.validate[data-assessment="${CSS.escape(assessmentId)}"]`)
      ?.closest('.exec')
      ?.insertAdjacentHTML('beforeend', `<div class="quiet">${escapeHtml(plan.reason)}</div>`);
    return;
  }

  executing.add(assessmentId);
  renderWorkbench();
  try {
    executions.set(assessmentId, await engine.execute(plan.operation));
  } finally {
    executing.delete(assessmentId);
    renderWorkbench();
  }
}

function render(): void {
  matches = rankDatasets(intent, catalog.datasets, { plan });
  datasetCount.textContent = `${catalog.datasets.length} datasets`;
  composeBtn.disabled = false;
  composeBtn.classList.toggle('active', stage === 'compose');
  discoverBtn.classList.toggle('active', stage === 'discover');
  stageTitle.textContent = stage === 'discover' ? 'Basel-Stadt dataset catalogue' : 'Build';
  el<HTMLElement>('#inspectorTitle').textContent = stage === 'discover' ? 'Discover' : 'Build';
  el<HTMLElement>('#inspectorSub').textContent =
    stage === 'discover' ? 'Evidence shortlist and dataset detail' : 'Selected evidence and its structure';

  const discovering = stage === 'discover';
  document.querySelector('.shell')?.classList.toggle('compose-mode', !discovering);
  const listView = discovering && catalogueView === 'list';
  vizWrap.hidden = !discovering || catalogueView !== 'landscape';
  catalogueList.hidden = !listView;
  catalogueControls.hidden = !discovering;
  catalogueControls.classList.toggle('atlas-search-only', catalogueView === 'landscape');
  evidenceSummary.hidden = !discovering;
  el<HTMLElement>('#viewToggle').hidden = !discovering;
  workbench.hidden = stage !== 'compose';

  renderFilters();
  el<HTMLInputElement>('#catalogueSearch').placeholder = catalogueView === 'landscape'
    ? 'Search the catalogue within the Atlas'
    : 'Search title, keyword, dataset id or publisher';
  evidenceSummary.innerHTML = renderEvidenceSummary(plan, catalog.datasets);
  renderInspector();
  if (listView) {
    stopGraph();
    const visible = filteredDatasets();
    datasetCount.textContent = `${visible.length} of ${catalog.datasets.length} datasets`;
    catalogueList.innerHTML = `<div class="catalogue-head"><span>Dataset</span><span>ID</span><span>Publisher</span><span>Topics</span><span>Records</span><span>Signals</span><span>Modified</span><span>Evidence</span><span></span></div>${renderCatalogueRows(visible, matches, workspace)}`;
    catalogueList.querySelectorAll<HTMLElement>('.catalogue-row').forEach(row => {
      row.querySelector('.catalogue-open')?.addEventListener('click', () => selectDataset(row.dataset.id!));
      row.querySelector('.row-workspace')?.addEventListener('click', () => toggleWorkspace(row.dataset.id!));
    });
  } else if (stage === 'discover') {
    renderAtlas();
  }
  else {
    stopGraph();
    renderWorkbench();
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function applyQuery(next: string): void {
  query = next.trim() || DEFAULT_QUERY;
  intent = parseUseCaseIntent(query);
  plan = buildEvidencePlan(intent, catalog.datasets, { selectedIds: [...workspace] });
  selectedId = null;
  render();
}

function selectDataset(id: string): void {
  selectedId = id;
  inspectorOpen = true;
  syncInspector();
  render();
  void loadStructure(id);
}

/** Structure inspection is lazy: it only runs for a dataset the user opened. */
async function loadStructure(id: string): Promise<void> {
  if (structures.has(id)) return;
  try {
    const structure = await adapter.inspectDataset(id, { sample: true });
    structures.set(id, structure);
    if (selectedId === id) render();
  } catch (error) {
    const dataset = catalog.datasets.find(item => item.id === id);
    if (dataset && selectedId === id) {
      inspectorBody.insertAdjacentHTML(
        'beforeend',
        `<div class="warning">Structure inspection failed: ${escapeHtml(
          error instanceof Error ? error.message : 'unknown error',
        )}</div>`,
      );
    }
  }
}

function toggleWorkspace(id: string): void {
  if (workspace.has(id)) workspace.delete(id);
  else workspace.add(id);
  plan = buildEvidencePlan(intent, catalog.datasets, { selectedIds: [...workspace] });
  analysis = null;
  render();
}

async function refreshAnalysis(): Promise<void> {
  const datasets = [...workspace].map(id => catalog.datasets.find(dataset => dataset.id === id)!).filter(Boolean);
  if (datasets.length < 2) {
    analysis = null;
    analysing = false;
    if (stage === 'compose') renderWorkbench();
    return;
  }

  const token = ++analysisToken;
  analysing = true;
  if (stage === 'compose') renderWorkbench();

  try {
    const result = await analyseWorkspace(adapter, datasets);
    if (token !== analysisToken) return;
    analysis = result;
    for (const entry of result.entries) if (entry.structure) structures.set(entry.dataset.id, entry.structure);
  } finally {
    if (token === analysisToken) {
      analysing = false;
      if (stage === 'compose') renderWorkbench();
    }
  }
}

function setStage(next: Stage): void {
  stage = next;
  render();
}

/**
 * Below the desktop breakpoint the inspector is an overlay. It used to be
 * permanently on top of the canvas with no way to dismiss it.
 */
function syncInspector(): void {
  inspectorEl.classList.toggle('open', inspectorOpen);
  el<HTMLButtonElement>('#inspectorToggle').setAttribute('aria-expanded', String(inspectorOpen));
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

el<HTMLFormElement>('#promptForm').addEventListener('submit', event => {
  event.preventDefault();
  applyQuery(el<HTMLInputElement>('#promptInput').value);
});
el<HTMLInputElement>('#catalogueSearch').addEventListener('input', event => { catalogueQuery = (event.currentTarget as HTMLInputElement).value; render(); });
el<HTMLSelectElement>('#topicSelect').addEventListener('change', event => { topicFilter = (event.currentTarget as HTMLSelectElement).value; render(); });
el<HTMLInputElement>('#geoOnly').addEventListener('change', event => { geoOnly = (event.currentTarget as HTMLInputElement).checked; render(); });
el<HTMLInputElement>('#temporalOnly').addEventListener('change', event => { temporalOnly = (event.currentTarget as HTMLInputElement).checked; render(); });
el<HTMLElement>('#viewToggle').querySelectorAll<HTMLButtonElement>('button').forEach(button => button.addEventListener('click', () => {
  catalogueView = button.dataset.view as CatalogueView;
  el<HTMLElement>('#viewToggle').querySelectorAll('button').forEach(item => item.classList.toggle('active', item === button));
  render();
}));
el<HTMLElement>('#atlasLenses').querySelectorAll<HTMLButtonElement>('button').forEach(button => button.addEventListener('click', () => {
  atlas = { lens: button.dataset.lens as AtlasLens, path: [] };
  atlasFocusId = `lens:${atlas.lens}`;
  el<HTMLElement>('#atlasLenses').querySelectorAll('button').forEach(item => item.classList.toggle('active', item === button));
  render();
}));
el<HTMLButtonElement>('#atlasZoomIn').addEventListener('click', zoomAtlasIn);
el<HTMLButtonElement>('#atlasZoomOut').addEventListener('click', () => zoomAtlasOut(atlasActions));
el<HTMLButtonElement>('#atlasZoomReset').addEventListener('click', () => resetAtlasZoom(atlasActions));
discoverBtn.addEventListener('click', () => setStage('discover'));
composeBtn.addEventListener('click', () => setStage('compose'));
el<HTMLButtonElement>('#inspectorToggle').addEventListener('click', () => {
  inspectorOpen = !inspectorOpen;
  syncInspector();
});
el<HTMLButtonElement>('#legendBtn').addEventListener('click', () => {
  inspectorOpen = true;
  syncInspector();
  inspectorBody.insertAdjacentHTML(
    'afterbegin',
    section(
      'How to read provenance',
      `<div class="legend">
        <div>${provenanceTag('source')} published by the data owner.</div>
        <div>${provenanceTag('schema')} read from the dataset schema.</div>
        <div>${provenanceTag('sample')} observed in stored records.</div>
        <div>${provenanceTag('system')} inferred deterministically here — a proposal.</div>
        <div>${provenanceTag('ai')} reserved; no model output is used in this build.</div>
      </div>`,
    ),
  );
});
sourcePill.addEventListener('click', () => { inspectorOpen = true; syncInspector(); inspectorBody.querySelector('.source-diagnostics')?.scrollIntoView({ behavior: 'smooth' }); });

// Resize re-runs the layout; debounce so a drag does not start dozens of
// simulations.
let resizeTimer: number | undefined;
window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    if (stage === 'discover' && catalogueView === 'landscape') renderAtlas();
  }, 150);
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

const session = await openCatalogue();
adapter = session.adapter;
catalog = session.state;
plan = buildEvidencePlan(intent, catalog.datasets, { selectedIds: [] });
sourcePill.textContent = catalogueStatus(catalog).label;
sourcePill.classList.toggle('live', catalog.source === 'live');
sourcePill.title =
  catalog.source === 'live'
    ? `Loaded from ${adapter.label} at ${catalog.loadedAt}`
    : `Live loading failed: ${catalog.error ?? 'unknown error'}`;
// Execution needs live geometry; the frozen snapshot has none, so in fallback
// mode the engine stays null and the UI says why rather than offering a button
// that cannot work.
if (catalog.source === 'live') {
  engine = new GeoJsonExecutionEngine(
    new OdsGeoJsonSource(new Map(catalog.datasets.map(dataset => [dataset.id, dataset.recordsCount]))),
  );
}
renderExamples();
render();
