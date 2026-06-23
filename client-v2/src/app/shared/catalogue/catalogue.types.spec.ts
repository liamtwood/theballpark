import { asViewMode } from './catalogue.types';

describe('asViewMode', () => {
  it('passes through the two non-default modes', () => {
    expect(asViewMode('list')).toBe('list');
    expect(asViewMode('table')).toBe('table');
  });

  it('defaults everything else to card (untrusted ?view= input)', () => {
    expect(asViewMode(null)).toBe('card');
    expect(asViewMode('card')).toBe('card');
    expect(asViewMode('grid')).toBe('card');
    expect(asViewMode('<script>')).toBe('card');
  });
});
