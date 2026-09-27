import { describe, expect, it } from 'vitest';
import { coverSvg, overdue, printSeed, recordBand, spineSvg, SPINE_WIDTH, wrapTitle, type CoverInput } from './cover';
import { fallbackDatasets } from './data/fallback';
import type { DatasetRecord } from './types';

const base = fallbackDatasets[0];
const now = new Date('2026-09-27');
const make = (patch: Partial<DatasetRecord> = {}, characteristics: Partial<DatasetRecord['characteristics']> = {}): DatasetRecord =>
  ({ ...base, ...patch, characteristics: { ...base.characteristics, ...characteristics } });
const input = (dataset: DatasetRecord, patch: Partial<CoverInput> = {}): CoverInput => ({
  dataset, category: 'Mobility & Transport', subcategory: 'Cycling', signals: { reuses: 0, overdue: 0, doorway: false }, ...patch,
});

describe('covers: facts to channels', () => {
  it('bands record counts on a log scale; unknown is the thinnest band', () => {
    expect([undefined, 5, 29, 30, 999, 1000, 29_999, 30_000, 999_999, 1_000_000].map(recordBand)).toEqual([0, 0, 0, 1, 1, 2, 2, 3, 3, 4]);
    expect(SPINE_WIDTH[0]).toBeLessThan(SPINE_WIDTH[4]);
  });

  it('ages a dataset only against its own declared rhythm; static and irregular never age', () => {
    const monthly = make({ modified: '2026-03-01' }, { updateFrequency: 'monthly' });
    expect(overdue(monthly, now).level).toBeGreaterThan(0);
    expect(overdue(monthly, now).note).toMatch(/Declared monthly, last changed 7 months ago/);
    expect(overdue(make({ modified: '2026-08-15' }, { updateFrequency: 'monthly' }), now).level).toBe(0);
    for (const cadence of ['never', 'irreg', 'as needed', undefined]) {
      expect(overdue(make({ modified: '2010-01-01' }, { updateFrequency: cadence }), now).level).toBe(0);
    }
  });

  it('is deterministic: same input, same cover', () => {
    const dataset = make();
    expect(coverSvg(input(dataset))).toBe(coverSvg(input(dataset)));
  });

  it('shows reuse, doorway and patina only when they are facts', () => {
    const dataset = make();
    const plain = coverSvg(input(dataset));
    expect(plain).not.toContain('READY · RARE');
    expect(plain).not.toContain('url(#pat-');
    const marked = coverSvg(input(dataset, { signals: { reuses: 7, overdue: 0.5, overdueNote: 'Declared monthly, last changed 7 months ago.', doorway: true } }));
    expect(marked).toContain('READY · RARE');
    expect(marked).toContain('url(#pat-');
    expect((marked.match(/stroke="#8a3f3f"/g) ?? []).length).toBe(5); // notches cap at 5
    expect(marked).toContain('7 documented reuses');
  });

  it('never invents cover art: an unknown form is dashed, a missing sample shows the form mark alone', () => {
    const unknown = make({ hasRecords: true }, { geospatial: true, geometryTypes: [] });
    expect(coverSvg(input(unknown))).toContain('stroke-dasharray="3 3"');
    const noSample = coverSvg(input(make({}, { geospatial: true, geometryTypes: ['Point'] })));
    expect(noSample).not.toContain('r="1.6"'); // sample points are the only r=1.6 circles
  });

  it('draws the sample: points at their positions, months as bars, columns as a weave', () => {
    const points = coverSvg(input(make({}, { geospatial: true, geometryTypes: ['Point'] }), { sample: { geometries: [{ type: 'Point', coordinates: [7.58, 47.55] }, { type: 'Point', coordinates: [7.6, 47.57] }] } }));
    expect((points.match(/r="1\.6"/g) ?? []).length).toBe(2);
    const series = coverSvg(input(make({}, { geospatial: false, geometryTypes: [], timeSeries: true }), { sample: { periods: [{ period: '2026-01', n: 3 }, { period: '2026-02', n: 0 }, { period: '2026-03', n: 6 }] } }));
    expect((series.match(/<rect x="/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('escapes titles and keeps them to three lines', () => {
    const svg = coverSvg(input(make({ title: 'Parks <b> & "Plätze" in Basel, eine sehr lange Beschreibung mit vielen Wörtern' })));
    expect(svg).toContain('&lt;b&gt; &amp; &quot;Plätze&quot;');
    expect(wrapTitle('eins zwei drei vier fünf sechs sieben acht neun zehn', 12, 2).length).toBe(2);
    expect(wrapTitle('eins zwei drei vier fünf sechs sieben acht neun zehn', 12, 2)[1]).toMatch(/…$/);
    expect(spineSvg(input(make()))).toContain('<svg class="spine"');
  });

  it('prints with a per-dataset seed, and never filters text', () => {
    const a = make({ id: '100418' }, { geospatial: false, geometryTypes: [], timeSeries: true });
    const b = make({ id: '100033' });
    expect(printSeed('100418')).toBe(printSeed('100418'));
    expect(printSeed('100418')).not.toBe(printSeed('100033'));
    const series = coverSvg(input(a, { sample: { periods: [{ period: '2025-01', n: 3 }, { period: '2026-02', n: 5 }] } }));
    expect(series).toContain(`seed="${printSeed('100418')}"`);
    expect(coverSvg(input(b))).not.toContain(`id="ink-100418"`);
    // No <text> element may sit inside a group that carries the ink filter.
    for (const group of series.match(/<g[^>]*filter="url\(#ink-[^"]*\)"[^>]*>[\s\S]*?<\/g>/g) ?? []) expect(group).not.toContain('<text');
    expect(series).toContain('>2025</text>');
  });
});
