// pV2-PROJECTS-01 — projects domain service (route handlers stay thin;
// SQL + the status dual-model live here). The v2 surface is org-scoped:
// callers ALWAYS pass req.user.org_id (never client-supplied).
//
// STATUS DUAL-MODEL (Liam, option d): projects carries both the new
// `status` codelist code (v2 reads it; <app-status-pill list="project_status">)
// AND the legacy `status_id` FK to public.statuses (v1 on :4200 reads it).
// Writers MUST set both — resolveStatus() returns the matching status_id
// for a code so create/update can dual-write. statuses.name for
// entity_type='project' is draft/active/completed/archived, 1:1 with the
// codelist, so the mapping is exact.

const pool = require('../db/pool');
const { withTransaction } = require('../db/with-transaction');
const taxonomy = require('./taxonomy.service');
const { computeEstimate } = require('./estimate');

/** The project_status codelist default — used when a code is unknown/absent. */
const DEFAULT_STATUS = 'draft';

/** code → statuses.id (entity_type='project'), memoised per process. The
 *  statuses rows are seed data — stable within a deploy. */
let statusIdCache = null;

async function statusMap() {
  if (statusIdCache) return statusIdCache;
  const r = await pool.query(
    `SELECT id, name FROM statuses WHERE entity_type = 'project' AND is_active`
  );
  statusIdCache = new Map(r.rows.map((row) => [row.name, row.id]));
  return statusIdCache;
}

/** Resolve a project_status code to { status, statusId } for dual-write.
 *  Unknown codes fall back to the codelist default. Returns statusId=null
 *  if even the default has no statuses row (degraded, but never throws —
 *  the v2 `status` column is the source of truth; status_id is v1 compat). */
async function resolveStatus(code) {
  const map = await statusMap();
  const status = map.has(code) ? code : DEFAULT_STATUS;
  return { status, statusId: map.get(status) ?? null };
}

/** Card-shaped projection for the v2 list (PROJECTS-01). org-scoped;
 *  excludes soft-deleted. Suppliers count = distinct supplier orgs across
 *  the project's quote items (correlated subquery — fine for an org's
 *  project count). */
// Per-line total honouring the install basis (pV2-CART-01). Aliases: pi
// (project_items) + i (items). base × qty, plus install when installed —
// per_order = flat once, percentage = % of the base line, else (NULL) per_item
// (× qty). Reused by the card subtotal + getEstimate so they can't drift.
const LINE_TOTAL_SQL = `
  COALESCE(pi.base_price, 0) * pi.quantity
  + CASE
      WHEN NOT COALESCE(pi.installed, true) OR i.install_cost IS NULL THEN 0
      WHEN i.install_unit = 'per_order'  THEN i.install_cost
      WHEN i.install_unit = 'percentage' THEN COALESCE(pi.base_price, 0) * pi.quantity * (i.install_cost / 100.0)
      ELSE i.install_cost * pi.quantity
    END`;

const LIST_SELECT = `
  SELECT p.id, p.name, p.event_name, p.ref, p.status,
         p.cover_image_url, p.client_logo_url,
         p.cover_focal_x, p.cover_focal_y, p.icon_name, p.icon_color,
         p.unsplash_photographer_name, p.unsplash_photo_url,
         p.currency, p.default_contingency_pct, p.default_margin_pct, p.default_vat_pct,
         p.created_at, p.updated_at,
         c.name AS client_name,
         (SELECT COUNT(DISTINCT i.org_id)
            FROM project_items pi
            JOIN items i ON i.id = pi.item_id
           WHERE pi.project_id = p.id AND pi.deleted_at IS NULL) AS supplier_count,
         -- Live quote subtotal — qty × (base + install). "Assume installed":
         -- an item's install cost is included by default when the catalogue
         -- item has one (the Estimate tab lets the agent opt a line out; the
         -- card shows the default all-installed Ballpark). Run through the
         -- cascade below → matches getEstimate + the Estimate tab.
         (SELECT COALESCE(SUM(${LINE_TOTAL_SQL}), 0)
            FROM project_items pi
            LEFT JOIN items i ON i.id = pi.item_id
           WHERE pi.project_id = p.id AND pi.deleted_at IS NULL) AS quote_subtotal
    FROM projects p
    LEFT JOIN clients c ON c.id = p.client_id
   WHERE p.org_id = $1 AND p.deleted_at IS NULL
   ORDER BY p.created_at DESC`;

