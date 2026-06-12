// pV2-06a — ItemsQuerySchema specs (Hygiene Rule 8).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ItemsQuerySchema, PAGE_SIZE } = require('./marketplace-query.schema');

test('defaults offset to 0 and strips unknown params', () => {
  const r = ItemsQuerySchema.safeParse({ evil: 'x' });
  assert.equal(r.success, true);
  assert.deepEqual(r.data, { offset: 0 });
});

test('coerces offset from the query string and bounds it', () => {
  assert.equal(ItemsQuerySchema.safeParse({ offset: '48' }).data.offset, 48);
  assert.equal(ItemsQuerySchema.safeParse({ offset: '-1' }).success, false);
});

test('rejects non-uuid cat/sub (no SQL ever sees raw input)', () => {
  assert.equal(ItemsQuerySchema.safeParse({ cat: 'florals' }).success, false);
  assert.equal(ItemsQuerySchema.safeParse({ sub: '1; DROP TABLE' }).success, false);
});

test('trims + bounds the search term', () => {
  assert.equal(ItemsQuerySchema.safeParse({ q: '  lights ' }).data.q, 'lights');
  assert.equal(ItemsQuerySchema.safeParse({ q: 'x'.repeat(81) }).success, false);
});

test('PAGE_SIZE is the locked 48', () => {
  assert.equal(PAGE_SIZE, 48);
});
