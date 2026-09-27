import { describe, expect, it } from 'vitest';
import type { DatasetRecord } from '../types';
import { fallbackDatasets } from './fallback';
import { mergeCatalogues, splitIdentifier } from './duplicates';

const copy = (id: string, identifier?: string): DatasetRecord => ({ ...fallbackDatasets[0], id, identifier });
const primary = fallbackDatasets.slice(0, 3);
const [a, b] = primary.map(dataset => dataset.id);

describe('duplicate linking', () => {
  it('splits DCAT identifiers at the last @', () => {
    expect(splitIdentifier('100052@kanton-basel-stadt')).toEqual({ local: '100052', publisher: 'kanton-basel-stadt' });
    expect(splitIdentifier('a@b@c')).toEqual({ local: 'a@b', publisher: 'c' });
    expect(splitIdentifier('no-publisher')).toBeUndefined();
    expect(splitIdentifier('@x')).toBeUndefined();
  });

  it('links national copies of the canton\'s own datasets and counts each dataset once', () => {
    const national = [copy('slug-a', `${a}@kanton-x`), copy('slug-b', `${b}@kanton-x`), copy('only-national', 'z1@kanton-x'), copy('federal', 'q@bfs')];
    const merge = mergeCatalogues(primary, national, ['kanton-x']);
    expect([...merge.linked]).toEqual([[a, 'slug-a'], [b, 'slug-b']]);
    expect(merge.nationalOnly).toEqual(['only-national', 'federal']);
    expect(merge.unmatched).toEqual(['only-national']);
    expect(merge.datasets).toHaveLength(primary.length + 2);
    expect(merge.datasets.length).toBe(primary.length + national.length - merge.linked.size);
  });

  it('does not link under another publisher, and links a local id only once', () => {
    const merge = mergeCatalogues(primary, [copy('s1', `${a}@someone-else`), copy('s2', `${b}@kanton-x`), copy('s3', `${b}@kanton-x`)], ['kanton-x']);
    expect([...merge.linked]).toEqual([[b, 's2']]);
    expect(merge.nationalOnly).toEqual(['s1', 's3']);
  });

  it('refuses an id collision instead of silently shadowing a dataset', () => {
    expect(() => mergeCatalogues(primary, [copy(a, 'x@other')], ['kanton-x'])).toThrow(/collide/);
  });
});
