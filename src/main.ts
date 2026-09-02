import * as d3 from 'd3';
import './styles.css';
import { inspectBaselDataset, loadBaselCatalog } from './data/basel-client';
import { rankDatasets } from './relevance';
import { parseUseCaseIntent } from './intent';
import { buildEvidencePlan } from './evidence';
import { assessWorkspaceCompatibility } from './compatibility';
import type { CatalogState, DatasetMatch, DatasetStructure } from './types';

const app = document.querySelector<HTMLDivElement>('#app')!;
const DEFAULT_QUERY = 'I want to build a running route planner that prefers shade and clean air, avoids heavy traffic, shows fountains and warns about construction.';

let catalog: CatalogState;
let query = DEFAULT_QUERY;
let matches: DatasetMatch[] = [];
let workspace = new Set<string>();
let selectedId: string | null = null;
let topicFilter = 'all';
let structures = new Map<string, DatasetStructure>();
let structureErrors = new Map<string, string>();
let inspecting = new Set<string>();

app.innerHTML = `
<div class="app">
  <header class="header">
    <div class="brand"><div class="logo">DF</div><h1>DataFit</h1><div class="brand-meta">Basel-Stadt Open Data</div></div>
    <div class="header-right"><span class="source-pill" id="sourcePill">Loading catalogue…</span></div>
  </header>
  <div class="shell">
    <nav class="rail">
      <button class="rail-btn active"><span class="rail-icon">⌕</span><span>Discover</span></button>
      <button class="rail-btn" disabled title="Unlocks after compatibility substrate"><span class="rail-icon">⌘</span><span>Compose</span></button>
      <button class="rail-btn" disabled title="Later milestone"><span class="rail-icon">▣</span><span>Materialize</span></button>
      <div class="rail-spacer"></div>
      <button class="rail-btn" disabled><span class="rail-icon">?</span></button>
    </nav>
    <main class="main">
      <div class="canvas-toolbar"><div><strong>Semantic landscape</strong> · <span id="datasetCount">0 datasets</span></div><div class="filters" id="filters"></div></div>
      <div class="viz-wrap"><svg class="viz" id="viz" aria-label="Dataset landscape"></svg></div>
      <div class="prompt-dock"><form class="prompt" id="promptForm"><input id="promptInput" value="${DEFAULT_QUERY.replaceAll('"','&quot;')}" aria-label="Describe your data goal"/><button class="send" type="submit">Find data</button></form></div>
    </main>
    <aside class="inspector"><h2>Discover</h2><div class="sub">Intent · evidence · validation</div><div id="inspector"></div></aside>
  </div>
</div>`;

const inspector = document.querySelector<HTMLDivElement>('#inspector')!;
const sourcePill = document.querySelector<HTMLSpanElement>('#sourcePill')!;
const datasetCount = document.querySelector<HTMLSpanElement>('#datasetCount')!;
const filters = document.querySelector<HTMLDivElement>('#filters')!;
const svg = d3.select<SVGSVGElement, unknown>('#viz');

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]!));
}
function activeMatches(): DatasetMatch[] {
  if (topicFilter === 'all') return matches;
  return matches.filter(m => m.dataset.semantic.topics.includes(topicFilter) || m.dataset.themes.some(t => t.toLowerCase().includes(topicFilter)));
}
function renderFilters() {
  const topics = [...new Set(catalog.datasets.flatMap(d => d.semantic.topics))].sort().slice(0, 8);
  filters.innerHTML = ['all', ...topics].map(t => `<button class="filter ${topicFilter===t?'active':''}" data-topic="${escapeHtml(t)}">${t==='all'?'All':escapeHtml(t)}</button>`).join('');
  filters.querySelectorAll<HTMLButtonElement>('button').forEach(button => button.addEventListener('click', () => {
    topicFilter = button.dataset.topic ?? 'all'; render();
  }));
}

async function inspectStructure(id:string) {
  if (structures.has(id) || inspecting.has(id)) return;
  inspecting.add(id); structureErrors.delete(id); renderInspector();
  try { structures.set(id, await inspectBaselDataset(id)); }
  catch(error) { structureErrors.set(id,error instanceof Error?error.message:'Structure inspection failed'); }
  finally { inspecting.delete(id); renderInspector(); }
}

function structureHtml(id:string):string {
  if(inspecting.has(id)) return '<div class="reason">Inspecting bounded sample…</div>';
  if(structureErrors.has(id)) return `<div class="warning">${escapeHtml(structureErrors.get(id)!)}</div>`;
  const s=structures.get(id); if(!s) return '';
  const fields=s.fields.slice(0,10).map(f=>`${escapeHtml(f.name)}${f.type?` <span class="card-meta">${escapeHtml(f.type)}</span>`:''}`).join('<br>');
  return `<div class="reason"><b>Observed structure</b> · ${escapeHtml(s.observedFrom.replaceAll('_',' '))}<br>${s.geometry?`Geometry: ${escapeHtml(s.geometry.type)}<br>`:''}${s.temporal?`Temporal fields: ${s.temporal.fields.map(escapeHtml).join(', ')}<br>`:''}${s.candidateKeys.length?`Candidate keys: ${s.candidateKeys.map(escapeHtml).join(', ')}<br>`:''}<br>${fields || 'No sample fields observed.'}</div>`;
}

