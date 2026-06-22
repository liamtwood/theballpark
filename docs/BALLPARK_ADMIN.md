# Ballpark Settings (`/ballpark-settings/*`) — internal admin umbrella

One-pager. Umbrella for the Ballpark-team-only admin section. Home page
at `/ballpark-settings/` lists 5 entries spanning personal settings,
data management (signups + orgs + users), and system configuration.
Distinct from per-org settings at `/settings/*` — which any org admin
can access — these are gated to Ballpark team members only.

Pairs with: `WELCOME.md` (this admin manages welcome's content + signup
funnel), `SECURITY.md` (auth pattern §11 — `ballpark_admin` as distinct
role; interim secret → JWT at AUTH-01), `CODELISTS.md` (codelists admin
UI mounts under this hierarchy), `PAGE_SETTINGS.md` (page settings UI
moves here as part of this ship), `AUDIT_LEDGER.md`
(TECH-DEBT-01 — interim ADMIN_API_SECRET auth pattern).

## What it is

A Ballpark-team-only admin section grouped under one URL hierarchy.

**URL convention: `/ballpark-settings/*`** (matches v1).

**Home page lists 5 entries:**

| # | Entry | URL | State this ship |
|---|---|---|---|
| 1 | **Profile** | cross-link → `/settings/profile` | Existing (cross-link convenience) |
| 2 | **Early Access** | `/ballpark-settings/early-access` | **BUILT** — port from v1 + new user-confirmation email + feature flags |
| 3 | **Orgs** | `/ballpark-settings/orgs` | Coming-soon stub (v1 port deferred to future) |
| 4 | **All Users** | `/ballpark-settings/users` | Coming-soon stub (future) |
| 5 | **Admin** (group → 3 tiles) | sub-section | Existing pages, URL-moved this ship |

**Admin sub-group** contains:

| Entry | URL | State |
|---|---|---|
| Page Settings | `/ballpark-settings/pages` | Existing at `/settings/pages` — MOVED to new URL + 301 |
| Categories | `/ballpark-settings/categories` | Existing at `/settings/categories` — MOVED + 301 |
| Codelists | `/ballpark-settings/codelists` | Existing at `/settings/codelists` — MOVED + 301 |

## Why we needed it

Three concrete needs:

1. **Beth + Meg need a real signups UI.** Today, waitlist signups land
   in `marketing.guestlist_signup` but can only be browsed via Supabase
   dashboard. Port v1's signups management UI to v2.
2. **User-confirmation email is missing.** Signers get no acknowledgment
   that signup worked. Add a second email template (alongside the
   existing admin-notification email) with shared signature config.
3. **URL hierarchy is misleading today.** Categories, Codelists, Page
   Settings live at `/settings/*` but are Ballpark-managed (global), not
   per-org. Consolidating them under `/ballpark-settings/*` matches v1
   + clarifies scope.

Plus future scaffolding:
- Orgs + Users coming-soon stubs reserve the URL space + signal direction
- Feature flags table (`app_config`) replaces curl-with-secret for runtime toggles (font enablement, email enablement)

## Who can use it

**Ballpark team only.** Not org admins. Not regular users.

| Role | Access |
|---|---|
| Ballpark team (founder + admins) | ✓ Full access |
| Agency admin / member | — Nothing here |
| Supplier admin / member | — Nothing here |
| `ballpark_admin` role (post-AUTH-01) | ✓ Full access |

**Auth pattern (revised pV2-EA-02b — role-based, Liam):**
- Uses the **existing `ballpark_admin` role** (`admin.cross_org_view`). Client routes gate on `ballparkAdminGuard` and the server `/api/admin/*` on `authenticate` + `requireActiveMembership('admin.cross_org_view')` — the SAME gate as Pages / Categories / Codelists. Beth / Meg / Liam log in with their Ballpark-team accounts; no separate secret.
- The originally-specced interim `ADMIN_API_SECRET` sessionStorage entry form was **dropped** — it duplicated the role + guard + user-menu the app already has. This *retired* the `/api/admin/*` secret gate (see AUDIT_LEDGER TECH-DEBT-01) rather than extending it.
- **Post-AUTH-01:** unchanged endpoints, swapped onto verified Supabase JWT once that lands.

## Layout — home page

```
[ <app-page-hero> "Ballpark Settings" / subtitle "Manage signups, content, and system config" ]

[ Tile grid — 5 tiles ]

  [Profile]              [Early Access]
   Your org's profile     Waitlist signups, page
   and team               content, notifications

  [Orgs]                 [All Users]
   Manage all             Manage all users
   organizations          across orgs
   (coming soon)          (coming soon)

  [Admin]
   Page Settings,
   Categories, Codelists
   →
```

