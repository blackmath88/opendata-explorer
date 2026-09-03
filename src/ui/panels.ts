import type {
  CatalogState,
  CompatibilityAssessment,
  DatasetMatch,
  DatasetRecord,
  DatasetStructure,
  EvidencePlan,
  PlannedRole,
  UseCaseIntent,
} from '../types';
import { PairAssessment, WorkspaceAnalysis, WorkspaceEntry } from '../workspace';
import type { ExecutionResult } from '../execution/types';
import { deriveStatus, STATUS_LABEL } from '../execution/status';
import {
  CONFIDENCE_LABEL,
  EVIDENCE_LABEL,
  RELATION_LABEL,
  ROLE_LABEL,
  escapeHtml,
  evidenceProvenance,
  formatCount,
  formatDate,
  observationProvenance,
  originProvenance,
  provenanceTag,
  truncate,
} from './dom';

const EVIDENCE_CLASS_LABEL: Record<string, string> = {
  direct: 'direct evidence',
  supporting: 'supporting',
  contextual: 'contextual',
  missing: 'missing',
};

// ---------------------------------------------------------------------------
// Discover inspector
// ---------------------------------------------------------------------------

export function renderIntentSection(intent: UseCaseIntent): string {
  const chips: string[] = [];
  for (const hint of intent.domainHints) chips.push(chip(hint.replace(/_/g, ' ')));
  if (intent.desiredOutcome) chips.push(chip(`outcome: ${intent.desiredOutcome.replace(/_/g, ' ')}`));
  if (intent.spatialNeed) chips.push(chip('spatial'));
  if (intent.temporalNeed) chips.push(chip(`time: ${intent.temporalNeed}`));
  if (intent.geographicScope) chips.push(chip(`scope: ${intent.geographicScope}`));
  for (const constraint of intent.constraints) chips.push(chip(constraint.replace(':', ': ')));

  return section(
    'Parsed intent',
    `<div class="signals">${chips.join('') || chip('nothing detected')}</div>
     <div class="prov-row">${provenanceTag('system', 'deterministic parser')}</div>`,
  );
}

export function renderSourceNotice(catalog: CatalogState): string {
  if (catalog.source === 'live') {
    return catalog.notes.length
      ? `<div class="notice section">${catalog.notes.map(escapeHtml).join('<br>')}</div>`
      : '';
  }
  return `<div class="warning section"><b>Fallback mode.</b> Live catalogue loading failed (${escapeHtml(
    catalog.error ?? 'unknown error',
  )}). ${catalog.notes.map(escapeHtml).join(' ')} Nothing shown here is live data.</div>`;
}

export function renderSourceDiagnostics(catalog: CatalogState): string {
  const complete = catalog.reportedTotal === undefined || catalog.reportedTotal === catalog.datasets.length;
  return section('Catalogue source', `<dl class="source-diagnostics">
    <div><dt>Mode</dt><dd>${catalog.source === 'live' ? 'Live' : 'Fallback cache'}</dd></div>
    <div><dt>Source</dt><dd>Basel-Stadt OGD</dd></div>
    <div><dt>Datasets loaded</dt><dd>${formatCount(catalog.datasets.length)}${catalog.reportedTotal !== undefined ? ` / ${formatCount(catalog.reportedTotal)} reported` : ''}</dd></div>
    <div><dt>Completeness</dt><dd>${complete ? 'Complete' : 'Partial'}</dd></div>
    <div><dt>Last loaded</dt><dd>${escapeHtml(new Date(catalog.loadedAt).toLocaleString('de-CH'))}</dd></div>
  </dl>`);
}

