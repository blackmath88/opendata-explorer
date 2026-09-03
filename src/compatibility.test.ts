import { describe, expect, it } from 'vitest';
import { assessCompatibility, keyNamesRelated, weakestEvidence } from './compatibility';
import { FallbackCatalogueAdapter } from './data/fallback';
import type { DatasetStructure, KeyOverlapEvidence } from './types';

const adapter = new FallbackCatalogueAdapter();
const structure = (id: string) => adapter.inspectDataset(id);

/** Minimal hand-built structure for rules the snapshot cannot exercise. */
function synthetic(overrides: Partial<DatasetStructure> & { datasetId: string }): DatasetStructure {
  return {
    fields: [],
    candidateKeys: [],
    keyProfiles: [],
    observedFrom: 'schema',
    notes: [],
    ...overrides,
  };
}

describe('geometry rules', () => {
  it('relates points to polygons as a spatial join', async () => {
    const result = assessCompatibility(await structure('100008'), await structure('100252'));
    expect(result.relation).toBe('spatial_join');
    expect(result.proposedOperation).toMatch(/within/);
    expect(result.evidenceLevel).toBe('schema_observed');
  });

  it('relates a point inventory to a line network as nearest, with a threshold warning', async () => {
    const result = assessCompatibility(await structure('100052'), await structure('100032'));
    expect(result.relation).toBe('nearest');
    expect(result.warnings.join(' ')).toMatch(/distance threshold/i);
  });

  it('requires interpolation for a sparse measurement series against a line network', async () => {
    const result = assessCompatibility(await structure('100050'), await structure('100189'));
    expect(result.relation).toBe('interpolation_required');
    expect(result.confidence).toBe('medium');
    expect(result.warnings.join(' ')).toMatch(/interpolat/i);
  });

  it('does not mistake a dated inventory for a measurement series', async () => {
    // The tree cadastre carries units and a planting date but is not a sample
    // of a continuous field, so it must not be routed to interpolation.
    const result = assessCompatibility(await structure('100052'), await structure('100251'));
    expect(result.relation).toBe('spatial_join');
  });

  it('returns unknown, not a guess, when one side has no geometry', async () => {
    const result = assessCompatibility(await structure('100357'), await structure('100032'));
    expect(result.relation).toBe('unknown');
    expect(result.warnings.join(' ')).toMatch(/no geometry/i);
  });

  it('returns incompatible when published extents do not intersect', async () => {
    const result = assessCompatibility(await structure('100176'), await structure('100278'));
    expect(result.relation).toBe('incompatible');
    expect(result.reasons.join(' ')).toMatch(/bounding boxes do not intersect/i);
    // A bounding box is a catalogue claim, whatever else we observed.
    expect(result.evidenceLevel).toBe('metadata_only');
  });

  it('flags a single-site extent instead of implying the subjects are unrelated', async () => {
    const result = assessCompatibility(await structure('100048'), await structure('100032'));
    expect(result.relation).toBe('incompatible');
    expect(result.warnings.join(' ')).toMatch(/single site/i);
  });
});

describe('key rules', () => {
  const base = {
    geometry: undefined,
    fields: [{ name: 'zst_nr', type: 'text', roleHints: ['identifier'] }],
  };
  const left = synthetic({
    ...base,
    datasetId: 'left',
    candidateKeys: ['zst_nr'],
    keyProfiles: [{ field: 'zst_nr', source: 'schema_annotation', type: 'text' }],
  });
  const right = synthetic({
    datasetId: 'right',
    fields: [{ name: 'id_zst', type: 'text', roleHints: ['identifier'] }],
    candidateKeys: ['id_zst'],
    keyProfiles: [{ field: 'id_zst', source: 'schema_annotation', type: 'text' }],
  });

  it('matches identifier names across token order', () => {
    expect(keyNamesRelated('zst_nr', 'id_zst')).toBe(true);
    expect(keyNamesRelated('gml_id', 'objectid')).toBe(false);
  });

  it('never claims a validated join from field names alone', () => {
    const result = assessCompatibility(left, right);
    expect(result.relation).toBe('direct_join');
    expect(result.confidence).toBe('low');
    expect(result.evidenceLevel).not.toBe('sample_validated');
    expect(result.warnings.join(' ')).toMatch(/candidate only/i);
  });

  it('raises the join to sample-validated when values actually overlap', () => {
    const evidence: KeyOverlapEvidence[] = [
      { leftField: 'zst_nr', rightField: 'id_zst', leftDistinct: 49, rightDistinct: 351, overlap: 47, bounded: false },
    ];
    const result = assessCompatibility(left, right, { keyEvidence: evidence });
    expect(result.relation).toBe('direct_join');
    expect(result.confidence).toBe('high');
    expect(result.evidenceLevel).toBe('sample_validated');
  });

  it('disproves a join when a complete value comparison finds no overlap', () => {
    const evidence: KeyOverlapEvidence[] = [
      { leftField: 'zst_nr', rightField: 'id_zst', leftDistinct: 40, rightDistinct: 40, overlap: 0, bounded: false },
    ];
    const result = assessCompatibility(left, right, { keyEvidence: evidence });
    expect(result.relation).toBe('unknown');
    expect(result.warnings.join(' ')).toMatch(/do not represent the same identifier/i);
  });

  it('refuses to read a capped comparison with no overlap as a disproof', () => {
    const evidence: KeyOverlapEvidence[] = [
      { leftField: 'zst_nr', rightField: 'id_zst', leftDistinct: 100, rightDistinct: 100, overlap: 0, bounded: true },
    ];
    const result = assessCompatibility(left, right, { keyEvidence: evidence });
    expect(result.relation).toBe('unknown');
    expect(result.evidenceLevel).not.toBe('sample_validated');
    expect(result.warnings.join(' ')).toMatch(/unverified rather than disproved/i);
  });
});

