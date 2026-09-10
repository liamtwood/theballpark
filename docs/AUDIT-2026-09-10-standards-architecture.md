# Client-v2 Audit — Standards Consistency & Zoneless Architecture

**Date:** 2026-09-10 · **Scope:** `client-v2/src/app` (pages/, shared/, shell/) · **Method:** read-only, 98 components inspected · **Reference standards:** `client-v2/src/styles.css`, `shared/details-format.ts`, and the shared components (workspace layout, `ed-*` kit + `app-save-state-pill`, `app-tab-band`, `app-status-pill`).

> **Peer review (2026-09-10):** an independent standards+architecture sweep corroborated this report cleanly (behemoth table exact match, `subscribe`/`.bp-*` instances line up, the "98/98 OnPush+standalone, zero `*ngIf`/`@Input`, no leaks" verdict holds). It added the **server-side** findings now captured in §6 (verified here) and noted the `.bp-*` cluster's true scale (§1). A fuller peer audit is still running and will be merged when it lands.

## Headline

The codebase is in genuinely good shape on the hard architecture rules — **zero** `*ngIf/*ngFor`, **zero** `@Input()/@Output()` decorators, **98/98** components on `ChangeDetectionStrategy.OnPush`, all standalone, signals used pervasively, no subscription leaks, PrimeNG `pTemplate` traps all handled correctly. The real debt is three concentrated clusters:
1. Settings/store pages still on the **legacy `app-edit-field`/`app-edit-section`** kit instead of the `ed-*` save-on-blur kit.
2. **Duplicated formatters** (`natoDate`, currency, long-date).
3. A handful of **very large components** (top file 1052 lines).

---

## 1. Standards-consistency findings

### Legacy edit kit (Standard 2 — always-editable `ed-*` + `app-save-state-pill`)
- **High** — `pages/store/item-edit.component.ts:46,66,68-123` — entire page on `EditFieldComponent` + Edit/Save toggle (`[editing]="editing()"`, `bp-edit-section-title`). Migrate to `ed-card/ed-input/ed-select` with save-on-blur.
- **Med** — `pages/settings/profile/profile-team-section.component.ts:34,58,62-64` — legacy `app-edit-section` + `app-edit-field`. Sibling `profile.component.ts` is already the `ed-*` reference.
- **Med** — `pages/settings/categories/categories-settings.component.ts:58-131` — 8× `app-edit-field` (`[editing]="true"`) inline table editing → `ed-input/ed-select`.
- **Med** — `pages/settings/pages/pages-settings.component.ts:52-145` — 8× `app-edit-field` → same fix.
- **Med** — `pages/settings/codelists/codelists-settings.component.ts:96-98` + `codelist-value-row.component.ts:24-39` — legacy `app-edit-field` row editors → same fix.
- **Med** — `shared/catalogue/filter-band.component.ts:32-72` — shared component on legacy `app-edit-field` (propagates the legacy pattern to every catalogue consumer). Higher blast radius — confirm scope first.

### Re-inlined / re-declared shared tokens (Standards 4/5/6)
- **Med** — `pages/settings/coachmarks/coachmarks-settings.component.ts:39` — re-inlines a save indicator (`<span>Saved ✓</span>` driven by `savedId()`). Replace with `app-save-state-pill`.
- **Med** — `pages/projects/message-suppliers-dialog.component.ts:94-106` — redefines global pill classes locally (`.bp-pill`, `.bp-pill--warn`, `.bp-pill--success`). Delete; rely on global. **Scale (peer sweep):** local `.bp-*` re-declarations are broader than this one sample — ~128 hits across ~20 files, concentrated in `early-access` (45), `recent-projects-card` (13), `page-hero` (12), and the launcher family. Worth a dedicated sweep, not just this file.
- **Med** — `pages/projects/quote-line.util.ts:13-24` — hard-coded `status → bp-pill--*` map instead of codelist-driven `app-status-pill`.
- **Low** — `pages/inbox/inbox-landing.component.ts:155-157` — `pillClass()` hand-maps a derived roll-up to `bp-pill--danger/outline/success`. Acceptable if derived (not a codelist status) — see Notes.
- **Med** — `pages/projects/project-overview-hero.component.ts:26,34,36` — raw colours in the newest code: inline text `#fff` / `rgba(255,255,255,0.92)` (need an on-gradient text token) **and a hardcoded `#f5add0/#d63384` gradient fallback** (Rule 2, tokens-only). Bumped from Low — fresh raw-hex in new code is the thing most likely to spread; fix before it's copied.
- **Low** — `pages/projects/project-overview-hero.component.ts:78-99` — bespoke `font-size`/`font-weight` (via `--text-*` tokens) instead of the type classes.
- **Low** — ad-hoc element widths (`max-w-[60%]`, `max-w-[120px]`) in `item-preview.component.ts:110`, `project-overview-hero.component.ts:36`, `quote-document.ts:77`, `sow-document.ts:49` — element-level, not page columns; low priority.

