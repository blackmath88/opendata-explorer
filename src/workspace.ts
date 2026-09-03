import type {
  CatalogueAdapter,
  CompatibilityAssessment,
  DatasetRecord,
  DatasetStructure,
  KeyOverlapEvidence,
} from './types';
import { assessCompatibility } from './compatibility';

/**
 * Orchestration between the adapter, the structure inspector and the
 * compatibility engine.
 *
 * Its whole job is to keep the work bounded. Inspecting a workspace must cost a
 * predictable, small number of requests regardless of how many datasets the
 * user selected, because the alternative is hammering a public API.
 */

/** Datasets inspected with record sampling in one pass. */
const MAX_SAMPLED_DATASETS = 8;
/** Pairs assessed in one pass. */
const MAX_PAIRS = 21;
/** Value-level key probes per pass, across all pairs. */
const MAX_KEY_PROBES = 6;

export interface WorkspaceEntry {
  dataset: DatasetRecord;
  structure?: DatasetStructure;
  error?: string;
}

export interface PairAssessment {
  left: DatasetRecord;
  right: DatasetRecord;
  assessment: CompatibilityAssessment;
}

export interface WorkspaceAnalysis {
  entries: WorkspaceEntry[];
  pairs: PairAssessment[];
  /** Bounds that were hit, so the UI can say what was left out. */
  notes: string[];
}

export async function analyseWorkspace(
  adapter: CatalogueAdapter,
  datasets: DatasetRecord[],
): Promise<WorkspaceAnalysis> {
  const notes: string[] = [];

  const sampleBudget = Math.min(datasets.length, MAX_SAMPLED_DATASETS);
  if (datasets.length > sampleBudget) {
    notes.push(
      `Record sampling was limited to the first ${sampleBudget} datasets; the rest were inspected at schema level only.`,
    );
  }

  const entries: WorkspaceEntry[] = await Promise.all(
    datasets.map(async (dataset, index) => {
      try {
        const structure = await adapter.inspectDataset(dataset.id, { sample: index < sampleBudget });
        return { dataset, structure };
      } catch (error) {
        return { dataset, error: error instanceof Error ? error.message : 'Inspection failed' };
      }
    }),
  );

  const inspected = entries.filter((entry): entry is Required<Pick<WorkspaceEntry, 'dataset' | 'structure'>> =>
    Boolean(entry.structure),
  );

  const combinations: Array<[typeof inspected[number], typeof inspected[number]]> = [];
  for (let i = 0; i < inspected.length; i += 1) {
    for (let j = i + 1; j < inspected.length; j += 1) combinations.push([inspected[i], inspected[j]]);
  }
  if (combinations.length > MAX_PAIRS) {
    notes.push(`${combinations.length} dataset pairs exist; the first ${MAX_PAIRS} were assessed.`);
  }

  let keyProbes = 0;
  const pairs: PairAssessment[] = [];

  for (const [left, right] of combinations.slice(0, MAX_PAIRS)) {
    const keyEvidence: KeyOverlapEvidence[] = [];

    if (adapter.sampleKeyOverlap) {
      for (const leftKey of left.structure.keyProfiles) {
        for (const rightKey of right.structure.keyProfiles) {
          if (keyProbes >= MAX_KEY_PROBES) break;
          // Only spend a probe where the names already suggest a pairing.
          if (!namesWorthProbing(leftKey.field, rightKey.field)) continue;
          keyProbes += 1;
          const evidence = await adapter.sampleKeyOverlap(
            { datasetId: left.dataset.id, field: leftKey.field, type: leftKey.type },
            { datasetId: right.dataset.id, field: rightKey.field, type: rightKey.type },
          );
          if (evidence) keyEvidence.push(evidence);
        }
      }
    }

    pairs.push({
      left: left.dataset,
      right: right.dataset,
      assessment: assessCompatibility(left.structure, right.structure, { keyEvidence }),
    });
  }

  if (keyProbes >= MAX_KEY_PROBES) {
    notes.push(`Value-level key checks were capped at ${MAX_KEY_PROBES}; remaining key pairs stay candidates.`);
  }
  if (!adapter.sampleKeyOverlap) {
    notes.push('This catalogue source cannot read records, so no relationship can reach sample-validated evidence.');
  }

  return { entries, pairs, notes };
}

/** Cheap pre-filter so probes are only spent on plausible pairings. */
function namesWorthProbing(left: string, right: string): boolean {
  const tokens = (name: string) =>
    name.toLowerCase().split(/[^a-z0-9]+/).filter(token => token.length > 2 && token !== 'the');
  if (left.toLowerCase() === right.toLowerCase()) return true;
  const leftTokens = new Set(tokens(left));
  return tokens(right).some(token => leftTokens.has(token));
}
