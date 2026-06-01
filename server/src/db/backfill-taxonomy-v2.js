/**
 * v1.44 — Taxonomy v2 Part 3: backfill existing items.
 *
 * Runs two phases on ONE schema:
 *
 *   PHASE A — Legacy tag migration (deterministic, no AI).
 *     items.tags[] holds ~55 free-text values that are de-facto
 *     event-type data ("Gala", "Activation", …). Each is mapped to a
 *     controlled (dimension,label) pair and written to supplier_item_tag.
 *     "Outdoor" / "Outdoor Event" → setting=Outdoor (per the taxonomy
 *     decision); genuinely non-event values ("All Events", "Arena", …)
 *     are dropped. The legacy items.tags[] column is left intact.
 *
 *   PHASE B — AI classification backfill.
 *     Every active item with subcategory_id IS NULL is classified
 *     (subcategory + non-event-type attribute tags) WITHIN its existing
 *     category. One Haiku call per (category, batch of 15). Event-type
 *     is owned by Phase A, so it is excluded here.
 *
 * Idempotent: Phase A uses ON CONFLICT DO NOTHING; Phase B only touches
 * items still missing a subcategory. Safe to re-run.
 *
 * Usage:  node server/src/db/backfill-taxonomy-v2.js [schema]
 *         schema defaults to 'public'.
 */
require('dotenv').config({
  path: require('path').resolve(__dirname, '../../../.env'),
  override: true
});
const { Pool } = require('pg');

const SCHEMA = (process.argv[2] || 'public').replace(/[^a-z_]/gi, '');
const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const BATCH_SIZE = 15;

// ── Legacy items.tags[] → controlled (dimension, label). ──────────────
//    null = drop (not a real event type). Most land on event-type; the
//    two "Outdoor" variants land on the setting dimension.
const ET = d => ({ dimension: 'event-type', label: d });
const LEGACY_TAG_MAP = {
  'Gala':               ET('Gala'),
  'Product Launch':     ET('Product Launch'),
  'Activation':         ET('Brand Activation'),
  'Conference':         ET('Conference'),
  'Corporate Party':    ET('Corporate Party'),
  'Awards':             ET('Awards Ceremony'),
  'Wedding':            ET('Wedding'),
  'Premiere':           ET('Premiere / Screening'),
  'Festival':           ET('Festival'),
  'Corporate Dinner':   ET('Corporate Dining'),
  'Exhibition':         ET('Exhibition / Trade Show'),
  'Drinks Reception':   ET('Drinks Reception'),
  'AGM':                ET('AGM / Panel'),
  'Dinner':             ET('Corporate Dining'),
  'All Events':         null,
  'Pop-Up':             ET('Pop-Up / Retail'),
  'Brand Event':        ET('Brand Activation'),
  'Retail Pop-Up':      ET('Pop-Up / Retail'),
  'Corporate Lunch':    ET('Corporate Dining'),
  'Corporate':          ET('Corporate Party'),
  'Corporate Event':    ET('Corporate Party'),
  'Brand Activation':   ET('Brand Activation'),
  'Corporate Events':   ET('Corporate Party'),
  'Outdoor Event':      { dimension: 'setting', label: 'Outdoor' },
  'Event':              null,
  'Brand Lunch':        ET('Corporate Dining'),
  'Standing Dinner':    ET('Corporate Dining'),
  'Corporate Morning':  ET('Conference'),
  'Daytime Event':      null,
  'Luxury Brand Event': ET('Brand Activation'),
  'Late Night Event':   null,
  'Influencer Event':   ET('Press / Influencer Event'),
  'Arena':              null,
  'Press Events':       ET('Press / Influencer Event'),
  'Panel Event':        ET('AGM / Panel'),
  'Arena Events':       null,
  'Retail':             ET('Pop-Up / Retail'),
  'Restaurant Launch':  ET('Product Launch'),
  'VIP Events':         null,
  'Trade Show':         ET('Exhibition / Trade Show'),
  'Theatre':            null,
  'Outdoor':            { dimension: 'setting', label: 'Outdoor' },
  'Training':           ET('Conference'),
  'Workshop':           ET('Conference'),
  'Webinar':            ET('Conference'),
  'Press Event':        ET('Press / Influencer Event'),
  'Launch':             ET('Product Launch'),
  'Client Screening':   ET('Premiere / Screening'),
  'Supper Club':        ET('Corporate Dining'),
  'Brand Dinner':       ET('Corporate Dining'),
  'Private Dinner':     ET('Corporate Dining'),
  'Press':              ET('Press / Influencer Event'),
  'Summer Party':       ET('Summer Party'),
  'Private Party':      ET('Corporate Party'),
  'Concert':            ET('Festival')
};