/** The card's headline Ballpark = the live quote's client total, via the ONE
 *  cascade (services/estimate.js) the Estimate tab also uses — so the two can
 *  never drift. null when unquoted so the card reads "£0" rather than a fake
 *  figure (computeEstimate would return 0). */
function cardBallpark(row) {
  const subtotal = Number(row.quote_subtotal ?? 0);
  if (subtotal <= 0) return null;
  return computeEstimate(subtotal, {
    contingencyPct: row.default_contingency_pct,
    marginPct: row.default_margin_pct,
    vatPct: row.default_vat_pct,
  }).clientTotal;
}

function toCard(row) {
  return {
    id: row.id,
    // v1 card title = event_name with a name fallback.
    name: row.event_name || row.name,
    ref: row.ref,
    status: row.status ?? DEFAULT_STATUS,
    coverUrl: row.cover_image_url,
    coverFocalX: row.cover_focal_x ?? 50,
    coverFocalY: row.cover_focal_y ?? 50,
    iconName: row.icon_name ?? null,
    iconColor: row.icon_color ?? null,
    unsplashPhotographerName: row.unsplash_photographer_name ?? null,
    unsplashPhotoUrl: row.unsplash_photo_url ?? null,
    clientName: row.client_name ?? null,
    clientLogoUrl: row.client_logo_url ?? null,
    // The headline "Ballpark" total — the live quote's client total (same
    // cascade as the Estimate tab: subtotal → +contingency → +margin →
    // +VAT). null when nothing's quoted yet.
    ballparkCost: cardBallpark(row),
    currency: row.currency ?? 'GBP',
    supplierCount: Number(row.supplier_count ?? 0),
    // v1 card relative-time is off updated_at (created_at fallback).
    updatedAt: row.updated_at ?? row.created_at,
  };
}

/** Every non-deleted project for the org, newest first, as list cards. */
async function listForOrg(orgId) {
  const r = await pool.query(LIST_SELECT, [orgId]);
  return r.rows.map(toCard);
}

/** The full editable detail projection (PROJECTS-02 — Project Details tab). */
function toDetail(row) {
  return {
    id: row.id,
    ref: row.ref,
    name: row.name,
    status: row.status ?? DEFAULT_STATUS,
    description: row.description,
    eventType: row.event_type,
    eventDate: row.event_date,
    venueName: row.venue_name,
    venueCity: row.venue_city,
    venueAddress: row.venue_address,
    guestCount: row.guest_count,
    durationDays: row.duration_days,
    projectBudget: row.project_budget === null ? null : Number(row.project_budget),
    currency: row.currency ?? 'GBP',
    tier: row.tier,
    // Financial defaults for the Estimate tab breakdown (v1 formula).
    defaultMarginPct: row.default_margin_pct === null ? null : Number(row.default_margin_pct),
    defaultContingencyPct: row.default_contingency_pct === null ? null : Number(row.default_contingency_pct),
    defaultVatPct: row.default_vat_pct === null ? null : Number(row.default_vat_pct),
    eventName: row.event_name,
    clientName: row.client_name ?? null,
    coverUrl: row.cover_image_url,
    // Media (pV2-MEDIA-01b): cover focal point + icon fallback + Unsplash attribution.
    coverFocalX: row.cover_focal_x ?? 50,
    coverFocalY: row.cover_focal_y ?? 50,
    clientLogoUrl: row.client_logo_url ?? null,
    cardColor: row.card_color ?? null,
    iconName: row.icon_name ?? null,
    iconColor: row.icon_color ?? null,
    unsplashPhotographerName: row.unsplash_photographer_name ?? null,
    unsplashPhotoUrl: row.unsplash_photo_url ?? null,
    // Gallery strip (pV2-MEDIA-01c). jsonb → already a JS array out of pg.
    images: Array.isArray(row.images) ? row.images : [],
    totalBallparkCost: row.total_ballpark_cost === null ? null : Number(row.total_ballpark_cost),
    createdAt: row.created_at,
  };
}