**Tile design:** matches the existing v2 home action-card pattern
(image-square left + title + description + chevron). Coming-soon tiles
get a subtle visual treatment (lower opacity OR "Coming soon" badge)
but remain clickable into placeholder pages with description.

**Admin sub-home** at `/ballpark-settings/admin/` (or surfaced as flyout
from the Admin tile — your call) shows the 3 system-config tiles.

## Section specs

### Profile

**Cross-link.** Tile on home → `/settings/profile`. No new page; just
navigational convenience so Ballpark admins don't leave the
`/ballpark-settings/*` context to manage their own org settings.

### Early Access (built this ship)

The flagship section. Single-page four-tab UI:

| Tab | Manages |
|---|---|
| **Signups** | Waitlist signup list (search, filter by environment, table view, soft-delete) |
| **Page Content** | Live welcome page copy (per-slide fields) |
| **Notifications** | Two email templates (admin notify + user welcome) + shared signature config |
| **Feature Flags** | Runtime toggles (signup_confirmation_email_enabled, welcome_font_sharpe_enabled, etc.) |

#### Signups tab

**v2 schema changes vs v1:**

| Change | Why |
|---|---|
| DROP `role` | No longer collected on the welcome form |
| SPLIT `name` → `first_name` + `last_name` | More flexible for outreach |
| ADD `source_environment` | Marketing schema is shared across envs; need to distinguish dev/preview/master signups |

**Schema migration:**
```sql
ALTER TABLE marketing.guestlist_signup DROP COLUMN role;
ALTER TABLE marketing.guestlist_signup RENAME COLUMN name TO first_name;
ALTER TABLE marketing.guestlist_signup ADD COLUMN last_name TEXT NOT NULL DEFAULT '';
ALTER TABLE marketing.guestlist_signup ADD COLUMN source_environment TEXT NOT NULL DEFAULT 'master';
-- existing rows: split first_name on first space into first_name + last_name
-- existing rows: source_environment defaulted to 'master' for backfill
```

**Source environment inference (server-side, in signup endpoint):**

```javascript
function inferEnvironment(origin) {
  if (!origin) return 'unknown';
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) return 'dev';
  if (origin.includes('preview.')) return 'preview';
  if (origin.includes('theballpark.ai')) return 'master';
  return 'unknown';
}
```

**UI elements:**
- **Stats tiles** (top, 4): Total · Today · This Week · By Environment (Dev: X · Preview: Y · Master: Z)
- **Environment filter chips** — All / Dev / Preview / Master
- **Search bar** — searches first_name + last_name + email + company
- **Sort toggle** — Newest / Oldest
- **CSV export button** — downloads filtered list
- **Table** (vertical rows):

| First Name | Last Name | Email | Environment | Date | Actions |
|---|---|---|---|---|---|
| John | Smith | john@... | preview | 2026-06-15 | [Delete] |

- **Row detail** (expand or tooltip): company field shown here (collected but not in main table)

**Endpoints (extending existing):**
- `GET /api/admin/signups?q=&envs=&sort=&limit=&offset=` → rows + stats object (extended with environment params + env breakdown stats)
- `DELETE /api/admin/signups/:id` → soft-delete (existing, idempotent)

**Welcome form changes (small piece, lands in this ship):**
- Drop role field (5 chips → gone)
- Split name into First Name + Last Name (two inputs, both required)
- Keep email, keep company, keep Turnstile

#### Page Content tab

Direct port from v1. No changes to schema or endpoints.

Per-slide cards (4 slides), each with editable fields. `marketing.welcome_content` table existing; `GET /api/admin/welcome/content` + `PATCH /api/admin/welcome/content` existing endpoints.

#### Notifications tab

**Two email templates + shared signature** — biggest enhancement vs v1.

**Three sub-cards (responsive: stacked mobile, side-by-side desktop):**

| Sub-card | What it manages |
|---|---|
| **Admin Notification** | Recipients chip input, subject template, body template (with `{{signature}}` support), test-send button, preview pane |
| **User Welcome** | Sender name, reply-to, subject template, body template (with `{{signature}}` support), test-send button, preview pane |
| **Signature** | Image URL field, signature text field, "used by both email templates" indicator, preview |

**Defaults:**
- Signature image: existing Ballpark logo (the same one displayed in the v2 UI). CC resolves actual asset path during build (likely `client-v2/src/assets/...`). Stored as **absolute URL** (e.g. `https://theballpark.ai/assets/logo.png`) — relative paths break in email clients
- Signature text: `Kind Regards, The Ballpark Team`

