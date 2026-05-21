/**
 * TaxonomyService — v1.43 (Taxonomy v2, Part 2: AI classification).
 *
 * AI-powered catalogue classification against the v2 taxonomy
 * (15 categories, 131 subcategories, dimension-scoped tags).
 *
 *   classifyItem(itemId)
 *     The headline method. ONE Haiku call given the full taxonomy
 *     returns { category, subcategory, tags[], confidence }. The names
 *     are resolved to ids against the live DB vocabulary (hallucinated
 *     labels are dropped), persisted to items.pending_classification,
 *     and returned for the supplier to accept / edit / skip.
 *
 *   applyClassification(itemId, { category_id, subcategory_id, tag_ids })
 *     Commits an (optionally edited) suggestion: updates
 *     items.category_id + subcategory_id and rewrites the
 *     supplier_item_tag junction. Clears pending_classification.
 *
 *   dismissClassification(itemId)
 *     Supplier skipped — just clears pending_classification.
 *
 *   getDimensions(categoryId)
 *     Tag dimensions + values for a parent category. Powers the
 *     "Edit classification" panel and (later) the marketplace filter.
 *
 *   suggestSubcategory(itemId) / backfillSubcategories(categoryId?)
 *     v1.41 helpers — kept for the drawer's "✦ Suggest" link and the
 *     Part 3 backfill.
 *
 * Model: claude-haiku-4-5-20251001. JSON-only responses, strict parse
 * with a markdown-fence fallback. Returning a label outside the
 * supplied vocabulary is dropped, never written — the DB triggers
 * (trg_check_item_subcategory, trg_check_item_tag_category) would
 * reject any mismatch anyway.
 */
const pool = require('../db/pool');

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const BATCH_SIZE = 15;

/** Short, stable definitions per category (FINAL_TAXONOMY_v2.md). Fed to
    the classifier so it disambiguates by what an item IS, not where it
    is used. Keyed by the exact DB category name. */
const CATEGORY_DEFS = {
  'Stand Structure':
    'Physical structure/build/installation, incl. construction trades (joinery, metalwork, paint, install/de-rig) and flooring.',
  'Lighting':
    'All lighting fixtures and design. NOT electrical infrastructure.',
  'AV & Technology':
    'Audio, video, screens, projection, streaming, interactive tech, rigging, power distribution, connectivity.',
  'Furniture & Fixtures':
    'Hired furniture, display units, seating, tables.',
  'Catering':
    'Food and drink services. Staff → Staffing. Catering equipment stays here.',
  'Florals':
    'Event floristry and botanical installations. NOT scent/aroma.',
  'Graphics & Signage':
    'Printed, vinyl, branded materials. Incl. portable display stands. NOT built exhibition stands.',
  'Staffing':
    'All people hired for events, incl. catering staff.',
  'Health & Safety':
    'Risk, compliance, insurance, safety services. All insurance.',
  'Logistics & Transport':
    'Moving things, storing things, site utilities.',
  'Entertainment':
    'Live performance, hosted experiences, talent.',
  'Photography':
    'Capture and content creation. NOT streaming infrastructure (that is AV).',
  'Event Accessories':
    'Finishing touches: red carpet, gift bags, lanyards, linen, scent design, glassware/crockery hire, pyro.',
  'Venue':
    'Venue sourcing and hire.',
  'Other':
    'Agency line items: PM fee, design fee, contingency, travel, site survey.'
};

function httpErr(message, status) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw httpErr('ANTHROPIC_API_KEY is not configured', 500);
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

