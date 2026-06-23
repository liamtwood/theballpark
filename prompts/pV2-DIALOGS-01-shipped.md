# pV2-DIALOGS-01 — Dialogs primitive family: modal / alert / toast / tooltip

**Shipped:** 2026-06-12, chip `[Dev v2] v2.21a`
**Commit:** `<sha set on push>` (single client-side commit)

## What landed

- **styles.css §Dialogs** per the DIALOGS.md locked specs: `.bp-modal` (p-dialog header/content/footer skin; the root rule is the COMPOUND `.bp-modal.p-dialog` — PrimeNG's runtime-injected theme lands after styles.css and wins a one-class tie, found in preview as a 12px radius); `--confirm` variant + `.bp-modal__icon`; `.bp-alert` + `__icon/__body/__dismiss` + the four severity variants; `.bp-toast` severity left-borders; `.bp-tooltip`.
- **`.bp-btn-danger` ships** (BUTTONS.md locked spec verbatim) — and its FIRST consumer arrives paired: the team remove-confirmation. The "danger never fires without a confirm" rule (RP-08 class) is honored from the archetype's first day in the codebase.
- **Team retrofits**: invite dialog → `bp-modal`; "Remove member?" rebuilt on the locked confirm template — trash icon block, `.bp-card-title` headline naming the member, `.bp-btn-outline` Cancel + `.bp-btn-danger` Remove, ESC + backdrop dismiss = Cancel per the interaction table.
- **Toasts** (team / profile / onboarding) → `styleClass="bp-toast"`; locked copy applied where the standard-messages table maps 1:1 ("Saved." 3s, "Couldn't save — please try again." 5s, invite success → "Sent.").
- **Inline alerts' first consumers**: /settings/codelists — the deactivation gate note → `.bp-alert--info` (role=status) and the error caption → `.bp-alert--danger` (role=alert), both with severity icon + dismiss X. (Login has NO error markup yet — the DIALOGS.md inventory's `/login` row is aspirational; noted below.)
- **Tooltip upgrade**: the card overlay buttons (item heart + plus, supplier heart) moved from native `title` to `pTooltip` with `tooltipStyleClass="bp-tooltip"` — the upgrade queued at v2.20r.
- Icons: Info + CircleAlert registered.

## Files touched

| File | SHA | Notes |
|---|---|---|
| client-v2/src/styles.css | v2.21a | §Dialogs (modal/alert/toast/tooltip) + .bp-btn-danger |
| client-v2/.../team.component.ts | v2.21a | bp-modal + locked confirm template + bp-toast + "Sent." |
| client-v2/.../profile.component.ts | v2.21a | bp-toast + locked save copy |
| client-v2/.../onboarding.component.ts | v2.21a | bp-toast |
| client-v2/.../codelists-settings.component.ts | v2.21a | gate note + error → bp-alert info/danger |
| client-v2/.../item-card.component.ts + supplier-card.component.ts | v2.21a | pTooltip bp-tooltip |
| client-v2/src/app/app.config.ts | v2.21a | Info, CircleAlert |

## Acceptance

- Locked specs verbatim — ✓ modal/alert/toast/tooltip CSS matches DIALOGS.md (one deviation: the modal root selector is compound for specificity, documented in-place)
- Confirm template — ✓ preview-verified: `--confirm` chrome, 20px radius, icon block, dynamic "Remove {{name}}?" headline, danger (`#b91c1c`) + outline buttons
- Alerts — ✓ preview-verified: info (soft blue, icon, dismiss, role=status) + danger (soft red, role=alert), X dismissal works
- Toast skin + copy — ✓ class applied at all three mounts; copy per the table
- Tooltip — ✓ preview-verified: hover shows "Add to Wishlist" on dark `--color-text` chrome with `bp-tooltip` class
- RP-08 — ✓ the only `.bp-btn-danger` in the tree is inside a `bp-modal--confirm`
- Greens — ✓ build / lint / style-guard / 67/67

## Concerns not in spec