describe('temporal rules', () => {
  const spatial = {
    geometry: { type: 'Point', crs: 'EPSG:4326', observedFrom: 'schema' as const, declaredTypes: ['Point'], fields: ['geo_point_2d'] },
  };

  it('reports incompatible when coverages do not overlap', () => {
    const left = synthetic({
      datasetId: 'left',
      ...spatial,
      temporal: { fields: ['t'], start: '2010-01-01', end: '2012-12-31', grain: 'day', observedFrom: 'schema' },
    });
    const right = synthetic({
      datasetId: 'right',
      ...spatial,
      temporal: { fields: ['t'], start: '2020-01-01', end: '2022-12-31', grain: 'day', observedFrom: 'schema' },
    });
    const result = assessCompatibility(left, right);
    expect(result.relation).toBe('incompatible');
    expect(result.reasons.join(' ')).toMatch(/coverage does not overlap/i);
  });

  it('requires aggregation when the grains are far apart, without replacing the spatial relation', () => {
    const left = synthetic({
      datasetId: 'left',
      geometry: { type: 'Point', crs: 'EPSG:4326', observedFrom: 'schema', declaredTypes: ['Point'], fields: ['g'] },
      temporal: { fields: ['t'], start: '2020-01-01', end: '2026-01-01', grain: 'minute', observedFrom: 'schema' },
    });
    const right = synthetic({
      datasetId: 'right',
      geometry: { type: 'Polygon', crs: 'EPSG:4326', observedFrom: 'schema', declaredTypes: ['Polygon'], fields: ['g'] },
      temporal: { fields: ['t'], start: '2020-01-01', end: '2026-01-01', grain: 'year', observedFrom: 'schema' },
    });
    const result = assessCompatibility(left, right);
    expect(result.relation).toBe('spatial_join');
    expect(result.proposedOperation).toMatch(/aggregate minute values to year/);
    expect(result.warnings.join(' ')).toMatch(/grain differs/i);
  });

  it('offers a time-field join for two non-spatial series at the same grain, with a caveat', () => {
    const series = (id: string) =>
      synthetic({
        datasetId: id,
        temporal: { fields: ['datum_zeit'], start: '2024-01-01', end: '2026-01-01', grain: 'hour', observedFrom: 'schema' },
      });
    const result = assessCompatibility(series('a'), series('b'));
    expect(result.relation).toBe('direct_join');
    expect(result.warnings.join(' ')).toMatch(/not two places or entities/i);
  });
});

describe('evidence discipline', () => {
  it('reports the weaker of the two inputs', () => {
    expect(weakestEvidence('schema', 'catalog_metadata')).toBe('metadata_only');
    expect(weakestEvidence('sample_records', 'schema')).toBe('schema_observed');
    expect(weakestEvidence('sample_records', 'sample_records')).toBe('sample_validated');
  });

  it('returns unknown for two structureless datasets rather than inventing a link', () => {
    const result = assessCompatibility(synthetic({ datasetId: 'a' }), synthetic({ datasetId: 'b' }));
    expect(result.relation).toBe('unknown');
    expect(result.confidence).toBe('low');
    expect(result.reasons.join(' ')).toMatch(/no shared identifier/i);
  });
});
