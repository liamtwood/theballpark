# pV2-SOW-01 — Per-supplier Statement of Work (v1, no AI)

**Status:** Draft (chat/designer — for Liam review before build)
**Ref:** FR-00XXX / EP-00XXX (mint on the tracker before ship)
**Workstream:** WS3 (auto-SOW) merged with the SOW-generator part of WS4. The generic
Documents tab + uploads + proposals are **deferred to a later release**; this ships the SOW only.
**Supersedes framing in:** `docs/ROADMAP-TO-COMPLETION.md` WS3/WS4, `docs/sow-invoice/`.

---

## What it is

- **Per-supplier contract** (Agency ↔ Supplier), created once all that supplier's items are agreed.
- Lives at the **top of the inbox**, with the supplier's items nested under it — **no Documents tab**.
- Rendered in **our existing SOW format** (`sow-document.component.ts` chrome: `.quote-doc` paper,
  shaded section bars, gradient fee banner) + the **Proposal's Options panel**.
- **v1 = no AI** (no thread parsing, no field extraction — that layer slots in later without
  changing the shape; it would only pre-fill the manual fields).

## Flow (use case)

1. Agency negotiates a supplier's items in the inbox → **all items agreed**.
2. **Engagement details** are shown, pre-filled with what we can (editable, or click **N/A**):
   Timeline · Design (Concept & Design sign-off) · Services · Payment % (deposit) · Special terms.
3. Click **Create SOW** (per supplier) → assembles boilerplate + parties + project details + items
   + supplier T&C into a **draft**.
4. Supplier reviews → **confirms** (accepts the terms, incl. the **agency-set** deposit %) → **Ready to sign**.
   If the supplier won't proceed → **declined** (terminal).
5. Supplier **signs**; Agency reviews (to change anything, edit the draft fields **in place** — an edit
   after supplier-sign **clears the stale signature** and drops back to draft; else **signs**) → **executed**.
6. Deposit collected via **Stripe Connect — WS6, later** (this build captures the %, no money moves).

## Document structure (sections → source)

Four source buckets: **boilerplate** (Ballpark-fixed), **profiles**, **project**, **items**.

| Section | Source |
|---|---|
| Header (agency logo/name + ref·type·created) | agency org + project |
| Standard Intro | **boilerplate** (fixed) |
| Parties — Agency · Supplier · End client | agency org · supplier org (`supplier_directory`) · `project.clientName` (+ company no/address) |
| Timeline | engagement field (manual / N/A) |
| **Services & Goods** | |
| · Project Details (location/date/duration) | project |
| · Concept & Design sign-off *(Pre-Signature)* | engagement field "Design" (manual / N/A) |
| · Bespoke Render *(Post-Payment)* | `items.render_included` / `render_amendment_rounds` (new item fields) |
| · Included Services (Install/De-rig · Staffing · Logistics) | **each item's `install_description`** |
| · Scope + line totals | `project_items` + line-pricing SSOT |
| Fee & Payment Terms — Standard Payment schedule + Special Terms | **boilerplate** + `deposit_pct` merge; Special = engagement field |
| Signature — Standard Conclusion + Signature block | **boilerplate** + the two sign states |
| Annex A — T&C attachment | **supplier's** `terms_pdf_url` (their profile) |

Boilerplate blocks are **Ballpark-fixed legal text with merge fields** (deposit %, net days `[30]`,
parties, Effective Date, Annex A) — not agency-editable. Verbatim text in `docs/sow-invoice/`.

## Parties (all existing fields)

- **Agency** → the agency org · **Supplier** → supplier org via `supplier_directory` ·
  **End client** → `project.clientName` (+ `clientCompanyNumber` / `clientAddress`). Contract is
  Agency↔Supplier; the end client is **named context**, not a signatory.

## Data model — the **3-table document cluster** (per `DATA-MODEL-REDESIGN` §"Document cluster — LOCKED"; migration `0039`)

The SSOT plan governs (Liam ruled 2026-11-13); the earlier flat single-table framing is superseded. A SOW is a
**frozen issuance of the live quotes** — the same live-vs-frozen split used across the rebuild.

- **`project_documents`** — the SOW object (`type='sow'`; build now, SOW-rows only, Documents-release additive):
  - identity: `id`, `ref`, `name`, `description`, `org_id` (**agency, sacred**, RLS), `project_id`,
    `project_provider_id` (the supplier engagement; NULL = agency→client, reserved), `supplier_org_id`,
    `project_category_id` (reserved).
  - `status` (`sow_status` codelist), `type` (`document_type` codelist), `deposit_pct` (numeric,
    **agency-set**; the structured SSOT WS6 reads — also rendered inside `content.payment_schedule`).
  - **`content`** (jsonb) — **ordered narrative sections** `[{name, content, order}]`. The five engagement
    fields (Timeline · Design · Services · Payment schedule · Special terms) **live here as sections**, plus
    supplier-added sections; `"NA"` is explicit. (This replaces the flat `timeline/design/services/...` columns
    — the plan: "moving the flat `sow_*` cols → this jsonb **is** most of the build.")
  - **`presentation`** (jsonb) — the Options panel (theme / header / footer + SOW body toggles).
  - **`parties_snapshot`** + **`terms_snapshot`** (jsonb) — **frozen at issue** (resolved **server-side**:
    parties via `org_contact`/`supplier_directory`, terms = Annex A ref + boilerplate merge values).
  - `issued_at` (freeze point), audit cols.
  - **No versioning** (Liam): no `version` / `supersedes_document_id` / `is_current` / `root_document_id`.
    **Multiple independent rows** per `(project, supplier)`; **"current" = latest non-`declined`** (derived
    from `created_at` + `status`). Change an executed SOW = **create a new row**; the old executed row is the
    permanent immutable record, never deleted.
