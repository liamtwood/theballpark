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
