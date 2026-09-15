# pV2-CUSTOMS-01 — Custom line items in the pure-clone shape

**Pairs with pV2-UNIFY-01.** Preferably ships in the same PR as UNIFY-01, or as an immediate follow-on. The two prompts share the data-model surgery and rewiring both at once keeps commits clean.

## Why

Today's "Add Your Own Line Item" dialog in the Final Quote is session-only — the custom line never persists, never rides the send, and never becomes real. Meanwhile v1 had a placeholder-item pattern (agency-owned `items` row, `is_active=false`, briefed, `maybeForkCatalogueItem` on quote) — but UNIFY-01 removed the auto-fork and the placeholder shape reads increasingly awkwardly as `project_items` becomes the honest single line-state table.

Right shape for the post-UNIFY world: **custom lines are pure `project_items` rows with `item_id = NULL`**. No ghost `items` row. All the line's data (name, description, price, unit, install_cost, install_unit) lives directly on `project_items`.

## Target state — one shape, one row per line

**Custom line = `project_items` row with:**

- `item_id = NULL` (the signal: this line has no catalogue backing)
- `org_id = <agency_org_id>` (project owner, same as any project line)
- `supplier_org_id = <asked supplier>` (per UNIFY-01's per-supplier row model)
- All display / negotiation fields populated directly on the row: `name`, `description`, `install_description`, `unit`, `base_price`, `install_cost`, `install_unit`, `quantity`, `installed`
- Standard UNIFY-01 negotiation columns: `status`, `price_ref`, `price_current`, `decline_reason`

**No `items` row is created.** No agency-owned placeholder. No `is_active=false` ghost.

## Rendering rule

**"Line's supplier" derivation:**

- If `project_items.item_id IS NOT NULL` → derive supplier from `items.org_id` via the link (catalogue-derived line, existing behaviour)
- If `project_items.item_id IS NULL` → line has no supplier; UI renders `"Custom"` (or a neutral label — see naming decision below) in place of the supplier chip

Consistent across Cart, Project Quote rail, Final Quote, and Inbox — same rule, four surfaces.

**Naming decision needed (bikeshed):** the neutral label for a custom line where a supplier would normally appear — options: `Custom`, `Ad-hoc`, `Awaiting supplier`, `Requested`. Recommend `Custom` unless Liam has a preference. CC just needs a token.

## Send-path rewire — key off category, not `item_id`

Today's `sendOutreach` / `requestQuotes` fan out per `(item_id, supplier)`. Rewire to fan out per **`(category_id, supplier)`** for **every** line — catalogue-derived AND custom.

- For catalogue-derived lines: `category_id` comes from the joined `items` row (unchanged effect)
- For custom lines: `category_id` comes from a new column on `project_items` — see schema below

This is a small unification, not two paths. One send path, one fan-out formula, works uniformly. CC previously called this a "small rewire" — it becomes the natural shape post-UNIFY-01.

## Schema — additive

Two nullable columns added to `project_items`:

| Column | Type | Purpose |
|---|---|---|
| `category_id` | `UUID REFERENCES categories(id) NULL` | The category this line belongs to. For catalogue-derived lines: mirror of `items.category_id` at snapshot time (protects against catalogue re-categorisation). For custom lines: agent picks in the Add Custom Line dialog. |
| `is_custom` | `BOOLEAN NOT NULL DEFAULT false` | Marker for custom lines. Equivalent to `item_id IS NULL` for query convenience; explicit column reads better in code + audits. |

Both applied to public / preview / master schemas per convention. Additive only — no data migration needed (dev mode).

Optionally, the existing name/description/unit/etc. columns on `project_items` become the display source for ALL lines (not just custom) — the snapshot is already there per v1.65fA. This prompt doesn't change that.

## Consumer changes — small

- **Add Custom Line dialog** — wire to a real endpoint (was session-only). POST `/api/projects-v2/:id/items` with `is_custom = true`, `category_id`, `name`, `description`, `base_price`, `unit`, `install_cost`, `install_unit`, `quantity`, `installed`. Server derives `org_id` from JWT (agency); `supplier_org_id` left NULL until Send fans out.
- **Send handler** — swap the per-`item_id` fan-out for per-`category_id`. For each `(category_id, picked_supplier)` in the outbox scope, materialise a `project_items` row per line in that category with `supplier_org_id` set. Custom lines and catalogue lines flow through identically.
- **Supplier derivation in read paths** — everywhere that reads "the line's supplier" from `items.org_id` via `item_id`, add the `item_id IS NULL → "Custom"` branch. Grep: `items.org_id` reads following `project_items.item_id` joins. Should be a small handful of touch points post-UNIFY-01.
- **Item-preview / description sync** — currently these fields derive from catalogue `items` for display. Post-CUSTOMS-01 they should read from `project_items` directly (snapshot already there). Same as UNIFY-01's direction; just applies uniformly to customs too.
- **Fork-on-quote** — none. Custom lines stay pure-clone. Supplier promotion of a quoted custom line to their catalogue becomes a separate deliberate action (not in scope; queued as a future `promote-to-catalogue` feature).

## Locked design decisions

1. **`item_id = NULL` means "no catalogue backing"** — the only correct read. No ghost `items` rows, no placeholder ownership, no is_active=false hidden entries.
2. **`category_id` becomes a first-class column on `project_items`** — needed by the send path anyway, and it's the honest place for it (a line belongs to a category regardless of whether it links to a catalogue item).
3. **Send path fans out per `(category_id, supplier)` uniformly** — single formula for catalogue-derived and custom lines. Not two branches.
4. **No fork-on-quote for customs.** Custom line stays `item_id = NULL` even after being quoted and accepted. Promotion to a supplier's catalogue is a separate future action, not automatic.
5. **Custom line's data lives on `project_items`, always.** No fetching from `items` at read time for these lines — the join returns NULL and the row's own columns are authoritative.

## Reuse claim

- **Data model:** two additive nullable columns on `project_items`. Zero data migration (dev mode).
- **Server services:** the send handler gets a small unification (per-item → per-category fan-out), same shape it takes on post-UNIFY-01. Item-create endpoint accepts `is_custom + category_id` in addition to the existing fields.
- **UI:** Add Custom Line dialog wires to a real endpoint but keeps its existing form. Cart / Final / Inbox render custom lines via the same components + the null-safe supplier branch — no new components.

## Out of scope

- Promoting a quoted custom line into the accepting supplier's catalogue (future `promote-to-catalogue` feature).
- Any changes to the Message Suppliers dialog (custom lines just appear as rows in their category alongside catalogue lines).
- Renaming the "Custom" label to something else after CC picks a default — bikeshed, defer to Liam if he wants a change.
- Any changes to CART-01's read-only-after-sent guard behaviour — applies to custom lines identically (once `status !== 'to_send'`, line locks).
- Cross-project custom-item reuse ("save this as a template") — future.

## Build order

1. **Schema** — add `category_id` + `is_custom` columns on `project_items`. Idempotent across three schemas.
2. **Item-create endpoint** — accept `is_custom + category_id + description + unit + install_*` fields on POST `/api/projects-v2/:id/items`. Server sets `org_id` from JWT, `supplier_org_id = NULL` until send.
3. **Send handler rewire** — swap per-`item_id` fan-out for per-`category_id`. Verify catalogue-derived lines still flow identically (regression check).
4. **Read-path supplier derivation** — grep `items.org_id` reads that follow `project_items.item_id`; add null-safe branch returning `"Custom"` label. Cart / Final / Inbox / Message Suppliers dialog all touch points.
5. **Add Custom Line dialog rewire** — swap session-only signal write for the real POST. Existing form; new plumbing.
6. **Sanity sweep** — send a custom line through the full flow: add → appears in Cart → send fans out with catalogue lines → inbox shows custom + normal side-by-side → supplier accepts → status transitions correctly → line renders in Final Quote at agreed price × qty.

## Doc updates in the same ship

- **PROJECTS.md** — Cart / Final Quote sections extend to mention custom lines (previously session-only; now persistent). Message Suppliers dialog behaviour note: custom lines fan out per category alongside catalogue lines.
- **ITEMS.md** — new section: "Custom project lines" — brief note that `project_items` can have `item_id IS NULL` for customs, with all data on the row.
- **AUDIT_LEDGER.md** — RP-04 stays open (nothing new); note CUSTOMS-01 uses the pure-clone shape, no placeholder pattern.

## Green light

Custom lines become pure `project_items` rows with `item_id = NULL`. No ghost `items` rows. Send path unifies to `(category_id, supplier)` fan-out for every line. Ships with or immediately after UNIFY-01.
