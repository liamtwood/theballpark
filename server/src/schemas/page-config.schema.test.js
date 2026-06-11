// pV2-04b — PageConfigSchema tests (run via `npm test`).

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
      heroSubtitle: 'What are we working on today?', heroAlign: 'left',
      creditLabel: 'Token', eventLabel: 'Show', clientLabel: 'Brand',
    });
    assert.equal(r.success, true);
    assert.equal(r.data.heroTitleFixed, 'Mission Control');
  });

  test('rejects unknown enum values', () => {
    assert.equal(PageConfigSchema.safeParse({ heroTitleMode: 'banner' }).success, false);
    assert.equal(PageConfigSchema.safeParse({ heroAlign: 'justify' }).success, false);
  });

  test('bounds label lengths (1-30) and hero strings', () => {
    assert.equal(PageConfigSchema.safeParse({ creditLabel: '' }).success, false);
    assert.equal(PageConfigSchema.safeParse({ creditLabel: 'x'.repeat(31) }).success, false);
    assert.equal(PageConfigSchema.safeParse({ heroSubtitle: 'x'.repeat(121) }).success, false);
  });

  test('strips unknown keys instead of failing (e.g. pV2-04-era section flags)', () => {
    const r = PageConfigSchema.safeParse({ heroAlign: 'center', showStats: false });
    assert.equal(r.success, true);
    assert.deepEqual(r.data, { heroAlign: 'center' });
  });
});
