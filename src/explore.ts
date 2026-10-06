import './explore.css';
import { openCatalogue } from './data/catalogue';
import { activePortal, portalFromSearch, setActivePortal, PORTALS } from './portal';
import { escapeHtml, formatCount } from './ui/dom';
import { formatDeepLink, missingLinkNotice } from './deep-link';
import { atlasSegments } from './atlas';
import { catalogueStatus } from './catalogue-ui';
import {
  buildCatalogueNetwork, NETWORK_LENSES, networkColor, networkHash, networkPath,
  parseNetworkHash, searchNetwork, type CatalogueNetwork, type NetworkNode, type NetworkLink,
} from './network-navigation';
import type { CatalogState, DatasetRecord } from './types';
import type { ForceGraph3DInstance, NodeObject, LinkObject } from '3d-force-graph';
import type { Group, Mesh, MeshLambertMaterial, Sprite } from 'three';

setActivePortal(portalFromSearch(location.search));
const portal = activePortal();
const base = import.meta.env.BASE_URL;
const root = document.querySelector<HTMLDivElement>('#explorer')!;
let address = parseNetworkHash(location.hash);
let catalog: CatalogState | undefined;
let network: CatalogueNetwork | undefined;
let selected: DatasetRecord | undefined;
let flat = false;
let graph: ForceGraph3DInstance<NetworkNode & NodeObject, NetworkLink & LinkObject<NetworkNode & NodeObject>> | undefined;
let graphReady = false;
let graphFailed = false;
let focusedNodeId: string | undefined;
let hoverId: string | undefined;
let paintLabels: (() => void) | undefined;
let resize: ResizeObserver | undefined;
let fitFrame = 0;
let renderedLayout = '';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const duration = reducedMotion ? 0 : 650;
const objects = new Map<string, { group: Group; sphere: Mesh; label?: Sprite; material: MeshLambertMaterial }>();

root.innerHTML = `
  <header class="explore-header">
    <a class="explore-brand" href="${base}"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span><strong>DataFit</strong><span>Explore</span></a>
    <label class="global-search"><span aria-hidden="true">⌕</span><input id="search" type="search" placeholder="Find a dataset, a subject, a publisher…" aria-label="Search all loaded datasets"><kbd>/</kbd></label>
    <a id="workbench-link" class="workbench-link" href="${base}catalogue/?portal=${encodeURIComponent(portal.id)}">Evidence workbench ↗</a>
  </header>
  <div class="explore-shell">
    <aside class="browse-panel" aria-label="Catalogue navigation">
      <div class="browse-intro"><span class="eyebrow">OPEN DATA, CONNECTED</span><h1>Find your way<br>through the data.</h1><p>Follow a topic. Discover a dataset.<br>See what lies around it.</p></div>
      <label class="portal-label" for="portal">Catalogue</label><select id="portal">${PORTALS.map(p => `<option value="${escapeHtml(p.id)}" ${p.id === portal.id ? 'selected' : ''}>${escapeHtml(p.label)}</option>`).join('')}</select>
      <div class="browse-section-head"><h2 id="browse-heading">Topics</h2><button id="clear" class="text-button" hidden>Clear search</button></div>
      <div id="browse-list" class="browse-list"><p class="loading-copy">Reading the public catalogue…</p></div>
      <div class="source-block"><div id="source-status" role="status">Connecting to ${escapeHtml(portal.shortLabel)}…</div><details><summary>Source & coverage</summary><div id="source-details"></div></details><span class="unofficial">Independent prototype · public catalogue data</span></div>
    </aside>
    <main class="network-panel" id="network-panel">
      <div class="network-toolbar"><nav id="breadcrumbs" aria-label="Your location in the catalogue"></nav><div class="view-options"><button id="flat" aria-pressed="false" aria-label="Use a flat 2D layout">3D</button><button id="fit" title="Fit the current network in view">Fit view</button></div></div>
      <div class="lens-bar" role="group" aria-label="Group datasets by">${Object.entries(NETWORK_LENSES).map(([key, label]) => `<button data-lens="${key}">${label}</button>`).join('')}</div>
      <div class="network-title"><span class="eyebrow" id="scope-kicker">THE WHOLE CATALOGUE</span><h2 id="scope-title">A landscape of possibilities</h2><p id="scope-count">Every loaded dataset has a place.</p></div>
      <div id="graph" class="graph-canvas" role="img" aria-label="Interactive 3D catalogue. Equivalent navigation is available in the list."></div>
      <div id="graph-notice" class="graph-notice" hidden></div>
      <div id="hover-card" class="hover-card" hidden></div>
      <div class="network-footer"><span id="graph-key">● Small dots are datasets · larger hubs are groups</span><span>Drag to rotate · scroll to zoom · select to explore</span></div>
      <div class="network-disclaimer">Connections show catalogue grouping. Distance is a layout choice; it does not establish similarity or compatibility.</div>
    </main>
    <aside id="detail" class="detail-panel" aria-label="Dataset details" hidden></aside>
  </div>
  <div id="announcement" class="sr-only" aria-live="polite"></div>`;