/** One project by id, scoped to the org (JWT). Null when not found / not
 *  this org / soft-deleted — the route turns that into a 404. Joins the
 *  client name (read-only display in the Details tab). */
async function getDetail(orgId, id) {
  const r = await pool.query(
    `SELECT p.*, c.name AS client_name
       FROM projects p
       LEFT JOIN clients c ON c.id = p.client_id
      WHERE p.id = $1 AND p.org_id = $2 AND p.deleted_at IS NULL`,
    [id, orgId]
  );
  return r.rows.length ? toDetail(r.rows[0]) : null;
}

/** Editable columns the Project Details tab can PUT — code↔column map kept
 *  explicit so a stray body key can never reach SQL. */
const EDITABLE = {
  name: 'name',
  description: 'description',
  eventType: 'event_type',
  eventDate: 'event_date',
  venueName: 'venue_name',
  venueCity: 'venue_city',
  venueAddress: 'venue_address',
  guestCount: 'guest_count',
  durationDays: 'duration_days',
  projectBudget: 'project_budget',
  currency: 'currency',
  tier: 'tier',
  defaultMarginPct: 'default_margin_pct',
  defaultContingencyPct: 'default_contingency_pct',
  defaultVatPct: 'default_vat_pct',
  // Media (pV2-MEDIA-01b) — the picker result maps here.
  coverImageUrl: 'cover_image_url',
  clientLogoUrl: 'client_logo_url',
  cardColor: 'card_color',
  iconName: 'icon_name',
  iconColor: 'icon_color',
  coverFocalX: 'cover_focal_x',
  coverFocalY: 'cover_focal_y',
  unsplashPhotographerName: 'unsplash_photographer_name',
  unsplashPhotoUrl: 'unsplash_photo_url',
  images: 'images',
};

/** Partial update, org-scoped. Status is dual-written (code + status_id)
 *  when `status` is supplied. Returns the fresh detail, or null if the
 *  row isn't this org's. */
async function updateDetail(orgId, id, patch) {
  const sets = [];
  const vals = [];
  for (const [key, col] of Object.entries(EDITABLE)) {
    if (patch[key] !== undefined) {
      if (key === 'images') {
        // jsonb column — serialize the array + cast (pg would otherwise try to
        // bind a JS array as a Postgres ARRAY, not jsonb).
        vals.push(JSON.stringify(patch.images ?? []));
        sets.push(`${col} = $${vals.length}::jsonb`);
      } else {
        vals.push(patch[key]);
        sets.push(`${col} = $${vals.length}`);
      }
    }
  }
  if (patch.status !== undefined) {
    const { status, statusId } = await resolveStatus(patch.status);
    vals.push(status);
    sets.push(`status = $${vals.length}`);
    vals.push(statusId);
    sets.push(`status_id = $${vals.length}`);
  }
  if (!sets.length) return getDetail(orgId, id);
  vals.push(id);
  vals.push(orgId);
  const r = await pool.query(
    `UPDATE projects SET ${sets.join(', ')}, updated_at = NOW()
      WHERE id = $${vals.length - 1} AND org_id = $${vals.length} AND deleted_at IS NULL
      RETURNING id`,
    vals
  );
  // Re-fetch through getDetail so the returned projection carries the
  // joined client name (RETURNING * wouldn't have it).
  return r.rows.length ? getDetail(orgId, id) : null;
}

/** Create a project from an AI-parsed brief (pV2-PROJECTS-03 scoped — no
 *  items/categories). orgId is the JWT org (never client). Atomic
 *  (Rule 1): the ref-counter bump + the insert are one transaction.
 *  Dual-writes status (codelist code) AND status_id (legacy FK) so v1
 *  stays consistent. Returns the new project's list-card shape. */
