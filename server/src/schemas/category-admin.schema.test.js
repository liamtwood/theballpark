// pV2-MARKET-00 — CategoryUpdateSchema specs (Hygiene Rule 8: pure
// functions in security paths are tested).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CategoryUpdateSchema } = require('./category-admin.schema');

test('accepts a partial update and strips unknown keys', () => {
  const r = CategoryUpdateSchema.safeParse({ name: ' Florals ', evil: 'x' });
  assert.equal(r.success, true);
  assert.deepEqual(r.data, { name: 'Florals' });
});

test('coerces sortOrder and bounds it', () => {
  assert.equal(CategoryUpdateSchema.safeParse({ sortOrder: '42' }).data.sortOrder, 42);
  assert.equal(CategoryUpdateSchema.safeParse({ sortOrder: -1 }).success, false);
  assert.equal(CategoryUpdateSchema.safeParse({ sortOrder: 1000 }).success, false);
});

test('rejects an empty patch (no editable fields)', () => {
  assert.equal(CategoryUpdateSchema.safeParse({}).success, false);
  assert.equal(CategoryUpdateSchema.safeParse({ evil: 'x' }).success, false);
});

test('rejects out-of-bounds name and non-boolean isActive', () => {
  assert.equal(CategoryUpdateSchema.safeParse({ name: 'x' }).success, false);
  assert.equal(CategoryUpdateSchema.safeParse({ isActive: 'yes' }).success, false);
});

test('allows clearing tagline with empty string', () => {
  const r = CategoryUpdateSchema.safeParse({ tagline: '' });
  assert.equal(r.success, true);
  assert.equal(r.data.tagline, '');
});
