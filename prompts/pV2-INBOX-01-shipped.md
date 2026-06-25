# pV2-INBOX-01 — v2 Inbox foundation (gated façade + supplier-first UI)

Canonical brief: `docs/pV2-INBOX-01-PROMPT.md`. Built in QC-able slices
(Liam's call, 2026-06-25) — supplier flow first, Liam QCs each slice
visually before the next lands.

---

## Slice 1 — supplier entry: `/projects?bucket=quoting`

**Shipped:** 2026-06-25, chip `[Dev v2] v2.34v`

### What landed
- New gated **`/api/inbox/*`** façade (mounted on the v2 router → inherits
  `authenticate` + `requireActiveMembership`; org from JWT, RP-INB1). First
  endpoint: `GET /api/inbox/projects` — the caller-supplier's quote-request
  projects (projects an agency has messaged them about), shaped as the
  existing `ProjectCard`.
- The supplier sees those projects on the **existing** `/projects` screen
  (Defer 1 — reuse the agency card grid, no bespoke supplier card yet).
  `ProjectsPageComponent` is now viewer-aware: supplier → inbox feed, no
  status tabs, "Quoting" hero; agency → unchanged.
- Each supplier card drills into **`/inbox/:projectId`** (placeholder route
  for now — the real 2-col surface is the next slice).

### Files touched
| File | Notes |
|---|---|
| server/src/services/inbox.service.js | NEW — `listSupplierProjects(orgId)`; one grouped query → ProjectCard[] |
| server/src/routes/inbox.js | NEW — `GET /projects`, org from `req.user` only |
| server/src/index.js | mount `v2.use('/inbox', …)` |
| client-v2/src/app/core/inbox/inbox.service.ts | NEW — `supplierProjects()` |
| client-v2/src/app/pages/projects/projects-page.component.ts | viewer-aware source/title/tabs/empty-copy |
| client-v2/src/app/pages/projects/project-card.component.ts | `linkBase` input (default `/projects`) |
| client-v2/src/app/app.routes.ts | `inbox/:projectId` placeholder route |
| client-v2/src/environments/environment.ts | chip → v2.34v |

### Acceptance
- Supplier on `/projects?bucket=quoting` → their quote-request projects
  (verified against live DB: 7 projects for a sample supplier, each with
  the reaching-out agency + item count + quote total). ✓
- org scoping is JWT-only — no `?supplier_org_id` trust (RP-INB1 closed for
  this endpoint). ✓
- Agency `/projects` unchanged. ✓
- v2 build clean. ✓

### API audit — `GET /api/inbox/projects`
- Method semantics: read-only GET ✓
- Input validation: no params — org from JWT ✓
- Authorization: gated router (authenticate + active membership); scoped to
  `req.user.org_id` as supplier_org_id ✓
- Status codes: 200 / (401·403 from middleware) ✓
- Info disclosure: returns only the caller's own quote-request projects ✓
- Performance: single grouped query; N≈small per supplier ✓

### Concerns not in spec
#### Card meta mislabel for suppliers
**Where:** server/src/services/inbox.service.js `toSupplierProjectCard`
**What:** the agency `ProjectCard` renders one meta line as "{n} suppliers".
For the supplier view that field carries the count of THEIR quoted items, so
it reads "4 suppliers" when it means "4 items". The reaching-out agency is
mapped onto the cover client-chip (correct), and the headline total is the
supplier's running quote value.
**Suggested fix:** parameterise the card's meta label (`itemCount` vs
`supplierCount`) OR wait for the bespoke supplier card (Defer 1). **Needs a
Liam call — flagged for QC.**
**Severity:** LOW (cosmetic)

#### Supplier live/completed buckets not filtered
**Where:** projects-page.component.ts `visible()`
**What:** the supplier feed is the full quote-request set regardless of
`?bucket=`; the Live/Completed hub tiles show the same list (only the hero
title changes). Quoting is the meaningful bucket for now.
**Suggested fix:** add supplier-side status bucketing in a later slice.
**Severity:** LOW

---

## Slice A — supplier conversation surface (read-only)

**Shipped:** 2026-06-25, chip `[Dev v2] v2.35g`

### What landed
- **`GET /api/inbox/projects/:projectId/threads`** — the caller-supplier's
  conversation threads for a project (one per category), each with the
  counterparty agency, the brief's items (per-item status/price), the
  aggregate status + total, and the message bubbles (mapped to the
  supplier's POV — agency = incoming, theirs = outgoing). org from JWT
  (RP-INB1); reuses `getAllForSupplier` + `getByMessage` + `aggregateStatus`.
- **`/inbox/:projectId`** is now the real **2-col surface** (was the
  ComingSoon placeholder): left rail = their items (category-grouped only
  when >1 — the single-category collapse rule), right pane = the
  conversation with the agency (counterparty · project · status · total
  header, gradient/white bubbles via `--bp-gradient`, a disabled compose
  bar). Item status pills via the `message_item_status` codelist.
- Verified the reader against live data: a supplier's Catering thread →
  Woodland Agency, 5 items (accepted/adjusted/declined), 4 bubbles.

### Files touched
| File | Notes |
|---|---|
| server/src/services/inbox.service.js | `getSupplierThreads` + bubble/item mappers |
| server/src/routes/inbox.js | `GET /projects/:projectId/threads` |
| client-v2/.../core/inbox/inbox.service.ts | `supplierThreads` + thread types |
| client-v2/.../pages/inbox/inbox-project.component.ts | NEW — the 2-col surface |
| client-v2/src/app/app.routes.ts | wire `/inbox/:projectId` → real component |
| client-v2/src/app/app.config.ts | register `Paperclip` icon |
| client-v2/src/environments/environment.ts | chip → v2.35g |

### Concerns not in spec
#### Status-pill meta still un-enriched (grey item pills)
**What:** `message_item_status` codelist values carry label + semantic but no
`color`/`icon`, so item pills render neutral grey. Functional, not pretty —
the meta enrichment (semantic → token colour + lucide icon) is a planned
follow-up. **Severity:** LOW

#### Agent hitting /inbox/:projectId sees an empty thread list
**What:** the endpoint is supplier-scoped (`getAllForSupplier`). An agency
caller gets no threads (their org isn't a `supplier_org_id`). The agent
inbox surface (supplier-cards tree) is a separate, later piece.
**Severity:** LOW

## QC notes
(Liam)

## Chat audit
(chat)