// Short category definitions (FINAL_TAXONOMY_v2.md) — help the classifier.
const CATEGORY_DEFS = {
  'Stand Structure': 'Physical structure/build/installation, incl. construction trades and flooring.',
  'Lighting': 'All lighting fixtures and design. NOT electrical infrastructure.',
  'AV & Technology': 'Audio, video, screens, projection, streaming, interactive tech, rigging, power, connectivity.',
  'Furniture & Fixtures': 'Hired furniture, display units, seating, tables.',
  'Catering': 'Food and drink services. Catering equipment stays here.',
  'Florals': 'Event floristry and botanical installations.',
  'Graphics & Signage': 'Printed, vinyl, branded materials. Incl. portable display stands.',
  'Staffing': 'All people hired for events, incl. catering staff.',
  'Health & Safety': 'Risk, compliance, insurance, safety services.',
  'Logistics & Transport': 'Moving things, storing things, site utilities.',
  'Entertainment': 'Live performance, hosted experiences, talent.',
  'Photography': 'Capture and content creation.',
  'Event Accessories': 'Finishing touches: red carpet, gift bags, lanyards, linen, glassware hire, pyro.',
  'Venue': 'Venue sourcing and hire.',
  'Other': 'Agency line items: PM fee, design fee, contingency, travel.'
};