function el<T extends HTMLElement = HTMLElement>(selector: string): T { return root.querySelector<T>(selector)!; }
const search = el<HTMLInputElement>('#search');
search.value = address.query;
const host = el('#graph');

function saveAddress(push = true): void {
  const hash = networkHash(address);
  if (location.hash !== hash) history[push ? 'pushState' : 'replaceState'](null, '', hash);
}
function announce(text: string): void { el('#announcement').textContent = text; }
function go(path: string[], push = true): void {
  address.path = path;
  address.dataset = undefined; selected = undefined; focusedNodeId = undefined;
  if (!graphFailed) el('#graph-notice').hidden = true;
  saveAddress(push); render(); fit();
}
function fit(): void {
  cancelAnimationFrame(fitFrame);
  fitFrame = requestAnimationFrame(() => graph?.zoomToFit(duration, 85));
}
function closeDetail(push = true): void {
  address.dataset = undefined; selected = undefined; focusedNodeId = undefined;
  if (!graphFailed) el('#graph-notice').hidden = true;
  saveAddress(push); renderDetail(); renderList(); paintLabels?.();
}
function selectDataset(id: string, reveal = false): void {
  const dataset = catalog?.datasets.find(item => item.id === id);
  if (!dataset) return;
  if (!graphFailed) el('#graph-notice').hidden = true;
  selected = dataset; address.dataset = id; focusedNodeId = `dataset:${id}`;
  if (reveal && !network?.includedIds.includes(id)) address.path = networkPath(dataset, address.lens).slice(0, 1);
  saveAddress(); render();
  const node = network?.nodes.find(item => item.datasetId === id);
  if (node) graph?.cameraPosition({ x: node.x, y: node.y + 15, z: node.z + 200 }, node, duration);
  announce(`Selected ${dataset.title}. Dataset details are open.`);
}
function shape(dataset: DatasetRecord): string { return atlasSegments(dataset, 'space')[0]; }
function safeSource(url: string): string | undefined {
  try { const parsed = new URL(url); return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : undefined; } catch { return undefined; }
}
function catalogueLink(id: string): string {
  return `${base}catalogue/?portal=${encodeURIComponent(portal.id)}${formatDeepLink({ dataset: id })}`;
}

