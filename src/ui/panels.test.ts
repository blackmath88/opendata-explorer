import { describe, expect, it } from 'vitest';
import { buildEvidencePlan } from '../evidence';
import { parseUseCaseIntent } from '../intent';
import { fallbackDatasets } from '../data/fallback';
import type { ExecutionResult } from '../execution/types';
import type { WorkspaceAnalysis } from '../workspace';
import { executionPresentation, renderEvidenceSummary, renderRelationships } from './panels';

const execution = (status: ExecutionResult['status']): ExecutionResult => ({
  id: `execution-${status}`, operationId: 'operation', assessmentId: 'assessment', status,
  startedAt: '', completedAt: '', sourceSnapshots: [], evidenceLevel: 'execution_validated',
  validation: { originalRelation: 'nearest', confirmed: status === 'confirmed' || status === 'partial', reasons: [], warnings: [] },
  engine: { name: 'fixture', version: '1' },
});

describe('product surface rendering', () => {
  it('renders the proposed evidence summary with roles and missing evidence', () => {
    const intent = parseUseCaseIntent('I want a running route with shade, clean air, fountains and pollen information.');
    const plan = buildEvidencePlan(intent, fallbackDatasets, { selectedIds: [] });
    const html = renderEvidenceSummary(plan, fallbackDatasets);
    expect(html).toContain('Proposed evidence plan');
    expect(html).toContain('Missing / external');
    expect(html).toContain('evidence roles');
  });

  it('keeps a proposal visible before execution', () => {
    const [left, right] = fallbackDatasets;
    const analysis = { entries: [], notes: [], pairs: [{ left, right, assessment: {
      id: 'assessment', leftDatasetId: left.id, rightDatasetId: right.id, relation: 'nearest', confidence: 'high',
      evidenceLevel: 'schema_observed', reasons: ['Compatible geometry families'], warnings: [],
      leftStructureRef: 'l', rightStructureRef: 'r', assessedAt: '',
      inputs: { leftDatasetId: left.id, rightDatasetId: right.id, leftStructureFingerprint: 'l', rightStructureFingerprint: 'r', ruleVersion: '1' },
    } }] } as WorkspaceAnalysis;
    const html = renderRelationships(analysis, false, { results: new Map(), running: new Set(), available: true, executable: new Set(['assessment']) });
    expect(html).toContain('plausible / unvalidated');
    expect(html).toContain('Validate relationship');
  });

  it.each([
    ['confirmed', 'CONFIRMED', 'supported'], ['rejected', 'REJECTED', 'too weak'],
    ['partial', 'PARTIAL', 'provisional'], ['failed', 'FAILED', 'not evidence against'],
  ] as const)('distinguishes %s execution', (status, label, interpretation) => {
    const view = executionPresentation(execution(status));
    expect(view.label).toBe(label);
    expect(view.interpretation).toContain(interpretation);
  });
});
