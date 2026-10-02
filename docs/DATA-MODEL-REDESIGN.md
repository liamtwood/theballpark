# Data-model redesign — working design

Greenfield rebuild (pre-launch wipe + reseed). This captures the target model decided in
the 2026-10-01 walkthrough. Status per table: **LOCKED** / **DRAFT** / **TODO**.

## Principles & conventions (LOCKED)

- **Naming:** plural entity tables (`orgs`, `items`, `projects`, `users`, `categories`);
  owner-prefixed children/satellites (`org_settings`, `project_items`, `message_relations`);
  snake_case; `x_id` FKs.
- **Object base contract** — every object carries: `id`, `ref` (stable public handle/slug, where
  user-facing), `name`, `description`, `status` (codelist-backed — **replaces `is_active`**),
  `org_id` **NOT NULL**, + 3 audit pairs (`created/updated/deleted _at/_by`).
- **Ballpark = org #1.** A **singleton platform org** (`type='ballpark'`, `ref='ballpark'`,
  `parent_id = null`). It makes "**every object has an owner**" literally true:
  - `org_id NOT NULL` everywhere; **global/platform data is *owned by* Ballpark** (not null).
  - One read rule: **platform-owned (`org_id = ballpark`) = publicly readable**; everything else
    tenant-scoped. RLS always filters `org_id`; no "null = global" special case.
  - Bootstrap: seed the Ballpark org **and a system user** first (audit FKs nullable through bootstrap).
- **`orgs` is the one exception** — no `org_id` (it *is* the tenant). Its hierarchy is
  `parent_id → orgs` (Ballpark = root). A second brand = a **separate instance/DB**, so no
  in-DB multi-instance isolation is needed; `parent_id` + the singleton root is cheap future-proofing.
- **Value-objects as `jsonb`** when read-as-a-unit with no per-field query/FK need (`client`, `cover`,
  `contact`). Rule: a jsonb field **graduates to a real column** when it becomes query-hot. (MAPI/Stripe
  precedent; already used in `items.attributes`, `parsed_brief_json`.)
- **Addresses = a GLOBAL table** (`addresses`), referenced by `*_address_id` — because they have a real
  geo/query future (suppliers-near-venue). **Contacts = inline value-object.** Documents **snapshot** a
  frozen copy of an address; never FK the live one (Amazon/Stripe pattern).
- **Messaging = a general org↔org comms layer** (not a project feature): party-generic
  (`from_org_id`/`to_org_id`), project-optional (context via `message_relations`), **message-driven**
  (every action is a message → events ride the message), **org-shared inbox** (access = members of
  `from_org` OR `to_org` via `user_orgs`; no private channel — transparency / anti-disintermediation /
  audit). Ballpark-as-org gives platform notices + support for free.
- **Freeze + overlay (project lines)** — `project_items` is a FAITHFUL CLONE of the item's full definition at add,
  FROZEN (immune to later catalogue edits); `item_id` is a provenance pointer, never the source of truth for the ask.
  `project_item_quotes` mirrors every definitional field but holds them NULL unless the supplier changes them — a
  sparse OVERLAY: read `COALESCE(quote, project_items)` for the current agreed form, and the populated quote fields
  ARE the changelog ("was plastic → now metal"). Moving price/status history → `message_events`.
- **Currency travels with price** — authority on the line (`project_items.currency`, seeded from item on select /
  project on custom; the quote carries it); org/project currency are DEFAULTS + the display/rollup basis (future FX
  conversion). `items` untouched. FR-00231.

## Foundation tables

### `orgs` — LOCKED (base)
`id`, `ref`, `name`, `description`, `status`, `type` (agency/supplier/ballpark), `parent_id → orgs`
(Ballpark root), `company_number`, `vat_number`, `vat_registered`, `primary_address_id → addresses`,
`primary_contact` (jsonb), `logo_url`, `cover_image_url`, `ref_prefix`, `ref_counter`, + audit.
*(No `org_id` — it is the tenant; uses `parent_id`.)*
- **`org_settings`** (1:1): estimate defaults (`default_margin/contingency/vat/insurance_pct`,
  `default_insurance_amount`, `default_currency`), `auto_publish_items` (wire in FR-00214), `image_display`.