- **`project_document_lines`** (child, frozen at issue) — the §3 item-set as **real rows** (a draft re-derives
  live from the supplier's agreed quotes; these populate at `ready_to_sign`): `project_item_id` (provenance) ·
  name · spec · qty · unit · unit_price · line_total · currency · source · price_notes (AI, frozen) ·
  `render_included` / `amendment_rounds` (FR-00227, frozen from the catalogue item) · quote_description · audit.
- **`project_document_signatures`** (child, **append-only**) — exactly the two parties: `signer_org_id` /
  `signer_user_id` · `role` (`signatory_role` codelist: agency | supplier | **client**) · name · title ·
  `signed_at`. `unique(document_id, role)`. **Written only by the sign SECURITY DEFINER**, never a direct INSERT
  (the external-client role is reserved for agency→client, not written in v1).
- **Freeze on ISSUE, not create.** At `ready_to_sign` the lines + `parties_snapshot` + `terms_snapshot` populate
  and the doc freezes; a pre-issue draft is fully regeneratable. Post-sign the frozen columns are
  **write-rejected DB-side** (trigger / definer-only — see Security). An edit before issue drops back to draft.
- **New item fields (FR-00227):** `items.render_included` (bool), `items.render_amendment_rounds` (int) — the
  per-line render defaults a SOW line freezes from.
- **Reused as-is:** `items.install_description` (seeds the Services section), the supplier's `orgs.terms_pdf_url`
  (Annex A, resolved server-side), the line-pricing SSOT (totals).
- **No `project_items.sow_document_id`** — dropped. Draft membership derives live and freezes into
  `project_document_lines` at issue; a stored back-link is redundant.
- **Services** section seeds from the supplier's items' `install_description`; the other four engagement
  sections are manual (blank / N/A). No AI (the AI layer only pre-fills these sections later).

## Status machine

`draft` (editable, re-derives live) → supplier **confirms** (accepts; `deposit_pct` is already
**agency-set**) → **`ready_to_sign`** (the **freeze point** — lines + `parties_snapshot` + `terms_snapshot`
populate) → supplier signs → **`supplier_signed`** → agency signs → **`executed`**. Terminal **`declined`**
— supplier confirms-then-won't-sign, or declines outright (distinct from **re-opening a single item**, which
drops that item back to negotiation, FR-00228). No `agency_signed` status — the agency's signature flips
`supplier_signed` → `executed`; both signature rows live in `project_document_signatures`. A `sow_status`
codelist drives the pill colour (Settings ▸ Codelists).

**Edit-before-generate:** all editing is on the **fields (the form)** — the rendered SOW is review-only + sign,
never edited inline. **No `changes_requested`, no redraft action, no versioning.** To change:
- **pre-issue (`draft`)** — edit the fields → the draft regenerates live (same row), or **re-open an item**
  (FR-00228) which drops that item back to negotiation and re-drafts on re-resolve.
- **after issue, pre-`executed`** — an edit **clears any signature and drops back to `draft`** (can't sign a
  moving doc).
- **after `executed`** — the row is frozen (DB-enforced); create a **NEW SOW** (optionally pre-filled from the
  last). The executed row is the permanent immutable record.

## Signing

- **Two-sided in-app sign** — "Sign as <Agency>" / supplier signs in their inbox. **No test-mode
  simulate.** Supplier signs first (after confirm), then Agency. The deeper e-sign integration
  (DocuSign-style) is a later concern; the in-app sign is this build.
- **One write path:** both parties' confirm/sign go through a gated **SECURITY DEFINER** (`document_confirm` /
  `document_sign`, `org_contact`-shaped) that validates engagement + role + status and writes the signature
  row + flips status atomically. The supplier has **no direct UPDATE/INSERT** on the document or signatures.
  See the Security section + `docs/audits/2026-11-13-sow-document-cluster-rls-audit.md`.

## Payment

- `deposit_pct` = the **agency-set** deposit — the SOW **creator** (the agency) sets Payment % on the
  engagement form at Create (binding figure, human choice — not inferred). The supplier's **confirm is
  acceptance, not setting.** It fills the boilerplate schedule's percentage and its complement.
- **3% Ballpark platform fee** of contract value — fixed, shown on the SOW ("Ballpark platform fee: 3%").
- Money movement (the 50/50 Stripe collection, supplier payout, the application fee) = **WS6, Stripe
  Connect** (this boilerplate commits WS6 to **Connect**, not Checkout). This build shows the terms +
  captures `deposit_pct`; nothing charges.

