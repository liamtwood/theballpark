/**
 * One-off: reset the customize/base-intro coachmark text to the generic default
 * (the earlier one had a catering-specific "gourmet menu" example). Only touches
 * that row; safe to re-run.
 *   cd server && node scripts/reset-customize-coachmark.js
 */
const pool = require('../src/db/pool');

const TEXT = "The Base row is your {item} — {rate} per {unit} × {qty} = {total}. To add an extra like insurance, add a line: type 'Insurance', pick 'job' as the unit, keep Qty at 1, then enter its Cost. It adds on top and the total updates live.";

(async () => {
  const r = await pool.query(
    `UPDATE coachmarks SET description = $1, updated_at = NOW()
      WHERE page = 'customize' AND name = 'base-intro'`,
    [TEXT]
  );
  console.log(`Updated ${r.rowCount} row(s).`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
