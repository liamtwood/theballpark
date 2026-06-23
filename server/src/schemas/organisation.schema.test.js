// pV2 Profile — OrganisationUpdateSchema tests (run via `npm test`).

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { OrganisationUpdateSchema } = require('./organisation.schema');

describe('OrganisationUpdateSchema', () => {
  test('accepts a full valid payload, trims + uppercases refPrefix', () => {
    const r = OrganisationUpdateSchema.safeParse({
      name: '  Creative Agency Ltd ', address: '1 Main St', city: 'London',
      email: 'hello@agency.com', phone: '+44 20 1234', refPrefix: ' wa ',
      defaultVatPct: 20, defaultMarginPct: 15, defaultContingencyPct: 5,
    });
    assert.equal(r.success, true);
    assert.equal(r.data.name, 'Creative Agency Ltd');
    assert.equal(r.data.refPrefix, 'WA');
  });

  test('partial payloads are valid (only provided fields update)', () => {
    const r = OrganisationUpdateSchema.safeParse({ defaultVatPct: '17.5' });
    assert.equal(r.success, true);
    assert.equal(r.data.defaultVatPct, 17.5); // coerced
    assert.equal(r.data.name, undefined);
  });

  test('bounds: name 2-100, refPrefix ≤4, percents 0-100', () => {
    assert.equal(OrganisationUpdateSchema.safeParse({ name: 'x' }).success, false);
    assert.equal(OrganisationUpdateSchema.safeParse({ refPrefix: 'TOOLONG' }).success, false);
    assert.equal(OrganisationUpdateSchema.safeParse({ defaultVatPct: 101 }).success, false);
    assert.equal(OrganisationUpdateSchema.safeParse({ defaultMarginPct: -1 }).success, false);
  });

  test('email must be an email (empty string allowed = clearing)', () => {
    assert.equal(OrganisationUpdateSchema.safeParse({ email: 'not-an-email' }).success, false);
    assert.equal(OrganisationUpdateSchema.safeParse({ email: '' }).success, true);
  });

  test('unknown keys are stripped', () => {
    const r = OrganisationUpdateSchema.safeParse({ name: 'Okay Name', ballsBalance: 999999 });
    assert.equal(r.success, true);
    assert.deepEqual(Object.keys(r.data), ['name']);
  });
});
