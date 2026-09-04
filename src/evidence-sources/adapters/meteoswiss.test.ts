import { describe, expect, it, vi } from 'vitest';
import { MeteoSwissAdapter, parseSemicolonCsv } from './meteoswiss';

describe('MeteoSwiss adapter', () => {
  it('parses the official semicolon-delimited observation shape', () => {
    expect(parseSemicolonCsv('station_abbr;reference_timestamp;tre200s0\nbas;2026-09-03T10:00:00Z;21.4')).toEqual([
      { station_abbr: 'bas', reference_timestamp: '2026-09-03T10:00:00Z', tre200s0: '21.4' },
    ]);
  });

  it('discovers Basel stations and retrieves only the bounded current asset', async () => {
    const stac = {
      items: vi.fn().mockResolvedValue([{ id: 'pbs', assets: { 'ogd-pollen_pbs_h_now.csv': { href: 'https://example.test/ogd-pollen_pbs_h_now.csv' } } }]),
      text: vi.fn().mockResolvedValue('station_abbr;reference_timestamp\npbs;now'),
    };
    const result = await new MeteoSwissAdapter(stac as never).currentObservations('pollen', 'pbs');
    expect(stac.items).toHaveBeenCalledWith(expect.stringContaining('ogd-pollen'), { bbox: [7.5, 47.5, 7.7, 47.65], limit: 10 });
    expect(stac.text).toHaveBeenCalledWith('https://example.test/ogd-pollen_pbs_h_now.csv');
    expect(result.records[0].station_abbr).toBe('pbs');
  });
});
