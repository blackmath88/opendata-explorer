import { describe, expect, it } from 'vitest';
import { FallbackCatalogueAdapter } from './fallback';
import { applyRecordSample, finestGrain, profileField, structureFromCatalogEntry } from './ods-structure';

const adapter = new FallbackCatalogueAdapter();

describe('profileField', () => {
  it('reads roles from the schema, not from guesswork, where the source declares them', () => {
    expect(profileField({ name: 'gml_id', type: 'text', annotations: { id: true } }).roleHints).toContain('identifier');
    expect(profileField({ name: 'temp_c', type: 'double', annotations: { unit: '°C' } }).unit).toBe('°C');
    expect(profileField({ name: 'geo_shape', type: 'geo_shape' }).roleHints).toContain('geometry');
    expect(profileField({ name: 'datum', type: 'date' }).roleHints).toContain('temporal');
  });

  it('falls back to a name heuristic only when the publisher declares nothing', () => {
    expect(profileField({ name: 'id_zst', type: 'text' }).roleHints).toContain('identifier');
    expect(profileField({ name: 'bemerkung', type: 'text' }).roleHints).toContain('free_text');
  });

  it('records that every hint came from the schema', () => {
    expect(profileField({ name: 'x', type: 'text' }).hintSource).toBe('schema');
  });
});

describe('finestGrain', () => {
  it('picks the finest declared grain', () => {
    expect(finestGrain(['year', 'hour', 'day'])).toBe('hour');
    expect(finestGrain([undefined, undefined])).toBeUndefined();
  });
});

describe('structureFromCatalogEntry', () => {
  it('reaches schema evidence with no record access', async () => {
    const structure = await adapter.inspectDataset('100052');
    expect(structure.observedFrom).toBe('schema');
    expect(structure.fields.length).toBeGreaterThan(5);
    expect(structure.geometry?.observedFrom).toBe('schema');
    expect(structure.geometry?.crs).toBe('EPSG:4326');
    expect(structure.geometry?.declaredTypes).toEqual(['Point']);
  });

  it('separates publisher-declared identifiers from name guesses', async () => {
    const structure = await adapter.inspectDataset('100052');
    const declared = structure.keyProfiles.filter(key => key.source === 'schema_annotation');
    expect(declared.map(key => key.field)).toContain('gml_id');
    // Declared identifiers are listed before guessed ones.
    expect(structure.keyProfiles[0].source).toBe('schema_annotation');
    expect(structure.candidateKeys).toEqual(structure.keyProfiles.map(key => key.field));
  });

  it('keeps the coverage window a metadata claim until records are read', async () => {
    const structure = await adapter.inspectDataset('100013');
    expect(structure.temporal?.observedFrom).toBe('schema');
    expect(structure.temporal?.coverageObservedFrom).toBe('catalog_metadata');
    expect(structure.recordCountObservedFrom).toBe('catalog_metadata');
  });

  it('notes a dataset the catalogue publishes with no records', async () => {
    const structure = await adapter.inspectDataset('100250');
    expect(structure.notes.join(' ')).toMatch(/zero records|no queryable records/i);
  });

  it('does not manufacture geometry for a dataset that exposes none', async () => {
    const structure = await adapter.inspectDataset('100357');
    expect(structure.geometry).toBeUndefined();
  });

  it('notes when no bounding box is published, so extent checks are impossible', () => {
    const structure = structureFromCatalogEntry({
      dataset_id: 'x',
      fields: [{ name: 'geo_point_2d', type: 'geo_point_2d' }],
      metas: { default: { geometry_types: ['Point'] } },
    });
    expect(structure.geometry?.extent).toBeUndefined();
    expect(structure.notes.join(' ')).toMatch(/bounding box/i);
  });

  it('flags geometry claimed in metadata but absent from the schema', () => {
    const structure = structureFromCatalogEntry({
      dataset_id: 'x',
      fields: [{ name: 'name', type: 'text' }],
      metas: { default: { geometry_types: ['Polygon'] } },
    });
    expect(structure.geometry?.observedFrom).toBe('catalog_metadata');
    expect(structure.notes.join(' ')).toMatch(/exposes no geometry field/i);
  });
});

describe('applyRecordSample', () => {
  it('raises the structure to sample evidence and attaches observed values', async () => {
    const base = await adapter.inspectDataset('100052');
    const sampled = applyRecordSample(
      base,
      [{ ba_baumnr: 'BR005946', ba_art: 'Carpinus betulus' }, { ba_baumnr: 'BR005947', ba_art: 'Carpinus betulus' }],
      { count: 32416, start: '1960-01-01', end: '2026-05-20', field: 'timeposition' },
    );
    expect(sampled.observedFrom).toBe('sample_records');
    const field = sampled.fields.find(item => item.name === 'ba_art')!;
    // Distinct values only, so a sample of repeats still shows one value.
    expect(field.sampleValues).toEqual(['Carpinus betulus']);
    expect(field.hintSource).toBe('sample_records');
    expect(sampled.temporal?.coverageObservedFrom).toBe('sample_records');
    expect(sampled.recordCountObservedFrom).toBe('sample_records');
  });

  it('warns when a candidate key is empty in every sampled record', async () => {
    const base = await adapter.inspectDataset('100052');
    const sampled = applyRecordSample(base, [{ gml_id: null }, { gml_id: '' }]);
    expect(sampled.notes.join(' ')).toMatch(/empty in every sampled record/i);
  });

  it('leaves the structure at schema level when the fallback cannot sample', async () => {
    const structure = await adapter.inspectDataset('100052', { sample: true });
    expect(structure.observedFrom).toBe('schema');
    expect(structure.notes.join(' ')).toMatch(/no records are available/i);
  });
});
