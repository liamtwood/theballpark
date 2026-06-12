// pV2-CODELISTS-01 — schema + Rule-8 pure-fn specs.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  CodelistValueCreateSchema,
  CodelistValuePatchSchema,
  ListNameSchema,
} = require('./codelist-value.schema');
const { consumerRef, CONSUMER_WHITELIST } = require('../services/codelist.consumers');

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

test('consumerRef: whitelist gates identifiers (Rule 8)', () => {
  assert.equal(consumerRef({ consumer_table: 'items', consumer_column: 'unit' }), 'items.unit');
  // A poisoned parent row must NEVER reach SQL identifiers:
  assert.equal(consumerRef({ consumer_table: 'users; DROP TABLE x', consumer_column: 'status' }), null);
  assert.equal(consumerRef({ consumer_table: 'pg_shadow', consumer_column: 'passwd' }), null);
  assert.equal(consumerRef({ consumer_table: null, consumer_column: 'status' }), null);
  assert.equal(consumerRef(null), null);
});
