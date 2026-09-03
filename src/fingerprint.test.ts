import { describe, expect, it } from 'vitest';
import { canonicalJson, hashString, structureFingerprint } from './fingerprint';
import { assessCompatibility, assessmentId, assessmentInputs, isAssessmentStale, LEVEL_ORDER } from './compatibility';
import { FallbackCatalogueAdapter } from './data/fallback';
import type { DatasetStructure, KeyOverlapEvidence } from './types';

const adapter = new FallbackCatalogueAdapter();
const structure = (id: string) => adapter.inspectDataset(id);

describe('canonicalJson', () => {
  it('serialises structurally equal objects identically regardless of key order', () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
  });

  it('does not confuse an omitted key with a present one', () => {
    expect(canonicalJson({ a: 1 })).not.toBe(canonicalJson({ a: 1, b: null }));
  });

  it('preserves array order, which is meaningful', () => {
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });
});

describe('hashString', () => {
  it('is deterministic and sensitive to small changes', () => {
    expect(hashString('abc')).toBe(hashString('abc'));
    expect(hashString('abc')).not.toBe(hashString('abd'));
  });
});

describe('structureFingerprint', () => {
  it('is stable across repeated inspection of unchanged data', async () => {
    expect(structureFingerprint(await structure('100052'))).toBe(structureFingerprint(await structure('100052')));
  });

  it('distinguishes different datasets', async () => {
    expect(structureFingerprint(await structure('100052'))).not.toBe(structureFingerprint(await structure('100008')));
  });

  it('changes when something the rules read changes', async () => {
    const base = await structure('100052');
    const moved: DatasetStructure = {
      ...base,
      geometry: { ...base.geometry!, extent: [0, 0, 1, 1] },
    };
    expect(structureFingerprint(moved)).not.toBe(structureFingerprint(base));
  });

  it('ignores sample values and notes, which no rule reads', async () => {
    const base = await structure('100052');
    const noisy: DatasetStructure = {
      ...base,
      notes: [...base.notes, 'an extra note'],
      fields: base.fields.map(field => ({ ...field, sampleValues: ['whatever'] })),
    };
    expect(structureFingerprint(noisy)).toBe(structureFingerprint(base));
  });
});

describe('assessment identity', () => {
  it('gives the same id to the same inputs, so results can be matched back', async () => {
    const [left, right] = await Promise.all([structure('100008'), structure('100252')]);
    expect(assessCompatibility(left, right).id).toBe(assessCompatibility(left, right).id);
  });

  it('records the fingerprints it was computed from', async () => {
    const [left, right] = await Promise.all([structure('100008'), structure('100252')]);
    const assessment = assessCompatibility(left, right);
    expect(assessment.inputs.leftStructureFingerprint).toBe(structureFingerprint(left));
    expect(assessment.inputs.rightStructureFingerprint).toBe(structureFingerprint(right));
    expect(assessment.leftStructureRef).toBe(assessment.inputs.leftStructureFingerprint);
    expect(assessment.inputs.ruleVersion).toBeTruthy();
    expect(Date.parse(assessment.assessedAt)).not.toBeNaN();
  });

  it('changes the id when value-level key evidence changes the conclusion', async () => {
    const [left, right] = await Promise.all([structure('100013'), structure('100038')]);
    const plain = assessCompatibility(left, right);
    const evidence: KeyOverlapEvidence[] = [
      { leftField: 'zst_nr', rightField: 'id_zst', leftDistinct: 49, rightDistinct: 351, overlap: 47, bounded: false },
    ];
    const validated = assessCompatibility(left, right, { keyEvidence: evidence });
    expect(validated.id).not.toBe(plain.id);
    expect(validated.inputs.keyEvidenceFingerprint).toBeTruthy();
    expect(plain.inputs.keyEvidenceFingerprint).toBeUndefined();
  });

  it('is order-sensitive, because left and right are not interchangeable', async () => {
    const [a, b] = await Promise.all([structure('100008'), structure('100252')]);
    expect(assessCompatibility(a, b).id).not.toBe(assessCompatibility(b, a).id);
  });

  it('detects a stale assessment when a structure moves underneath it', async () => {
    const [left, right] = await Promise.all([structure('100008'), structure('100252')]);
    const assessment = assessCompatibility(left, right);
    expect(isAssessmentStale(assessment, left, right)).toBe(false);

    const changed: DatasetStructure = { ...right, recordCount: (right.recordCount ?? 0) + 1 };
    expect(isAssessmentStale(assessment, left, changed)).toBe(true);
  });

  it('changes the id when the rule version changes', async () => {
    const [left, right] = await Promise.all([structure('100008'), structure('100252')]);
    const inputs = assessmentInputs(left, right);
    expect(assessmentId({ ...inputs, ruleVersion: 'other' })).not.toBe(assessmentId(inputs));
  });
});

describe('evidence ladder', () => {
  it('places execution above sampling as a separate rung', () => {
    expect(LEVEL_ORDER).toEqual(['metadata_only', 'schema_observed', 'sample_validated', 'execution_validated']);
    expect(LEVEL_ORDER.indexOf('execution_validated')).toBeGreaterThan(LEVEL_ORDER.indexOf('sample_validated'));
  });

  it('is never reached by structural rules alone', async () => {
    const [left, right] = await Promise.all([structure('100008'), structure('100252')]);
    expect(assessCompatibility(left, right).evidenceLevel).not.toBe('execution_validated');
  });
});