### Layout / gutter alignment (Standard 1 — new `.bp-gutter`)
- **Med** — `.bp-gutter` is used **only** by `project-detail.component.ts`. Other hero+tabs+scrolling-body pages (`settings/profile`, `suppliers/supplier-detail`, `marketplace/marketplace-page`, `projects/projects-page`) use `bp-vpfit` + `bp-page-body--workspace` but not `bp-gutter`, so their centred body can shift under the non-scrolling hero when a scrollbar appears. Add per page **after a visual check** — pages that scroll per-column (catalogue) don't need it (see Notes).

### Duplicated formatters (Standard 6 — no transitional duplication)
- **Med** — `pages/projects/project-summary-tiles.component.ts:6-16` — re-defines `natoDate` + local `MONTHS` identically to shared `details-format.ts:55-65`. Import the shared one (siblings already do).
- **Med** — currency formatting fragmented 3 ways: shared `withCommas()`, `gbp()` (`inbox-status.ts:91`), and ad-hoc `toLocaleString('en-GB')` across `agent-rail.component.ts` (~10 sites: 351,368,404,505-672), `customize-dialog.ts:635`, `project-detail.ts:575,699`, `edit-field.ts:251`, `recent-projects-card.ts:172`. Consolidate on one shared money formatter.
- **Low/Med** — long-date `toLocaleDateString('en-GB',{day,month,year})` copy-pasted in `inbox-project.ts:556`, `quote-document.ts:444`, `sow-document.ts:277`, `early-access.ts:382`. Extract one shared helper.

---

## 2. Architecture findings (zoneless / Angular)

- **Med** — `pages/projects/options-picker.component.ts:71` — `ngOnInit` does `api.get(...).subscribe(...)` fetch-into-state → `resource()` keyed on `itemId()`.
- **Med** — `pages/settings/coachmarks/coachmarks-settings.component.ts:69` — `svc.list().subscribe(...)` from `ngOnInit` → `resource()`.
- **Med** — `pages/projects/custom-line-dialog.component.ts:218-232` — `effect()` watching `supplierId()/variant()/categoryId()` then `.then()`-loads `railItems` → textbook `resource(params → loader)`.
- **Med** — `pages/inbox/inbox-project.component.ts:820-832` — `custoLoader = effect()` re-runs on `selectedItem()` and `.subscribe()`s to set `custoTotal` → `resource()` keyed on the selected item.
- **Med (reads) / Low (writes)** — `pages/projects/customize-dialog.component.ts:554,558,828,845,860` — reads (`listMyComponents()` 554/860) belong in a `resource`; save-action subscribes (828/845) acceptable as commands (cleaner via `firstValueFrom`).
- **Low** — `shared/coachmark/coachmark.component.ts:57` — `coachmarks.resolve(...).subscribe(...)` read → `resource()` candidate.
- **Low** — `inbox-project.component.ts:1001-1005` + `agent-rail.component.ts:299-303` — auto-scroll `effect()`s using `setTimeout`/`queueMicrotask`; idiomatic zoneless tool is `afterRenderEffect`/`afterNextRender`.
- **Low** — `inbox-project.component.ts:2,32,53-54` — only file using `NgClass` (`[ngClass]` ternary) → `[class]` binding, drop the import.