async function create(orgId, data) {
  const { status, statusId } = await resolveStatus(DEFAULT_STATUS);
  const name = (data.name && data.name.trim()) || 'Untitled project';

  return withTransaction(async (client) => {
    // Atomic ref allocation — UPDATE…RETURNING ticks the org counter and
    // hands back the prefix in one statement (no two-create race).
    const counter = await client.query(
      `UPDATE orgs SET ref_counter = COALESCE(ref_counter, 0) + 1
        WHERE id = $1
        RETURNING ref_prefix, ref_counter, name,
                  default_margin_pct, default_contingency_pct, default_vat_pct`,
      [orgId]
    );
    let ref = null;
    // Each project carries its own financial defaults, seeded from the org's
    // (Profile → Financial defaults). Falls back to the v1 house rates when
    // the org hasn't set one. Stored on the project so it can be overridden
    // per-project later without disturbing the org default or other projects.
    let marginPct = 20;
    let contingencyPct = 10;
    let vatPct = 20;
    if (counter.rows.length) {
      const row = counter.rows[0];
      const prefix =
        (row.ref_prefix || '').trim() ||
        ((row.name || 'BP').replace(/[^A-Za-z]/g, '').slice(0, 2) || 'BP').toUpperCase();
      ref = `${prefix.toUpperCase()}-${String(row.ref_counter).padStart(3, '0')}`;
      if (row.default_margin_pct !== null) marginPct = Number(row.default_margin_pct);
      if (row.default_contingency_pct !== null) contingencyPct = Number(row.default_contingency_pct);
      if (row.default_vat_pct !== null) vatPct = Number(row.default_vat_pct);
    }

    const r = await client.query(
      `INSERT INTO projects (
         org_id, name, description, event_type, event_date,
         venue_name, venue_city, guest_count, duration_days,
         tier, currency, raw_brief_text, parsed_brief_json,
         status, status_id, ref,
         default_margin_pct, default_contingency_pct, default_vat_pct
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       RETURNING *`,
      [
        orgId,
        name,
        data.description ?? null,
        data.eventType ?? null,
        data.eventDate ?? null,
        data.venueName ?? null,
        data.venueCity ?? null,
        data.guestCount ?? null,
        data.durationDays ?? null,
        data.tier ?? null,
        data.currency ?? 'GBP',
        data.rawBriefText ?? null,
        data.parsedBrief ? JSON.stringify(data.parsedBrief) : null,
        status,
        statusId,
        ref,
        marginPct,
        contingencyPct,
        vatPct,
      ]
    );
    return toCard(r.rows[0]);
  });
}

// ── Project Quote (PROJECTS-02 slice 2) ──────────────────────────────────
// Minimal add/remove against project_items (the full QuoteService — totals,
// pricing, checkout — lands in 06f). Every op is org-scoped via a join to
// projects (the project must be the caller's, JWT org).

function toQuoteLine(row) {
  return {
    id: row.id, // project_items row id
    itemId: row.item_id,
    name: row.name,
    description: row.description ?? null,
    basePrice: row.base_price === null ? null : Number(row.base_price),
    // Installed-price extras (from the catalogue item) — drive the Final
    // Quote's Install / Deliverable toggle (pV2-FINAL-01).
    installCost: row.install_cost == null ? null : Number(row.install_cost),
    installDescription: row.install_description ?? null,
    installUnit: row.install_unit ?? null, // per_order | per_item | percentage (null = per_item)
    // Persisted Install choice: null = default (on when there's an install
    // cost), true/false = explicit (pV2-CART-01).
    installed: row.installed ?? null,
    unit: row.unit,
    imageUrl: row.image_url,
    quantity: Number(row.quantity ?? 1),
    // Category (joined via the live item) — the Estimate tab groups by it,
    // and the category card uses its cover image else its Lucide icon.
    categoryId: row.category_id ?? null,
    categoryName: row.category_name ?? null,
    categoryIconName: row.category_icon_name || null,
    categoryCoverUrl: row.category_cover_url || null, // '' → null (clean contract)
    // Supplier the item comes from (catalogue owner) + coarse send-state.
    supplierId: row.supplier_id ?? null,
    supplierName: row.supplier_name ?? null,
    supplierCity: row.supplier_city ?? null,
    status: quoteStatus(row.sent_status),
  };
}

