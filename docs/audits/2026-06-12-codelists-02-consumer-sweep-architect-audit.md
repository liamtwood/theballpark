# Architect audit — codelists consumer sweep (pV2-CODELISTS-02)

**Date:** 2026-06-12
**Auditor:** independent architect agent (read-only, background)
**Scope:** the v2.19a/b + v1.70b sweep surface — codelists-seed HEX_TO_TOKEN, orgs country/currency surface, profile/pages codelist-fed selects, F-7 extraction, edit-field filter, v1 resolveMetaColor + 4 call sites — against the prompt, the ship report's claims, CODELISTS.md and the RP-04/RP-09 closure assertions.
**Ship report:** `prompts/pV2-CODELISTS-02-consumer-sweep-shipped.md` (triage recorded there as iteration v2.19c)

---

**Verdict:** Production-ready with three findings requiring clarification. The sweep executes its core missions cleanly: RP-09 hex→token idempotency is correctly implemented with defensive case-normalization; RP-04 codelist-fed arrays replace inline options on Profile/Pages as specified; F-7 extraction delivers clean component boundaries. One architectural deviation (save() sends all fields unconditionally) and two low-severity concerns flag edge cases worth documenting.

---

### F-1 — RP-09 acceptance check case asymmetry
**Severity:** MEDIUM
**Where:** codelists-seed.js (sweep vs survivor check)
**What:** The sweep matches `upper(meta->>'color') = $1` (uppercase keys), but the survivor check uses bare `meta->>'color' LIKE '#%'` — consistent for `#`-prefix detection (case-insensitive by nature for the `#` char), but the asymmetry invites drift. Narrow window; the closure itself holds.
**Suggested fix:** `upper()` in the survivor check too, or document the uppercase seed contract.

### F-2 — Profile save() sends the full form regardless of section
**Severity:** MEDIUM
**Where:** profile.component.ts save()
**What:** Saving Company Information also writes the Financial fields (and vice versa) from possibly-stale local state. The PUT is partial-capable; the component just doesn't use it that way. Risk is stale-field shadowing across tabs/sessions, not data loss.
**Suggested fix:** build the payload per section.

### F-3 — Zod country/defaultCurrency clearability asymmetry
**Severity:** LOW
**What:** `country` accepts `''` (clears to NULL); `defaultCurrency` doesn't. Not a bug in the current flow (component always sends a currency), but an undocumented contract.
**Suggested fix:** allow `''` OR document currency as never-clearable.

### F-4 — RP-04 ledger grep check could yield false positives
**Severity:** LOW
**What:** The standing grep matches the allowed binary visibility arrays too; closure phrasing should make "codelist-namespace arrays only" explicit so future audits don't second-guess.

### F-5 — Country/currency selects render empty while codelists load
**Severity:** LOW
**What:** No loading gate on the two codelist resources; selects populate when data arrives. Cosmetic, brief, session-cached after first load.

### F-6 — edit-field filterBy hardcoded to 'label'
**Severity:** LOW
**What:** Filtering by code (e.g. "USD") isn't possible without extending the input. Defer until a consumer needs it.

### F-7 — Line counts at the warning band
**Severity:** LOW
**What:** edit-field ~213, codelists-settings ~200-216 (counting method dependent) — under the 250 cap, watch on next touch.

---

## Closure verifications (auditor)

- **RP-09 sound**: idempotent sweep, case-normalized matching, `jsonb_set` NULL-safe, tokens defined in both apps at original hex, v1 helper wraps refs — acceptance criterion met (0 hex rows).
- **RP-04 closed correctly**: pages + profile codelist-fed; remaining literals verified one-by-one as binary mappings or data-derived; marketplace tier correctly NOT promoted (different enum).
- **F-7 extraction solid**: required inputs, emit-only row, OnPush + host bindings correct, no state duplication.
