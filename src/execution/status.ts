import type { CompatibilityAssessment } from '../types';
import type { ExecutionResult } from './types';

/**
 * The status a relationship has *now*, derived from the assessment and any
 * execution that referenced it.
 *
 * Nothing here mutates the assessment. Execution adds a record that points back
 * at the assessment; it never rewrites the conclusion that justified it, so the
 * original reasoning stays inspectable next to the outcome that tested it.
 */
export type EvidenceStatus =
  | 'proposed'
  | 'structurally_supported'
  | 'sample_validated'
  | 'execution_confirmed'
  | 'execution_rejected'
  | 'execution_failed'
  | 'execution_stale';

export const STATUS_LABEL: Record<EvidenceStatus, string> = {
  proposed: 'proposed',
  structurally_supported: 'structurally supported',
  sample_validated: 'sample validated',
  execution_confirmed: 'execution confirmed',
  execution_rejected: 'execution rejected',
  execution_failed: 'execution failed',
  execution_stale: 'execution stale',
};

export function deriveStatus(
  assessment: CompatibilityAssessment,
  execution?: ExecutionResult,
): EvidenceStatus {
  if (execution) {
    // An execution computed against a different assessment describes data that
    // has since moved. It is not evidence about the current one.
    if (execution.assessmentId !== assessment.id) return 'execution_stale';
    switch (execution.status) {
      case 'failed':
        return 'execution_failed';
      case 'rejected':
        return 'execution_rejected';
      // A partial run confirmed the hypothesis over a bounded subset, which is
      // still execution evidence — the caveats travel on the result.
      case 'partial':
      case 'confirmed':
        return execution.validation.confirmed ? 'execution_confirmed' : 'execution_rejected';
    }
  }

  switch (assessment.evidenceLevel) {
    case 'sample_validated':
      return 'sample_validated';
    case 'schema_observed':
      return 'structurally_supported';
    default:
      return 'proposed';
  }
}

/** True once execution has had its say, whichever way it went. */
export const isExecuted = (status: EvidenceStatus): boolean =>
  status === 'execution_confirmed' || status === 'execution_rejected';
