# pV2-DIALOG-SHELL-01 — One dialog shell (`app-modal`) + standardisation

**Date:** 2026-11-12 · **Branch:** `rebuild/org-slice` · Interactive design pass with Liam.

## Problem

Dialogs were built two ways — PrimeNG `p-dialog` + `bp-modal` chrome for most, but
four project dialogs were hand-rolled `fixed inset-0` overlays. Even the `bp-modal`
ones hand-wrote header/footer, so chrome drifted: some footers had the hairline
separator, some didn't; buttons mixed `bp-btn-grad`/`bp-btn-outline`/`bp-btn-cancel`/
`bp-btn-accent`; form fields split between two systems (`ed-label`/`ed-input` on pages
like Profile vs `bp-field-label`/`bp-input-field` in some dialogs); "Close" vs "Cancel"
was inconsistent. Changing "the dialog standard" meant editing ~13 files.

## What shipped

**`app-modal`** — the ONE dialog shell (`client-v2/src/app/shared/modal/modal.component.ts`).
Wraps `p-dialog` + `bp-modal` once and exposes: `title`/`subtitle` (or a `[modalHeader]`
slot for custom headers), a body slot, a `[modalFooter]` slot that lands in the real
footer (so the hairline separator is automatic and can't be forgotten), `width`/`maxWidth`,
`closable`/`dismissable`, `variantClass` (e.g. `bp-modal--confirm`), and a `shown` output
forwarding `p-dialog`'s `onShow`. Change the standard here → every dialog follows.

**Standards locked (Liam):**
- **Buttons** = semantic `bp-btn--primary` / `bp-btn--secondary` (+ `bp-btn-danger`
  destructive, `bp-act--green/red` status). NOTE: `bp-btn-grad`/`bp-btn--primary` are the
  SAME solid `--theme-accent` rule — the gradient was flattened app-wide back on
  2026-09-21, so DESIGN.md §8's "gradient reserved" text is stale; the button pass was a
  pure rename, zero visual change.
- **Fields** = `ed-label` / `ed-input` / `ed-textarea` everywhere (the Profile/page
  standard), retiring the indented `bp-field-label`+`pl-3` system in dialogs.
- **Dismiss label** = "Cancel" for editor dialogs, "Close" for viewers.
- **Separator** = always on (footer slot).

**13 dialog surfaces migrated onto `app-modal`:** edit-details (project-detail),
invite-supplier, custom-line, message-suppliers, confirm (shared), add-to-project,
add-to-active, reclassify (shared), report-issue, team invite, team remove, category
tagline, item volume, item variants. The four bespoke `fixed inset-0` overlays are gone.

**Gotcha fixed:** named-slot content projection (`select="[modalFooter]"`) drops nodes
that sit inside a multi-root `@if` (NG8011). Confirm + invite-supplier footers were
restructured to one projected node per `@if` branch.

## Also in this pass (pV2-PROJ-ONEVIEW-01)

The project **one-view** work rides in the same commit (shared files): one view across
Draft/Active (hero image-driven then simplified to always-overview; per-supplier status +
payment reveal on state; Details tab hidden; **Edit details** dialog off the hero with a
show/hide **Financials** region — Currency/Margin/Contingency/VAT; budget thousands
separators). See `prompts/pV2-PROJ-ONEVIEW-01-shipped.md` for the full decision log.

## Files touched

Shell: `shared/modal/modal.component.ts` (new). Dialogs: `shared/confirm/confirm-dialog`,
`shared/catalogue/reclassify-dialog`, `pages/marketplace/add-to-project-dialog`,
`pages/marketplace/add-to-active-project-dialog`, `pages/projects/invite-supplier-dialog`,
`pages/projects/custom-line-dialog`, `pages/projects/message-suppliers-dialog`,
`pages/feedback/report-issue-dialog`, `pages/settings/team/team.component`,
`pages/settings/categories/categories-settings.component`,
`pages/store/item-edit.component`. One-view: `pages/projects/project-detail`,
`project-estimate`, `project-overview-hero`, `project-details-fields`.

## Acceptance

Compiles clean on dev2 (:4202) throughout. Liam QC'd the project-page dialogs (add line,
add outside supplier, edit details) + confirm — chrome, separators, buttons, labels match.

## Concerns not in spec

- **Quick-view is NOT on `app-modal`** — still `p-dialog` (custom header + footer slots,
  swipe/ResizeObserver). Its single-view redesign ships separately (pV2-STORE-QUICKVIEW-02);
  migrating its shell onto `app-modal` is a deferred follow-up.
- DESIGN.md is now out of date vs the code (gradient flattened; `app-modal` now real; the
  `ed-*` field standard). A DESIGN.md reconcile is owed.

## QC notes
(Liam)

## Chat audit
(chat)
