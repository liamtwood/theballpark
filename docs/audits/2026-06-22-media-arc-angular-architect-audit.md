# pV2-MEDIA-01 — Angular/Node architect audit (2026-06-22)

> Independent read-only end-of-module audit (general-purpose architect agent).
> Triage recorded in `prompts/pV2-MEDIA-01f-shipped.md` (Iteration v2.32o).

## Verdict

The arc is **ship-with-fixes** — production-shippable, not blocked. The architecture is faithful to MEDIA.md's locked decisions (one picker / one gallery / one completeness card, N consumers; drawer-not-modal; explicit "set as cover" semantics; client-computed completeness; jsonb bound + cast everywhere; `org_id` from JWT only; financials never leak in the suppliers projection). Angular v2 standards are met across the board (standalone, OnPush, signals, `@if`/`@for`/`@switch`, `inject()`, `input()`/`output()`/`model()`, Lucide via lazy chunk, zero raw `.subscribe()`, no `any`). The fixable issues are one **compliance violation** (Unsplash attribution not surfaced on gallery/portfolio — a hard MEDIA.md lock §4 / RP-11), one **dead legacy route**, and a cluster of robustness/consistency nits.

## Findings

| ID | Sev | Category | Location |
|---|---|---|---|
| F-1 | HIGH | Locked-decision / compliance (RP-11) | org-media + image-gallery |
| F-2 | MED | Security smell | server/src/routes/media.js |
| F-3 | MED | Dead/duplicate route + read/write mismatch | server/src/routes/projects.js:142 |
| F-4 | MED | Dual source of truth (RP-06 rider) | org-media inputs vs OrgProfile/SupplierDetail |
| F-5 | LOW | Correctness | image-gallery.component.ts:46,237 |
| F-6 | LOW | Reactivity / standards | image-picker.component.ts:285–298 |
| F-7 | LOW | Standards (catch hygiene Rule 5) | image-picker.component.ts:241,271 |
| F-8 | LOW | Performance | media upload / no maxSlots server bound |
| F-9 | LOW | A11y | image-gallery focal/empty-slot + completeness |
| F-10 | LOW | Consistency nit | media.js bucket map |

---

### F-1 — Unsplash attribution is never surfaced on the gallery or portfolio (compliance) — HIGH
**Category:** MEDIA.md locked-decision §4 + Risk-pattern RP-11
**Where:** `org-media.component.ts` (portfolio view cards), `image-gallery.component.ts:46–86` (thumbnails)
**What:** MEDIA.md lock §4 is explicit and flagged as a compliance requirement, not optional: "when an image comes from Unsplash, attribution … MUST be surfaced where the image displays." The data plumbing is correct end-to-end — `GalleryImage.attribution` is captured by the picker, persisted through the Zod schema, and round-tripped by the projections — but no consuming surface renders it. The project/profile covers render "Photo by X on Unsplash"; a gallery photo sourced from Unsplash and shown on the public storefront portfolio carries no credit. Highest-risk surface = the public storefront portfolio.
**Recommendation:** Render attribution wherever a `GalleryImage` with `attribution` displays. Extract a tiny `<app-unsplash-credit>` and mount at every image render site (also satisfies "one definition").

### F-2 — Upload trusts client-set `scope` and multer's `mimetype`; content not sniffed — MED
**Category:** Security smell (input validation)
**Where:** `server/src/routes/media.js:22–38`, `server/src/services/storage.service.js:18–42`
**What:** (1) `scope` validated only against the `SCOPE_BUCKET` allow-list; the path is always `${scope}/${req.user.org_id}/cover` (org-scoped, JWT — correct, no cross-org overwrite). (2) `req.file.mimetype.startsWith('image/')` trusts the client `Content-Type`; a non-image can be uploaded as `image/png`, and an unknown mimetype yields an **empty extension** (extensionless object). No magic-byte sniff.
**Recommendation:** Add a Zod body schema for `{ scope }`; validate mimetype against an explicit allow-list (jpg/png/webp) and reject otherwise (closes the empty-ext case); ideally magic-byte sniff. Walk the Rule-10 checklist for this endpoint.

