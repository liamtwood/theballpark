# pV2-BUILDUP-04 — supplier edits line details (description + Services) in the inbox

**Shipped:** 2026-08-27, chip `[Dev v2] v2.67`
**Commit:** `<pending>`

The lightweight substitute for the shelved composition/options feature: instead
of a structured build-up, the **supplier annotates the project line in prose** —
so when they change an item (upgrade to a Gourmet menu, add a fridge) they can
**record it** on the line. Reuses the exact editable item card that fed the
Customize screen.

## What landed

### Inbox — "Edit item" on the supplier's line
- New **Edit item** button (pencil) on the supplier's selected-line header
  (supplier-only; the agent doesn't see it). Toggles an inline editor in the
  thread pane (replaces the conversation, like Customize did).
- The editor is the same **`app-item-preview` in editable mode** reused from
  Customize — **Name, Description, and Services** are editable. **Save details**
  / **Cancel**.

### Server — a details PATCH that isn't lock-gated
- New **`PATCH /api/projects-v2/:id/items/:itemId/details`** →
  `projects.updateLineDetails`. Saves `name` / `description` /
  `install_description` (Services); only provided fields change.
- **Not lock-gated** (the existing quantity/installed PATCH 409s a line that's
  out-for-quote — exactly when the supplier needs to annotate). Authority: the
  caller owns the row — their own per-supplier fan-out row (supplier) OR the
  project's canonical row (agent).
- **No schema change** — both columns already exist. `QUOTE_LINE_JOIN` already
  `COALESCE`s the line's own `description`/`install_description` over the
  catalogue's, so edits show immediately in the **inbox card and Final Quote**.

## Notes
- Supplier-only in the UI; the endpoint also permits the agent's canonical row
  (unused today) if we later want agent-side annotation.

## Iteration — v2.195 (2026-09-01): extract `app-line-preview` — one object, no drift
- Answering "why isn't it the same UI object?": it always WAS the same
  `app-item-preview` component, but each surface re-declared the ~7 project
  bindings by hand — which is how Customize drifted (missing Client description /
  Details). Extracted **`LinePreviewComponent` (`app-line-preview`)** that maps a
  `QuoteLine` → the preview ONCE (TOTAL via `lineCost`, no store-link, "Item
  description", Client description + Details). The inbox brief/proposal cards and
  the estimate rail now all mount `<app-line-preview [line]>`; removed their
  duplicated bindings + now-dead helpers (`asPreview`, `asRequested`,
  `lineTotalOf`, `previewItem`, `detailsTotal`, `quoteDesc`) and imports.
- Customize also now shows the Client description + Details blocks (feeds them to
  `app-item-preview` directly — it stays the **editable, live-`withMargin()`**
  variant of the same component), so it matches the read-only surfaces.

## Iteration — v2.194 (2026-09-01): Customize item preview gets the same treatment
- The Customize right-panel **item** preview now matches every other project
  surface: shows the live **"£X TOTAL"** (`withMargin()`, updates as you build),
  drops the ↗ store-link, and labels the supplier blurb **"Item description"**.
  The per-component card (a selected row) is unchanged — the total treatment is
  the item's, not the components'.

## Iteration — v2.193 (2026-09-01): ONE consistent project-side item preview
- Consolidated every project-side item display onto a single `app-item-preview`
  view, so the inbox brief card, the inbox revised card, and the estimate rail
  all render identically:
  - **Price = the client-facing line TOTAL** (`lineCost`, always a value) shown
    as **"£X TOTAL"** — no more "From £/unit" or "Price on request" on the
    project side (marketplace/store keep "From £/unit"). Per-unit line dropped
    for now (per-head treatment coming separately).
  - **Store-link (↗) removed** on the project side; **eye** = minimise kept.
  - The **four text blocks in one fixed order, nulls hidden in view mode**:
    **Client description** (agent's `quote_description`, `· on the quote`, with a
    pencil that hands editing back to the estimate rail) → **Item description**
    (supplier `description`, relabelled via `descriptionLabel`) → **Services** →
    **Details** (with running total).
- The estimate rail + inbox now feed those via `[lineTotal]`, `[clientDescription]`,
  `[details]`, `[descriptionLabel]`, `[currencyCode]`; their own duplicated
  Description/Details blocks (and now-dead `MarkdownPipe`/`detailsTotalDisplay`/
  `symbolFor`) were removed. Client-description editing still lives in the rail
  (opened by the preview's pencil).

## Iteration — v2.192 (2026-09-01): base row's qty/unit now persist on the line
- **Bug: editing the base cost/qty/unit didn't stick.** The base row IS the
  parent `project_items` row (the item cloned into the project), but only its
  name/description/services were patched — **quantity and unit were never
  saved**, and the cost only rode through as a blended total ÷ the *old* qty, so
  any of the three could appear to revert on reopen.
- Now `saveComponents` also persists **parentQuantity / parentUnit** onto the
  parent line, applied **before** the `price_current = revisedPrice / quantity`
  division so it divides by the NEW qty (keeps base + upgrades = current). Wired
  end-to-end: dialog `parentPatch` (guarded to when the base row is shown) →
  client `project.service.saveComponents` (`parentQuantity`/`parentUnit`) →
  `ComponentsSchema` → `projects.saveComponents`. Reopen now round-trips cost,
  qty and unit exactly (the reseed recovers the same base rate).

## Iteration — v2.190 (2026-09-01): trashcan on rows + save-and-switch the builder
- **Row remove icon** in the Customize builder changed from an **×** to a
  **trash-2** (size 14), matching how Ballpark Cost removes a line — same visual
  vocabulary for "delete a line" everywhere. Demo narration updated ("…with the
  trashcan").
- **Bug: builder stranded on the old line.** Selecting a different item while
  customizing left the header on item 2 but the builder still on item 1. Now
  `selectItem` **saves the current draft** (`customizeDialog().saveDraftPublic()`
  → `save(false)` captures the rows synchronously) then **reopens the builder on
  the new line** (`customizing.set(null)` to tear it down, then `setTimeout` to
  reopen fresh so `ngOnInit` re-runs and reloads the new line's components).

## Iteration — v2.172 (2026-08-28): item-scoped thread header (the REAL divergence)
- The real cause of the two Revised disagreeing: the thread header showed the
  **whole thread's** `originalTotal`/`revisedTotal` even when a single item was
  selected (title said "Italian Dinner" but numbers were the supplier's *all
  items* aggregate). The base row (this item, £16,500) then didn't match the
  header's Original (£17,325 = thread). Now, **when an item is selected the header
  is item-scoped** (`it.priceRef` / `it.priceCurrent`), so it lines up with the
  Customize base. Thread-level totals still show when no item is selected.
- (v2.171's `originalPrice/qty` base seed stays — correct for items whose line
  total includes install; a no-op otherwise.)

## Iteration — v2.171 (2026-08-28): reconcile the base (fix diverging Revised)
- Reverted v2.170's hide — both totals stay visible; the concern was the
  **difference**, not the duplication.
- Root cause: the base seeded its per-unit from `unitPriceRef` (**goods only**),
  dropping the line's install/extras, so the builder's Revised undershot the
  thread's by that amount. Now the base rate seeds from **full line total ÷ qty**
  (`originalPrice / baseQuantity`), so at rest the base = the thread's Original
  and the two reconcile. `isBaseCat` also gates on `originalPrice` now.

## Iteration — v2.170 (2026-08-28): one Revised (hide the thread header's while customizing) [reverted in v2.171]

## Iteration — v2.169 (2026-08-28): "Customizations" → "Upgrades"
- Relabelled the running total **Customizations → Upgrades** (customize header +
  the inbox item header) — fits the base + upcharges model.

## Iteration — v2.168 (2026-08-28): plain numeric entry (no spin arrows)
- Hid the native number-input spin arrows on `input.bp-input-field` (so Cost etc.
  are clean entry-only; the − 1 + steppers remain the way to nudge). Global,
  scoped to `<input>` so selects keep their chevron.

## Iteration — v2.167 (2026-08-28): Customize Qty as a − 1 + stepper
- Swapped the plain Qty inputs (component rows + base row) for the existing
  **`app-rate-input`** stepper (`bp-qty-stepper` chrome, min 1). Widened the Qty
  grid column 62→104px to fit; wrapped each in a stop-propagation span so stepper
  clicks don't select the row.

## Iteration — v2.166 (2026-08-28): base folds into its category card (row-0)
- The base row now renders **inside the item's own category card** as the pinned
  first row ("an item masquerading as a component") — locked category, no remove,
  Inc = augment/decompose. `baseCategoryId` (from `c.line.categoryId`) drives it;
  `displayGroups` guarantees that category card exists even before any component.
- **Category totals are now honest** — the item's category card = base + its
  add-ons (`catCardTotal`); the standalone base card is gone. Header still splits
  Customizations (add-ons only) vs Revised (base + add-ons + margin).

## Iteration — v2.165 (2026-08-28): base = a "project component" row (cost/qty/unit/Inc)
- The parent card is now a **component-style row-0**: editable **Cost / Qty /
  Unit** + **Inc** checkbox (`baseRate` / `baseQty` / `baseUnitDraft` /
  `includeBase`), same grid + fields as the component rows. (Derived, not yet a
  persisted `project_items` child — that's the deferred unification.)
- Moved the **Customizations / Revised** totals off the card into the dialog
  **header** (next to Back to conversation).

## Iteration — v2.164 (2026-08-28): editable head-count on the Customize base
- The base row now takes the line's **per-unit rate + unit + qty** (`unitPriceRef`
  / `unit` / `quantity`), so its head count is **editable** — `baseCost =
  unitRate × baseQty` (rescales the revised total). Falls back to a flat
  `originalPrice` when no unit rate. (Rescales the total; doesn't change the
  line's negotiated quantity — that's separate.)

## Iteration — v2.163 (2026-08-28): Customize uses the base cost (no more price drop)
- **Bug fixed:** customizing overwrote the line's price with `Σ(components)` — an
  intact £17,325 line dropped to £42 on adding one component (and Send New Cost
  would fire £42). Now the buildup **seeds the item's own base cost**:
  `Revised = base + customizations + margin(customizations)`. Base is added
  **flat** (not re-margined — it's an already-quoted price); margin applies to the
  customizations only.
- New **"Base £X" include toggle** in the header (default **on** = augment). Turn
  it **off** to DECOMPOSE (rebuild the whole price from parts — the pre-fix
  behaviour), so both workflows are supported. Not yet persisted (resets on each
  open) — persistence is a follow-up.

## Iteration — v2.162 (2026-08-28): Customize footer Cancel button
- Added a **Cancel** button before **Save draft** in the customize footer
  (project mode) — fires `cancel` (same as the top "Back to conversation").

## Iteration — v2.183 (2026-08-31): Customize base seeds from the CURRENT price
- Bug: for a line whose price was negotiated (base 105 → current 115, no
  components), the header showed the current Revised but Customize seeded its base
  from the ORIGINAL rate → the two disagreed. Fix: pass `currentPrice`
  (`priceCurrent ?? priceRef`); after load, seed `baseRate` so **base + upgrades =
  current price** — `base = current − costTotal×(1+margin)`. Gives `base=current`
  when there are no components, and the original base when there are (no
  double-count).

## Iteration — v2.177 (2026-08-31): inbox — no conversation until an item is selected
- The thread pane no longer shows the thread-level conversation with nothing
  selected — the bubbles are gated on `@if (selectedItem())`, else a prompt
  "Select an item above to view its conversation." (pairs with v2.161, where the
  compose was already disabled until an item was picked).

## Iteration — v2.161 (2026-08-28): inbox — replies require an item; keep context
- **Bug:** `selectedId` (`() => null`) and `selectedThreadId` (`ts[0]`) were
  `linkedSignal`s off the threads list, so **every reload** (send / accept /
  suggest / customize save) reset them — orphaning the armed item, which made
  replies fall back to **General**. Both now **preserve their pick** across a
  reload (drop only if it no longer exists).
- The **compose is disabled until an item is selected** (placeholder: "Select an
  item above to reply") — no more accidental General messages.

## Iteration — v2.160 (2026-08-28): Customize dialog — visible Back/close
- The customize builder replaces the conversation (so the row's Close toggle is
  gone while it's open) but had **no visible close** of its own. Added a **"Back
  to conversation"** button at the top of `customize-dialog` that fires `cancel`.

## Iteration — v2.159 (2026-08-28): re-enable supplier Customize in the inbox
- Restored the **supplier Customize button** in the inbox thread action row
  (supplier-only, `!isAgency()`) — toggles the inline estimate/build-up dialog
  (`toggleCustomize` / `app-customize-dialog`, already wired). Label flips
  Customize ⇄ Close. New neutral **`bp-act--outline`** variant for it (not a
  semantic soft fill). Store item-edit entry left as-is (inbox only, per Liam).

## Iteration — v2.158 (2026-08-28): pink workspace on Overview (home) too
- `isWorkspace()` now also matches **`/home`** so Overview gets the pink ground.

## Iteration — v2.157 (2026-08-28): pink workspace on Past projects too
- `isWorkspace()` now also matches **`/projects`** (the Past projects list), so
  it gets the same pink ground as the project detail workspace.

## Iteration — v2.156 (2026-08-28): Reports buttons as a tab band
- Dropped the "REPORTS" title; the two document buttons now render as a
  **tab-band-style** even-width pill row (`bp-tab-band--even` + `bp-tab`),
  relabelled **Ballpark** (file-text) and **SOW** (signature). Still open the
  quote / SOW overlays.

## Iteration — v2.155 (2026-08-28): Event Description card + transparent scrollbar
- Added an **Event Description** card after Event details (same soft-white
  workspace treatment) — an editable textarea bound to `description`, saving on
  blur via the shared persist path; the saved-chip is shared via an
  `ngTemplateOutlet`.
- **Scrollbars**: transparent track (shows the pink/page ground, not a white
  gutter) + a subtle rounded thumb (global).

## Iteration — v2.154 (2026-08-28): tab icons + even-width tabs
- `TabBandTab` gains an optional **`icon`**; project tabs get one each: About
  Project (clipboard-pen), Ballpark Cost (wallet), Marketplace (store), Reports
  (file-text), Inbox (inbox).
- New opt-in **`equalWidth`** on `app-tab-band` → each tab `min-width:150px`,
  content centred, so the band reads even. Only the project tabs opt in.

## Iteration — v2.153 (2026-08-28): hero Ballpark = Project Total (cascade)
- The hero "Ballpark" figure now reads the estimate cascade's **`projectTotal`**
  (e.g. £97,979) instead of the stale `totalBallparkCost` (which read £0).
  project-detail loads a `estimate` resource (`projects.estimate(id,'all')`);
  reloaded when landing on the Ballpark Cost tab so it stays live after line edits.

## Iteration — v2.152 (2026-08-28): hero right-meta (Ballpark total) + tab order
- Added a **right-hand meta block** to `app-page-hero` (`rightEyebrow` /
  `rightTitle` / `rightSubtitle`) that mirrors the left (same classes, right-
  aligned). Project hero shows **BALLPARK / {totalBallparkCost} / Exc. VAT**.
- Swapped tab order: **Ballpark Cost now precedes Marketplace**.

## Iteration — v2.151 (2026-08-28): hero meta polish
- Eyebrow + ref shrink a touch (`--text-xl`→`--text-lg`) via a new hero
  **`dense`** flag; extra padding above the "PROJECT" eyebrow (margin-top 10px).
- Back link relabelled **"Projects" → "Past projects"** on the project hero.

## Iteration — v2.150 (2026-08-28): eyebrow not bold
- Hero eyebrow weight 600 → 400 (matches the ref); still tracked-uppercase.

## Iteration — v2.149 (2026-08-28): eyebrow sized to match the ref
- The hero **eyebrow** now uses `--text-xl` (same size as the ref/subtitle),
  keeping the tracked-uppercase treatment.

## Iteration — v2.148 (2026-08-28): "PROJECT" eyebrow above the project name
- Added an optional **`eyebrow`** input to `app-page-hero` (small tracked
  uppercase label above the title; renders only when set). Project detail passes
  **`eyebrow="Project"`** so "PROJECT" sits above the name, per the mockup.

## Iteration — v2.147 (2026-08-28): workspace redesign — frosted nav, pink ground, soft card
- **Frosted app header** (`app-shell`): two rows — wordmark + account (row 1),
  primary nav (row 2): **Overview · New project · Past projects · Messages ·
  Marketplace · Profile**, each an existing authed route, so you can jump out
  without going Back. Header is studio off-white at 70% + `backdrop-blur`
  (`.bp-app-header`); `--shell-pt` bumped 5rem→7rem to clear the second row.
- **Pink workspace ground** (`--workspace-pink: oklch(0.93 0.05 5)`) painted on
  the shell `<main>` for the `/projects/:id` route only (full-bleed behind the
  header), via a URL-derived `isWorkspace()` signal.
- **Event details card** restyled to the mockup: soft-white (`--color-surface`),
  warm-grey border (`--card-border: oklch(0.915 0.008 300)`), 32px radius,
  `--shadow-quiet`, `p-6`, pill inputs, muted `text-xs` labels, `sm:2 / lg:3`
  grid. New tokens live in `styles.css` (`--workspace-pink`, `--card-border`,
  `--shadow-quiet`). Light-only (v2 is a light app).
- **Enter a project → Ballpark Cost by default** (tab fallback `marketplace` →
  `final`).
- Deferred (next): hero-right total block (BALLPARK £26,409 / low confidence),
  the wider full-width card, and any tab-set trimming.

## Iteration — v2.146 (2026-08-28): center the About Project tab
- Centered the **About Project** content (`bp-settings-body` was 720px-capped but
  left-aligned) with `mx-auto` + gutters, matching the Ballpark Cost column.

## Iteration — v2.145 (2026-08-28): hide the Project Cart tab
- Removed **Project Cart** from the visible tab band. The `estimate` route still
  exists (reachable via the cart→final flow / URL); it's just no longer a tab.

## Iteration — v2.144 (2026-08-28): Reports tab holding the Quote/SOW buttons
- Added a **Reports** tab (after Ballpark Cost). Moved the **View as Quote** /
  **View as SOW** buttons off the Ballpark Cost tab into Reports; they still open
  the existing `app-quote-document` / `app-sow-document` overlays. Ballpark Cost
  is now just the estimate. (Inline-in-tab document rendering deferred.)

## Iteration — v2.143 (2026-08-28): move the tab band below the hero
- Moved the **tab band** (About Project / Marketplace / Project Cart / Ballpark
  Cost / Inbox) out of the page hero's actions slot to a **centered row just
  above the tab content** — so on the estimate/final tabs it sits directly over
  the Event details card. Hero now shows just Back + title + ref.

## Iteration — v2.142 (2026-08-28): rename Final Quote tab → Ballpark Cost, drop the final title
- Renamed the **"Final Quote" tab → "Ballpark Cost"**.
- Removed the **"Final Project Quote"** page title on the final view (the Event
  details card is the top now). Cart still shows its "Project Cart" title.

## Iteration — v2.141 (2026-08-28): Event details — Project name, order, NATO date, comma budget
- Added **Project** (`name`, required — a blank blur won't null it) and set the
  field order to **Project · Client · Event type · Event date · Location ·
  Guests · Budget guide (£)**. **Removed Duration.**
- **Event date** formats to **NATO (DD-Mmm-YYYY)** on blur (unparseable text like
  "TBC" kept). **Budget** is now a text box that shows **thousands separators**
  (`withCommas`, e.g. 100,000) and parses commas out on save.

## Iteration — v2.140 (2026-08-28): editable Event details card on Cart/Final
- Replaced the read-only **summary tiles** (Date / Location / Duration / Guest
  count / Budget) at the top of the estimate view with a new **editable
  `app-event-details-edit`** card — the same facts, now inputs, plus **Client
  name** (`clientName`) and **Event type** (`eventType`), both existing project
  fields. Each field **saves on blur** via a targeted `ProjectUpdate` patch (one
  nullable column); a "Details saved" pill flips to "Saving…" / "Couldn't save".
- `(saved)` bubbles up (`detailsSaved` output) → the host calls
  `detail.reload()` so every surface re-reads. Location edits `venueName`
  (labelled "Location"); Duration/Guests/Budget parse to `number|null`.
- **Removed** the "Estimated Ballpark {Total,Cost}" headline banner from the
  estimate view (the total still shows in the breakdown box; the total + CTA
  card is the next step). Card sits **inside the `max-w-2xl` reading column** so
  its edges line up with the Project Costs cards (Liam QC).
- No server / schema / type changes — `ProjectUpdate` already accepts all five.

## Iteration — v2.139 (2026-08-28): Timeline 3-column table + label/date pairing
- Timeline renders as **3 columns** (label · start date · end date; end blank when
  no range). The parser now **pairs** a bare-label line with its following bare-date
  line (blank lines ignored) — handling the saved "label / date on separate lines"
  style as well as inline "label date - date".

## Iteration — v2.138 (2026-08-28): Timeline date ranges
- `detailsDateLine` now formats **every** date on a line (global), so a range
  ("20.08.26 - 21.08.26") formats both ends. The Timeline row parser recognises a
  trailing date **or range** as the date column (rendered "20-Aug-2026 – 21-Aug-2026").

## Iteration — v2.137 (2026-08-28): SOW Timeline renders as two columns
- The SOW Timeline now renders each milestone as a **two-column row** (label left,
  NATO date right-aligned) via a `timelineRows` computed — a proper table look
  (a tab char can't do this; HTML collapses whitespace). Lines without a trailing
  date render label-only.

## Iteration — v2.136 (2026-08-28): SOW content — Timeline / Payment / Special Terms + fees in scope
- **Extracted a shared `DetailsEditorComponent`** from the inbox line-editor, with
  modes **calc** (item Details — running total), **date** (Timeline — numeric
  dates → NATO via new `detailsDateLine`), **plain** (markdown only). line-editor
  refactored to use it (no behaviour change).
- New project columns `sow_timeline` / `sow_payment_terms` / `sow_special_terms`
  (all schemas + targeted `ALTER`), wired through the project PUT + a new
  **Statement of Work** edit-section on the About tab (read = markdown, edit =
  the Details editor; Timeline uses date mode).
- **SOW** renders these three sections; empty ones prompt to fill them in.
- **Services & Goods** now includes the agent's **Fees/Project** lines (as a
  "Project Fees" group), not just categorised hard costs.

## Iteration — v2.135 (2026-08-28): SOW party sentence spacing
- Assembled the Buyer/Supplier sentence tail (", company number …, whose
  principal place of business is at ….") in code (`buyerRest`/`supplierRest`
  computeds) to kill the stray space before the period from template whitespace.

## Iteration — v2.134 (2026-08-28): SOW party fields — company numbers + client address
- New columns (all schemas + targeted `ALTER` on public): `orgs.company_number`,
  `projects.client_company_number`, `projects.client_address`.
- **Org profile** gets a **Company number** field; the **About tab** gets **Client
  company no.** + **Client address**. Wired through the org/project PUTs.
- SOW **Parties** section now renders "company number …" + the client's registered
  address for both Buyer and Supplier when set.

## Iteration — v2.133 (2026-08-28): SOW Location = project venue (no city dup)
- SOW scope Location now uses the project's **venue value** alone (fallback city)
  instead of `venueName, venueCity` — which duplicated the city.

## Iteration — v2.132 (2026-08-28): SOW QC — ref box, Project Total, exc. VAT
- SOW ref box now matches the Quote: **Project / Type (Statement of Work) /
  Created** (date + 24h time). Dropped Version/Effective (no versioning — rely on
  date/time).
- Headline relabelled **"Fee" → "Project Total"** (the value is the total, not the
  agency Fee).
- **exc. VAT** moved **under** the amount and made the same white as the price.

## Iteration — v2.131 (2026-08-28): seamless T&C pages (pdf.js) instead of a viewer
- Replaced the Annex A `<iframe>` (viewer chrome — "omg what's that") with a new
  reusable **`PdfPagesComponent`** that renders the PDF as a **stack of full-width
  canvas pages inline** — no viewer frame, so the T&Cs read as more pages of the
  SOW. Added `pdfjs-dist` (6.2); the ESM worker is copied to the served root via
  angular.json and `workerSrc` is resolved against `document.baseURI`.
- Screen preview (rasterized); the crisp vector merge into the final combined PDF
  is still the Puppeteer stage. NB: if Supabase public URLs don't send permissive
  CORS, pdf.js will show the error fallback → we'd add a same-origin proxy.

## Iteration — v2.130 (2026-08-28): embed the T&C pages inline on the SOW
- The SOW now **embeds the org's T&C PDF inline** (an "Annex A — Terms &
  Conditions" section with an `<iframe>` at the bottom) when uploaded — the pages
  render below the SOW on screen. Screen-only (`print:hidden`); the crisp
  page-merge into the combined PDF is the Puppeteer stage. URL sanitized
  (`bypassSecurityTrustResourceUrl` — the org's own storage asset).

## Iteration — v2.129 (2026-08-28): org T&C PDF (SOW Annex A)
- Agencies upload their standard **Terms & Conditions PDF** on the org profile
  (new **Terms & Conditions** section: upload / view / replace / remove).
- **Server:** new `orgs.terms_pdf_url` column (all schemas + targeted `ALTER` on
  public); `/api/media/upload` accepts a **PDF for scope `terms`** (org-scoped
  path `terms/{org}/standard`); `storage.service` extensions `.pdf`;
  `organisation.js` SELECT/toProfile/update + schema carry `termsPdfUrl`.
- **Client:** `MediaService.uploadTermsPdf`, `OrgProfile.termsPdfUrl`, store
  `uploadTerms`/`removeTerms`.
- **SOW** references it — links "View Annex A — Terms & Conditions" when set, else
  prompts to upload. (Server-side page-merge into the combined PDF is the
  Puppeteer stage.)

## Iteration — v2.128 (2026-08-28): SOW styled to match the Quote
- Restyled the SOW with the Quote's visual language: agency header + meta table
  (Document / Version / Effective), title banner, **boxed shaded sections**
  (Parties / Services & Goods / Timeline / Payment Terms / Special Terms), and a
  **gradient Fee banner** (like the Project Total). Soft brand gradient on the
  bars, full gradient + white text on the Fee.

## Iteration — v2.127 (2026-08-28): SOW document (curated skeleton)
- New `SowDocumentComponent` — a curated **Statement of Work** (sibling of the
  Quote, reusing the `.quote-doc` overlay + print isolation). SOW table: Buyer /
  Supplier (from org + client) / Effective Date / SOW Version / Project Title /
  **Services & Goods** (seeded from the quote's categories + line names) /
  Timeline (placeholder) / **Fee** (= estimate `projectTotal`, ex-VAT) / Payment
  Terms (placeholder) / Special Terms; boilerplate line + Buyer/Supplier
  signature block.
- Reached from the Final Quote via a second button — "View as Quote" /
  "View as SOW" (interim; the org-level "Create Document" picker + editable SOW
  content fields + Annex-A T&C merge come next).

## Iteration — v2.126 (2026-08-28): thinner Options tick
- Checkbox tick is now a thin 1.5px stroke checkmark (rotated-border), not the
  bold filled polygon.

## Iteration — v2.125 (2026-08-28): plain neutral Options checkboxes
- `.opt-check` is now a custom `appearance:none` box: rounded, hairline border, no
  fill; a neutral ink tick (`::before`, `var(--color-text)`) shows when checked.
  No brand/OS colour (fixes the blue/purple native rendering).

## Iteration — v2.124 (2026-08-28): reorder Options + native brand checkboxes
- Section order: **Theme → Header → Body → Footer**. Body order: **Project
  overview → Project summary → Item descriptions**.
- Checkboxes swapped from `bp-check` to native + `accent-color: var(--theme-accent)`
  (`.opt-check`) — the purple was the OS-default native checkbox showing; forcing
  `accent-color` makes the tick reliably brand-pink.

## Iteration — v2.123 (2026-08-28): Options panel restyle — icon bands + Theme dropdown
- Each Options section (Header / Theme / Footer / Body) now has a **shaded band
  header with an icon** (panel-top / palette / panel-bottom / align-left), matching
  the app's category-band style; card is full-bleed (`overflow-hidden`, no padding).
- **Theme** is now a **dropdown** (Default / Black & White / Pick a colour) with the
  colour swatch shown only in colour mode.
- Colour-swatch default changed from purple `#6d28d9` → brand pink `#d63384`.
  (Checkboxes already use `--theme-accent` via `bp-check`.)
- Registered icons: Palette, PanelTop, PanelBottom, AlignLeft.

## Iteration — v2.122 (2026-08-28): phone in the meta-label style
- "Phone:" line now `font-medium text-text` (darker, matching the Project / Type
  / Created labels) instead of the lighter `bp-meta` grey.

## Iteration — v2.121 (2026-08-28): phone below city, labeled "Phone:"
- Moved the agency phone **below city** and labeled it **"Phone: {number}"** (own
  line under the address block).

## Iteration — v2.120 (2026-08-28): Options → Header section (Reference / Address) + phone
- New Options **Header** section: **Reference** toggle (the Project / Type /
  Created meta table) and **Address** toggle (the agency address block). Both
  persisted (`quote_show_ref` / `quote_show_address`, default ON, all schemas +
  targeted `ALTER` on public).
- Agency address block now includes the **phone number**, ordered address →
  **phone** → city (from the org profile's `phone`).

## Iteration — v2.119 (2026-08-28): "Project Summary" = the event-facts tiles
- The **tiles** (Date / Location / Duration / Guest count / Budget) are now a
  boxed **"Project Summary"** section (shaded header + tiles inside), controlled
  by the Body **Project summary** toggle.
- The financial recap section (Costs / Coverage / Fees / Project Total) is
  renamed **"Cost Summary"** to avoid the name clash and is always shown.

## Iteration — v2.118 (2026-08-28): Options grouped into Theme / Footer / Body sections
- Options panel now has three sections. **Footer**: checkboxes **Exclude VAT**
  (was the hardcoded note), **Page numbers**, **Created date**, plus a **Custom**
  footer-text field. **Body**: **Item descriptions**, **Project overview**,
  **Project summary** — each show/hides that content on the document.
- New persisted booleans (all schemas + targeted `ALTER` on public):
  `quote_show_vat_note` / `_page_numbers` / `_item_desc` / `_overview` /
  `_summary`. NULL defaults: ON for all except page numbers (OFF). Old default
  footer text "Excludes VAT." migrates to the Exclude-VAT toggle on open.
- **Page numbers** flag is stored but not rendered yet — it activates with the
  server-side PDF (Puppeteer) work; browser print stays interim.

## Iteration — v2.117 (2026-08-28): Options — "Show created date in footer"
- New Options checkbox **"Show created date in footer"** (persisted:
  `quote_show_created` column, all schemas + targeted `ALTER` on public). When on,
  the footer shows "Created {date + 24h time}" on the right, next to the footer
  text. Wired through the project PUT like the other quote options.
- Page numbers deferred — needs server-rendered PDF (puppeteer footerTemplate) or
  in-page JS pagination; CSS page counters don't render in Chrome's Save-as-PDF.

## Iteration — v2.116 (2026-08-28): indent the quote Overview
- Indented the Project Overview paragraph a little from both edges (`px-6`). Font
  was already correct (confirmed against a screenshot) — no font change.

## Iteration — v2.115 (2026-08-28): project Description on About tab + quote Overview
- The project `description` (seeded from the brief's parsed **summary** at
  creation) had no UI — added a multiline **Description** field to the **About**
  tab (new `textarea` type on the shared `EditFieldComponent`). Edits the
  existing column via the standard project PUT (schema/EDITABLE already allowed
  it).
- **Quote document** now renders it as a **Project Overview** paragraph under the
  banner (markdown), when present.

## Iteration — v2.114 (2026-08-28): B&W Project Total is solid black
- In **B & W**, the Project Total is now a **solid black bar with white text**
  (matching the bold Default gradient treatment, just mono). Pick-a-Colour still
  uses the tinted bar.

## Iteration — v2.113 (2026-08-28): Default theme uses the Ballpark brand gradient
- **Default** shading now uses the soft Ballpark brand gradient
  (`--bp-gradient-soft`, translucent pink→green) on the section bars / banner /
  footers instead of neutral fill — readable dark text stays.
- **Project Total** (Default theme) is the **full `--bp-gradient` with white
  text**, matching the app's brand total banner. B&W / Pick-a-Colour keep the
  neutral/tinted treatment.

## Iteration — v2.112 (2026-08-28): Options panel + persist document choices per project
- Moved the colour picker into a right-side **Options** panel (standard Ballpark
  `bp-card` chrome), and added an editable **Footer** field there (was the
  hardcoded "Excludes VAT."). Panel is screen-only (outside `.quote-doc__paper`,
  so the print rule hides it).
- **Persisted per project**: 3 nullable columns — `quote_theme_mode`,
  `quote_theme_color`, `quote_footer` (all schemas in migrate-schemas; targeted
  `ALTER` on `public` for dev). Wired through `ProjectUpdateSchema`, the
  `EDITABLE` map, `toDetail`, and client `ProjectDetail`/`ProjectUpdate`. The
  document seeds from these on open and saves via the project-owner `PUT
  /api/projects-v2/:id` on each change (mode click, colour commit, footer blur).
- Supersedes v2.111's session-local note.

## Iteration — v2.111 (2026-08-28): document colour themes (Default / B&W / Pick a Colour)
- Theme picker in the action bar: **Default** (theme accent), **B & W** (mono —
  grey icons, neutral bars), **Pick a Colour** (native colour input). One
  `--doc-accent` var drives the icons + Project Total; `--doc-bar-bg` tints the
  shaded bars/banner (a light 12% `color-mix` wash of the picked colour).
- `print-color-adjust: exact` so the shading + colour survive Print/Save-PDF.
- **Session-local for now** — not yet persisted per project (next, if wanted: a
  `quote_theme` column).

## Iteration — v2.110 (2026-08-28): center + enlarge section titles
- Section heading bars (Project Costs / Coverage / Fees / Summary) are now
  **centered** and a **touch larger** (`--text-md`). Subtotal/total footers left
  as-is.

## Iteration — v2.109 (2026-08-28): sections as boxed cards + Project Summary
- Each section (Project Costs / Coverage / Fees) is now a **rounded, bordered
  container** with a **shaded heading bar** and a **shaded subtotal footer** —
  matching the title banner + tile styling.
- New **Project Summary** section (same container): Project Costs / Coverage /
  Fees rows + an emphasized **Project Total** footer.
- **Tile values centered** (Date/Location/etc), under a centered icon+label.

## Iteration — v2.108 (2026-08-28): title banner (company + project) + Created timestamp
- **Title banner**: company name (client) + project name in one **shaded**
  (`bg-fill`) container, **rounded + bordered to match the tile boxes**, centered.
  Replaces the plain `<h1>` + subtitle.
- **Created** now shows date **+ time on a 24h clock** — e.g. "25 Aug 2026 13:10"
  (short month).

## Iteration — v2.107 (2026-08-28): agency address wraps + meta as a shaded table
- **Address** now wraps on commas and drops the country — each comma-part of
  `address` is its own line, then `city` on a final line ("Ballpark House,
  Kensington" + "London" → 3 lines).
- **Meta block** is a **2-col table**: shaded label column (Project / Type /
  Created), **left-justified** values, sized to match the address (`bp-meta`).

## Iteration — v2.106 (2026-08-28): quote document polish — agency header + shaded totals
- **Agency header**: was wrongly showing the *client* name. Now fetches the
  signed-in **agency org** (`GET /api/organisation`) and renders its **logo +
  name + address** (address · city · country).
- **Meta block** reordered to labeled rows: **Project | {ref}**, **Type |
  Ballpark Quote**, **Created | {createdAt}** (long form, e.g. 31 December 2024).
- **Subtotal rows** (Total Project Costs / Total Coverage / Total Fees) and
  **Project Total**: UPPERCASE, **shaded** (`bg-fill`) with a **line below**
  (`border-b-2`). **Project Total** label now sized to match the amount
  (`bp-price-large`).

## Iteration — v2.105 (2026-08-28): step 2 — editable agent (quote) description per line
- New **`project_items.quote_description`** column (all schemas in migrate-schemas;
  targeted `ALTER` run on `public` for dev). The **agent's client-facing line
  description** — what prints on the Quote document. Agent-owned on ANY line,
  **defaults to the supplier text** when null.
- **Server:** `QUOTE_LINE_JOIN` + `toQuoteLine` expose `quoteDescription`. New
  `setQuoteDescription(orgId, projectId, lineId, text)` service + `PUT
  /:id/items/:itemId/quote-description` route — **project-owner scoped**
  (`p.org_id = orgId`, not line ownership), writes the separate column, never the
  supplier's `description`. null/'' clears (falls back to supplier text).
- **Client:** `QuoteLine.quoteDescription`; `ProjectService.setQuoteDescription`.
  The estimate **right-rail** (click a cost-card line) now shows an editable
  **"Description · on quote"** block for every line — pencil → textarea seeded
  from the current client text (agent override, else supplier default) → Save
  (`setQuoteDescription` + reload). Item-preview's own description is suppressed
  there (`showDescription=false`) so there's one description, not two.
- **Document** renders `quoteDescription || description`, so edits show on print.
- Resolves the step-2 deferral from v2.100. Marketplace lines are now editable by
  the agent (the ownership gap that pushed us off per-item is closed by the
  separate agent-owned column).

## Iteration — v2.104 (2026-08-28): tile value in the item-title font + NATO dates
- Stacked tile **value now uses `.bp-list-title`** (same font/size/weight as item
  names like "Awards Ceremony AV Package") instead of the lighter `.bp-body-small`.
- **Date tile is NATO** (`31-Dec-2024`) when the stored `eventDate` parses to a
  real date; freeform values (e.g. "Q4") are left as-is. Applies wherever the
  tiles render.

## Iteration — v2.103 (2026-08-28): document meta tiles stack the value under the label
- The document's meta tiles were truncating ("31 D…", "£100,…"). Added a
  `stacked` variant to `ProjectSummaryTilesComponent` — icon + label on top, the
  value full-width below (no truncation). The document opts in; the builder keeps
  its compact layout.

## Iteration — v2.101 (2026-08-28): quote document header — Date/Location/Duration/Guests/Budget tiles
- Added the 5 project-meta tiles to the quote document header by **mounting the
  existing `ProjectSummaryTilesComponent`** (Date=calendar, Location=map-pin,
  Duration=clock, Guest count=users, Budget=wallet) — same values + icons as the
  builder, no rebuild.

## Iteration — v2.100 (2026-08-28): client-facing Quote DOCUMENT (step 1 — read-only render + print)
- New `QuoteDocumentComponent` — the Final Quote rendered as the agency-SOW
  **document**: header (client/project) → **Project Costs** banded per category
  (category Lucide icon + name, like the cost cards) → **Project Coverage**
  (contingency + insurance %) → **Project Fees** → summary totals. Every line is
  one shape: **name · description · qty · unit · cost**. Margin folded silently
  into Project Costs (never shown); VAT excluded.
- Reached via a **"View as document"** button on the Final Quote; renders as a
  full-viewport overlay with a **Print / Save PDF** action (screen-only) and
  "Back to builder".
- **Print isolation** (global `styles.css`): the overlay sets `body.quote-doc-open`
  and a `@media print` visibility-flip shows only `.quote-doc__paper` (survives
  nesting), strips the app chrome + action bar, `@page A4`.
- Uses the **app font + real category icons** (no bespoke chrome). Descriptions
  render the line's current text (supplier default) via the markdown pipe — the
  agent-owned `quote_description` override is **step 2** (next).
- Registered the `Printer` icon. Wired into `project-detail` (`docView` signal).
- Deferred (step 2): `quote_description` column + inline edit on the cost cards.
  This ships the read-only look first for review, per Liam ("just build it and
  we'll review").

## Iteration — v2.99 (2026-08-27): Insurance is a % of project costs (drop fixed-£ mode)
- Confirmed against the actual Lucky Saint SOW: contingency **@5%** and
  insurance **@2%** were BOTH struck off the **same £23,853 project-cost
  subtotal**, in parallel (5% = £1,193, 2% = £477; insurance is NOT stacked on
  contingency). So insurance is now simply a **% of the (marked-up) project
  costs**, exactly like contingency.
- **Removed the fixed-£ insurance mode entirely** (Liam: "if they want a fixed
  insurance cost they can set that to 0 and add an item to the fees"). The
  Insurance row is now a plain % editor; a flat insurance charge is entered as a
  Fees line instead.
- `estimate.js`: `insurance = projectCosts × insurancePct%` (default 0); dropped
  the `insuranceAmount` branch. `projects.service.js`: dropped `insuranceAmount`
  from both `computeEstimate` calls, the two SELECTs, `EDITABLE`, and `toDetail`.
  `ProjectUpdateSchema` + client `ProjectDetail`/`ProjectUpdate` drop
  `defaultInsuranceAmount`. The `default_insurance_amount` **column is left
  dormant** in migrate-schemas (harmless, like `parent_item_id`).

## Iteration — v2.98 (2026-08-27): Contingency / Insurance / Margin are editable inline
- The three Coverage rates are now **editable inline** with a control **visually
  identical to the quantity stepper** (Liam: "make the entry field identical to
  the count number") — new `RateInputComponent` reuses the `.bp-qty-stepper` /
  `.bp-qty-step` / `.bp-qty-input` chrome but allows **0 and decimals** (rates,
  not counts), commits on blur/Enter and on each −/+ press.
- **Contingency** edits `defaultContingencyPct`. **Margin** edits
  `defaultMarginPct` — and its stepper only appears **when the eye reveals** the
  row (hidden otherwise, so a client never sees it). **Insurance** edits the
  **active mode**: a % if one is set (`defaultInsurancePct`), else the fixed £
  (`defaultInsuranceAmount`, £50 steps).
- Persist → `PUT /api/projects-v2/:id` then **reload the server cascade**, so
  every total (and the project card) recomputes from the source of truth.
- Server: `ProjectUpdateSchema` + the `EDITABLE` map + `toDetail` now carry
  `defaultInsurancePct` / `defaultInsuranceAmount`; client `ProjectDetail` /
  `ProjectUpdate` gain the same two fields. (Columns already existed — no schema
  change.) Clears the v2.95 TODO (insurance had been DB-only).

## Iteration — v2.97 (2026-08-27): Coverage margin row reads "Other", details hidden until the eye
- The Coverage card's margin row now shows just **"Other"** with **no
  description** by default (Liam: it shouldn't read "Margin" / "20% — already in
  Project Costs" on the page). Clicking the **eye** reveals the description
  (`Margin {{pct}}% — already in Project Costs`) and unmasks the amount.

## Iteration — v2.96 (2026-08-27): SOW cascade — margin silently marks up Project Costs
- Reworked the estimate cascade to the agency **SOW model** (ref
  `docs/sow-invoice/EXT 1901 X LUCKY SAINT.xlsx`). One formula, server-side
  (`services/estimate.js`), consumed by BOTH the project card and the Estimate
  tab so they can't drift. **App-wide** — project cards recompute too.
- **Margin silently marks up the hard-cost lines.** A supplier agrees $1,000 in
  the inbox (shown raw there); Project Costs shows **$1,200** —
  `projectCosts = hardCosts × (1 + margin%)`. Margin % defaults from the
  project's `default_margin_pct` (seeded from the org's supplier %); house
  default 20%. The uplift is applied to every hard-cost line, its unit price,
  its line total, the category total, and nested option rows.
- **Cascade:** `projectCosts = hard × (1+margin%)`; `contingency` = % of
  projectCosts; `insurance` = % of projectCosts **or** a fixed £ (% wins);
  `coverage = contingency + insurance`; **`fees`** = the agent's own
  uncategorised lines, added **flat (no markup)**; `projectTotal = projectCosts
  + coverage + fees`. **VAT dropped** for now (removed `DEFAULT_VAT_PCT`, the
  Your-cost/Margin/VAT rows).
- **Server split the subtotal** into `hard_subtotal` (categorised) +
  `fees_subtotal` (uncategorised) via a `LATERAL` `FILTER` subquery in both
  `LIST_SELECT`/`cardBallpark` and `getEstimate`.
- **Summary box** (`estimate-breakdown.component`) now shows exactly **Project
  Costs / Project Coverage / Project Fees / Project Total** — **margin and VAT
  are NOT shown**, so a client viewing the page never reads the markup off it.
- **Margin reference row** on the Coverage card: grayed out, `% — already in
  Project Costs`, amount masked as `••••` behind a **discreet eye toggle**
  (`showMargin`) to reveal/hide it. It is a reference only — NOT added to
  coverage (margin already lives in Project Costs).
- Client type `EstimateBreakdown` rewritten to `{ hardCosts, marginPct,
  marginAmount, projectCosts, contingencyPct, contingency, insurancePct,
  insurance, coverage, fees, projectTotal, subtotal, clientTotal }`
  (subtotal/clientTotal kept as back-compat aliases).

## Iteration — v2.95 (2026-08-27): Final Quote as 3 sections (Project Costs / Fees / Project Coverage)
- The Final Quote is now laid out as the SOW's **three sections**: **Project
  Costs** (real category cards) → **Fees** (the agent's own "Project" card) →
  **Project Coverage** (a fake card with **Contingency** + **Insurance** rows).
  Contingency/insurance moved out of the Fees card into Coverage. (Cart still
  shows one list.)
- **Insurance supports BOTH modes** — a **% of costs** *or* a **fixed £**
  (`default_insurance_pct` wins if set, else `default_insurance_amount`, else 0).
  New `default_insurance_amount` (projects + orgs, in migrate-schemas). Apple set
  to a £477 fixed value for the demo.
- **TODO:** insurance is set via DB for now — no inline edit UI yet on the
  Coverage card (next).

## Iteration — v2.94 (2026-08-27): Insurance (below Contingency) in the cascade
- New **`default_insurance_pct`** on projects + orgs (all schemas, in
  migrate-schemas.js; house default **0** so existing totals are unchanged).
- **estimate.js cascade** now applies insurance beside contingency:
  `ourCost = subtotal + contingency + insurance` (both % of subtotal, matching
  the SOW's costs-ex → +contingency +insurance → costs-inc). Breakdown gains
  `insurancePct` / `insurance`.
- Displayed **below Contingency** in the Project section + in the breakdown table
  (breakdown row only when > 0). Apple set to 2% for the demo.

## Iteration — v2.93 (2026-08-27): always-present "Project" section + Contingency row
- The Final Quote's uncategorised bucket is relabelled **"Project"** and is
  **always shown** (even empty) — the home for the agent's own self-entered costs
  (fees / legal), sorted last.
- It carries a **Contingency** row: a **% of costs from the project**
  (`bd().contingencyPct` / `bd().contingency`) — displayed, not an item, can't be
  removed. No category creation / no schema change (chosen over free-text
  categories "for now").

## Iteration — v2.92 (2026-08-27): custom agency lines aren't "sendable"
- **Fix (regression from v2.90):** the supplier-name agency fallback had also
  moved into `supplier_id` (the LOGIC field), so an agent's own custom line
  looked like it had a supplier → swept into "Message Suppliers" / Explore More.
  Reverted `supplier_id` to `COALESCE(supplier_org_id, i.org_id)` (NULL for
  custom); only the NAME/city/currency keep the agency fallback (display).
- The Final Quote **status pill ("To send") is hidden for lines with no real
  supplier** — an agent's own line never gets sent, so it just shows "Custom".

## Iteration — v2.91 (2026-08-27): fix Add-from-Uncategorised + category picker shows all categories
- **Bug:** "Add Your Own Line Item" from the **Uncategorised** card sent
  `categoryId: '__none'` (groupByCategory's synthetic bucket id) → the route's
  `z.string().uuid()` rejected it → "Couldn't save the line(s)". `openAdd` now
  normalises `'__none'` → `null`.
- The inline editor's **category picker now lists ALL top-level categories**
  (via `CatalogueService.categories()`), not just the ones already in the quote —
  so a line (e.g. 1901 Fees) can be moved to any category.

## Iteration — v2.90 (2026-08-27): agent edits their own lines on the Final Quote (shared LineEditor)
- **New shared `LineEditorComponent`** (name / **cost** / **unit** / **category** /
  description / services / details) — extracted so the inbox revised card and the
  Final Quote rail share ONE editor (extract-before-duplicate). Reuses the
  editable `item-preview` (now with an editable **unit** input) + the category
  `<select>` + the Details field (shared `details-format` calc/total).
- **Final Quote**: the agent's **own custom lines** (fees / legal / self-entered)
  are now editable inline on the rail card — "Edit line" → the LineEditor → Save
  writes **directly** (no negotiation). `estimate-preview-rail` gained the edit
  state + save; `project-estimate` passes categories/canEdit and reloads on save.
- **Inbox**: the revised-card editor is now the same `LineEditor`; a price change
  still fires the "New Cost Suggested" proposal (parent decides direct vs
  proposal).
- **Server**: `updateLineDetails` now also sets `base_price` / `unit` /
  `category_id` (agent's own lines). `QUOTE_LINE_JOIN` supplier now falls back to
  the **project's agency** so a custom line (no supplier) shows the **agency
  name**, not blank. No new columns (base_price/unit/category_id already exist).

## Iteration — v2.88 (2026-08-27): Final Quote card shows Details (reuses item-preview)
- The Final Quote right-rail card (`estimate-preview-rail`) now shows the line's
  **Details** (markdown + running total) under the reused `item-preview` — same
  project-item card, no new component.
- Extracted the Details parse/calc/total to a shared `details-format.ts`
  (`detailsCalcLine` / `detailsTotalStr` / `currencySymbol`); the inbox now
  delegates to it (one definition, no drift between inbox + Final Quote).

## Iteration — v2.87 (2026-08-27): Details renders like Description + Enter inserts at caret
- Details now renders in **prose mode** (was heading-mode, which bolded every
  non-bulleted line) — plain lines are normal, `**bold**` when chosen, same as
  Description.
- **Enter inserts a newline at the caret** and recomputes only the caret's line —
  fixes rows only appearing at the bottom and "carriage returns ignored".

## Iteration — v2.85 (2026-08-27): Details is a clean markdown text field (was forced-bullet components)
- Details no longer forces bullets or splits into components. It's now a **clean
  free-text field** like Description — new nullable `project_items.details` (all
  3 schemas, in migrate-schemas.js), saved via `updateLineDetails`.
- Read-only renders via the MarkdownPipe in **heading mode** (a non-bulleted line
  = bold sub-heading, so `Catering` / `Extras` headings + `- ` bullets read as an
  outline — the category structure, purely as text). Header total + `qty@price`
  calc still work (recompute on blur/save; totals baked into the saved text).
- Note: previously-saved component "extras" don't render here anymore (moved to
  the text field); re-enter as text.

## Iteration — v2.84 (2026-08-27): markdown rendering + comma totals
- New shared **`MarkdownPipe`** (`| md`) — a SAFE bold/italic/list subset
  (escapes first, emits only strong/em/ul/li/p; no bypassSecurityTrust). Wired
  into `item-preview` Description + Services, so formatting renders wherever the
  card shows (inbox, estimate rail, marketplace rail). `heading` mode renders a
  non-bulleted line as a bold sub-heading (for the coming Details categories).
- Details calc totals now use **thousands separators** (`= £18,000`); the header
  total + parser handle commas.

## Iteration — v2.83 (2026-08-27): recalc a line on blur (edited operand)
- Editing an operand (e.g. `100x2` → `100x3`) left the "= total" stale until
  Enter/Save. The textarea now recomputes every line on **blur**, so leaving the
  field (or clicking Save) updates the line totals. Header total already updated
  live. An expression stays the source of truth — for a custom total, drop the
  x/@.

## Iteration — v2.82 (2026-08-27): Details calc also supports N×M (x / × / *)
- The calc now accepts `x` / `×` / `*` as well as `@`: `fridge 150x2 → = 300`,
  `£150x2 → = £300`. Evaluates the expression **in place** and appends the
  result, so `fridge = 150x2` becomes `fridge = 150x2 = 300` (keeps the maths
  visible). The trailing-result strip is now number-only, so it never eats the
  expression. Caveat: a literal `6x6` in a name would also be multiplied.

## Iteration — v2.81 (2026-08-27): Details header shows a running total
- The Details header now shows a **total on the right**, but **only when lines
  carry costs** (sum of each line's trailing "= <total>", incl. manual ones like
  "fridge = £150"). Live in the editor (recomputes as you type), and on the
  read-only card. Symbol follows the **lines' own sign**, falling back to the
  supplier currency for unsigned entries.

## Iteration — v2.80 (2026-08-27): Details calc defaults to the SUPPLIER currency
- An unsigned "qty@price" defaults the total's symbol to the **line's supplier
  currency** (`orgs.default_currency`), falling back to the project currency,
  then £. Carried on the QuoteLine as `supplierCurrency` via
  `o.default_currency` in `QUOTE_LINE_JOIN`. A typed `$`/`£` still wins.

## Iteration — v2.79 (2026-08-27): Details calc defaults to the project currency
- An unsigned "qty@price" defaulted the total's symbol to the **project's
  currency**. Plumbed `currency` onto the inbox project summary (kept as the
  fallback after supplier currency). Superseded by v2.80.

## Iteration — v2.77 (2026-08-27): "Details" section — bulleted extras saved as components
- New **Details** section under Services on the revised edit card: an
  auto-bulleted textarea (Enter finalises the line + starts a new "• " bullet).
- Each line = a **name-only child component** (reuses `saveComponents`, which also
  clones each name up to the org's reusable component library). **No price impact
  — excluded from totals like every component.**
- Inline calc: a "qty@price" in a line auto-totals into the text
  (`Wine Pairing 100@£15` → `Wine Pairing 100@£15 = £1500`); forgiving of $/£ and
  a trailing "=", idempotent.
- The line carries its extra names via an `array_agg` in `QUOTE_LINE_JOIN`
  (`extras: string[]`); the read-only card lists them as bullets under Details.

## Iteration — v2.74 (2026-08-27): edit the price on the revised card → triggers a cost proposal
- The revised-card editor now also lets the supplier **change the price** (new
  `item-preview` inputs `priceEditable` + `priceChange` output — a number input
  in place of the price display).
- On **Save**, if the price changed, it fires the **same "New Cost Suggested"
  proposal as the propose flow** (`itemAction('adjust', newRate, …)`): posts the
  chat line (`<name> <fromTotal> New Cost Suggested <newTotal> by <actor>`) and
  sets `price_current`. Text-only edits still just save via `updateLineDetails`.
- Totals in the message use `lineCost` (install-aware), matching submitPropose.

## Iteration — v2.73 (2026-08-27): revised card price drops the "From" prefix
- New `item-preview` input `showFromPrefix` (default true); set `false` on the
  revised card (it carries a firm agreed cost, not an indicative "From £X").
  Original card + marketplace/estimate previews keep "From".

## Iteration — v2.72 (2026-08-27): revised card appears once (latest revision)
- The revised item card previously rendered under **every** "New Cost Suggested"
  message. Now it renders **only under the most recent** proposal
  (`lastProposalMessageId`), so it appears once and reflects the last-edited
  line. Original card untouched.

## Iteration — v2.71 (2026-08-27): hide the store-item link on inbox cards
- New `item-preview` input `showStoreLink` (default true); set `false` on the
  inbox conversation cards (original + revised) so the header no longer shows the
  "view/edit product" link (external-link square-with-arrow) that jumped out to
  the library. Other surfaces (marketplace rail, estimate rail) keep it.

## Iteration — v2.70 (2026-08-27): click-to-edit on the REVISED card, not the original
- Moved the inline click-to-edit from the brief "original item" card to the
  **Revised item** card (Liam: "click to edit the revised not the original").
  The revised item is what the supplier changed, so that's the one they annotate.
- Original/brief card is back to read-only; the Revised card is read-only until
  the supplier clicks it → editable (Description/Services/Name) + Save/Cancel.

## Iteration — v2.69 (2026-08-27): edit inline in the conversation, not a button
- Replaced the "Edit item" button + separate editor pane with **inline
  edit-in-place** on the item card in the conversation (Liam: "I was thinking we
  would edit directly in the inbox conversation").
- The brief **item card is read-only; the supplier clicks it → it becomes
  editable** (Name/Description/Services), with **Save / Cancel at the bottom** of
  the card. Agent view stays read-only (no click-to-edit).
- `item-preview` header controls (store link + minimise chevron) now
  `stopPropagation`, so clicking them doesn't trigger the card's enter-edit.
- Same `updateLineDetails` PATCH; the button + `updateLineDetails` service/route
  from the previous iteration are unchanged.

## Iteration — v2.68 (2026-08-27)
- **Revised item card is now show/hide collapsible**, same pattern as the brief
  "original item" attachment: collapsed = paperclip + name + a muted "Revised"
  pill + chevron; expands in place to the item-preview (minimise chevron).
  Defaults collapsed; independent toggle from the original (different message id,
  same `toggleAttachment(messageId, lineId)` key).
- Name is editable because the shared card exposes it; can be locked to
  description+Services only if wanted.
