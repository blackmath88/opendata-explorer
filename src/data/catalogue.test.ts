import { afterEach, describe, expect, it, vi } from 'vitest';
import { BASEL_STADT, GENEVE } from '../portal';
import { openCatalogue } from './catalogue';

afterEach(() => vi.unstubAllGlobals());

describe('openCatalogue', () => {
  it('falls back to the shipped snapshot for Basel-Stadt', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const session = await openCatalogue(BASEL_STADT);
    expect(session.state.source).toBe('fallback');
    expect(session.state.datasets.length).toBeGreaterThan(0);
  });

  it('never shows Basel data for another portal: empty, with the reason', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')));
    const session = await openCatalogue(GENEVE);
    expect(session.state).toMatchObject({ source: 'fallback', datasets: [], error: 'Failed to fetch' });
    expect(session.state.notes[0]).toMatch(/Genève .* no offline snapshot/);
  });
});