function renderInspector() {
  const top = activeMatches().slice(0, 8);
  const selected = selectedId ? catalog.datasets.find(d => d.id === selectedId) : null;
  const intent=parseUseCaseIntent(query);
  const plan=buildEvidencePlan(intent,matches.slice(0,40));
  const selectedStructures=[...workspace].map(id=>structures.get(id)).filter((s):s is DatasetStructure=>Boolean(s));
  const assessments=selectedStructures.length>1?assessWorkspaceCompatibility(selectedStructures):[];

  inspector.innerHTML = `
    <section class="section"><div class="section-title">Use-case intent <span class="card-meta">deterministic</span></div>
      <div class="dataset-detail"><b>${escapeHtml(intent.desiredOutcome ?? 'Explore relevant evidence')}</b><br>${intent.spatialNeed?'Spatial need · ':''}${intent.temporalNeed?`${escapeHtml(intent.temporalNeed)} time need · `:''}${intent.geographicScope?escapeHtml(intent.geographicScope):'scope not explicit'}</div>
      <div class="signals">${intent.domainHints.map(s=>`<span class="signal"># ${escapeHtml(s)}</span>`).join('') || '<span class="signal"># general</span>'}</div>
    </section>
    <section class="section"><div class="section-title">Evidence plan <span class="card-meta">inferred, not validated</span></div>
      ${plan.map(role=>`<div class="match-row"><b>${escapeHtml(role.label)}</b> · <span class="card-meta">${escapeHtml(role.roleType.replaceAll('_',' '))}</span><br><span class="card-meta">${role.datasetId?`dataset ${escapeHtml(role.datasetId)}`:'unresolved'} · ${escapeHtml(role.evidenceClass)}</span><div class="reason">${escapeHtml(role.reason)}</div></div>`).join('')}
    </section>
    ${catalog.source==='fallback'?`<div class="warning section">Live catalogue loading failed (${escapeHtml(catalog.error ?? 'unknown error')}). Showing representative fallback data; structure inspection may fail while offline.</div>`:''}
    ${selected ? `<section class="section"><div class="section-title">Dataset detail</div><div class="dataset-detail"><b>${escapeHtml(selected.title)}</b><br>${escapeHtml(selected.id)} · ${escapeHtml(selected.publisher || 'Publisher not supplied')}<br><br>${escapeHtml(selected.description || 'No description supplied')}<br><br>${selected.characteristics.geospatial?'Spatial · ':''}${selected.characteristics.timeSeries?'Time series · ':''}${selected.characteristics.realtime?'Live / sensor-like':''}<br><br><a href="${selected.sourceUrl}" target="_blank" rel="noreferrer">Open source dataset ↗</a><div class="card-actions"><button class="small-btn inspect-structure" data-id="${escapeHtml(selected.id)}">${structures.has(selected.id)?'Structure observed':inspecting.has(selected.id)?'Inspecting…':'Inspect structure'}</button></div>${structureHtml(selected.id)}</div></section>` : ''}
    <section class="section"><div class="section-title">Top dataset matches</div>${top.map(m => `
      <article class="card" data-id="${escapeHtml(m.dataset.id)}"><div class="card-top"><div><div class="card-title">${escapeHtml(m.dataset.title)}</div><div class="card-meta">${escapeHtml(m.dataset.id)} · ${escapeHtml(m.dataset.publisher || 'Basel-Stadt')}</div></div><span class="match">${m.relevance.score}% match</span></div><p>${escapeHtml(m.dataset.description || m.dataset.semantic.summary || 'No catalogue description supplied.')}</p><div class="reason">${escapeHtml(m.relevance.explanation)}</div><div class="card-actions"><button class="small-btn inspect">Inspect</button><button class="small-btn workspace ${workspace.has(m.dataset.id)?'added':''}">${workspace.has(m.dataset.id)?'Added':'Add'}</button></div></article>`).join('') || '<div class="dataset-detail">No matches in this filter.</div>'}</section>
    <section class="section"><div class="section-title">Evidence workspace</div><div class="workspace-count">${workspace.size} datasets selected</div>
      ${[...workspace].map(id=>{const d=catalog.datasets.find(x=>x.id===id);return d?`<div class="match-row"><b>${escapeHtml(d.title)}</b><br><span class="card-meta">${escapeHtml(id)}</span><div class="card-actions"><button class="small-btn inspect-workspace" data-id="${escapeHtml(id)}">${structures.has(id)?'Observed':inspecting.has(id)?'Inspecting…':'Inspect structure'}</button></div>${structureHtml(id)}</div>`:''}).join('')}
    </section>
    ${assessments.length?`<section class="section"><div class="section-title">Compatibility <span class="card-meta">candidate assessment</span></div>${assessments.map(a=>`<div class="match-row"><b>${escapeHtml(a.leftDatasetId)} ↔ ${escapeHtml(a.rightDatasetId)}</b><br><span class="match">${escapeHtml(a.relation.replaceAll('_',' '))} · ${escapeHtml(a.confidence)}</span><div class="reason">${a.reasons.map(escapeHtml).join(' ')} ${a.warnings.map(w=>`⚠ ${escapeHtml(w)}`).join(' ')}</div></div>`).join('')}</section>`:''}`;

  inspector.querySelectorAll<HTMLElement>('.card').forEach(card => {
    const id = card.dataset.id!;
    card.querySelector('.inspect')?.addEventListener('click', () => { selectedId = id; render(); });
    card.querySelector('.workspace')?.addEventListener('click', () => { workspace.has(id) ? workspace.delete(id) : workspace.add(id); render(); });
  });
  inspector.querySelectorAll<HTMLButtonElement>('.inspect-structure,.inspect-workspace').forEach(button=>button.addEventListener('click',()=>void inspectStructure(button.dataset.id!)));
}

function renderGraph() {
  const data = activeMatches().slice(0, 80);
  const rect = (document.querySelector('.viz-wrap') as HTMLElement).getBoundingClientRect();
  const width = Math.max(600, rect.width); const height = Math.max(420, rect.height);
  svg.attr('viewBox', `0 0 ${width} ${height}`); svg.selectAll('*').remove();
  if (!data.length) { svg.append('text').attr('x', 30).attr('y', 50).attr('class','empty-note').text('No datasets match this filter.'); return; }
  const nodes = data.map((m,i) => ({...m, x: width/2 + Math.cos(i)*100, y:height/2 + Math.sin(i)*100}));
  const topicCenters = new Map<string,{x:number,y:number}>();
  const topics = [...new Set(nodes.map(n=>n.dataset.semantic.topics[0] || n.dataset.themes[0]?.toLowerCase() || 'other'))];
  topics.forEach((t,i)=>{const a=(i/topics.length)*Math.PI*2;topicCenters.set(t,{x:width/2+Math.cos(a)*width*.23,y:height/2+Math.sin(a)*height*.22});});
  const simulation = d3.forceSimulation(nodes as any).force('x', d3.forceX<any>(d=>topicCenters.get(d.dataset.semantic.topics[0] || d.dataset.themes[0]?.toLowerCase() || 'other')?.x ?? width/2).strength(.18)).force('y', d3.forceY<any>(d=>topicCenters.get(d.dataset.semantic.topics[0] || d.dataset.themes[0]?.toLowerCase() || 'other')?.y ?? height/2).strength(.18)).force('charge', d3.forceManyBody().strength(-55)).force('collide', d3.forceCollide<any>(d=>12 + Math.max(8,d.relevance.score*.16) + 18));
  const group = svg.append('g');
  const node = group.selectAll<SVGGElement, any>('g').data(nodes).enter().append('g').attr('class',d=>`node ${selectedId===d.dataset.id?'selected':''}`).style('cursor','pointer').on('click',(_,d)=>{selectedId=d.dataset.id;render();});
  node.append('circle').attr('r',d=>12+Math.max(6,d.relevance.score*.14)).attr('fill',d=>d.relevance.score>=60?'#2d5b49':d.relevance.score>=30?'#8a5f2d':'#c8c6c5');
  node.append('text').attr('class','node-label').attr('y',d=>34+Math.max(6,d.relevance.score*.14)).text(d=>d.dataset.title.length>27?d.dataset.title.slice(0,26)+'…':d.dataset.title);
  node.append('text').attr('class','node-sub').attr('y',d=>46+Math.max(6,d.relevance.score*.14)).text(d=>`${d.relevance.score}% · ${d.dataset.id}`);
  simulation.on('tick',()=>node.attr('transform',d=>`translate(${Math.max(35,Math.min(width-35,d.x))},${Math.max(35,Math.min(height-55,d.y))})`));
}
function render() { matches = rankDatasets(query, catalog.datasets); datasetCount.textContent = `${catalog.datasets.length} datasets`; renderFilters(); renderInspector(); renderGraph(); }

document.querySelector<HTMLFormElement>('#promptForm')!.addEventListener('submit', event => { event.preventDefault(); query = document.querySelector<HTMLInputElement>('#promptInput')!.value.trim(); selectedId = null; structures.clear(); structureErrors.clear(); render(); });
window.addEventListener('resize', () => renderGraph());
catalog = await loadBaselCatalog();
sourcePill.textContent = catalog.source === 'live' ? `Live catalogue · ${catalog.datasets.length}` : `Fallback catalogue · ${catalog.datasets.length}`;
sourcePill.classList.toggle('live', catalog.source === 'live');
render();
