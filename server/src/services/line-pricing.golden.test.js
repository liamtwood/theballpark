// pV2-PRICING-SSOT-01 Part C — the GOLDEN CONTRACT TEST.
//
// Runs the SAME case matrix through BOTH implementations of the one per-line
// pricing definition and asserts they agree:
//   • the canonical TS/JS module   — line-pricing.js  (lineTotal)
//   • the SQL mirror               — line-total.util.js (lineTotalSql), executed
//                                     against Postgres over a synthetic pi/i row
// If the SQL and the module ever diverge, this test fails — that is what makes
// the SSOT bulletproof (a comment is not a guard, WORKING_STANDARDS #1). Change
// a pricing rule → change line-pricing.js AND line-total.util.js → this test
// proves parity.
//
// Needs a Postgres connection (DIRECT_URL / DATABASE_URL, read-only synthetic
// rows — it touches no tables). If none is configured the test SKIPS with a
// notice rather than hard-failing an env with no DB.

const path = require('path');
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');

// DIRECT_URL lives in the repo-root .env; server/.env is the fallback.
try {
  const dotenv = require('dotenv');
  for (const p of ['../../../.env', '../../.env']) {
    dotenv.config({ path: path.resolve(__dirname, p) });
    if (process.env.DIRECT_URL || process.env.DATABASE_URL) break;
  }
} catch { /* dotenv optional */ }

const { lineTotal } = require('./line-pricing');
const { lineTotalSql } = require('./line-total.util');

const DB_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;

// The three production surfaces + how each maps to (a) the SQL args and (b) the
// module input. `col` picks the pi/i columns each surface actually feeds.
const SURFACES = {
  estimate: {
    sql: { current: 'pi.price_current', base: 'pi.base_price', flat: true },
    input: (c) => ({
      priceCurrent: c.price_current, basePrice: c.base_price, priceTiers: c.tiers,
      quantity: c.quantity, installed: c.installed,
      installCost: pick(c.pi_install_cost, c.i_install_cost),
      installUnit: pick(c.pi_install_unit, c.i_install_unit),
      flatTotal: c.flat_total, honourFlat: true,
    }),
  },
  revised: {
    sql: { current: 'pi.price_current', ref: 'pi.price_ref', flat: true },
    input: (c) => ({
      priceCurrent: c.price_current, priceRef: c.price_ref,
      quantity: c.quantity, installed: c.installed,
      installCost: pick(c.pi_install_cost, c.i_install_cost),
      installUnit: pick(c.pi_install_unit, c.i_install_unit),
      flatTotal: c.flat_total, honourFlat: true,
    }),
  },
  original: {
    sql: { ref: 'pi.price_ref' },
    input: (c) => ({
      priceRef: c.price_ref,
      quantity: c.quantity, installed: c.installed,
      installCost: pick(c.pi_install_cost, c.i_install_cost),
      installUnit: pick(c.pi_install_unit, c.i_install_unit),
      honourFlat: false,
    }),
  },
};

function pick(a, b) { return a != null ? a : b; }

const TIERS = [
  { min: 1, max: 49, price: 3.75 },
  { min: 50, max: 99, price: 3.4 },
  { min: 100, max: null, price: 2.99 },
];

