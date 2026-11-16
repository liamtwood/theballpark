# pV2-SOW-01 — Per-supplier Statement of Work: Stage 4 (DB document cluster)

**Shipped (DB slice):** 2026-11-13, chip `[Dev v2] v2.1171` · branch `rebuild/org-slice`
**Status:** Schema + RLS + coverage test landed on `ballpark-v2-dev`. Server slice
(Phase 1) + client (Phase 2) still ahead — this file stacks iterations as they land.

## What landed (Stage 4 — the persistence layer)

The SOW is a **two-party (Agency ↔ Supplier, both Ballpark orgs) contract, generated
from the project, frozen at issue, signed in-app.** Stage 4 is the DB cluster it persists to.

- **Three tables** (`server/db/rebuild/0039_document_cluster.sql`), faithful to
  DATA-MODEL-REDESIGN §"Document cluster — LOCKED":
  - `project_documents` — the SOW object (one row per SOW; **multiple SOWs per
    (project × supplier)**, NO versioning — "current" = latest non-declined,
    non-superseded). Object base contract (ref/name/description), agency-owned
    `org_id`, `content`/`presentation`/`parties_snapshot`/`terms_snapshot` jsonb,
    structured `deposit_pct`, `supersedes_document_id` self-FK, status machine.
  - `project_document_lines` — the §3 item-set, **frozen onto the doc at issue**.
  - `project_document_signatures` — append-only two-party signature rows.