export function renderEvidenceSummary(plan: EvidencePlan, datasets: DatasetRecord[]): string {
  const byId = new Map(datasets.map(dataset => [dataset.id, dataset]));
  const counts = { direct: 0, supporting: 0, contextual: 0 };
  for (const role of plan.roles) {
    if (!role.datasetId) continue;
    if (role.required && role.roleType === 'primary_measure') counts.direct += 1;
    else if (role.roleType === 'context' || role.roleType === 'constraint') counts.contextual += 1;
    else counts.supporting += 1;
  }
  const context = [plan.intent.spatialNeed ? 'Spatial' : '', plan.intent.temporalNeed ? `${plan.intent.temporalNeed} conditions` : '', plan.intent.geographicScope ?? 'Basel'].filter(Boolean).join(' · ');
  const roles = plan.roles.map(role => `<li><span>${escapeHtml(role.label)}</span><b class="${role.datasetId ? '' : 'missing-role'}">${escapeHtml(role.datasetId ? byId.get(role.datasetId)?.title ?? role.datasetId : 'Missing / external')}</b></li>`).join('');
  return `<section class="evidence-summary">
    <div class="question-summary"><span class="eyebrow">Proposed evidence plan · system inferred</span><b>${escapeHtml(plan.intent.statement)}</b><span>${escapeHtml(context)}</span></div>
    <div class="plan-summary"><span class="eyebrow">Evidence plan</span>
      <div><b>${counts.direct}</b><span>Direct</span></div><div><b>${counts.supporting}</b><span>Supporting</span></div>
      <div><b>${counts.contextual}</b><span>Context</span></div><div class="summary-gap"><b>${plan.roles.filter(r => !r.datasetId).length}</b><span>Missing roles</span></div>
    </div><details class="summary-roles"><summary>Show ${plan.roles.length} evidence roles</summary><ul>${roles}</ul></details>
  </section>`;
}

export function renderCatalogueRows(
  datasets: DatasetRecord[],
  matches: DatasetMatch[],
  workspace: Set<string>,
): string {
  const matchById = new Map(matches.map(match => [match.dataset.id, match]));
  if (!datasets.length) return '<div class="catalogue-empty">No datasets match these catalogue filters.</div>';
  return datasets.map(dataset => {
    const match = matchById.get(dataset.id);
    const freshness = formatDate(dataset.modified);
    return `<article class="catalogue-row" data-id="${escapeHtml(dataset.id)}">
      <button class="catalogue-open" aria-label="Inspect ${escapeHtml(dataset.title)}">
        <span class="catalogue-title">${escapeHtml(dataset.title)}</span>
        <span class="catalogue-id">${escapeHtml(dataset.id)}</span>
        <span class="catalogue-publisher">${escapeHtml(dataset.publisher || 'Publisher not published')}</span>
        <span class="catalogue-topics">${escapeHtml([...dataset.themes, ...dataset.semantic.topics].slice(0, 3).join(' · ') || 'No theme')}</span>
        <span class="catalogue-count">${escapeHtml(formatCount(dataset.recordsCount))}</span>
        <span class="catalogue-signals">${dataset.characteristics.geospatial ? 'Geo' : '—'} · ${dataset.characteristics.timeSeries || dataset.characteristics.temporalCoverage.length ? 'Time' : '—'}</span>
        <span class="catalogue-date">${escapeHtml(freshness)}</span>
        <span class="catalogue-evidence">${match ? escapeHtml(EVIDENCE_CLASS_LABEL[match.evidenceClass]) : 'catalogue'}</span>
      </button>
      <button class="small-btn row-workspace ${workspace.has(dataset.id) ? 'added' : ''}">${workspace.has(dataset.id) ? 'Added' : 'Add'}</button>
    </article>`;
  }).join('');
}

export function renderMatches(matches: DatasetMatch[], workspace: Set<string>, plan: EvidencePlan): string {
  if (!matches.length) return section('Top dataset matches', '<div class="dataset-detail">No matches in this filter.</div>');

  const roleLabel = (ids: string[]) =>
    ids.map(id => plan.roles.find(role => role.id === id)?.label ?? id).join(', ');

  const cards = matches
    .map(match => {
      const { dataset, relevance, evidenceClass, roleIds } = match;
      return `
      <article class="card" data-id="${escapeHtml(dataset.id)}">
        <div class="card-top">
          <div>
            <div class="card-title">${escapeHtml(dataset.title)}</div>
            <div class="card-meta">${escapeHtml(dataset.id)} · ${escapeHtml(dataset.publisher || 'Publisher not published')}</div>
          </div>
          <span class="match">${relevance.score}</span>
        </div>
        <div class="badges">
          <span class="badge badge-${escapeHtml(evidenceClass)}">${escapeHtml(EVIDENCE_CLASS_LABEL[evidenceClass])}</span>
          ${roleIds.length ? `<span class="badge badge-role">${escapeHtml(roleLabel(roleIds))}</span>` : ''}
          ${dataset.characteristics.geospatial
            ? `<span class="badge">${escapeHtml(dataset.characteristics.geometryTypes.join('/') || 'geometry')}</span>`
            : '<span class="badge badge-quiet">no geometry</span>'}
          <span class="badge badge-quiet">${escapeHtml(formatCount(dataset.recordsCount))} records</span>
        </div>
        <p>${escapeHtml(truncate(dataset.description || 'No catalogue description published.', 240))}</p>
        <div class="reason">${escapeHtml(relevance.explanation)}</div>
        <div class="card-actions">
          <button class="small-btn inspect">Inspect</button>
          <button class="small-btn workspace ${workspace.has(dataset.id) ? 'added' : ''}">${
            workspace.has(dataset.id) ? 'In workspace' : 'Add'
          }</button>
        </div>
      </article>`;
    })
    .join('');

  return section(
    'Top dataset matches',
    `${cards}<div class="prov-row">${provenanceTag('system', 'deterministic ranking')}</div>`,
  );
}