// Case matrix (Part C). Each case is a synthetic pi/i row; `surfaces` says which
// surfaces to assert it on (a case with base+tiers is meaningless on original).
const base = {
  quantity: 1, price_current: null, price_ref: null, base_price: null,
  flat_total: null, installed: null, pi_install_cost: null, pi_install_unit: null,
  i_install_cost: null, i_install_unit: null, tiers: null,
};
const CASES = [
  { name: 'no tiers, base only', on: ['estimate'], row: { base_price: 10, quantity: 3 } },
  { name: 'tier below band (qty 1)', on: ['estimate'], row: { base_price: 3.75, tiers: TIERS, quantity: 1 } },
  { name: 'tier inside band (qty 60)', on: ['estimate'], row: { base_price: 3.75, tiers: TIERS, quantity: 60 } },
  { name: 'tier boundary (qty 50)', on: ['estimate'], row: { base_price: 3.75, tiers: TIERS, quantity: 50 } },
  { name: 'tier open-top (qty 250)', on: ['estimate'], row: { base_price: 3.75, tiers: TIERS, quantity: 250 } },
  { name: 'tier above-open boundary (qty 100)', on: ['estimate'], row: { base_price: 3.75, tiers: TIERS, quantity: 100 } },
  { name: 'negotiated suppresses tier (2a)', on: ['estimate', 'revised'], row: { base_price: 3.75, price_current: 5, tiers: TIERS, quantity: 200 } },
  { name: 'briefed Original suppresses tier (2b)', on: ['original'], row: { price_ref: 4.2, tiers: TIERS, quantity: 200 } },
  { name: 'revised falls to price_ref, no tier', on: ['revised'], row: { price_ref: 4.2, tiers: TIERS, quantity: 200 } },
  { name: 'flat_total override (honoured)', on: ['estimate', 'revised'], row: { base_price: 3.75, price_current: 5, flat_total: 999, quantity: 60 } },
  { name: 'flat_total ignored on Original', on: ['original'], row: { price_ref: 4, flat_total: 999, quantity: 10 } },
  { name: 'install per_order', on: ['estimate'], row: { base_price: 10, quantity: 4, pi_install_cost: 25, pi_install_unit: 'per_order' } },
  { name: 'install percentage', on: ['estimate'], row: { base_price: 10, quantity: 4, pi_install_cost: 12.5, pi_install_unit: 'percentage' } },
  { name: 'install per_item (null unit)', on: ['estimate'], row: { base_price: 10, quantity: 4, pi_install_cost: 3, pi_install_unit: null } },
  { name: 'install per_item (explicit)', on: ['estimate'], row: { base_price: 10, quantity: 4, pi_install_cost: 3, pi_install_unit: 'per_item' } },
  { name: 'not installed (installed=false)', on: ['estimate'], row: { base_price: 10, quantity: 4, installed: false, pi_install_cost: 100, pi_install_unit: 'per_order' } },
  { name: 'pi install override beats catalogue i', on: ['estimate'], row: { base_price: 10, quantity: 2, pi_install_cost: 5, pi_install_unit: 'per_item', i_install_cost: 99, i_install_unit: 'per_order' } },
  { name: 'install falls back to catalogue i', on: ['estimate'], row: { base_price: 10, quantity: 2, i_install_cost: 7, i_install_unit: 'per_item' } },
];

const SQL = Object.fromEntries(Object.entries(SURFACES).map(([k, v]) => [k, lineTotalSql(v.sql)]));

function query(pool, surface, c) {
  const sql = `
    WITH pi AS (
      SELECT $1::numeric AS quantity, $2::numeric AS price_current, $3::numeric AS price_ref,
             $4::numeric AS base_price, $5::numeric AS flat_total, $6::boolean AS installed,
             $7::numeric AS install_cost, $8::text AS install_unit
    ), i AS (
      SELECT $9::jsonb AS attributes, $10::numeric AS install_cost, $11::text AS install_unit
    )
    SELECT (${SQL[surface]})::numeric AS total FROM pi, i`;
  return pool.query(sql, [
    c.quantity, c.price_current, c.price_ref, c.base_price, c.flat_total, c.installed,
    c.pi_install_cost, c.pi_install_unit,
    c.tiers ? JSON.stringify({ price_tiers: c.tiers }) : null,
    c.i_install_cost, c.i_install_unit,
  ]);
}

describe('pV2-PRICING-SSOT-01 golden contract: SQL lineTotalSql == module lineTotal', () => {
  let pool;
  before(() => {
    if (!DB_URL) return;
    const { Pool } = require('pg');
    pool = new Pool({ connectionString: DB_URL });
  });
  after(async () => { if (pool) await pool.end(); });

  for (const c of CASES) {
    for (const surface of c.on) {
      test(`${surface}: ${c.name}`, async (t) => {
        if (!DB_URL) { t.skip('no DIRECT_URL/DATABASE_URL — golden SQL parity not exercised'); return; }
        const row = { ...base, ...c.row };
        const moduleTotal = lineTotal(SURFACES[surface].input(row));
        const r = await query(pool, surface, row);
        const sqlTotal = Number(r.rows[0].total);
        assert.ok(
          Math.abs(sqlTotal - moduleTotal) < 1e-6,
          `SQL ${sqlTotal} != module ${moduleTotal} for ${surface}/${c.name}`,
        );
      });
    }
  }

  // Anchor a few absolute values so a matched-but-wrong pair still fails.
  test('anchors: Limewash tiers × qty (raw, no margin)', () => {
    const mk = (quantity) => lineTotal({ basePrice: 3.75, priceTiers: TIERS, quantity, honourFlat: true });
    assert.equal(mk(1), 3.75);
    assert.equal(Math.round(mk(50) * 100) / 100, 170); // 3.40 × 50
    assert.equal(Math.round(mk(101) * 100) / 100, 301.99); // 2.99 × 101
    assert.equal(Math.round(mk(250) * 100) / 100, 747.5); // 2.99 open-top × 250
  });
});
