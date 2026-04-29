// One-off: seed shared.feedback with v2.0 feature specifications using the
// agreed object/actions format. Inserts as Prompt entries (object_type='issue',
// type='prompt'), tagged feature-spec + v2.0, submitted_by='Liam',
// environment='dev'.
//
// Idempotent: skips any row whose title already exists in shared.feedback.
// Adds shared.feedback.tags TEXT[] (TEXT[] DEFAULT '{}') if missing — there is
// no tags column on the table yet and the user spec calls for one.
//
// Usage: node server/src/db/seed-feature-specs.js

const { Pool } = require('pg');
require('dotenv').config({ path: 'C:/projects/ballpark/.env' });

const TAGS = ['feature-spec', 'v2.0'];
const SUBMITTED_BY = 'Liam';
const ENVIRONMENT = 'dev';
const STATUS = 'open';
const OBJECT_TYPE = 'issue';
const TYPE = 'prompt';

const SPECS = [
  // ── AUTH ──────────────────────────────────────────────────────────────
  {
    title: 'User — Authentication',
    notes:
`OBJECT: User
ATTRIBUTES: name, email, avatar, tenant, role, status, last_login
ACTIONS: add (register), edit (profile), delete (deactivate)
SPECIAL: Google SSO login, invite by email, invite by code,
         impersonate (platform admin only)
VERSION: v2.0`
  },
  {
    title: 'Session — Auth Session',
    notes:
`OBJECT: Session
ATTRIBUTES: user_ref, token, expires_at, device
ACTIONS: create (login), delete (logout)
SPECIAL: SSO callback, token refresh
VERSION: v2.0`
  },

  // ── ORGANISATION ──────────────────────────────────────────────────────
  {
    title: 'Organisation — Tenant Management',
    notes:
`OBJECT: Organisation
ATTRIBUTES: name, type (agency/supplier), plan, ball_balance,
            city, email, phone, logo_url, cover_image_url
ACTIONS: add, edit, delete (deactivate)
copy: n/a
move: n/a
SPECIAL: transfer ownership, impersonate (platform admin only),
         change plan, top up Ball balance
VERSION: v2.0`
  },

  // ── TEAM ──────────────────────────────────────────────────────────────
  {
    title: 'Team Member — User Management',
    notes:
`OBJECT: Team Member
ATTRIBUTES: user_ref, name, email, role (owner/admin/member),
            status (active/invited/suspended), joined_at, avatar
ACTIONS: add (invite), edit (role/name), delete (remove from org)
copy: n/a
move: n/a
SPECIAL: invite by email, invite by code, resend invite,
         change role, filter by role/status
VERSION: v2.0`
  },

  // ── PROJECTS ──────────────────────────────────────────────────────────
  {
    title: 'Project — Project Management',
    notes:
`OBJECT: Project
ATTRIBUTES: name, client, event_date, location, guest_count,
            status, brief, cover_image_url, client_logo_url,
            ball_balance, total_cost, margin, vat, contingency
ACTIONS: add, edit, delete (soft), clone
copy: yes (clone)
move: n/a
SPECIAL: AI brief parse, archive, export PDF
VERSION: v2.0`
  },

  // ── ESTIMATE ──────────────────────────────────────────────────────────
  {
    title: 'Estimate — Project Costing',
    notes:
`OBJECT: Estimate
ATTRIBUTES: project_ref, categories, line_items, subtotal,
            margin_pct, vat_pct, contingency_pct, total,
            client_total, status
ACTIONS: view, edit
copy: n/a
move: n/a
SPECIAL: add item from catalogue, add custom item,
         toggle scope (In Scope/Client Handles/TBC),
         send lead (spend Ball), export to PDF
VERSION: v2.0`
  },
  {
    title: 'Estimate Item — Line Item',
    notes:
`OBJECT: Estimate Item
ATTRIBUTES: name, category_ref, supplier_ref, scope,
            requirements, ballpark_cost, final_cost,
            quantity, unit, status
ACTIONS: add, edit, delete, copy (duplicate line)
move: yes (between categories)
SPECIAL: link to catalogue item, link to quote
VERSION: v2.0`
  },

  // ── BALLS ─────────────────────────────────────────────────────────────
  {
    title: 'Ball — Lead Credit',
    notes:
`OBJECT: Ball Transaction
ATTRIBUTES: org_ref, amount, type (spend/topup/allowance),
            project_ref, item_ref, created_at, description
ACTIONS: view only
copy: n/a
move: n/a
SPECIAL: top up balance (Stripe), monthly allowance reset,
         balance visible in nav
VERSION: v2.0`
  },
  {
    title: 'Lead — Send Lead Flow',
    notes:
`OBJECT: Lead (Send)
ATTRIBUTES: project_ref, category_ref, items[], suppliers[],
            brief, ballpark_cost, status, sent_at
ACTIONS: add (send), view
copy: n/a
move: n/a
SPECIAL: pre-send gate (date/guests/one-liner),
         Ball deducted on confirm, email notification to supplier
VERSION: v2.0`
  },

  // ── SUPPLIER PRODUCT ──────────────────────────────────────────────────
  {
    title: 'Lead Inbox — Supplier Lead Management',
    notes:
`OBJECT: Lead (Receive)
ATTRIBUTES: project_ref, agency_ref, category, items[],
            brief, ballpark_cost, status, received_at
ACTIONS: view, delete
copy: n/a
move: n/a
SPECIAL: unlock (pay lead fee via Stripe),
         accept, decline, email notification on receipt
VERSION: v2.0`
  },
  {
    title: 'Quote — Supplier Quote Submission',
    notes:
`OBJECT: Quote
ATTRIBUTES: lead_ref, supplier_ref, line_items[], total,
            notes, expiry_date, status
ACTIONS: add, edit, delete
copy: n/a
move: n/a
SPECIAL: submit to agency, accept (agency), decline (agency),
         quote comparison view (side-by-side with ballpark ref)
VERSION: v2.0`
  },
  {
    title: 'Catalogue Item — Supplier Catalogue Management',
    notes:
`OBJECT: Catalogue Item (Supplier self-manage)
ATTRIBUTES: name, category_ref, description, unit,
            base_price, min_price, max_price, tier,
            tags, cover_image_url, lead_time_days, is_active
ACTIONS: add, edit, delete (soft), copy
move: n/a
SPECIAL: publish/unpublish, bulk import via XLS,
         AI taxonomy suggestion on description entry
VERSION: v2.0`
  },

  // ── PAYMENTS ──────────────────────────────────────────────────────────
  {
    title: 'Subscription — Plan Management',
    notes:
`OBJECT: Subscription
ATTRIBUTES: org_ref, plan (free/pro/enterprise),
            ball_allowance, renewal_date,
            stripe_customer_id, stripe_subscription_id
ACTIONS: view, edit
copy: n/a
move: n/a
SPECIAL: upgrade, downgrade, cancel,
         Stripe Checkout for payment method,
         invoice history
VERSION: v2.0`
  },
  {
    title: 'Payment — Stripe Integration',
    notes:
`OBJECT: Payment
ATTRIBUTES: org_ref, amount, currency, type
            (subscription/lead_fee/topup), stripe_payment_id,
            status, created_at
ACTIONS: view only
copy: n/a
move: n/a
SPECIAL: Stripe Connect — agency subscriptions,
         Stripe Connect — supplier lead fee unlocks,
         Destination Charges for commission splits,
         org wallet balance display in account settings,
         payment admin screen (Ballpark DB + Stripe API joined)
VERSION: v2.0`
  },

  // ── NOTIFICATIONS ─────────────────────────────────────────────────────
  {
    title: 'Notification — In-App + Email',
    notes:
`OBJECT: Notification
ATTRIBUTES: user_ref, type, title, message,
            action_url, read_at, created_at
ACTIONS: view, delete
mark read: yes (single + bulk)
SPECIAL: email via Resend for:
           lead sent (agency), lead received (supplier),
           quote submitted (agency), quote accepted (supplier)
         in-app bell with unread count badge in nav
         real-time via polling or Supabase realtime
VERSION: v2.1`
  },

  // ── MOBILE ────────────────────────────────────────────────────────────
  {
    title: 'Mobile — Responsive Layout',
    notes:
`OBJECT: Mobile Experience
ATTRIBUTES: all pages, touch interactions
ACTIONS: n/a — cross-cutting concern
SPECIAL: all pages responsive at 375px+,
         bottom nav on mobile (already partially built),
         touch-friendly card interactions,
         mobile catalogue browse,
         mobile project/estimate view
VERSION: v2.0`
  },

  // ── TECHNICAL ─────────────────────────────────────────────────────────
  {
    title: 'Image Sanitisation — AI Background Removal',
    notes:
`OBJECT: Item Image
ATTRIBUTES: original_url, sanitised_url, brand_removed,
            halo_colour, review_status
ACTIONS: upload, sanitise, review, approve, reject
SPECIAL: AI pipeline: rembg (BiRefNet) + EasyOCR + inpaint,
         supplier review step for residuals,
         halo style picker (cream/pink/green),
         catalogue shows sanitised, shop front shows original
VERSION: v2.1`
  },
  {
    title: 'Google SSO — Authentication',
    notes:
`OBJECT: Auth Provider
ATTRIBUTES: google_id, email, name, avatar_url,
            access_token, refresh_token
ACTIONS: n/a — infrastructure
SPECIAL: OAuth 2.0 via Google,
         enrollment flow on first login (create/join org),
         org type selection (agency/supplier),
         plan selection for agencies
VERSION: v2.0`
  },
  {
    title: 'Item Categories — Junction Table',
    notes:
`OBJECT: Item ↔ Category Relationship
ATTRIBUTES: item_id, category_id, is_primary
ACTIONS: add, remove
SPECIAL: replaces items.tags[] for event type filtering,
         allows one item in multiple categories,
         migration: items.category_id → junction table,
         migration: items.tags[] → matching category ids
VERSION: v2.1`
  }
];

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // 1. Ensure tags column exists on shared.feedback
    await pool.query(
      `ALTER TABLE shared.feedback ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'`
    );

    // 2. Resolve Prompt category id (namespace=feedback) from the dev schema
    //    (public.categories — feedback categories are seeded here by migrate.js)
    const cat = await pool.query(
      `SELECT id FROM public.categories
        WHERE namespace = 'feedback' AND name = 'Prompt' AND parent_id IS NULL
        LIMIT 1`
    );
    if (!cat.rowCount) {
      throw new Error(
        `Prompt category not found in public.categories (namespace='feedback'). ` +
        `Run server/src/db/migrate.js first to seed feedback categories.`
      );
    }
    const promptCategoryId = cat.rows[0].id;
    console.log(`Prompt category: ${promptCategoryId}`);

    // 3. Insert specs (skip duplicates by title)
    let inserted = 0;
    let skipped = 0;
    for (const spec of SPECS) {
      const exists = await pool.query(
        `SELECT id FROM shared.feedback WHERE title = $1 LIMIT 1`,
        [spec.title]
      );
      if (exists.rowCount) {
        console.log(`skipped (already exists): ${spec.title}`);
        skipped++;
        continue;
      }
      await pool.query(
        `INSERT INTO shared.feedback
           (category_id, title, notes, submitted_by, environment,
            object_type, type, status, tags)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          promptCategoryId,
          spec.title,
          spec.notes,
          SUBMITTED_BY,
          ENVIRONMENT,
          OBJECT_TYPE,
          TYPE,
          STATUS,
          TAGS
        ]
      );
      console.log(`inserted: ${spec.title}`);
      inserted++;
    }

    console.log(`\nDone. inserted=${inserted}, skipped=${skipped}, total=${SPECS.length}`);
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