- **`org_subscription`** (1:1, deferred to payments): `tier`, `balls_balance` (cached), `balls_monthly_allowance`, future Stripe fields.
- **Later:** `org_addresses` / `org_contacts` (multi), `org_media` (gallery).

### `users`, `user_orgs` — TODO (detailed pass not done)
Identity + membership (role/status). `user_orgs` = the access group (membership = inbox access).

### `categories` — LOCKED (2026-10-02)
Marketplace taxonomy ONLY (one product vocabulary everything classifies against). The recursive-tree
*pattern* is reused per domain — but NOT one shared table across unrelated trees (feedback has its own table).
`id`, `ref` (slug), `name`, `description`, `parent_id → categories` (recursive tree), `sort_order`,
`icon_name`, `icon_color`, `cover` (← `cover_image_url`), `tagline` (34/209 used), `org_id NOT NULL`
(= Ballpark for the shared taxonomy), `status` (new/active/retired), + audit.
- **Dropped:** `level` (derive from parent chain), `namespace` (table = its namespace), `object_type`
  (209/209 null — dead here), `icon` (legacy → `icon_name`), `card_color` (tokens), `model` (junk),
  `tags[]` (confirm unused), `is_active` + `enabled` (two flags → one `status`).
- **Data cull owed:** evict the 17 `namespace='feedback'` residue rows (dupes; live home is
  `shared.feedback_categories`), then drop `namespace`. (DB-CLEANUP-CHECKLIST line 49.)

### `shared.feedback_categories` — LOCKED (2026-10-02)
The feedback trackers' own tree (28 rows) — the "two tables, not one namespace-partitioned table" split, already
in place. `id`, `name`, `description`, `parent_id`, `sort_order`, `icon_name`, `icon_color`, `tagline`
(13/28 used), `object_type` (issue/folder — meaningful here), + audit. **Dropped:** `namespace` (table = its
namespace). No `org_id`/`cover`/`ref` (internal ops config, cross-env `shared`).

**Shared recursive-tree core** (both tables): `id, name, description, parent_id, sort_order, icon_name,
icon_color, tagline, + audit`. `categories` adds `ref/cover/org_id/status`; `feedback_categories` adds
`object_type`. Both drop `namespace`.

### `items` — DRAFT (uses the locked item model)
Org-owned (`org_id NOT NULL`). Universal core + unit-driven fields + `attributes` jsonb (5 describe-groups)
+ variants + `kind`. Per the v0.2.0 locked spec — apply the base contract, drop cruft.

### `addresses` — DRAFT (global table)
`id`, `org_id` (owner), `kind` (registered/store/shipping/billing), `label`, `line1/2`, `city`, `region`,
`postcode`, `country`, `lat`/`lng`?, + audit. Entities hold `*_address_id`. Multi-owner link deferred.

### `tags` / `supplier_item_tag` — keep (the m2m tagging layer).

## Projects

### `projects` — DRAFT (base, 66 → ~24)
Groups, in column order: **identity** (`id, ref, name, description, status, org_id, tier, currency, po_ref`) ·
**project facts** (`event_date, event_type, guest_count, duration_days, venue_name, venue_address_id`) ·
**buyer party** (`client_name` column + `client` jsonb snapshot — see below) · **cover** (`cover` jsonb,
`icon_name`, `icon_color`) · **brief input** (`raw_brief_text`, `parsed_brief_json`) · **audit**.
- **Buyer:** `client_name` (the one queried field — column) + `client` jsonb snapshot
  (`company_number, logo_url, address, contact`). **No `client_id`** (clients entity retired); if clients
  ever become a tenant, *add* `client_id` — the jsonb stays as the snapshot. Buyer address is a **snapshot
  inside the jsonb**, not a live FK.
- **Dropped:** `total_*` (computed), `status_id`/`is_active` (→ status), `event_name` (→ name),
  `client_id` + flat client/venue_city (→ value-object / address FK), `images` (→ `project_media`),
  `quote_*`/`sow_*` (→ `project_documents`).
