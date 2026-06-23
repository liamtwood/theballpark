// pV2-AUDIT-03 — schema tests (run via `npm test`). The schema is a
// security-path pure function per WORKING_STANDARDS §"Pure functions in
// security paths are tested".

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { CreateOrgSchema } = require('./onboarding.schema');

describe('CreateOrgSchema', () => {
  test('accepts a valid agency payload and trims the name', () => {
    const r = CreateOrgSchema.safeParse({ orgType: 'agency', orgName: '  Anchor Events  ' });
    assert.equal(r.success, true);
    assert.deepEqual(r.data, { orgType: 'agency', orgName: 'Anchor Events' });
  });

  test('accepts supplier', () => {
    assert.equal(CreateOrgSchema.safeParse({ orgType: 'supplier', orgName: 'Studio Volta' }).success, true);
  });

  test('rejects unknown org types', () => {
    const r = CreateOrgSchema.safeParse({ orgType: 'casino', orgName: 'Lucky Sevens' });
    assert.equal(r.success, false);
  });

  test('rejects names shorter than 2 after trimming', () => {
    assert.equal(CreateOrgSchema.safeParse({ orgType: 'agency', orgName: ' x ' }).success, false);
  });

  test('rejects names longer than 100', () => {
    assert.equal(CreateOrgSchema.safeParse({ orgType: 'agency', orgName: 'x'.repeat(101) }).success, false);
  });

  test('rejects missing fields and non-strings', () => {
    assert.equal(CreateOrgSchema.safeParse({}).success, false);
    assert.equal(CreateOrgSchema.safeParse({ orgType: 'agency', orgName: 42 }).success, false);
    assert.equal(CreateOrgSchema.safeParse(undefined).success, false);
  });
});
