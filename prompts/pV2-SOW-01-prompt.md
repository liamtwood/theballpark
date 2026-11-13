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
4. Supplier reviews → **confirms** → **Ready to sign**.
5. Supplier **signs**; Agency reviews (to change anything, edit the fields → regenerate; else **signs**) → **executed**.
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

## Data model

- **The SOW row** = `project_documents` with `type='sow'` (build this table now, SOW-rows only;
  the later Documents release is additive):
  - identity: `id`, `org_id` (agency, RLS), `project_id`, `supplier_org_id` (+ `project_provider_id`)
  - versioning: `root_document_id`, `version`, `is_current`
  - **the five editable fields** (pre-filled at Create, editable until signed, N/A allowed):
    `timeline`, `design`, `services`, `special_terms` (text) + **`deposit_pct`** (numeric)
  - sign state: `status`, `supplier_signed_at/by`, `agency_signed_at/by`
  - `pdf_url` (the frozen artifact per version), audit cols
- **Line link:** `project_items.sow_root_id` (one item → one SOW).
- **New item fields (FR-00227):** `items.render_included` (bool), `items.render_amendment_rounds` (int).
- **Reused as-is:** `items.install_description` (Services), `orgs.terms_pdf_url` (Annex A, read from
  the **supplier** org), the line-pricing SSOT (totals).
- **Services** pre-fills from the supplier's items' `install_description`; the other four fields are
  manual (blank/N/A default). No AI.

## Status machine

`draft` (editable) → supplier **confirms** (+ `deposit_pct`) → `ready_to_sign` → `supplier_signed`
→ `agency_signed` / **executed**. A `sow_status` codelist drives the pill colour (Settings ▸ Codelists).
**Edit-before-generate:** all editing is on the **fields (the form)**, before Create/regenerate — the
rendered SOW is review-only + sign, never edited inline. **No `changes_requested`, no redraft action:**
to change, **edit the fields → regenerate** (a new version; re-sign if already signed), or **re-open an
item** (a material change, FR-00228) which drops it back to negotiation and re-drafts on re-resolve.

## Signing

- **Two-sided in-app sign** — "Sign as <Agency>" / supplier signs in their inbox. **No test-mode
  simulate.** Supplier signs first (after confirm), then Agency. The deeper e-sign integration
  (DocuSign-style) is a later concern; the in-app sign is this build.

## Payment

- `deposit_pct` = the **supplier-set** deposit (binding figure, human choice — not inferred), fills the
  boilerplate schedule's percentage and its complement.
- **3% Ballpark platform fee** of contract value — fixed, shown on the SOW ("Ballpark platform fee: 3%").
- Money movement (the 50/50 Stripe collection, supplier payout, the application fee) = **WS6, Stripe
  Connect** (this boilerplate commits WS6 to **Connect**, not Checkout). This build shows the terms +
  captures `deposit_pct`; nothing charges.

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
- Supplier confirm (+ deposit %) → Ready to sign → two-sided in-app sign → executed. No test-mode,
  no redraft button. Edit-fields-then-regenerate + item re-open are the revise paths (never inline doc edits).
- 3% platform fee shown; no money moves. `project_documents`/`sow_root_id`/render fields migrated
  (rebuild migration), `sow_status` codelist seeded.

## Deferred (not this build)

- The generic **Documents tab**, uploads, proposals (later release).
- The **AI collection layer** (per-message extraction / thread parse) — slots in later to pre-fill the
  manual fields; shape unchanged.
- **WS6 Stripe Connect** money movement.
- Standard **appendices** concat (Annex A alone for now).

## Concerns / open

- Confirm whether the supplier can set `deposit_pct` at the engagement-details step (total is known
  once items are agreed) — assumed yes.
- `install_description` read live from the catalogue item via `line.item_id` vs snapshot on the line —
  build decision (version fidelity).
- Mint the FR/EP ref; surface in What's New.