- **Satellites:** `project_settings` (budget + per-project rate overrides + card_color);
  `project_categories` (the **structured brief** `requirement_brief`/`requirement_detail` + `match_result_json`
  — cost-rollup/name/status_code dropped); `project_items` (TODO — big pass); `project_suppliers`
  (engagement); `project_documents` (SOW/Quote); `project_media` (later).
- **Brief:** the structured brief **is** `project_categories`; `projects` keeps only the raw input.

### Line cluster — LOCKED (2026-10-02 walkthrough)

Follows **Freeze + overlay** + **Currency travels with price** (Principles). Three tables; moving
price/status history lives in `message_events`.

**`project_items`** — STATIC requirement, a faithful frozen clone of the item:
`id`, `org_id` (agency), `project_id`, `project_category_id`, `item_id` (provenance pointer; NULL = custom),
`kind`/`parent_id` (dormant — buildup shelved), `name`, `description`, `attributes` jsonb (cloned),
`selection_type` (v1 pick-one-of-similar, e.g. 50" vs 100" TV; dormant, cheap to keep), `quantity`, `unit`,
`currency`, `base_price` (catalogue reference, frozen), `variant` jsonb, `installed` bool,
`install_description`/`install_cost`/`install_unit`, `image_url`, `status`, + audit.
- **Dropped vs today:** `is_custom` (derive = `item_id IS NULL`); `margin_pct` (→ FR-00230);
  `price_ref`/`price_current`/`flat_total`/`supplier_org_id`/`logical_line_id` (→ quote / providers);
  `source`/`ai_*` (→ matches).

**`project_item_quotes`** — the complete supplier-modifiable form; a NULL-means-inherit OVERLAY on the
requirement, one row per (requirement × provider):
- keys: `id`, `org_id` (agency), `project_item_id`, `project_provider_id`, `unique(project_item_id, project_provider_id)`.
- **mirrored definitional** (null = inherit from `project_items`): `name`, `description`, `attributes`, `variant`,
  `image_url`, `unit`, `quantity`, `currency`, `install_description`/`install_cost`/`install_unit`.
- **quote-native:** `quote_description` (AGENT client-facing Quote-doc text — the one agent-owned field; name → FR-00229);
  `price_before` / `price_current` / `price_override` (per-unit "was" cache / per-unit "now" / flat line-total;
  `CHECK (price_current IS NULL OR price_override IS NULL)`; per-unit falls back to `project_items.base_price`);
  `status`, `decline_reason`, `details` (human calc note, e.g. "2 × TV @ $50 for 3 days = $300"); + audit.
- **Current form** = `COALESCE(quote.field, project_items.field)`; **the populated quote fields are the changelog.**
  No `margin_pct` (project-level for now — FR-00230).

**`project_item_matches`** — per-requirement AI provenance (1:1): `id`, `org_id`,
`project_item_id` (unique), `source` (catalogue/custom/ai), `ai_confidence`, `ai_match_reason`,
`ai_estimated_price`, + audit.

**Provider generalisation:** `project_provider_id` → `project_providers` (renamed from `project_suppliers`);
the provider is a supplier OR the agent (agent-own lines, self-quoted + auto-accepted).

## Messaging / engagement cluster — LOCKED (2026-10-02)

### `project_providers` — the engagement spine — LOCKED
`id`, `org_id` (agency), `project_id → projects`, `provider_org_id → orgs` (supplier OR agent-as-provider),
`status` (**wholesale only**: `pending`/`booked`/`cancelled`; `negotiating`/`agreed` are DERIVED from the
quotes), + audit. `UNIQUE(project_id, provider_org_id)` (reused on re-engagement). Backs the **inbox home**
(one row per provider). Renamed from the never-existed `project_suppliers` — today engagement is scattered
across `quote_requests` + `project_item_suppliers` + `project_items.supplier_org_id`. Inbox home reads a
`security_invoker` view (`vw_project_provider`) that derives live status from the quotes and falls back to the
stored wholesale status (ADR-0002).

