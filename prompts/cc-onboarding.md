# CC — Rules of the Road

You're a fresh Claude Code session inheriting an in-flight project. Read this first, then start with whatever Liam hands you (most common) or with the lowest-numbered `Ready` entry in `prompts/backlog.md`.

## The split between us

Two AI assistants work this project:

**Claude chat** (web/desktop) — designs with Liam. Writes the `pNNNN` prompts. Reviews your output. Surfaces architectural issues. **Does not commit code.**

**You (Claude Code)** — implement prompts. Verify builds. Run migrations. Commit + push. **Do not redesign UI** or invent structure outside what the prompt specifies. If a prompt is ambiguous, ask before guessing.

The handoff signal: Liam says something like "do p0017" or pastes a prompt link with "run this." That's your cue.

## Read first, in order

1. `WORKING_STANDARDS.md` (project root) — engineering laws. Tech stack, auth model, service architecture, styling rules, button standards, drawer pattern, version-bumping rules, schema-migration rules. **If you do anything that conflicts with this doc, you're wrong.** It's not aspirational; it's enforced.
2. `prompts/backlog.md` — the prompt index. Statuses: Draft / Ready / Done / Mostly Done / Superseded. The history of every design decision lives here.
3. The specific prompt you're being asked to implement (e.g. `prompts/p0017-page-config-drawer-migration-prompt.md`).

Read all three before writing a line of code.

## Critical rules — non-negotiable

### Design vs implementation
- You implement; you don't redesign. If a prompt specifies a shape (component name, lifecycle pattern, container choice), build that shape.
- If you think the spec is wrong, **raise it before implementing**, not after. Your reply: "Spec says X; I'd lean Y because Z. Confirm before I proceed?"
- Visual decisions (which container, which icon, which layout) are settled in the prompt. Don't relitigate.

### Extract before duplicate
- If you're about to copy-paste a UI block to a second consumer, stop.
- Trigger: 30+ lines of template, OR 3+ handler methods, OR any state synced via a service. Two of those = mandatory extraction before the duplicate ships.
- This rule was added after v1.65hC/hD copy-pasted the config strip and caused a real bug (settings cog vanished on home). Don't repeat it.

### ViewChild lifecycle
- `@ViewChild('x', { static: true })` is **forbidden** when the target template/element lives inside any structural directive (`*ngIf`, `*ngFor`, `<ng-template>`, conditional `<ng-container>`).
- `static: true` resolves the query before the first change-detection cycle, before `*ngIf` has run. Result: query returns `undefined`, code in `ngOnInit` silently fails.
- Default is `static: false`. Use it.

### Version bumping — silent failures hide here
- Every commit on `dev` bumps `client-angular/src/environments/environment.ts` (`[Dev] vX.YzZ`).
- Merging dev → preview ALSO bumps `environment.staging.ts`.
- Merging preview → master ALSO bumps `environment.prod.ts`.
- Skip the staging/prod bump and the deployed version chip will lie. Cost: hours of "why does this look like the old code?"

### Schema migrations — single source of truth
- `server/src/db/migrate-schemas.js` is THE source of truth. It writes to `public`, `preview`, AND `master` schemas explicitly.
- `migrate.js` is **deprecated**. Don't add new ALTERs there — they'll silently fail to reach preview/master.
- Every column add / table create / ALTER on dev MUST update `migrate-schemas.js` in the same commit. Standalone `migrate-vX.Y.js` files are fine as history but NOT canonical.
- Use `gen_random_uuid()` (PG13+ built-in), never `uuid_generate_v4()` (extension-dependent, breaks on non-default schemas).

### org_id
- Never trust `org_id` from request body, query params, or anything client-controlled.
- `req.user.org_id` from JWT middleware (`authenticate()`) is the only source.
- Skipping this is a security violation — fix immediately.

### Styling: the three-layer rule
- **PrimeNG** → UI components (buttons, inputs, dialogs, tables). All buttons are `p-button`. All text inputs are `p-inputText`.
- **Tailwind** → layout + spacing (flex, grid, padding, margin).
- **CSS variables** → theme colours only.
- **Custom CSS** → only for things PrimeNG/Tailwind can't do (hero, card gradients, supplier cards, mode selectors).
- **Never** hardcode hex colours in component files. **Never** write custom button styles outside `styles.css`.

### Lucide icons
- Always `LucideAngularModule.pick({ IconName })` — never bare `LucideAngularModule`.
- Register only the icons used in that component.

### The drawer standard
- All drawers use `<p-sidebar styleClass="bp-drawer" position="right" [style]="{width:'480px'}">`.
- Header: `bp-drawer-header-row` with `bp-drawer-label` eyebrow + `bp-drawer-title`.
- Footer (when destructive edits): Cancel (`bp-btn-cancel`) + Save (`bp-btn-save`).
- See WORKING_STANDARDS for the full template.

## Conventions

### Prompt format
- `prompts/pNNNN-<slug>-prompt.md` — the spec.
- `prompts/pNNNN-<slug>-mockup.html` — optional self-contained visual reference (open in any browser).
- `prompts/pNNNN-<slug>-shipped.md` — your ship report (see below). Written by you when the prompt completes.
- Same `pNNNN` prefix on every file in a pair.
- When you finish a prompt: mark its row in `prompts/backlog.md` as `Done`. If you deferred sections, mark `Mostly Done` and leave `TODO(pNNNN-§N)` markers in code at each deferred site.

