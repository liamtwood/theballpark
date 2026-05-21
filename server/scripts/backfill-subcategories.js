/**
 * v1.41 — one-shot backfill of items.subcategory_id via TaxonomyService.
 *
 * Usage:
 *   node server/scripts/backfill-subcategories.js              # all items
 *   node server/scripts/backfill-subcategories.js <category_id> # one parent
 *
 * Idempotent — only touches items where subcategory_id IS NULL.
 * Re-running after a partial result is safe; nothing already
 * stamped will be re-queried.
 */
require('dotenv').config({
  path: require('path').resolve(__dirname, '../../.env'),
  override: true
});
const TaxonomyService = require('../src/services/taxonomy.service');

(async () => {
  const categoryId = process.argv[2] || undefined;
  console.log(`[backfill] starting${categoryId ? ' for category ' + categoryId : ' for all categories'}…`);
  const t0 = Date.now();
  try {
    const out = await TaxonomyService.backfillSubcategories(categoryId);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`[backfill] done in ${elapsed}s`);
    console.log('  processed:', out.processed);
    console.log('  updated:  ', out.updated);
    console.log('  skipped:  ', out.skipped, '(no match in vocabulary)');
    console.log('  errors:   ', out.errors);
    console.log('\nDistribution:');
    Object.entries(out.byCategory)
      .sort((a, b) => b[1] - a[1])
      .forEach(([k, n]) => console.log('  ' + String(n).padStart(3) + '  ' + k));
    process.exit(0);
  } catch (err) {
    console.error('[backfill] FAILED:', err.message);
    process.exit(1);
  }
})();
