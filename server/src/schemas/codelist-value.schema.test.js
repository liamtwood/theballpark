// pV2-CODELISTS-01 — schema + Rule-8 pure-fn specs.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  CodelistValueCreateSchema,
  CodelistValuePatchSchema,
  ListNameSchema,
} = require('./codelist-value.schema');
const { isSafeIdentifier, CONSUMER_WHITELIST } = require('../services/codelist.consumers');

test('create: accepts a clean value and strips unknowns', () => {
  const r = CodelistValueCreateSchema.safeParse({ code: 'SGD', label: 'SGD (S$)', symbol: 'S$', evil: 1 });
  assert.equal(r.success, true);
  assert.deepEqual(Object.keys(r.data).sort(), ['code', 'label', 'symbol']);
});

test('create: rejects bad codes (spaces, SQL-ish, overlong)', () => {
  assert.equal(CodelistValueCreateSchema.safeParse({ code: 'two words', label: 'X' }).success, false);
  assert.equal(CodelistValueCreateSchema.safeParse({ code: "a';--", label: 'X' }).success, false);
  assert.equal(CodelistValueCreateSchema.safeParse({ code: 'x'.repeat(51), label: 'X' }).success, false);
});

test('patch: rejects an empty patch; accepts isActive flip', () => {
  assert.equal(CodelistValuePatchSchema.safeParse({}).success, false);
  assert.equal(CodelistValuePatchSchema.safeParse({ isActive: false }).success, true);
  assert.equal(CodelistValuePatchSchema.safeParse({ isActive: 'no' }).success, false);
});

test('list-name param: snake_case only', () => {
  assert.equal(ListNameSchema.safeParse('item_unit').success, true);
  assert.equal(ListNameSchema.safeParse('Item Unit').success, false);
  assert.equal(ListNameSchema.safeParse('items;drop').success, false);
});

test('whitelist entries are bare lowercase identifiers (audit F-1 contract)', () => {
  for (const ref of CONSUMER_WHITELIST) {
    assert.match(ref, /^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/, `bad whitelist entry: ${ref}`);
  }
});

test('isSafeIdentifier: shape-guards consumer identifiers before SQL (Rule 8)', () => {
  // Registry identifiers are interpolated into SQL — only bare snake identifiers pass.
  assert.equal(isSafeIdentifier('items'), true);
  assert.equal(isSafeIdentifier('approval_status'), true);
  // A poisoned registry row must NEVER reach SQL identifiers:
  assert.equal(isSafeIdentifier('users; DROP TABLE x'), false);
  assert.equal(isSafeIdentifier('a.b'), false);
  assert.equal(isSafeIdentifier('Items'), false); // uppercase → fail closed
  assert.equal(isSafeIdentifier(null), false);
  assert.equal(isSafeIdentifier(''), false);
});
