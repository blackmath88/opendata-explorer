import { describe, expect, it } from 'vitest';
import { fillMonths, parseGeometries, projector, renderPortrait, type Geometry } from './portrait';

describe('portrait', () => {
  it('puts months without records back as zero, so gaps stay visible', () => {
    expect(fillMonths([{ period: '2025-11', n: 3 }, { period: '2026-02', n: 5 }])).toEqual([
      { period: '2025-11', n: 3 }, { period: '2025-12', n: 0 }, { period: '2026-01', n: 0 }, { period: '2026-02', n: 5 },
    ]);
    expect(fillMonths([])).toEqual([]);
  });

  it('keeps only real geometries from a GeoJSON export', () => {
    const parsed = parseGeometries({ features: [{ geometry: { type: 'Point', coordinates: [7.59, 47.56] } }, { geometry: null }, { geometry: { type: 'GeometryCollection', coordinates: [] } }] });
    expect(parsed).toEqual([{ type: 'Point', coordinates: [7.59, 47.56] }]);
  });

  it('fits every position inside the drawing, north up', () => {
    const geometries: Geometry[] = [{ type: 'Point', coordinates: [7.55, 47.52] }, { type: 'LineString', coordinates: [[7.6, 47.58], [7.7, 47.6]] }];
    const project = projector(geometries);
    const points = [[7.55, 47.52], [7.6, 47.58], [7.7, 47.6]].map(([lon, lat]) => project(lon, lat));
    for (const [x, y] of points) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(320); expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(180); }
    expect(points[0][1]).toBeGreaterThan(points[2][1]); // further south is lower
  });

  it('says what a portrait is and is not', () => {
    const map = renderPortrait({ kind: 'map', geometries: [{ type: 'Point', coordinates: [7.6, 47.56] }], total: 1234 });
    expect(map).toContain('1 of 1’234 features'.replace('’', "'"));
    expect(map).toContain('not a statement about coverage');
    const series = renderPortrait({ kind: 'series', field: 'datum', periods: [{ period: '2026-01', n: 4 }, { period: '2026-02', n: 0 }], truncated: false });
    expect(series).toContain('months without records show as gaps');
    const table = renderPortrait({ kind: 'table', fields: [{ name: 'a', label: 'A <b>' }], fieldTotal: 9, rows: [{ a: 'x' }], total: 50 });
    expect(table).toContain('A &lt;b&gt;');
    expect(table).toContain('1 of 50 rows, 1 of 9 fields');
    expect(renderPortrait({ kind: 'none', reason: 'No records.' })).toContain('No records.');
  });
});
