/**
 * ClassificationService — AI catalogue classification (Taxonomy v2, Part 2).
 *
 * Extracted from taxonomy.service.js in the BE-00112 decomposition (Layer 1).
 * The three Haiku call sites are collapsed onto ai.service.callHaikuJson
 * (dropped taxonomy's duplicate Anthropic client — same model, maxRetries:8,
 * 503 overload mapping, JSON + markdown-fence parse). The tree-reading
 * primitives (loadTaxonomy / loadChildren / norm) now live in taxonomy.service
 * and are imported here (the #2 → #1 dependency).
 *
 *   classifyItem(itemId)
 *     The headline method. ONE Haiku call given the full taxonomy returns
 *     { category, subcategory, tags[], confidence }. Names are resolved to ids
 *     against the live DB vocabulary (hallucinated labels dropped), persisted to
 *     items.pending_classification, and returned for the supplier to accept/edit/skip.
 *
 *   applyClassification(itemId, { category_id, subcategory_id, tag_ids })
 *     Commits an (optionally edited) suggestion: updates items.category_id +
 *     subcategory_id and rewrites the supplier_item_tag junction. Clears
 *     pending_classification.
 *
 *   dismissClassification(itemId)   — supplier skipped; clear pending_classification.
 *   setItemTags(itemId, tagIds)     — item-drawer Index tab manual tag rewrite.
 *   suggestSubcategory(itemId) / backfillSubcategories(categoryId?)
 *     v1.41 helpers — the drawer's "✦ Suggest" link and the Part 3 backfill.
 *
 * Model: claude-haiku-4-5-20251001 (via callHaikuJson). JSON-only responses.
 * Returning a label outside the supplied vocabulary is dropped, never written —
 * the DB triggers (trg_check_item_subcategory, trg_check_item_tag_category)
 * would reject any mismatch anyway.
 */
const pool = require('../db/pool');
const ownerPool = require('../db/owner-pool'); // AUD-02 — privileged classifier write path
const { callHaikuJson } = require('./ai.service');
const { loadTaxonomy, loadChildren, norm } = require('./taxonomy.service');

const BATCH_SIZE = 15;

function httpErr(message, status) {
  const e = new Error(message);
  e.status = status;
  return e;
}

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
 * Map an item to the single best-fit subcategory FROM the real child list (a
 * guided pick BY MEANING, not free-text name matching). ALWAYS returns a child:
 * when the model finds no confident fit it falls back to a general/first child
 * (with fallback:true) so a classified item is never left without a subcategory
 * at volume. `children` is a non-empty [{id,name}]. Returns { subcategory, fallback }.
 */