- **No versioning, multiple SOWs** (Liam's call). `supersedes_document_id` kept to
  distinguish his 3 lifecycle cases: (1) never executed → declined; (2) change order
  to a signed SOW → supersedes SET; (3) more-work SOW → supersedes NULL, independent.
- **`project_items.sow_document_id`** reinstated (additive nullable FK) — case 3 splits
  a supplier's agreed items across several live SOWs, so membership can't derive from
  "all agreed items"; the live link marks which SOW an item is on, freezes into lines at issue.
- **Status machine** `draft → ready_to_sign → supplier_signed → executed` (+ `declined`
  terminal) as a `sow_status` codelist (Pills, meta.color); `document_type` + `signatory_role`
  codelists seeded too. Freeze on **issue** (ready_to_sign), not create.

## Acquisition-grade RLS — the inbox bar (audit `docs/audits/2026-11-13-sow-document-cluster-rls-audit.md`)

Built every blocker the audit raised:

- **B1/B2 — gated SECURITY DEFINER write path.** Supplier has NO direct UPDATE/INSERT on
  `project_documents` or `_signatures`. `document_confirm` (engaged supplier, draft→ready_to_sign)
  and `document_sign` (both parties funnel through one path; sequencing enforced; signature row +
  status flip atomic; `signer_org_id`/`signer_user_id`/`signed_at` set **server-side from the
  session**) are the only write paths. `revoke all from public` + `grant execute to web_app_user`,
  `search_path` pinned.
- **B3 — post-sign freeze, DB-enforced.** `BEFORE UPDATE` trigger rejects any change to a
  contract-substance column (`content`/`deposit_pct`/`parties_snapshot`/`terms_snapshot`/`name`/
  `description`) once `status in (supplier_signed, executed)`, for both parties incl. the definers'
  owner writes (status/updated_* pass). Column-scoped — `presentation` stays editable (flagged for
  re-audit). Amend = new SOW (supersedes).
- **B4 — supersedes same-org/engagement guard.** `BEFORE INSERT OR UPDATE` trigger (SECURITY
  INVOKER): rejects self-supersede; a cross-tenant target is invisible under RLS → NOT FOUND →
  rejected; requires the target's `org_id` + `(project_id, project_provider_id)` to match. Closes the
  cross-tenant integrity hit (org B hiding org A's live SOW by pointing its supersedes at it).
- **S1 — append-only grants.** `project_document_signatures` + `project_document_lines` are
  `GRANT SELECT` only to `web_app_user`; the definers own the writes.
- **S2 — `deleted_at` on the three provider reads.** A soft-deleted SOW is hidden from the engaged
  supplier (agency `_all` still sees it to restore).

Admin-write escape left as-is per the audit's **F-ADMIN** (not a 0039 blocker — closes cluster-wide
in the one coordinated FR-00215 slice before launch, matching 0018/0020 siblings).

## Files touched
| File | Lines | Notes |
|---|---|---|
| `server/db/rebuild/0039_document_cluster.sql` | +~400 (new) | 3 tables, RLS, B1–B4 defs/triggers, S1/S2 grants, 3 codelist seeds, items/project_items ALTERs |
| `server/db/rebuild/tests/0039_document_cluster.test.js` | +~210 (new) | RLS/write-path coverage gate (S3), 22 assertions, rollback txn |

## Apply path
`ballpark-v2-dev` (`jwerngwvensmmhwrcgul`) has **no `public.schema_migrations` ledger** — the rebuild
slices here were applied via the Supabase MCP (owner), tracked in `supabase_migrations`. 0039 applied
the same way (idempotency guards folded into the on-disk file so a fresh env `run.js` build stays
re-run-safe and on-disk == applied). **Not** mirrored into the deprecated `migrate-schemas.js` — this
env is rebuild-only.

## Acceptance — coverage test 22 / 22 PASS (as `web_app_user`)
`NODE_PATH=server/node_modules node server/db/rebuild/tests/0039_document_cluster.test.js`
- Isolation: agency reads own; engaged supplier reads; **non-engaged supplier reads nothing**; S2 soft-delete hidden — ✓
- No direct write: supplier UPDATE doc / INSERT signature denied; agency INSERT signature + line denied (append-only) — ✓
- Definer sequence: non-engaged confirm rejected; sign-before-confirm rejected; confirm→ready_to_sign; agency-before-supplier rejected; supplier→supplier_signed (signer server-side); agency→executed; re-sign rejected — ✓
- Freeze (B3): frozen-column UPDATE after executed rejected; presentation UPDATE allowed (column-scoped) — ✓
- Supersedes (B4): cross-agency supersedes rejected; self-supersede rejected — ✓
- Lockdown: definers not PUBLIC-executable, search_path pinned — ✓

## Concerns not in spec

### Snapshot resolution + file access are service-layer gates (Phase 1)
**Where:** `project_documents.parties_snapshot` / `terms_snapshot`; `terms_pdf_url` (Annex A).
**What:** The migration commits to resolving parties/terms **server-side** at issue (via
`org_contact`/`supplier_directory` — own-org RLS zeroes cross-org, so the Angular layer can't reach the
supplier org), and to engagement-scoping the T&C PDF at the storage/signed-URL layer. Neither is DDL;
both are enforced in the service.
**Suggested fix:** Build in Phase 1; designer re-audits the service code (per the audit's service-layer section).
**Severity:** MEDIUM (acquisition-grade isolation depends on it; not yet exercised).

### `presentation` editable after sign
**Where:** B3 freeze trigger excludes `presentation`.
**What:** By design (pure display), but it means an executed SOW's header/footer/theme can still change.
**Suggested fix:** Confirm during the designer re-audit whether presentation should freeze too.
**Severity:** LOW.

## Iteration 2 — bidirectional SOW (supplier-authored direction), 2026-11-16

**Shipped (DB slice):** `server/db/rebuild/0040_document_cluster_supplier_direction.sql` · gate **31/31 PASS**.

Liam reframed the model: a **supplier** authors an SOW for the work they deliver (the agency
is the counterparty), as well as the already-built agency-authored SOW. Both now run on **one**
model:

- **`org_id` = the author.** supplier-authored ⇒ `org_id = supplier`; the agency reads via the
  engagement. Direction is just which side of the engagement equals `d.org_id`.
- **Signing rule, both directions:** the **counterparty signs first** on the unsigned draft (the
  freeze point), the **author counter-signs** → executed. **No separate `confirm` step** — the
  signature is the acceptance, the negotiation is the inbox. `document_confirm` retired;
  `supplier_signed` → `counterparty_signed`.
- **deposit_pct** falls out of ownership: on a supplier-owned doc only the supplier can set it
  (the agency is read-only), so "supplier sets the deposit" needs no special code. Agency docs
  stay agency-set.

### What changed in the DB (0040)
- **Unified counterparty-read** (one policy per table, replaces the built `*_provider_read` trio)
  — the engagement is **pinned** (`pp.id = d.project_provider_id`); without the pin a single A↔S
  engagement would leak every S-authored SOW to A across all shared projects (designer caught it).
- **Engagement guard** — a doc's `(project_id, provider_id)` must be a real engagement its owner
  is on, with `project_id = pp.project_id` pinned (stops misfiling onto another project).
- **Generalized freeze** — "frozen once any signature exists", **+ the binding columns**
  (`project_provider_id`/`project_id`/`org_id`/`supersedes_document_id`), so a signed doc can't be
  re-pointed onto another engagement and carry its signatures along.
- **One generalized `document_sign`** — derives the signing party from `(session, d.org_id,
  engagement)`, **never** branches auth on the client role string (confused-deputy); `p_role` is a
  validated label only.

### Designer sign-off
Conditional-approved 2026-11-16; every condition absorbed (engagement pin, project-id guard,
derive-the-party, party-type role, generalized freeze + binding columns). Designer reconciles
pV2-SOW-01 + the audit against this settled shape. **Phase-1 service re-audit still owed** when
that code lands (snapshot resolution + line materialization + engagement-scoped file access +
engagement-scoped SOW aggregation — readers filtering `org_id = :me` now miss counterparty-authored docs).

### Acceptance — gate 31/31 PASS (both directions)
`NODE_PATH=server/node_modules node server/db/rebuild/tests/0040_document_cluster_supplier_direction.test.js`
— cross-project isolation (the pin), counterparty-first/author-last both directions, role-spoof
rejection both directions, engagement guard (non-party + project-id misfile), re-point rejection,
freeze both directions, lockdown (`document_confirm` gone, `document_sign` not PUBLIC-exec +
search_path pinned). Supersedes the 0039 test (now a stub pointing here).

## Iteration 3 — Phase 1 server slice (SOW service + routes), 2026-11-16

**Shipped:** `server/src/services/sow.service.js` + `server/src/routes/sow.js`, mounted at
`/api/sow` on the v2 gated router. **No new DB changes.**

v1 is **content-authored** (Liam 2026-11-16): the party that owns the SOW authors the whole
thing — line items, prices, deposit, terms — into the doc's `content` (ordered sections). The
structured `project_document_lines` / catalogue-pull is deferred (it's the only piece that needs
cross-org line materialisation; v1 avoids it entirely). So three of the four Phase-1 re-audit
items the designer flagged — **snapshot resolution, line materialisation, engagement-scoped file
access — are NOT built in v1** (they ride the later "pull my agreed items in" enhancement). The
fourth, **engagement-scoped aggregation, is built to spec.**

Endpoints (all gated — `authenticate` + `requireActiveMembership`; org from the JWT, never the client):
- `POST /api/sow` — create a draft; the caller is the author (`org_id = caller`), the supplier
  party + project are derived from the engagement, the DB engagement guard backstops.
- `GET /api/sow?projectId=` — the SOWs on a project visible to the caller. **No `org_id` filter** —
  RLS (author `_all` + unified `counterparty_read`) defines the set, so the caller sees its own AND
  counterparty-authored SOWs on its engagements (an `org_id=:me` filter would drop most of them in
  the supplier-authored flow). *(the designer's headline)*
- `GET /api/sow/:id` — render payload: doc + party names (own org + the audited directory for the
  counterparty) + signatures + the 3% platform-fee flag.
- `PATCH /api/sow/:id` — edit a draft (author only — RLS gives the counterparty no write path; the
  freeze trigger → 409 once signed).
- `POST /api/sow/:id/sign` — the caller's `org_type` is the party role; `document_sign` re-derives +
  validates it. Counterparty first → `counterparty_signed`; author last → `executed`.

**No new security surface:** the service is a thin wrapper over the audited RLS + the gated
`document_sign` definer. The signing role is derived/validated in the DB, not trusted from the client.

### Acceptance
- Server loads + mounts clean (the gated route answers 401; no load/require errors).
- SQL-path smoke (the service's exact statements, as the real parties, as `web_app_user`, rolled
  back) — **11/11 PASS**: create draft (supplier-authored) → list (author sees it) → get → author
  edits → counterparty can't edit → agency signs → supplier countersigns → executed → post-sign
  freeze rejects an edit.

Pending: designer walk of the service (lighter than planned — three of the four re-audit items are
deferred); end-to-end authenticated HTTP verification lands with Phase 2 (the client exercises it);
no committed service-level test yet (the DB gate covers the RLS/definer; a service test needs the
app pool/ALS harness). FR/EP ref to mint at ship.

### Fix — S-READ: two-layer read isolation (designer audit 775386df)
The reads (`listForProject`, `getById`) originally leaned on RLS alone. Added the app-layer party
predicate (mirroring `counterparty_read`: author OR a party to the doc's engagement — **not** an
`org_id=:me` filter) so SOW isolation no longer hangs on a single DB role-flip control, matching
`inbox.service`'s belt. Severity was **defense-in-depth, not a live exposure**: the app connects as
`web_app_user` (`is_superuser=off`, `bypassrls=false`, verified), so RLS was already enforced. Smoke
extended to **14/14** — the belt now proves a non-party gets nothing from both reads even with RLS
opened (admin escape standing in for a non-enforcing role), while a party still sees the SOW. The
unused `viewer` param on `resolveParties` was dropped (audit nit).

## Iteration 4 — Phase 2 client UI (first pass for QC), 2026-11-16

**Shipped:** the SOW panel at the top of the per-supplier inbox thread (Angular 21, standalone,
signals, zoneless).
- `client-v2/src/app/core/sow/sow.types.ts` + `sow.service.ts` — ApiService-backed client for `/api/sow`.
- `client-v2/src/app/pages/inbox/sow-panel.component.ts` (`app-sow-panel`) — mounted at the top of
  the thread in `inbox-project.component.ts`. Viewer-aware: the **supplier authors**, the **agency
  signs first**, the **supplier counter-signs**.
- Flow: supplier **Create** → edit (title + ordered content sections + deposit %) → agency **Sign** →
  supplier **Counter-sign** → **Executed**. Status via `app-status-pill` (`sow_status` codelist); sign
  via `app-modal` (name + title); content rendered via the `md` pipe; `bp-act--green` sign button.

**Server tweak:** `POST /api/sow` now takes `{ projectId, supplierOrgId? }` (not the raw engagement
PK) and resolves the engagement from `(project, supplier party)` — the client has `projectId` +
`supplierOrgId`, never `projectProviderId`.

**First pass — deliberately lean for QC:** renders `content[]` sections inline (not the full-screen
`sow-document.component` overlay, which renders from `ProjectDetail`, not our `content[]`); no
signature-detail list yet (the status pill conveys state); structured catalogue-pull lines still
deferred. These are the obvious next polish passes once Liam reacts.

**Verified:** Angular bundle compiles clean (dev server `:4202`); backend gated routes 401 (`:3002`).
Liam QCs the live UI (per feedback — visuals aren't screenshot-verified here).

## Iteration 5 — structured SOW document view, 2026-11-16

Reworked the panel into the **document** Liam specced (QC walkthrough): boilerplate hidden
(Intro/Parties/Payment-schedule/Signature), sections as a two-column layout (heading left, fields
right), **N/A** where there's no data, and **hover → edit dialog** for prose blocks with **inline
fields** for the payment rows.
- Sections: Timeline · Services & Goods (Project Details [from project], Concept & Design [N/A],
  Bespoke Render [N/A], Included Services [from each item's install description], Scope [item menus]) ·
  Fee & Payment (**Deposit / Final** rows — %, date, grace, refundable, note — + Special Terms) · **+ Add section**.
- **Pre-filled** from `GET /api/sow/prefill` (project venue/date/duration/guests + the supplier's
  quoted items' description + install_description). Deposit/Final default 50/50 (SOW date · grace 3 /
  Event date · grace 7).
- `POST /api/sow` takes `{projectId, supplierOrgId?}`; content storage switched from a sections array
  to the **structured object** (jsonb — no DDL).

Verified: Angular compiles clean (`:4202`); prefill SQL validated against the live schema; backend 401.
Still to do after QC: SOW as a left-rail node (currently top-of-thread); signature detail; the T&C annex.

## QC notes
(Liam fills this in)

## Chat audit
(chat fills this in — leave the section header so chat finds it)
