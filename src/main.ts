import * as d3 from 'd3';
import './styles.css';
import { openCatalogue } from './data/catalogue';
import { parseUseCaseIntent } from './intent';
import { buildEvidencePlan } from './evidence';
import { rankDatasets } from './relevance';
import { analyseWorkspace, type WorkspaceAnalysis } from './workspace';
import { BENCHMARK_USE_CASES } from './benchmarks/useCases';
import { renderGraph, stopGraph } from './ui/graph';
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
let stage: Stage = 'discover';
let analysis: WorkspaceAnalysis | null = null;
let analysing = false;
/** Bumped on every workspace change so a stale in-flight analysis is discarded. */
let analysisToken = 0;
const structures = new Map<string, DatasetStructure>();
let inspectorOpen = false;

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
      <button class="rail-btn" id="stageCompose" disabled title="Add datasets to the workspace"><span class="rail-icon">⌘</span><span>Compose</span></button>
      <button class="rail-btn" disabled title="Milestone 5"><span class="rail-icon">▣</span><span>Materialize</span></button>
      <div class="rail-spacer"></div>
      <button class="rail-btn" id="legendBtn" title="What the provenance tags mean"><span class="rail-icon">?</span></button>
    </nav>
    <main class="main">
      <div class="canvas-toolbar">
        <div><strong id="stageTitle">Semantic landscape</strong> · <span id="datasetCount">0 datasets</span></div>
        <div class="filters" id="filters"></div>
      </div>
      <div class="viz-wrap" id="vizWrap"><svg class="viz" id="viz" aria-label="Dataset landscape"></svg></div>
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
const filters = el<HTMLDivElement>('#filters');
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

function renderFilters(): void {
  const topics = [...new Set(catalog.datasets.flatMap(dataset => dataset.semantic.topics))].sort().slice(0, 8);
  filters.innerHTML = ['all', ...topics]
    .map(
      topic =>
        `<button class="filter ${topicFilter === topic ? 'active' : ''}" data-topic="${escapeHtml(topic)}">${
          topic === 'all' ? 'All' : escapeHtml(topic)
        }</button>`,
    )
    .join('');
  filters.querySelectorAll<HTMLButtonElement>('button').forEach(button =>
    button.addEventListener('click', () => {
      topicFilter = button.dataset.topic ?? 'all';
      render();
    }),
  );
}

function renderExamples(): void {
  examples.innerHTML = BENCHMARK_USE_CASES.map(
    useCase => `<button class="example" data-prompt="${escapeHtml(useCase.prompt)}">${escapeHtml(useCase.label)}</button>`,
  ).join('');
  examples.querySelectorAll<HTMLButtonElement>('button').forEach(button =>
    button.addEventListener('click', () => {
      const prompt = button.dataset.prompt ?? '';
      el<HTMLInputElement>('#promptInput').value = prompt;
      applyQuery(prompt);
    }),
  );
}

function renderInspector(): void {
  const selected = selectedId ? catalog.datasets.find(dataset => dataset.id === selectedId) : null;
  const workspaceList = [...workspace]
    .map(id => catalog.datasets.find(dataset => dataset.id === id))
    .filter(Boolean);

  inspectorBody.innerHTML = `
    ${renderSourceNotice(catalog)}
    ${renderIntentSection(intent)}
    ${selected ? renderDatasetDetail(selected, structures.get(selected.id)) : ''}
    ${stage === 'discover' ? renderMatches(activeMatches().slice(0, 10), workspace, plan) : ''}
    ${section(
      'Workspace',
      workspaceList.length
        ? `<ul class="workspace-list">${workspaceList
            .map(
              dataset =>
                `<li data-id="${escapeHtml(dataset!.id)}"><span>${escapeHtml(dataset!.title)}</span>
                 <button class="small-btn remove">Remove</button></li>`,
            )
            .join('')}</ul>`
        : '<div class="quiet">No datasets selected. Add candidates from the shortlist or the evidence plan.</div>',
    )}`;

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
}

function renderWorkbench(): void {
  const datasets = [...workspace].map(id => catalog.datasets.find(d => d.id === id)!).filter(Boolean);
  workbench.innerHTML = `
    ${renderEvidencePlan(plan, catalog.datasets, workspace)}
    ${renderRelationships(analysis, analysing)}
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
}

function render(): void {
  matches = rankDatasets(intent, catalog.datasets, { plan });
  datasetCount.textContent = `${catalog.datasets.length} datasets`;
  composeBtn.disabled = workspace.size === 0;
  composeBtn.classList.toggle('active', stage === 'compose');
  discoverBtn.classList.toggle('active', stage === 'discover');
  stageTitle.textContent = stage === 'discover' ? 'Semantic landscape' : 'Evidence workbench';
  el<HTMLElement>('#inspectorTitle').textContent = stage === 'discover' ? 'Discover' : 'Compose';
  el<HTMLElement>('#inspectorSub').textContent =
    stage === 'discover' ? 'Evidence shortlist and dataset detail' : 'Selected evidence and its structure';

  vizWrap.hidden = stage !== 'discover';
  workbench.hidden = stage !== 'compose';
  filters.hidden = stage !== 'discover';

  renderFilters();
  renderInspector();
  if (stage === 'discover') renderGraph(vizWrap, svg, activeMatches(), selectedId, selectDataset);
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
  stage = next;
  render();
  if (next === 'compose' && !analysis) void refreshAnalysis();
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

// Resize re-runs the layout; debounce so a drag does not start dozens of
// simulations.
let resizeTimer: number | undefined;
window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    if (stage === 'discover') renderGraph(vizWrap, svg, activeMatches(), selectedId, selectDataset);
  }, 150);
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

const session = await openCatalogue();
adapter = session.adapter;
catalog = session.state;
plan = buildEvidencePlan(intent, catalog.datasets, { selectedIds: [] });
sourcePill.textContent =
  catalog.source === 'live'
    ? `Live catalogue · ${catalog.datasets.length}`
    : `Fallback snapshot · ${catalog.datasets.length}`;
sourcePill.classList.toggle('live', catalog.source === 'live');
sourcePill.title =
  catalog.source === 'live'
    ? `Loaded from ${adapter.label} at ${catalog.loadedAt}`
    : `Live loading failed: ${catalog.error ?? 'unknown error'}`;
renderExamples();
render();
