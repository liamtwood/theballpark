# Shipped — pV2-AUDIT-01 — Strengthen WORKING_STANDARDS + ship-report process + retroactive concerns pass

**Version:** no bump (docs only, per prompt)
**Shipped:** see commit log (single docs-only commit)
**Prompt:** `pV2-AUDIT-01-strengthen-process-prompt.md`

## What changed
- **`WORKING_STANDARDS.md`** — new top-level section **`## Engineering hygiene — non-negotiable`** (placed after One Definition/One Role, before Data Audit) with all **nine** sub-rules, each citing its past violation:
  1. Multi-statement DB writes are transactional — via the shared `withTransaction(fn)` helper
  2. Tokens only — enforced at compile time, with a complete semantic set
  3. Auth surfaces require rate limiting (incl. the `trust proxy` deploy precondition)
  4. JWTs carry identity, not authority (incl. the `org_id` switcher condition)
  5. Catch blocks justify themselves
  6. Shared security standards live as middleware, not per-route conventions
  7. Duplicate data across boundaries needs automated enforcement
  8. Pure functions in security paths are tested
  9. **Hygiene rules outrank spec-embedded code** (the precedence meta-rule, binding spec authors too)
- **`prompts/backlog.md`** — Statuses line gains **`Shipped`** between Ready and Done ("CC has committed + written the ship report; awaiting chat-side audit pass").
- **`prompts/cc-onboarding.md`** — two amendments:
  - **"Concerns not in spec" — mandatory ship-report section** (categories, empty-section requirement, per-concern format, the "Spec-hygiene precedence deviations" sub-heading).
  - **"The shipped status requires a code audit pass"** — flip to `Shipped`, post report, chat audits actual code, chat/Liam flips to `Done`. Also amended the pre-existing "When you finish a prompt: mark as `Done`" bullet, which directly contradicted the new process (flagged below).
- **`pV2-02-google-oauth-and-users-shipped.md`** — retroactive addendum: violations A, C, **D (precise wording — structural, zero live endpoints affected today)**, E, G, H + finding J, **plus three new concerns found in this re-read** (clearCookie/set option mismatch · org-name collision · no session rotation).
- **`pV2-03-team-management-shipped.md`** — retroactive addendum: violations **B (with the spec-template provenance note)**, F + findings I, K, **plus three new concerns** (invite field length limits · suspended-invited unsuspends to 'active' · `errorDetail` extraction trigger).

## Acceptance — 6/6
1. ✓ Nine sub-rules in WORKING_STANDARDS, each citing the past violation.
2. ✓ Backlog Statuses line includes `Shipped`.
3. ✓ cc-onboarding has both amendments (with `Shipped` as the intermediate state).
4. ✓ pV2-02 addendum covers A, C, D, E, G, H + J (I is attributed to pV2-03 where both twins shipped) + 3 additional.
5. ✓ pV2-03 addendum covers B, F + I, K + 3 additional.
6. ✓ Single docs-only commit; no code touched; no version bump.

## Additional concerns noticed during the re-read (beyond the audit's list)
Recorded in the addenda; headline list: **clearCookie doesn't mirror the set options** (logout silently fails to clear once `JWT_COOKIE_DOMAIN` is configured — MEDIUM, latent), auto-org name collisions (LOW, moot pending onboarding), no JWT rotation/revocation (LOW, v1-acceptable), invite free-text fields unbounded (LOW), suspended-invited → unsuspend lands 'active' with `joined_at` NULL (LOW), `errorDetail` local-helper extraction trigger (LOW). The clearCookie one is the only item I'd promote into pV2-AUDIT-02's scope.

## Concerns not in spec
### Pre-existing onboarding bullet contradicted the new process
**Where:** `prompts/cc-onboarding.md`, the "When you finish a prompt" bullet under Prompt format
**What:** it said "mark its row as `Done`" — left as-is it would contradict the new audit-before-Done rule in the same document two sections later. The prompt's "What to update" didn't list this bullet.
**Suggested fix:** amended it in this commit to point at `Shipped` + the new process (minimal edit, flagged here rather than silent).
**Severity:** LOW (doc-coherence)

### `Mostly Done` now lacks a pre-audit twin
**Where:** backlog Statuses vocabulary
**What:** a prompt shipped with deferred sections has no "Shipped-with-deferrals, awaiting audit" state — I wrote the amended bullet so deferrals are declared in the ship report and the row becomes `Mostly Done` at audit time, but the vocabulary doesn't encode the intermediate state.
**Suggested fix:** none needed unless it bites in practice; flagged for completeness.
**Severity:** LOW

pV2-AUDIT-01 flipped to **`Shipped`** in `prompts/backlog.md` — awaiting the chat-side audit pass (this prompt eats its own dogfood). Liam/chat flips to `Done`.
