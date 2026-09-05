import type { ExecutionResult } from '../execution/types';
import type { RepresentationType } from '../representation';
import type { NumericObservation } from './types';

/** Convert only explicit execution metrics into chart observations. */
export function observationsFromExecutions(type: RepresentationType, executions: Map<string, ExecutionResult>): NumericObservation[] | undefined {
  if (type !== 'ranked_bar' && type !== 'time_series') return;
  const result = [...executions.values()].at(-1);
  const summary = result?.output?.summary;
  if (!result || !summary || result.status === 'rejected' || result.status === 'failed') return;
  if (type === 'ranked_bar' && Array.isArray(summary.top)) return summary.top.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    return typeof row.count === 'number' ? [{ label: String(row.target ?? 'Area'), value: row.count, unit: 'matched features', sourceId: result.id }] : [];
  });
  if (type === 'ranked_bar' && typeof summary.matchedSourceFeatures === 'number' && typeof summary.sourceFeatures === 'number') {
    return [
      { label: 'Matched', value: summary.matchedSourceFeatures, unit: 'features', sourceId: result.id },
      { label: 'Not matched', value: summary.sourceFeatures - summary.matchedSourceFeatures, unit: 'features', sourceId: result.id },
    ];
  }
  return;
}