export function renderDatasetDetail(dataset: DatasetRecord, structure?: DatasetStructure, match?: DatasetMatch, plan?: EvidencePlan): string {
  const characteristics = dataset.characteristics;
  const rows: Array<[string, string]> = [
    ['Dataset id', dataset.id],
    ['Publisher', dataset.publisher || 'not published'],
    ['Licence', dataset.license || 'not published'],
    ['Last modified', formatDate(dataset.modified)],
    ['Records', formatCount(dataset.recordsCount)],
    ['Update frequency', characteristics.updateFrequency ?? 'not published'],
    ['Geometry', characteristics.geometryTypes.join(', ') || 'none declared'],
    ['Territory', characteristics.territory.join(', ') || 'not published'],
    [
      'Temporal coverage',
      characteristics.temporalCoverage.length
        ? characteristics.temporalCoverage.map(formatDate).join(' → ')
        : 'not published',
    ],
  ];

  return section(
    'Dataset detail',
    `<div class="dataset-detail"><div class="detail-group"><span class="eyebrow">Overview</span><h3>${escapeHtml(dataset.title)}</h3>
       <p>${escapeHtml(dataset.description || 'No catalogue description published.')}</p>
       <a href="${escapeHtml(dataset.sourceUrl)}" target="_blank" rel="noreferrer">Open source dataset ↗</a></div>
       <div class="detail-group"><span class="eyebrow">Catalogue</span>
       <table class="kv">${rows
         .map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(value)}</td></tr>`)
         .join('')}
         <tr><th>Themes</th><td>${escapeHtml(dataset.themes.join(', ') || 'not published')}</td></tr>
         <tr><th>Keywords</th><td>${escapeHtml(dataset.keywords.join(', ') || 'not published')}</td></tr>
         <tr><th>Formats</th><td>${escapeHtml(dataset.formats.join(', ') || 'not published')}</td></tr>
         <tr><th>Fields</th><td>${escapeHtml(formatCount(dataset.fieldCount))}</td></tr>
       </table>
       <div class="prov-row">${provenanceTag('source', 'catalogue metadata')}</div>
       <div class="detail-links"><a href="${escapeHtml(dataset.sourceUrl)}" target="_blank" rel="noreferrer">Open source dataset ↗</a>${dataset.licenseUrl ? ` <a href="${escapeHtml(dataset.licenseUrl)}" target="_blank" rel="noreferrer">Licence ↗</a>` : ''}</div></div>
       ${match ? `<div class="detail-group relevance-detail"><span class="eyebrow">Relevance · system inferred</span><div class="badges"><span class="badge badge-${escapeHtml(match.evidenceClass)}">${escapeHtml(EVIDENCE_CLASS_LABEL[match.evidenceClass])}</span>${match.roleIds.map(id => `<span class="badge badge-role">${escapeHtml(plan?.roles.find(role => role.id === id)?.label ?? id)}</span>`).join('')}</div><p>${escapeHtml(match.relevance.explanation)}</p>${provenanceTag('system', 'deterministic ranking')}</div>` : ''}
     </div>
     ${structure ? renderStructure(structure) : ''}`,
  );
}

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

export function renderStructure(structure: DatasetStructure): string {
  const geometry = structure.geometry
    ? `<div class="fact"><span class="fact-key">Geometry</span>
         <span class="fact-val">${escapeHtml(
           structure.geometry.declaredTypes?.join(', ') || structure.geometry.type,
         )}${structure.geometry.crs ? ` · ${escapeHtml(structure.geometry.crs)}` : ''}</span>
         ${provenanceTag(observationProvenance(structure.geometry.observedFrom))}</div>`
    : `<div class="fact"><span class="fact-key">Geometry</span><span class="fact-val">none exposed</span></div>`;

  const temporal = structure.temporal
    ? `<div class="fact"><span class="fact-key">Time</span>
         <span class="fact-val">${escapeHtml(structure.temporal.fields.join(', ') || 'no date field')}${
           structure.temporal.grain ? ` · ${escapeHtml(structure.temporal.grain)} grain` : ''
         }${
           structure.temporal.start
             ? ` · ${escapeHtml(formatDate(structure.temporal.start))} → ${escapeHtml(formatDate(structure.temporal.end))}`
             : ''
         }</span>
         ${provenanceTag(observationProvenance(structure.temporal.coverageObservedFrom ?? structure.temporal.observedFrom))}</div>`
    : `<div class="fact"><span class="fact-key">Time</span><span class="fact-val">no temporal signal</span></div>`;

  const keys = structure.keyProfiles.length
    ? structure.keyProfiles
        .map(
          key => `<li><code>${escapeHtml(key.field)}</code> ${provenanceTag(
            key.source === 'schema_annotation' ? 'source' : 'system',
            key.source === 'schema_annotation' ? 'declared identifier' : 'name heuristic',
          )}</li>`,
        )
        .join('')
    : '<li class="quiet">No candidate identifier found.</li>';

  const fields = structure.fields
    .map(field => {
      const sample = field.sampleValues?.length
        ? `<span class="field-sample">${escapeHtml(truncate(field.sampleValues.map(v => String(typeof v === 'object' ? JSON.stringify(v) : v)).join(' · '), 60))}</span>`
        : '';
      return `<tr>
        <td><code>${escapeHtml(field.name)}</code><span class="field-description">${escapeHtml(field.label ?? '')}${field.description ? ` · ${escapeHtml(field.description)}` : ''}</span></td>
        <td class="quiet">${escapeHtml(field.type ?? '')}${field.unit ? ` · ${escapeHtml(field.unit)}` : ''}</td>
        <td class="quiet">${escapeHtml((field.roleHints ?? []).join(', '))}</td>
        <td>${sample}</td>
      </tr>`;
    })
    .join('');

  return `
    <div class="section-title">Structure <span class="section-note">${escapeHtml(
      EVIDENCE_LABEL[
        structure.observedFrom === 'sample_records'
          ? 'sample_validated'
          : structure.observedFrom === 'schema'
            ? 'schema_observed'
            : 'metadata_only'
      ],
    )}</span></div>
    <div class="facts">${geometry}${temporal}
      <div class="fact"><span class="fact-key">Records</span><span class="fact-val">${escapeHtml(
        formatCount(structure.recordCount),
      )}</span>${
        structure.recordCountObservedFrom ? provenanceTag(observationProvenance(structure.recordCountObservedFrom)) : ''
      }</div>
    </div>
    <div class="sub-title">Candidate identifiers</div>
    <ul class="key-list">${keys}</ul>
    <div class="sub-title">Structure · fields (${structure.fields.length})</div>
    <table class="fields"><thead><tr><th>Field</th><th>Type</th><th>Role</th><th>Observation</th></tr></thead><tbody>${fields}</tbody></table>
    <div class="prov-row">${provenanceTag('schema')} ${structure.observedFrom === 'sample_records' ? provenanceTag('sample', 'bounded values') : ''}</div>
    ${structure.notes.length ? `<div class="notice">${structure.notes.map(escapeHtml).join('<br>')}</div>` : ''}`;
}

// ---------------------------------------------------------------------------
// Compose: evidence plan + relationships
// ---------------------------------------------------------------------------

export function renderEvidencePlan(plan: EvidencePlan, datasets: DatasetRecord[], workspace: Set<string>): string {
  const byId = new Map(datasets.map(dataset => [dataset.id, dataset]));

  const card = (role: PlannedRole) => {
    const dataset = role.datasetId ? byId.get(role.datasetId) : undefined;
    const state = dataset ? (workspace.has(dataset.id) ? 'in workspace' : 'proposed') : 'unresolved';
    return `
    <article class="role-card ${role.datasetId ? '' : 'role-gap'}" data-role="${escapeHtml(role.id)}">
      <div class="role-head">
        <div>
          <div class="role-label">${escapeHtml(role.label)}</div>
          <div class="role-type">${escapeHtml(ROLE_LABEL[role.roleType] ?? role.roleType)} · ${
            role.required ? 'required' : 'optional'
          }</div>
        </div>
        <span class="badge ${role.datasetId ? 'badge-supporting' : 'badge-missing'}">${escapeHtml(state)}</span>
      </div>
      <div class="role-reason">${escapeHtml(role.reason)}</div>
      ${
        dataset
          ? `<div class="role-dataset" data-id="${escapeHtml(dataset.id)}">
               <span class="role-dataset-title">${escapeHtml(dataset.title)}</span>
               <span class="quiet">${escapeHtml(dataset.id)}</span>
               <button class="small-btn ${workspace.has(dataset.id) ? 'added' : ''} role-add">${
                 workspace.has(dataset.id) ? 'In workspace' : 'Add'
               }</button>
             </div>`
          : ''
      }
      ${
        role.gap?.suggestion
          ? `<div class="role-gap-note"><b>Not served by this catalogue.</b> ${escapeHtml(role.gap.suggestion)}</div>`
          : role.datasetId
            ? ''
            : '<div class="role-gap-note">No catalogue dataset satisfies this role.</div>'
      }
      ${
        role.candidates.length > 1
          ? `<details class="alts"><summary>${role.candidates.length} candidates considered</summary>
              <ul>${role.candidates
                .map(
                  candidate =>
                    `<li><span class="quiet">${candidate.score}</span> ${escapeHtml(
                      truncate(candidate.title, 52),
                    )} <span class="quiet">${escapeHtml(candidate.note)}</span></li>`,
                )
                .join('')}</ul></details>`
          : ''
      }
      <div class="prov-row">${provenanceTag(originProvenance(role.origin), 'proposed role')}</div>
    </article>`;
  };

  const gaps = plan.roles.filter(role => !role.datasetId);
  const summaryRows = plan.roles.map(role => {
    const dataset = role.datasetId ? byId.get(role.datasetId) : undefined;
    const covered = Boolean(dataset && workspace.has(dataset.id));
    const status = covered ? '✓ Covered' : dataset ? '○ Available' : role.gap?.kind === 'not_in_catalogue' ? '✕ External' : '✕ Missing';
    return `<tr class="role-dataset" ${dataset ? `data-id="${escapeHtml(dataset.id)}"` : ''}><td>${escapeHtml(role.label)}</td><td class="${covered ? 'role-covered' : 'role-uncovered'}">${escapeHtml(status)}</td><td>${escapeHtml(dataset?.title ?? role.gap?.suggestion ?? 'No dataset')}</td>${dataset ? `<td><button class="small-btn ${covered ? 'added' : ''} role-add">${covered ? 'Selected' : 'Add'}</button></td>` : '<td></td>'}</tr>`;
  }).join('');
  return `
    <section class="workbench-section">
      <div class="section-title">1. Evidence coverage <span class="section-note">${plan.roles.length} roles · ${
        plan.unresolved.length
      } required unresolved</span></div>
      <table class="coverage-table"><thead><tr><th>Role</th><th>Status</th><th>Dataset</th><th></th></tr></thead><tbody>${summaryRows}</tbody></table>
      <details class="evidence-details"><summary>Show candidates and reasoning</summary><div class="role-grid">${plan.roles.map(card).join('')}</div></details>
      ${
        gaps.length
          ? `<div class="notice">Unresolved roles are part of the method, not an error. They state what this analysis would still need.</div>`
          : ''
      }
    </section>`;
}

export interface ExecutionView {
  /** Execution results keyed by the assessment they validated. */
  results: Map<string, ExecutionResult>;
  running: Set<string>;
  /** Absent in fallback mode: offline data cannot be executed against. */
  available: boolean;
  unavailableReason?: string;
  /** Assessments for which the operation planner produced a runnable operation. */
  executable: Set<string>;
}

export function renderRelationships(
  analysis: WorkspaceAnalysis | null,
  loading: boolean,
  executions: ExecutionView,
): string {
  if (loading) {
    return `<section class="workbench-section"><div class="section-title">2. Proposed relationships</div>
      <div class="quiet">Inspecting structures and assessing compatibility…</div></section>`;
  }
  if (!analysis) {
    return `<section class="workbench-section"><div class="section-title">2. Proposed relationships</div>
      <div class="quiet">Select two or more datasets, then choose Analyse compatibility.</div></section>`;
  }

  const failures = analysis.entries.filter(entry => entry.error);

  return `
    <section class="workbench-section">
      <div class="section-title">2. Proposed relationships <span class="section-note">${analysis.pairs.length} assessed</span></div>
      ${analysis.pairs.map(pair => renderPair(pair, executions)).join('') || '<div class="quiet">No pairs to assess yet.</div>'}
      ${failures.length ? `<div class="warning">${failures.map(failureLine).join('<br>')}</div>` : ''}
      ${analysis.notes.length ? `<div class="notice">${analysis.notes.map(escapeHtml).join('<br>')}</div>` : ''}
    </section>`;
}

const failureLine = (entry: WorkspaceEntry): string =>
  escapeHtml(`${entry.dataset.title}: ${entry.error ?? 'inspection failed'}`);

function renderPair({ left, right, assessment }: PairAssessment, executions: ExecutionView): string {
  const relation = RELATION_LABEL[assessment.relation] ?? assessment.relation;
  const currentState = executions.results.has(assessment.id)
    ? `validated ${executions.results.get(assessment.id)!.status}`
    : assessment.relation === 'incompatible' ? 'incompatible' : 'plausible / unvalidated';
  const names = new Map([
    [left.id, left.title],
    [right.id, right.title],
  ]);
  // Structure-level messages refer to datasets by id; show titles instead.
  const humanise = (text: string) =>
    [...names].reduce((out, [id, title]) => out.replaceAll(id, title), text);

  return `
  <article class="rel-card rel-${escapeHtml(assessment.relation)}">
    <div class="phase-label">${escapeHtml(currentState)} · system inferred</div>
    <div class="rel-head">
      <div class="relationship-flow"><b>${escapeHtml(truncate(left.title, 38))}</b><span>${escapeHtml(relation)}</span><b>${escapeHtml(truncate(right.title, 38))}</b></div>
    </div>
    <div class="rel-meta">
      <span>Confidence: <b>${escapeHtml(CONFIDENCE_LABEL[assessment.confidence])}</b></span>
      <span>Evidence: ${provenanceTag(evidenceProvenance(assessment.evidenceLevel))}</span>
    </div>
    ${
      assessment.proposedOperation
        ? `<div class="rel-op"><span class="eyebrow">Proposed operation</span><code>${escapeHtml(
            assessment.proposedOperation,
          )}</code></div>`
        : ''
    }
    ${
      assessment.candidateKeys?.length
        ? `<div class="rel-keys"><span class="eyebrow">Candidate keys</span>${assessment.candidateKeys
            .map(key => `<code>${escapeHtml(key.left)} = ${escapeHtml(key.right)}</code>`)
            .join(' ')}</div>`
        : ''
    }
    ${
      assessment.reasons.length
        ? `<ul class="rel-reasons">${assessment.reasons.map(r => `<li>${escapeHtml(humanise(r))}</li>`).join('')}</ul>`
        : ''
    }
    ${
      assessment.warnings.length
        ? `<ul class="rel-warnings">${assessment.warnings.map(w => `<li>${escapeHtml(humanise(w))}</li>`).join('')}</ul>`
        : ''
    }
    <div class="prov-row">${provenanceTag('system', 'deterministic compatibility rules')}</div>
    ${renderExecution(assessment, executions, humanise)}
  </article>`;
}

/**
 * The execution panel on a relationship card.
 *
 * Execution never rewrites the assessment above it — the proposal and the
 * result that tested it stay side by side, which is the whole point.
 */
function renderExecution(
  assessment: CompatibilityAssessment,
  executions: ExecutionView,
  humanise: (text: string) => string,
): string {
  const execution = executions.results.get(assessment.id);
  const status = deriveStatus(assessment, execution);
  const running = executions.running.has(assessment.id);

  if (!execution) {
    if (running) return `<div class="exec exec-running">Executing against real geometry…</div>`;
    if (!executions.available) {
      return `<div class="exec exec-idle"><span class="quiet">${escapeHtml(
        executions.unavailableReason ?? 'Execution is unavailable.',
      )}</span></div>`;
    }
    if (!executions.executable.has(assessment.id)) {
      return '<div class="exec exec-idle"><span class="quiet">Validation is not executable for this proposed relationship.</span></div>';
    }
    return `<div class="exec exec-idle">
        <button class="small-btn validate" data-assessment="${escapeHtml(assessment.id)}">Validate relationship</button>
        <span class="quiet">Status: ${escapeHtml(STATUS_LABEL[status])}</span>
      </div>`;
  }

  const summary = execution.output?.summary ?? {};
  const facts = executionFacts(summary);

  const presentation = executionPresentation(execution);
  return `<div class="exec exec-${escapeHtml(presentation.className)}">
      <div class="phase-label">3. Execution result · real source data</div>
      <div class="exec-head">
        <span class="exec-verdict">${escapeHtml(presentation.label)}</span>
        ${provenanceTag('execution')}
        <span class="quiet">${escapeHtml(execution.engine.name)} ${escapeHtml(execution.engine.version)}</span>
      </div>
      ${facts ? `<div class="exec-facts">${facts}</div>` : ''}
      <div class="exec-interpretation"><span class="eyebrow">Interpretation</span><p>${escapeHtml(presentation.interpretation)}</p></div>
      ${
        execution.validation.reasons.length
          ? `<ul class="rel-reasons">${execution.validation.reasons.map(r => `<li>${escapeHtml(humanise(r))}</li>`).join('')}</ul>`
          : ''
      }
      ${
        execution.validation.warnings.length
          ? `<ul class="rel-warnings">${execution.validation.warnings.map(w => `<li>${escapeHtml(humanise(w))}</li>`).join('')}</ul>`
          : ''
      }
      ${execution.error ? `<div class="rel-warnings"><li>${escapeHtml(execution.error.message)}</li></div>` : ''}
      <details class="execution-technical"><summary>Technical detail and provenance</summary><div class="exec-sources">${execution.sourceSnapshots
        .map(
          snapshot =>
            `<div><span class="quiet">${escapeHtml(humanise(snapshot.datasetId))}</span> ${escapeHtml(
              formatCount(snapshot.recordCount),
            )} of ${escapeHtml(formatCount(snapshot.totalRecordCount))} features${
              snapshot.truncated ? ' <b>truncated</b>' : ''
            } · read ${escapeHtml(formatDate(snapshot.retrievedAt))}</div>`,
        )
        .join('')}</div><pre>${escapeHtml(JSON.stringify(summary, null, 2))}</pre>
      <div class="exec-ids">
        <code>${escapeHtml(assessment.id)}</code>
        <code>${escapeHtml(execution.operationId)}</code>
        <code>${escapeHtml(execution.id)}</code>
      </div></details>
    </div>`;
}

function executionFacts(summary: Record<string, unknown>): string {
  const definitions: Array<[string, string, (value: number) => string]> = [
    ['medianMeters', 'Median distance', value => `${value.toLocaleString('de-CH')} m`],
    ['thresholdMeters', 'Distance threshold', value => `${value.toLocaleString('de-CH')} m`],
    ['coverage', 'Within threshold', value => `${(value * 100).toFixed(1)}%`],
    ['matchRate', 'Matched source features', value => `${(value * 100).toFixed(1)}%`],
    ['withinThreshold', 'Features within threshold', value => value.toLocaleString('de-CH')],
    ['totalMatches', 'Total matches', value => value.toLocaleString('de-CH')],
    ['groups', 'Matched groups', value => value.toLocaleString('de-CH')],
  ];
  return definitions.flatMap(([key, label, format]) => typeof summary[key] === 'number'
    ? [`<div><span class="quiet">${label}</span> <b>${format(summary[key] as number)}</b></div>`]
    : []).join('');
}

export function executionPresentation(execution: ExecutionResult): { label: string; className: string; interpretation: string } {
  switch (execution.status) {
    case 'confirmed': return { label: 'CONFIRMED', className: 'confirmed', interpretation: 'The proposed relationship was supported by execution against real source data.' };
    case 'rejected': return { label: 'REJECTED', className: 'rejected', interpretation: 'The relationship is structurally possible, but execution found it too weak for the proposed analysis.' };
    case 'partial': return { label: 'PARTIAL', className: 'partial', interpretation: 'The operation ran on a bounded or truncated subset. Treat the result as provisional.' };
    case 'failed': return { label: 'FAILED', className: 'failed', interpretation: 'Execution could not complete. This is a runtime or transport failure, not evidence against the proposal.' };
  }
}

// ---------------------------------------------------------------------------

export function section(title: string, body: string): string {
  return `<section class="section"><div class="section-title">${escapeHtml(title)}</div>${body}</section>`;
}

const chip = (text: string): string => `<span class="signal">${escapeHtml(text)}</span>`;