function render(): void {
  if (!catalog) return;
  network = buildCatalogueNetwork(catalog.datasets, address, address.query, flat);
  const searching = Boolean(address.query.trim());
  const scope = address.path.at(-1);
  el('#scope-kicker').textContent = scope ? `${NETWORK_LENSES[address.lens].toUpperCase()} / ${address.path.length === 1 ? 'EXPLORE' : 'DATASETS'}` : 'THE WHOLE CATALOGUE';
  el('#scope-title').textContent = scope ?? 'A landscape of possibilities';
  el('#scope-count').textContent = `${network.datasets.length} datasets in view · ${catalog.datasets.length} loaded${searching ? ` · ${network.datasets.filter(item => network!.matchingIds.has(item.id)).length} match your search here` : ''}`;
  el('#breadcrumbs').innerHTML = `<button data-depth="0">All datasets</button>${address.path.map((part, i) => `<span aria-hidden="true">/</span><button data-depth="${i + 1}" ${i === address.path.length - 1 ? 'aria-current="page"' : ''}>${escapeHtml(part)}</button>`).join('')}`;
  el('#breadcrumbs').querySelectorAll<HTMLButtonElement>('button').forEach(button => button.onclick = () => go(address.path.slice(0, Number(button.dataset.depth))));
  root.querySelectorAll<HTMLButtonElement>('[data-lens]').forEach(button => {
    button.classList.toggle('active', button.dataset.lens === address.lens);
    button.setAttribute('aria-pressed', String(button.dataset.lens === address.lens));
  });
  el('#clear').hidden = !searching;
  renderList(); renderDetail(); updateGraph();
}

function renderList(): void {
  if (!network || !catalog) return;
  const searching = Boolean(address.query.trim());
  const list = el('#browse-list');
  el('#browse-heading').textContent = searching ? `Search results · ${network.matchingIds.size}` : address.path.length < 2 ? NETWORK_LENSES[address.lens] + ' groups' : `Datasets · ${network.datasets.length}`;
  const groupRows = searching || address.path.length >= 2 ? '' : network.groups.map(group => `<button class="group-row" data-group="${escapeHtml(group.id)}"><span class="group-dot" style="--node-color:${group.color}"></span><span><strong>${escapeHtml(group.label)}</strong><small>${group.count} datasets</small></span><span class="row-arrow">↗</span></button>`).join('');
  const datasets = searching ? searchNetwork(catalog.datasets, address.query) : [...network.datasets].sort((a, b) => a.title.localeCompare(b.title));
  const rows = datasets.map(dataset => `<button class="dataset-row ${selected?.id === dataset.id ? 'selected' : ''}" data-dataset="${escapeHtml(dataset.id)}"><span class="dataset-dot" style="--node-color:${networkColor(atlasSegments(dataset, 'topic')[0])}"></span><span><strong>${escapeHtml(dataset.title)}</strong><small>${escapeHtml(shape(dataset))} · ${escapeHtml(dataset.id)}</small></span></button>`).join('');
  list.innerHTML = `${address.path.length ? '<button class="back-row">← Up one level</button>' : ''}${groupRows}${!searching && groupRows ? `<div class="list-divider">All ${datasets.length} datasets in this view</div>` : ''}${rows || '<p class="empty-copy">No matching dataset in the loaded catalogue. Try another term or clear the search.</p>'}`;
  list.querySelector<HTMLButtonElement>('.back-row')?.addEventListener('click', () => go(address.path.slice(0, -1)));
  list.querySelectorAll<HTMLButtonElement>('[data-group]').forEach(button => button.onclick = () => {
    const group = network!.groups.find(item => item.id === button.dataset.group)!; go(group.path);
  });
  list.querySelectorAll<HTMLButtonElement>('[data-dataset]').forEach(button => button.onclick = () => selectDataset(button.dataset.dataset!, true));
}