### `messages` — party-anchored — LOCKED
`id`, `from_org_id → orgs`, `to_org_id → orgs`, `user_id → users` (sender), `project_id → projects` (nullable
context), `subject`, `body` (**nullable** — a bodyless message = an *action*, e.g. a bare Accept, rendered as a
timeline action line, not a chat bubble), `status`, `next_action_by`, `token` (public /brief credential,
BE-00115), + audit.
- **Access = members of `from_org` OR `to_org`** (RLS on the pair). Two-party — the one place with two org FKs.
- **Dropped:** `supplier_org_id` + `direction` (→ `from`/`to`, derived), `category_id` (→ relations), `status_id`
  + `msg_status` (→ one `status`), `supplier_name`/`category_name`/`contact_name` (denormalized),
  `estimate_item_id` + `tagged_item_id` (dead), `read` (→ `message_reads`), `ref_code` (dropped — `project_id`
  gives context), `intro_note` (folded into `body`).

### `message_reads` — per-user read (FR-00232)
`message_id → messages`, `user_id → users`, `read_at`, `PK(message_id, user_id)`. Replaces the single
`messages.read` bool — the inbox is org-shared, so read is per person. Foundation for the parked read-receipts.

### `message_relations` — what a message is about (0..N) — LOCKED
`id`, `message_id → messages`, exactly ONE of `project_item_id → project_items` / `project_category_id →
project_categories` / `document_id → project_documents` (`CHECK num_nonnulls(...) = 1`), + light audit
(`created_at`/`created_by`; immutable link). **1 row per target** (a message about 3 items = 3 rows); **0 rows =
general message** (project context from `messages.project_id`). Typed nullable FKs, not polymorphic (keeps FK
integrity). **Extensible:** a new target (e.g. `item_id → items` for a marketplace-item enquiry) = add a nullable
FK + widen the CHECK, no restructure. Also the anchor for `message_events`. `document_id` is a **forward FK**
(`project_documents` still DRAFT).

### `message_events` — append-only state journal — LOCKED
`id`, `message_id → messages` **NOT NULL**, `message_relation_id → message_relations` **NOT NULL** (always about
an item/doc), `status` (the item's/doc's resulting status), `price_current` (per-unit; NULL in a pure flat deal),
`price_override` (effective LINE TOTAL — always set), `changes` jsonb (`{field: new_value}` for any *other*
evolved field — `install_*`, name, description, unit, quantity, attributes, variant …), `reason_code`, `note`,
`created_at`/`created_by`. **Append-only** (no update/delete).
- **Resulting-STATE only, no `before`/`from`:** "before" = the prior event row; the frozen `project_items` row is
  the **baseline (event 0)**. `from_status` + all `*_before` dropped — derivable, given the **single-write-path
  invariant** (every state change writes an event).
