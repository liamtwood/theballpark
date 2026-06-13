// pV2-PROJECTS-02 (cards-audit F-8 extraction) — the org's marketplace
// favourites, split out of marketplace.js to keep that file under the
// 300-line route alarm before the projects arc grows it. Mounted on the
// GATED v2 router at /api/marketplace/favourites (BEFORE the /marketplace
// mount so the more-specific path matches first). org_id ALWAYS from JWT.

const router = require('express').Router();
const { z } = require('zod');
const pool = require('../db/pool');
const { FavouriteToggleSchema } = require('../schemas/marketplace-suppliers.schema');
const { withTransaction } = require('../db/with-transaction');

/** GET / — the active org's favourite ids, split by type. */
router.get('/', async (req, res, next) => {
  try {
    const r = await pool.query(
      `SELECT type, ref_id FROM favourites
        WHERE org_id = $1 AND is_active AND deleted_at IS NULL`,
      [req.user.org_id]
    );
    res.json({
      items: r.rows.filter((x) => x.type === 'item').map((x) => x.ref_id),
      suppliers: r.rows.filter((x) => x.type === 'supplier').map((x) => x.ref_id),
    });
  } catch (err) { next(err); }
});

/** POST / — TOGGLE for the active org. One transaction: revive-or-flip an
 *  existing row, else insert. Returns the new state { favourited }. */
router.post('/', async (req, res, next) => {
  try {
    const parsed = FavouriteToggleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: z.flattenError(parsed.error).fieldErrors,
      });
    }
    const { type, refId } = parsed.data;
    const orgId = req.user.org_id;
    const favourited = await withTransaction(async (client) => {
      const existing = await client.query(
        `SELECT id, is_active FROM favourites
          WHERE org_id = $1 AND type = $2 AND ref_id = $3 AND deleted_at IS NULL
          FOR UPDATE`,
        [orgId, type, refId]
      );
      if (existing.rows.length) {
        const next = !existing.rows[0].is_active;
        await client.query(`UPDATE favourites SET is_active = $2, updated_at = NOW() WHERE id = $1`, [
          existing.rows[0].id,
          next,
        ]);
        return next;
      }
      await client.query(
        `INSERT INTO favourites (org_id, type, ref_id, is_active) VALUES ($1, $2, $3, true)`,
        [orgId, type, refId]
      );
      return true;
    });
    res.json({ favourited });
  } catch (err) { next(err); }
});

module.exports = router;
