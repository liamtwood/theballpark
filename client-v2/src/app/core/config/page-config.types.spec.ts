import { mergeConfig } from './page-config.types';

describe('mergeConfig', () => {
  it('overlays patch keys onto the base', () => {
    expect(mergeConfig({ heroAlign: 'center', creditLabel: 'Ball' }, { heroAlign: 'left' })).toEqual({
      heroAlign: 'left',
      creditLabel: 'Ball',
    });
  });

  it('treats a null base as empty', () => {
    expect(mergeConfig(null, { heroAlign: 'center' })).toEqual({ heroAlign: 'center' });
  });

  it('deletes keys patched to undefined (reset-to-default)', () => {
    expect(mergeConfig({ heroTitleFixed: 'Mission Control' }, { heroTitleFixed: undefined })).toEqual({});
  });

  it('does not mutate the base object', () => {
    const base = { creditLabel: 'Ball' };
    mergeConfig(base, { creditLabel: 'Token' });
    expect(base.creditLabel).toBe('Ball');
  });
});