- **Actor derived, not stored:** `actor_type`/`actor_id` dropped — the actor is the message's sender
  (`messages.from_org_id` = side; Ballpark org #1 = system; `messages.user_id` = person).
- **`UNIQUE(message_id, message_relation_id)`** — one event per item/doc per message (all of an action's changes
  fold into one row). **Today 1 message : 1 event** (no "accept all"); **"accept all" later = 1 message : N
  events**, no schema change.
- Not an object — no `name`/`description`/`ref`. A message has **0..N** events (pure chat = 0; an action = 1 per
  item). Merges old `message_item_events` + `message_item_decisions`. Source of the SOW §3 Price Notes.

### Approvals (FR-00228)
No new table. Approval **request** = a message + a `message_relations` row (item or document). Approval
**outcome** = a `message_event` (`status = accepted/declined`; actor = the message sender). **Both-approved is
derivable** (an accept event from each side). Document approval also flips `project_documents.status`.

**Approval clearing (replaces today's `message_item_decisions.decision = 'cleared'`, 24 rows).** Acceptance is
not permanent: a **material event** after an accept invalidates it ("un-accept" — e.g. both accept, supplier
raises the price). `cleared` is **dropped as a stored value** — derived from event ordering: an accept is valid
only if **no material event post-dates it**. Material = an event that changed price / a definitional field
(`changes`) / status (e.g. cancel); a plain chat message is not material. The **why** is on the causing event
(its `note` + delta) — no redundant `cleared` row. **The read view surfaces it** (ADR-0002): per line,
`approval state` (`approved_both` / `awaiting_<side>` / `needs_reapproval`) + the clearing event's note/delta,
so the UI shows "re-approval needed: supplier raised £4→£5" directly.

## Culled

`quote_requests` (restates line+engagement), `project_item_suppliers` (folded into engagement/line),
`estimates` + `estimate_items` (v1, computed now), `clients` (free-text buyer + `listClientNames`),
`statuses` (legacy dual-model), `ai_search_hints` (empty), `message_item_decisions` (→ `message_events`),
`tagged_item_id` (dead 0/131), `event_name` (→ name), `total_*` (computed), `project_categories` cost
columns, `messages.ref_code` (dropped — `project_id` gives context), `messages.read` (→ `message_reads`),
`messages.intro_note` (→ `body`), `items.subcategory_id` + `coverage_area` (dropped),
`shared.backlog`/`shared.bugs` (legacy dev trackers — confirm). See DB-CLEANUP-CHECKLIST.md.

## Open decisions

1. ~~`messages.read` bool vs per-user child~~ — **RESOLVED**: per-user `message_reads` + read service (FR-00232).
2. ~~`messages.intro_note`~~ — **RESOLVED**: folded into `body`.
3. ~~Conversation grouping~~ — **RESOLVED**: derive the thread from `(from_org, to_org, project_id)`; per-topic
   threads via `message_relations`. No `conversations` table (add `conversation_id` only if a named standalone
   thread is ever needed).
4. ~~`project_items` detailed pass / clone-vs-quotes fork~~ — **LOCKED** (2026-10-02): frozen `project_items`
   + per-provider `project_item_quotes` overlay + `project_item_matches`. See "Line cluster — LOCKED".
5. **`project_documents` detailed design** (SOW/Quote satellite, item-set, signatures).
6. **Send paths B / C / D** (A traced: catalogue→owner = ensure engagement, attach line, one thread, no clone).
7. `org_id` on project children — **denormalize** onto every child (uniform simple RLS) vs **derive** via parent FK.
8. Addresses multi-owner link (`org_addresses`) when multi ships.

## Table inventory & review status

All 27 base tables + 1 view, grouped by main object. ✅ locked · 🟡 review · 🔲 not touched ·
➖ cull · ✨ new (spec'd). **Project** is the umbrella for the negotiation spine.

| Object | Tables | Status |
|---|---|---|
| **Org** | `orgs` | ✅ base locked |
| | `balls_transactions` → **`org_credits`** | 🟡 review + rename — credits **ledger** (append-only; `direction`/`amount`/`reason`); home of the outreach cost |
| | `favourites` → **`org_favourites`** | 🟡 review + rename (FR-00229) — org saved-list (`org_id, type, ref_id`); transactional, not config |
| **User** | `users`, `user_orgs` | 🔲 not reviewed |
| **Config / Reference** | `coachmarks` | 🟡 global UI config (no per-user state — dismissals client-side) |
| | `bp_brand_config`, `org_type_config` | 🟡 review (brand / org-type config) |
| | `reference_codelists`, `feature_flags` (shared) | ➖ keep (shared, cross-env) |
| **Taxonomy** | `categories` | ✅ locked (marketplace-only; evict 17 residue rows) |
| | `tag` → **`tags`** | 🟡 keep — faceted tag vocabulary (`category_id`, `dimension`, `label`) |
| **Item** | `items` | ✅ reviewed |
| | `supplier_item_tag` → **`item_tag`** | 🟡 keep + rename — pure item↔tag junction (no `supplier_org_id`) |
| | `catalogue_extract_job` → **`item_extract_jobs`** | 🟡 keep + rename (FR-00229) — the extractor job ledger |
| | `ai_search_hints` | ➖ cull (empty) |
| **Project** (core) | `projects`, `project_categories` | 🟡 review |
| | `project_settings` | ✨ new satellite |
| &nbsp;&nbsp;↳ **Line** | `project_items` | ✅ locked |
| | `project_item_quotes`, `project_item_matches` | ✨ ✅ locked |
| | `project_item_suppliers`, `quote_requests` | ➖ cull |
| &nbsp;&nbsp;↳ **Engagement** | `project_providers` | ✨ ✅ locked |
| &nbsp;&nbsp;↳ **Messaging** | `messages`, `message_reads`, `message_relations`, `message_events` | ✅ locked |
| | `message_items`, `message_item_events`, `message_item_decisions` | ➖ cull/fold |
| &nbsp;&nbsp;↳ **Document** | `project_documents` | 🔲 ✨ TODO design |
| **Legacy / cull** | `clients`, `estimates`, `estimate_items`, `statuses` | ➖ cull |
| **Views** | `orgs_public` | 🟡 → `security_invoker` (ADR-0002, BE-00139) |

**Review queue (🟡/🔲):** Project (projects / project_categories / project_settings) · User (users / user_orgs) ·
Config/Reference (coachmarks / bp_brand_config / org_type_config) · Org (balls_transactions / `org_favourites`) ·
Taxonomy (categories) · Item extract (`item_extract_jobs`) · **Document** (project_documents, TODO) ·
`orgs_public` (security_invoker).

## Decision log — walkthrough rationale

The *why* behind the locked shapes (recorded as the questions were asked, 2026-10-01/02).
When a question lands on something already built, the reasoning goes here.

- **Supplier edits save in place today.** `updateLineDetails` writes name/description/cost(→`base_price`)/
  unit/install straight onto `project_items`. So `project_items` is NOT static today; the redesign freezes it
  and moves edits to the quote — giving an ask-vs-offer diff and killing the `base_price`/`price_current` dual
  that "doesn't always behave."
- **Freeze + overlay.** Clone the full item definition onto `project_items`, frozen (`item_id` = provenance
  pointer only). The catalogue item is live + supplier-owned and can drift, so the ask must *copy*, not
  reference. The quote mirrors every definitional field but holds them NULL unless changed — a sparse overlay,
  so unchanged data isn't stored twice, and **the populated quote fields are the changelog**.
- **Price fields.** `price_before` (per-unit, cache of prior event) / `price_current` (per-unit now) /
  `price_override` (flat line total), `CHECK` mutual-exclusion, fall back to frozen `base_price`. `price_ref`
  collapsed into `base_price` (at send today, `price_ref = base_price`). One live truth per line.
- **Currency.** Authority on the line (seeded from item on select / project on custom); org/project = defaults
  + the display/rollup basis (future FX). `items` untouched. Currency is intrinsic to a price (Amazon keys by
  it); single-currency today means values coincide, so adopting line-level currency is safe now. (Code: only
  org→item hop exists today — FR-00231.)
- **`message_events`: no `before`/`from`.** Resulting-state only; "before" = prior row, frozen `project_items`
  = event 0. before/after was UI convenience + a hedge against an unreliable multi-path journal; the redesign
  makes the journal authoritative, so it's derivable — **provided the single-write-path invariant holds** (every
  state change writes an event).
- **Actor derived, not stored.** The actor is the message's sender (`from_org` = side, Ballpark org #1 =
  system, `user_id` = person). Every event rides a message, so storing actor duplicated it. Dropped today's
  `actor_type`/`actor_id` (they existed only because `message_item_events` wasn't message-anchored).
- **Action = a bodyless message.** A bare Accept (no text) is still a `messages` row (`body` NULL) + relation +
  event — needed to keep actor-derivation and one timeline. Events are the **state-change journal**: a message
  has 0..N events (pure chat = 0). Unique `(message_id, message_relation_id)`; today 1:1, "accept all" → 1:N.
- **Approval clearing is derived, not stored.** Today `message_item_decisions.decision='cleared'` (24 rows)
  marked an acceptance invalidated by a later change/cancel. In the journal that's free from ordering — an
  accept is valid only if no **material** event (price / definitional `changes` / status like cancel)
  post-dates it. `cleared` dropped; the *why* lives on the causing event's note+delta; the **read view**
  exposes the per-line approval state + the clearing event so the UI shows it with no client-side folding.
- **`project_providers` is coarse (per-provider).** One row per supplier (not per-category like today's
  `quote_requests`); line/category detail lives on the quotes. Stores only wholesale status
  (pending/booked/cancelled); negotiating/agreed are derived by `vw_project_provider`. Backs the inbox home.
- **Items (kept, lightly trimmed).** Two status axes — `status` new/active/retired (← `is_active`) and
  `approval_status` draft/pending/approved/rejected (independent: approved-but-archived and draft-but-active
  both exist in data). `subcategory_id` dropped (store one home `category_id` at any depth; derive the
  breadcrumb from the recursive tree). `coverage_area` dropped. `price_tiers` kept in `attributes` (volume
  guide, read as a unit).
- **Conversation grouping is derived, no table.** A thread = messages sharing `(from_org, to_org, project_id)`,
  ordered by time; finer per-topic threads come from `message_relations`. Access is already org-pair based and
  relations carry the topic, so a `conversations` table earns nothing yet — add `conversation_id` only if a
  named, standalone thread with its own lifecycle is ever needed.
- **Config / Reference domain; no `settings_` prefix.** Grouped `coachmarks` (3 rows — global UI config, no
  per-user state), `bp_brand_config`, `org_type_config`, and shared `reference_codelists`/`feature_flags` as a
  config/reference domain. Rejected a blanket `settings_` prefix: it collides with the `*_settings` satellite
  convention (owner on the *left*: `org_settings`/`project_settings`) and the tables span `public`+`shared`.
  Name by what each is instead.
- **`balls_transactions` → `org_credits`.** The credits **ledger** (append-only; `direction`/`amount`/`reason`;
  25 rows). Kept balls-specific, not generalised to money (payments is roadmap). The UI term is decoupled —
  "Balls" is `org_type_config.payload.creditLabel` (configurable per org_type), so the table name is internal
  plumbing. Cached **balance** stays on the org (`balls_balance` → `credits_balance`, FR-00229). Drop legacy
  `estimate_id`; add `message_id` later to link the outreach message → its ledger row.
- **Config table split.** `org_type_config` = per-org-type **page config + labels** (jsonb `payload`:
  `creditLabel`, event/client labels, hero config). `bp_brand_config` = **visual theme** only (font/gradient/
  colour). Two different concerns, not merged.
- **`supplier_item_tag` → `item_tag`, under Item.** It's `item_id, tag_id` only (802 rows) — a pure item↔tag
  junction, no `supplier_org_id`, so the `supplier_` prefix was misleading. The `tag` vocabulary
  (`category_id`, `dimension`, `label`; → `tags`) stays under Taxonomy as the weak-classification layer.
- **`favourites` → `org_favourites`.** It's org transactional data (`org_id, type, ref_id` saved-list), not
  config — moved under Org and renamed to the owner-prefix convention. Spelling parked to FR-00229.
- **`catalogue_extract_job` → `item_extract_jobs`.** The extractor's job ledger (org_id, status, plan/results/
  gaps jsonb, token spend; 30 rows) sits under Item. Renamed to the convention (singular owner prefix + plural
  child, like `project_items`) and to name its output (items) not its source. Spelling parked to FR-00229.
- **Read-views / write-tables (ADR-0002).** Reads via `security_invoker` views (curated order + overlay/joins),
  writes to base tables via services, no `INSTEAD OF` triggers. Column order is cosmetic (reference by name);
  the view layer earns its place on security + contract + computed logic.

## Where we are

- **Locked ✅:** principles (freeze+overlay, currency, org-#1, ADR-0002) · **Line** cluster · **Engagement**
  (`project_providers`) · **Messaging** (`messages`/`message_reads`/`message_relations`/`message_events`) +
  approvals/conversations · **`items`** · **`categories`** + **`shared.feedback_categories`** · full table
  inventory + decision log.
- **Resume here (review queue):**
  1. **Project core** — `projects` / `project_categories` / `project_settings` (the spine; facts/buyer/cover
     walked early but never column-locked).
  2. **Document** — `project_documents` (SOW/Quote; TODO design — biggest unknown).
  3. **User** — `users` / `user_orgs`.
  4. Small: `org_credits` / `org_favourites` fields, `org_type_config` / `bp_brand_config`, `coachmarks`,
     `item_extract_jobs`, `orgs_public` → `security_invoker`.
  5. Cross-cutting: send paths B/C/D · `org_id` on project children (denormalize vs derive).
- **Owed data culls** (DB-CLEANUP-CHECKLIST): evict 17 `categories` feedback residue rows; the legacy-table culls.
