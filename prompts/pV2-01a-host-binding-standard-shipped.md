# Shipped — pV2-01a — Codify the `host:` binding pattern in WORKING_STANDARDS

**Version:** no bump (docs only, per prompt)
**Shipped:** see commit log
**Prompt:** `pV2-01a-host-binding-standard-prompt.md`

## What changed
- `WORKING_STANDARDS.md` — new section **`## Angular Component Standards — client-v2`** containing the rule **`### Component is the element — no wrapping`**, with the Wrong/Right example pair verbatim from the prompt. Placed immediately before `## Angular ViewChild` (the Angular component-pattern area).
- Added a short intro paragraph naming the v2 strictures (standalone, OnPush, strict TS, signals, control-flow blocks, `inject()`, `.pick({})`) so the new rule has the parent context the prompt assumed — WORKING_STANDARDS previously had no section listing those (they lived only in `inbox-v2-plan.md`).

## Placement note
The prompt said "near the existing Standalone only / OnPush mandatory rules" — those rules didn't exist in WORKING_STANDARDS (only in the plan docs), so the new section creates that home. `## Angular Component Standards — client-v2` → `### Component is the element — no wrapping`.

## Verify
- ✓ Rule present with Wrong/Right examples.
- ✓ Docs-only — no code touched, no version bump.
- ✓ Atomic commit.

pV2-01a flipped to `Done` in `prompts/backlog.md`.