**Clean:** manual subscriptions are all fire-and-forget one-shots (no leaks); no `effect()` write-loops; PrimeNG `pTemplate` templates are unconditional with `@if` nested inside (correct) in `add-to-project-dialog.ts:47-92` and `quick-view-dialog.ts:32-120`.

---

## 3. Component size offenders (WARN >250, ALARM >400)

> Line counts are whole-file (inline template + inline styles), so template-/print-heavy files overstate logic size. Weight ALARM by logic density.

| File | Lines | Level |
|---|---|---|
| pages/inbox/inbox-project.component.ts | 1052 | ALARM |
| pages/projects/customize-dialog.component.ts | 872 | ALARM |
| pages/projects/project-estimate.component.ts | 794 | ALARM |
| pages/projects/agent-rail.component.ts | 723 | ALARM |
| pages/projects/project-detail.component.ts | 707 | ALARM |
| pages/settings/early-access/early-access.component.ts | 532 | ALARM |
| pages/projects/quote-document.component.ts | 492 | ALARM (print doc) |
| pages/store/item-edit.component.ts | 402 | ALARM |
| pages/projects/projects-new.component.ts | 354 | WARN |
| shared/image-picker/image-picker.component.ts | 343 | WARN |
| pages/settings/profile/profile.component.ts | 329 | WARN |
| shared/catalogue/item-card.component.ts | 320 | WARN |
| pages/projects/custom-line-dialog.component.ts | 318 | WARN |
| pages/projects/sow-document.component.ts | 305 | WARN (print doc) |
| pages/marketplace/rail/item-preview.component.ts | 295 | WARN |
| pages/projects/project-marketplace.component.ts | 287 | WARN |
| shell/page-hero/page-hero.component.ts | 262 | WARN |
| shared/edit-field/edit-field.component.ts | 260 | WARN |
| pages/settings/codelists/codelists-settings.component.ts | 257 | WARN |
| shared/image-gallery/image-gallery.component.ts | 255 | WARN |
| pages/suppliers/supplier-detail.component.ts | 255 | WARN |
| pages/settings/pages/pages-settings.component.ts | 255 | WARN |

**Priority:** `inbox-project` (1052) — already extracts rail/preview/editor but still bundles conversation + compose + actions + customize + agent orchestration. `customize-dialog` (872) and `project-estimate` (794) next.

---

## 4. Quick wins (high value, low risk)

1. `project-summary-tiles.ts:6-16` — delete local `natoDate`/`MONTHS`, import from `details-format`.
2. `coachmarks-settings.ts:39` — swap inline `Saved ✓` for `app-save-state-pill`.
3. `message-suppliers-dialog.ts:94-106` — delete local `.bp-pill*` block.
4. `inbox-project.ts:53-54` — `[ngClass]` ternary → `[class]`; drop `NgClass` (last user).
5. `options-picker.ts:71` — `ngOnInit` subscribe → `resource()`.
6. `coachmarks-settings.ts:69` — list read → `resource()`.
7. Add `bp-gutter` to `profile` / `supplier-detail` scrolling body (after a visual check).
8. One shared money formatter in `details-format`; point `agent-rail`'s ~10 `toLocaleString` sites + `gbp()` at it.

---

## 5. Notes / needs a human decision

- **`.bp-gutter` rollout** depends on where the scrollbar lives: per-column scroll pages (catalogue via `catalogue-layout.component.ts`) don't get a body scrollbar and won't misalign; whole-body-scroll pages under a fixed hero/tabs do. Needs eyes on localhost per page (`profile`, `supplier-detail`, `marketplace-page`, `projects-page`).
- **`inbox-landing` pillClass** maps a *derived roll-up* (action-required / waiting / clear), not a codelist status — decide whether to formalise as a codelist or leave bespoke.
- **Legacy `app-edit-field`/`app-edit-section`** still exist and work; the settings/store cluster looks like a deliberate hold-out, not a bug. Migrating all is a ~7-file medium project — confirm scope before touching the shared `filter-band` (higher blast radius).
- **`customize-dialog`/`inbox-project` subscribes** — several are save/command actions where `.subscribe` is defensible; only the *reads* are clear `resource()` candidates.
- Server code was **not** inspected (out of scope).