/** One quote line WITH its joined category, by project_items id. Works on a
 *  pool or a transaction client. Returns the category-complete line so the
 *  add/patch responses group correctly (no "Uncategorised" until refresh). */
// Category is SNAPSHOT (pi.category_id, frozen at add) so a line stays in the
// category it was added under even if the item is later recategorised; the
// NAME/visuals live-join from categories so a category RENAME still
// propagates. (Relies on categories being soft-delete-only.)
const QUOTE_LINE_JOIN = `
  SELECT pi.id, pi.item_id, pi.name,
         -- Prefer the snapshot description, else the live catalogue item's
         -- (project_items.description is often empty; the preview needs one).
         COALESCE(pi.description, i.description) AS description,
         pi.base_price, pi.unit, pi.image_url, pi.quantity,
         pi.installed,
         pi.category_id, c.name AS category_name,
         c.icon_name AS category_icon_name, c.cover_image_url AS category_cover_url,
         i.install_cost, i.install_description, i.install_unit,
         -- Supplier = the item's catalogue owner (marketplace source), so the
         -- cart cat card can say "N items from <supplier>" pre-outreach.
         i.org_id AS supplier_id, o.name AS supplier_name, o.city AS supplier_city,
         -- Send-state: the item's latest OUTBOUND brief line status for this
         -- project (NULL = never sent = still in the cart). Drives the
         -- cart/final split + the per-item badge (pV2-CART-01).
         (SELECT mi.status
            FROM message_items mi
            JOIN messages m ON m.id = mi.message_id
           WHERE m.project_id = pi.project_id AND m.direction = 'outbound'
             AND mi.item_id = pi.item_id AND mi.deleted_at IS NULL
           ORDER BY mi.created_at DESC LIMIT 1) AS sent_status
    FROM project_items pi
    LEFT JOIN categories c ON c.id = pi.category_id
    LEFT JOIN items i ON i.id = pi.item_id
    LEFT JOIN orgs o ON o.id = i.org_id`;

/** Collapse a message_item send-status into the quote line's coarse status:
 *  to_send (never sent) → out_for_quote → quoted → booked / declined. */
function quoteStatus(sentStatus) {
  if (!sentStatus) return 'to_send';
  if (sentStatus === 'brief_sent' || sentStatus === 'holding') return 'out_for_quote';
  if (sentStatus === 'accepted' || sentStatus === 'booked') return 'booked';
  if (String(sentStatus).startsWith('declined')) return 'declined';
  return 'quoted'; // quoted / adjusted_by_supplier / adjusted_by_agent
}

async function lineById(db, id) {
  const r = await db.query(`${QUOTE_LINE_JOIN} WHERE pi.id = $1`, [id]);
  return r.rows.length ? toQuoteLine(r.rows[0]) : null;
}

/** The project's quote lines (snapshot fields on project_items). Returns
 *  null if the project isn't the org's (→ 404). */
