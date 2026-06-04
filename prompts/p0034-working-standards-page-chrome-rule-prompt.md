# CC Prompt — p0034 — WORKING_STANDARDS update: page-chrome extraction rule

Tiny documentation-only commit. Adds a complementary rule to the existing "Extract Before Duplicate" section to catch a specific class of duplication the current rule misses: page chrome (titles / subtitles / section cards / edit-form scaffolding).

The current rule fires when developers copy-paste markup. Page chrome tends to be hand-rolled per page from scratch rather than copy-pasted, so the rule silently skips it. Result: three different teams write three slightly-different page headers and section cards across `dashboard`, `profile`, `settings/organisation`, `subscription`, etc. The patterns aren't extracted because no one copy-pasted them — they each wrote their own from memory.

## What to add

In `WORKING_STANDARDS.md`, find the **"Extract Before Duplicate"** section (added v1.65hI / p0016 Step 3). Append a new sub-rule directly under it:

```markdown
### Page chrome — separate rule, same spirit

The Extract Before Duplicate rule above catches markup copy-paste. Page
chrome (title + subtitle blocks, section cards, edit-form scaffolding)
tends to be hand-rolled per page from scratch rather than copied, so
the headline rule silently skips it. Add this as a complementary check:

When introducing a new page or sub-page that has a title, subtitle, or
section-card structure: check `client-angular/src/app/shared/components/`
for an existing component before hand-rolling the markup.

Examples of page chrome that should be shared:
- Page header: large serif title + smaller muted subtitle on parchment
  → use `<app-page-header>` (when introduced)
- Summary card: titled card with label/value pairs + optional footer
  action → use `<app-section-card>` (when introduced)
- Edit-form section: colored eyebrow + edit pencil + form field grid
  → use `<app-edit-section>` (when introduced)

If a needed component doesn't exist yet and the chrome is non-trivial
(>20 lines of markup, multiple labels/states, or appears in a second
location), extract it as part of the prompt that introduces the page.

Page chrome that's hand-rolled in three or more pages becomes a
mandatory-extraction backlog item before the fourth surface is built.

### Marking debt with `<app-update-me>`

When you encounter hand-rolled page chrome on an existing page and
don't have time to refactor it in the current commit, mark it with
the `<app-update-me reason="...">` banner component (introduced in
p0035). The banner renders only in dev (never production) and shows
in the dev environment as a constant nag — `UPDATE ME — adopt
<app-page-header> when next refactoring this page`.

This makes the debt visible to whoever next opens the page, and
greppable via `grep -rn "<app-update-me" client-angular/src/app` for
a live list of remaining work. The banner is removed when the page
adopts the real shared component.

Use sparingly — the banner is a "saw it, leaving for next pass"
marker, not a "this should stay hand-rolled" comment.
```

Don't worry about the component names matching anything that exists today — they're forward-looking placeholders. The actual extractions land in separate prompts; this rule just sets expectations.

## What NOT to do

- Don't introduce the components themselves yet — that's separate work (p0035 onwards, after the audit).
- Don't reformat or restructure the rest of `WORKING_STANDARDS.md`. Just append the sub-rule.
- Don't add the component names to the Standard Components table yet — they'll be added when the components actually exist.

## Verify

- `WORKING_STANDARDS.md` has the new sub-rule under the existing "Extract Before Duplicate" section.
- No other changes to the file.
- No code changes anywhere in the repo.

When complete, mark p0034 `Done` in `prompts/backlog.md` and write `p0034-working-standards-page-chrome-rule-shipped.md` per the cc-onboarding ship-report convention.
