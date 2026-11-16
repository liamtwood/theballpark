# pV2-SOW-01 — Per-supplier Statement of Work (v1, no AI)

**Status:** Reconciled to as-built `0039`+`0040` (**BIDIRECTIONAL**) — RLS sign-off **CLEARED both directions** 2026-11-16 (coverage 31/31); confirm step **dropped** + `deposit_pct` **author-set** (Liam 2026-11-16); awaiting FR/EP mint
**Ref:** FR-00XXX / EP-00XXX (mint on the tracker before ship)
**Workstream:** WS3 (auto-SOW) merged with the SOW-generator part of WS4. The generic
Documents tab + uploads + proposals are **deferred to a later release**; this ships the SOW only.
**Supersedes framing in:** `docs/ROADMAP-TO-COMPLETION.md` WS3/WS4, `docs/sow-invoice/`.

---

## What it is

- **Per-engagement contract** between an agency (producer) and a supplier, on ONE engagement
  (`project_providers` row), created once that supplier's items are agreed.
- **Bidirectional — `org_id` = the AUTHOR.** Either party may author; direction = which side of the
  engagement equals `org_id`. Same 3-table cluster, one sign machine.
  - **Supplier-authored** (the **primary** flow, Liam 2026-11-16): the supplier writes the SOW for their
    own portion + sets the deposit; the agency is the counterparty — proposes via the inbox, then signs
    or doesn't. `org_id` = supplier.
  - **Agency-authored** (`0039`): the agency writes it, the supplier is the counterparty. `org_id` = agency.
- Lives at the **top of the inbox**, with the items nested under it — **no Documents tab**.
- Rendered in **our existing SOW format** (`sow-document.component.ts` chrome: `.quote-doc` paper,
  shaded section bars, gradient fee banner) + the **Proposal's Options panel**.
- **v1 = no AI** (no thread parsing, no field extraction — that layer slots in later without
  changing the shape; it would only pre-fill the manual fields).

## Flow (use case)

Shown for the **supplier-authored** primary direction; agency-authored is the mirror (swap author ↔ counterparty).

1. A supplier's items are agreed in the inbox.
2. **Engagement details** are shown, pre-filled with what we can (editable, or click **N/A**):
   Timeline · Design (Concept & Design sign-off) · Services · Payment % (deposit, **author-set**) · Special terms.
3. The **author** (supplier) clicks **Create SOW** → assembles boilerplate + parties + project details + items
   + T&C into a **draft** they own (`org_id` = author).
4. The **counterparty** (agency) reviews in their inbox and **signs first** on the unsigned draft →
   **`counterparty_signed`**. This is the **freeze/issue point** — the signature IS the acceptance; there is
   **no separate confirm step**. If they won't proceed → **`declined`** (terminal).
5. The **author** (supplier) **counter-signs last** → **`executed`**. (Substance + binding are frozen the instant
   the counterparty signed, so there is no inline editing between the two signatures — amend = a new SOW.)
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
  - identity: `id`, `ref`, `name`, `description`, `org_id` (**the AUTHOR — agency OR supplier — sacred**, RLS;
    direction = which side of the engagement equals it), `project_id`, `project_provider_id` (the engagement;
    NULL = agency→client, reserved), `supplier_org_id` (**denormalised = the supplier party, direction-independent**,
    from `pp.provider_org_id`), `project_category_id` (reserved).
  - `status` (`sow_status` codelist), `type` (`document_type` codelist), `deposit_pct` (numeric,
    **author-set** — falls out of ownership: only the owner (`org_id`) writes it, the counterparty is read-only;
    the structured SSOT WS6 reads — also rendered inside `content.payment_schedule`).
  - **`content`** (jsonb) — **ordered narrative sections** `[{name, content, order}]`. The five engagement
    fields (Timeline · Design · Services · Payment schedule · Special terms) **live here as sections**, plus
    supplier-added sections; `"NA"` is explicit. (This replaces the flat `timeline/design/services/...` columns
    — the plan: "moving the flat `sow_*` cols → this jsonb **is** most of the build.")
  - **`presentation`** (jsonb) — the Options panel (theme / header / footer + SOW body toggles).
  - **`parties_snapshot`** + **`terms_snapshot`** (jsonb) — **frozen at issue** (resolved **server-side**:
    parties via `org_contact`/`supplier_directory`, terms = Annex A ref + boilerplate merge values).
  - `issued_at` (freeze point), audit cols.
  - **No version int / `is_current` / `root_document_id`** — but **`supersedes_document_id`** (nullable self-FK)
    is **kept**, because Liam's three lifecycle cases need it: **(1)** a SOW never executed → `declined`/abandoned;
    **(2) change order** to a signed SOW → a **new** SOW with `supersedes_document_id` **set** to the old;
    **(3) more work** → a **new independent** SOW, `supersedes_document_id` **null**. Cases 2 and 3 can't be told
    apart by `created_at`, hence the pointer. **"Superseded" is derived** (a doc that has a successor) — no status
    value, no version. **"Current" is plural** — a supplier may hold several concurrent valid SOWs (case 3):
    **current = non-`declined` AND non-superseded**. The old executed row is the permanent immutable record,
    never deleted. ⚠️ Supersession is **same-org-chain-scoped** (audit B4): the "superseded" derivation and the
    change-order write path both require the successor to be the agency's own, same `(project, provider)`.