### F-3 — Legacy `PATCH /api/projects/:id/images` is dead, ungated, and reads keys nothing writes — MED
**Category:** Anti-pattern #6 + dead code + auth
**Where:** `server/src/routes/projects.js:142–154` (mounted ungated at `index.js:197`)
**What:** The v2 path goes through `PATCH /api/projects-v2/:id` (org-scoped, Zod, jsonb-cast). This older route reads `{ cover_image_url, client_logo_url, card_color }` (snake_case; `client_logo_url`/`card_color` aren't in the MEDIA-01 model), calls `ProjectService.update(id, ...)` with no org guard/Zod, on the ungated `/api/projects` v1 path. Divergent second write path.
**Recommendation:** Confirm mounting; delete if unused, else bring to v2 standard. (Pre-existing v1 — systemic fix is the v1 retirement.)

### F-4 — `OrgProfile` vs `SupplierDetail` carry the same media fields under different names — MED
**Category:** Dual source of truth / coupling (RP-06 rider)
**Where:** `organisation.service.ts:7–28` (`coverImageUrl`) vs `catalogue.types.ts:111–126` (`coverUrl`); consumed by org-media via individually-passed inputs
**What:** org-media deliberately passes fields individually rather than share an interface. Defensible, but it's the RP-06 dual-shape pattern: the same branding fields defined twice, mapped by hand at two consumer sites, with no test asserting the DTOs stay compatible.
**Recommendation:** Either a shared `OrgMediaView { coverUrl; logoUrl; images }` both DTOs satisfy, or a structural test. Low urgency (two consumers).

### F-5 — Gallery dedupe is URL-exact and `track img.url` collides on legitimate same-URL slots — LOW
**Where:** `image-gallery.component.ts:46` (`track img.url`), `:237` (`some((s) => s.url === r.url)`)
**What:** Both key purely on `url`. Two slots sharing a URL (same photo, two focal points) → duplicate-key churn under `@for` + silent drop on add. Focal point isn't part of the key.
**Recommendation:** Track on a composite key; make the dedupe non-silent (toast) or keep "no dup URLs" as an explicit rule.

### F-6 — `appliedIconQuery` could be derived; minor `resource` param idiom — LOW
**Where:** `image-picker.component.ts:283–298`
**What:** Correct-but-could-be-cleaner: per-query filter over the full ~1500-icon array; `params: () => activeTab()==='icon' ? true : undefined` boolean-gated resource reads oddly. No bug.
**Recommendation:** Optional — memoise the lowercased name list once on load. Not blocking.

### F-7 — Two empty `catch {}` blocks lack the Rule-5 justification comment — LOW
**Where:** `image-picker.component.ts:241` (upload), `:271` (Unsplash)
**What:** :271 has a comment (compliant). :241 sets a user-facing `uploadError` (not silent) but swallows the error object with no `console.warn` for the unexpected-failure case Rule 5's example calls for.
**Recommendation:** `console.warn` the caught error before the friendly message.

### F-8 — Gallery `maxSlots` enforced client-side only; server accepts up to 20 — LOW
**Where:** `image-gallery.component.ts:191,215` vs `organisation.schema.js:48` (`.max(20)`)
**What:** "Add up to 5" is presentational; the server caps at 20. Not a security issue (bounded, jsonb). Copy/contract disagreement.
**Recommendation:** Treat 20 as the hard ceiling; accept per-consumer `maxSlots` is UI-only, or pass + validate the limit.

### F-9 — Focal picker not keyboard-operable; progressbar lacks `aria-valuetext` — LOW
**Where:** `image-picker.component.ts:29–37`, `completeness-card.component.ts:25`
**What:** Mostly solid a11y. Gaps: focal point set only via click coords (no keyboard path — centre fallback acceptable); completeness progressbar has `aria-valuenow` but no `aria-valuetext`.
**Recommendation:** Add `aria-valuetext`. Focal keyboard gap deferrable (covered by MEDIA.md deferred a11y item).

### F-10 — `item`/`profile` both map to the suppliers bucket; comment-only rationale — LOW
**Where:** `server/src/routes/media.js:14–19`
**What:** `profile` assets in a bucket named "supplier-assets" is a slight semantic overload. `item` mapped despite item upload deferred.
**Recommendation:** None required; clarifying comment or rename env to `STORAGE_BUCKET_ORG_ASSETS`.

---

## Things done well (confirming the architecture)
- Discriminated-union `PickerResult`; picker emits, never persists (lock §1/§2).
- jsonb serialized + `$n::jsonb`-cast at every write, never concatenated.
- `org_id` JWT-only on every media write; suppliers projection excludes financial columns + 404s cross-org.
- Lucide full set lazy-loaded in a separate chunk (lock §5).
- "Primary = the entity's cover column, not position 0" (lock §12).
- Completeness card generic `<T>`, client-computed, weights normalised (lock §7).
- `linkedSignal` gallery working-copy re-sync with `?? []` crash guard.
- OnPush + zoneless throughout; no manual CD; no raw `.subscribe()`; no `any`; `host:` class binding.
