# Projects (`/projects`)

One-pager. The project entity is where everything in the platform
converges — items get added to project quotes, suppliers serve projects,
costs are estimated against projects, agencies deliver projects. This
doc covers the list surface (`/projects`), the inside-project surface
(`/projects/:id` with its three tabs), and the Add Project flow (which
has an AI-recommendation branch).

Reference designs: `screenshots/add-project-1.png` (brief upload/write),
`screenshots/add-project-2.png` (AI result — "Your ballpark is ready"),
`screenshots/add-project-3.png` (inside-project marketplace + Project Quote rail),
plus `docs/bp-cards.docx` image 8 for the project card archetype.

## What it is

Projects = the user's work unit. An agency runs many projects in parallel;
each project has a brief, an estimate, suppliers, items, status. The
projects arc closes the marketplace's value loop — items finally have
somewhere to be quoted to.

Three surfaces:

1. **List view** (`/projects`) — Current | Completed tabs, project cards in a grid
2. **Inside-project view** (`/projects/:id`) — three tabs (Marketplace / Estimate / Project Details)
3. **Add Project flow** (`/projects/new`) — page-based wizard with an AI-recommendation branch

## Why we needed it

The marketplace closed without somewhere to *put* the items being
browsed. pV2-06f (Quote + checkout) was deliberately deferred to projects
arc because Quote needs a project entity to anchor against. Projects also
unblocks:

- `project_status` codelist getting its `consumer_table` + `consumer_column` pointer (deferred from CODELISTS-01)
- `<app-project-card>` consuming the locked card primitive layer (CARDS.md image 8)
- The inside-project marketplace re-using the catalogue engine with project scope (RP-06 architectural pattern continues — same engine, third mount context)
- AI-driven project estimation as a real product surface

## Who can use it