### ESC-dismiss verified by configuration, not simulation
**What:** `[closeOnEscape]="true"` is set explicitly on the confirm dialog (PrimeNG default would disable it with `closable=false`), but synthetic ESC events don't trigger PrimeNG's document listener in the headless preview — real-keyboard QC confirms it.
**Severity:** LOW

### The DIALOGS.md inventory lists /login alerts that don't exist
**Where:** DIALOGS.md "Inventory" — `/login` → `.bp-alert--danger` inline.
**What:** The login page currently renders no error states at all (auth failures redirect with query params that nothing displays). The alert family is ready; wiring login errors is its own small ship when auth UX is next touched.
**Severity:** LOW (doc/reality drift — flag for chat's next doc pass)

### Toast copy applied selectively
**What:** Only 1:1 table mappings were changed (Saved. / Sent. / Couldn't save). Other messages (onboarding errors, team "Change rejected") kept their contextual copy — the table doesn't cover them and inventing standard phrasings is a doc decision.
**Severity:** LOW

### bp-modal--info has no consumer
**What:** The info-dialog variant ships as chrome only; first consumer when an acknowledgment flow lands (terms update, account hold). Dead-CSS-until-used, accepted — it is two rules riding the bp-modal base.
**Severity:** LOW

## Iteration — v2.21b (2026-06-13)
**Triggered by QC:** Profile save toast worked ("Saved." bottom-right); Team has no UI yet; on /settings/codelists, **add a row / toggle visible-hidden / add a duplicate produced NO message.**
**Root cause:** codelists only ever set INLINE signals — and only on the unhappy paths: a successful add and a clean visibility toggle set nothing, and the duplicate-add `bp-alert--danger` renders at the bottom of the detail column, below the values table (off-screen on a long list). DIALOGS.md rule 2: action OUTCOMES are toasts.
**Commit:** chip v2.21b
- Codelists now toasts every write outcome (MessageService + `<p-toast styleClass="bp-toast" position="bottom-right">`, same as Profile): add success → `Added "<label>".`; add duplicate (409) → `Couldn't add — a value with this code already exists in this list.`; row edit / clean visibility toggle → `Saved.`; any save failure → `Couldn't save — please try again.` (+ detail).
- The in-use deactivation gate STAYS an inline `bp-alert--info` (DIALOGS.md rule 3 — persistent context, not a transient outcome); when it fires, the save runs `silent` so the advisory isn't doubled by a "Saved." toast.
- The inline `bp-alert--danger` is now reserved for a values-LOAD failure (persistent — the page can't show data); renamed `error` → `loadError` for intent.
- Greens: build / lint / guard / 67 tests. **Live preview QC blocked** — the preview session expired to /login and the sandbox can't complete Google OAuth or reach cross-origin dev-login (CORS); pattern is identical to Profile's verified toast. Liam to confirm the three paths live.

## Iteration — v2.21c (2026-06-13)
**Triggered by QC:** Liam confirmed the codelists "Saved." toast renders ("green tick, ugly but there") and asked how to see the OTHER archetypes — they had no live trigger (modal/info on Team remove which has no UI; alerts only on codelists' unhappy paths; tooltip on cards).
**Commit:** chip v2.21c
- **`/style/dialogs` dev sandbox** (sibling of `/style/hero`, no guard): every archetype on one page — 4 toast severities (buttons), the 4 inline alert variants, a destructive confirmation modal (`bp-modal--confirm` + `.bp-btn-danger` + trash icon block), an info modal, and a tooltip. Lets each be QC'd before its real consumer surface exists.
- **Toast polish ("ugly"):** the v2.21a skin only styled the outer card; added inner rhythm — `p-toast-message-content` padding/flex, 18px severity-coloured icon, summary (500/text) + detail (sm/secondary) ranks, close-button colour.
- Icon `TriangleAlert` registered (warn alert).
- Greens: build / lint / guard / 67 tests. QC surface: **`/style/dialogs`** on your running :4201.

## Iteration — v2.21d (2026-06-13)
**Triggered by QC:** the duplicate-add toast doubled the line — summary "Couldn't add — a value with this code already exists in this list." over the server detail "Code already exists in this list."
**Commit:** chip v2.21d
- Dropped `detail` on the add-duplicate toast; the confident summary stands alone. (`save()` keeps its detail — a generic "please try again" benefits from the server specifics.)

## Iteration — v2.21e (2026-06-13)
**Triggered by:** Liam — the white-card-with-stripe toast read too quiet; colour should carry the signal. Proposal: keep the toast LIFECYCLE (auto-dismiss, bottom-right slide-in, MessageService) but swap the internal chrome to the `.bp-alert--*` flood.
**Commit:** chip v2.21e
- `.bp-toast .p-toast-message` now mirrors `.bp-alert--*`: severity-soft background flood, severity-colour icon + summary + detail, 30%-mix hairline border (replaces the white card + 4px left stripe). Icon/summary/detail inherit the severity colour; detail at 0.85 opacity so it's quieter but same hue.
- KEPT: the float shadow (a toast is a layer above content; the inline alert is flat in the flow) and the full lifecycle.
- **Architecture:** toast and inline alert now SHARE chrome, differ only in lifecycle (toast auto-dismisses; alert persists until state change). DIALOGS.md to reflect this when freeze lifts.
- Greens: build / lint / guard / 67. QC the four severities on `/style/dialogs`.

## Iteration — v2.21f (2026-06-13)
**Triggered by:** end-of-module architect audit — report saved to `docs/audits/2026-06-13-dialogs-arc-architect-audit.md`. **Verdict: production-ready, non-blocking refinements.** Independently verified: RP-08 clean (only `.bp-btn-danger` sits inside the team confirm), toast/alert/dialog split principled, `.bp-modal.p-dialog` compound workaround sound, tooltip claim accurate (cards on `pTooltip`).
**Triage (11 findings — 6 accepted, 1 accepted-as-doc, 1 rejected-as-noted, 3 clean):**
- **F-2 MEDIUM — accepted (real-consumer fix).** Team invite modal now wires `closeOnEscape` + `dismissableMask` — was Cancel-only, inconsistent with the remove confirm (DIALOGS.md rule 5).
- **F-1 MEDIUM — accepted.** Sandbox confirm + info modals now wire ESC/backdrop dismiss, mirroring the team confirm.
- **F-3 LOW — accepted.** Sandbox confirm modal sets `[closable]="false"` (no silent X — explicit choice only).
- **F-5 LOW — accepted (better than suggested).** Dropped the getter/setter `[(visible)]` bridge for the explicit `[visible]`/`(visibleChange)` signal split the team consumer uses — `model()` is for inputs, not local state, so this matches the real pattern.
- **F-10 LOW — accepted.** aria-live comment on each `<p-toast>` (sandbox/team/codelists/profile) noting MessageService supplies it by severity — so future readers don't assume it's missing.
- **F-6 / F-7 LOW — accepted (ledger).** codelists-settings logged at 254/250 (drifted back over warning after v2.21b toasts); profile 218 watch item.
- **F-4 LOW — accepted as documentation.** Toast + alert severity palettes are textually identical but can't share one rule across PrimeNG's selector + ours without selector algebra; intentional, to be noted in DIALOGS.md.
- **F-8 / F-9 / F-11 — clean** (no action): locked-rule conformance, compound-selector workaround, sandbox purity.
**Greens after fixes:** build / lint / guard / 67 tests.

## QC notes
(Liam, 2026-06-13, relayed via CC) Tested the save + error toasts live on /settings/codelists; checked the remaining archetypes (modals, alert severities, tooltip, all four toast severities) on `/style/dialogs` since their real consumer surfaces don't exist yet. **Happy with all of them — QC passed.** Arc: v2.21a primitives → v2.21b codelists outcome toasts → v2.21c sandbox + toast inner polish → v2.21d duplicate-toast de-dupe → v2.21e toast adopts the alert flood chrome.

## Chat audit
(chat fills this in — leave the section header so chat finds it)