/** Normalise a label for tolerant comparison (case + whitespace). */
function norm(s) {
  return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Load the children of a parent category (label + id) in sort_order. */
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

/* ─────────────────────────────────────────────────────────────────────
   FULL-TAXONOMY CLASSIFICATION (v1.43)
   ───────────────────────────────────────────────────────────────────── */

/** Load the entire catalogue taxonomy in one pass:
      parents             — [{ id, name }] in sort order
      childrenByParentId  — Map(parentId → [{ id, name }])
      tagsByCategoryId    — Map(categoryId → [{ id, dimension, label }])  */
async function loadTaxonomy() {
  const cats = await pool.query(
    `SELECT id, name, parent_id
       FROM categories
      WHERE namespace = 'catalogue'
      ORDER BY sort_order ASC, name ASC`
  );
  const parents = cats.rows.filter(c => !c.parent_id);
  const childrenByParentId = new Map();
  for (const c of cats.rows) {
    if (!c.parent_id) continue;
    if (!childrenByParentId.has(c.parent_id)) childrenByParentId.set(c.parent_id, []);
    childrenByParentId.get(c.parent_id).push({ id: c.id, name: c.name });
  }
  const tags = await pool.query(
    `SELECT id, category_id, dimension, label, sort_order
       FROM tag
      ORDER BY sort_order ASC`
  );
  const tagsByCategoryId = new Map();
  for (const t of tags.rows) {
    if (!tagsByCategoryId.has(t.category_id)) tagsByCategoryId.set(t.category_id, []);
    tagsByCategoryId.get(t.category_id).push({
      id: t.id, dimension: t.dimension, label: t.label
    });
  }
  return { parents, childrenByParentId, tagsByCategoryId };
}

/** Shape the taxonomy for the prompt. The event-type dimension is shared
    (duplicated across 12 categories in the DB) so we lift it out once to
    keep the prompt lean. */
function buildTaxonomyForPrompt(tax) {
  const eventTypes = new Set();
  const categories = tax.parents.map(p => {
    const subcategories = (tax.childrenByParentId.get(p.id) || []).map(c => c.name);
    const dims = {};
    for (const t of (tax.tagsByCategoryId.get(p.id) || [])) {
      if (t.dimension === 'event-type') { eventTypes.add(t.label); continue; }
      if (!dims[t.dimension]) dims[t.dimension] = [];
      dims[t.dimension].push(t.label);
    }
    return {
      category: p.name,
      definition: CATEGORY_DEFS[p.name] || '',
      subcategories,
      dimensions: dims
    };
  });
  return { categories, eventType: [...eventTypes] };
}

const CLASSIFY_SYSTEM = `You are an event-production catalogue classifier for Ballpark, a marketplace used by professional UK event agencies.

Classify ONE supplier catalogue item into the Ballpark taxonomy. You are given the full taxonomy: 15 categories, each with a definition, its subcategories, and its tag dimensions.

RULES
- CATEGORY = what the item IS, not where it is used. Equipment rides inside its discipline.
- Choose exactly ONE category and at most ONE subcategory. Copy both names VERBATIM from the taxonomy.
- The subcategory MUST be one of the chosen category's subcategories. If none fits, use null.
- Tags are faceted attributes. For each tag dimension the item clearly satisfies, return { "dimension": <dimension key>, "label": <value> } copied VERBATIM from the taxonomy. Only include tags you are confident about; omit a dimension entirely if unknown. A dimension may yield more than one tag (e.g. multiple dietary options).
- The "event-type" dimension applies to EVERY category except Health & Safety, Logistics & Transport, and Other. Use it for the event types the item clearly suits.
- "confidence" is your overall 0.0–1.0 certainty in the CATEGORY choice.

Return ONLY valid JSON, no markdown, no commentary:
{ "category": "exact category name", "subcategory": "exact subcategory name or null", "tags": [ { "dimension": "dimension-key", "label": "exact value" } ], "confidence": 0.0 }`;

/**
 * Classify a single item with one Haiku call against the full taxonomy.
 * Resolves the AI's label choices to ids, persists the suggestion onto
 * items.pending_classification, and returns it.
 *
 * @returns { category_id, category_name, subcategory_id, subcategory_name,
 *            tags: [{ tag_id, dimension, label }], confidence, classified_at }
 */
async function classifyItem(itemId) {
  if (!itemId) throw httpErr('itemId is required', 400);

  const itm = await pool.query(
    `SELECT i.id, i.name, i.description, i.category_id,
            c.name AS category_name
       FROM items i
       LEFT JOIN categories c ON c.id = i.category_id
      WHERE i.id = $1`,
    [itemId]
  );
  if (!itm.rows.length) throw httpErr(`Item ${itemId} not found`, 404);
  const item = itm.rows[0];

  const tax = await loadTaxonomy();
  if (!tax.parents.length) throw httpErr('Taxonomy is empty — run migrate-taxonomy-v2.js', 500);
  const promptTax = buildTaxonomyForPrompt(tax);

  const client = getClient();
  const msg = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 700,
    system: CLASSIFY_SYSTEM,
    messages: [{
      role: 'user',
      content:
`TAXONOMY:
${JSON.stringify(promptTax, null, 1)}

ITEM TO CLASSIFY:
Name: ${item.name || '(unnamed)'}
Description: ${(item.description || '(none)').slice(0, 800)}
Supplier's current category: ${item.category_name || '(unset)'}

Classify this item.`
    }]
  });

  const parsed = parseJson(msg.content?.[0]?.text);
  if (!parsed) throw httpErr('AI classifier returned an unparseable response', 502);

  // ── Resolve category name → parent id. Fall back to the item's current
  //    category if the AI named something outside the vocabulary. ──────
  let parent = tax.parents.find(p => norm(p.name) === norm(parsed.category));
  if (!parent && item.category_id) {
    parent = tax.parents.find(p => p.id === item.category_id);
  }
  if (!parent) throw httpErr('AI classifier could not resolve a category', 502);

  // ── Resolve subcategory within that parent. ─────────────────────────
  const children = tax.childrenByParentId.get(parent.id) || [];
  let subcategory = null;
  if (parsed.subcategory) {
    subcategory = children.find(c => norm(c.name) === norm(parsed.subcategory)) || null;
  }

  // ── Resolve tags. Each {dimension,label} must match a tag row scoped
  //    to the resolved parent. Hallucinations are silently dropped. ────
  const parentTags = tax.tagsByCategoryId.get(parent.id) || [];
  const resolvedTags = [];
  const seen = new Set();
  for (const sug of (Array.isArray(parsed.tags) ? parsed.tags : [])) {
    const hit = parentTags.find(t =>
      norm(t.dimension) === norm(sug.dimension) && norm(t.label) === norm(sug.label)
    );
    if (hit && !seen.has(hit.id)) {
      seen.add(hit.id);
      resolvedTags.push({ tag_id: hit.id, dimension: hit.dimension, label: hit.label });
    }
  }

  let confidence = Number(parsed.confidence);
  if (!Number.isFinite(confidence)) confidence = 0;
  confidence = Math.max(0, Math.min(1, confidence));

  const suggestion = {
    category_id:      parent.id,
    category_name:    parent.name,
    subcategory_id:   subcategory ? subcategory.id : null,
    subcategory_name: subcategory ? subcategory.name : null,
    tags:             resolvedTags,
    confidence,
    classified_at:    new Date().toISOString()
  };

  await pool.query(
    'UPDATE items SET pending_classification = $1, updated_at = NOW() WHERE id = $2',
    [JSON.stringify(suggestion), itemId]
  );

  console.log('[taxonomy.classify]', itemId,
    `→ ${suggestion.category_name} / ${suggestion.subcategory_name || '—'} ` +
    `(${resolvedTags.length} tags, conf ${confidence})`);

  return suggestion;
}

