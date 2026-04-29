// Seed shared.feedback with feature specifications using the agreed
// object/actions format.
//
//   SHIPPED  — already-built features. status='done', version + shipped_date
//              + area populated; tags=['feature-spec', `v1.x`].
//   SPECS    — v2.0/v2.1 to-do features. status='open'; tags=['feature-spec','v2.0'].
//
// Both arrays insert as Prompt entries (object_type='issue', type='prompt')
// with submitted_by='Liam', environment='dev'. Resolves the Prompt category
// from shared.feedback_categories (requires migrate-schemas.js to have run).
//
// Idempotent — keyed on title:
//   - if a row with the same title exists → UPDATE the version / shipped_date
//     / area / status / tags / feedback_category_id columns (notes preserved
//     unless empty);
//   - else INSERT a new row.
//
// Usage: node server/src/db/seed-feature-specs.js

const { Pool } = require('pg');
require('dotenv').config({ path: 'C:/projects/ballpark/.env' });

const SUBMITTED_BY = 'Liam';
const ENVIRONMENT = 'dev';
const OBJECT_TYPE = 'issue';
const TYPE = 'prompt';

// ── SHIPPED — already-built features (status='done') ─────────────────────
const SHIPPED = [
  {
    title: 'Foundation — Angular + Node.js + Supabase Stack',
    area: 'technical',
    version: 'v1.0',
    shipped_date: '2026-03-17',
    notes:
`OBJECT: Platform Infrastructure
ATTRIBUTES: Angular 17, Node.js/Express, Supabase PostgreSQL,
            Railway (backend), Vercel (frontend), GitHub repo
ACTIONS: n/a — infrastructure
SPECIAL: Multi-schema DB (public/preview/master/shared),
         CORS, environment configs, branch strategy`
  },
  {
    title: 'Design System — Theme, CSS Variables, Dark Mode',
    area: 'design',
    version: 'v1.1',
    shipped_date: '2026-03-19',
    notes:
`OBJECT: Design System
ATTRIBUTES: Option D layout, 5 theme presets, CSS variables,
            dark/light mode, Playfair Display + Libre Franklin,
            PrimeNG + Tailwind + CSS vars three-layer rule
ACTIONS: n/a — platform-wide
SPECIAL: LucideAngularModule.pick() standard,
         app-status-badge, GbpPipe, bp-field-label,
         hardcoded hex → CSS variables`
  },
  {
    title: 'AppShell — Hero Banner + Shell Context',
    area: 'design',
    version: 'v1.3',
    shipped_date: '2026-03-22',
    notes:
`OBJECT: App Shell
ATTRIBUTES: hero title, hero subtitle, pills, tabs,
            nav mode (tabs/sidenav), hero alignment
ACTIONS: n/a — layout component
SPECIAL: AppShellComponent, ShellContextService,
         context-sensitive hero per route`
  },
  {
    title: 'Settings — Organisation Tab',
    area: 'settings',
    version: 'v1.3',
    shipped_date: '2026-03-22',
    notes:
`OBJECT: Organisation Settings
ATTRIBUTES: name, city, email, phone, logo, cover_image
ACTIONS: view, edit
copy: n/a
move: n/a
SPECIAL: always-visible pencil, check/times edit pattern,
         readonly/edit toggle, zero layout shift,
         parchment inputs on edit`
  },
  {
    title: 'Settings — Team Tab',
    area: 'settings',
    version: 'v1.3',
    shipped_date: '2026-03-22',
    notes:
`OBJECT: Team Member (Settings)
ATTRIBUTES: name, email, role, avatar, joined_at
ACTIONS: view, add (invite), edit (role), delete
copy: n/a
move: n/a
SPECIAL: invite codes (single/multi use),
         p-dataView list/card toggle,
         filter sidebar, sort, search,
         row click opens view drawer`
  },
  {
    title: 'Settings — Marketplace (Appearance) Tab',
    area: 'settings',
    version: 'v1.3',
    shipped_date: '2026-03-22',
    notes:
`OBJECT: Marketplace Settings
ATTRIBUTES: platform name, terminology, theme,
            font pairing, logo, hero controls
ACTIONS: view, edit
SPECIAL: live preview dialog, catalogue label config,
         font pairing selector, theme colour picker`
  },
  {
    title: 'Settings — Categories Tab',
    area: 'categories',
    version: 'v1.7',
    shipped_date: '2026-04-13',
    notes:
`OBJECT: Category (Admin)
ATTRIBUTES: name, namespace, level, parent_id, org_id,
            tagline, description, tags, cover_image_url,
            icon_name, icon_color, card_color, enabled
ACTIONS: add, edit, delete (disable), reorder
copy: n/a
move: yes (change parent)
SPECIAL: namespace circles (Catalogue/Feedback),
         hierarchy (parent/child), CatalogueGridComponent,
         image upload (Upload/Search/Icon tabs),
         feedback category seed`
  },
  {
    title: 'Settings — Subscription Tab',
    area: 'settings',
    version: 'v1.3',
    shipped_date: '2026-03-22',
    notes:
`OBJECT: Subscription
ATTRIBUTES: plan, ball_allowance, renewal_date, balance
ACTIONS: view
SPECIAL: plan card display, Ball balance,
         upgrade/downgrade (pending Stripe integration)`
  },
  {
    title: 'Settings — Ballpark Admin (Orgs + Marketplace)',
    area: 'settings',
    version: 'v1.9',
    shipped_date: '2026-04-27',
    notes:
`OBJECT: Platform Admin
ATTRIBUTES: all orgs, categories, marketplace settings,
            early access / guestlist
ACTIONS: view, add, edit orgs; manage categories;
         manage early access signups
SPECIAL: ballpark-settings shell, Orgs tab with
         CatalogueGridComponent, Categories/Marketplace/Orgs/
         Feedback tabs, early access admin page`
  },
  {
    title: 'Dashboard — Project Cards + Supplier Panel',
    area: 'dashboard',
    version: 'v1.4',
    shipped_date: '2026-03-23',
    notes:
`OBJECT: Dashboard
ATTRIBUTES: active projects, completed projects,
            suppliers panel, Ball balance, stats
ACTIONS: view, navigate to project, open image upload
copy: n/a
move: n/a
SPECIAL: 3-column layout, project cards with venue photo
         + client logo overlay + status badge,
         supplier cards with portfolio images,
         dark mode compliant`
  },
  {
    title: 'Mobile — Bottom Navigation',
    area: 'mobile',
    version: 'v1.4',
    shipped_date: '2026-03-23',
    notes:
`OBJECT: Mobile Navigation
ATTRIBUTES: Home, Suppliers, Favourites, Messages,
            Project context nav (Home/Project/Suppliers/
            Favourites/Messages)
ACTIONS: n/a — navigation
SPECIAL: context-sensitive — switches on project entry,
         FAB button, dark mode compliant`
  },
  {
    title: 'Supplier — Browse + Detail + Quote Drawer',
    area: 'suppliers',
    version: 'v1.6',
    shipped_date: '2026-04-09',
    notes:
`OBJECT: Supplier
ATTRIBUTES: name, city, cover_image_url, logo_url,
            image_display, description, categories
ACTIONS: view (list + detail), favourite
copy: n/a
move: n/a
SPECIAL: category filter sidebar, search, list/grid toggle,
         supplier detail with catalogue items,
         quote request drawer, two-slot cover/logo upload,
         three-treatment image rendering (cover/logo/initials),
         CatalogueGridComponent reuse`
  },
  {
    title: 'Favourites — Suppliers + Items',
    area: 'suppliers',
    version: 'v1.4',
    shipped_date: '2026-03-23',
    notes:
`OBJECT: Favourite
ATTRIBUTES: org_id, entity_type (supplier/item), entity_id
ACTIONS: add (heart), remove (heart toggle)
copy: n/a
move: n/a
SPECIAL: dedicated Favourites page with Suppliers/Items
         sub-tabs, hearts on all cards/rows,
         backend favourites table + routes`
  },
  {
    title: 'Messages — Inbox + Thread View',
    area: 'projects',
    version: 'v1.4',
    shipped_date: '2026-03-23',
    notes:
`OBJECT: Message
ATTRIBUTES: project_ref, supplier_ref, category,
            status (action/waiting/quoted/booked),
            thread items, quote cards
ACTIONS: view, send (quote accept)
copy: n/a
move: n/a
SPECIAL: vendor-grouped inbox, category icons,
         status colour coding, thread view,
         quote item cards with Accept button,
         unified component (project tab + global inbox)`
  },
  {
    title: 'Project — Detail Shell + Brief Tab + Build Tab',
    area: 'projects',
    version: 'v1.4',
    shipped_date: '2026-03-23',
    notes:
`OBJECT: Project (partial)
ATTRIBUTES: name, client, event_date, brief, status,
            categories, estimate summary
ACTIONS: view, edit (brief)
copy: n/a
move: n/a
SPECIAL: Brief/Build/Estimate/Messages tabs,
         Build tab: category brief + vendor selection
         + quote request flow,
         estimate summary with budget indicator,
         project context retained across nav`
  },
  {
    title: 'Catalogue — Browse + Items + CatalogueGridComponent',
    area: 'catalogue',
    version: 'v1.7',
    shipped_date: '2026-04-13',
    notes:
`OBJECT: Catalogue
ATTRIBUTES: categories, items, suppliers, tags,
            search, filters, view mode
ACTIONS: view, filter, search, favourite, edit image
copy: n/a
move: n/a
SPECIAL: CatalogueGridComponent reused across catalogue/
         supplier shop/org settings,
         category circles with images + scroll arrows,
         two-layer hierarchy (parent + child circles),
         tagline + description header panel,
         Suppliers/Items toggle,
         three-treatment image rendering,
         FORMAT + TYPE checkbox sidebar,
         item detail right panel,
         edit pencil on circles + cards`
  },
  {
    title: 'Image Upload — Tabbed Dialog (Upload/Search/Icon)',
    area: 'design',
    version: 'v1.8',
    shipped_date: '2026-04-14',
    notes:
`OBJECT: Image Upload Panel
ATTRIBUTES: cover_image_url, logo_url, icon_name,
            icon_color, card_color, image_display
ACTIONS: upload, search (Unsplash), pick icon (Lucide),
         pick colour
copy: n/a
move: n/a
SPECIAL: Upload tab (drag/drop + cover/logo toggle),
         Search tab (Unsplash, auto-populated with entity name),
         Icon tab (full Lucide search by keyword + colour picker),
         works for all entity types (supplier/item/category/org),
         single upload with cover/logo toggle`
  },
  {
    title: 'Feedback — Capture + Grid + Issue/Folder/Note',
    area: 'feedback',
    version: 'v1.7',
    shipped_date: '2026-04-13',
    notes:
`OBJECT: Feedback / Issue
ATTRIBUTES: title, notes, type, object_type,
            feedback_category_id, owner, status,
            tags, page_url, submitted_by, due_date,
            parent_id, event_date, agenda
ACTIONS: add, edit, delete, assign owner, change status
copy: n/a
move: yes (reassign to folder)
SPECIAL: floating capture button (all pages),
         right-click quick menu (Bug/Note/Question),
         dialog flows (Bug/Meeting Note/Action Item),
         Issue/Folder/Note object model,
         filter circles, bulk actions,
         status (open/in_progress/done/wont_fix),
         tags, page + logged-by display`
  },
  {
    title: 'Meeting Notes — /meeting/:id Page',
    area: 'feedback',
    version: 'v1.7',
    shipped_date: '2026-04-13',
    notes:
`OBJECT: Folder (Meeting/Sprint/Test Run)
ATTRIBUTES: title, type, event_date, agenda[],
            notes, action items, bugs, enhancements
ACTIONS: add, edit, delete (cascade children)
copy: n/a
move: n/a
SPECIAL: two-column layout (agenda+notes left,
         actions+bugs+enhancements right),
         inline add per section,
         owner initials selector (LW/BP/MG/JC),
         agenda reorder with up/down arrows,
         edit dialog on click,
         autosave notes (debounce 1000ms),
         opens in new tab from nav,
         always creates fresh meeting on nav click`
  },
  {
    title: 'Welcome Page + Guestlist Signup',
    area: 'marketing',
    version: 'v1.9',
    shipped_date: '2026-04-27',
    notes:
`OBJECT: Welcome / Marketing Page
ATTRIBUTES: 3-slide layout, email signup,
            guestlist entries
ACTIONS: view (public), signup (email),
         admin: view signups, export
copy: n/a
move: n/a
SPECIAL: public /welcome route (no auth),
         Inter font (not Playfair — public page),
         SVG circle blur design,
         v1.9 brand palette,
         Resend email integration,
         admin early access page at
         /ballpark-settings/early-access`
  },
  {
    title: 'Technical — Storage, Health, Keep-Alive, Seed Guards',
    area: 'technical',
    version: 'v1.8',
    shipped_date: '2026-04-15',
    notes:
`OBJECT: Platform Technical
ATTRIBUTES: Supabase storage buckets, health endpoint,
            keep-alive heartbeat, seed guards,
            log-commit script
ACTIONS: n/a — infrastructure
SPECIAL: auto-create storage buckets on startup,
         /api/health endpoint,
         Supabase keep-alive (prevent free-tier pause),
         seed-preview refusal guard,
         unorphan recovery script,
         log-commit.js → internal.project_log`
  }
];