function renderDetail(): void {
  const detail = el('#detail');
  detail.hidden = !selected;
  root.querySelector('.explore-shell')!.classList.toggle('has-detail', Boolean(selected));
  if (!selected) { detail.innerHTML = ''; return; }
  const dataset = selected;
  const source = safeSource(dataset.sourceUrl);
  const description = dataset.description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const topic = networkPath(dataset, 'topic');
  detail.innerHTML = `<div class="detail-top"><span class="eyebrow">DATASET / ${escapeHtml(dataset.id)}</span><button id="close-detail" aria-label="Close dataset details">×</button></div>
    <span class="topic-tag" style="--node-color:${networkColor(topic[0])}">${escapeHtml(topic[0])}</span>
    <h2>${escapeHtml(dataset.title)}</h2><p class="dataset-description">${escapeHtml(description || 'No description published.')}</p>
    <dl class="dataset-facts"><div><dt>Publisher</dt><dd>${escapeHtml(dataset.publisher || 'Not declared')}</dd></div><div><dt>Data shape</dt><dd>${escapeHtml(shape(dataset))}</dd></div><div><dt>Records</dt><dd>${dataset.recordsCount === undefined ? 'Not declared' : formatCount(dataset.recordsCount)}</dd></div><div><dt>Update rhythm</dt><dd>${escapeHtml(dataset.characteristics.updateFrequency || 'Not declared')}</dd></div><div><dt>Last modified</dt><dd>${escapeHtml(dataset.modified?.slice(0, 10) || 'Not declared')}</dd></div><div><dt>Licence</dt><dd>${escapeHtml(dataset.license || 'Not declared')}</dd></div></dl>
    <div class="detail-actions">${source ? `<a class="primary-link" href="${escapeHtml(source)}" target="_blank" rel="noopener noreferrer">Open original dataset ↗</a>` : ''}<a href="${catalogueLink(dataset.id)}">Inspect in evidence workbench →</a><button id="copy-link">Copy this view’s link</button></div>
    <div class="related-section"><h3>Explore around this dataset</h3><p>Shared metadata, not validated combinations.</p>${(['topic', 'publisher', 'space', 'time'] as const).map(lens => `<button data-related="${lens}"><span>${NETWORK_LENSES[lens]}</span><strong>${escapeHtml(networkPath(dataset, lens)[0])} →</strong></button>`).join('')}</div>
    <div class="detail-provenance">Metadata from ${catalog?.source === 'live' ? 'the live catalogue' : 'the offline snapshot'}. Topic grouping follows DataFit’s existing classification. Availability and compatibility need inspection in the workbench.</div>`;
  el('#close-detail').onclick = () => closeDetail();
  detail.querySelectorAll<HTMLButtonElement>('[data-related]').forEach(button => button.onclick = () => {
    address.lens = button.dataset.related as typeof address.lens;
    address.path = networkPath(dataset, address.lens).slice(0, 1);
    saveAddress(); render(); fit();
  });
  el('#copy-link').onclick = async () => {
    try { await navigator.clipboard.writeText(location.href); el('#copy-link').textContent = 'Link copied'; }
    catch { el('#copy-link').textContent = 'Copy the URL from your address bar'; }
  };
}

