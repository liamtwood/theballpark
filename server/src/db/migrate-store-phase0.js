// pV2-STORE-IMPORT-01 Phase 0 — one-off, idempotent data migration for
// existing items: re-point the free-text `unit` onto the pruned 5 (each,
// per_guest, platter, time, size) and backfill `tier` onto the item_tier
// codelist codes. Run AFTER the codelist seed (codelists-seed.js) so the
// target codes exist.
//
// Mappings (confirmed with chat, 2026-09-17):
//   UNIT:
//     each, event, job, box, sheet, pack, roll → each   (event is a FLAT fee)
//     head                                      → per_guest
//     sqm                                       → size
//     day/week/night                            → time  (+ time_unit = the original)
//   TIER:
//     mid → standard · basic → budget · premium → premium(unchanged) · null → null
//
// items.unit is free-text (NOT codelist-validated) — that's why it drifted.
// Idempotent: each UPDATE filters on the OLD value, so a second run is a no-op.
//
// Usage: node server/src/db/migrate-store-phase0.js

const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

async function dist(client, col) {
  const r = await client.query(
    `SELECT COALESCE(${col}, '(null)') AS v, count(*)::int AS n
       FROM public.items GROUP BY 1 ORDER BY n DESC`
  );
  return r.rows.map((x) => `${x.v}:${x.n}`).join('  ');
}

(async () => {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    console.log('BEFORE  unit:', await dist(client, 'unit'));
    console.log('BEFORE  tier:', await dist(client, 'tier'));

    await client.query('BEGIN');

    // ── UNIT re-point ──────────────────────────────────────────────────
    const each = await client.query(
      `UPDATE public.items SET unit = 'each', updated_at = NOW()
        WHERE unit IN ('event', 'job', 'box', 'sheet', 'pack', 'roll')`
    );
    const perGuest = await client.query(
      `UPDATE public.items SET unit = 'per_guest', updated_at = NOW() WHERE unit = 'head'`
    );
    const size = await client.query(
      `UPDATE public.items SET unit = 'size', updated_at = NOW() WHERE unit = 'sqm'`
    );
    // time: preserve granularity into time_unit; each stmt filters the OLD unit.
    let time = 0;
    for (const g of ['day', 'week', 'night']) {
      const r = await client.query(
        `UPDATE public.items SET unit = 'time', time_unit = $1, updated_at = NOW() WHERE unit = $1`,
        [g]
      );
      time += r.rowCount;
    }

    // ── TIER backfill ──────────────────────────────────────────────────
    const tierMid = await client.query(
      `UPDATE public.items SET tier = 'standard', updated_at = NOW() WHERE tier = 'mid'`
    );
    const tierBasic = await client.query(
      `UPDATE public.items SET tier = 'budget', updated_at = NOW() WHERE tier = 'basic'`
    );
    // 'premium' already a valid item_tier code; nulls left as-is (per spec).

    await client.query('COMMIT');

    console.log(`\nunit → each:${each.rowCount}  per_guest:${perGuest.rowCount}  size:${size.rowCount}  time:${time}`);
    console.log(`tier → standard(from mid):${tierMid.rowCount}  budget(from basic):${tierBasic.rowCount}`);
    console.log('\nAFTER   unit:', await dist(client, 'unit'));
    console.log('AFTER   tier:', await dist(client, 'tier'));

    // Guard: nothing should remain on a retired unit value.
    const stray = await client.query(
      `SELECT COALESCE(unit,'(null)') AS v, count(*)::int AS n FROM public.items
        WHERE unit IS NULL OR unit NOT IN ('each','per_guest','platter','time','size')
        GROUP BY 1`
    );
    if (stray.rows.length) {
      console.log('\nNOTE — units outside the pruned 5 remain:', stray.rows.map((r) => `${r.v}:${r.n}`).join(', '));
    } else {
      console.log('\nAll items.unit values are within the pruned 5. ✓');
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
