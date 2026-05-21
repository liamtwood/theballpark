/**
 * TaxonomyService — v1.41.
 *
 * Two methods drive AI-powered subcategorisation:
 *
 *   suggestSubcategory(itemId)
 *     Single-item lookup. Reads the item + its parent category +
 *     the parent's child categories, asks Haiku which child fits
 *     best, and updates items.subcategory_id. Returns
 *     { subcategory_id, subcategory_name, confidence } or null
 *     when nothing fits.
 *
 *   backfillSubcategories(categoryId?)
 *     Bulk lookup. Iterates items where subcategory_id IS NULL,
 *     batches of 15, one Haiku call per batch. Returns
 *     { processed, updated, skipped, errors }.
 *
 * Model: claude-haiku-4-5-20251001 (same as ai.service.js). JSON
 * responses only — strict parsing with a markdown-fence fallback.
 * Returning a label that isn't in the supplied vocabulary is a
 * skip, not an error — the DB trigger would reject any mismatch
 * anyway.
 */
const pool = require('../db/pool');

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const BATCH_SIZE = 15;

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    const err = new Error('ANTHROPIC_API_KEY is not configured');
    err.status = 500;
    throw err;
  }
  const Anthropic = require('@anthropic-ai/sdk');
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

/** Try strict JSON.parse first; fall back to ```json … ``` extraction
    that some smaller models still produce. */
function parseJson(text) {
  try { return JSON.parse(text); } catch { /* fall through */ }
  const m = text && text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) {
    try { return JSON.parse(m[1].trim()); } catch { /* nope */ }
  }
  return null;
}

/** Load the children of a parent category (label + id) in sort_order.
    Returns []. */
async function loadChildren(categoryId) {
  const r = await pool.query(
    `SELECT id, name
       FROM categories
      WHERE parent_id = $1
      ORDER BY sort_order ASC, name ASC`,
    [categoryId]
  );
  return r.rows;
}

async function suggestSubcategory(itemId) {
  if (!itemId) {
    const err = new Error('itemId is required');
    err.status = 400;
    throw err;
  }
  // Item + its current category (parent)
  const itm = await pool.query(
    `SELECT i.id, i.name, i.description, i.category_id,
            c.name AS category_name, c.parent_id
       FROM items i
       LEFT JOIN categories c ON c.id = i.category_id
      WHERE i.id = $1`,
    [itemId]
  );
  if (!itm.rows.length) {
    const err = new Error(`Item ${itemId} not found`);
    err.status = 404;
    throw err;
  }
  const item = itm.rows[0];
  if (!item.category_id) return { subcategory_id: null, subcategory_name: null, confidence: 0 };

  const children = await loadChildren(item.category_id);
  if (!children.length) return { subcategory_id: null, subcategory_name: null, confidence: 0 };

  const client = getClient();
  const labels = children.map(c => c.name);
  const msg = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 200,
    system:
`You are an event production taxonomy expert. Given an item and a list of valid subcategories for its category, return the best match. Return ONLY valid JSON, no markdown.
{ "subcategory_name": "exact name from list", "confidence": 0.0-1.0 }
If nothing fits well: { "subcategory_name": null, "confidence": 0.0 }`,
    messages: [{
      role: 'user',
      content:
`Category: ${item.category_name}
Item: ${item.name}
Description: ${item.description || '(none)'}
Valid subcategories: ${labels.join(', ')}
Which subcategory best fits this item?`
    }]
  });

  const parsed = parseJson(msg.content?.[0]?.text);
  if (!parsed || !parsed.subcategory_name) {
    return { subcategory_id: null, subcategory_name: null, confidence: 0 };
  }
  const child = children.find(c => c.name.toLowerCase() === String(parsed.subcategory_name).toLowerCase());
  if (!child) {
    // Hallucinated label outside the vocabulary — don't write it.
    return { subcategory_id: null, subcategory_name: parsed.subcategory_name, confidence: 0 };
  }
  await pool.query(
    'UPDATE items SET subcategory_id = $1, updated_at = NOW() WHERE id = $2',
    [child.id, item.id]
  );
  return {
    subcategory_id:   child.id,
    subcategory_name: child.name,
    confidence:       Number(parsed.confidence) || 0
  };
}

