import { beforeAll, describe, expect, it } from 'vitest';
import { BaselOpendatasoftAdapter } from '../data/basel';
import { assessCompatibility } from '../compatibility';
import { GeoJsonExecutionEngine } from './engine';
import { OdsGeoJsonSource } from './source';
import { planAggregate, planOperation } from './operations';
import type { DatasetRecord, DatasetStructure } from '../types';
import type { ExecutionResult, SpatialOperation } from './types';

/**
 * Live executions against data.bs.ch.
 *
 * Excluded from `npm test`; run with `npm run test:live`. These assert
 * behavioural invariants that must hold whatever the data says — never a
 * specific match count, which would break the moment Basel republishes.
 *
 * The console output is the raw material for docs/BASEL_EXECUTION_FINDINGS.md.
 */

const adapter = new BaselOpendatasoftAdapter();
let datasets: DatasetRecord[] = [];
let engine: GeoJsonExecutionEngine;
const structures = new Map<string, DatasetStructure>();

const title = (id: string) => datasets.find(d => d.id === id)?.title ?? id;

beforeAll(async () => {
  datasets = await adapter.listDatasets();
  engine = new GeoJsonExecutionEngine(
    new OdsGeoJsonSource(new Map(datasets.map(d => [d.id, d.recordsCount]))),
  );
});

async function structureOf(id: string): Promise<DatasetStructure> {
  const cached = structures.get(id);
  if (cached) return cached;
  const structure = await adapter.inspectDataset(id);
  structures.set(id, structure);
  return structure;
}

interface Run {
  assessmentRelation: string;
  confidence: string;
  evidenceBefore: string;
  operation: SpatialOperation;
  result: ExecutionResult;
}

async function run(leftId: string, rightId: string, options = {}): Promise<Run> {
  const [left, right] = await Promise.all([structureOf(leftId), structureOf(rightId)]);
  const assessment = assessCompatibility(left, right);
  const plan = planOperation(assessment, left, right, options);
  if (!plan.ok) throw new Error(`could not plan: ${plan.reason}`);

  const result = await engine.execute(plan.operation);

  console.log(`\n### ${title(leftId)}  ↔  ${title(rightId)}`);
  console.log(`  proposal   ${assessment.relation} / ${assessment.confidence} / ${assessment.evidenceLevel}`);
  console.log(`  assessment ${assessment.id}`);
  console.log(`  operation  ${plan.operation.type}  ${plan.operation.id}`);
  console.log(`  params     ${JSON.stringify(plan.operation.parameters)}`);
  console.log(`  execution  ${result.id}`);
  console.log(`  STATUS     ${result.status.toUpperCase()}  confirmed=${result.validation.confirmed}`);
  for (const snap of result.sourceSnapshots) {
    console.log(`  source     ${snap.datasetId} ${snap.recordCount}/${snap.totalRecordCount ?? '?'} features${snap.truncated ? ' (TRUNCATED)' : ''} ${snap.geometryTypes?.join(',')}`);
  }
  if (result.output) console.log(`  output     ${result.output.type} ${JSON.stringify(result.output.summary)}`);
  result.validation.reasons.forEach(r => console.log(`  +          ${r}`));
  result.validation.warnings.forEach(w => console.log(`  !          ${w}`));
  if (result.error) console.log(`  ERROR      ${result.error.code}: ${result.error.message}`);

  return {
    assessmentRelation: assessment.relation,
    confidence: assessment.confidence,
    evidenceBefore: assessment.evidenceLevel,
    operation: plan.operation,
    result,
  };
}

describe('live Basel executions', () => {
  it('A. fountains within traffic-calmed zones — containment', async () => {
    const { result, assessmentRelation } = await run('100008', '100252');
    expect(assessmentRelation).toBe('spatial_join');
    expect(result.error).toBeUndefined();
    expect(['confirmed', 'rejected', 'partial']).toContain(result.status);
    expect(result.evidenceLevel).toBe('execution_validated');
    // Whatever the count, the run must record what it read.
    expect(result.sourceSnapshots).toHaveLength(2);
    expect(result.sourceSnapshots.every(s => s.retrievedAt && s.fingerprint)).toBe(true);
  });

  it('B. bicycle parking within pedestrian zones — containment', async () => {
    const { result } = await run('100241', '100251');
    expect(result.error).toBeUndefined();
  });

  it('C. bike pumps near everyday cycle routes — nearest', async () => {
    const { result, assessmentRelation } = await run('100213', '100032');
    expect(assessmentRelation).toBe('nearest');
    expect(result.output?.summary?.thresholdMeters).toBeDefined();
    expect(result.output?.summary?.medianMeters).toBeDefined();
  });

  it('D. fountains near everyday cycle routes — nearest, expected to strain', async () => {
    const { result } = await run('100008', '100032');
    // No assertion that it passes. The distance distribution is the finding.
    expect(result.output?.summary?.coverage).toBeDefined();
  });

  it('E. trees near cycle routes — nearest over a truncated input', async () => {
    const { result } = await run('100052', '100032');
    // 32k trees against a 5k budget: the honest answer is partial or rejected,
    // never a clean confirmation.
    expect(result.sourceSnapshots.some(s => s.truncated)).toBe(true);
    expect(result.status).not.toBe('confirmed');
  });

  it('F. verifies an incompatible verdict rather than leaving it unchecked', async () => {
    const [left, right] = await Promise.all([structureOf('100176'), structureOf('100278')]);
    const assessment = assessCompatibility(left, right);
    expect(assessment.relation).toBe('incompatible');

    const plan = planOperation(assessment, left, right);
    if (!plan.ok) throw new Error(plan.reason);
    const result = await engine.execute(plan.operation);

    console.log(`\n### ${title('100176')}  ↔  ${title('100278')}`);
    console.log(`  proposal   ${assessment.relation} / ${assessment.confidence} / ${assessment.evidenceLevel}`);
    console.log(`  STATUS     ${result.status.toUpperCase()}  confirmed=${result.validation.confirmed}`);
    result.validation.reasons.forEach(r => console.log(`  +          ${r}`));
    if (result.error) console.log(`  ERROR      ${result.error.code}: ${result.error.message}`);

    // Execution should agree that these do not relate.
    expect(result.validation.confirmed).toBe(true);
    expect(result.output?.recordCount ?? 0).toBe(0);
  });

  it('G. aggregates an executed relationship into a derived measure', async () => {
    const { result: join } = await run('100008', '100252');
    const plan = planAggregate(join);
    if (!plan.ok) throw new Error(plan.reason);

    const aggregate = await engine.execute(plan.operation);
    console.log(`\n### aggregate over ${join.id}`);
    console.log(`  ${aggregate.output?.type} ${JSON.stringify(aggregate.output?.summary)}`);

    // Provenance survives the second hop.
    expect(aggregate.assessmentId).toBe(join.assessmentId);
    expect(plan.operation.createdFrom).toBe('execution_result');
    expect(aggregate.evidenceLevel).toBe('execution_validated');
  });
});