async function initGraph(): Promise<void> {
  try {
    const [{ default: ForceGraph3D }, { default: SpriteText }, THREE] = await Promise.all([
      import('3d-force-graph'), import('three-spritetext'), import('three'),
    ]);
    const createLabel = (node: NetworkNode): Sprite => {
      const groupTitle = node.label.replace(/(.{12,24})\s/g, '$1\n');
      const text = node.kind === 'dataset' ? node.label.length > 44 ? `${node.label.slice(0, 42)}…` : node.label : `${groupTitle}\n${node.count} datasets`;
      const label = new SpriteText(text, node.kind === 'dataset' ? 7 : 14, '#263c46');
      label.fontFace = 'Inter, system-ui, sans-serif'; label.fontWeight = node.kind === 'dataset' ? '500' : '600';
      label.backgroundColor = 'rgba(248,250,249,0.9)'; label.padding = [1.5, 1]; label.borderRadius = 1;
      label.position.set(0, -node.radius - (node.kind === 'dataset' ? 5 : 13), 2);
      return label;
    };
    const createObject = (node: NetworkNode): Group => {
      const group = new THREE.Group();
      const material = new THREE.MeshLambertMaterial({ color: node.color, transparent: true, opacity: .9 });
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(node.radius, 18, 12), material);
      group.add(sphere);
      objects.set(node.id, { group, sphere, material }); return group;
    };
    graph = new ForceGraph3D(host, { controlType: 'orbit', rendererConfig: { antialias: true, alpha: true } })
      .width(host.clientWidth).height(host.clientHeight).backgroundColor('#f8faf9')
      .showNavInfo(false).enableNodeDrag(false).cooldownTicks(0)
      .nodeThreeObject(node => createObject(node as NetworkNode))
      .nodeLabel(node => escapeHtml((node as NetworkNode).label))
      .linkColor(() => '#b7c9c8').linkOpacity(.32).linkWidth(.35)
      .linkLabel(link => escapeHtml((link as NetworkLink).label))
      .onNodeClick(node => {
        const item = node as NetworkNode;
        if (item.datasetId) selectDataset(item.datasetId);
        else if (item.kind === 'group') { announce(`Exploring ${item.label}, ${item.count} datasets.`); go(item.path); }
      })
      .onNodeHover(node => {
        hoverId = node?.id as string | undefined; host.style.cursor = node ? 'pointer' : 'grab';
        const card = el('#hover-card'); card.hidden = !node;
        if (node) {
          const item = node as NetworkNode;
          card.innerHTML = `<span class="eyebrow">${item.datasetId ? 'DATASET' : 'EXPLORE GROUP'}</span><strong>${escapeHtml(item.label)}</strong><small>${item.datasetId ? `Select to inspect · ${escapeHtml(item.datasetId)}` : `${item.count} datasets · select to enter`}</small>`;
        }
        paintLabels?.();
      })
      .onEngineStop(() => paintLabels?.()) as unknown as NonNullable<typeof graph>;
    paintLabels = () => {
      const searching = Boolean(address.query.trim());
      for (const node of network?.nodes ?? []) {
        const object = objects.get(node.id); if (!object) continue;
        const active = node.id === focusedNodeId || node.id === hoverId;
        const dim = searching && node.matching === 0;
        object.material.color.set(active ? '#143d50' : dim ? '#cdd5d4' : node.color);
        object.material.opacity = dim ? .22 : .95;
        object.sphere.scale.setScalar(active && node.kind === 'dataset' ? 1.75 : 1);
        const showLabel = node.kind !== 'dataset' || active || (address.path.length > 0 && (network?.datasets.length ?? 0) <= 16);
        // Avoid allocating a canvas texture for every hidden dataset label.
        if (showLabel && !object.label) { object.label = createLabel(node); object.group.add(object.label); }
        if (object.label) object.label.visible = showLabel;
      }
    };
    resize = new ResizeObserver(() => {
      graph?.width(host.clientWidth).height(host.clientHeight);
    });
    resize.observe(host);
    graphReady = true; updateGraph(); fit();
  } catch (error) {
    graphFailed = true;
    el('#graph-notice').hidden = false;
    el('#graph-notice').textContent = '3D is unavailable in this browser. All datasets and grouping remain available in the navigation list.';
    console.warn('Catalogue network unavailable:', error);
  }
}

function disposeObjects(): void {
  for (const object of objects.values()) {
    object.sphere.geometry.dispose(); object.material.dispose();
    const material = object.label?.material;
    material?.map?.dispose(); material?.dispose();
  }
  objects.clear();
}
function updateGraph(): void {
  if (!graphReady || !graph || !network) return;
  const layout = JSON.stringify([address.lens, address.path, flat]);
  if (layout === renderedLayout) { paintLabels?.(); return; }
  renderedLayout = layout;
  hoverId = undefined; el('#hover-card').hidden = true;
  // Graph libraries mutate their node/link objects. These are disposable projections;
  // the catalogue records are never passed into the renderer or mutated.
  // The graph library disposes removed custom objects during its digest cycle.
  objects.clear();
  graph.graphData({ nodes: network.nodes.map(node => ({ ...node })), links: network.links.map(link => ({ ...link })) });
  paintLabels?.();
}