// ── SPECS — v2.0 / v2.1 to-do (status='open') ────────────────────────────
const SPECS = [
  // ── AUTH ──
  {
    title: 'User — Authentication',
    area: 'auth',
    version: 'v2.0',
    notes:
`OBJECT: User
ATTRIBUTES: name, email, avatar, tenant, role, status, last_login
ACTIONS: add (register), edit (profile), delete (deactivate)
SPECIAL: Google SSO login, invite by email, invite by code,
         impersonate (platform admin only)`
  },
  {
    title: 'Session — Auth Session',
    area: 'auth',
    version: 'v2.0',
    notes:
`OBJECT: Session
ATTRIBUTES: user_ref, token, expires_at, device
ACTIONS: create (login), delete (logout)
SPECIAL: SSO callback, token refresh`
  },

  // ── ORGANISATION ──
  {
    title: 'Organisation — Tenant Management',
    area: 'settings',
    version: 'v2.0',
    notes:
`OBJECT: Organisation
ATTRIBUTES: name, type (agency/supplier), plan, ball_balance,
            city, email, phone, logo_url, cover_image_url
ACTIONS: add, edit, delete (deactivate)
copy: n/a
move: n/a
SPECIAL: transfer ownership, impersonate (platform admin only),
         change plan, top up Ball balance`
  },

  // ── TEAM ──
  {
    title: 'Team Member — User Management',
    area: 'settings',
    version: 'v2.0',
    notes:
`OBJECT: Team Member
ATTRIBUTES: user_ref, name, email, role (owner/admin/member),
            status (active/invited/suspended), joined_at, avatar
ACTIONS: add (invite), edit (role/name), delete (remove from org)
copy: n/a
move: n/a
SPECIAL: invite by email, invite by code, resend invite,
         change role, filter by role/status`
  },

  // ── PROJECTS ──
  {
    title: 'Project — Project Management',
    area: 'projects',
    version: 'v2.0',
    notes:
`OBJECT: Project
ATTRIBUTES: name, client, event_date, location, guest_count,
            status, brief, cover_image_url, client_logo_url,
            ball_balance, total_cost, margin, vat, contingency
ACTIONS: add, edit, delete (soft), clone
copy: yes (clone)
move: n/a
SPECIAL: AI brief parse, archive, export PDF`
  },

  // ── ESTIMATE ──
  {
    title: 'Estimate — Project Costing',
    area: 'projects',
    version: 'v2.0',
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
         send lead (spend Ball), export to PDF`
  },
  {
    title: 'Estimate Item — Line Item',
    area: 'projects',
    version: 'v2.0',
    notes:
`OBJECT: Estimate Item
ATTRIBUTES: name, category_ref, supplier_ref, scope,
            requirements, ballpark_cost, final_cost,
            quantity, unit, status
ACTIONS: add, edit, delete, copy (duplicate line)
move: yes (between categories)
SPECIAL: link to catalogue item, link to quote`
  },

  // ── BALLS ──
  {
    title: 'Ball — Lead Credit',
    area: 'balls',
    version: 'v2.0',
    notes:
`OBJECT: Ball Transaction
ATTRIBUTES: org_ref, amount, type (spend/topup/allowance),
            project_ref, item_ref, created_at, description
ACTIONS: view only
copy: n/a
move: n/a
SPECIAL: top up balance (Stripe), monthly allowance reset,
         balance visible in nav`
  },
  {
    title: 'Lead — Send Lead Flow',
    area: 'balls',
    version: 'v2.0',
    notes:
`OBJECT: Lead (Send)
ATTRIBUTES: project_ref, category_ref, items[], suppliers[],
            brief, ballpark_cost, status, sent_at
ACTIONS: add (send), view
copy: n/a
move: n/a
SPECIAL: pre-send gate (date/guests/one-liner),
         Ball deducted on confirm, email notification to supplier`
  },

  // ── SUPPLIER PRODUCT ──
  {
    title: 'Lead Inbox — Supplier Lead Management',
    area: 'suppliers',
    version: 'v2.0',
    notes:
`OBJECT: Lead (Receive)
ATTRIBUTES: project_ref, agency_ref, category, items[],
            brief, ballpark_cost, status, received_at
ACTIONS: view, delete
copy: n/a
move: n/a
SPECIAL: unlock (pay lead fee via Stripe),
         accept, decline, email notification on receipt`
  },
  {
    title: 'Quote — Supplier Quote Submission',
    area: 'suppliers',
    version: 'v2.0',
    notes:
`OBJECT: Quote
ATTRIBUTES: lead_ref, supplier_ref, line_items[], total,
            notes, expiry_date, status
ACTIONS: add, edit, delete
copy: n/a
move: n/a
SPECIAL: submit to agency, accept (agency), decline (agency),
         quote comparison view (side-by-side with ballpark ref)`
  },
  {
    title: 'Catalogue Item — Supplier Catalogue Management',
    area: 'suppliers',
    version: 'v2.0',
    notes:
`OBJECT: Catalogue Item (Supplier self-manage)
ATTRIBUTES: name, category_ref, description, unit,
            base_price, min_price, max_price, tier,
            tags, cover_image_url, lead_time_days, is_active
ACTIONS: add, edit, delete (soft), copy
move: n/a
SPECIAL: publish/unpublish, bulk import via XLS,
         AI taxonomy suggestion on description entry`
  },

  // ── PAYMENTS ──
  {
    title: 'Subscription — Plan Management',
    area: 'settings',
    version: 'v2.0',
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
         invoice history`
  },
  {
    title: 'Payment — Stripe Integration',
    area: 'payments',
    version: 'v2.0',
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
         payment admin screen (Ballpark DB + Stripe API joined)`
  },

  // ── NOTIFICATIONS ──
  {
    title: 'Notification — In-App + Email',
    area: 'notifications',
    version: 'v2.1',
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
         real-time via polling or Supabase realtime`
  },

  // ── MOBILE ──
  {
    title: 'Mobile — Responsive Layout',
    area: 'mobile',
    version: 'v2.0',
    notes:
`OBJECT: Mobile Experience
ATTRIBUTES: all pages, touch interactions
ACTIONS: n/a — cross-cutting concern
SPECIAL: all pages responsive at 375px+,
         bottom nav on mobile (already partially built),
         touch-friendly card interactions,
         mobile catalogue browse,
         mobile project/estimate view`
  },

  // ── TECHNICAL ──
  {
    title: 'Image Sanitisation — AI Background Removal',
    area: 'catalogue',
    version: 'v2.1',
    notes:
`OBJECT: Item Image
ATTRIBUTES: original_url, sanitised_url, brand_removed,
            halo_colour, review_status
ACTIONS: upload, sanitise, review, approve, reject
SPECIAL: AI pipeline: rembg (BiRefNet) + EasyOCR + inpaint,
         supplier review step for residuals,
         halo style picker (cream/pink/green),
         catalogue shows sanitised, shop front shows original`
  },
  {
    title: 'Google SSO — Authentication',
    area: 'auth',
    version: 'v2.0',
    notes:
`OBJECT: Auth Provider
ATTRIBUTES: google_id, email, name, avatar_url,
            access_token, refresh_token
ACTIONS: n/a — infrastructure
SPECIAL: OAuth 2.0 via Google,
         enrollment flow on first login (create/join org),
         org type selection (agency/supplier),
         plan selection for agencies`
  },
  {
    title: 'Item Categories — Junction Table',
    area: 'technical',
    version: 'v2.1',
    notes:
`OBJECT: Item ↔ Category Relationship
ATTRIBUTES: item_id, category_id, is_primary
ACTIONS: add, remove
SPECIAL: replaces items.tags[] for event type filtering,
         allows one item in multiple categories,
         migration: items.category_id → junction table,
         migration: items.tags[] → matching category ids`
  }
];

