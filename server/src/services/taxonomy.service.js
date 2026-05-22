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
const { sendEmail } = require('./email.service');

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
  // v1.49f — maxRetries 8 (was 4). The SDK rides out transient
  // 429 / 5xx / 529 overloads with exponential backoff; 4 retries
  // wasn't always enough to outlast an Anthropic overload window, so a
  // heavy call (Brief-tab "Find items") would surface a 503. 8 retries
  // ~doubles the window the call can absorb before it ever fails.
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 8 });
}

/** Wrap a Haiku call so an exhausted-retries overload (429 / 5xx / 529 /
    overloaded_error) surfaces as a clean, retryable 503 instead of the
    raw Anthropic error body. */
async function aiCreate(client, params) {
  try {
    return await client.messages.create(params);
  } catch (e) {
    const status = e && e.status;
    const type = e && e.error && e.error.error && e.error.error.type;
    if (status === 429 || status === 529 || (status >= 500 && status < 600)
        || type === 'overloaded_error' || type === 'rate_limit_error') {
      throw httpErr('The AI service is busy right now — please try again in a moment.', 503);
    }
    throw e;
  }
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
  const msg = await aiCreate(client,{
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

  const conn = await pool.connect();
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

/**
 * Suppliers with at least one active item in a category — derived live
 * from the catalogue. Powers the category card's Suppliers section.
 * Returns [{ supplier_id, supplier_name, description, city, item_count }]
 * ordered by item_count desc.
 */
async function categorySuppliers(categoryId) {
  const params = [];
  let filter = 'i.is_active = true';
  if (categoryId) {
    params.push(categoryId);
    filter += ` AND (i.category_id = $1 OR i.category_id IN (SELECT id FROM categories WHERE parent_id = $1))`;
  }
  const r = await pool.query(
    `SELECT o.id AS supplier_id, o.name AS supplier_name,
            o.description, o.city, COUNT(i.id)::int AS item_count
       FROM items i
       JOIN orgs o ON o.id = i.org_id
      WHERE ${filter}
      GROUP BY o.id, o.name, o.description, o.city
      ORDER BY item_count DESC, o.name ASC`,
    params
  );
  return r.rows;
}

/**
 * Event-type values, each with every tag id that carries it. The
 * event-type dimension is duplicated per category, so the "All"
 * marketplace view needs all ids behind a value to filter across
 * categories. Returns [{ label, tag_ids: [...] }].
 */
async function eventTypes() {
  const r = await pool.query(
    `SELECT label, ARRAY_AGG(id) AS tag_ids
       FROM tag
      WHERE dimension = 'event-type'
      GROUP BY label
      ORDER BY MIN(sort_order)`
  );
  return r.rows;
}

/* ─────────────────────────────────────────────────────────────────────
   BRIEF-TAB ITEM MATCHING (v1.46 — Brief tab upgrade)
   ───────────────────────────────────────────────────────────────────── */

const MATCH_SYSTEM = `You are an event production item matcher. You have a project brief requirement and a catalogue of real items + suppliers.

Do THREE things:

1. SCORE each item 1-10 against the brief. Consider: does the item TYPE match? Is the SCALE right? Could this supplier deliver? Is the PRICE reasonable for this brief?

2. If no item scores 7+, pick the BEST-FIT SUPPLIER based on their other items and speciality.

3. CREATE a proposed item for that supplier with an estimated price. Base the estimate on similar items in the catalogue (scale up/down), the budget hint if provided, and your knowledge of London event-production costs.

Also return the search terms you used to match — this helps us understand your reasoning.

Return ONLY valid JSON, no markdown:
{
  "search_terms": ["inflatable", "bespoke"],
  "matched_items": [ { "item_id": "uuid", "score": 8, "reason": "one sentence" } ],
  "closest_item": { "item_id": "uuid", "score": 6, "reason": "one sentence" },
  "suppliers_ranked": [ { "supplier_id": "uuid", "fit_reason": "short phrase" } ],
  "proposed_item": { "name": "...", "description": "...", "supplier_id": "uuid", "estimated_price": 15000, "confidence": 4, "reason": "one sentence" }
}

If good matches exist (7+), proposed_item can be null. If no items exist in this category at all, return empty matched_items and still propose one.`;

/**
 * Match a category brief against the catalogue. ONE Haiku call scores
 * every item in the category, ranks suppliers, and proposes a new item
 * if nothing fits. Returns a fully-hydrated result for the Brief tab.
 *
 * v1.49e — when projectId is supplied the result is persisted to
 * project_categories.match_result_json so the Brief tab can re-display
 * the previous search without re-running the AI.
 */
async function matchItems(brief, categoryId, budgetEstimate, projectId) {
  if (!categoryId) throw httpErr('categoryId is required', 400);
  const briefText = (brief || '').trim();
  if (!briefText) throw httpErr('brief is required', 400);

  const cat = await pool.query('SELECT id, name FROM categories WHERE id = $1', [categoryId]);
  if (!cat.rows.length) throw httpErr('category not found', 404);
  const categoryName = cat.rows[0].name;

  const inCategory =
    `(i.category_id = $1 OR i.category_id IN (SELECT id FROM categories WHERE parent_id = $1))`;

  const itemsRes = await pool.query(
    `SELECT i.id, i.name, i.description, i.base_price, i.org_id,
            i.image_url, i.external_url, i.image_display,
            sc.name AS subcategory_name, o.name AS supplier_name
       FROM items i
       LEFT JOIN categories sc ON sc.id = i.subcategory_id
       LEFT JOIN orgs o ON o.id = i.org_id
      WHERE i.is_active = true AND ${inCategory}
      ORDER BY i.name`,
    [categoryId]
  );
  const items = itemsRes.rows;
  const itemById = new Map(items.map(i => [i.id, i]));

  const supRes = await pool.query(
    `SELECT o.id, o.name, o.description, o.cover_image_url, o.logo_url, o.image_display,
            COUNT(i.id)::int AS item_count
       FROM items i JOIN orgs o ON o.id = i.org_id
      WHERE i.is_active = true AND ${inCategory}
      GROUP BY o.id, o.name, o.description, o.cover_image_url, o.logo_url, o.image_display
      ORDER BY item_count DESC`,
    [categoryId]
  );
  const suppliers = supRes.rows;
  const supById = new Map(suppliers.map(s => [s.id, s]));

  const client = getClient();
  const msg = await aiCreate(client,{
    model: HAIKU_MODEL,
    max_tokens: 1600,
    system: MATCH_SYSTEM,
    messages: [{
      role: 'user',
      content:
`Brief requirement: "${briefText}"
Category: ${categoryName}
Budget for this category: ${budgetEstimate ? '£' + budgetEstimate : 'not set'}

Catalogue items in this category:
${JSON.stringify(items.map(i => ({
  id: i.id, name: i.name,
  description: (i.description || '').slice(0, 240),
  base_price: i.base_price, subcategory: i.subcategory_name,
  supplier_name: i.supplier_name
})), null, 1)}

Suppliers in this category:
${JSON.stringify(suppliers.map(s => ({
  id: s.id, name: s.name,
  description: (s.description || '').slice(0, 200),
  item_count: s.item_count
})), null, 1)}

Score items and propose if needed.`
    }]
  });

  const parsed = parseJson(msg.content?.[0]?.text);
  if (!parsed) throw httpErr('AI matcher returned an unparseable response', 502);

  // Hydrate matched / closest items with real catalogue data.
  const hydrate = (m) => {
    if (!m || !m.item_id) return null;
    const it = itemById.get(m.item_id);
    if (!it) return null;
    return {
      item_id:          it.id,
      name:             it.name,
      description:      (it.description || '').slice(0, 320),
      base_price:       it.base_price != null ? Number(it.base_price) : null,
      supplier_id:      it.org_id,
      supplier_name:    it.supplier_name,
      subcategory_name: it.subcategory_name || null,
      image_url:        it.image_url || it.external_url || null,
      image_display:    it.image_display || null,
      score:            Math.max(1, Math.min(10, Number(m.score) || 0)),
      reason:           m.reason || ''
    };
  };
  const matched = (Array.isArray(parsed.matched_items) ? parsed.matched_items : [])
    .map(hydrate).filter(Boolean)
    .filter(m => m.score >= 7)
    .sort((a, b) => b.score - a.score);
  const matchedIds = new Set(matched.map(m => m.item_id));
  let closest = hydrate(parsed.closest_item);
  if (closest && matchedIds.has(closest.item_id)) closest = null;

  const suppliersRanked = (Array.isArray(parsed.suppliers_ranked) ? parsed.suppliers_ranked : [])
    .filter(s => s && supById.has(s.supplier_id))
    .map(s => {
      const db = supById.get(s.supplier_id);
      // Prefer the cover photo (rendered cover) and fall back to the
      // logo (rendered contain) so the preview card always has artwork.
      const supImg = db.cover_image_url || db.logo_url || null;
      return {
        supplier_id:   s.supplier_id,
        supplier_name: db.name,
        description:   (db.description || '').slice(0, 320),
        fit_reason:    s.fit_reason || '',
        item_count:    db.item_count,
        image_url:     supImg,
        image_display: db.cover_image_url
          ? (db.image_display || null)
          : (supImg ? 'contain' : null)
      };
    });

  let proposed = null;
  if (parsed.proposed_item && parsed.proposed_item.name) {
    const p = parsed.proposed_item;
    const db = supById.get(p.supplier_id);
    const fallback = suppliers[0] || null;
    proposed = {
      name:            p.name,
      description:     p.description || briefText,
      supplier_id:     db ? p.supplier_id : (fallback ? fallback.id : null),
      supplier_name:   db ? db.name : (fallback ? fallback.name : 'Supplier'),
      estimated_price: Math.max(0, Number(p.estimated_price) || 0),
      confidence:      Math.max(1, Math.min(10, Number(p.confidence) || 1)),
      reason:          p.reason || ''
    };
  }

  const result = {
    category_id:       categoryId,
    category_name:     categoryName,
    search_terms:      Array.isArray(parsed.search_terms) ? parsed.search_terms : [],
    items_scanned:     items.length,
    suppliers_scanned: suppliers.length,
    matched_items:     matched,
    closest_item:      closest,
    suppliers_ranked:  suppliersRanked,
    proposed_item:     proposed,
    searched_brief:    briefText,
    searched_at:       new Date().toISOString()
  };

  // v1.49e — persist the result onto the project-category scope row so
  // the Brief tab re-displays it later. Best-effort: a failed write here
  // must never break the search response the user is waiting on.
  if (projectId) {
    try {
      await pool.query(
        `UPDATE project_categories
            SET match_result_json = $1, updated_at = NOW()
          WHERE project_id = $2 AND category_id = $3 AND is_active = true`,
        [JSON.stringify(result), projectId, categoryId]
      );
    } catch (e) {
      console.error('[matchItems] could not persist match_result_json:', e.message);
    }
  }

  return result;
}

/** Sum the catalogue value of a project's items in one category and
    write it onto project_categories.ballpark_cost. */
async function recomputeCategoryBallpark(projectId, categoryId) {
  const r = await pool.query(
    `SELECT COALESCE(SUM(COALESCE(i.base_price, 0)), 0)::numeric AS total
       FROM project_items pi
       JOIN items i ON i.id = pi.item_id
      WHERE pi.project_id = $1
        AND (i.category_id = $2 OR i.category_id IN (SELECT id FROM categories WHERE parent_id = $2))`,
    [projectId, categoryId]
  );
  const total = Number(r.rows[0].total) || 0;
  await pool.query(
    `UPDATE project_categories SET ballpark_cost = $1, updated_at = NOW()
      WHERE project_id = $2 AND category_id = $3 AND is_active = true`,
    [total, projectId, categoryId]
  );
  return total;
}

/**
 * Add a Brief-tab match to a project. For a catalogue match (kind
 * 'matched') it links the existing item; for an AI proposal (kind
 * 'proposed') it first creates the item under the proposed supplier.
 * Either way it records the AI metadata and recomputes the category's
 * ballpark cost.
 */
async function addMatchToProject(body) {
  const {
    project_id, project_category_id, category_id, kind,
    item_id, ai_confidence, ai_match_reason, proposed, selection_type
  } = body || {};
  if (!project_id || !category_id) throw httpErr('project_id and category_id are required', 400);
  const stype = selection_type === 'liked' ? 'liked' : 'selected';

  let finalItemId = item_id;
  let source = 'catalogue';
  let estPrice = null;

  if (kind === 'proposed') {
    if (!proposed || !proposed.name) throw httpErr('proposed item details are required', 400);
    if (!proposed.supplier_id) throw httpErr('proposed item needs a supplier', 400);
    source = 'ai_proposed';
    estPrice = Math.max(0, Number(proposed.estimated_price) || 0);
    // v1.49k — an AI-proposed item is NOT a real catalogue listing yet.
    // Create it is_active = false + approval_status = 'pending' so it is
    // hidden from the catalogue / marketplace / store / matcher (all of
    // which filter is_active = true) until the named supplier approves
    // it. It still works on the project that proposed it — project_items
    // references the row by id regardless of is_active.
    // v1.51f — reuse + refresh on the UNIQUE(org_id, name) index so
    // adding the same proposed item twice doesn't error.
    const ins = await pool.query(
      `INSERT INTO items (org_id, category_id, name, description, base_price,
                          is_active, approval_status)
       VALUES ($1, $2, $3, $4, $5, false, 'pending')
       ON CONFLICT (org_id, name) DO UPDATE SET
         category_id = EXCLUDED.category_id,
         description = EXCLUDED.description,
         base_price  = EXCLUDED.base_price,
         updated_at  = NOW()
       RETURNING id`,
      [proposed.supplier_id, category_id, proposed.name, proposed.description || '', estPrice]
    );
    finalItemId = ins.rows[0].id;
  }
  if (!finalItemId) throw httpErr('item_id is required for a catalogue match', 400);

  const conf = ai_confidence != null ? Math.round(Number(ai_confidence)) : null;
  const pi = await pool.query(
    `INSERT INTO project_items
       (project_id, item_id, project_category_id, selection_type,
        source, ai_confidence, ai_match_reason, ai_estimated_price)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (project_id, item_id) DO UPDATE SET
       selection_type      = EXCLUDED.selection_type,
       project_category_id = COALESCE(EXCLUDED.project_category_id, project_items.project_category_id),
       source              = EXCLUDED.source,
       ai_confidence       = EXCLUDED.ai_confidence,
       ai_match_reason     = EXCLUDED.ai_match_reason,
       ai_estimated_price  = EXCLUDED.ai_estimated_price
     RETURNING *`,
    [project_id, finalItemId, project_category_id || null, stype, source, conf,
     ai_match_reason || null, estPrice]
  );

  const ballpark_cost = await recomputeCategoryBallpark(project_id, category_id);
  return { project_item: pi.rows[0], ballpark_cost };
}

/** Store the AI's search terms + the user's training hint. */
async function saveSearchHint(projectId, categoryId, searchTerms, userHint) {
  if (!projectId || !categoryId) throw httpErr('projectId and categoryId are required', 400);
  await pool.query(
    `INSERT INTO ai_search_hints (project_id, category_id, ai_search_terms, user_hint)
     VALUES ($1, $2, $3, $4)`,
    [projectId, categoryId, Array.isArray(searchTerms) ? searchTerms : [], userHint || '']
  );
  return { saved: true };
}

/* ─────────────────────────────────────────────────────────────────────
   v1.50 — COMPETITIVE QUOTE OUTREACH (RFQ, Phase 1)
   ───────────────────────────────────────────────────────────────────── */

/** v1.50 — outreach emails are fully wired but OFF by default: there are
    no supplier user accounts to receive them yet. Flip
    QUOTE_REQUEST_EMAILS_ENABLED=true in the env once supplier accounts
    go live — no code change needed. */
const QUOTE_REQUEST_EMAILS_ENABLED = process.env.QUOTE_REQUEST_EMAILS_ENABLED === 'true';

/**
 * Best-effort email nudge to each supplier in a quote outreach. Reuses
 * the existing EmailService (Resend) — no new notification service. The
 * on-platform supplier inbox (Phase 2) is the real surface; this email
 * only says "log in to view and respond". Never throws — a failed or
 * disabled send must not affect the outreach itself.
 */
async function notifyQuoteRequestSuppliers(
  { agencyName, projectName, categoryName, briefExcerpt, suppliers }
) {
  const subject = `New quote request from ${agencyName}`;
  const briefLine = briefExcerpt
    ? `Brief:\n${briefExcerpt}`
    : 'Brief: see the request for full details.';
  for (const s of suppliers || []) {
    const text =
`${agencyName} has sent you a quote request on Ballpark.

Project:   ${projectName}
Category:  ${categoryName}

${briefLine}

Log in to Ballpark to view the full request and respond with your quote.

— Ballpark`;
    if (!QUOTE_REQUEST_EMAILS_ENABLED) {
      console.log(`[quote-email] disabled — would notify ${s.name || s.id} <${s.email || 'no email'}>`);
      continue;
    }
    if (!s.email) {
      console.warn(`[quote-email] supplier ${s.name || s.id} has no email on file — skipped`);
      continue;
    }
    try {
      await sendEmail({ to: s.email, subject, text });
      console.log(`[quote-email] sent to ${s.email}`);
    } catch (e) {
      console.error(`[quote-email] send failed for ${s.email}:`, e.message);
    }
  }
}

/**
 * Send Brief-tab requirement(s) out to suppliers for competitive quotes.
 *
 * quote_requests is a STATUS TRACKER on top of existing infrastructure —
 * it does not replace it:
 *   • the Ball spend     → balls_transactions — ONE 'debit' per outreach
 *     (project-level, shared by every quote_request in the batch).
 *   • the conversation   → messages — one outbound anchor per supplier.
 *   • the quote lines    → message_items — one per requirement per message.
 *   • quote_requests     → one row per (requirement × supplier) holding
 *     status + links to the message thread and the Ball transaction.
 *
 * All writes run inside a single DB transaction so a failure leaves no
 * half-sent outreach (and no spent Ball).
 *
 * body: {
 *   project_id, project_category_id?, category_id,
 *   requirements: [ { kind:'matched', item_id } |
 *                   { kind:'new', name, description?, estimated_price? } ],
 *   supplier_ids: [ orgId, ... ],
 *   subject?, body?   — the agency-composed email (the user edits it before
 *                       sending). Stored verbatim on each supplier message;
 *                       falls back to generated copy when omitted.
 *   user_id?
 * }
 */
async function requestQuotes(body) {
  const {
    project_id, project_category_id, category_id,
    requirements, supplier_ids, user_id,
    subject: composedSubject, body: composedBody
  } = body || {};

  if (!project_id)  throw httpErr('project_id is required', 400);
  if (!category_id) throw httpErr('category_id is required', 400);
  const reqs = Array.isArray(requirements) ? requirements : [];
  const supplierIds = Array.isArray(supplier_ids)
    ? [...new Set(supplier_ids.filter(Boolean))] : [];
  if (!reqs.length)        throw httpErr('at least one requirement is required', 400);
  if (!supplierIds.length) throw httpErr('select at least one supplier', 400);

  // Project → agency org + name; category name + brief for the message
  // copy and the supplier email.
  const proj = await pool.query(
    `SELECT p.org_id, p.name AS project_name, ag.name AS agency_name,
            c.name AS category_name, pc.requirement_brief
       FROM projects p
       JOIN orgs ag ON ag.id = p.org_id
       LEFT JOIN categories c ON c.id = $2
       LEFT JOIN project_categories pc ON pc.id = $3
      WHERE p.id = $1`,
    [project_id, category_id, project_category_id || null]
  );
  if (!proj.rows.length) throw httpErr('project not found', 404);
  const agencyOrgId  = proj.rows[0].org_id;
  const agencyName   = proj.rows[0].agency_name || 'An agency';
  const projectName  = proj.rows[0].project_name || 'this project';
  const categoryName = proj.rows[0].category_name || 'this category';
  const briefExcerpt = (proj.rows[0].requirement_brief || '').trim().slice(0, 280);

  // One Ball per outreach — verify the agency can afford it.
  const bal = await pool.query('SELECT balls_balance FROM orgs WHERE id = $1', [agencyOrgId]);
  const balance = bal.rows.length ? Number(bal.rows[0].balls_balance) || 0 : 0;
  if (balance < 1) {
    throw httpErr('Not enough Balls to send this outreach — top up to continue.', 402);
  }

  const supRes = await pool.query(
    'SELECT id, name, email FROM orgs WHERE id = ANY($1::uuid[])', [supplierIds]
  );
  const supName  = new Map(supRes.rows.map(s => [s.id, s.name]));
  const supEmail = new Map(supRes.rows.map(s => [s.id, s.email]));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Resolve each requirement to a concrete items row + a display spec.
    //  • matched → an existing catalogue item.
    //  • new     → create an agency-owned item, is_active = false +
    //    approval_status = 'pending' so it never enters the catalogue on
    //    its own; it only goes live if a supplier wins the quote.
    const resolved = [];
    for (const r of reqs) {
      if (r && r.kind === 'new') {
        if (!r.name) throw httpErr('a new requirement needs a name', 400);
        const price = Math.max(0, Number(r.estimated_price) || 0);
        // v1.51f — items has a UNIQUE(org_id, name) index; re-sending a
        // brief for the same new requirement must reuse + refresh that
        // row, not error. ON CONFLICT keeps the outreach idempotent.
        const ins = await client.query(
          `INSERT INTO items (org_id, category_id, name, description, base_price,
                              is_active, approval_status)
           VALUES ($1, $2, $3, $4, $5, false, 'pending')
           ON CONFLICT (org_id, name) DO UPDATE SET
             category_id = EXCLUDED.category_id,
             description = EXCLUDED.description,
             base_price  = EXCLUDED.base_price,
             updated_at  = NOW()
           RETURNING id, name, description, base_price`,
          [agencyOrgId, category_id, r.name, r.description || '', price]
        );
        const it = ins.rows[0];
        resolved.push({
          item_id: it.id, name: it.name,
          description: it.description, price: it.base_price
        });
      } else {
        const itemId = r && r.item_id;
        if (!itemId) throw httpErr('a matched requirement needs an item_id', 400);
        const got = await client.query(
          'SELECT id, name, description, base_price FROM items WHERE id = $1', [itemId]
        );
        if (!got.rows.length) throw httpErr(`item ${itemId} not found`, 404);
        const it = got.rows[0];
        resolved.push({
          item_id: it.id, name: it.name,
          description: it.description, price: it.base_price
        });
      }
    }

    // ONE Ball debit for the whole outreach (project-level).
    const ballTx = await client.query(
      `INSERT INTO balls_transactions
         (org_id, project_id, supplier_org_id, user_id, amount, direction, reason, description)
       VALUES ($1, $2, NULL, $3, 1, 'debit', 'spend', $4)
       RETURNING id`,
      [agencyOrgId, project_id, user_id || null,
       `Quote outreach — ${categoryName}: ${supplierIds.length} supplier(s)`]
    );
    const ballTxId = ballTx.rows[0].id;
    await client.query(
      'UPDATE orgs SET balls_balance = balls_balance - 1, updated_at = NOW() WHERE id = $1',
      [agencyOrgId]
    );

    // Per supplier: one outbound message (the conversation anchor), its
    // line items, and a quote_requests row per requirement.
    const createdIds = [];
    for (const sid of supplierIds) {
      // NB: messages.category_id is a FK to project_categories(id) — the
      // project's scoped category row, NOT the catalogue category.
      const msg = await client.query(
        `INSERT INTO messages
           (project_id, user_id, supplier_org_id, category_id, category_name,
            supplier_name, subject, body, direction, msg_status, read)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'outbound', 'sent', false)
         RETURNING id`,
        [project_id, user_id || null, sid, project_category_id || null, categoryName,
         supName.get(sid) || null,
         // The agency edits the email before sending — store it verbatim.
         (composedSubject && composedSubject.trim())
           || `Quote request — ${projectName}`,
         (composedBody && composedBody.trim())
           || (`We'd like a quote for the following on "${projectName}" (${categoryName}). ` +
               `Please review the item(s) below and reply with your price and lead time.`)]
      );
      const msgId = msg.rows[0].id;

      for (const rq of resolved) {
        await client.query(
          `INSERT INTO message_items (message_id, name, description, price, item_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [msgId, rq.name, rq.description || '', rq.price, rq.item_id]
        );
        const qr = await client.query(
          `INSERT INTO quote_requests
             (project_id, project_category_id, category_id, item_id,
              supplier_org_id, status, message_thread_id, ball_transaction_id)
           VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7)
           RETURNING id`,
          [project_id, project_category_id || null, category_id, rq.item_id,
           sid, msgId, ballTxId]
        );
        createdIds.push(qr.rows[0].id);
      }
    }

    await client.query('COMMIT');

    // Best-effort email nudge — fire-and-forget so it never delays or
    // breaks the outreach response. OFF by default (see the flag above).
    notifyQuoteRequestSuppliers({
      agencyName, projectName, categoryName, briefExcerpt,
      suppliers: supplierIds.map(sid => ({
        id: sid, name: supName.get(sid), email: supEmail.get(sid)
      }))
    }).catch(e => console.error('[quote-email] batch failed:', e.message));

    return {
      ok: true,
      quote_request_ids: createdIds,
      suppliers: supplierIds.length,
      requirements: resolved.length,
      ball_transaction_id: ballTxId,
      balls_balance: balance - 1
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Quote-request status for a project — lets the Brief tab show which
    requirements are already out for quote. */
async function listProjectQuoteRequests(projectId) {
  if (!projectId) throw httpErr('projectId is required', 400);
  const r = await pool.query(
    `SELECT qr.id, qr.item_id, qr.category_id, qr.project_category_id,
            qr.supplier_org_id, qr.status, qr.created_at,
            o.name AS supplier_name
       FROM quote_requests qr
       LEFT JOIN orgs o ON o.id = qr.supplier_org_id
      WHERE qr.project_id = $1
      ORDER BY qr.created_at DESC`,
    [projectId]
  );
  return r.rows;
}

/** v1.52e — turn an AI-proposed brief item into a real (but inactive,
    approval-pending) catalogue row so the Brief tab's ✎ / 👁 actions can
    open it in the item drawer / on the item detail page. Mirrors the
    'proposed' branch of addMatchToProject exactly — same org_id
    (the AI-named supplier) + same ON CONFLICT (org_id, name) upsert — so
    materialising then adding reuses one row instead of creating two. */
async function materializeProposedItem(body) {
  const { supplier_id, category_id, name, description, estimated_price } = body || {};
  if (!supplier_id || !category_id || !name) {
    throw httpErr('supplier_id, category_id and name are required', 400);
  }
  const price = Math.max(0, Number(estimated_price) || 0);
  const r = await pool.query(
    `INSERT INTO items (org_id, category_id, name, description, base_price,
                        is_active, approval_status)
     VALUES ($1, $2, $3, $4, $5, false, 'pending')
     ON CONFLICT (org_id, name) DO UPDATE SET
       category_id = EXCLUDED.category_id,
       description = EXCLUDED.description,
       base_price  = EXCLUDED.base_price,
       updated_at  = NOW()
     RETURNING *`,
    [supplier_id, category_id, name, description || '', price]
  );
  return r.rows[0];
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
  const msg = await aiCreate(client,{
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
      const msg = await aiCreate(client,{
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
  setItemTags,
  getDimensions,
  categorySuppliers,
  eventTypes,
  matchItems,
  addMatchToProject,
  saveSearchHint,
  requestQuotes,
  listProjectQuoteRequests,
  materializeProposedItem,
  suggestSubcategory,
  backfillSubcategories
};