root.querySelectorAll<HTMLButtonElement>('[data-lens]').forEach(button => button.onclick = () => {
  address.lens = button.dataset.lens as typeof address.lens;
  go(selected ? networkPath(selected, address.lens).slice(0, 1) : []);
});
search.addEventListener('input', () => {
  const startedSearch = !address.query.trim() && Boolean(search.value.trim());
  address.query = search.value;
  if (startedSearch) address.path = [];
  saveAddress(false); render(); if (startedSearch) fit();
});
el('#clear').onclick = () => { search.value = ''; address.query = ''; saveAddress(false); render(); search.focus(); };
el<HTMLSelectElement>('#portal').onchange = event => {
  const id = (event.target as HTMLSelectElement).value;
  location.href = `${base}explore/?portal=${encodeURIComponent(id)}`;
};
el('#flat').onclick = () => {
  flat = !flat; el('#flat').textContent = flat ? '2D' : '3D'; el('#flat').setAttribute('aria-pressed', String(flat));
  el('#flat').setAttribute('aria-label', flat ? 'Use a 3D layout' : 'Use a flat 2D layout');
  render(); fit();
};
el('#fit').onclick = fit;
document.addEventListener('keydown', event => {
  const typing = (event.target as HTMLElement)?.matches('input, textarea, select');
  if (event.key === '/' && !typing) { event.preventDefault(); search.focus(); }
  if (event.key === 'Escape' && !typing) {
    if (selected) closeDetail(); else if (address.path.length) go(address.path.slice(0, -1));
  }
});
window.addEventListener('popstate', () => {
  address = parseNetworkHash(location.hash); search.value = address.query;
  restoreAddress(); render(); fit();
});
function restoreAddress(): void {
  if (!catalog) return;
  // A stale path returns to the complete catalogue, rather than showing a falsely empty one.
  if (!catalog.datasets.some(dataset => address.path.every((part, index) => networkPath(dataset, address.lens)[index] === part))) address.path = [];
  selected = catalog.datasets.find(item => item.id === address.dataset);
  focusedNodeId = selected ? `dataset:${selected.id}` : undefined;
  if (selected && !address.path.every((part, index) => networkPath(selected!, address.lens)[index] === part)) address.path = networkPath(selected, address.lens).slice(0, 1);
  if (address.dataset && !selected) {
    el('#graph-notice').hidden = false;
    el('#graph-notice').textContent = missingLinkNotice(address.dataset, catalog.source, catalog.datasets.length);
  } else if (!graphFailed) el('#graph-notice').hidden = true;
  saveAddress(false);
}

async function start(): Promise<void> {
  const session = await openCatalogue(portal);
  catalog = session.state;
  const status = catalogueStatus(catalog);
  el('#source-status').textContent = catalog.source === 'live' ? `${status.complete ? 'Live catalogue' : 'Partial live catalogue'} · ${catalog.datasets.length} datasets` : portal.snapshot ? `Offline snapshot · ${catalog.datasets.length} datasets` : 'Catalogue unavailable · no offline snapshot';
  el('#source-status').classList.toggle('fallback', catalog.source !== 'live');
  el('#source-details').innerHTML = `<p>${escapeHtml(status.label)}</p><p>Retrieved ${escapeHtml(new Date(catalog.loadedAt).toLocaleString())}</p>${catalog.notes.map(note => `<p>${escapeHtml(note)}</p>`).join('')}${catalog.error ? `<p>${escapeHtml(catalog.error)}</p>` : ''}<p>Search and grouping cover every loaded dataset. A snapshot is a subset, not the full portal.</p>`;
  restoreAddress(); render(); await initGraph();
}
void start().catch(error => {
  el('#source-status').textContent = 'Catalogue could not be loaded';
  el('#browse-list').textContent = error instanceof Error ? error.message : 'Unexpected loading error';
});
window.addEventListener('pagehide', event => {
  if (event.persisted) return;
  cancelAnimationFrame(fitFrame); resize?.disconnect(); graph?._destructor(); disposeObjects();
});
