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

## QC notes
(Liam fills this in)

## Chat audit
(chat fills this in — leave the section header so chat finds it)
