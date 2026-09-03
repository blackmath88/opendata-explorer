import type {
  CandidateKeyProfile,
  DatasetStructure,
  FieldProfile,
  ObservationSource,
} from '../types';
import { asObject, asString, asNumber, asStringArray, bboxFromFeature, Json } from './ods';

/**
 * Opendatasoft field types we treat as structural. Everything else is data.
 */
const GEO_SHAPE = 'geo_shape';
const GEO_POINT = 'geo_point_2d';
const TEMPORAL_TYPES = new Set(['date', 'datetime']);

/** Finest to coarsest, so we can pick a dataset's finest declared grain. */
export const GRAIN_ORDER = ['minute', 'hour', 'day', 'month', 'year'] as const;
export type Grain = (typeof GRAIN_ORDER)[number];

/**
 * ODS Explore v2.1 always serves `geo_point_2d` / `geo_shape` as WGS84
 * lon/lat. That is an adapter-level guarantee, not something the catalogue
 * states per dataset, so it is recorded as such.
 */
export const ODS_CRS = 'EPSG:4326';

const IDENTIFIER_NAME = /^(id|.*_id|id_.*|.*nr|.*_nr|.*nummer|.*code|.*_code|objid|objectid|gml_id|uid|key|.*_key)$/i;
const REFERENCE_NAME = /(link|url|href|www|http)/i;
const MEASURE_NAME = /(anzahl|count|total|summe|sum|mittel|durchschnitt|avg|mean|wert|value|quote|index|score|rate|prozent|percent)/i;

/** Map one ODS field descriptor to a canonical profile. */
export function profileField(raw: Json): FieldProfile {
  const name = asString(raw.name);
  const type = asString(raw.type) || undefined;
  const annotations = asObject(raw.annotations);
  const unit = asString(annotations.unit) || undefined;

  const roleHints: string[] = [];
  if (type === GEO_SHAPE) roleHints.push('geometry');
  if (type === GEO_POINT) roleHints.push('geopoint');
  if (type && TEMPORAL_TYPES.has(type)) roleHints.push('temporal');
  if (annotations.id === true) roleHints.push('identifier');
  else if (IDENTIFIER_NAME.test(name) && (type === 'text' || type === 'int')) roleHints.push('identifier');
  if (unit) roleHints.push('measure');
  else if ((type === 'double' || type === 'int') && MEASURE_NAME.test(name)) roleHints.push('measure');
  if (REFERENCE_NAME.test(name)) roleHints.push('reference');
  if (!roleHints.length) roleHints.push(annotations.facet === true ? 'category' : 'free_text');

  return {
    name,
    type,
    label: asString(raw.label) || undefined,
    description: asString(raw.description) || undefined,
    unit,
    roleHints,
    // Field types, labels and annotations all come from the dataset schema.
    hintSource: 'schema',
  };
}

/** Candidate keys, keeping publisher-declared identifiers separate from guesses. */
export function candidateKeyProfiles(fields: FieldProfile[], rawFields: Json[]): CandidateKeyProfile[] {
  const annotated = new Set(
    rawFields.filter(f => asObject(f.annotations).id === true).map(f => asString(f.name)),
  );
  const profiles: CandidateKeyProfile[] = [];
  for (const field of fields) {
    if (!field.roleHints?.includes('identifier')) continue;
    profiles.push({
      field: field.name,
      source: annotated.has(field.name) ? 'schema_annotation' : 'name_heuristic',
      type: field.type,
    });
  }
  // Publisher-declared identifiers first; they are the only non-guessed ones.
  return profiles.sort((a, b) => (a.source === b.source ? 0 : a.source === 'schema_annotation' ? -1 : 1));
}

export function finestGrain(values: Array<string | undefined>): Grain | undefined {
  for (const grain of GRAIN_ORDER) if (values.includes(grain)) return grain;
  return undefined;
}

/**
 * Build a dataset structure from a catalogue entry alone.
 *
 * Basel's `/catalog/datasets` response embeds the full field schema, so this
 * reaches `schema` evidence with zero extra requests. Record sampling is a
 * separate, explicitly requested upgrade.
 */
