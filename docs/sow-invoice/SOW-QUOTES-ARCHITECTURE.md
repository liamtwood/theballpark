# SOW & Quotes — subsystem architecture (tech spec)

**Scope:** the agent-facing Final Quote and the client-facing SOW + Quote documents.
**Measured:** 2026-10-01, from source (not estimated).

## 1. Purpose

Turn a project's line items + computed estimate into (a) the in-app **Final Quote rail**
(working view) and (b) two **print/PDF documents** — the client-facing **Quote** and the
**Statement of Work** — in the agency-SOW layout. One pricing definition feeds all three.

## 2. Size

| Layer | File | LOC | Role |
|-------|------|----:|------|
| Client | `quote-document.component.ts` | 498 | Client-facing Quote document (themed, print) |
| Client | `project.types.ts` | 355 | `ProjectDetail` / `QuoteLine` / `EstimateBreakdown` + `groupByCategory` |
| Client | `sow-document.component.ts` | 305 | Statement of Work document |
| Client | `project.service.ts` | 252 | Data-access layer (HTTP) |
| Client | `quote-line.util.ts` | 159 | Pure display/compute helpers (SSOT mirror) |
| Client | `project-quote-rail.component.ts` | 136 | In-app Final Quote rail |
| Server | `projects.service.js` | **1363** | Business logic + all SQL |
| Server | `projects-v2.js` | 435 | Gated REST route (20 endpoints) |
| Server | `line-pricing.golden.test.js` | 165 | Contract test binding module ↔ SQL |
| Server | `line-total.util.js` | 99 | `lineTotalSql` — SQL pricing mirror |
| Server | `line-pricing.js` | 89 | Pricing SSOT (per-line formula) |

**Subsystem ≈ 3,856 LOC** (client 1,705 / server 2,151), excluding the shared
`OrganisationService` + token/CSS.

## 3. Architecture (data flow)

```
sow-document / quote-document / project-quote-rail   (3 client consumers)
        │  inject
        ▼
ProjectService (project.service.ts)  ── HTTP ──►  routes/projects-v2.js  (gated, RLS ctx)
        │                                                  │ delegates (no SQL in routes)
        │                                                  ▼
        │                                         projects.service.js  (owns ALL SQL)
        │                                                  │ unit price / totals
        │                                                  ▼
        │                                  line-pricing.js  +  line-total.util.js
        │                                  (SSOT: JS module  ↔  SQL mirror, golden-tested)
        ▼                                                  │
quote-line.util.ts  (client mirror of the same formula)   ▼
                                           TABLES: projects · project_items · orgs
                                           (direct, RLS org-scoped; orgs_public = cross-org)
```

Two reads power every surface: `GET /:id/items` (`QuoteLine[]`) and
`GET /:id/estimate` (`EstimateBreakdown`, the one cascade). The `project` (`ProjectDetail`)
is passed in from the parent. The estimate is **computed per request, not stored**.

## 4. What the service does (`projects.service.js`, 23 exports)

- **Reads:** `listForOrg`, `listClientNames`, `getDetail`, `listItems`, `getEstimate`,
  `listComponents`, `listComponentsForAgency`, `listMyComponents`, `linesByIds`
- **Writes:** `create`, `updateDetail`, `addItem`, `addCustomItem`, `saveComponents`,
  `addQuestion`, `removeItem`, `updateItem`, `updateLineDetails`, `setQuoteDescription`
- **Compute/meta:** `previewNextRef` (per-org `ref_prefix`/`ref_counter`), `recommend`
  (AI line suggestions), `resolveStatus` + `DEFAULT_STATUS`, `toCard`

It is the single owner of: project CRUD, the quote-line table, components/build-up,
the estimate cascade, ref allocation, status, and recommendations.

## 5. REST surface (`/api/projects-v2`, 20 endpoints, all gated)

