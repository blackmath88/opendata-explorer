import type {
  CatalogState,
  DatasetMatch,
  DatasetRecord,
  DatasetStructure,
  EvidencePlan,
  PlannedRole,
  UseCaseIntent,
} from '../types';
import { PairAssessment, WorkspaceAnalysis, WorkspaceEntry } from '../workspace';
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

export function renderDatasetDetail(dataset: DatasetRecord, structure?: DatasetStructure): string {
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
    `<div class="dataset-detail"><b>${escapeHtml(dataset.title)}</b>
       <table class="kv">${rows
         .map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(value)}</td></tr>`)
         .join('')}</table>
       <div class="prov-row">${provenanceTag('source', 'catalogue metadata')}</div>
       <p>${escapeHtml(dataset.description || 'No catalogue description published.')}</p>
       <a href="${escapeHtml(dataset.sourceUrl)}" target="_blank" rel="noreferrer">Open source dataset ↗</a>
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
    .slice(0, 24)
    .map(field => {
      const sample = field.sampleValues?.length
        ? `<span class="field-sample">${escapeHtml(truncate(field.sampleValues.map(v => String(typeof v === 'object' ? JSON.stringify(v) : v)).join(' · '), 60))}</span>`
        : '';
      return `<tr>
        <td><code>${escapeHtml(field.name)}</code></td>
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
    <div class="sub-title">Fields (${structure.fields.length})</div>
    <table class="fields">${fields}</table>
    ${structure.fields.length > 24 ? `<div class="quiet">…and ${structure.fields.length - 24} more.</div>` : ''}
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
  return `
    <section class="workbench-section">
      <div class="section-title">Evidence plan <span class="section-note">${plan.roles.length} roles · ${
        plan.unresolved.length
      } required unresolved</span></div>
      <div class="role-grid">${plan.roles.map(card).join('')}</div>
      ${
        gaps.length
          ? `<div class="notice">Unresolved roles are part of the method, not an error. They state what this analysis would still need.</div>`
          : ''
      }
    </section>`;
}

export function renderRelationships(analysis: WorkspaceAnalysis | null, loading: boolean): string {
  if (loading) {
    return `<section class="workbench-section"><div class="section-title">Relationships</div>
      <div class="quiet">Inspecting structures and assessing compatibility…</div></section>`;
  }
  if (!analysis) {
    return `<section class="workbench-section"><div class="section-title">Relationships</div>
      <div class="quiet">Add two or more datasets to the workspace to assess how they can be combined.</div></section>`;
  }

  const failures = analysis.entries.filter(entry => entry.error);

  return `
    <section class="workbench-section">
      <div class="section-title">Relationships <span class="section-note">${analysis.pairs.length} assessed</span></div>
      ${analysis.pairs.map(renderPair).join('') || '<div class="quiet">No pairs to assess yet.</div>'}
      ${failures.length ? `<div class="warning">${failures.map(failureLine).join('<br>')}</div>` : ''}
      ${analysis.notes.length ? `<div class="notice">${analysis.notes.map(escapeHtml).join('<br>')}</div>` : ''}
    </section>`;
}

const failureLine = (entry: WorkspaceEntry): string =>
  escapeHtml(`${entry.dataset.title}: ${entry.error ?? 'inspection failed'}`);

function renderPair({ left, right, assessment }: PairAssessment): string {
  const relation = RELATION_LABEL[assessment.relation] ?? assessment.relation;
  const names = new Map([
    [left.id, left.title],
    [right.id, right.title],
  ]);
  // Structure-level messages refer to datasets by id; show titles instead.
  const humanise = (text: string) =>
    [...names].reduce((out, [id, title]) => out.replaceAll(id, title), text);

  return `
  <article class="rel-card rel-${escapeHtml(assessment.relation)}">
    <div class="rel-head">
      <div class="rel-title">${escapeHtml(truncate(left.title, 46))} <span class="rel-arrow">↔</span> ${escapeHtml(
        truncate(right.title, 46),
      )}</div>
      <span class="rel-relation">${escapeHtml(relation)}</span>
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
  </article>`;
}

// ---------------------------------------------------------------------------

export function section(title: string, body: string): string {
  return `<section class="section"><div class="section-title">${escapeHtml(title)}</div>${body}</section>`;
}

const chip = (text: string): string => `<span class="signal">${escapeHtml(text)}</span>`;
