# Architect audit — cards arc (pV2-CARDS-01, iterations a–r)

**Date:** 2026-06-12
**Auditor:** independent architect agent (read-only, background)
**Scope:** styles.css §Cards + sub-primitives + vpfit + radius-field; shared/catalogue (item/supplier/subcat cards, layout, filter-band, search, grid), launcher-tile, marketplace-page, supplier-detail, storefront-panel, app-shell/user-menu/app root, RP-07 guard; server marketplace.js (items projection + subcategories endpoint) — against CARDS.md / BUTTONS.md / PILLS.md + the risk-pattern ledger.
**Ship report:** `prompts/pV2-CARDS-01-shipped.md` (triage recorded there as iteration v2.20s)

---

**Verdict:** The arc ships with strong architectural discipline and production-ready implementation. No critical blockers found. The one-definition rule for card chrome is enforced, RP-06 (two-consumer parity) is achieved via shared extraction, and the viewport-fit system is pragmatic despite fragile height coupling.

## Findings

### F-1 — Viewport-fit height calc fragile to shell padding changes (MEDIUM)
`calc(100dvh - 5.5rem)` hardcodes the shell's pt-20 + pb-2. A future shell change (banner, tray) breaks vpfit pages silently. Fix: single-source the chrome height as CSS vars consumed by both the shell paddings and the calc.

### F-2 — Resize-drag listeners leak if the component is destroyed mid-drag (LOW)
window pointermove/pointerup handlers are only removed on pointerup; navigating away mid-drag strands them. Fix: DestroyRef cleanup.

### F-3 — Subcategories endpoint correlated subqueries at scale (LOW)
O(n) correlated first-image subqueries per subcat row; fine at 10–50 subcats, non-obvious cost at 100+. Fix now: document the justification; future: precomputed cover column if it ever bites.

### F-4 — Dual overlay affordance wired to one state (LOW, deferred by design)
Heart + plus both toggle favourites until 06f; labels differ. TRANSITIONAL comment in place; 06f rewires. No action.

### F-5 — railVisible derived from the injected store, not an input (LOW)
A future consumer mounting the layout without the standard store could silently show the rail. Suggested input-ization.

### F-6 — Silent localStorage fallback on the resize handle (LOW)
No dev warning in private mode. Suggested dev-only console.warn.

### F-7 — Client trusts the endpoint's row order in the grouped storefront (LOW)
groups don't re-sort; a server order change would silently shift visuals. Suggested defensive per-group sort.

### F-8 — marketplace.js at 467 lines — past the 300-line route-file ALARM (LOW)
Extraction required before the next ship lands on this file (favourites routes are the natural split).

## Conformances (verified by the auditor)
- RP-07 one-definition card chrome: PASSED (guard enforced; zero component-local declarations)
- RP-06 two-consumer parity: PASSED (band/layout/strip/grid shared; no drift)
- Sub-primitives global: PASSED
- SQL injection safety: PASSED (bound params, escaped ILIKE, Zod UUIDs)
- Component line budgets: PASSED (item-card 105, supplier-card 59, filter-band 97, layout 118, subcat-card 42)
- Filter consistency across browse/subcategories/favourites: PASSED