| Role | View list | Create project | Edit project | Add items to quote | Checkout |
|---|---|---|---|---|---|
| `agency_admin` | ✓ org's projects | ✓ | ✓ | ✓ | ✓ |
| `agency_member` | ✓ org's projects | ✓ | ✓ (own + assigned) | ✓ | ✓ |
| `supplier_admin` | — (suppliers don't have projects in v2) | — | — | — | — |
| `supplier_member` | — | — | — | — | — |
| `ballpark_admin` | ✓ cross-org via `admin.cross_org_view` | — | ✓ for support | — | — |

Permission key: `project.create` (lands with this arc; not yet in the matrix). Agency-side only; suppliers receive project invites but don't own projects.

## Layout — list view (`/projects`)

```
[ <app-page-hero> "Projects" / subtitle / Current | Completed tab band ]
[ project-card grid (responsive 3-up at xl, 2-up at md, 1-up at sm) ]
```

Reuses `<app-catalogue-layout>` shell pattern from marketplace
(viewport-fit, sticky hero, independent column scroll) but **drops the
left rail and right rail** — projects don't need category navigation or
preview at the list level. Middle grid takes full width.

**Card archetype** — per `bp-cards.docx` image 8:

| Element | Class | Notes |
|---|---|---|
| Cover image | `.bp-card__img` | Project's hero image (configurable) |
| Brand chip overlay | `.bp-tag-chip` | Optional — supplier brand or event type (e.g. "Nike") |
| Reference eyebrow | `.bp-ref-eyebrow` | "WA-026" style project reference |
| Title | (default text-md font-semibold, 2-line clamp) | Project name |
| Status pill | `<app-status-pill list="project_status" [code]="project.status" />` | Codelist-driven (Draft/Active/Completed/Archived) |
| Meta row | `.bp-meta` | Suppliers count, age ("3 days ago") |
| Ballpark price | `.bp-price-large` | "£X Ballpark" — accent gradient text |

All chrome via `.bp-card` foundation; zero per-component CSS (RP-07 enforced).

## Layout — inside-project view (`/projects/:id`)

**Five tabs anchored to the project entity (as-shipped):**

| Tab | What it shows | URL state | Implementation |
|---|---|---|---|
| **Marketplace** | Global marketplace scoped to project — click cards to add to Cart | `?tab=marketplace` | `<app-catalogue-layout>` third consumer |
| **Cart** (formerly Estimate for pre-send) | Editable quote — only lines with `status = 'to_send'`. Qty, install checkbox, remove | `?tab=estimate&scope=cart` | `<app-project-estimate view="cart">` |
| **Final Quote** | Full send-ready view — all lines with status badges (To send / Out for quote / Quoted / Booked / Declined), plus custom ad-hoc lines | `?tab=final` | Same `<app-project-estimate view="final">` |
| **Inbox** (new v2.34v) | Supplier conversations for this project — item-tagged messages, per-item action chips | `?tab=inbox` | `<app-inbox-project>` — see INBOX.md |
| **Project Details** | Project metadata — name, dates, budget range, location, brief | `?tab=details` | `<app-edit-section>` + `<app-edit-field>` |

**One component, two views.** Cart and Final Quote are the **same** `<app-project-estimate>` component driven by a `view` input (`'cart' | 'final'`). Cart filters to `to_send`-only lines; Final shows all lines with status badges. The unified component avoids the RP-06 trap of two consumers of the same engine drifting.

**The eventLabel is everywhere user-visible.** "Project" / "Event" / "Job" — whatever the org chose in `/settings/pages`. Hero, tabs, card labels, dialogs, button text — all configurable. No hardcoded "Project" strings in component templates.

### Cart tab (`view="cart"`)

Rendered as a bespoke list layout — **not** `<app-item-card>` — because quote lines carry per-line editable qty + install choice + supplier band, which the item card can't express. Lines are grouped by supplier with a thin "Supplier · City" band above each group.

Per-line controls: **quantity** (number input), **install checkbox** (when the item has an `install_cost`), **delete** (trash icon). All three lock when `status !== 'to_send'` — see "Read-only after sent" below.

### Final Quote tab (`view="final"`, v2.36i / FINAL-01)

Send-ready view showing every line (Cart + already-sent) with status badges. Adds two things Cart doesn't have:

- **Custom lines.** Agent can add ad-hoc lines (category / description / cost / qty / install-or-deliverable type) via a modal. Rendered in the totals but **stored in-session only** — not persisted to `project_items`. Reload loses them. Flagged as intentional today; persist column when the customer asks.
- **Status badges per line.** `to_send`, `out_for_quote`, `quoted`, `booked`, `declined` — decoded from `message_items` join. **RP-04 open:** `STATUS_LABELS` hardcoded in `project-estimate.component.ts:41-46` — move to codelist lookup on next touch.

### Install choice & install basis (v2.38+)

Every quote line with an `install_cost > 0` gets an **install checkbox**. Three states:

- `installed: null` (default) — assume-on when `install_cost > 0`
- `installed: true` — explicit on
- `installed: false` — explicit off (line is deliverable-only)

Persistence: **new column `project_items.installed BOOLEAN NULL`** (migration in `server/src/db/migrate-schemas.js:2015-2019`, three schemas).

**Install basis** — how `install_cost` applies to a line — driven by `items.install_unit` (per-item / per-order / percentage; see STORE.md Fields table). The ONE formula lives in `server/src/services/line-total.util.js` (`lineTotalSql(priceExpr)`), price-parametrised (pV2-UNIFY-01) so every surface shares it:

```
price × qty + CASE install_unit
  WHEN 'per_order'  THEN install_cost
  WHEN 'percentage' THEN price × qty × (install_cost / 100)
  ELSE                    install_cost × qty  (per_item default)
END
```

- Estimate / Cart / Final Quote bind `price = base_price` (`LINE_TOTAL_SQL` in `projects.service.js`).
- Inbox "Original" binds `price = price_ref`; "Revised" binds `price = price_current`.

Client mirrors this in `lineCost()` for display only — the server SUM is the source of truth. No math-in-two-places.

**Negotiation state on the line (pV2-UNIFY-01, 2026-07-08).** `project_items` is the single line-state table — beyond the cart columns (qty / base_price / installed / unit / name / description) it carries the negotiation projection: `status` (the 9 v1 codes: brief_sent / quoted / accepted / holding / adjusted_by_* / declined_by_* / booked), `price_ref` (briefed per-unit), `price_current` (negotiated per-unit), `decline_reason`, plus `deleted_at` (soft-delete cart removal). `message_items` is a stripped tag join now (`message_id + project_item_id`). Send-state (cart vs out-for-quote) is `project_items.status` (NULL = still in cart). Columns added in `migrate-schemas.js` (pV2-UNIFY-01 block, three schemas).

### Read-only after sent

Once an item leaves the Cart (`project_items.status IS NOT NULL` — pV2-UNIFY-01), the quote line becomes locked in the UI and on the server:

- **Server guard** — `isItemSent()` in `projects.service.js` (checks `project_items.status`). PATCH / DELETE return `409 Conflict` + "Item is out for quote — change it in the inbox."
- **UI lock** — qty input disabled, install checkbox disabled, delete hidden, lock icon shown (`project-estimate.component.ts:281-293`).

Changes to sent items happen through the inbox thread (accept new cost, propose adjustment), never through the Cart. This is the seam between the two surfaces: Cart owns intent, Inbox owns negotiation.

### Message Suppliers dialog

Triggered from Final Quote's "Message Suppliers" CTA. `<app-message-suppliers-dialog>` — a category/supplier grid with a primary-picker per category + a "get competing quotes from other suppliers" toggle. Fans out one thread per (category × picked supplier); reuses v1's `TaxonomyService.requestQuotes` writes.

### Single-source Ballpark cascade (v2.37)

The `Estimated Ballpark Cost` on project cards and the totals in Cart/Final all come from **one server compute** — `computeEstimate()` in `server/src/services/estimate.js`. Both consumers call the same endpoint and render what comes back; the client never re-does the math. Formula: `subtotal → +contingency% → ourCost → +margin% → preVat → +VAT% → clientTotal`.

**Behemoth ALARM** — `project-estimate.component.ts` shipped at 806 lines (threshold 400). Cart + Final + custom-lines modal + install toggle + Message Suppliers integration in one file. Extract the custom-line modal on next touch; consider `<app-cart-view>` / `<app-final-view>` splits if the file grows further.

**The eventLabel is everywhere user-visible.** "Project" / "Event" / "Job" — whatever the org chose in `/settings/pages`. Hero, tabs, card labels, dialogs, button text — all configurable. No hardcoded "Project" strings in component templates.

### Marketplace tab — the inside-project variant

**Functionally identical to the global `/marketplace` browse — same engine, same cards, same chrome.** The only difference is what the right rail shows:

- **Same engine** — `<app-catalogue-layout>` + `<app-catalogue-grid>` + `<app-item-card>` (RP-06 architectural inheritance — third surface; the rail-drop-in-card-view + narrow-left-rail decisions were partly designed-forward for this)
- **Right rail = Project Quote (pinned to Quote mode)** — a compact preview of the current Cart lines. Tap "See Final Project Quote" to switch to the Final Quote tab. See §Cart tab / §Final Quote tab above for the editable surfaces.
- **Card chrome unchanged** — same + icon overlay with "Add to Quote" tooltip. Tapping adds the item to THIS project's Cart.
- **Category rail unchanged** — same `<app-category-strip>`

## Layout — Add Project flow (`/projects/new`)

Replaces the v1 dialog with a multi-page wizard. Two branches based on
the user's first choice:

```
/projects/new
  ↓
[ "Add a project. Want AI recommendations?" ]
  ↓ YES                                    ↓ NO
[ Upload Brief / Write Brief ]      [ Skip to marketplace browse ]
        (screenshot 1)                       (lands /projects/:id?tab=marketplace
        ↓                                     with empty quote)
[ AI processes → "Your ballpark is ready" ]
        (screenshot 2)
        ↓
[ Go with this ballpark    OR    Edit in marketplace ]
        ↓                                ↓
[ Accept estimate → project created ]   [ /projects/:id?tab=marketplace ]
```

### Page — Upload or Write Brief (screenshot 1)

Single page, two large input cards side by side:

- **Upload Brief** — PDF / Word / presentation drop zone; "Drop files here or click to browse"
- **Write Brief** — text area for manual brief entry

Reuses `.bp-card` chrome. The card icons (upload / document) use `.bp-icon-block` soft-pastel treatment. User picks one input mode, submits, navigates to the AI result page.

### Page — "Your ballpark is ready" (screenshot 2)

Single page showing the AI's estimated project. Two regions:

**Top — project summary:**
- Page hero: "Your ballpark is ready" + project name pill ("Summer Retail Pop-Up Launch")
- Four small info cards: Date / Location / Timeline / Budget range
- **Big gradient banner**: "Estimated Ballpark Cost" → "£79,000 - £117,000" (brand `--bp-gradient` earns its scarcity here)

**Bottom — accordion of cats with item cards:**
- One accordion row per AI-suggested category (AV / Set Build / Graphics / Lighting / Staffing / Logistics)
- Each row collapsed shows category name + cost range
- **Expanding a row reveals the AI-suggested items** for that category — rendered as `<app-item-card>` reused from marketplace (no new component)
- User can remove items, swap items, or accept as-is

**Below the accordion:**
- Disclaimer: "This is an indicative starting point based on marketplace data. Final supplier quotes may vary."
- Two CTAs: "Go with this ballpark" (gradient brand-CTA) + "Edit in marketplace" (outline)

**Reference for the accordion behavior**: v1's old "build" screen had this expand-to-edit pattern. Worth grepping the v1 git history for the deleted component when implementing.

**No new components.** Summary block reuses existing chrome (info cards = `.bp-card` with `.bp-icon-block`); gradient banner is just styled markup; accordion is a thin wrapper that pulls in `<app-item-card>` for the expanded content.

### Skip-AI branch

If user declines AI recommendations on the entry page, they land directly in the inside-project marketplace with an empty Project Quote. Simpler path, human-driven discovery. The AI accordion page doesn't render.

## v1 → v2 mapping

| v1 file | v2 treatment |
|---|---|
| `features/projects/projects-list.component.ts` (or equivalent) | Rebuild as `<app-projects-page>` per v2 standards (signals, resource, role classes, host: binding). Same shape; v2 chrome. |
| `features/projects/project-detail.component.ts` | Rebuild as `<app-project-detail>` with three-tab `<app-tab-band>` host. Marketplace tab REUSES `<app-catalogue-layout>` with project scope (architecturally similar to supplier-detail's Store tab pattern). |
| v1 Add Project dialog | **Replaced** by `/projects/new` page-based wizard. Multi-step flow; AI-recommendation branch is net new. |
| `features/projects/.../marketplace.tab.component.ts` (the project-marketplace bridge from v1) | Marketplace engine ports cleanly via `<app-catalogue-layout>` mounted with project scope. RP-06 architectural pattern — third surface inheriting the engine. |
| v1 estimate / cart components | Project Quote rail in v2 is a `RailMode` variant on the existing catalogue-layout right-rail polymorphism. Quote chrome reuses `.bp-card`. |
| AI brief parser (v1.x?) | Server-side — likely an LLM call against the brief content + catalogue data. Server endpoint contract land with pV2-PROJECTS-03. |

## Prompt arc

CC locked the order in this conversation. Each prompt is a separate
ship; end-of-module audit after the arc closes.

| Prompt | Scope | Status |
|---|---|---|
| **pV2-PROJECTS-01** | List view at `/projects` — Current | Completed tabs + project card grid + status pill wiring + `project_status` codelist consumer pointer | **SHIPPED** v2.22a/b (`0812b05`/`39afb99`) — see pV2-PROJECTS-01-shipped.md |
| **pV2-PROJECTS-02** | Inside-project view at `/projects/:id` — three tabs (Marketplace / Estimate / Project Details) + Marketplace tab's project-scoped catalogue + Project Quote right rail (RailMode gains 'quote' pinned state). Cards unchanged from CARDS-01. | queued |
| **pV2-PROJECTS-03** | Add Project flow — `/projects/new` entry page (Upload Brief / Write Brief / Skip AI), `/projects/new/ai-result` accordion page ("Your ballpark is ready" — biggest design lift; v1's old build screen is the reference), AI brief parser server endpoint | **PARTIAL** — scoped spine SHIPPED v2.23a/b (`072c8eb`/`2da7e3d`): brief→AI→project create, NO items. "Ballpark is ready" accordion (add-project-2.png) + Skip-AI branch still queued. See pV2-PROJECTS-03-shipped.md |
| **pV2-06f** | Quote arc — `QuoteService`, "Add to Quote" / "Added to Quote" CTA wiring inside the project context, "See Final Project Quote" → `/quote-checkout/:projectId` flow | queued after PROJECTS-02 |

## What's deferred from this arc

- **Real-time collaboration on a project** (multiple agency members editing simultaneously) — single-user editing per project for v1 parity
- **Project templates** (clone an existing project) — possible follow-up
- **Project archive UI** (archived projects management) — Archived status exists in codelist; UI for managing archived projects is a future surface
- **Supplier-side project view** — suppliers see invites + items in the inbox arc, not via the projects surface
- **Inbox per project** (per-project comment threads) — lands with inbox arc, separate from projects

## Locked architectural decisions for this arc

These were settled across the marketplace + cards arcs; carry forward into projects:

1. **One cart (Project Quote) per project** — not per-category. The right rail in the inside-project marketplace shows ONE quote, not N category sub-quotes. (Settled with Liam early in marketplace planning; this is the simpler model that v2 adopted vs v1's per-category carts.)
2. **Cart lives in the right-rail preview column** — when inside a project's Marketplace tab. Same column slot the polymorphic preview uses in global marketplace; here it's pinned to Quote mode always.
3. **eventLabel everywhere user-visible** — no hardcoded "Project" strings. Pulls from PageConfig.
4. **Status via codelist** — `project_status` codelist drives the pill + valid transitions (`meta.allowed_next_codes` — enforcement deferred until first writer; data is seeded).
5. **AI gradient banner = the brand mark moment** — the gradient earns its scarcity. Inside-project marketplace also uses gradient for "Add to Quote" because the entire surface IS the quote-building action.

## Audit reference

See `docs/AUDIT_LEDGER.md` for the per-file audit state. Empty until
PROJECTS-01 ships.

## Version history

### Summary — skimmable status

| Version | Date | What changed (1-line) | Ship | QC Done? | Audit Done? |
|---|---|---|---|---|---|
| v2.22a/b | 2026-06-13 | **pV2-PROJECTS-01** — `/projects` list + Current/Completed tabs + project card (image 8) + `projects.status` dual-model + `project_status` consumer pointer | dev | pending | pending |
| target | TBD post-01 | **pV2-PROJECTS-02** — `/projects/:id` inside-project view with three tabs + project-scoped marketplace + Project Quote rail + item-card mode variant | — | — | — |
| target | TBD post-02 | **pV2-PROJECTS-03** — `/projects/new` wizard + AI brief flow + "Your ballpark is ready" surface | — | — | — |
| target | TBD post-03 | **pV2-06f** — Quote service + checkout handoff | — | — | — |

### Detail — QC + Audit findings per version

(Empty — nothing shipped yet)

### Deferred — items pushed to a later prompt / arc

| Item | Deferred from | Why | Lands in |
|---|---|---|---|
| ~~`<app-item-card>` mode variant for inside-project quote chrome~~ | pV2-CARDS-01 | **Not needed.** Card chrome is unchanged between global + inside-project — same + icon overlay with "Add to Quote" tooltip works for both contexts. add-project-3.png shows a gradient labelled button but that screenshot predates the v2.20q decision. | killed |
| Real `<app-project-detail>` page | placeholder route in PROJECTS-01 | Click-target stub; full surface lands with three tabs | PROJECTS-02 |
| AI brief parser server endpoint | PROJECTS-03 | Net-new functionality; needs LLM provider decision + brief schema | PROJECTS-03 |
| Quote/checkout (`QuoteService`, `/quote-checkout/:projectId`) | PROJECTS-02 → 06f | Quote service infrastructure lives in 06f; the inside-project surface consumes it | pV2-06f |
| Per-project inbox / threads | inbox arc | Separate arc | inbox arc |

## When to update this doc

- New tab added to inside-project view → update Layout
- AI flow evolves → update Layout — Add Project flow
- Card mode variant emerges (new context for item-card chrome) → update inside-project Marketplace tab section
- Permission changes → update Who can use it
- Codelist consumer pointer wires up → update Locked architectural decisions

## Pairs with

- `docs/CARDS.md` — image 8 is the project card archetype; `<app-item-card>` mode variant is meaningful for inside-project rendering
- `docs/MARKETPLACE.md` — RP-06 architectural pattern continues; inside-project marketplace is the third engine consumer
- `docs/CODELISTS.md` — `project_status` consumer pointer wires up in PROJECTS-01
- `docs/PAGE_SETTINGS.md` — eventLabel everywhere is the configurable hook
- `docs/BUTTONS.md` — gradient scarcity rule: + icon globally, "Add to Quote" labelled inside-project (surface's primary action earns the gradient)
- `docs/DIALOGS.md` — toast feedback for project actions (created, status changed, deleted)