/** Fetch an item plus its structured (supplier_item_tag) tags. */
async function getItemWithTags(itemId) {
  const r = await pool.query(
    `SELECT i.*,
            c.name  AS category_name,
            sc.name AS subcategory_name
       FROM items i
       LEFT JOIN categories c  ON c.id  = i.category_id
       LEFT JOIN categories sc ON sc.id = i.subcategory_id
      WHERE i.id = $1`,
    [itemId]
  );
  const item = r.rows[0] || null;
  if (!item) return null;
  const t = await pool.query(
    `SELECT t.id AS tag_id, t.dimension, t.label
       FROM supplier_item_tag sit
       JOIN tag t ON t.id = sit.tag_id
      WHERE sit.item_id = $1
      ORDER BY t.dimension ASC, t.sort_order ASC`,
    [itemId]
  );
  item.item_tags = t.rows;
  return item;
}

/**
 * Commit a classification (possibly edited by the supplier).
 * Validates the category/subcategory pair and tag scope, then rewrites
 * items.category_id + subcategory_id and the supplier_item_tag junction
 * inside one transaction. Clears pending_classification.
 *
 * @param edited { category_id, subcategory_id, tag_ids[] }
 * @returns the updated item (with item_tags)
 */
async function applyClassification(itemId, edited) {
  if (!itemId) throw httpErr('itemId is required', 400);
  edited = edited || {};
  if (!edited.category_id) throw httpErr('category_id is required', 400);

  const conn = await pool.connect();
  try {
    await conn.query('BEGIN');

    // Category must be a real parent category.
    const cat = await conn.query(
      `SELECT id, parent_id FROM categories WHERE id = $1`, [edited.category_id]
    );
    if (!cat.rows.length || cat.rows[0].parent_id) {
      throw httpErr('category_id must be a top-level category', 400);
    }

    // Subcategory (if any) must belong to that category — drop otherwise.
    let subId = edited.subcategory_id || null;
    if (subId) {
      const sc = await conn.query(
        `SELECT id FROM categories WHERE id = $1 AND parent_id = $2`,
        [subId, edited.category_id]
      );
      if (!sc.rows.length) subId = null;
    }

    // Keep only tag ids that actually belong to the chosen category — the
    // trg_check_item_tag_category trigger would abort the txn otherwise.
    let tagIds = Array.isArray(edited.tag_ids) ? edited.tag_ids.filter(Boolean) : [];
    if (tagIds.length) {
      const v = await conn.query(
        `SELECT id FROM tag WHERE id = ANY($1::uuid[]) AND category_id = $2`,
        [tagIds, edited.category_id]
      );
      tagIds = v.rows.map(r => r.id);
    }

    // Rewrite in trigger-safe order: clear old tags → move the item →
    // insert the new tags (now matching the item's category).
    await conn.query('DELETE FROM supplier_item_tag WHERE item_id = $1', [itemId]);
    const upd = await conn.query(
      `UPDATE items
          SET category_id = $1, subcategory_id = $2,
              pending_classification = NULL, updated_at = NOW()
        WHERE id = $3
      RETURNING id`,
      [edited.category_id, subId, itemId]
    );
    if (!upd.rows.length) throw httpErr(`Item ${itemId} not found`, 404);

    for (const tid of tagIds) {
      await conn.query(
        `INSERT INTO supplier_item_tag (item_id, tag_id)
         VALUES ($1, $2) ON CONFLICT (item_id, tag_id) DO NOTHING`,
        [itemId, tid]
      );
    }

    await conn.query('COMMIT');
  } catch (e) {
    await conn.query('ROLLBACK');
    throw e;
  } finally {
    conn.release();
  }

  return getItemWithTags(itemId);
}