/** Bulk classify items with no subcategory. Returns
    { processed, updated, skipped, errors, byCategory }. */
async function backfillSubcategories(categoryId) {
  // Items needing a subcategory. Filter by category if supplied so
  // a caller can target one parent at a time.
  const params = [];
  let where = 'i.subcategory_id IS NULL AND i.is_active = true AND i.category_id IS NOT NULL';
  if (categoryId) { params.push(categoryId); where += ` AND i.category_id = $${params.length}`; }
  const rows = await pool.query(
    `SELECT i.id, i.name, i.description, i.category_id,
            c.name AS category_name
       FROM items i
       LEFT JOIN categories c ON c.id = i.category_id
      WHERE ${where}
      ORDER BY i.category_id, i.created_at`,
    params
  );

  // Pre-load children for every category we'll touch so each batch
  // can stamp the matching id from a label without re-querying.
  const catIds = [...new Set(rows.rows.map(r => r.category_id))];
  const childrenByCategory = new Map();
  for (const cid of catIds) {
    childrenByCategory.set(cid, await loadChildren(cid));
  }

  const client = getClient();
  const result = { processed: 0, updated: 0, skipped: 0, errors: 0, byCategory: {} };

  for (let i = 0; i < rows.rows.length; i += BATCH_SIZE) {
    const batch = rows.rows.slice(i, i + BATCH_SIZE);
    // Build per-item payload with the current category's valid
    // subcategory labels.
    const payload = batch.map(it => ({
      id:                  it.id,
      name:                it.name,
      description:         (it.description || '').slice(0, 400),
      category:            it.category_name,
      valid_subcategories: childrenByCategory.get(it.category_id).map(c => c.name)
    }));
    let parsed = null;
    try {
      const msg = await client.messages.create({
        model: HAIKU_MODEL,
        max_tokens: 1500,
        system:
`You are an event production taxonomy expert. For each item, assign the best subcategory from the valid list for that item's category. Use ONLY a label from the item's "valid_subcategories" array. If nothing fits, set subcategory_name to null. Return ONLY a JSON array, no markdown.
[ { "item_id": "uuid", "subcategory_name": "name or null" } ]`,
        messages: [{
          role: 'user',
          content: `Items to classify:\n${JSON.stringify(payload, null, 2)}\nAssign a subcategory to each.`
        }]
      });
      parsed = parseJson(msg.content?.[0]?.text);
    } catch (e) {
      console.error('[taxonomy.backfill] batch failed:', e.message);
      result.errors += batch.length;
      result.processed += batch.length;
      continue;
    }
    if (!Array.isArray(parsed)) {
      result.errors += batch.length;
      result.processed += batch.length;
      continue;
    }
    // Apply each row's suggestion.
    const byItemId = new Map(parsed.map(p => [p.item_id, p]));
    for (const it of batch) {
      result.processed++;
      const sug = byItemId.get(it.id);
      const label = sug?.subcategory_name;
      if (!label) { result.skipped++; continue; }
      const child = childrenByCategory.get(it.category_id)
        .find(c => c.name.toLowerCase() === String(label).toLowerCase());
      if (!child) { result.skipped++; continue; }
      try {
        await pool.query(
          'UPDATE items SET subcategory_id = $1, updated_at = NOW() WHERE id = $2',
          [child.id, it.id]
        );
        result.updated++;
        const k = `${it.category_name} → ${child.name}`;
        result.byCategory[k] = (result.byCategory[k] || 0) + 1;
      } catch (e) {
        console.error('[taxonomy.backfill] update failed for', it.id, e.message);
        result.errors++;
      }
    }
  }
  return result;
}

module.exports = { suggestSubcategory, backfillSubcategories };
