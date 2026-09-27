import { describe, expect, it } from 'vitest';
import { ATLAS_SPECS, dataForm, subcategoryGlyph } from './atlas-spec';
import { fallbackDatasets } from './data/fallback';
import { isReady, pickDoorway } from './doorway';
import { ICONS } from './ui/icons';
import { TOPIC_RULES } from './topic-rules';
import type { DatasetRecord } from './types';
import { downloadsPerMonth, parseUsageRows } from './usage';

const base = fallbackDatasets.find(dataset => isReady(dataset))!;
const make = (id: string, patch: Partial<DatasetRecord> = {}): DatasetRecord => ({ ...base, id, ...patch });
const now = new Date('2026-09-27');

describe('atlas spec', () => {
  it('names only real subcategories and real icons', () => {
    const subcategories = new Map(TOPIC_RULES.map(([category, subs]) => [category, new Set(subs.map(([name]) => name))]));
    for (const [category, spec] of Object.entries(ATLAS_SPECS)) {
      expect(subcategories.has(category)).toBe(true);
      for (const [sub, glyph] of Object.entries(spec.subcategories)) {
        expect(subcategories.get(category)!.has(sub)).toBe(true);
        expect(glyph in ICONS).toBe(true);
      }
      expect(spec.emblem in ICONS && spec.fallback in ICONS).toBe(true);
      expect(subcategoryGlyph(spec, 'Something new')).toBe(spec.fallback);
    }
  });

  it('reads a table with a time dimension as a time series, geometry first otherwise', () => {
    const table = make('t', { characteristics: { ...base.characteristics, geospatial: false, geometryTypes: [], timeSeries: true } });
    expect(dataForm(table)).toBe('series');
    expect(dataForm({ ...table, characteristics: { ...table.characteristics, timeSeries: false } })).toBe('table');
  });
});

describe('usage', () => {
  it('normalises downloads by age, never below one month', () => {
    expect(downloadsPerMonth({ downloads: 1200, apiCalls: 0, reuses: 0, created: '2025-09-27' }, now)).toBeCloseTo(1200 / 12, 0);
    expect(downloadsPerMonth({ downloads: 50, apiCalls: 0, reuses: 0, created: '2026-09-20' }, now)).toBe(50);
    expect(downloadsPerMonth({ downloads: 50, apiCalls: 0, reuses: 0 }, now)).toBeUndefined();
  });

  it('parses the portal rows and skips rows without id', () => {
    const index = parseUsageRows([{ dataset_identifier: 'a', download_count: 3, api_call_count: 9, reuse_count: 1, created: '2020-01-01' }, { download_count: 1 }]);
    expect([...index.keys()]).toEqual(['a']);
    expect(index.get('a')).toEqual({ downloads: 3, apiCalls: 9, reuses: 1, created: '2020-01-01' });
  });
});

describe('doorway', () => {
  const a = make('a'), b = make('b'), c = make('c');
  const usage = parseUsageRows([
    { dataset_identifier: 'a', download_count: 9000, reuse_count: 0, created: '2020-09-27' },
    { dataset_identifier: 'b', download_count: 600, reuse_count: 2, created: '2020-09-27' },
    { dataset_identifier: 'c', download_count: 1200, reuse_count: 0, created: '2020-09-27' },
  ]);

  it('picks the ready dataset with the fewest downloads a month, preferring no documented reuse', () => {
    const door = pickDoorway([a, b, c], usage, now)!;
    expect(door.dataset.id).toBe('c');
    expect(door.basis).toBe('usage');
    expect(door.reason).toMatch(/Rarely used: about 17 downloads a month, no documented reuse/);
  });

  it('never picks a dataset that is not ready', () => {
    const empty = make('d', { recordsCount: 3 });
    const bare = make('e', { description: 'short' });
    const usageAll = parseUsageRows([{ dataset_identifier: 'd', download_count: 0, created: '2020-01-01' }, { dataset_identifier: 'e', download_count: 0, created: '2020-01-01' }, { dataset_identifier: 'c', download_count: 1200, created: '2020-09-27' }]);
    expect(pickDoorway([empty, bare, c], usageAll, now)!.dataset.id).toBe('c');
    expect(pickDoorway([empty, bare], usageAll, now)).toBeNull();
  });

  it('falls back to the most completely described dataset and says why', () => {
    const rich = make('r', { description: base.description.padEnd(500, ' more words'), fieldCount: 30 });
    expect(pickDoorway([a, rich], null, now)).toMatchObject({ dataset: { id: 'r' }, basis: 'metadata', reason: expect.stringContaining('publishes no usage figures') });
    expect(pickDoorway([a, rich], parseUsageRows([]), now)!.reason).toContain('no publication date');
  });

  it('is deterministic: the order of the input does not matter', () => {
    expect(pickDoorway([c, b, a], usage, now)!.dataset.id).toBe(pickDoorway([a, b, c], usage, now)!.dataset.id);
  });
});