- **`project_document_lines`** (child, frozen at issue) — the §3 item-set as **real rows** (a draft re-derives
  live from the supplier's agreed quotes; these populate at `ready_to_sign`): `project_item_id` (provenance) ·
  name · spec · qty · unit · unit_price · line_total · currency · source · price_notes (AI, frozen) ·
  `render_included` / `amendment_rounds` (FR-00227, frozen from the catalogue item) · quote_description · audit.
- **`project_document_signatures`** (child, **append-only**) — exactly the two parties: `signer_org_id` /
  `signer_user_id` · `role` (`signatory_role` codelist: agency | supplier | **client**) · name · title ·
  `signed_at`. `unique(document_id, role)`. **Written only by the sign SECURITY DEFINER**, never a direct INSERT
  (the external-client role is reserved for agency→client, not written in v1).
- **Freeze on FIRST SIGNATURE** (the counterparty's — there is no separate `confirm`/`ready_to_sign` step any
  more). At that point the lines + `parties_snapshot` + `terms_snapshot` materialise (Phase-1 service, which MUST
  write them BEFORE the first signature row) and the doc freezes; an unsigned draft is fully regeneratable.
  Post-signature the frozen **substance AND binding** columns are **write-rejected DB-side** (the generalized
  freeze trigger keyed on signature-existence — see Security).
- **New item fields (FR-00227):** `items.render_included` (bool), `items.render_amendment_rounds` (int) — the
  per-line render defaults a SOW line freezes from.
- **Reused as-is:** `items.install_description` (seeds the Services section), the supplier's `orgs.terms_pdf_url`
  (Annex A, resolved server-side), the line-pricing SSOT (totals).
- **`project_items.sow_document_id`** (additive nullable FK on `project_items`, `0020`) — **which current SOW a
  live requirement is on** (NULL = not yet on a SOW). Needed because case 3 splits a supplier's agreed items
  across several live SOWs, so membership can't derive from "all agreed items". Re-points on a change order (2),
  only new items land on a more-work SOW (3); freezes into `project_document_lines` at issue. RLS-neutral — the
  row's `org_id` still governs `project_items` visibility (audit-confirmed).
- **Services** section seeds from the supplier's items' `install_description`; the other four engagement
  sections are manual (blank / N/A). No AI (the AI layer only pre-fills these sections later).

## Status machine

**`draft`** (editable, re-derives live) → the **counterparty signs first** on the unsigned draft →
**`counterparty_signed`** (the **freeze/issue point**; the signature IS the acceptance — **no `confirm` step,
no `ready_to_sign`**) → the **author counter-signs** → **`executed`**. Terminal **`declined`** — the counterparty
won't sign, or declines outright (distinct from **re-opening a single item**, which drops that item back to
negotiation, FR-00228). Both directions run this **one** machine: the signing party is **derived** from
(session org, `org_id`, engagement), **never** a client-supplied role; signing **order** is derived (counterparty
first), never stored; the stored signature `role` is the **party-TYPE** (agency | supplier), stable across
directions. A `sow_status` codelist drives the pill colour (Settings ▸ Codelists); the mid status is
**`counterparty_signed`** (renamed from `supplier_signed` — the agency can be the first signer).

**Edit-before-sign:** all editing is on the **fields (the form)** — the rendered SOW is review-only + sign,
never edited inline. **No `changes_requested`, no redraft action, no versioning.** To change:
- **unsigned (`draft`)** — edit the fields → the draft regenerates live (same row), or **re-open an item**
  (FR-00228) which drops that item back to negotiation and re-drafts on re-resolve.
- **after any signature** — the substance + binding columns are **frozen (DB-enforced)**; there is no editing
  between the two signatures. To change, create a **NEW SOW**: a **change order** (case 2) sets
  `supersedes_document_id` → the old (which becomes derived-"superseded"); **more work** (case 3) leaves it null
  (both stay "current"). The executed row is always the permanent immutable record.