async function listItems(orgId, projectId) {
  const owns = await pool.query(
    `SELECT 1 FROM projects WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
    [projectId, orgId]
  );
  if (!owns.rows.length) return null;
  const r = await pool.query(
    `${QUOTE_LINE_JOIN}
      WHERE pi.project_id = $1 AND pi.deleted_at IS NULL
      ORDER BY c.name NULLS LAST, pi.created_at ASC`,
    [projectId]
  );
  return r.rows.map(toQuoteLine);
}

/** The project's estimate breakdown — the SINGLE server-computed cascade the
 *  Estimate tab consumes (it no longer recomputes client-side). Subtotal is
 *  the live SUM of qty × (base + install) over the quote's items — install is
 *  included by default ("assume installed"); `uninstalledItemIds` are the
 *  lines the agent opted out of install on (Estimate tab checkboxes). Run
 *  through the one cascade (services/estimate.js) with the project's rates.
 *  Returns null if the project isn't the org's (→ 404). */
async function getEstimate(orgId, projectId, scope = 'all') {
  const cartOnly = scope === 'cart';
  const r = await pool.query(
    `SELECT p.default_contingency_pct, p.default_margin_pct, p.default_vat_pct,
            (SELECT COALESCE(SUM(${LINE_TOTAL_SQL}), 0)
               FROM project_items pi
               LEFT JOIN items i ON i.id = pi.item_id
              WHERE pi.project_id = p.id AND pi.deleted_at IS NULL
                -- scope=cart → only still-in-cart (never-sent) items.
                AND ($3 = false OR NOT EXISTS (
                      SELECT 1 FROM message_items mi
                        JOIN messages m ON m.id = mi.message_id
                       WHERE m.project_id = pi.project_id AND m.direction = 'outbound'
                         AND mi.item_id = pi.item_id AND mi.deleted_at IS NULL))
            ) AS quote_subtotal
       FROM projects p
      WHERE p.id = $1 AND p.org_id = $2 AND p.deleted_at IS NULL`,
    [projectId, orgId, cartOnly]
  );
  if (!r.rows.length) return null;
  const row = r.rows[0];
  return computeEstimate(row.quote_subtotal, {
    contingencyPct: row.default_contingency_pct,
    marginPct: row.default_margin_pct,
    vatPct: row.default_vat_pct,
  });
}

/** pV2-QUANTITY-01 — smart auto-fill: the item's unit can map (via the
 *  item_unit codelist's auto_fill_field) to a project field, so adding it
 *  seeds a sensible default quantity (per-head → guest_count, per-day →
 *  duration_days). Falls back to 1 when there's no mapping or the project
 *  field is unset. Always ≥ 1. The user overrides via the qty input. */
async function defaultQuantity(client, unit, serves, project) {
  // Pack size wins: a platter that serves 10 → ceil(guests / 10). Needs a
  // guest count; falls back to 1 when the project hasn't set one.
  if (serves && Number(serves) > 0) {
    const g = Number(project.guest_count);
    return Number.isFinite(g) && g >= 1 ? Math.ceil(g / Number(serves)) : 1;
  }
  if (!unit) return 1;
  const m = await client.query(
    `SELECT auto_fill_field FROM shared.reference_codelist_values
      WHERE list_name = 'item_unit' AND code = $1`,
    [unit]
  );
  const field = m.rows[0]?.auto_fill_field;
  if (field === 'guest_count') return toPositiveInt(project.guest_count);
  if (field === 'duration_days') return toPositiveInt(project.duration_days);
  return 1;
}
function toPositiveInt(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/** Add an item to the project's quote (idempotent — a live row for the
 *  same item is reused, not duplicated). Snapshots name/price/unit/image
 *  from the catalogue item, and seeds a smart default quantity from the
 *  unit↔project-field mapping. Returns the line, or null if not the org's. */
async function addItem(orgId, projectId, itemId) {
  return withTransaction(async (client) => {
    const owns = await client.query(
      `SELECT guest_count, duration_days FROM projects
        WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
      [projectId, orgId]
    );
    if (!owns.rows.length) return null;
    // Look at ANY row for this (project, item) — incl. soft-deleted. The
    // unique index spans deleted rows, so a previously-removed item must be
    // REVIVED, not re-inserted (else duplicate-key on re-add).
    const existing = await client.query(
      `SELECT id, deleted_at FROM project_items
        WHERE project_id = $1 AND item_id = $2
        FOR UPDATE`,
      [projectId, itemId]
    );
    if (existing.rows.length && existing.rows[0].deleted_at === null) {
      return lineById(client, existing.rows[0].id); // already live in the quote
    }
    const snap = await client.query(
      `SELECT name, base_price, unit, image_url, serves, category_id FROM items WHERE id = $1 AND deleted_at IS NULL`,
      [itemId]
    );
    if (!snap.rows.length) return null; // unknown item → 404
    const s = snap.rows[0];
    const qty = await defaultQuantity(client, s.unit, s.serves, owns.rows[0]);

    let rowId;
    if (existing.rows.length) {
      // Revive the soft-deleted row: re-snapshot + reset qty/selection.
      const up = await client.query(
        `UPDATE project_items
            SET deleted_at = NULL, deleted_by = NULL, name = $2, base_price = $3, unit = $4,
                image_url = $5, quantity = $6, selection_type = 'selected', category_id = $7
          WHERE id = $1 RETURNING id`,
        [existing.rows[0].id, s.name, s.base_price, s.unit, s.image_url, qty, s.category_id]
      );
      rowId = up.rows[0].id;
    } else {
      const ins = await client.query(
        `INSERT INTO project_items (project_id, item_id, name, base_price, unit, image_url, quantity, selection_type, category_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'selected', $8)
         RETURNING id`,
        [projectId, itemId, s.name, s.base_price, s.unit, s.image_url, qty, s.category_id]
      );
      rowId = ins.rows[0].id;
    }
    return lineById(client, rowId);
  });
}

