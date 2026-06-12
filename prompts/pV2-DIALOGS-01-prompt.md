# pV2-DIALOGS-01 — Dialogs primitive family: modal / alert / toast / tooltip

**Status:** Ready (Liam, 2026-06-12: "next dialogs"; spec = docs/DIALOGS.md, locked)
**Chip target:** `[Dev v2] v2.21a`
**Process:** shipped-file contract (`pV2-DIALOGS-01-shipped.md`); module audit when the styling pass closes.

## Scope (DIALOGS.md locked specs, verbatim where given)

- `styles.css §Dialogs`: `.bp-modal` (p-dialog header/content/footer skin) +
  `--confirm` variant + `__icon`; `.bp-alert` + `__icon/__body/__dismiss` +
  `--success/--info/--warn/--danger`; `.bp-toast` (severity left-borders);
  `.bp-tooltip`.
- `.bp-btn-danger` ships (BUTTONS.md locked spec) — its FIRST consumer is
  the team remove-confirmation (the pairing rule is honored from day one).
- Consumer retrofits:
  - `/settings/team`: invite dialog → `bp-modal`; "Remove member?" →
    `bp-modal bp-modal--confirm` per the locked template (icon header,
    `.bp-btn-outline` Cancel + `.bp-btn-danger` Remove, ESC + backdrop
    dismiss per the interaction table)
  - Toasts (team / profile / onboarding) → `styleClass="bp-toast"` +
    locked copy where the table maps 1:1 ("Saved." / "Sent." /
    "Couldn't save — please try again.")
  - `/settings/codelists`: error caption → `.bp-alert--danger`
    (role=alert), deactivation gate note → `.bp-alert--info` — the alert
    family's first consumers (login has no error markup yet)
  - Card overlay buttons (item + supplier): native `title` → `pTooltip`
    with `tooltipStyleClass="bp-tooltip"` (the queued upgrade)
- RP-08 active from day one: no `.bp-btn-danger` without a paired
  confirmation surface (the only consumer ships paired).

## Out of scope
- Info dialog (`--info`) consumer — chrome ships, first consumer when an
  acknowledgment flow lands.
- Inline form-validation alerts — when signal forms arrive.
