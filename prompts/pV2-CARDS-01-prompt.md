# pV2-CARDS-01 — `.bp-card` chrome extraction + item/supplier card restyle

**Status:** Ready (relayed by Liam 2026-06-12; spec by chat)
**Spec:** `docs/CARDS.md` (archetype mapping, sub-primitives, interaction patterns) + `docs/bp-cards.docx` (image 2 = item card, image 3 = supplier card, image 9 = launcher tile)
**Chip target:** `[Dev v2] v2.20a` (server data fields) / `v2.20b` (chrome + restyles)
**Process:** shipped-file contract (`pV2-CARDS-01-shipped.md`); end-of-module audit when the STYLING PASS closes (not per-prompt).

## Scope

- `styles.css §Cards` — `.bp-card` foundation + `:hover` lift + `:focus-visible`
  + `--selected` + `.bp-card--zoom img` (0.4s scale 1.04)
- `styles.css §Cards/sub-primitives` — `.bp-tag-chip`, `.bp-price-large`,
  `.bp-ref-eyebrow`, `.bp-icon-block` (promoted from launcher-tile's inline def)
- `<app-item-card>` per image 2: category chip subtitle, prominent
  accent-gradient price, map-pin + city row, full-width bottom CTA with
  Add/Added states (wired to favourites until pV2-06f's quote CTA)
- `<app-supplier-card>` per image 3: brand hero, name + city, gradient
  "View supplier" CTA, heart top-right (existing)
- `<app-launcher-tile>` — refactor onto `.bp-icon-block` (+ chrome via
  `.bp-card--lifted` preserving the pV2-04b2 md-rest/lg-hover look)
- Style guard: RP-07 — component-local card chrome fails the build
- `.bp-btn-grad--added` muted twin ships here (BUTTONS.md two-state)
- UX nit bundled: codelists duplicate-code 409 wording — ALREADY SHIPPED
  v2.19b (predated this prompt's relay); no-op here

## Architecture rules (CARDS.md)

- One Definition — chrome in styles.css; components consume via host/class
- Same interaction patterns across all card archetypes
- Each Angular card component stays bespoke for internal layout

## Order going forward (locked by chat in the relay)

1. pV2-CARDS-01 (this) → 2. Projects arc (unblocks 06f quote/checkout,
project-card image 8, project_status consumer pointer) → 3. Inbox arc
(message_status first writer, canTransition(), messages.status pointer) →
4. DIALOGS.md content lands when the first destructive action needs it.
