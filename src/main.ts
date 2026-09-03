import * as d3 from 'd3';
import './styles.css';
import './atlas.css';
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
import { buildAtlasIndex, catalogueSearch, datasetsForBucket, recentlyModified, type AtlasIndex, type AtlasLens } from './atlas';
import { renderAtlasBuckets } from './ui/atlas';
import { renderCatalogueList, renderEvidenceSummary, renderRecent, renderViewControls } from './ui/catalogue';
import { escapeHtml, provenanceTag } from './ui/dom';
import {
  renderDatasetDetail,
  renderEvidencePlan,
  renderIntentSection,
  renderMatches,
  renderRelationships,
  renderSourceNotice,
  section,
} from './ui/panels';
import type {
  CatalogState,
  CatalogueAdapter,
  DatasetMatch,
  DatasetRecord,
  DatasetStructure,
  EvidencePlan,
  UseCaseIntent,
} from './types';

const DEFAULT_QUERY = BENCHMARK_USE_CASES[0].prompt;
const app = document.querySelector<HTMLDivElement>('#app')!;

type Stage = 'discover' | 'compose';
type DiscoverView = 'list' | 'atlas';

let adapter: CatalogueAdapter;
let catalog: CatalogState;
let atlasIndex: AtlasIndex;
let query = DEFAULT_QUERY;
let intent: UseCaseIntent = parseUseCaseIntent(query);
let plan: EvidencePlan;
let matches: DatasetMatch[] = [];
const workspace = new Set<string>();
let selectedId: string | null = null;
let stage: Stage = 'discover';
let discoverView: DiscoverView = 'list';
let atlasLens: AtlasLens = 'topic';
let atlasBucket: string | null = null;
let catalogueQuery = '';
let analysis: WorkspaceAnalysis | null = null;
let analysing = false;
let analysisToken = 0;
const structures = new Map<string, DatasetStructure>();
let inspectorOpen = false;
const executions = new Map<string, ExecutionResult>();
const executing = new Set<string>();
let engine: GeoJsonExecutionEngine | null = null;

app.innerHTML = `
<div class="app">
  <header class="header">
    <div class="brand">
      <div class="logo">DF</div><h1>DataFit</h1>
      <div class="brand-meta">Basel-Stadt Open Data</div>
    </div>
    <div class="header-right">
      <span class="source-pill" id="sourcePill">Loading catalogue…</span>
      <button class="small-btn inspector-toggle" id="inspectorToggle" aria-expanded="false">Panel</button>
    </div>
  </header>
  <div class="shell">
    <nav class="rail">
      <button class="rail-btn active" id="stageDiscover"><span class="rail-icon">⌕</span><span>Discover</span></button>
      <button class="rail-btn" id="stageCompose" disabled title="Add at least two datasets to the workspace"><span class="rail-icon">⌘</span><span>Compose</span></button>
      <button class="rail-btn" disabled title="Later milestone"><span class="rail-icon">▣</span><span>Materialize</span></button>
      <div class="rail-spacer"></div>
      <button class="rail-btn" id="legendBtn" title="What the provenance tags mean"><span class="rail-icon">?</span></button>
    </nav>
    <main class="main">
      <div class="canvas-toolbar">
        <div><strong id="stageTitle">Catalogue</strong> · <span id="datasetCount">0 datasets</span></div>
        <div id="discoverControls"></div>
      </div>
      <div class="catalogue-search-wrap" id="catalogueSearchWrap">
        <input id="catalogueSearch" type="search" placeholder="Search all datasets by title, id, publisher, keyword…" aria-label="Search catalogue" />
        <span class="catalogue-search-count" id="catalogueSearchCount"></span>
      </div>
      <div id="evidenceSummary"></div>
      <div class="viz-wrap atlas-wrap" id="vizWrap" hidden><svg class="viz" id="viz" aria-label="Open data atlas"></svg></div>
      <div class="catalogue-list-wrap" id="catalogueList"></div>
      <div class="workbench" id="workbench" hidden></div>
      <div class="prompt-dock">
        <form class="prompt" id="promptForm">
          <input id="promptInput" value="${escapeHtml(DEFAULT_QUERY)}" aria-label="Describe what you want to understand or build"/>
          <button class="send" type="submit">Find evidence</button>
        </form>
        <div class="examples" id="examples"></div>
      </div>
    </main>
    <aside class="inspector" id="inspector">
      <h2 id="inspectorTitle">Discover</h2>
      <div class="sub" id="inspectorSub">Catalogue, evidence and dataset detail</div>
      <div id="inspectorBody"></div>
    </aside>
  </div>
</div>`;