async function pickBestSubcategory(item, parentName, children) {
  const names = children.map(c => c.name);
  let pickedName = null;
  try {
    const { parsed } = await callHaikuJson({
      system: `You place a product into exactly ONE subcategory chosen from a fixed list, mapping BY MEANING (wording won't always match — e.g. "chairs" → "Seating"). Return ONLY JSON: {"subcategory":"<one name copied verbatim from the list>"}. Always choose the closest option; use null only if truly none relate.`,
      user: `Parent category: ${parentName}\nAllowed subcategories (copy ONE verbatim):\n${names.join('\n')}\n\nItem:\nName: ${item.name || ''}\nDescription: ${(item.description || '').slice(0, 500)}`,
      maxTokens: 80,
    });
    pickedName = parsed && typeof parsed.subcategory === 'string' ? parsed.subcategory.trim() : null;
  } catch { /* fall through to the default child */ }

  const match = pickedName && pickedName.toLowerCase() !== 'null'
    ? children.find(c => norm(c.name) === norm(pickedName))
    : null;
  if (match) return { subcategory: match, fallback: false };
  // Never null: default to a general/other/misc child, else the first.
  const general = children.find(c => /\b(other|general|misc|miscellaneous|standard)\b/i.test(c.name));
  return { subcategory: general || children[0], fallback: true };
}

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

  // AI via the shared guided-Haiku plumbing (ai.service.callHaikuJson) — same
  // model + max_tokens + 503 mapping + JSON/fence parse as the former in-service
  // Haiku client (BE-00112 Layer 2).
  const { parsed } = await callHaikuJson({
    system: CLASSIFY_SYSTEM,
    maxTokens: 700,
    user:
`TAXONOMY:
${JSON.stringify(promptTax, null, 1)}

ITEM TO CLASSIFY:
Name: ${item.name || '(unnamed)'}
Description: ${(item.description || '(none)').slice(0, 800)}
Supplier's current category: ${item.category_name || '(unset)'}

Classify this item.`
  });
  if (!parsed) throw httpErr('AI classifier returned an unparseable response', 502);

  // ── Resolve category name → parent id. Fall back to the item's current
  //    category if the AI named something outside the vocabulary. ──────
  let parent = tax.parents.find(p => norm(p.name) === norm(parsed.category));
  if (!parent && item.category_id) {
    parent = tax.parents.find(p => p.id === item.category_id);
  }
  if (!parent) throw httpErr('AI classifier could not resolve a category', 502);

  // ── Resolve subcategory within that parent — a GUIDED PICK from the REAL
  //    children, not free-text name matching. The primary classify free-texts a
  //    subcategory name ("Chairs") that may not match a taxonomy child ("Seating");
  //    when it doesn't, a focused AI call maps the item to the single best-fit
  //    child BY MEANING from the actual list. Only null when the parent has no
  //    child, or the model genuinely finds none reasonable. ─────────────────
  const children = tax.childrenByParentId.get(parent.id) || [];
  let subcategory = null;
  let subFallback = false;
  if (parsed.subcategory) {
    subcategory = children.find(c => norm(c.name) === norm(parsed.subcategory)) || null;
  }
  if (!subcategory && children.length) {
    // Guided pick from the real list — ALWAYS returns a child (a default when the
    // model finds no confident fit), so a classified item is NEVER left without a
    // subcategory at volume (pV2-STORE-EXTRACT-01, Liam: 100s of items, no manual).
    const picked = await pickBestSubcategory(item, parent.name, children);
    subcategory = picked.subcategory;
    subFallback = picked.fallback;
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
    subcategory_fallback: subFallback, // true = default child used (uncertain)
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

  // AUD-02 — the classifier writes an item's category/tags; it runs both from a
  // request (route asserts assertItemInOrg) AND fire-and-forget from
  // classifyAndApply (no request context → no GUCs). Owner pool (bypasses RLS),
  // like other background/system writes; ownership is enforced at the caller.
  const conn = await ownerPool.connect();
  try {
    await conn.query('BEGIN');

    // Category must be a real parent category.
    const cat = await conn.query(
      `SELECT id, parent_id FROM categories WHERE id = $1 AND deleted_at IS NULL`, [edited.category_id]
    );
    if (!cat.rows.length || cat.rows[0].parent_id) {
      throw httpErr('category_id must be a live top-level category', 400);
    }

    // Subcategory (if any) must belong to that category — drop otherwise.
    let subId = edited.subcategory_id || null;
    if (subId) {
      const sc = await conn.query(
        // Must be a LIVE active direct child of the category — never apply a
        // deprecated/inactive/soft-deleted subcat (BE-00101; defense-in-depth
        // alongside loadTaxonomy).
        `SELECT id FROM categories WHERE id = $1 AND parent_id = $2 AND is_active = true AND deleted_at IS NULL`,
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

/**
 * pV2-STORE-IMPORT — lazy auto-classify: run the classifier and APPLY its
 * suggestion (subcategory + tags) in one call. Used fire-and-forget from item
 * create so a new item derives its subcat/tags implicitly, no UI. The
 * classifier does NOT set tier (stays the item's default). Best-effort — the
 * caller swallows errors so a classifier hiccup never breaks item create.
 */
async function classifyAndApply(_itemId) {
  // DEFERRED for the v2dev items slice. The old auto-classifier wrote
  // subcategory_id, pending_classification, and the legacy `tag`/supplier_item_tag
  // junction — ALL removed in 0015 (single category_id at any depth; tags via the
  // new item_tags junction). Re-enable against the new model in the classifier/tags
  // sub-slice. No-op for now so item create never writes a dropped column; the item
  // keeps the category_id the supplier (or the extract Prepare mapping) chose.
  return null;
}

/**
 * Replace an item's structured (dimension-scoped) tags. Used by the item
 * drawer's Index tab, where the supplier edits tags manually. Validates
 * every tag belongs to the item's category, then rewrites the
 * supplier_item_tag junction in one transaction.
 *
 * @returns the updated item (with item_tags)
 */
async function setItemTags(itemId, tagIds) {
  if (!itemId) throw httpErr('itemId is required', 400);
  const itm = await pool.query('SELECT id, category_id FROM items WHERE id = $1', [itemId]);
  if (!itm.rows.length) throw httpErr(`Item ${itemId} not found`, 404);
  const categoryId = itm.rows[0].category_id;

  let ids = Array.isArray(tagIds) ? tagIds.filter(Boolean) : [];
  if (ids.length && categoryId) {
    const v = await pool.query(
      'SELECT id FROM tag WHERE id = ANY($1::uuid[]) AND category_id = $2',
      [ids, categoryId]
    );
    ids = v.rows.map(r => r.id);
  } else {
    ids = [];
  }

  // AUD-02 — the classifier writes an item's category/tags; it runs both from a
  // request (route asserts assertItemInOrg) AND fire-and-forget from
  // classifyAndApply (no request context → no GUCs). Owner pool (bypasses RLS),
  // like other background/system writes; ownership is enforced at the caller.
  const conn = await ownerPool.connect();
  try {
    await conn.query('BEGIN');
    await conn.query('DELETE FROM supplier_item_tag WHERE item_id = $1', [itemId]);
    for (const tid of ids) {
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

  const labels = children.map(c => c.name);
  const { parsed } = await callHaikuJson({
    maxTokens: 200,
    system:
`You are an event production taxonomy expert. Given an item and a list of valid subcategories for its category, return the best match. Return ONLY valid JSON, no markdown.
{ "subcategory_name": "exact name from list", "confidence": 0.0-1.0 }
If nothing fits well: { "subcategory_name": null, "confidence": 0.0 }`,
    user:
`Category: ${item.category_name}
Item: ${item.name}
Description: ${item.description || '(none)'}
Valid subcategories: ${labels.join(', ')}
Which subcategory best fits this item?`
  });

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
      ({ parsed } = await callHaikuJson({
        maxTokens: 1500,
        system:
`You are an event production taxonomy expert. For each item, assign the best subcategory from the valid list for that item's category. Use ONLY a label from the item's "valid_subcategories" array. If nothing fits, set subcategory_name to null. Return ONLY a JSON array, no markdown.
[ { "item_id": "uuid", "subcategory_name": "name or null" } ]`,
        user: `Items to classify:\n${JSON.stringify(payload, null, 2)}\nAssign a subcategory to each.`
      }));
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
  classifyAndApply,
  dismissClassification,
  setItemTags,
  suggestSubcategory,
  backfillSubcategories
};