function norm(s) {
  return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' ');
}
function parseJson(text) {
  try { return JSON.parse(text); } catch { /* fall through */ }
  const m = text && text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) { try { return JSON.parse(m[1].trim()); } catch { /* nope */ } }
  return null;
}

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  const q = (sql, params) => pool.query(sql, params);

  try {
    console.log(`\n=== Taxonomy v2 backfill (Part 3) — schema: ${SCHEMA} ===\n`);

    // ════════════════ PHASE A — legacy tag migration ════════════════
    console.log('── Phase A: legacy items.tags → supplier_item_tag ──');

    // tag lookup keyed by `${category_id}|${dimension}|${normLabel}`.
    const tagRows = await q(
      `SELECT id, category_id, dimension, label FROM ${SCHEMA}.tag`
    );
    const tagLookup = new Map();
    for (const t of tagRows.rows) {
      tagLookup.set(`${t.category_id}|${t.dimension}|${norm(t.label)}`, t.id);
    }

    const tagged = await q(
      `SELECT id, category_id, tags FROM ${SCHEMA}.items
        WHERE is_active = true AND tags IS NOT NULL
          AND array_length(tags, 1) > 0`
    );

    const aStats = { items: 0, written: 0, dropped: 0, noTagRow: 0 };
    const droppedValues = new Set();
    const noRowValues = new Set();
    for (const item of tagged.rows) {
      aStats.items++;
      for (const raw of item.tags) {
        const mapped = LEGACY_TAG_MAP[raw];
        if (mapped === undefined) {
          // Not in the map at all — treat as drop, but flag it.
          aStats.dropped++; droppedValues.add(raw + ' (unmapped)'); continue;
        }
        if (mapped === null) { aStats.dropped++; droppedValues.add(raw); continue; }
        const tagId = tagLookup.get(
          `${item.category_id}|${mapped.dimension}|${norm(mapped.label)}`
        );
        if (!tagId) {
          // e.g. an event-type value on a category that has no event-type
          // dimension (Health & Safety / Logistics / Other).
          aStats.noTagRow++; noRowValues.add(`${raw} → ${mapped.dimension}`); continue;
        }
        const r = await q(
          `INSERT INTO ${SCHEMA}.supplier_item_tag (item_id, tag_id)
           VALUES ($1, $2) ON CONFLICT (item_id, tag_id) DO NOTHING`,
          [item.id, tagId]
        );
        aStats.written += r.rowCount;
      }
    }
    console.log(`   items with legacy tags: ${aStats.items}`);
    console.log(`   supplier_item_tag rows written: ${aStats.written}`);
    console.log(`   values dropped (not an event type): ${aStats.dropped}` +
      (droppedValues.size ? `  [${[...droppedValues].join(', ')}]` : ''));
    console.log(`   skipped — no tag row for that category: ${aStats.noTagRow}` +
      (noRowValues.size ? `  [${[...noRowValues].join(', ')}]` : ''));

    // ════════════════ PHASE B — AI classification ════════════════════
    console.log('\n── Phase B: AI subcategory + attribute-tag backfill ──');

    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not configured');
    const Anthropic = require('@anthropic-ai/sdk');
    const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Children + non-event-type tags, indexed by parent category id.
    const cats = await q(
      `SELECT id, name, parent_id FROM ${SCHEMA}.categories WHERE namespace='catalogue'`
    );
    const parentName = new Map();
    const childrenByParent = new Map();
    for (const c of cats.rows) {
      if (!c.parent_id) { parentName.set(c.id, c.name); continue; }
      if (!childrenByParent.has(c.parent_id)) childrenByParent.set(c.parent_id, []);
      childrenByParent.get(c.parent_id).push({ id: c.id, name: c.name });
    }
    const dimTags = await q(
      `SELECT id, category_id, dimension, label FROM ${SCHEMA}.tag
        WHERE dimension <> 'event-type'`
    );
    const tagsByCategory = new Map();
    for (const t of dimTags.rows) {
      if (!tagsByCategory.has(t.category_id)) tagsByCategory.set(t.category_id, []);
      tagsByCategory.get(t.category_id).push(t);
    }

    // Items needing a subcategory, grouped by category.
    const todo = await q(
      `SELECT i.id, i.name, i.description, i.category_id
         FROM ${SCHEMA}.items i
         JOIN ${SCHEMA}.categories c ON c.id = i.category_id
        WHERE i.is_active = true AND i.subcategory_id IS NULL
          AND c.parent_id IS NULL
        ORDER BY i.category_id, i.created_at`
    );
    const byCategory = new Map();
    for (const it of todo.rows) {
      if (!byCategory.has(it.category_id)) byCategory.set(it.category_id, []);
      byCategory.get(it.category_id).push(it);
    }
    console.log(`   items needing classification: ${todo.rows.length}\n`);

    const bStats = { subcats: 0, tagRows: 0, noSubcat: 0, errors: 0 };

    for (const [catId, items] of byCategory) {
      const catName = parentName.get(catId) || '(unknown)';
      const children = childrenByParent.get(catId) || [];
      const catTags = tagsByCategory.get(catId) || [];
      if (!children.length) { console.log(`   ${catName}: no subcategories — skipped`); continue; }

      // Group this category's tags into a {dimension:[labels]} object.
      const dims = {};
      for (const t of catTags) {
        if (!dims[t.dimension]) dims[t.dimension] = [];
        dims[t.dimension].push(t.label);
      }

      let catSub = 0, catTagN = 0;
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        const payload = batch.map(it => ({
          item_id: it.id,
          name: it.name,
          description: (it.description || '').slice(0, 400)
        }));

        let parsed = null;
        try {
          const msg = await ai.messages.create({
            model: HAIKU_MODEL,
            max_tokens: 2200,
            system:
`You classify event-production catalogue items for Ballpark. Every item below belongs to the category "${catName}" (${CATEGORY_DEFS[catName] || ''}).

For EACH item return:
- "subcategory": the best-fitting subcategory, copied VERBATIM from the valid list, or null if none fits.
- "tags": an array of { "dimension": <key>, "label": <value> } for the attribute dimensions the item clearly satisfies. Copy values VERBATIM from the dimensions object. Only include tags you are confident about; omit a dimension if unknown. A dimension may yield more than one tag.

Return ONLY a JSON array, no markdown:
[ { "item_id": "uuid", "subcategory": "name or null", "tags": [ { "dimension": "key", "label": "value" } ] } ]`,
            messages: [{
              role: 'user',
              content:
`Valid subcategories: ${JSON.stringify(children.map(c => c.name))}

Tag dimensions: ${JSON.stringify(dims)}

Items to classify:
${JSON.stringify(payload, null, 1)}`
            }]
          });
          parsed = parseJson(msg.content?.[0]?.text);
        } catch (e) {
          console.log(`   ${catName}: batch failed — ${e.message}`);
          bStats.errors += batch.length;
          continue;
        }
        if (!Array.isArray(parsed)) { bStats.errors += batch.length; continue; }

        const byId = new Map(parsed.map(p => [p.item_id, p]));
        for (const it of batch) {
          const res = byId.get(it.id);
          if (!res) { bStats.noSubcat++; continue; }

          // Subcategory.
          const child = res.subcategory
            ? children.find(c => norm(c.name) === norm(res.subcategory))
            : null;
          if (child) {
            await q(
              `UPDATE ${SCHEMA}.items SET subcategory_id=$1, updated_at=NOW() WHERE id=$2`,
              [child.id, it.id]
            );
            bStats.subcats++; catSub++;
          } else {
            bStats.noSubcat++;
          }

          // Attribute tags.
          for (const sug of (Array.isArray(res.tags) ? res.tags : [])) {
            const hit = catTags.find(t =>
              norm(t.dimension) === norm(sug.dimension) && norm(t.label) === norm(sug.label)
            );
            if (!hit) continue;
            const r = await q(
              `INSERT INTO ${SCHEMA}.supplier_item_tag (item_id, tag_id)
               VALUES ($1,$2) ON CONFLICT (item_id, tag_id) DO NOTHING`,
              [it.id, hit.id]
            );
            bStats.tagRows += r.rowCount; catTagN += r.rowCount;
          }
        }
      }
      console.log(`   ${catName}: ${catSub}/${items.length} subcategorised, ${catTagN} attribute tags`);
    }

    console.log(`\n   subcategories set:      ${bStats.subcats}`);
    console.log(`   attribute tags written: ${bStats.tagRows}`);
    console.log(`   no subcategory match:   ${bStats.noSubcat}`);
    console.log(`   errors:                 ${bStats.errors}`);

    // ── Verification ──────────────────────────────────────────────────
    const v1 = await q(`SELECT COUNT(*)::int n FROM ${SCHEMA}.items WHERE is_active=true AND subcategory_id IS NULL`);
    const v2 = await q(`SELECT COUNT(*)::int n FROM ${SCHEMA}.supplier_item_tag`);
    const v3 = await q(`SELECT COUNT(DISTINCT item_id)::int n FROM ${SCHEMA}.supplier_item_tag`);
    console.log('\n  --- Verification ---');
    console.log(`  active items still without a subcategory: ${v1.rows[0].n}`);
    console.log(`  supplier_item_tag rows total:             ${v2.rows[0].n}`);
    console.log(`  distinct items with structured tags:      ${v3.rows[0].n}`);
    console.log(`\n✅ Backfill complete on ${SCHEMA}.\n`);
  } catch (err) {
    console.error('\n❌ Backfill failed:', err.message);
    console.error(err);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