const inspectorBody = el<HTMLDivElement>('#inspectorBody');
const inspectorEl = el<HTMLElement>('#inspector');
const sourcePill = el<HTMLSpanElement>('#sourcePill');
const datasetCount = el<HTMLSpanElement>('#datasetCount');
const stageTitle = el<HTMLElement>('#stageTitle');
const discoverControls = el<HTMLDivElement>('#discoverControls');
const workbench = el<HTMLDivElement>('#workbench');
const vizWrap = el<HTMLDivElement>('#vizWrap');
const catalogueList = el<HTMLDivElement>('#catalogueList');
const evidenceSummary = el<HTMLDivElement>('#evidenceSummary');
const catalogueSearchWrap = el<HTMLDivElement>('#catalogueSearchWrap');
const catalogueSearchInput = el<HTMLInputElement>('#catalogueSearch');
const catalogueSearchCount = el<HTMLSpanElement>('#catalogueSearchCount');
const examples = el<HTMLDivElement>('#examples');
const composeBtn = el<HTMLButtonElement>('#stageCompose');
const discoverBtn = el<HTMLButtonElement>('#stageDiscover');
const svg = d3.select<SVGSVGElement, unknown>('#viz');

function el<T extends Element>(selector: string): T {
  return document.querySelector<T>(selector)!;
}

function renderExamples(): void {
  const demo = BENCHMARK_USE_CASES.filter(useCase => ['Running comfort', 'Public fountain access', 'Cycling safety / comfort'].includes(useCase.label));
  const visible = demo.length >= 3 ? demo : BENCHMARK_USE_CASES.slice(0, 3);
  examples.innerHTML = visible
    .map(useCase => `<button class="example" data-prompt="${escapeHtml(useCase.prompt)}">${escapeHtml(useCase.label)}</button>`)
    .join('');
  examples.querySelectorAll<HTMLButtonElement>('button').forEach(button =>
    button.addEventListener('click', () => {
      const prompt = button.dataset.prompt ?? '';
      el<HTMLInputElement>('#promptInput').value = prompt;
      applyQuery(prompt);
    }),
  );
}

function discoverDatasets(): DatasetRecord[] {
  let datasets = catalogueSearch(catalog.datasets, catalogueQuery);
  if (discoverView === 'atlas' && atlasBucket) datasets = datasetsForBucket(atlasIndex, datasets, atlasLens, atlasBucket);
  return datasets;
}

function renderDiscoverControls(): void {
  discoverControls.innerHTML = renderViewControls(discoverView, atlasLens, atlasIndex.buckets[atlasLens], atlasBucket);
  discoverControls.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button =>
    button.addEventListener('click', () => {
      discoverView = button.dataset.view as DiscoverView;
      atlasBucket = null;
      render();
    }),
  );
  discoverControls.querySelectorAll<HTMLButtonElement>('[data-lens]').forEach(button =>
    button.addEventListener('click', () => {
      atlasLens = button.dataset.lens as AtlasLens;
      atlasBucket = null;
      render();
    }),
  );
  discoverControls.querySelector<HTMLSelectElement>('#bucketSelect')?.addEventListener('change', event => {
    atlasBucket = (event.target as HTMLSelectElement).value || null;
    render();
  });
}

function renderInspector(): void {
  const selected = selectedId ? catalog.datasets.find(dataset => dataset.id === selectedId) : null;
  const workspaceList = [...workspace].map(id => catalog.datasets.find(dataset => dataset.id === id)).filter(Boolean);
  const recent = recentlyModified(catalog.datasets, 5);

  inspectorBody.innerHTML = `
    ${renderSourceNotice(catalog)}
    ${section(
      `Workspace · ${workspaceList.length}`,
      workspaceList.length
        ? `<ul class="workspace-list">${workspaceList
            .map(dataset => `<li data-id="${escapeHtml(dataset!.id)}"><span>${escapeHtml(dataset!.title)}</span><button class="small-btn remove">Remove</button></li>`)
            .join('')}</ul><button class="small-btn compose-cta" ${workspaceList.length < 2 ? 'disabled' : ''}>Compose evidence</button>`
        : '<div class="quiet">Add datasets from the catalogue or evidence shortlist. Two are needed for Compose.</div>',
    )}
    ${renderIntentSection(intent)}
    ${selected ? renderDatasetDetail(selected, structures.get(selected.id)) : stage === 'discover' ? renderRecent(recent) : ''}
    ${stage === 'discover' ? renderMatches(matches.slice(0, 10), workspace, plan) : ''}
  `;

  inspectorBody.querySelectorAll<HTMLElement>('.card').forEach(card => {
    const id = card.dataset.id!;
    card.querySelector('.inspect')?.addEventListener('click', () => selectDataset(id));
    card.querySelector('.workspace')?.addEventListener('click', () => toggleWorkspace(id));
  });
  inspectorBody.querySelectorAll<HTMLButtonElement>('.inspect[data-id]').forEach(button =>
    button.addEventListener('click', () => selectDataset(button.dataset.id!)),
  );
  inspectorBody.querySelectorAll<HTMLElement>('.workspace-list li').forEach(item => {
    const id = item.dataset.id!;
    item.querySelector('span')?.addEventListener('click', () => selectDataset(id));
    item.querySelector('.remove')?.addEventListener('click', () => toggleWorkspace(id));
  });
  inspectorBody.querySelector<HTMLButtonElement>('.compose-cta')?.addEventListener('click', () => setStage('compose'));
}