/** Has this item been sent for a quote on this project (an outbound brief
 *  line)? Once sent the quote row is READ-ONLY — edits happen in the inbox
 *  thread, not the quote (Liam 2026-07-08, pV2-CART-01). */
async function isItemSent(projectId, itemId) {
  const r = await pool.query(
    `SELECT 1 FROM message_items mi
       JOIN messages m ON m.id = mi.message_id
      WHERE m.project_id = $1 AND m.direction = 'outbound'
        AND mi.item_id = $2 AND mi.deleted_at IS NULL
      LIMIT 1`,
    [projectId, itemId]
  );
  return r.rows.length > 0;
}

/** pV2-QUANTITY-01 — set the quantity on a live quote line. Returns the
 *  updated line, false if no such live line, null if not the org's, 'locked'
 *  if the item is out for quote (read-only in the quote).
 *  Single write (the ownership SELECT + the UPDATE) — no transaction needed
 *  (Rule 1): the UPDATE re-scopes by project_id, so the ownership check can't
 *  be raced into a cross-org write. */
async function updateItem(orgId, projectId, itemId, patch) {
  const owns = await pool.query(
    `SELECT 1 FROM projects WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
    [projectId, orgId]
  );
  if (!owns.rows.length) return null;
  if (await isItemSent(projectId, itemId)) return 'locked';
  const sets = [];
  const vals = [projectId, itemId];
  if (patch.quantity !== undefined) {
    vals.push(patch.quantity);
    sets.push(`quantity = $${vals.length}`);
  }
  if (patch.installed !== undefined) {
    vals.push(patch.installed); // boolean | null
    sets.push(`installed = $${vals.length}`);
  }
  if (!sets.length) return false; // nothing to change
  const r = await pool.query(
    `UPDATE project_items SET ${sets.join(', ')}
      WHERE project_id = $1 AND item_id = $2 AND deleted_at IS NULL
      RETURNING id`,
    vals
  );
  if (!r.rows.length) return false; // no live line for this item
  return lineById(pool, r.rows[0].id);
}

/** Soft-remove an item from the project's quote. Returns true if a row was
 *  removed, false if none, null if the project isn't the org's, 'locked' if
 *  the item is out for quote (read-only in the quote). */
async function removeItem(orgId, projectId, itemId) {
  const owns = await pool.query(
    `SELECT 1 FROM projects WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
    [projectId, orgId]
  );
  if (!owns.rows.length) return null;
  if (await isItemSent(projectId, itemId)) return 'locked';
  const r = await pool.query(
    `UPDATE project_items SET deleted_at = NOW()
      WHERE project_id = $1 AND item_id = $2 AND deleted_at IS NULL
      RETURNING id`,
    [projectId, itemId]
  );
  return r.rows.length > 0;
}

// ── pV2-RECOMMEND: brief → recommended items (ported from v1) ─────────────
// The AI parse-brief returns category slugs; map them to the DB catalogue
// category NAMES (v1's AI_TO_DB), then run the v1 matchItems matcher per
// category and add its picks to the project's quote. The Estimate tab then
// displays them grouped by category — no separate "ballpark" screen needed.
const AI_TO_DB = {
  'set-build': 'Stand Structure',
  print: 'Graphics & Signage',
  av: 'AV & Technology',
  floral: 'Florals',
  venues: 'Venue',
  catering: 'Catering',
  photography: 'Photography',
  staffing: 'Staffing',
  'h-and-s': 'Health & Safety',
  furniture: 'Furniture & Fixtures',
  logistics: 'Logistics & Transport',
  entertainment: 'Entertainment',
  lighting: 'Lighting',
};