**Template rendering:** simple regex `\{\{(\w+)\}\}` substitution (same logic server + client preview). The `{{signature}}` variable expands to the rendered signature block (image + text). Templates can place it wherever they want; defaults to bottom of body.

**Template variables (shared):**
- `{{firstName}}` · `{{lastName}}` · `{{email}}` · `{{company}}` · `{{created_at}}` · `{{admin_url}}` · `{{signature}}`

**Schema:**
```
marketing.welcome_settings (existing, admin notify config) — unchanged

marketing.user_email_settings (NEW, user welcome config)
  id INT PK CHECK (id = 1)
  sender_name TEXT NOT NULL
  reply_to TEXT NOT NULL
  subject_template TEXT NOT NULL
  body_template_html TEXT NOT NULL
  updated_at, updated_by

marketing.email_signature (NEW, shared config)
  id INT PK CHECK (id = 1)
  signature_image_url TEXT (default: '/assets/logo-email.png' or similar)
  signature_text TEXT (default: 'Kind Regards, The Ballpark Team')
  updated_at, updated_by
```

**Endpoints (existing + new):**
- Existing: `GET/PATCH /api/admin/welcome/settings`, `POST /api/admin/welcome/settings/test-email`
- New: `GET/PATCH /api/admin/welcome/user-email`, `POST /api/admin/welcome/user-email/test`
- New: `GET/PATCH /api/admin/welcome/signature`

**RP-A2 (template injection):** user-supplied data in template variables MUST be HTML-escaped before render (`<`, `>`, `&`, `"`, `'`). Otherwise a signup with a name like `<script>alert(1)</script>` lands in the body raw.

#### Feature Flags tab

UI over `app_config` table. Replaces curl-with-secret for runtime toggles.

**Initial flags:**
- `signup_confirmation_email_enabled` (boolean, default false)
- `welcome_font_sharpe_enabled` (boolean, default false)
- (extensible — future flags added without UI changes)

**Schema:**
```
app_config (NEW)
  key TEXT PK
  value JSONB (boolean, string, number, object)
  label TEXT (UI label)
  description TEXT (UI help)
  category TEXT ('feature_flag' | 'integration_config' | ...)
  updated_at, updated_by
```

**Endpoints:**
- `GET /api/config` — public, returns user-facing flags only (font flag exposed; email flag server-internal)
- `GET /api/admin/config` — admin-gated, returns ALL flags with metadata
- `PATCH /api/admin/config` — admin-gated, update one or more flags

**UI:** flag list (vertical). Each row: key (read-only), label + description, toggle/value editor, last-updated audit, per-flag save button (disabled until dirty).

### Orgs (coming soon)

Stub page at `/ballpark-settings/orgs` showing:
- Title: "Orgs"
- Description: "Manage all organizations in Ballpark. Coming soon — port from v1 when ready."
- Optional: link to v1's `/ballpark-settings/orgs` if accessible

