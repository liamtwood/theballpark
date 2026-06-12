# Angular-architect audit — Marketplace arc (pV2-MARKET-00 → pV2-06d)

**Run:** 2026-06-12, independent background agent (read-only), at Liam's
request after v2.15b.
**Scope:** marketplace-store, marketplace-page, rail components,
supplier-detail, shared/catalogue/*, tab-band, catalogue.service,
favourites.store, categories-settings — against
`pV2-06-angular-architecture.md` + Angular 21 zoneless/signals idioms.
**Triage + fixes:** recorded in `prompts/pV2-06d-suppliers-shipped.md`
(iteration v2.15c, commit `05217c0`). Verdicts: 7 accepted+fixed,
2 rejected with rationale (C2, H4 — see below).

---

## Findings (agent's report, verbatim verdicts annotated)

### CRITICAL-1 — supplier-detail resource fires with empty id
`supplier-detail.component.ts` — `params: () => pinnedSupplierId() ?? ''`
fetches `/suppliers/` with an empty id before `:id` resolves.
**Verdict: ACCEPTED (defensive).** Real-but-theoretical — the route only
matches with an id segment — but the skip-until-resolved pattern
(`?? undefined`) is strictly better. FIXED v2.15c.

### CRITICAL-2 — "stale suppliers data on mode toggle"
Claim: flipping items→suppliers with unchanged filters doesn't refetch,
showing stale rows.
**Verdict: REJECTED — not a bug.** `mode()` is a dependency of the
resource's `params()` computation; flipping recomputes params (a new
object) and the loader re-runs. Same-params data is then served from the
CatalogueService session cache BY DESIGN — the cache contract (busted on
writes, cleared on reload) is the freshness model, not a staleness bug.

### HIGH-3 — favourites cross-tab race window
Two in-flight toggles of the same ref can land out of order.
**Verdict: ACCEPTED AS KNOWN LIMITATION.** Single-user toggling is
consistent; cross-tab is eventually consistent. Documented in-code
(favourites.store.ts) rather than engineered around. FIXED (doc) v2.15c.

### HIGH-4 — "pagination accumulation vulnerable to partial failures"
Claim: a partially-received response mutates the items signal before the
failure is known, corrupting offsets.
**Verdict: REJECTED — mechanically impossible.** `await catalogue.items()`
resolves only after the full body is received and parsed; any transport
failure rejects BEFORE the signal mutation lines execute. There is no
partial-accumulation path.

### HIGH-5 — cache key fragile under param reordering
**Verdict: ACCEPTED.** Keys now built via `stableUrl()` (sorted params).
FIXED v2.15c.

### MEDIUM-6 — item-preview `input.required` vs null flips
**Verdict: ACCEPTED AS-IS.** The parent `@if` guard is the contract;
relaxing to nullable would weaken it. Noted.

### MEDIUM-7 — supplier-detail at 224 lines (warn 250)
**Verdict: ACCEPTED.** `<app-storefront-panel>` extracted → 172 lines.
FIXED v2.15c. (Matches chat's independent flag.)

### MEDIUM-8 — viewMode hardcoded on the supplier Store tab
**Verdict: ACCEPTED, option (a) per Liam.** `<app-view-toggle>` extracted
as a shared primitive; Store tab binds `store.viewMode()` (`?view=`
works there now). FIXED v2.15c. (Matches chat's independent flag.)

### LOW-9 — discarded navigation promises
**Verdict: ACCEPTED.** `.catch(console.warn)` on store.merge +
supplier-detail navigations. FIXED v2.15c.

---

## Done-well (agent's confirmation of the architecture)

1. Route-scoped DI with the pinned-supplier scope — "the Store component
   reuse between contexts is elegant."
2. `linkedSignal` offset reset on filter change — "textbook correct."
3. URL-is-state applied consistently; shareable URLs, Back works.
4. Session cache: failure eviction (no poisoning), shared in-flight
   requests, invalidate-on-write.
5. Optimistic favourites with revert + adopt-server-truth.
6. OnPush + zoneless throughout; no manual CD.
7. a11y baseline: tabindex/keydown.enter on cards, aria-labels,
   keyboard-accessible rows.
8. Born-paginated envelope — "never needs a cut-over."
9. Pure presentation components (grid/cards/layout) — "highly reusable."
10. Type safety: safe parser fns (asViewMode/asBrowseMode), no raw
    string comparisons in templates.

---

## Process note

Per Liam (2026-06-12): an architect audit like this runs at the END OF
EACH MODULE, and every report is saved here in `docs/audits/` named
`YYYY-MM-DD-<module>-<kind>-audit.md`. CC triages findings honestly
(accept/fix or reject-with-rationale), records the triage in the
module's shipped file, and cross-links both ways.
