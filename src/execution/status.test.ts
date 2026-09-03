import { describe, expect, it } from 'vitest';
import { deriveStatus, isExecuted } from './status';
import type { CompatibilityAssessment } from '../types';
import type { ExecutionResult } from './types';

const assessment = (overrides: Partial<CompatibilityAssessment> = {}): CompatibilityAssessment => ({
  id: 'CMP-1',
  leftDatasetId: 'a',
  rightDatasetId: 'b',
  leftStructureRef: 'STR-a',
  rightStructureRef: 'STR-b',
  relation: 'spatial_join',
  confidence: 'high',
  reasons: ['because'],
  warnings: [],
  evidenceLevel: 'schema_observed',
  assessedAt: '2026-09-03T00:00:00.000Z',
  inputs: {
    leftDatasetId: 'a',
    rightDatasetId: 'b',
    leftStructureFingerprint: 'STR-a',
    rightStructureFingerprint: 'STR-b',
    ruleVersion: 'v1',
  },
  ...overrides,
});

const execution = (overrides: Partial<ExecutionResult> = {}): ExecutionResult => ({
  id: 'EXE-1',
  operationId: 'OPR-1',
  assessmentId: 'CMP-1',
  status: 'confirmed',
  startedAt: '',
  completedAt: '',
  sourceSnapshots: [],
  evidenceLevel: 'execution_validated',
  validation: { originalRelation: 'spatial_join', confirmed: true, reasons: [], warnings: [] },
  engine: { name: 'geojson-turf', version: '1.0.0' },
  ...overrides,
});

describe('deriveStatus', () => {
  it('reflects the evidence ladder before anything is executed', () => {
    expect(deriveStatus(assessment({ evidenceLevel: 'metadata_only' }))).toBe('proposed');
    expect(deriveStatus(assessment({ evidenceLevel: 'schema_observed' }))).toBe('structurally_supported');
    expect(deriveStatus(assessment({ evidenceLevel: 'sample_validated' }))).toBe('sample_validated');
  });

  it('reports confirmation and rejection distinctly', () => {
    expect(deriveStatus(assessment(), execution())).toBe('execution_confirmed');
    expect(
      deriveStatus(
        assessment(),
        execution({ status: 'rejected', validation: { originalRelation: 'nearest', confirmed: false, reasons: [], warnings: [] } }),
      ),
    ).toBe('execution_rejected');
  });

  it('treats a bounded partial run as execution evidence, with its caveats intact', () => {
    expect(deriveStatus(assessment(), execution({ status: 'partial' }))).toBe('execution_confirmed');
  });

  it('never turns a failure into a rejection', () => {
    const failed = execution({
      status: 'failed',
      validation: { originalRelation: 'spatial_join', confirmed: false, reasons: [], warnings: [] },
    });
    expect(deriveStatus(assessment(), failed)).toBe('execution_failed');
    expect(isExecuted(deriveStatus(assessment(), failed))).toBe(false);
  });

  it('marks an execution computed against a different assessment as stale', () => {
    const stale = execution({ assessmentId: 'CMP-other' });
    expect(deriveStatus(assessment(), stale)).toBe('execution_stale');
  });

  it('does not mutate the assessment it derives from', () => {
    const original = assessment();
    const snapshot = JSON.parse(JSON.stringify(original));
    deriveStatus(original, execution());
    expect(original).toEqual(snapshot);
    // The original reasoning stays inspectable next to the result that tested it.
    expect(original.evidenceLevel).toBe('schema_observed');
  });
});
