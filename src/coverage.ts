/**
 * Cantons side by side: which kinds of data each portal publishes, and where the gaps are.
 * The grid is only as honest as the portals in it, so every column carries its rollout level
 * (docs/MULTI_CANTON.md) and an empty cell means different things at different levels:
 *
 *   present    at least one dataset resolves to the subcategory
 *   not_found  none does, and the portal's topics were decided and evaluated (L3+): a real gap
 *   unchecked  none does, but topic assignment there is not evaluated: absence proves nothing
 *
 * Counts are conserved: each column sums to the portal's dataset count (the "Unclassified"
 * row included), so nothing is dropped between catalogue and grid.
 */
import { topicDecisionFile } from './data/portals';
import type { Portal } from './portal';
import { SUBCATEGORY_CATEGORY, indexDecisions, resolveTopic } from './topic-decisions';
import { UNCLASSIFIED } from './topic-rules';
import type { DatasetRecord } from './types';

/** L0 listed, L1 audited, L2 topics decided, L3 evaluated, L4 live, L5 activity. */
export type RolloutLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface RolloutFacts {
  snapshot: boolean;
  /** Datasets whose topic still needs a decision. */
  decisionsOpen: number;
  /** Gold labels exist and a person confirmed them. */
  goldConfirmed: boolean;
  /** No decision regressed a correct rule answer on the gold set. */
  evalPassed: boolean;
  liveVerified: boolean;
  usageMeasured: boolean;
}

/** The last gate passed; each level requires all earlier ones. */
export function rolloutLevel(facts: RolloutFacts): RolloutLevel {
  const gates = [
    facts.snapshot,
    facts.decisionsOpen === 0,
    facts.goldConfirmed && facts.evalPassed,
    facts.liveVerified,
    facts.usageMeasured,
  ];
  const passed = gates.findIndex(gate => !gate);
  return (passed === -1 ? 5 : passed) as RolloutLevel;
}

export type CellState = 'present' | 'not_found' | 'unchecked';
export interface CoverageCell { state: CellState; datasetIds: string[] }
export interface CoverageColumn { portal: Portal; level: RolloutLevel; total: number }
export interface CoverageRow { category: string; subcategory: string; cells: CoverageCell[]; present: number; notFound: number; unchecked: number }
export interface CoverageGrid { columns: CoverageColumn[]; rows: CoverageRow[] }

export const GAP_LEVEL: RolloutLevel = 3;

export function coverageGrid(inputs: ReadonlyArray<{ portal: Portal; level: RolloutLevel; datasets: readonly DatasetRecord[] }>): CoverageGrid {
  const perPortal = inputs.map(({ portal, datasets }) => {
    const decisions = indexDecisions(topicDecisionFile(portal.id));
    const bySub = new Map<string, string[]>();
    for (const dataset of datasets) {
      const { subcategory } = resolveTopic(dataset, decisions);
      bySub.set(subcategory, [...(bySub.get(subcategory) ?? []), dataset.id]);
    }
    return bySub;
  });
  const subcategories = [...SUBCATEGORY_CATEGORY.keys(), UNCLASSIFIED];
  const rows = subcategories.map(subcategory => {
    const cells = inputs.map(({ level }, index): CoverageCell => {
      const ids = perPortal[index].get(subcategory) ?? [];
      return { state: ids.length ? 'present' : level >= GAP_LEVEL ? 'not_found' : 'unchecked', datasetIds: ids };
    });
    return {
      category: SUBCATEGORY_CATEGORY.get(subcategory) ?? 'Other / review needed',
      subcategory,
      cells,
      present: cells.filter(cell => cell.state === 'present').length,
      notFound: cells.filter(cell => cell.state === 'not_found').length,
      unchecked: cells.filter(cell => cell.state === 'unchecked').length,
    };
  });
  return { columns: inputs.map(({ portal, level, datasets }) => ({ portal, level, total: datasets.length })), rows };
}

/** One row as a sentence: "Noise: present in BS; not found in 2 evaluated portals; unchecked in 5." */
export function describeRow(row: CoverageRow, columns: readonly CoverageColumn[]): string {
  const present = row.cells.flatMap((cell, index) => cell.state === 'present' ? [columns[index].portal.canton] : []);
  const parts = [present.length ? `present in ${present.join(', ')}` : 'present nowhere loaded'];
  if (row.notFound) parts.push(`not found in ${row.notFound} evaluated portal${row.notFound === 1 ? '' : 's'}`);
  if (row.unchecked) parts.push(`unchecked in ${row.unchecked}`);
  return `${row.subcategory}: ${parts.join('; ')}.`;
}