function wireCatalogueRows(): void {
  catalogueList.querySelectorAll<HTMLButtonElement>('.inspect[data-id]').forEach(button =>
    button.addEventListener('click', () => selectDataset(button.dataset.id!)),
  );
  catalogueList.querySelectorAll<HTMLButtonElement>('.workspace[data-id]').forEach(button =>
    button.addEventListener('click', () => toggleWorkspace(button.dataset.id!)),
  );
}

function renderDiscoverSurface(): void {
  renderDiscoverControls();
  const datasets = discoverDatasets();
  catalogueSearchCount.textContent = `${datasets.length} of ${catalog.datasets.length}`;
  evidenceSummary.innerHTML = renderEvidenceSummary(intent, plan, matches);
  catalogueSearchWrap.hidden = false;

  if (discoverView === 'list') {
    vizWrap.hidden = true;
    catalogueList.hidden = false;
    catalogueList.innerHTML = renderCatalogueList(datasets, matches, workspace, selectedId);
    wireCatalogueRows();
    stageTitle.textContent = 'Catalogue';
    return;
  }

  vizWrap.hidden = false;
  renderAtlasBuckets(vizWrap, svg, atlasIndex.buckets[atlasLens], atlasBucket, id => {
    atlasBucket = atlasBucket === id ? null : id;
    render();
  });
  stageTitle.textContent = `Atlas · ${atlasLens}`;
  if (atlasBucket || catalogueQuery) {
    catalogueList.hidden = false;
    catalogueList.innerHTML = renderCatalogueList(datasets, matches, workspace, selectedId);
    wireCatalogueRows();
  } else {
    catalogueList.hidden = true;
    catalogueList.innerHTML = '';
  }
}

function renderWorkbench(): void {
  const datasets = [...workspace].map(id => catalog.datasets.find(d => d.id === id)!).filter(Boolean);
  workbench.innerHTML = `
    ${renderEvidencePlan(plan, catalog.datasets, workspace)}
    ${renderRelationships(analysis, analysing, {
      results: executions,
      running: executing,
      available: engine !== null,
      unavailableReason: 'Execution needs live source geometry; the offline fallback snapshot cannot be executed against.',
    })}
    ${datasets.length < 2 ? '<div class="notice">Two or more datasets are needed before compatibility can be assessed.</div>' : ''}
  `;

  workbench.querySelectorAll<HTMLElement>('.role-dataset').forEach(row => {
    const id = row.dataset.id!;
    row.querySelector('.role-dataset-title')?.addEventListener('click', () => selectDataset(id));
    row.querySelector('.role-add')?.addEventListener('click', () => toggleWorkspace(id));
  });
  workbench.querySelectorAll<HTMLButtonElement>('.validate').forEach(button =>
    button.addEventListener('click', () => void validate(button.dataset.assessment!)),
  );
}

async function validate(assessmentId: string): Promise<void> {
  const pair = analysis?.pairs.find(item => item.assessment.id === assessmentId);
  if (!pair || !engine || executing.has(assessmentId)) return;
  const left = structures.get(pair.left.id);
  const right = structures.get(pair.right.id);
  if (!left || !right) return;
  const operationPlan = planOperation(pair.assessment, left, right);
  if (!operationPlan.ok) {
    workbench
      .querySelector(`.validate[data-assessment="${CSS.escape(assessmentId)}"]`)
      ?.closest('.exec')
      ?.insertAdjacentHTML('beforeend', `<div class="quiet">${escapeHtml(operationPlan.reason)}</div>`);
    return;
  }
  executing.add(assessmentId);
  renderWorkbench();
  try {
    executions.set(assessmentId, await engine.execute(operationPlan.operation));
  } finally {
    executing.delete(assessmentId);
    renderWorkbench();
  }
}

