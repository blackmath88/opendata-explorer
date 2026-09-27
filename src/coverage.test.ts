import { describe, expect, it } from 'vitest';
import { coverageGrid, describeRow, rolloutLevel, type RolloutFacts } from './coverage';
import { fallbackDatasets } from './data/fallback';
import { BASEL_STADT, type Portal } from './portal';
import { topicProvenance } from './topic-provenance';

const other: Portal = { ...BASEL_STADT, id: 'xx', canton: 'XX', shortLabel: 'Testkanton OGD', verified: false, snapshot: false };
const none: RolloutFacts = { snapshot: false, decisionsOpen: 1, goldConfirmed: false, evalPassed: false, liveVerified: false, usageMeasured: false };

describe('rollout levels', () => {
  it('each level needs every earlier gate', () => {
    expect(rolloutLevel(none)).toBe(0);
    expect(rolloutLevel({ ...none, snapshot: true })).toBe(1);
    expect(rolloutLevel({ ...none, snapshot: true, decisionsOpen: 0 })).toBe(2);
    expect(rolloutLevel({ ...none, snapshot: true, decisionsOpen: 0, goldConfirmed: true, evalPassed: true })).toBe(3);
    // Live and usage do not count while topics were never evaluated.
    expect(rolloutLevel({ ...none, snapshot: true, decisionsOpen: 0, liveVerified: true, usageMeasured: true })).toBe(2);
    // Basel today: snapshot, no open decisions, gold still a draft.
    expect(rolloutLevel({ ...none, snapshot: true, decisionsOpen: 0, evalPassed: true })).toBe(2);
  });
});

describe('coverage grid', () => {
  const half = fallbackDatasets.slice(0, 20);
  const grid = coverageGrid([
    { portal: BASEL_STADT, level: 3, datasets: fallbackDatasets },
    { portal: other, level: 1, datasets: half },
  ]);

  it('conserves counts: each column sums to its portal\'s datasets', () => {
    grid.columns.forEach((column, index) => {
      expect(grid.rows.reduce((sum, row) => sum + row.cells[index].datasetIds.length, 0)).toBe(column.total);
    });
  });

  it('an empty cell is a gap only where topics were evaluated', () => {
    const empty = grid.rows.find(row => row.cells[0].datasetIds.length === 0 && row.cells[1].datasetIds.length === 0)!;
    expect(empty.cells.map(cell => cell.state)).toEqual(['not_found', 'unchecked']);
    expect(describeRow(empty, grid.columns)).toBe(`${empty.subcategory}: present nowhere loaded; not found in 1 evaluated portal; unchecked in 1.`);
  });

  it('agrees with the Landscape on the active portal', () => {
    const noise = grid.rows.find(row => row.subcategory === 'Noise')!;
    expect(noise.cells[0].state).toBe('present');
    expect(noise.cells[0].datasetIds.sort()).toEqual(['100087', '100170']);
  });
});

describe('topic provenance', () => {
  it('says what the topic lens rests on, and whether anyone checked it', () => {
    const basel = topicProvenance(fallbackDatasets, BASEL_STADT);
    expect(basel.byModel).toBeGreaterThan(0);
    expect(basel.evaluation).toMatchObject({ labelled: 44, confirmed: false });
    expect(basel.label).toMatch(/draft gold labels, not yet confirmed/);
    const unknown = topicProvenance(fallbackDatasets, other);
    expect(unknown).toMatchObject({ byModel: 0, byHuman: 0, evaluation: undefined });
    expect(unknown.label).toBe('Keyword rules only · not evaluated for Testkanton OGD');
  });
});
