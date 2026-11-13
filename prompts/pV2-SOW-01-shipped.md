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

## QC notes
(Liam fills this in)

## Chat audit
(chat fills this in — leave the section header so chat finds it)