## Security (RLS) — the cross-org read surface

Audited acquisition-grade — full per-line review in `docs/audits/2026-11-13-sow-document-cluster-rls-audit.md`
(migration `0039`). Summary:
- All three tables are **agency-org-scoped** (`org_id = app_current_org()`); the engaged supplier gets a
  **read-only** widening via `project_providers` (the 0023 inbox `*_provider_read` pattern), with
  **`org_id` pinned** by the engagement row (`pp.org_id = d.org_id`), not trusted from the app.
- **Supplier writes go through a gated SECURITY DEFINER only** — no supplier UPDATE/INSERT policy. The function
  validates engagement + role + current status, writes the signature, flips status (append-only, atomic). This
  is why "field writes rejected once `status ≥ supplier_signed`" holds; the **post-sign freeze is DB-enforced**
  (a `BEFORE UPDATE` trigger / definer-only writes), not left to the service.
- **Cross-org fields** — supplier name/address + `orgs.terms_pdf_url` — resolve **server-side** via
  `org_contact`/`supplier_directory` (the **Angular component never reaches the supplier org**; own-org RLS
  zeroes cross-org — [[project_supplier_directory_pattern]], bit the marketplace 3×). `parties_snapshot` /
  `terms_snapshot` are frozen from these at issue.
- `terms_pdf_url` **file access is engagement-scoped** (enforced at the storage/signed-URL layer): a supplier's
  T&C PDF is served only to parties on an actual engagement, not any org that can see the directory row.
- **Signatures are append-only at the privilege layer** (no UPDATE/DELETE grant); a **coverage test** ships with
  `0039` (the inbox bar) and gates the land.
- Admin-write (`app_is_admin()` in `with check`) matches the 0018/0020 sibling convention — the FR-00215
  project-cluster escape, closed cluster-wide before launch, **not** special-cased here.

## Options panel

Reuse the Proposal's Options panel (Theme / Header / Footer verbatim) with **SOW Body toggles**
(Parties · Scope · Item descriptions · Timeline · Payment terms · Special terms). Config is the
agency's standard SOW (set once), not re-picked per SOW.

## Inbox

SOW is the **top-level object** in the per-supplier thread; items nest under it; "all costs agreed →
conversations combined into one." The SOW header carries status · total · the confirm/sign actions.

## Acceptance

- All a supplier's items agreed → engagement details show (pre-filled where we can, else N/A-able) →
  Create SOW assembles a per-supplier draft in our SOW format.
- Parties show all three from existing fields; Annex A is the **supplier's** T&C; Services pulls each
  item's `install_description`.
- Boilerplate renders with merge fields filled (deposit %, parties, net days).
- Supplier confirm (deposit % is agency-set) → Ready to sign → two-sided in-app sign → executed. No
  test-mode, no redraft button, no versioning. Revise = edit-draft-in-place (pre-sign) / new SOW
  (post-execution) / item re-open (never inline doc edits).
- Multiple independent SOW rows per `(project, supplier)`; "current" = latest non-`declined` (derived).
  Doc freezes at **issue** (`ready_to_sign`: lines + `parties_snapshot` + `terms_snapshot`) and the frozen
  columns are **write-rejected DB-side** post-sign; executed rows are never deleted.
- Supplier confirm/sign via the **SECURITY DEFINER** only (no direct supplier write); signatures append-only;
  RLS coverage test ships with `0039` and gates the land.
- 3% platform fee shown; no money moves. The **3-table cluster** (`project_documents` + `_lines` +
  `_signatures`, no versioning cols) + `items.render_*` migrated (`0039`); `document_type` / `sow_status`
  (incl. `declined`) / `signatory_role` codelists seeded.

## Deferred (not this build)

- The generic **Documents tab**, uploads, proposals (later release).
- The **AI collection layer** (per-message extraction / thread parse) — slots in later to pre-fill the
  manual fields; shape unchanged.
- **WS6 Stripe Connect** money movement.
- Standard **appendices** concat (Annex A alone for now).

## Concerns / open

- ~~`deposit_pct` owner~~ **RESOLVED (Liam, 2026-11-13)** — the **agency** (SOW creator) sets it on the
  engagement form at Create; supplier confirm = acceptance.
- ~~`install_description` live vs snapshot~~ **RESOLVED** — a draft re-derives live; frozen into
  `project_document_lines` + `content` at **issue** (`ready_to_sign`); executed is immutable.
- ~~Versioning model~~ **RESOLVED (Liam, 2026-11-13)** — **no version columns**; multiple independent
  rows, freeze-at-issue, new-SOW-to-change, "current" derived from `created_at` + `status`.
- ~~Flat single-table vs 3-table plan~~ **RESOLVED (Liam, 2026-11-13)** — the **3-table SSOT plan governs**
  (`project_documents` + `_lines` + `_signatures`); the flat framing is superseded.
- Mint the FR/EP ref; surface in What's New.
