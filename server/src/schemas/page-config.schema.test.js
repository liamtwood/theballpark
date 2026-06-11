// pV2-04 — PageConfigSchema tests (security-path pure function, Rule 8).

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { PageConfigSchema } = require('./page-config.schema');

describe('PageConfigSchema', () => {
  test('accepts an empty object (all fields optional)', () => {
    const r = PageConfigSchema.safeParse({});
    assert.equal(r.success, true);
    assert.deepEqual(r.data, {});
  });

  test('accepts a full valid payload and trims strings', () => {
    const r = PageConfigSchema.safeParse({
      heroTitleMode: 'fixed', heroTitleFixed: '  Mission Control  ',
      heroSubtitle: 'Creative Agency Ltd', heroColor: 'none', heroAlign: 'center',
      showStats: false, showUpcoming: true, showQuickActions: true,
      showRecentActivity: false, showCredits: true, showSavedSuppliers: true,
      creditLabel: 'Token', eventLabel: 'Show', clientLabel: 'Brand',
    });
    assert.equal(r.success, true);
    assert.equal(r.data.heroTitleFixed, 'Mission Control');
  });

  test('rejects unknown enum values', () => {
    assert.equal(PageConfigSchema.safeParse({ heroTitleMode: 'banner' }).success, false);
    assert.equal(PageConfigSchema.safeParse({ heroColor: 'rainbow' }).success, false);
    assert.equal(PageConfigSchema.safeParse({ heroAlign: 'justify' }).success, false);
  });

  test('rejects wrong types on toggles', () => {
    assert.equal(PageConfigSchema.safeParse({ showStats: 'yes' }).success, false);
  });

  test('bounds label lengths (1-30) and hero strings', () => {
    assert.equal(PageConfigSchema.safeParse({ creditLabel: '' }).success, false);
    assert.equal(PageConfigSchema.safeParse({ creditLabel: 'x'.repeat(31) }).success, false);
    assert.equal(PageConfigSchema.safeParse({ heroSubtitle: 'x'.repeat(121) }).success, false);
  });

  test('strips unknown keys instead of failing (forward compat)', () => {
    const r = PageConfigSchema.safeParse({ showStats: true, retiredFlag: true });
    assert.equal(r.success, true);
    assert.deepEqual(r.data, { showStats: true });
  });
});