Future ship: pV2-BALLPARK-ORGS-01 (port from v1's existing orgs admin).

### All Users (coming soon)

Stub page at `/ballpark-settings/users` showing:
- Title: "All Users"
- Description: "Manage all users across organizations. Coming soon."

Future ship: pV2-BALLPARK-USERS-01.

### Admin group (existing — URL moved)

Three tiles, each linking to its moved URL:

| Section | New URL | Old URL (301 redirect) |
|---|---|---|
| Page Settings | `/ballpark-settings/pages` | `/settings/pages` |
| Categories | `/ballpark-settings/categories` | `/settings/categories` |
| Codelists | `/ballpark-settings/codelists` | `/settings/codelists` |

**URL move work in this ship:**
- Update 3 route definitions to new paths
- Add 3 → 301 redirects from old paths
- Grep + update any internal navigation links pointing at `/settings/{pages,categories,codelists}`
- Each section's CONTENT is unchanged — pure URL relocation

## Locked architectural decisions

1. **URL prefix is `/ballpark-settings/*`** — matches v1, communicates Ballpark-internal scope without overclaiming the namespace.
2. **Home page lists 5 entries**: Profile (cross-link) · Early Access · Orgs (coming soon) · All Users (coming soon) · Admin (group of 3).
3. **Flat URLs under `/ballpark-settings/*`** — no redundant `/admin/` URL segment. The "Admin" grouping on home is purely visual organization.
4. **Profile stays at `/settings/profile`** — accessed by all org admins (agency/supplier owners), not just Ballpark team. The `/ballpark-settings/profile` tile is a cross-link, not a duplicate.
5. **Interim auth = sessionStorage `ADMIN_API_SECRET` entry form** — sessionStorage (not localStorage); TECH-DEBT-01's UI counterpart; retires at pV2-AUTH-01.
6. **Two email templates + shared signature** — admin notify + user welcome both use the same signature block via `{{signature}}` variable. Single source of truth for brand consistency.
7. **Soft-delete on signups, never hard-delete** — same no-DELETE rule as codelists. Listing filters `deleted_at IS NULL`.
8. **`app_config` table is the canonical runtime config** — all toggleable behavior reads from here. Env vars are deploy-time only.
9. **Source environment is inferred from Origin header** at signup time — captured into `source_environment` column. Spoofable but low-stakes (analytics tagging, not security).
10. **Coming-soon stubs reserve URL space + signal direction** — full content + functionality lands in future ships, but home/nav doesn't need updating later.
11. **HTML email body editor is a textarea + preview pane** (not WYSIWYG) — keeps initial ship lean; rich text is a future enhancement if Beth/Meg ask.
12. **Logo for email is a URL field** (not picker integration) — picker mount becomes a natural future enhancement post-MEDIA-01 close.
13. **Template variable substitution is regex-based `{{var}}`** — not Handlebars/Liquid/etc.; signup data shape is small + stable.
14. **Welcome form updates bundle with this ship** — drop role field, split name into First/Last (small piece of welcome surface change).

## Risk patterns

- **RP-A1 — interim auth UI leaking secret.** sessionStorage entry form must NEVER log the secret, never echo it back from the server, never include it in error messages. Audit on every release until AUTH-01 retires this pattern.
- **RP-A2 — template injection in `{{var}}`.** User-supplied data (signup `first_name`, `last_name`, `company`) flows through template substitution into HTML email body. Sanitize variables: escape `<`, `>`, `&`, `"`, `'` before rendering.
- **RP-A3 — feature flag staleness.** Server caches config reads; without refresh trigger, flags may not propagate immediately on admin update. v1 of this admin: short TTL (15-60 sec).
- **RP-A4 — admin endpoint enumeration.** Attacker who steals `ADMIN_API_SECRET` can flip feature flags arbitrarily. Defenses: rate-limit admin endpoints, log every PATCH, alert on suspicious patterns.
- **RP-A5 — environment inference bypass.** Origin header spoofable; an attacker could mark prod signups as 'dev' to hide them from production reports. Low-stakes (analytics, not security), but defense: validate Origin against a known-good list.

## Build order

| # | Slice | Notes |
|---|---|---|
| 1 | **`app_config` table + endpoints** | Foundation — feature flag infrastructure |
| 2 | **Schema migrations** — signup table changes + new tables (user_email_settings, email_signature) | Data layer first |
| 3 | **URL move** — existing pages/categories/codelists from `/settings/*` → `/ballpark-settings/*` with redirects | Clean URL state |
| 4 | **`/ballpark-settings/` home page** + tile components + auth secret-entry gate | The shell |
| 5 | **Early Access page shell** (4-tab container) | Mount point for the rest |
| 6 | **Signups tab** | Consumes existing + extended endpoints |
| 7 | **Page Content tab** | Direct port of v1 |
| 8 | **Notifications tab** (3 sub-cards: admin notify, user welcome, signature) | Biggest scope; new endpoints + new tables |
| 9 | **Feature Flags tab** | UI over `app_config` |
| 10 | **Coming-soon stubs** for `/ballpark-settings/orgs` + `/users` | Tiny pages |
| 11 | **Welcome form updates** (drop role, split name) | Small welcome surface change |
| 12 | **Activate signup confirmation email + welcome font** via curl PATCH OR via the new Feature Flags UI | Bookend |

Each slice is small (~half-day to day). Total epic ~5-8 days CC work.

## Audit reference

See `AUDIT_LEDGER.md` for per-file audit state. Empty until first slice ships.

## Version history

### Summary — skimmable status

| Version | Date | What changed (1-line) | Ship | QC Done? | Audit Done? |
|---|---|---|---|---|---|
| v2.33a | 2026-06-22 | **pV2-EA-01** — signup schema + welcome form: first/last split, role+company dropped, source_environment added, rows backfilled (no admin UI) | `5b565d6b` | — | — |
| v2.33b | 2026-06-22 | **pV2-EA-02** — Early Access (Signups env-aware / Page content / Notifications-admin half). *(Initially shipped with a `/ballpark-settings` home + secret gate; reworked in v2.33c.)* | `bd1872a0` | — | — |
| v2.33c | 2026-06-22 | **pV2-EA-02b** — reworked onto the existing `ballpark_admin` role: Early Access moved to `/settings/early-access` under `ballparkAdminGuard` + user-menu link; server `/api/admin/*` gates on the session role (not a secret); secret gate + tile-home + `admin-secret`/interceptor removed. Retires TECH-DEBT-01's `/api/admin/*` secret. | `<pending>` | — | — |
| target | TBD | **pV2-EA-03** — user-welcome email + shared signature + `app_config` table + Notifications-tab extension | — | — | — |
| target | TBD | **pV2-EA-04** — Feature Flags UI + URL move (pages/categories/codelists → `/ballpark-settings/*`) + coming-soon stubs (Orgs, Users) | — | — | — |
| target | post-AUTH-01 | **pV2-BALLPARK-AUTH-MIGRATE** — retire interim sessionStorage secret-entry UI; consume v2 JWT instead (with `ballpark_admin` role check) | — | — | — |
| target | future | **pV2-BALLPARK-ORGS-01** — port v1's Orgs admin to `/ballpark-settings/orgs` | — | — | — |
| target | future | **pV2-BALLPARK-USERS-01** — All Users admin (likely also a v1 port; verify v1 exists) | — | — | — |

### Detail — QC + Audit findings per version

(Empty — nothing shipped yet)

### Deferred — items pushed to a later prompt / arc

| Item | Deferred from | Why | Lands in |
|---|---|---|---|
| Rich-text WYSIWYG editor for email body | pV2-BALLPARK-EARLY-ACCESS-01 | Initial ship: HTML textarea + preview is sufficient; WYSIWYG adds complexity + heavy deps. Revisit if Beth/Meg ask | future |
| Asset/picker integration for signature image | pV2-BALLPARK-EARLY-ACCESS-01 | First ship: signature image is URL field editable manually. Picker mount is natural fit post-MEDIA-01 close | post-MEDIA-01 |
| Bulk operations on signups (multi-select delete, export subset) | pV2-BALLPARK-EARLY-ACCESS-01 | Single-item operations sufficient for initial volume. Add when signup volume justifies | future |
| Tagging/notes per signup | pV2-BALLPARK-EARLY-ACCESS-01 | Out of v1 scope; valuable but its own enhancement | future |
| Email send analytics (open rate, click rate) | pV2-BALLPARK-EARLY-ACCESS-01 | Requires Resend analytics integration; out of scope for initial ship | future |
| Signup source tracking (UTM, referrer) | pV2-BALLPARK-EARLY-ACCESS-01 | Requires form changes + new columns + reporting UI; defer | future |
| Orgs admin UI port | pV2-BALLPARK-EARLY-ACCESS-01 | This ship focuses on Early Access; Orgs gets its own | pV2-BALLPARK-ORGS-01 |
| All Users admin UI | pV2-BALLPARK-EARLY-ACCESS-01 | This ship focuses on Early Access; Users gets its own | pV2-BALLPARK-USERS-01 |
| Audit log viewer (who changed what when) | pV2-BALLPARK-EARLY-ACCESS-01 | `updated_by` + `updated_at` are captured at DB level; viewer UI is future polish | future |

## When to update this doc

- New tile added to `/ballpark-settings/` home → update Layout
- New tab added inside Early Access → update Section specs
- New feature flag added → update Feature Flags tab section
- Auth pattern changes (interim → JWT migration at AUTH-01) → update Who can use it + Locked decisions §5
- New risk pattern surfaces → log under Risk patterns
- v1 → v2 parity questions → cross-reference v1 source (`client-angular/src/app/features/ballpark-settings/`)

## Pairs with

- `docs/WELCOME.md` — surface this admin manages; welcome signup form populates `marketing.guestlist_signup`; welcome page content reads from `marketing.welcome_content`. Welcome form micro-update (drop role, split name) bundled in this ship
- `docs/SECURITY.md` — interim sessionStorage secret-entry is TECH-DEBT-01's UI counterpart; SECURITY.md §11 locks `ballpark_admin` as a distinct role
- `docs/AUDIT_LEDGER.md` — TECH-DEBT-01 sunset condition explicitly names AUTH-01 as retirement ship
- `docs/MEDIA.md` — when MEDIA-01 closes + picker exists, the email signature image field could become a picker mount
- `docs/PAGE_SETTINGS.md` — moves to `/ballpark-settings/pages` as part of this ship's URL reorg
- `docs/CODELISTS.md` — codelist admin UI moves to `/ballpark-settings/codelists` as part of this ship
- `docs/PROJECTS.md` — different scope (per-org), not affected
- v1 reference: `client-angular/src/app/features/ballpark-settings/early-access/early-access.component.ts`