function tagsFor(version) {
  // Use minor-version tag for shipped (v1.x) or v2.0 for to-do specs.
  return ['feature-spec', version.startsWith('v2') ? 'v2.0' : version];
}

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Resolve Prompt category id from shared.feedback_categories
    const cat = await pool.query(
      `SELECT id FROM shared.feedback_categories
        WHERE name = 'Prompt' AND object_type = 'issue'
        LIMIT 1`
    );
    if (!cat.rowCount) {
      throw new Error(
        `Prompt category not found in shared.feedback_categories. ` +
        `Run server/src/db/migrate-schemas.js first to create + seed the table.`
      );
    }
    const promptCategoryId = cat.rows[0].id;
    console.log(`Prompt category: ${promptCategoryId}`);

    let inserted = 0;
    let updated = 0;

    const upsert = async (entry, status) => {
      const tags = tagsFor(entry.version);
      const existing = await pool.query(
        `SELECT id FROM shared.feedback WHERE title = $1 LIMIT 1`,
        [entry.title]
      );
      if (existing.rowCount) {
        // Update the new columns + status/tags/category, preserve original
        // notes only if non-empty (allow refreshing the body too).
        await pool.query(
          `UPDATE shared.feedback
              SET feedback_category_id = $1,
                  notes                = $2,
                  status               = $3,
                  tags                 = $4,
                  version              = $5,
                  shipped_date         = $6,
                  area                 = $7
            WHERE id = $8`,
          [promptCategoryId, entry.notes, status, tags, entry.version,
           entry.shipped_date || null, entry.area, existing.rows[0].id]
        );
        console.log(`updated:  ${entry.title}`);
        updated++;
      } else {
        await pool.query(
          `INSERT INTO shared.feedback
             (feedback_category_id, title, notes, submitted_by,
              environment, object_type, type, status, tags,
              version, shipped_date, area)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            promptCategoryId, entry.title, entry.notes, SUBMITTED_BY,
            ENVIRONMENT, OBJECT_TYPE, TYPE, status, tags,
            entry.version, entry.shipped_date || null, entry.area
          ]
        );
        console.log(`inserted: ${entry.title}`);
        inserted++;
      }
    };

    for (const entry of SHIPPED) await upsert(entry, 'done');
    for (const entry of SPECS)   await upsert(entry, 'open');

    const total = SHIPPED.length + SPECS.length;
    console.log(`\nDone. inserted=${inserted}, updated=${updated}, total=${total}`);
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