## Signing

- **Two-sided in-app sign** — the **counterparty signs first** on the unsigned draft, the **author counter-signs
  last**, each in their own inbox. **No test-mode simulate.** Deeper e-sign (DocuSign-style) is a later concern;
  the in-app sign is this build.
- **One write path, direction-aware:** `document_sign` is a gated **SECURITY DEFINER** that **derives** the signing
  party from (session org, `org_id`, engagement) — it **never** branches auth on the client-supplied `p_role`
  (validated only as an anti-spoof label == the derived party-type). It writes the signature row + flips status
  atomically; signer identity is set server-side. Neither party has any direct UPDATE/INSERT on the document or
  signatures. (`document_confirm` is **retired** — the signature is the acceptance.) See the Security section +
  `docs/audits/2026-11-13-sow-document-cluster-rls-audit.md`.

## Payment

- `deposit_pct` = **author-set** — it falls out of ownership: only the owner (`org_id`) can write it, the
  counterparty is read-only. **Supplier-authored** → the supplier sets it (the agency proposes via the inbox,
  then signs or doesn't); **agency-authored** → the agency sets it. It fills the boilerplate schedule's
  percentage and its complement.
- **3% Ballpark platform fee** of contract value — fixed, shown on the SOW ("Ballpark platform fee: 3%").
- Money movement (the 50/50 Stripe collection, supplier payout, the application fee) = **WS6, Stripe
  Connect** (this boilerplate commits WS6 to **Connect**, not Checkout). This build shows the terms +
  captures `deposit_pct`; nothing charges.

## Security (RLS) — the bidirectional cross-org surface

Audited acquisition-grade — full per-line review in `docs/audits/2026-11-13-sow-document-cluster-rls-audit.md`
(migrations `0039` + `0040`). RLS sign-off **cleared both directions 2026-11-16** (coverage 31/31). Summary:
- **Owner access** via the generic `_all` (`org_id = app_current_org()` or admin) — the author CRUDs their own
  draft, either direction, under one policy.
- **Counterparty read** via ONE unified `*_counterparty_read` policy per table (replaced the agency-only
  `*_provider_read` trio): widens SELECT to "the other party on the doc's engagement", both directions, with the
  **engagement PINNED** (`pp.id = project_provider_id`) — without the pin a single A↔S engagement would leak one
  party's SOWs to the other across **all** shared projects (cross-project read leak). S2 (`deleted_at is null`)
  carried; the owner is excluded (reads via `_all`).
- **Engagement guard** (both directions, `BEFORE INSERT/UPDATE`): a doc's `(project_id, project_provider_id)` must
  be a real engagement the **owner is a party to, on that project** (`d.project_id = pp.project_id` — newly
  load-bearing: stops an author misfiling a doc onto another project via a real engagement). Early-returns on the
  reserved NULL (agency→client).
- **The sign path derives the party** from (session org, `org_id`, engagement) and **never trusts the client role**
  (confused-deputy); `p_role` is only an anti-spoof label, and `role` is stored as the stable party-TYPE.
- **Freeze is DB-enforced** by the generalized trigger: frozen once **any signature exists**, across contract
  **substance** (`content`, `deposit_pct`, snapshots, name, description) **and binding** columns
  (`project_provider_id`, `project_id`, `org_id`, `supersedes_document_id`) — so a signed doc can't be re-pointed
  onto another engagement (which would drag its signatures into the other party's set). `presentation` stays editable.
- **Cross-org fields** — counterparty name/address + `orgs.terms_pdf_url` — resolve **server-side** via
  `org_contact`/`supplier_directory` (the **Angular component never reaches the other org** — own-org RLS zeroes
  cross-org, [[project_supplier_directory_pattern]], bit the marketplace 3×). `parties_snapshot` / `terms_snapshot`
  freeze from these at first signature.
- `terms_pdf_url` **file access is engagement-scoped** (storage/signed-URL layer): served only to parties on an
  actual engagement, not any org that can see the directory row.
- **Signatures append-only** at the privilege layer (no UPDATE/DELETE grant); **supersedes same-org/engagement-scoped**
  (B4). A **coverage test** ships with the migrations and **gates the land** (31/31, **both directions**).
- Admin-write (`app_is_admin()` in `with check`) matches the 0018/0020 sibling convention — the FR-00215
  project-cluster escape, closed cluster-wide before launch, **not** special-cased here.
- **Still owed (Phase-1 service re-audit):** snapshot resolution + line materialization (must run **before** the
  first signature), engagement-scoped file access, and **engagement-scoped SOW aggregation** — readers that filter
  `org_id = :me` now **miss counterparty-authored docs**. Re-audit when that code lands.

## Options panel

Reuse the Proposal's Options panel (Theme / Header / Footer verbatim) with **SOW Body toggles**
(Parties · Scope · Item descriptions · Timeline · Payment terms · Special terms). Config is the
agency's standard SOW (set once), not re-picked per SOW.

## Inbox

SOW is the **top-level object** in the per-supplier thread; items nest under it; "all costs agreed →
conversations combined into one." The SOW header carries status · total · the confirm/sign actions.

## Acceptance

- A supplier's items agreed → engagement details show (pre-filled where we can, else N/A-able) → the **author**
  (supplier, primary direction) clicks Create SOW → a draft they own (`org_id` = author) in our SOW format.
- Parties show all three from existing fields; Annex A is the **supplier's** T&C; Services pulls each
  item's `install_description`; boilerplate renders with merge fields filled (deposit %, parties, net days).
- Both directions run **one** sign machine: `draft` → **counterparty signs first** → `counterparty_signed` →
  **author counter-signs** → `executed`; terminal `declined`. **No confirm step, no `ready_to_sign`, no
  test-mode, no redraft, no versioning.** Party + order DERIVED (never a client role); `document_sign` the only
  write path; `document_confirm` retired.
- `deposit_pct` = **author-set** (owner-only write; counterparty read-only). 3% platform fee shown; no money moves.
- **Bidirectional RLS (`0039`+`0040`):** unified counterparty-read (engagement pinned, both directions), engagement
  guard (`project_id` pinned), signature-existence freeze over substance **+ binding** columns, supersedes
  same-org-scoped, signatures append-only. Coverage **31/31**, both directions.
- Multiple independent SOW rows per `(project, supplier)`; **"current" is plural** — non-`declined` AND
  non-superseded (derived, **same-org/engagement-scoped**, audit B4). Freezes at **first signature**
  (lines + `parties_snapshot` + `terms_snapshot` materialise); frozen substance+binding columns **write-rejected
  DB-side** thereafter; executed rows are never deleted.
- The **3-table cluster** (`project_documents` incl. `supersedes_document_id`, no version int/is_current, +
  `_lines` + `_signatures`) + `project_items.sow_document_id` + `items.render_*` migrated (`0039`); **bidirectional
  direction + unified counterparty-read + engagement guard + generalized freeze + no-confirm derive-party sign
  machine** (`0040`); `document_type` / `sow_status` (mid = `counterparty_signed`; incl. `declined`) /
  `signatory_role` codelists seeded.

## Deferred (not this build)

- The generic **Documents tab**, uploads, proposals (later release).
- The **AI collection layer** (per-message extraction / thread parse) — slots in later to pre-fill the
  manual fields; shape unchanged.
- **WS6 Stripe Connect** money movement.
- Standard **appendices** concat (Annex A alone for now).

## Concerns / open

- ~~Single-direction (agency-authored) only~~ **RESOLVED (Liam, 2026-11-16)** — **bidirectional**, `org_id` = author;
  supplier-authored is the **primary** flow. RLS cleared both directions (`0040`, 31/31).
- ~~Confirm step (keep / drop)~~ **RESOLVED (Liam, 2026-11-16)** — **DROPPED**; the signature is the acceptance.
  One no-confirm machine, both directions (`document_confirm` retired; `ready_to_sign` no longer reached).
- ~~`deposit_pct` owner~~ **RESOLVED (Liam, 2026-11-16)** — **author-set** (owner-only write): supplier-authored →
  supplier sets, agency proposes via inbox + signs-or-doesn't; agency-authored → agency sets. (Superseded the
  2026-11-13 "agency always sets" call.)
- ~~`install_description` live vs snapshot~~ **RESOLVED** — a draft re-derives live; frozen into
  `project_document_lines` + `content` at **first signature**; executed is immutable.
- ~~Versioning model~~ **RESOLVED (Liam, 2026-11-13)** — no version int / is_current; **`supersedes_document_id`
  kept** for the 3 lifecycle cases (change-order vs more-work); "superseded" derived; "current" plural
  (non-declined AND non-superseded), same-org-scoped (audit B4).
- ~~Flat single-table vs 3-table plan~~ **RESOLVED (Liam, 2026-11-13)** — the **3-table SSOT plan governs**
  (`project_documents` + `_lines` + `_signatures`); the flat framing is superseded.
- Mint the FR/EP ref; surface in What's New. Phase-1 service re-audit still owed (snapshot/line materialization,
  engagement-scoped file access + SOW aggregation).
