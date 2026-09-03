import type { AtlasBucket, AtlasLens } from '../atlas';
import type { DatasetMatch, DatasetRecord, EvidencePlan, UseCaseIntent } from '../types';
import { escapeHtml } from './dom';

export function renderViewControls(view: 'list' | 'atlas', lens: AtlasLens, buckets: AtlasBucket[], selectedBucket: string | null): string {
  return `
    <div class="discover-controls">
      <div class="view-switch" role="group" aria-label="Catalogue view">
        <button class="view-btn ${view === 'list' ? 'active' : ''}" data-view="list">List</button>
        <button class="view-btn ${view === 'atlas' ? 'active' : ''}" data-view="atlas">Atlas</button>
      </div>
      ${
        view === 'atlas'
          ? `<div class="lens-switch" role="group" aria-label="Atlas lens">
              ${(['topic', 'space', 'time', 'readiness'] as AtlasLens[])
                .map(value => `<button class="lens-btn ${lens === value ? 'active' : ''}" data-lens="${value}">${labelLens(value)}</button>`)
                .join('')}
            </div>
            <select class="bucket-select" id="bucketSelect" aria-label="Atlas category">
              <option value="">All categories</option>
              ${buckets
                .filter(bucket => bucket.datasetIds.length)
                .map(bucket => `<option value="${escapeHtml(bucket.id)}" ${selectedBucket === bucket.id ? 'selected' : ''}>${escapeHtml(bucket.label)} (${bucket.datasetIds.length})</option>`)
                .join('')}
            </select>`
          : ''
      }
    </div>`;
}

export function renderCatalogueList(
  datasets: DatasetRecord[],
  matches: DatasetMatch[],
  workspace: Set<string>,
  selectedId: string | null,
): string {
  const byId = new Map(matches.map(match => [match.dataset.id, match]));
  return `<div class="catalogue-table" role="table" aria-label="Basel-Stadt datasets">
    <div class="catalogue-row catalogue-head" role="row">
      <div>Dataset</div><div>Publisher</div><div>Shape</div><div>Updated</div><div></div>
    </div>
    ${datasets
      .map(dataset => {
        const match = byId.get(dataset.id);
        return `<div class="catalogue-row ${selectedId === dataset.id ? 'selected' : ''}" role="row" data-id="${escapeHtml(dataset.id)}">
          <button class="catalogue-dataset inspect" data-id="${escapeHtml(dataset.id)}">
            <strong>${escapeHtml(dataset.title)}</strong>
            <span>${escapeHtml(dataset.id)} · ${match ? `${escapeHtml(match.evidenceClass)} · relevance ${match.relevance.score}` : 'catalogue record'}</span>
          </button>
          <div class="catalogue-publisher">${escapeHtml(dataset.publisher || '—')}</div>
          <div class="catalogue-shape">${shape(dataset)}</div>
          <div class="catalogue-updated">${formatDate(dataset.modified)}</div>
          <button class="small-btn workspace" data-id="${escapeHtml(dataset.id)}">${workspace.has(dataset.id) ? 'Remove' : 'Add'}</button>
        </div>`;
      })
      .join('')}
  </div>`;
}

export function renderEvidenceSummary(intent: UseCaseIntent, plan: EvidencePlan, matches: DatasetMatch[]): string {
  const classes = ['direct', 'supporting', 'contextual'] as const;
  const counts = Object.fromEntries(classes.map(value => [value, matches.filter(match => match.evidenceClass === value).length]));
  const missing = plan.roles.filter(role => role.roleType === 'missing' || role.missing || role.roleType === 'external_dependency');
  const resolved = plan.roles.filter(role => role.datasetId || role.candidates.length);
  return `<section class="evidence-summary">
    <div class="evidence-summary-head">
      <div><span class="eyebrow">Proposed evidence plan</span><strong>${escapeHtml(intent.desiredOutcome ?? 'Your question')}</strong></div>
      <div class="evidence-counts">
        <span><b>${counts.direct}</b> direct</span>
        <span><b>${counts.supporting}</b> supporting</span>
        <span><b>${counts.contextual}</b> contextual</span>
        <span class="missing"><b>${missing.length}</b> missing / external</span>
      </div>
    </div>
    <div class="role-strip">
      ${resolved.slice(0, 7).map(role => `<span title="${escapeHtml(role.reason)}"><b>${escapeHtml(role.label)}</b>${role.datasetId ? ' · matched' : role.candidates.length ? ' · candidate' : ''}</span>`).join('')}
      ${missing.slice(0, 4).map(role => `<span class="missing" title="${escapeHtml(role.reason)}"><b>${escapeHtml(role.label)}</b> · gap</span>`).join('')}
    </div>
  </section>`;
}

export function renderRecent(datasets: DatasetRecord[]): string {
  if (!datasets.length) return '';
  return `<section class="recent-panel"><span class="eyebrow">Recently updated</span>${datasets
    .map(dataset => `<button class="recent-item inspect" data-id="${escapeHtml(dataset.id)}"><span>${escapeHtml(dataset.title)}</span><time>${formatDate(dataset.modified)}</time></button>`)
    .join('')}</section>`;
}

function labelLens(lens: AtlasLens): string {
  if (lens === 'topic') return 'Topic';
  if (lens === 'space') return 'Space';
  if (lens === 'time') return 'Time';
  return 'Readiness';
}

function shape(dataset: DatasetRecord): string {
  if (!dataset.characteristics.geospatial) return dataset.characteristics.timeSeries ? 'Time series' : 'Tabular';
  const types = dataset.characteristics.geometryTypes;
  if (types.length > 1) return 'Mixed';
  return types[0] ?? 'Spatial';
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value.slice(0, 10));
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}
