import { metaColor } from './codelist.types';

describe('metaColor', () => {
  it('wraps design-token refs in var()', () => {
    expect(metaColor('--color-info')).toBe('var(--color-info)');
    expect(metaColor('--theme-accent')).toBe('var(--theme-accent)');
  });

  it('passes v1-era hex (and any literal CSS color) through untouched', () => {
    // Literal colors below are TEST DATA for the v1-hex pass-through path,
    // not styling — check-style-guards escape applies.
    expect(metaColor('#3b82f6')).toBe('#3b82f6'); // check-style-guards: test data
    expect(metaColor('rgb(59, 130, 246)')).toBe('rgb(59, 130, 246)'); // check-style-guards: test data
  });

  it('returns null for absent meta (pill falls back to neutral chrome)', () => {
    expect(metaColor(null)).toBeNull();
    expect(metaColor(undefined)).toBeNull();
    expect(metaColor('')).toBeNull();
  });
});
