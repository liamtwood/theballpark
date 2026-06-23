// pV2-06d — suppliers/favourites schema specs (Hygiene Rule 8).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { SuppliersQuerySchema, FavouriteToggleSchema } = require('./marketplace-suppliers.schema');

test('suppliers query defaults offset and strips unknowns', () => {
  const r = SuppliersQuerySchema.safeParse({ junk: 1 });
  assert.equal(r.success, true);
  assert.deepEqual(r.data, { offset: 0 });
});

test('suppliers query rejects non-uuid cat and overlong q', () => {
  assert.equal(SuppliersQuerySchema.safeParse({ cat: 'florals' }).success, false);
  assert.equal(SuppliersQuerySchema.safeParse({ q: 'x'.repeat(81) }).success, false);
});

test('favourite toggle accepts the two entity types only', () => {
  const ok = FavouriteToggleSchema.safeParse({
    type: 'supplier',
    refId: '5488cde0-ba0d-48a2-a599-d00d04aa655e',
  });
  assert.equal(ok.success, true);
  assert.equal(FavouriteToggleSchema.safeParse({ type: 'category', refId: '5488cde0-ba0d-48a2-a599-d00d04aa655e' }).success, false);
  assert.equal(FavouriteToggleSchema.safeParse({ type: 'item', refId: 'nope' }).success, false);
});
