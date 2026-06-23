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

Three tabs anchored to the project entity:

| Tab | What it shows | URL state | Implementation |
|---|---|---|---|
| **Marketplace** (default) | Same as global marketplace card view — right rail shows the project's cart | `?tab=marketplace` | Reuse marketplace engine; cart rail shows `<app-item-card>` in list-view |
| **Estimate** | The project's full quote/cost breakdown — line items, totals, supplier-by-supplier | `?tab=estimate` | Direct port of v1 estimate page |
| **Project Details** | Configurable project metadata — name, dates, budget range, location, brief text | `?tab=details` | Port v1 drawer to a page; reuses `<app-edit-section>` + `<app-edit-field>` from Profile (same locked edit-form pattern) |

**The eventLabel is everywhere user-visible.** "Project" / "Event" / "Job" — whatever the org chose in `/settings/pages`. Hero, tabs, card labels, dialogs, button text — all configurable. No hardcoded "Project" strings in component templates.

### Marketplace tab — the inside-project variant

**Functionally identical to the global `/marketplace` browse — same engine, same cards, same chrome.** The only difference is what the right rail shows:

- **Same engine** — `<app-catalogue-layout>` + `<app-catalogue-grid>` + `<app-item-card>` (RP-06 architectural inheritance — third surface; the rail-drop-in-card-view + narrow-left-rail decisions were partly designed-forward for this)
- **Right rail = Project Quote (pinned to Quote mode)** — shows the project's cart. **Cart contents render as `<app-item-card>` in list-view mode** (reuse, no new component). Plus "See Final Project Quote" gradient CTA at the bottom.
- **Card chrome unchanged** — same + icon overlay with "Add to Quote" tooltip. Tapping adds the item to THIS project's quote.
- **Category rail unchanged** — same `<app-category-strip>`

**Card chrome is UNCHANGED** between global marketplace and inside-project marketplace. Same `<app-item-card>` everywhere:

- Same image + title + chip + price + pin row
- Same **+ icon overlay** top-right (v2.20q) with "Add to Quote" tooltip on hover
- Same **heart icon** for Wishlist

The card-foot gradient "Add to Quote" button visible in the
`add-project-3.png` screenshot is **out-of-date** — it predates the v2.20q
decision to ditch the gradient foot CTA. The inside-project marketplace
uses the current cards as-is. One card chrome, two contexts, one
implementation.

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