Projects: `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `GET /client-names`, `GET /next-ref`,
`POST /:id/recommend`. Lines: `GET/POST /:id/items`, `GET /:id/estimate`,
`POST /:id/items/custom`, `PATCH /:id/items/:itemId`(+`/details`),
`PUT /:id/items/:itemId/quote-description`, `DELETE /:id/items/:itemId`,
`POST /:id/items/:itemId/parse-intent`. Components: `GET/POST /:id/items/:itemId/components`,
`POST /:id/items/:itemId/question`, `GET /my-components`.

## 6. Pricing SSOT

One formula, two runtimes, one test:
- `effectiveUnitPrice(input)` — `priceCurrent ?? priceRef ?? ((tier ?? base) + variantUpcharge)`
- `lineTotal(input)` — unit × qty, honouring `flat_total` override
- `lineTotalSql` — the SQL mirror used for aggregation
- `line-pricing.golden.test.js` — runs module + SQL over a case matrix so they can't drift
  (they did twice → BE-00105/00106). Client `quote-line.util.ts` imports the same module.

## 7. Data model

- **`projects`** — `id, org_id, ref` (via orgs `ref_prefix`/`ref_counter`), `name`,
  `status`/`status_id`, `currency`, `guest_count`, `duration_days`,
  `clientName`/`clientCompanyNumber`/`clientAddress`, `venueName`/`venueCity`,
  **`sowPaymentTerms`/`sowSpecialTerms`/`sowTimeline`**, `coverImageUrl`, `created/updated`, `deleted_at`.
- **`project_items`** (UNIFY-01 line state) — `id, project_id, item_id, name, description,
  base_price, price_current, price_ref, flat_total, unit, quantity, variant(jsonb),
  image_url, selection_type, category_id, supplier_org_id, parent_id, logical_line_id,
  quote_description, installed, status, deleted_at`.
- **`orgs`** — agency identity (`name, logo_url, address, city, phone, company_number`),
  `ref_prefix`/`ref_counter`, `terms_pdf_url` (Annex A). `orgs_public` view = cross-tenant.

## 8. Access & security

Same-tenant reads/writes hit **base tables directly** through the service, scoped by
`org_id` and (post-flip) enforced by **RLS**. The **`orgs_public` view is cross-org only**
(the supplier read in the quote-line join is the one place that must move to it — see §9).
Prod-flip safety depends on EP-00020 / BE-00132.

## 9. Observations / risks

- **`projects.service.js` = 1363 LOC, 23 exports** — a god-service forming (projects +
  items + components + estimate + recommend + status). Same class as the TaxonomyService
  split (BE-00112); a candidate to break up (e.g. `quote.service` / `components.service`).
- **`quote-document.component.ts` = 498 LOC** (past the 400 alarm line);
  `sow-document` = 305 (past the 250 warn). Both are single big templates — fine for now,
  watch on the next change.
- **Cross-org `orgs` join** — the price-match "Source: from [Other Supplier]" read must go
  via `orgs_public` (leaks columns pre-flip / RLS-hidden after). Captured on FR-00226.
- **Estimate recomputed per request** — no cache; fine at current scale.
- **SOW text fields live flat on `projects`** (`sow*`) — fine for single-doc; if the SOW
  grows per-section editable blocks, consider a child table rather than more columns.

## 10. For the SOW build (FR-00226 / FR-00227)

Extend `sow-document.component.ts` (don't rebuild); reuse `quoteItems` + `estimate` +
the SSOT; add the §3 items table (Source + AI Price Notes) + §2 render fields
(`render_included`/`render_amendment_rounds`, additive). New server work = the AI
Price-Notes generator (inbox `ai.service`) + the cross-org-safe supplier-name read.

---

## 2026-11-17 — SOW review lifecycle + generic review-comment machine (decision)

**Lifecycle (reuses the per-line approvals vocab):** `Draft → In review → Accepted`
(+ `Declined`), pills reuse the line tones (Accept=green, Decline=red, Suggest=yellow,
Request-info=gray — `feedback_action_button_colors`).
- **Draft** — supplier (author) builds; HTML view, editable; agent can't see it (RLS gate:
  counterparty reads only when `status != 'draft'`).
- **In review** — supplier "Send for review" (draft→in_review); agent sees the read-only SOW
  + the comment thread; posts comments; supplier replies / edits / resolves.
- **Accepted** — agent Accept (green) → snapshot lines **+ generate & freeze the PDF** = the
  final rubber stamp (PDF is produced ON ACCEPT, not persisted earlier; Preview PDF stays
  on-demand before). Decline (red) → declined.

**Agent interaction v1 = comments only** (no suggested-edits / direct writes). The document
stays author-owned & immutable-by-the-agent (keeps the existing SOW RLS boundary); the comment
thread is the ONE place the agent can write. Suggested-edits = fast-follow.

**Node IDs (DONE 2026-11-17):** `SowNode.id` seeded on create + preserved through edits
(`withIds()`), new nodes get one in `addChild`. Lets a comment anchor to a section even as the
tree reorders. Existing drafts must be re-created to seed ids.

**Generic `review_comments` machine (one mechanism, SOW + item-image approvals):**
```
review_comments(id, entity_type 'sow'|'image', entity_id, anchor_id /*SOW node id, null for image*/,
                author_org_id, author_user_id, body, status 'open'|'resolved',
                created_at, resolved_at, resolved_by)
```
- SOW: entity_type='sow', entity_id=sow id, anchor_id=node id.
- Item approvals (really the IMAGES): entity_type='image', entity_id=image id, anchor_id=null.
- Machine = post (both parties) → read (both) → owning side **resolves/closes**.
- **RLS (acquisition-grade, owed):** per-entity party resolver. SOW keys off the engagement
  (`project_providers`: agency=`org_id`, supplier=`provider_org_id`; party = `app_current_org()
  in (...)`, mirrors `sow_parties` 0042). Image keys off the image's owning org. Both parties
  read+insert; owning side resolves. Needs its own RLS coverage test. Migration = 0046.

**Also:** add **Request info** to the per-line item approvals (today accept/adjust/decline) for
vocab parity — separate change from the SOW comments.

**Build status (2026-11-17):**
- ✅ Node IDs (`withIds`, seeded on create).
- ✅ **0046** `review_comments` + per-entity RLS (sow party resolver; image deny) — applied dev.
- ✅ **0047** draft→review visibility gate (counterparty_read `status<>'draft'`) — applied dev.
- ✅ **0048** `document_review(id, action)` definer — send/revise (author) · accept/decline
  (counterparty), party+status derived — applied dev.
- ✅ **0049** sow_status pill values in_review/accepted — applied dev.
- ✅ Backend: sow.service listComments/addComment/resolveComment + review + routes.
- ✅ Client: SowComment/SowStatus/SowReviewAction types, sow.service methods, comment thread
  dialog (post/resolve, badge per node) + lifecycle buttons (Send for review / Revise /
  Accept / Decline).
- ⏳ **OWED:** RLS **coverage test** for review_comments (acquisition-grade, before promote);
  **PDF-on-accept** (snapshot lines + freeze the rubber-stamp PDF — currently Preview is
  on-demand only, status flips without snapshot); **PDF-in-dialog** (Preview still opens a
  tab); image-approval entity resolver; per-line **Request info** action.
- Existing drafts predate node ids → re-Create to seed. Rebuild migs 0046–0049 applied to dev
  only; promote runs them for preview/prod.
