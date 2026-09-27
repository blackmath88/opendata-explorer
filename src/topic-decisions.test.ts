import { describe, expect, it } from 'vitest';
import { fallbackDatasets } from './data/fallback';
import decisionFile from './data/portals/bs/topic-decisions.json';
import gold from './data/portals/bs/topic-gold.json';
import {
  TAXONOMY_VERSION, TOPIC_PROMPT_VERSION, buildTopicRequest, indexDecisions, metadataHash, needsDecision, resolveTopic, validateDecision,
  type TopicDecision, type TopicDecisionFile,
} from './topic-decisions';
import { assessTopic } from './topic-scoring';

const dataset = (id: string) => fallbackDatasets.find(item => item.id === id)!;
const stored = decisionFile as TopicDecisionFile;
const labels = (gold as { labels: Record<string, string[]> }).labels;

const decision = (id: string, patch: Partial<TopicDecision> = {}): TopicDecision => ({
  datasetId: id,
  metadataHash: metadataHash(dataset(id)),
  taxonomyVersion: TAXONOMY_VERSION,
  subcategory: 'Parking',
  confidence: 'high',
  evidence: [{ field: 'title', quote: 'Parkplatz-Zonen' }],
  rationale: 'test',
  decidedBy: { kind: 'model', source: 'test', promptVersion: TOPIC_PROMPT_VERSION },
  decidedAt: '2026-09-27',
  ...patch,
});

describe('topic decisions: validator', () => {
  it('accepts a decision whose quotes are in the cited fields', () => {
    expect(validateDecision(decision('100176'), dataset('100176'))).toEqual({ ok: true });
  });

  it('rejects an invented quote', () => {
    const check = validateDecision(decision('100176', { evidence: [{ field: 'title', quote: 'Parkhaus Messe' }] }), dataset('100176'));
    expect(check.ok).toBe(false);
  });

  it('rejects a real quote cited from the wrong field', () => {
    const check = validateDecision(decision('100176', { evidence: [{ field: 'keywords', quote: 'Parkplatz-Zonen' }] }), dataset('100176'));
    expect(check.ok).toBe(false);
  });

  it('rejects a subcategory outside the taxonomy', () => {
    const check = validateDecision(decision('100176', { subcategory: 'Car parks' }), dataset('100176'));
    expect(check).toMatchObject({ ok: false, reasons: [expect.stringContaining('not a subcategory')] });
  });

  it('rejects a decision made on other metadata or another taxonomy', () => {
    expect(validateDecision(decision('100176', { metadataHash: 'old' }), dataset('100176')).ok).toBe(false);
    expect(validateDecision(decision('100176', { taxonomyVersion: 'old' }), dataset('100176')).ok).toBe(false);
    const edited = { ...dataset('100176'), title: 'Smarte Strasse: Parkplatz-Zonen (neu)' };
    expect(validateDecision(decision('100176'), edited).ok).toBe(false);
  });

  it('requires evidence for a positive decision', () => {
    expect(validateDecision(decision('100176', { evidence: [] }), dataset('100176')).ok).toBe(false);
  });

  it('every stored decision is valid for the shipped snapshot', () => {
    for (const item of stored.decisions) expect([item.datasetId, validateDecision(item, dataset(item.datasetId))]).toEqual([item.datasetId, { ok: true }]);
  });
});

describe('topic decisions: precedence', () => {
  const rulesSay = assessTopic(dataset('100176')).pick.subcategory;

  it('the rules apply when there is no decision', () => {
    expect(resolveTopic(dataset('100176'), new Map())).toMatchObject({ source: 'rules', subcategory: rulesSay });
  });

  it('a medium/high model decision overrides the rules; a low one does not', () => {
    expect(resolveTopic(dataset('100176'), indexDecisions({ version: 1, decisions: [decision('100176')] }))).toMatchObject({ source: 'model', subcategory: 'Parking', category: 'Mobility & Transport' });
    expect(resolveTopic(dataset('100176'), indexDecisions({ version: 1, decisions: [decision('100176', { confidence: 'low' })] })).source).toBe('rules');
  });

  it('a human decision overrides a model decision', () => {
    const human = decision('100176', { subcategory: 'Road traffic', evidence: [{ field: 'keywords', quote: 'Smarte Strasse' }], decidedBy: { kind: 'human', source: 'reviewer', promptVersion: TOPIC_PROMPT_VERSION } });
    expect(resolveTopic(dataset('100176'), indexDecisions({ version: 1, decisions: [decision('100176'), human] }))).toMatchObject({ source: 'human', subcategory: 'Road traffic' });
  });

  it('an invalid decision is ignored, not trusted', () => {
    const forged = decision('100176', { evidence: [{ field: 'title', quote: 'Tiefgarage' }] });
    expect(resolveTopic(dataset('100176'), indexDecisions({ version: 1, decisions: [forged] })).source).toBe('rules');
  });

  it('a stored decision closes the request; a stale one reopens it', () => {
    expect(needsDecision(dataset('100176'), new Map())).toBe('conflict');
    expect(needsDecision(dataset('100176'), indexDecisions({ version: 1, decisions: [decision('100176')] }))).toBeNull();
    expect(needsDecision(dataset('100176'), indexDecisions({ version: 1, decisions: [decision('100176', { metadataHash: 'old' })] }))).toBe('conflict');
  });
});

describe('topic decisions: requests and evaluation', () => {
  it('a request offers only the taxonomy and carries no answer', () => {
    const request = buildTopicRequest(dataset('100176'), 'conflict');
    expect(request.allowed.some(item => item.subcategory === 'Parking')).toBe(true);
    expect(request).not.toHaveProperty('subcategory');
    expect(request.dataset.description.length).toBeLessThanOrEqual(1200);
  });

  it('decisions never turn a correct rule answer into a wrong one (gold set)', () => {
    const index = indexDecisions(stored);
    const ids = Object.keys(labels).filter(id => fallbackDatasets.some(item => item.id === id));
    const regressions = ids.filter(id => labels[id].includes(assessTopic(dataset(id)).pick.subcategory) && !labels[id].includes(resolveTopic(dataset(id), index).subcategory));
    expect(regressions).toEqual([]);
    const correct = ids.filter(id => labels[id].includes(resolveTopic(dataset(id), index).subcategory)).length;
    expect(correct).toBeGreaterThanOrEqual(42);
  });
});
