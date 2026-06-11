import { mergeConfig, sectionVisible } from './page-config.types';

describe('mergeConfig', () => {
  it('overlays patch keys onto the base', () => {
    expect(mergeConfig({ showStats: true, creditLabel: 'Ball' }, { showStats: false })).toEqual({
      showStats: false,
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
    const base = { showCredits: true };
    mergeConfig(base, { showCredits: false });
    expect(base.showCredits).toBe(true);
  });
});

describe('sectionVisible', () => {
  it('defaults to visible when the config is null', () => {
    expect(sectionVisible(null, 'showStats')).toBe(true);
  });

  it('defaults to visible when the flag is unset', () => {
    expect(sectionVisible({}, 'showUpcoming')).toBe(true);
  });

  it('honours an explicit false', () => {
    expect(sectionVisible({ showQuickActions: false }, 'showQuickActions')).toBe(false);
  });

  it('honours an explicit true', () => {
    expect(sectionVisible({ showSavedSuppliers: true }, 'showSavedSuppliers')).toBe(true);
  });
});
