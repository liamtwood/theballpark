# Architect audit — dialogs arc (pV2-DIALOGS-01, v2.21a–e)

**Date:** 2026-06-13
**Auditor:** independent architect agent (read-only, background)
**Scope:** styles.css §Dialogs (modal/alert/toast/tooltip incl. the v2.21e toast-flood chrome + .bp-modal.p-dialog compound selector); codelists toast/alert split + sandbox + team/profile/onboarding consumers; RP-08 danger-pairing sweep; DIALOGS.md rule + a11y conformance.
**Ship report:** `prompts/pV2-DIALOGS-01-shipped.md` (triage recorded there as iteration v2.21f)

---

**Verdict:** Architecturally sound and locked-spec-compliant — DRY enforcement, accessibility fundamentals, and RP-08 (danger-pairing) verified. Findings cluster around missing ESC/dismissal config on non-destructive modals (F-1/F-2/F-3) — not spec violations but inconsistencies with the real consumer (team remove). Production-ready; findings are non-blocking refinements.

## Findings

### F-1 — Sandbox modals missing closeOnEscape + dismissableMask (MEDIUM)
dialogs-demo confirm + info modals don't wire ESC/backdrop dismiss; team remove-confirm does. The sandbox should exemplify the locked pattern.

### F-2 — Team invite modal missing ESC dismiss (MEDIUM)
team.component invite modal has no `closeOnEscape`/`dismissableMask` — only Cancel dismisses. DIALOGS.md rule 5: ESC always dismisses.

### F-3 — Sandbox confirm modal closable=true by default (LOW)
Omits `[closable]="false"` → PrimeNG adds an X (a silent third path). Team confirm sets it. Covered by the F-1 fix.

### F-4 — Toast + alert severity palettes are textually identical but defined twice (LOW, accepted by design)
`.bp-alert--*` and `.p-toast-message-*` carry the same color-mix rules. A shared rule can't span PrimeNG's selector + ours without selector algebra or non-standard renames. Accepted; document the intentional duplication in DIALOGS.md.

### F-5 — Sandbox uses a getter/setter signal bridge, not model() (LOW)
`[(visible)]` bridged via get/set; Angular 21 idiom is `model()`. Dev-only, but sets precedent.

### F-6 — codelists-settings at 254/250 lines (LOW)
Drifted back over the warning band after v2.21b toast wiring. Log in the ledger; extract a values-grid/toast helper if it grows further.

### F-7 — profile at 218/250 (LOW)
Watch item; opportunistic extraction on next touch.

### F-8 — DIALOGS.md locked-rule conformance VERIFIED (clean)
RP-08 (no orphan danger buttons); outcomes→toast / permissions→dialog / persistent-context→inline alert; alerts role=alert/status; tooltips supplement (pTooltip + aria-label redundancy).

### F-9 — .bp-modal.p-dialog compound selector is the correct PrimeNG workaround (clean)
Wins the one-class theme tie without !important; low version-bump risk.

### F-10 — Toasts rely on PrimeNG MessageService aria-live defaults (LOW)
Correct (polite for success/info, assertive for error) but implicit in code — add a comment at each `<p-toast>` so future readers don't assume it's missing.

### F-11 — Sandbox exercises all archetypes with zero divergent chrome (clean)
Pure global-class consumption; achieves its QC-surface goal.