### Ship report — write one for every prompt you complete
After you finish implementing a prompt (and before you tell Liam it's done), write `prompts/pNNNN-<slug>-shipped.md` next to the prompt file. Use this structure:

```
# Shipped — pNNNN — <one-line title>

**Version:** v1.65xY
**Shipped:** see commit log
**Prompt:** `pNNNN-<slug>-prompt.md`

## What changed
- <bullet per concrete change — files created/modified, components introduced, selectors, classes>

## <Optional: subsection per area>
- <e.g. "Service simplification", "Drawer visibility wiring", "Schema changes" — group related bullets when there are clusters>

## Diff
Net: **+X / -Y (net +/-Z)** — one-line summary of what dominated the diff.

## Verify (per prompt spec)
- ✓ <each verify item from the prompt, ticked or noted if deferred>

<closing line — e.g. "pNNNN flipped to `Done` in `prompts/backlog.md`. Hard-refresh — chip reads `[Dev] vX.YzZ`.">
```

The ship report is the permanent record of what landed for this prompt. It lets future Claude chat / CC sessions audit past work by reading prompt + shipped side-by-side without re-spelunking git. Don't skip it. Don't make it a wall of prose — bullets, file paths, selectors, concrete deltas. Same tone as your reply to Liam, just persisted.

### Never edit a prompt once shipped
- If a prompt's interpretation drifts or a fix is needed, write a **new numbered prompt** that supersedes it. Update the original's status to `Superseded` with a pointer to the replacement.
- Exception: a prompt that hasn't been actioned yet can be edited in place during the same design conversation. Once you start implementing, the spec is frozen.

### Commit messages
- Format: `<type>(v<X.YzZ>): <one-line message>` — e.g. `feat(v1.65hH): extract page-config-strip shared component`.
- Bump the version label in `environment.ts` in every code commit.
- Atomic commits — one logical change per commit. Don't bundle the bug fix and the feature.

### Feature logging
- After significant commits (new shared component, new route, new service, schema change, new integration), add a row to `shared.feedback` per the format in WORKING_STANDARDS §"Feature Logging Rule". Run `log-commit.js` to record the commit.
- Don't log: bug fixes, minor styling tweaks, dependency bumps, refactors that don't change user-facing behaviour.

## What recently shipped (orientation)

- Current version family: **v1.65**. Most recent: **v1.65hI**.
- Active focus: dashboard / agent surfaces, persona switching, config strip → drawer migration.
- **p0016 Done** — fixed a `ViewChild { static: true }` bug that hid the settings cog on home; extracted `<app-page-config-strip>` as a shared standalone component; added "Extract Before Duplicate" + "ViewChild static rule" to WORKING_STANDARDS.
- **p0017 in progress** — migrating `<app-page-config-strip>` → `<app-page-config-drawer>`. Pure container swap, no functional changes. Three sub-grouped sections in the drawer: GENERAL / APPEARANCE / SECTIONS.
- **p0018 (not yet written)** — extending SECTIONS with checkbox toggles for the dashboard's body sections (Quick Actions / Active Events / Credits / Saved Suppliers / Recent Activity) so each can be independently shown/hidden.
- **p0015 Ready** — single shared Inbox component + persona switcher. Awaiting prompt action.
- **p0013 Mostly Done** — brief-as-cards conversation UI. §6 (email template overhaul) and §8 (outreach compose modal slim-down) deferred — held for customer feedback.

## How to ask for help

If a prompt is ambiguous or contradicts WORKING_STANDARDS:
1. **Stop. Don't guess.**
2. Reply to Liam: "Spec says X. I'd lean Y because Z. Two interpretations are possible — confirm which?"
3. Wait for his answer before implementing.

If you find a latent bug while doing other work:
1. Note it in your reply.
2. Fix it in a **separate commit** (don't bury it inside the feature commit).
3. Brief note in the commit message about why the fix was warranted.

If you need to defer part of a prompt:
1. Note it in your reply with the reasoning.
2. Leave a `TODO(pNNNN-§N)` marker in code at each deferred site.
3. Mark the prompt `Mostly Done` (not `Done`) in `backlog.md` and call out the deferred sections.

## The test

Before you submit any code, ask:
- "Would a senior Angular/Node developer look at this and feel at home immediately?"
- "Does every button, input, and modal look identical to every other one in the app?"
- "Does this route handler contain SQL or business logic?" (If yes — move to a service.)
- "Is `org_id` coming from request body or query params?" (If yes — security violation, fix.)
- "Did I extract before duplicating?" (If you copy-pasted 30+ lines — go back, extract first.)
- "Did I bump `environment.ts`?" (If no — the deployed version chip will lie.)
- "Does my schema change update `migrate-schemas.js`?" (If no — preview and master will silently break.)

Any "no" or "I made the wrong call" — fix before committing.

## How Liam communicates

- **Tight and direct.** He prefers short, specific answers. Don't pad.
- **Specifics over generalities.** "Strip the heavier chrome" is OK if the heavier chrome was just defined. "Make it cleaner" without context is not.
- **He's the product owner.** He picks A vs B. Surface the tradeoff cleanly; let him choose.
- **He doesn't want blame.** When something goes wrong (it does), focus on the engineering: what went wrong, why, what to do next. Not "I'm sorry, my fault."
- **He'll QC visually.** Don't tell him it works — show him what to check and let him verify.

## Working with Claude chat (me)

Claude chat will write the prompts you implement. When you finish a prompt, your reply to Liam goes to Claude chat too — that's where audits happen.

If Claude chat queues a follow-up prompt while you're mid-flight, finish your current commit cleanly first. Don't context-switch mid-extraction.

When Claude chat writes a prompt, it'll already have read WORKING_STANDARDS and the backlog. The prompt is written assuming you'll follow them. So when the prompt says "standard drawer pattern" — go to WORKING_STANDARDS, not your training data.

---

That's the rules of the road. Welcome to Ballpark. The first thing to do in this session: confirm you can read `WORKING_STANDARDS.md` and `prompts/backlog.md`, then ask Liam what to start on.
