# Shipped — p0034 — WORKING_STANDARDS: page-chrome extraction rule

**Version:** n/a (docs-only; no env bump — prompt forbids code changes)
**Shipped:** see commit log
**Prompt:** `p0034-working-standards-page-chrome-rule-prompt.md`

## What changed
- Appended two sub-rules inside the existing **"Extract Before Duplicate"**
  section of `WORKING_STANDARDS.md` (before the `---` / "Angular ViewChild"):
  - **Page chrome — separate rule, same spirit** — catches the
    hand-rolled-per-page class of duplication the copy-paste rule misses.
    Check `shared/components/` before hand-rolling a page header / section
    card / edit-form section; forward-looking placeholders
    `<app-page-header>` / `<app-section-card>` / `<app-edit-section>`;
    hand-rolled in 3+ pages → mandatory-extraction backlog item.
  - **Marking debt with `<app-update-me>`** — dev-only banner convention
    (component lands in p0035) to flag page chrome you saw but didn't
    refactor; greppable via `grep -rn "<app-update-me"`.

## Diff
One file (`WORKING_STANDARDS.md`), append-only. No code anywhere in the
repo (no env bump, per the prompt).

## Verify (per prompt spec)
- ✓ New sub-rule under the existing "Extract Before Duplicate" section.
- ✓ No other changes to `WORKING_STANDARDS.md`.
- ✓ No code changes anywhere.
- ✓ Component names left out of the Standard Components table (they don't
  exist yet — land in p0035+).

p0034 → `Done` in `prompts/backlog.md`.
