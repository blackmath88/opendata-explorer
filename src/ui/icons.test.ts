import { describe, expect, it } from 'vitest';
import { ICONS, ICON_CATALOGUE, icon, type IconName } from './icons';

describe('icon set', () => {
  it('catalogues every icon exactly once', () => {
    const catalogued = ICON_CATALOGUE.flatMap(group => group.icons.map(entry => entry.name));
    expect(new Set(catalogued).size).toBe(catalogued.length);
    expect([...catalogued].sort()).toEqual((Object.keys(ICONS) as IconName[]).sort());
  });

  it('is decorative by default and named when labelled', () => {
    expect(icon('add')).toContain('aria-hidden="true"');
    expect(icon('add', { label: 'Add "x"' })).toContain('aria-label="Add &quot;x&quot;"');
  });

  it('draws inside the 24-unit grid with the shared stroke', () => {
    for (const name of Object.keys(ICONS) as IconName[]) {
      const numbers = ICONS[name].match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
      expect(numbers.every(value => Math.abs(value) <= 24), name).toBe(true);
      expect(ICONS[name]).not.toMatch(/stroke-width/);
    }
  });
});
