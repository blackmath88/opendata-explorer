/**
 * Visual vocabulary of the atlas (docs/ICON_SPEC_MOBILITY.md). Three jobs, never mixed:
 *  - category emblem: recognise a territory from a distance;
 *  - subcategory glyph: which aspect of it you are entering;
 *  - data-form mark: what you can inspect, independent of topic.
 * Only categories whose subcategories were checked get a spec; the rest keep the plain card.
 */
import { shapeOf } from './catalogue-profile';
import type { DatasetRecord } from './types';
import type { IconName } from './ui/icons';

export interface CategorySpec {
  emblem: IconName;
  subcategories: Readonly<Record<string, IconName>>;
  /** For a subcategory without its own glyph (catch-alls, later additions). */
  fallback: IconName;
}

export const ATLAS_SPECS: Readonly<Record<string, CategorySpec>> = {
  'Mobility & Transport': {
    emblem: 'mob-emblem',
    subcategories: {
      'Road traffic': 'mob-road',
      Cycling: 'mob-cycling',
      Walking: 'mob-walking',
      Parking: 'mob-parking',
      'Public transport': 'mob-transit',
    },
    fallback: 'mob-other',
  },
};

export function subcategoryGlyph(spec: CategorySpec, subcategory: string): IconName {
  return spec.subcategories[subcategory] ?? spec.fallback;
}

export type DataForm = 'point' | 'line' | 'area' | 'mixed' | 'raster' | 'series' | 'table' | 'unknown';

export const FORM_MARK: Readonly<Record<DataForm, IconName>> = {
  point: 'geo-point', line: 'geo-line', area: 'geo-polygon', mixed: 'geo-mixed', raster: 'geo-raster',
  series: 'rep-time-series', table: 'geo-none', unknown: 'form-unknown',
};

export const FORM_LABEL: Readonly<Record<DataForm, string>> = {
  point: 'points', line: 'lines', area: 'areas', mixed: 'mixed geometry', raster: 'map service / file',
  series: 'time series', table: 'table', unknown: 'form unknown',
};

/**
 * What a dataset *is* structurally. Geometry wins over time: a sensor station with hourly
 * values is inspected as points first. A table with a time dimension reads as a time series.
 */
export function dataForm(dataset: DatasetRecord): DataForm {
  const shape = shapeOf(dataset);
  if (shape === 'table') return dataset.characteristics.timeSeries ? 'series' : 'table';
  return shape;
}
