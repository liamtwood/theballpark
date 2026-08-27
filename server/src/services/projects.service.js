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
const { lineTotalSql, isDeclinedSql, notDeclinedSql } = require('./line-total.util');

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
// Per-line total honouring the install basis (pV2-CART-01) — the estimate binds
// the ONE shared formula (pV2-UNIFY-01) to the line's CURRENT price:
// price_current once negotiated, else the original base_price. The inbox binds
// the same formula to price_ref (Original) / price_current (Revised), and
// price_ref = base_price at send — so a negotiated line reads identically on the
// Final Quote and the inbox. Cart / Quote / Final / Inbox can't drift. Aliases:
// pi (project_items) + i (items).
const LINE_TOTAL_SQL = lineTotalSql('COALESCE(pi.price_current, pi.base_price)');

const LIST_SELECT = `
  SELECT p.id, p.name, p.event_name, p.ref, p.status,
         p.cover_image_url, p.client_logo_url,
         p.cover_focal_x, p.cover_focal_y, p.icon_name, p.icon_color,
         p.unsplash_photographer_name, p.unsplash_photo_url,
         p.currency, p.default_contingency_pct, p.default_margin_pct, p.default_vat_pct,
         p.created_at, p.updated_at,
         COALESCE(p.client_name, c.name) AS client_name,
         (SELECT COUNT(DISTINCT i.org_id)
            FROM project_items pi
            JOIN items i ON i.id = pi.item_id
           WHERE pi.project_id = p.id AND pi.deleted_at IS NULL) AS supplier_count,
         -- Live quote subtotal — qty × (base + install). "Assume installed":
         -- an item's install cost is included by default when the catalogue
         -- item has one (the Estimate tab lets the agent opt a line out; the
         -- card shows the default all-installed Ballpark). Run through the
         -- cascade below → matches getEstimate + the Estimate tab.
         (SELECT COALESCE(SUM(lt), 0) FROM (
            SELECT DISTINCT ON (pi.logical_line_id) (${LINE_TOTAL_SQL}) AS lt
              FROM project_items pi
              LEFT JOIN items i ON i.id = pi.item_id
             WHERE pi.project_id = p.id AND pi.deleted_at IS NULL
               -- child components (private buildup) never count (pV2-BUILDUP-02).
               AND pi.parent_id IS NULL
               -- Declined/cancelled lines drop out of the card total too, so it
               -- matches getEstimate + the Estimate tab (pV2-INBOX-05). ONE rule,
               -- line-total.util (audit 2026-07-17 B2).
               AND ${notDeclinedSql()}
             ORDER BY pi.logical_line_id,
                      (pi.status IN ('accepted','booked')) DESC NULLS LAST,
                      pi.created_at ASC, pi.id
          ) x) AS quote_subtotal
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

/** Distinct client names this org has used across its projects — feeds the
 *  About Project client type-ahead (self-populating, no codelist). */
async function listClientNames(orgId) {
  const r = await pool.query(
    `SELECT DISTINCT client_name
       FROM projects
      WHERE org_id = $1 AND deleted_at IS NULL AND NULLIF(TRIM(client_name), '') IS NOT NULL
      ORDER BY client_name ASC`,
    [orgId]
  );
  return r.rows.map((x) => x.client_name);
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
    `SELECT p.*, COALESCE(p.client_name, c.name) AS client_name
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
  clientName: 'client_name',
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
    isCustom: row.is_custom ?? false, // pV2-CUSTOMS-01: no catalogue backing
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
    supplierCurrency: row.supplier_currency ?? null,
    status: quoteStatus(row.sent_status),
    // The original library item (the request) — the inbox brief renders this
    // instead of the (possibly-revised) line. null fields for custom lines.
    libName: row.lib_name ?? null,
    libDescription: row.lib_description ?? null,
    libBasePrice: row.lib_base_price == null ? null : Number(row.lib_base_price),
    libServices: row.lib_install_description ?? null,
    libImageUrl: row.lib_image_url ?? null,
    hasOptions: row.has_options ?? false,
    // pV2-BUILDUP-03 — set when this line is a picked option of another line;
    // the Final Quote nests it under that parent + lists it in the item card.
    optionOfLineId: row.option_of_line_id ?? null,
    // pV2-BUILDUP-04 — the line's extras (child component names), name-only.
    extras: row.extra_names ?? [],
    // pV2-BUILDUP-04 — the line's Details free-text (markdown).
    details: row.details ?? null,
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
         -- CURRENT per-unit price + install (pV2-UNIFY-01 QC): a negotiated line
         -- reads price_current / its install override; else the original
         -- base_price / catalogue install. So the quote card matches the inbox.
         COALESCE(pi.price_current, pi.base_price)  AS base_price,
         pi.unit, pi.image_url, pi.quantity,
         pi.option_of_line_id, pi.details,
         pi.installed, pi.logical_line_id, pi.created_at, pi.is_custom,
         pi.category_id, c.name AS category_name,
         c.icon_name AS category_icon_name, c.cover_image_url AS category_cover_url,
         COALESCE(pi.install_cost, i.install_cost)  AS install_cost,
         -- Prefer the supplier's edited Services (Customize) over the catalogue's.
         COALESCE(pi.install_description, i.install_description) AS install_description,
         COALESCE(pi.install_unit, i.install_unit)  AS install_unit,
         -- The ORIGINAL library item (item_id), unmodified — the inbox brief
         -- renders THIS (the request) while the New-Cost card renders the line.
         i.name AS lib_name, i.description AS lib_description,
         i.base_price AS lib_base_price, i.install_description AS lib_install_description,
         i.image_url AS lib_image_url,
         -- pV2-BUILDUP-03 — does the catalogue item carry options (child items)?
         -- Drives the Final Quote "Options" button.
         EXISTS (SELECT 1 FROM items ci WHERE ci.parent_item_id = pi.item_id AND ci.deleted_at IS NULL) AS has_options,
         -- pV2-BUILDUP-04 — the line's "extras" = its child component names, so
         -- the inbox card can list them read-only without a second fetch.
         (SELECT array_agg(ch.name ORDER BY ch.created_at)
            FROM project_items ch WHERE ch.parent_id = pi.id AND ch.deleted_at IS NULL) AS extra_names,
         -- Supplier (pV2-UNIFY-01a): the ASKED supplier (supplier_org_id) once
         -- sent — the source of truth for who's quoting THIS row; pre-send it's
         -- NULL so we fall back to the item's catalogue owner (the default the
         -- cart cat card shows, "N items from <supplier>").
         COALESCE(pi.supplier_org_id, i.org_id) AS supplier_id,
         o.name AS supplier_name, o.city AS supplier_city, o.default_currency AS supplier_currency,
         -- Send-state: the line's negotiation status, now on project_items
         -- itself (pV2-UNIFY-01). NULL = never sent = still in the cart.
         -- Drives the cart/final split + the per-item badge (pV2-CART-01).
         pi.status AS sent_status
    FROM project_items pi
    LEFT JOIN categories c ON c.id = pi.category_id
    LEFT JOIN items i ON i.id = pi.item_id
    LEFT JOIN orgs o ON o.id = COALESCE(pi.supplier_org_id, i.org_id)`;

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

/** Batch of quote lines by project_items row id → Map<id, QuoteLine>. Keyed on
 *  the ROW id (not logical_line_id) so each per-supplier line resolves to its
 *  own QuoteLine — the inbox reuses this to render the SAME card the Final
 *  Quote shows under a message (pV2-INBOX-05). */
async function linesByIds(db, ids) {
  const map = new Map();
  if (!ids.length) return map;
  const r = await db.query(`${QUOTE_LINE_JOIN} WHERE pi.id = ANY($1::uuid[])`, [ids]);
  for (const row of r.rows) map.set(row.id, toQuoteLine(row));
  return map;
}

/** The project's quote lines (snapshot fields on project_items). Returns
 *  null if the project isn't the org's (→ 404). */
async function listItems(orgId, projectId) {
  const owns = await pool.query(
    `SELECT 1 FROM projects WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
    [projectId, orgId]
  );
  if (!owns.rows.length) return null;
  // pV2-UNIFY-01a: the Cart / Final Quote show ONE entry per logical line even
  // when it fanned out to N supplier rows — pick the accepted/booked row if any
  // (its negotiated price/supplier), else the canonical row. The inbox is where
  // the per-supplier rows are shown separately.
  const r = await pool.query(
    `SELECT * FROM (
       SELECT DISTINCT ON (sub.logical_line_id) sub.*
         FROM (${QUOTE_LINE_JOIN}
                -- parent_id IS NULL: child components (the private cost buildup)
                -- never surface as quote lines (pV2-BUILDUP-02).
                WHERE pi.project_id = $1 AND pi.deleted_at IS NULL AND pi.parent_id IS NULL) sub
        ORDER BY sub.logical_line_id,
                 (sub.sent_status IN ('accepted','booked')) DESC NULLS LAST,
                 -- Declined rows sort LAST so this pick lands on the same row
                 -- getEstimate/LIST_SELECT count (they filter declined out
                 -- entirely). We must NOT filter here — a declined line still has
                 -- to LIST with its pill — so we de-prioritise instead. Without
                 -- this, a logical line fanned out to two suppliers (one declined,
                 -- one live) could list the declined row at £0 while the banner
                 -- counted the live row (audit 2026-07-17 B2).
                 ${isDeclinedSql('sub.sent_status')} ASC,
                 sub.created_at ASC, sub.id
     ) picked
     ORDER BY picked.category_name NULLS LAST, picked.created_at ASC`,
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
            -- pV2-UNIFY-01a: a logical line can fan out to N supplier rows;
            -- count ONE per logical_line_id — the accepted/booked row if any
            -- (its negotiated price_current), else the canonical row (base_price).
            (SELECT COALESCE(SUM(lt), 0) FROM (
               SELECT DISTINCT ON (pi.logical_line_id) (${LINE_TOTAL_SQL}) AS lt
                 FROM project_items pi
                 LEFT JOIN items i ON i.id = pi.item_id
                WHERE pi.project_id = p.id AND pi.deleted_at IS NULL
                  -- child components (private buildup) never count (pV2-BUILDUP-02).
                  AND pi.parent_id IS NULL
                  -- scope=cart → only still-in-cart (never-sent) lines.
                  AND ($3 = false OR pi.status IS NULL)
                  -- Declined/cancelled lines drop out of the cost (the Final
                  -- Quote still LISTS them with the red pill; they just don't
                  -- count toward the subtotal / client total). NULL = in cart.
                  -- ONE rule, line-total.util (audit 2026-07-17 B2).
                  AND ${notDeclinedSql()}
                -- pV2-UNIFY-01a (audit M-2): deterministic tiebreak, IDENTICAL
                -- across getEstimate / LIST_SELECT / listItems so the banner
                -- total and the line list can't pick different competing clones.
                ORDER BY pi.logical_line_id,
                         (pi.status IN ('accepted','booked')) DESC NULLS LAST,
                         pi.created_at ASC, pi.id
             ) x) AS quote_subtotal
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
    // Look at the CANONICAL row for this (project, item) — incl. soft-deleted.
    // supplier_org_id IS NULL excludes the per-supplier fan-out clones
    // (pV2-UNIFY-01a). A previously-removed item is REVIVED, not re-inserted;
    // the partial unique index uq_project_items_canonical (audit M-5) also
    // stops a concurrent double-add from inserting two canonicals.
    const existing = await client.query(
      `SELECT id, deleted_at FROM project_items
        WHERE project_id = $1 AND item_id = $2 AND supplier_org_id IS NULL
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
    // pV2-UNIFY-01a: a fresh cart line is its own logical line (one supplier
    // group of one until the send fans it out). Seed logical_line_id = id.
    await client.query(
      `UPDATE project_items SET logical_line_id = id WHERE id = $1 AND logical_line_id IS NULL`,
      [rowId]
    );
    return lineById(client, rowId);
  });
}

/** pV2-CUSTOMS-01 — add a custom (ad-hoc) line: a pure project_items row with
 *  NO catalogue backing (item_id NULL, is_custom = true). All the line's data
 *  lives on the row; the estimate reads it directly (no items join). It rides
 *  along in its category's brief like any line, and shows "Custom" where the
 *  supplier chip would be until a supplier quotes it. Cost is optional (NULL =
 *  TBC, contributes £0 until quoted). Returns the line, or null if not the org's. */
async function addCustomItem(orgId, projectId, body) {
  return withTransaction(async (client) => {
    const owns = await client.query(
      `SELECT 1 FROM projects WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
      [projectId, orgId]
    );
    if (!owns.rows.length) return null;
    const qty = Math.max(1, Math.round(Number(body.quantity) || 1));
    const ins = await client.query(
      `INSERT INTO project_items
         (project_id, item_id, is_custom, category_id, selection_type, source,
          name, description, base_price, unit, quantity,
          installed, install_cost, install_unit, option_of_line_id)
       VALUES ($1, NULL, true, $2, 'selected', 'custom',
          $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [projectId, body.categoryId || null, body.name,
       body.description || null,
       body.cost == null ? null : Number(body.cost),
       body.unit || null, qty,
       body.installed ?? null,
       body.installCost == null ? null : Number(body.installCost),
       body.installUnit || null,
       // pV2-BUILDUP-03 — when this custom line is a picked OPTION, link it to
       // its parent quote line so the Final Quote nests it under that item and
       // the item card lists it. Stays a real, counted, on-PDF line.
       body.optionOfLineId || null]
    );
    const rowId = ins.rows[0].id;
    await client.query(
      `UPDATE project_items SET logical_line_id = id WHERE id = $1 AND logical_line_id IS NULL`,
      [rowId]
    );
    // pV2-BUILDUP-01 (UI1): tag the line to the supplier it was added under
    // (the add-in-context-of-supplier flow). Mirrors the catalogue add's
    // source-supplier tick. Guarded to real supplier orgs; NULL = "to source".
    if (body.supplierOrgId) {
      await client.query(
        `INSERT INTO project_item_suppliers (project_item_id, supplier_org_id)
         SELECT $1, o.id FROM orgs o
          WHERE o.id = $2 AND o.type = 'supplier'
         ON CONFLICT (project_item_id, supplier_org_id) DO NOTHING`,
        [rowId, body.supplierOrgId]
      );
    }
    return lineById(client, rowId);
  });
}

/** pV2-BUILDUP-02 — supplier Customize: add child components under a line the
 *  supplier was ASKED to quote. Authority = the caller owns the parent line's
 *  per-supplier row (supplier_org_id = caller) — the supplier writes under THEIR
 *  OWN row (the UNIFY fan-out), never the agent's canonical row. Children are
 *  private, supplier-scoped project_items with parent_id set; `included` maps to
 *  selection_type (selected = in, liked = pencilled). Cost-only, excluded from
 *  the agent's canonical totals (which count supplier_org_id IS NULL). */
const COMPONENT_SELECT = `SELECT id, name, base_price, unit, quantity, category_id, kind, selection_type, description, image_url
     FROM project_items
    WHERE parent_id = $1 AND supplier_org_id = $2 AND deleted_at IS NULL
    ORDER BY created_at`;

/** pV2-BUILDUP-02 — the child components already on a line (for re-opening the
 *  Customize estimate). Supplier-scoped: only the caller's own children. */
async function listComponents(orgId, projectId, parentLineId) {
  const parent = await pool.query(
    `SELECT pi.name, pi.description, pi.install_description, pi.margin_pct, o.default_margin_pct
       FROM project_items pi
       JOIN orgs o ON o.id = $3
      WHERE pi.id = $1 AND pi.project_id = $2 AND pi.supplier_org_id = $3 AND pi.deleted_at IS NULL`,
    [parentLineId, projectId, orgId]
  );
  if (!parent.rows.length) return null;
  const r = await pool.query(COMPONENT_SELECT, [parentLineId, orgId]);
  const num = (v) => (v == null ? null : Number(v));
  return {
    components: r.rows,
    // The parent line's own name + description + services (the supplier edits
    // these — the final item the agent sees).
    parentName: parent.rows[0].name,
    parentDescription: parent.rows[0].description,
    parentServices: parent.rows[0].install_description,
    // The saved line margin (null = never set → fall back to the org default).
    marginPct: num(parent.rows[0].margin_pct),
    defaultMarginPct: num(parent.rows[0].default_margin_pct),
  };
}

/** pV2-BUILDUP-02 — RECONCILE the child components under a line the supplier was
 *  asked to quote (their own per-supplier row). Each input component with an `id`
 *  updates that child; without an `id` inserts a new one; any existing child not
 *  in the input is soft-deleted. Optionally sets the line's revised price
 *  (price_current) — the supplier's quote derived from the estimate. Children are
 *  private/supplier-scoped, excluded from the agent's canonical totals. */
async function saveComponents(orgId, projectId, parentLineId, components, revisedPrice, marginPct, parentName, parentDescription, parentServices) {
  const list = Array.isArray(components) ? components : [];
  return withTransaction(async (client) => {
    const parent = await client.query(
      `SELECT id FROM project_items
        WHERE id = $1 AND project_id = $2 AND supplier_org_id = $3 AND deleted_at IS NULL`,
      [parentLineId, projectId, orgId]
    );
    if (!parent.rows.length) return null; // not the supplier's line → 404
    const existing = await client.query(
      `SELECT id FROM project_items WHERE parent_id = $1 AND supplier_org_id = $2 AND deleted_at IS NULL`,
      [parentLineId, orgId]
    );
    const keep = new Set(list.filter((c) => c.id).map((c) => c.id));
    for (const row of existing.rows) {
      if (!keep.has(row.id)) {
        await client.query(`UPDATE project_items SET deleted_at = NOW() WHERE id = $1`, [row.id]);
      }
    }
    for (const c of list) {
      const qty = Math.max(1, Math.round(Number(c.quantity) || 1));
      const sel = c.included ? 'selected' : 'liked';
      const cost = c.cost == null ? null : Number(c.cost);
      if (c.id && keep.has(c.id)) {
        await client.query(
          `UPDATE project_items SET name = $2, base_price = $3, unit = $4, quantity = $5,
             category_id = $6, kind = $7, selection_type = $8, description = $10, image_url = $11
            WHERE id = $1 AND supplier_org_id = $9`,
          [c.id, c.name, cost, c.unit || null, qty, c.categoryId || null, c.kind || 'estimate', sel, orgId,
           c.description || null, c.image || null]
        );
      } else {
        const ins = await client.query(
          `INSERT INTO project_items
             (project_id, item_id, is_custom, parent_id, supplier_org_id,
              category_id, selection_type, source, kind, name, base_price, unit, quantity, description, image_url)
           VALUES ($1, NULL, true, $2, $3, $4, $5, 'custom', $6, $7, $8, $9, $10, $11, $12)
           RETURNING id`,
          [projectId, parentLineId, orgId, c.categoryId || null, sel, c.kind || 'estimate',
           c.name, cost, c.unit || null, qty, c.description || null, c.image || null]
        );
        await client.query(
          `UPDATE project_items SET logical_line_id = id WHERE id = $1 AND logical_line_id IS NULL`,
          [ins.rows[0].id]
        );
      }
    }
    // The supplier's estimate-derived quote for the line = the item TOTAL the
    // supplier enters. price_current is the per-UNIT rate (the line total derives
    // via lineTotalSql), so store total / qty. (qty=1 items → total = rate.)
    if (revisedPrice != null && Number.isFinite(Number(revisedPrice))) {
      await client.query(
        `UPDATE project_items
            SET price_current = $2 / GREATEST(COALESCE(quantity, 1), 1)
          WHERE id = $1 AND supplier_org_id = $3`,
        [parentLineId, Number(revisedPrice), orgId]
      );
    }
    // Save the line-level margin on the parent (BUILDUP-02): re-opening the
    // Customize estimate shows the same margin instead of re-deriving it.
    if (marginPct != null && Number.isFinite(Number(marginPct))) {
      await client.query(
        `UPDATE project_items SET margin_pct = $2 WHERE id = $1 AND supplier_org_id = $3`,
        [parentLineId, Number(marginPct), orgId]
      );
    }
    // The supplier's final item name + description for the line (what the agent
    // sees). Only touch a field when the client actually sent it.
    if (typeof parentName === 'string' && parentName.trim()) {
      await client.query(
        `UPDATE project_items SET name = $2 WHERE id = $1 AND supplier_org_id = $3`,
        [parentLineId, parentName.trim(), orgId]
      );
    }
    if (parentDescription !== undefined) {
      await client.query(
        `UPDATE project_items SET description = $2 WHERE id = $1 AND supplier_org_id = $3`,
        [parentLineId, parentDescription || null, orgId]
      );
    }
    if (parentServices !== undefined) {
      await client.query(
        `UPDATE project_items SET install_description = $2 WHERE id = $1 AND supplier_org_id = $3`,
        [parentLineId, parentServices || null, orgId]
      );
    }
    // Clone-up to the library: ensure every named component exists as a reusable
    // `items` row (kind='component') for this org. INSERT-ONLY, deduped by name —
    // the project child is a SNAPSHOT, so editing it here never touches the
    // library copy, and vice-versa (independent, like a marketplace item and the
    // quote line it spawned).
    for (const c of list) {
      const nm = String(c.name || '').trim();
      if (!nm) continue;
      const exists = await client.query(
        `SELECT 1 FROM items WHERE org_id = $1 AND kind = 'component' AND deleted_at IS NULL AND lower(name) = lower($2) LIMIT 1`,
        [orgId, nm]
      );
      if (exists.rows.length) continue;
      await client.query(
        `INSERT INTO items (org_id, category_id, name, description, unit, base_price, kind, image_url, is_active, approval_status)
         VALUES ($1, $2, $3, $4, $5, $6, 'component', $7, true, 'approved')`,
        [orgId, c.categoryId || null, nm, c.description || null, c.unit || null,
         c.cost == null ? null : Number(c.cost), c.image || null]
      );
    }
    const rows = await client.query(COMPONENT_SELECT, [parentLineId, orgId]);
    return rows.rows;
  });
}

/** pV2-BUILDUP-02 — the supplier's reusable component LIBRARY: real `items`
 *  rows of kind='component', owned by the org. Same table as marketplace items,
 *  but kind='component' rows are surfaced ONLY here (Customize Explore) — the
 *  marketplace browse (item.service.getAll) filters them out. Private/org-scoped;
 *  q optional (empty = the whole list). */
async function listMyComponents(orgId, q) {
  const term = `%${String(q || '').replace(/[%_\\]/g, '\\$&')}%`;
  const r = await pool.query(
    `SELECT id, name, base_price, unit, category_id, kind, description, image_url
       FROM items
      WHERE org_id = $1 AND kind = 'component' AND is_active = true AND deleted_at IS NULL
        AND ($2 = '%%' OR name ILIKE $2)
      ORDER BY lower(name)
      LIMIT 100`,
    [orgId, term]
  );
  return r.rows;
}

/** Has this item been sent for a quote on this project? Once sent the quote
 *  row is READ-ONLY — edits happen in the inbox thread, not the quote (Liam
 *  2026-07-08, pV2-CART-01). Send-state is project_items.status now: NULL =
 *  still in cart, anything else = briefed/negotiating (pV2-UNIFY-01). */
async function isItemSent(projectId, lineId) {
  // `lineId` is the project_items ROW id (pV2-CUSTOMS-01: custom lines have no
  // catalogue item_id, so the row id is the only stable key across all lines).
  const r = await pool.query(
    `SELECT 1 FROM project_items
      WHERE project_id = $1 AND id = $2
        AND status IS NOT NULL AND deleted_at IS NULL
      LIMIT 1`,
    [projectId, lineId]
  );
  return r.rows.length > 0;
}

/** pV2-QUANTITY-01 — set the quantity on a live quote line. Returns the
 *  updated line, false if no such live line, null if not the org's, 'locked'
 *  if the item is out for quote (read-only in the quote).
 *  Single write (the ownership SELECT + the UPDATE) — no transaction needed
 *  (Rule 1): the UPDATE re-scopes by project_id, so the ownership check can't
 *  be raced into a cross-org write. */
async function updateItem(orgId, projectId, lineId, patch) {
  // `lineId` is the project_items ROW id (pV2-CUSTOMS-01) — the only key that
  // works for custom lines (no catalogue item_id).
  const owns = await pool.query(
    `SELECT 1 FROM projects WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
    [projectId, orgId]
  );
  if (!owns.rows.length) return null;
  if (await isItemSent(projectId, lineId)) return 'locked';
  const sets = [];
  const vals = [projectId, lineId];
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
      WHERE project_id = $1 AND id = $2 AND deleted_at IS NULL
      RETURNING id`,
    vals
  );
  if (!r.rows.length) return false; // no live line for this id
  return lineById(pool, r.rows[0].id);
}

/** Edit a line's free-text details — name / description / Services
 *  (install_description) — so the supplier can RECORD what they changed on the
 *  line (e.g. "upgraded to Gourmet menu; added fridge"). Unlike updateItem this
 *  is NOT lock-gated: the supplier annotates the line WHILE it's out for quote.
 *  Authority: the caller owns the row — either their own per-supplier fan-out
 *  row (supplier editing the line they were asked to quote) OR the project's
 *  canonical row (the agent). Only provided fields change. Returns the line,
 *  null if not the caller's, false if no live row. */
async function updateLineDetails(orgId, projectId, lineId, patch) {
  const auth = await pool.query(
    `SELECT pi.id
       FROM project_items pi
       JOIN projects p ON p.id = pi.project_id
      WHERE pi.id = $1 AND pi.project_id = $2 AND pi.deleted_at IS NULL
        AND (pi.supplier_org_id = $3 OR (pi.supplier_org_id IS NULL AND p.org_id = $3))`,
    [lineId, projectId, orgId]
  );
  if (!auth.rows.length) return null;
  const sets = [];
  const vals = [lineId];
  if (patch.name !== undefined)        { vals.push(patch.name);        sets.push(`name = $${vals.length}`); }
  if (patch.description !== undefined) { vals.push(patch.description); sets.push(`description = $${vals.length}`); }
  if (patch.services !== undefined)    { vals.push(patch.services);    sets.push(`install_description = $${vals.length}`); }
  if (patch.details !== undefined)     { vals.push(patch.details);     sets.push(`details = $${vals.length}`); }
  if (!sets.length) return false;
  const r = await pool.query(
    `UPDATE project_items SET ${sets.join(', ')} WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
    vals
  );
  if (!r.rows.length) return false;
  return lineById(pool, r.rows[0].id);
}

/** Soft-remove an item from the project's quote. Returns true if a row was
 *  removed, false if none, null if the project isn't the org's, 'locked' if
 *  the item is out for quote (read-only in the quote). */
async function removeItem(orgId, projectId, lineId) {
  // `lineId` is the project_items ROW id (pV2-CUSTOMS-01).
  const owns = await pool.query(
    `SELECT 1 FROM projects WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
    [projectId, orgId]
  );
  if (!owns.rows.length) return null;
  if (await isItemSent(projectId, lineId)) return 'locked';
  const r = await pool.query(
    `UPDATE project_items SET deleted_at = NOW()
      WHERE project_id = $1 AND id = $2 AND deleted_at IS NULL
      RETURNING id`,
    [projectId, lineId]
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
  listForOrg, listClientNames, getDetail, updateDetail, create,
  listItems, getEstimate, addItem, addCustomItem, saveComponents, listComponents, listMyComponents, removeItem, updateItem, updateLineDetails, recommend,
  resolveStatus, DEFAULT_STATUS, toCard, linesByIds,
};