/** Supplier skipped the suggestion — clear it so the prompt doesn't
    resurface. */
async function dismissClassification(itemId) {
  if (!itemId) throw httpErr('itemId is required', 400);
  await pool.query(
    'UPDATE items SET pending_classification = NULL WHERE id = $1', [itemId]
  );
  return { dismissed: true };
}

/** Tag dimensions + values for one parent category. Powers the
    "Edit classification" panel (and, later, the marketplace filter). */
async function getDimensions(categoryId) {
  if (!categoryId) throw httpErr('categoryId is required', 400);
  const r = await pool.query(
    `SELECT id, dimension, label, sort_order
       FROM tag
      WHERE category_id = $1
      ORDER BY dimension ASC, sort_order ASC`,
    [categoryId]
  );
  const map = new Map();
  for (const t of r.rows) {
    if (!map.has(t.dimension)) map.set(t.dimension, []);
    map.get(t.dimension).push({ tag_id: t.id, label: t.label });
  }
  return [...map.entries()].map(([dimension, values]) => ({ dimension, values }));
}

/* ─────────────────────────────────────────────────────────────────────
   v1.41 SUBCATEGORY-ONLY HELPERS — kept for the drawer "✦ Suggest" link
   and the Part 3 bulk backfill.
   ───────────────────────────────────────────────────────────────────── */

async function suggestSubcategory(itemId) {
  if (!itemId) throw httpErr('itemId is required', 400);
  const itm = await pool.query(
    `SELECT i.id, i.name, i.description, i.category_id,
            c.name AS category_name, c.parent_id
       FROM items i
       LEFT JOIN categories c ON c.id = i.category_id
      WHERE i.id = $1`,
    [itemId]
  );
  if (!itm.rows.length) throw httpErr(`Item ${itemId} not found`, 404);
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
  const child = children.find(c => norm(c.name) === norm(parsed.subcategory_name));
  if (!child) {
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

  const catIds = [...new Set(rows.rows.map(r => r.category_id))];
  const childrenByCategory = new Map();
  for (const cid of catIds) {
    childrenByCategory.set(cid, await loadChildren(cid));
  }

  const client = getClient();
  const result = { processed: 0, updated: 0, skipped: 0, errors: 0, byCategory: {} };

  for (let i = 0; i < rows.rows.length; i += BATCH_SIZE) {
    const batch = rows.rows.slice(i, i + BATCH_SIZE);
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
    const byItemId = new Map(parsed.map(p => [p.item_id, p]));
    for (const it of batch) {
      result.processed++;
      const sug = byItemId.get(it.id);
      const label = sug?.subcategory_name;
      if (!label) { result.skipped++; continue; }
      const child = childrenByCategory.get(it.category_id)
        .find(c => norm(c.name) === norm(label));
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

module.exports = {
  classifyItem,
  applyClassification,
  dismissClassification,
  getDimensions,
  suggestSubcategory,
  backfillSubcategories
};