function render(): void {
  matches = rankDatasets(intent, catalog.datasets, { plan });
  const complete = catalog.reportedTotal !== undefined && catalog.datasets.length === catalog.reportedTotal;
  datasetCount.textContent = `${catalog.datasets.length}${catalog.reportedTotal ? ` / ${catalog.reportedTotal}` : ''} datasets${complete ? ' loaded' : ''}`;
  composeBtn.disabled = workspace.size < 2;
  composeBtn.classList.toggle('active', stage === 'compose');
  discoverBtn.classList.toggle('active', stage === 'discover');
  el<HTMLElement>('#inspectorTitle').textContent = stage === 'discover' ? 'Discover' : 'Compose';
  el<HTMLElement>('#inspectorSub').textContent = stage === 'discover' ? 'Catalogue, evidence and dataset detail' : 'Selected evidence, compatibility and validation';

  if (stage === 'discover') {
    workbench.hidden = true;
    renderDiscoverSurface();
  } else {
    catalogueSearchWrap.hidden = true;
    evidenceSummary.innerHTML = '';
    discoverControls.innerHTML = '';
    vizWrap.hidden = true;
    catalogueList.hidden = true;
    workbench.hidden = false;
    stageTitle.textContent = 'Evidence workbench';
    renderWorkbench();
  }
  renderInspector();
}

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

async function loadStructure(id: string): Promise<void> {
  if (structures.has(id)) return;
  try {
    const structure = await adapter.inspectDataset(id, { sample: true });
    structures.set(id, structure);
    if (selectedId === id) render();
  } catch (error) {
    const dataset = catalog.datasets.find(item => item.id === id);
    if (dataset && selectedId === id) {
      inspectorBody.insertAdjacentHTML('beforeend', `<div class="warning">Structure inspection failed: ${escapeHtml(error instanceof Error ? error.message : 'unknown error')}</div>`);
    }
  }
}

function toggleWorkspace(id: string): void {
  if (workspace.has(id)) workspace.delete(id);
  else workspace.add(id);
  plan = buildEvidencePlan(intent, catalog.datasets, { selectedIds: [...workspace] });
  analysis = null;
  render();
  void refreshAnalysis();
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
  if (next === 'compose' && workspace.size < 2) return;
  stage = next;
  render();
  if (next === 'compose' && !analysis) void refreshAnalysis();
}

function syncInspector(): void {
  inspectorEl.classList.toggle('open', inspectorOpen);
  el<HTMLButtonElement>('#inspectorToggle').setAttribute('aria-expanded', String(inspectorOpen));
}

el<HTMLFormElement>('#promptForm').addEventListener('submit', event => {
  event.preventDefault();
  applyQuery(el<HTMLInputElement>('#promptInput').value);
});
catalogueSearchInput.addEventListener('input', () => {
  catalogueQuery = catalogueSearchInput.value;
  render();
});
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
      `<div class="legend"><div>${provenanceTag('source')} published by the data owner.</div><div>${provenanceTag('schema')} read from the dataset schema.</div><div>${provenanceTag('sample')} observed in stored records.</div><div>${provenanceTag('system')} inferred deterministically here — a proposal.</div><div>${provenanceTag('ai')} reserved; no model output is used in this build.</div></div>`,
    ),
  );
});

let resizeTimer: number | undefined;
window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    if (stage === 'discover' && discoverView === 'atlas') renderDiscoverSurface();
  }, 180);
});

const session = await openCatalogue();
adapter = session.adapter;
catalog = session.state;
atlasIndex = buildAtlasIndex(catalog.datasets);
plan = buildEvidencePlan(intent, catalog.datasets, { selectedIds: [] });
const complete = catalog.reportedTotal !== undefined && catalog.datasets.length === catalog.reportedTotal;
sourcePill.textContent =
  catalog.source === 'live'
    ? `LIVE · ${catalog.datasets.length}${catalog.reportedTotal ? `/${catalog.reportedTotal}` : ''}${complete ? ' complete' : ''}`
    : `FALLBACK · ${catalog.datasets.length} cached`;
sourcePill.classList.toggle('live', catalog.source === 'live');
sourcePill.title =
  catalog.source === 'live'
    ? `Loaded from ${adapter.label} at ${catalog.loadedAt}`
    : `Live loading failed: ${catalog.error ?? 'unknown error'}`;
if (catalog.source === 'live') {
  engine = new GeoJsonExecutionEngine(new OdsGeoJsonSource(new Map(catalog.datasets.map(dataset => [dataset.id, dataset.recordsCount]))));
}
renderExamples();
render();
