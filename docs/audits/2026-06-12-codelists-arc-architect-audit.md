# Architect audit — codelists module (pV2-CODELISTS-01)

**Date:** 2026-06-12
**Auditor:** independent architect agent (read-only, background)
**Scope:** server (codelists-seed.js, migrate-schemas.js codelists parts, codelist.service.js, codelist.consumers.js, routes/codelists.js + codelists-v2.js, schemas) + client (core/codelists, status-pill, codelists-settings page, route/config/tile/styles deltas) — against docs/CODELISTS.md, ENGINEERING.md hygiene rules, AUDIT_LEDGER.md risk patterns.
**Ship report:** `prompts/pV2-CODELISTS-01-reference-codelists-shipped.md` (triage recorded there as iteration v2.18c)

---

**Verdict:** The reference codelists module ships with strong architectural discipline and excellent safety guardrails, but contains one structural SQL safety finding and two minor UX/messaging issues that warrant correction before dependent modules land on top of this foundation.

---

### F-1 — SQL Identifier Interpolation in inUseCount Without Escaping
**Severity:** HIGH
**Where:** `server/src/services/codelist.service.js` (inUseCount)

**What:** `inUseCount()` extracts table and column identifiers from the whitelisted `consumerRef()` result via `.split('.')`, then interpolates them into `FROM ${table} WHERE ${column}`. The whitelist correctly gates which references reach this point (Rule 8 conformance), but the identifiers were never validated as syntactically valid PostgreSQL names. A future maintainer adding a new consumer reference might not understand the implicit validation contract.

**Suggested fix:** Validate `^[a-z_][a-z0-9_]*$` after the split (return null on mismatch), and/or add a spec asserting every CONSUMER_WHITELIST entry is identifier-shaped.

### F-2 — Conflicting Error Message on PATCH Default Deactivation
**Severity:** MEDIUM
**Where:** `server/src/routes/codelists-v2.js` (PATCH 409 branch)

**What:** The 409 message says "pick a different default before deactivating it", but no endpoint or UI affordance exists to change `reference_codelists.default_code`. The message implies an action path that doesn't exist — a user-facing dead-end.

**Suggested fix:** Reword the message now (one-liner); a default-change affordance is a CODELISTS-02-era design decision.

### F-3 — Resource-Per-Instance Loading in Status Pill Table
**Severity:** LOW (confirmation, not a bug)

**What:** Each `<app-status-pill>` creates its own `resource()`, but `CodelistService.list()` memoises the in-flight promise per list, so N pills on one list share ONE fetch. Correct and efficient — but subtle enough to be misread as N+1 in review.

**Suggested fix:** None required; optional comment in the pill acknowledging the dedup.

### F-4 — Cache Coherence in Codelists Admin Page
**Severity:** LOW
**Where:** codelists-settings `save()`

**What:** After a PATCH, the service cache is invalidated but the component's `values` signal is only patched with the returned fresh row, not refetched via `valuesAll()`. Cross-tab staleness is conceivable in an edge case.

**Suggested fix:** Refetch valuesAll after each save (one-liner).

### F-5 — Deactivation Gate Note Doesn't Say "Advisory" Upfront
**Severity:** LOW
**Where:** codelists-settings `toggleActive()`

**What:** The in-use note is accurate but doesn't make explicit that it informs rather than blocks — an admin could expect a confirmation step.

**Suggested fix:** Prefix the note ("Advisory: …") or style it distinctly.

### F-6 — Default Code Not Pre-Checked at Seed Time
**Severity:** LOW
**Where:** `server/src/db/codelists-seed.js`

**What:** If v1-era data had no value matching a parent's `default_code`, the parent insert succeeds and the seed-time invariant assertion catches the drift after the fact. Two-layer and safe, but the failure surfaces post-hoc.

**Suggested fix:** Optional pre-check before parent insert; current design already halts loudly.

### F-7 — Component at 248 Lines (soft cap 250)
**Severity:** LOW
**Where:** codelists-settings.component.ts

**What:** Two lines under the warning threshold; any growth triggers it.

**Suggested fix:** When next touched, extract the value row into `CodelistValueRowComponent`.

---

## Standing checklist scan (ENGINEERING.md)

1. Duplicate source of truth — none (whitelist/types/schemas defined once) ✓
2. Shared standard hand-applied — none ✓
3. Overloaded token/key — none (.bp-pill / .bp-type-badge single-role) ✓
4. Behavioral drift across structural reuse — none (pill renders from one service; metaColor spec'd) ✓
5. Allow-list vs default-on — v1 reads stay ungated by design (documented, temporary) ✓
6. Read/write key mismatch — none (Zod-validated listName/code throughout) ✓
7. Container-coupled logic — none ✓

## Risk pattern check

- RP-01 (pool latency): no sequential fetch chains ✓
- RP-02 (persona confusion): not in scope ✓
- RP-05 (component-local .bp-*): all definitions in styles.css ✓
- RP-06 (store-fed parity): single consumer, no parity gap ✓

No new risk patterns introduced.

## Summary

Production-ready. F-1 should land before CODELISTS-02 (which adds consumer references); F-2 is a one-line UX fix; F-3–F-7 are confirmations or nice-to-haves.