export function structureFromCatalogEntry(entry: unknown): DatasetStructure {
  const raw = asObject(entry);
  const metas = asObject(raw.metas);
  const defaults = asObject(metas.default);
  const dcat = asObject(metas.dcat);
  const rawFields = Array.isArray(raw.fields) ? raw.fields.map(asObject) : [];
  const datasetId = asString(raw.dataset_id) || asString(raw.id);

  const fields = rawFields.map(profileField);
  const notes: string[] = [];

  // ---- geometry ----------------------------------------------------------
  const declaredTypes = asStringArray(defaults.geometry_types);
  const geometryFields = fields
    .filter(f => f.roleHints?.includes('geometry') || f.roleHints?.includes('geopoint'))
    .map(f => f.name);
  const extent = bboxFromFeature(defaults.bbox);

  let geometry: DatasetStructure['geometry'];
  if (declaredTypes.length || geometryFields.length) {
    // Observing a geometry-bearing field is stronger than a metadata claim.
    const observedFrom: ObservationSource = geometryFields.length ? 'schema' : 'catalog_metadata';
    let type = declaredTypes[0];
    if (!type) {
      type = rawFields.some(f => asString(f.type) === GEO_SHAPE) ? 'Unknown' : 'Point';
      notes.push(
        `Geometry type is not declared by the source; inferred "${type}" from the schema field types.`,
      );
    }
    if (declaredTypes.length && !geometryFields.length) {
      notes.push('The catalogue declares geometry but the schema exposes no geometry field.');
    }
    geometry = { type, crs: ODS_CRS, extent, observedFrom, declaredTypes, fields: geometryFields };
    if (!extent) notes.push('No bounding box is published, so spatial extent overlap cannot be checked.');
  }

  // ---- temporal ----------------------------------------------------------
  const temporalFields = fields.filter(f => f.roleHints?.includes('temporal')).map(f => f.name);
  const grain = finestGrain(
    rawFields.map(f => asString(asObject(f.annotations).timeserie_precision) || undefined),
  );
  const start = asString(dcat.temporal_coverage_start) || undefined;
  const end = asString(dcat.temporal_coverage_end) || undefined;

  let temporal: DatasetStructure['temporal'];
  if (temporalFields.length || start || end) {
    temporal = {
      fields: temporalFields,
      start,
      end,
      grain,
      observedFrom: temporalFields.length ? 'schema' : 'catalog_metadata',
      coverageObservedFrom: start || end ? 'catalog_metadata' : undefined,
    };
    if (!temporalFields.length) {
      notes.push('Temporal coverage is claimed in metadata but no date field is exposed in the schema.');
    }
  }

  // ---- keys and counts ---------------------------------------------------
  const keyProfiles = candidateKeyProfiles(fields, rawFields);
  const recordCount = asNumber(defaults.records_count);

  if (raw.has_records === false) notes.push('The source publishes metadata but no queryable records.');
  else if (recordCount === 0) notes.push('The source reports zero records for this dataset.');
  if (!fields.length) notes.push('The catalogue entry exposes no field schema.');

  return {
    datasetId,
    fields,
    geometry,
    temporal,
    candidateKeys: keyProfiles.map(k => k.field),
    keyProfiles,
    recordCount,
    recordCountObservedFrom: recordCount === undefined ? undefined : 'catalog_metadata',
    observedFrom: fields.length ? 'schema' : 'catalog_metadata',
    notes,
  };
}

/**
 * Fold a bounded record sample into an existing structure.
 *
 * `records` is a small page of rows; `aggregate` is an optional
 * `min`/`max`/`count` result over the whole dataset, which ODS computes
 * server-side far more cheaply than paging would.
 */
export function applyRecordSample(
  structure: DatasetStructure,
  records: Json[],
  aggregate?: { start?: string; end?: string; count?: number; field?: string },
): DatasetStructure {
  const notes = [...structure.notes];
  const fields = structure.fields.map(field => {
    const values = records
      .map(row => row[field.name])
      .filter(value => value !== null && value !== undefined && value !== '');
    const seen = new Set<string>();
    const sampleValues: unknown[] = [];
    for (const value of values) {
      const token = JSON.stringify(value);
      if (seen.has(token)) continue;
      seen.add(token);
      sampleValues.push(value);
      if (sampleValues.length >= 3) break;
    }
    if (!sampleValues.length) return field;
    return { ...field, sampleValues, hintSource: 'sample_records' as const };
  });

  // A field the schema declares but every sampled row leaves empty is worth
  // flagging: it is a common reason a "candidate join key" turns out useless.
  const emptyKeys = structure.keyProfiles
    .filter(key => records.length > 0 && records.every(row => row[key.field] === null || row[key.field] === undefined || row[key.field] === ''))
    .map(key => key.field);
  if (emptyKeys.length) {
    notes.push(`Candidate key(s) ${emptyKeys.join(', ')} were empty in every sampled record.`);
  }

  let temporal = structure.temporal;
  if (temporal && aggregate && (aggregate.start || aggregate.end)) {
    temporal = {
      ...temporal,
      start: aggregate.start ?? temporal.start,
      end: aggregate.end ?? temporal.end,
      coverageObservedFrom: 'sample_records',
    };
    if (aggregate.field) {
      notes.push(
        `Temporal coverage observed from stored values of "${aggregate.field}" (server-side min/max over all records).`,
      );
    }
  }

  return {
    ...structure,
    fields,
    temporal,
    recordCount: aggregate?.count ?? structure.recordCount,
    recordCountObservedFrom: aggregate?.count === undefined ? structure.recordCountObservedFrom : 'sample_records',
    observedFrom: 'sample_records',
    notes,
  };
}