/** A starting set, not the whole catalogue — the human curates on the
 *  Estimate/Marketplace. Top N matched items (score-sorted) per category. */
const RECOMMEND_PER_CATEGORY = 5;

/** LOW end of a budget band (v1 lowOfBand) — "£15k–£20k" → 15000; null when
 *  unknown. Keeps the per-category budget conservative for the matcher. */
function lowOfBand(s) {
  if (!s) return null;
  const norm = String(s).replace(/[£,]/g, '').replace(/–|—/g, '-');
  if (/unknown|tbc/i.test(norm)) return null;
  const range = norm.match(/(\d+(?:\.\d+)?)\s*([kKmM])?\s*-\s*(\d+(?:\.\d+)?)\s*([kKmM])?/);
  const toNum = (n, sfx) => {
    const base = parseFloat(n);
    if ((sfx || '').toLowerCase() === 'k') return base * 1000;
    if ((sfx || '').toLowerCase() === 'm') return base * 1_000_000;
    return base;
  };
  if (range) return Math.round(toNum(range[1], range[2]));
  const single = norm.match(/(\d+(?:\.\d+)?)\s*([kKmM])?/);
  return single ? Math.round(toNum(single[1], single[2])) : null;
}

/** Recommend + add items for a project from its stored parsed brief. For each
 *  briefed category: resolve the DB category, run matchItems, add the top
 *  picks to the quote (via addItem — idempotent, snapshots + smart-fill qty).
 *  Returns a per-category summary. null if the project isn't the org's. */
async function recommend(orgId, projectId) {
  const pr = await pool.query(
    `SELECT parsed_brief_json FROM projects
      WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
    [projectId, orgId]
  );
  if (!pr.rows.length) return null;
  const brief = pr.rows[0].parsed_brief_json;
  const cats = Array.isArray(brief?.categories) ? brief.categories : [];

  // PHASE 1 — match every category CONCURRENTLY (the slow part). Each is one
  // Haiku round-trip (~7-8s); serial was sum-of-categories (40-50s). The reads
  // here are short pool queries (auto-released), and matchItems holds no pg
  // connection across the AI call — so no pool pressure. projectId=null skips
  // the per-category match cache (we add the items directly).
  const matched = await Promise.all(
    cats.map(async (c) => {
      const dbName = AI_TO_DB[c.categoryId];
      if (!dbName) return null;
      const catRow = await pool.query(
        `SELECT id FROM categories
          WHERE name = $1 AND namespace = 'catalogue' AND parent_id IS NULL
          LIMIT 1`,
        [dbName]
      );
      if (!catRow.rows.length) return null;
      const categoryId = catRow.rows[0].id;
      const catBrief = (c.oneLiner || c.categoryLabel || dbName).trim();
      const budget = lowOfBand(c.budgetEstimate);
      try {
        const m = await taxonomy.matchItems(catBrief, categoryId, budget, null);
        return { dbName, picks: (m.matched_items || []).slice(0, RECOMMEND_PER_CATEGORY) };
      } catch (err) {
        return { dbName, picks: [], error: err.message };
      }
    })
  );

  // PHASE 2 — add SEQUENTIALLY. addItem opens a transaction each; fanning these
  // out under the Phase-1 Promise.all would risk exhausting the pool (audit
  // H1). The adds are fast DB writes, so serial cost is negligible.
  const results = [];
  let totalAdded = 0;
  for (const m of matched) {
    if (!m) continue;
    let added = 0;
    for (const it of m.picks) {
      const line = await addItem(orgId, projectId, it.item_id);
      if (line) added += 1;
    }
    totalAdded += added;
    results.push(m.error ? { category: m.dbName, added, error: m.error } : { category: m.dbName, added });
  }
  return { categories: results, totalAdded };
}

module.exports = {
  listForOrg, getDetail, updateDetail, create,
  listItems, getEstimate, addItem, removeItem, updateItem, recommend,
  resolveStatus, DEFAULT_STATUS, toCard,
};
