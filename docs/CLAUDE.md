# Ballpark — Claude Code rules of the road

You're a fresh Claude Code (CC) session inheriting an in-flight project. Read
this first, then start with whatever Liam hands you (most common) or with the
lowest-numbered `Ready` entry in `prompts/backlog.md`.

## The docs folder

Five files. This one is the index + workflow. Read the others by topic:

| Doc | When to read |
|---|---|
| **`CLAUDE.md`** (this file) | Every session, every prompt. Workflow, ship-report process, audit-before-shipped, prompt conventions, commit discipline. |
| **`DESIGN.md`** | Any frontend work — tokens, typography, components, drawer chrome, status pills, layout patterns, do's and don'ts. |
| **`ARCHITECTURE.md`** | Any server work, schema work, deployment, env vars, file locations, auth flow, service architecture. |
| **`ENGINEERING.md`** | Any work touching multiple layers, or whenever you're tempted to take a shortcut — engineering hygiene rules, anti-pattern audit checklist, extract-before-duplicate, data audit (soft delete), Angular v2 component standards, the test. |
| **`PROGRESS.md`** | Orientation. The chronological log of what shipped recently. |

If a rule in this file conflicts with one of the others, the topic-specific
doc wins (its scope is narrower).

`prompts/backlog.md` holds the prompt index — Draft / Ready / Shipped / Done /
Mostly Done / Superseded. Read it for the active queue + the history of every
design decision.

`WORKING_STANDARDS.md` at the repo root is the **legacy combined doc** — it's
being split into this `docs/` folder. While the split is in flight, treat
both as live; when they disagree, `docs/` wins.

---

## The split between us

Two AI assistants work this project:

**Claude chat** (web/desktop) — designs with Liam. Writes the `pNNNN` prompts.
Reviews your output. Surfaces architectural issues. **Does not commit code.**

**You (Claude Code)** — implement prompts. Verify builds. Run migrations.
Commit + push. **Do not redesign UI** or invent structure outside what the
prompt specifies. If a prompt is ambiguous, ask before guessing.

The handoff signal: Liam says something like "do pV2-04" or pastes a prompt
path with "run this." That's your cue.

---

## Read first, in order

1. `docs/CLAUDE.md` — this file.
2. The topic-specific doc(s) for the prompt:
   - Frontend-only prompts → `docs/DESIGN.md`
   - Server / schema / auth prompts → `docs/ARCHITECTURE.md`
   - Anything touching hygiene rules → `docs/ENGINEERING.md`
3. `prompts/backlog.md` — confirm the row reads `Ready` and orient on what's
   shipped around it.
4. The specific prompt you're being asked to implement
   (e.g. `prompts/pV2-04-agent-home-prompt.md`).
5. Any v1 reference prompts the spec points at.

Read all of the above before writing a line of code.

---

## Critical rules — non-negotiable

These bind you. Full detail in `docs/ENGINEERING.md`.

### Design vs implementation

- You implement; you don't redesign. If a prompt specifies a shape (component
  name, lifecycle pattern, container choice), build that shape.
- If you think the spec is wrong, **raise it before implementing**, not after.
  Reply: "Spec says X; I'd lean Y because Z. Confirm before I proceed?"
- Visual decisions (which container, which icon, which layout) are settled in
  the prompt. Don't relitigate.

### Hygiene rules outrank spec-embedded code

**Exception to "don't relitigate":** if a spec's code, markup, or pseudocode
violates any rule in `docs/ENGINEERING.md` §"Engineering hygiene", you
implement the compliant version — NOT the literal spec — and flag the
deviation in your ship report under "Spec-hygiene precedence deviations."

The 10 hygiene rules (each detailed in ENGINEERING.md):

1. Multi-statement DB writes use `withTransaction(fn)` — hand-rolled BEGIN/COMMIT forbidden
2. Tokens only — no raw colors (v2 build fails on them)
3. Auth surfaces require rate limiting + `trust proxy`
4. JWTs carry identity, not authority — re-derive permissions per request
5. Catch blocks justify themselves (comment the silence, or log)
6. Shared security standards live as middleware (default-on, not opt-in per route)
7. Duplicate data across boundaries needs automated enforcement (test, codegen, or runtime)
8. Pure functions in security paths are tested
9. Hygiene rules outrank spec-embedded code (this rule)
10. API audit checklist — per-endpoint walk before ship

### Extract before duplicate

- If you're about to copy-paste a UI block to a second consumer, stop.
- Trigger: 30+ lines of template, OR 3+ handler methods, OR any state synced
  via a service. Two of those = mandatory extraction before the duplicate
  ships.
- Past violation: v1.65hC/hD copy-pasted the config strip and caused a real
  bug (settings cog vanished on home). Don't repeat it.

### ViewChild lifecycle (v1 + v2)

- `@ViewChild('x', { static: true })` is **forbidden** when the target
  template/element lives inside any structural directive (`*ngIf`, `*ngFor`,
  `<ng-template>`, conditional `<ng-container>`).
- `static: true` resolves the query before the first change-detection cycle,
  before `*ngIf` has run. Result: query returns `undefined`, code in
  `ngOnInit` silently fails.
- Default is `static: false`. Use it.

### Version bumping — silent failures hide here

- Every commit on `dev` bumps `client-angular/src/environments/environment.ts`
  (v1) and/or `client-v2/src/environments/environment.ts` (v2).
- Merging dev → preview ALSO bumps `environment.staging.ts`.
- Merging preview → master ALSO bumps `environment.prod.ts`.
- Skip the staging/prod bump and the deployed version chip will lie.

### Schema migrations — single source of truth

- `server/src/db/migrate-schemas.js` is THE source of truth. It writes to
  `public`, `preview`, AND `master` schemas explicitly.
- `migrate.js` is **deprecated**. Don't add new ALTERs there.
- Every column add / table create / ALTER on dev MUST update
  `migrate-schemas.js` in the same commit.
- Use `gen_random_uuid()` (PG13+), never `uuid_generate_v4()`.

### `org_id` is sacred

- Never trust `org_id` from request body, query params, or anything
  client-controlled.
- `req.user.org_id` from JWT middleware (`authenticate()`) is the only source.
- Skipping this is a security violation — fix immediately.

### v2 component standards (`client-v2/`)

- Standalone only — no NgModules
- `ChangeDetectionStrategy.OnPush` mandatory
- Strict TS / no `any`
- Signals + `@if` / `@for` / `@switch` / `@defer` — no `*ngIf`
- `input()` / `input.required()` / `output()` — no `@Input` / `@Output` / `EventEmitter`
- `inject()` over constructor injection
- `host:` binding for root class — no wrapping element inside the selector
- Lucide via `LucideAngularModule.pick({})` — never bare
- `httpResource()` / `resource()` for HTTP state — zero raw `.subscribe()` in new code

### Styling: the three-layer rule

- **PrimeNG** → UI components (buttons, inputs, dialogs, tables). All buttons
  are `p-button`. All text inputs are `p-inputText`.
- **Tailwind** → layout + spacing (flex, grid, padding, margin).
- **CSS variables** → all colors via tokens.
- **Custom CSS** → only for things PrimeNG/Tailwind can't do (hero, card
  gradients, mode selectors).
- **Never** hardcode hex colors in component files.
- **Never** use raw Tailwind color utilities (`text-slate-500`, `bg-white`,
  `border-black/N`). v2 build fails on them.

---

## Prompt conventions

### Prompt file pairs

- `prompts/pNNNN-<slug>-prompt.md` — the spec.
- `prompts/pNNNN-<slug>-mockup.html` — optional self-contained visual reference.
- `prompts/pNNNN-<slug>-shipped.md` — your ship report. Written by you when
  the prompt completes.

Same `pNNNN` prefix on every file in a pair.

### Backlog status flow

```
Draft     → spec being written, not ready
Ready     → ready for you to implement
Shipped   → you've committed + written the ship report; awaiting chat-side audit
Done      → chat-side audit cleared the implementation
Mostly Done → shipped with some sections deferred (chat decided)
Superseded→ don't implement; replaced by a later prompt
```

When you finish a prompt: flip the row to `Shipped`. **Do NOT flip to `Done`
yourself.** Chat / Liam flips to `Done` after the audit-before-shipped pass
clears.

If you deferred sections, leave `TODO(pNNNN-§N)` markers in code at each
deferred site and say so in the ship report; chat marks the row `Mostly Done`
at audit time.

### Never edit a prompt once shipped

- If a prompt's interpretation drifts or a fix is needed, write a **new
  numbered prompt** that supersedes it. Update the original's status to
  `Superseded` with a pointer to the replacement.
- Exception: a prompt that hasn't been actioned yet can be edited in place
  during the same design conversation. Once you start implementing, the spec
  is frozen.

### Commit messages

- Format: `<type>(v<X.YzZ>): <one-line message>` —
  e.g. `feat(v2.04a): real Google OAuth + user upsert + JWT middleware`.
- Bump the version label in `environment.ts` in every code commit (v1 OR v2
  chip, depending which app you touched).
- Atomic commits — one logical change per commit. Don't bundle the bug fix
  and the feature.

---

## Ship report — the single-file conversation per ship

Every ship is a single-file conversation between CC, Liam, and chat
(locked in 2026-06-11). One file per prompt:
`prompts/pV2-XX-<slug>-shipped.md` — **CC writes it on push; Liam appends
QC; chat appends audit findings.** Single source of truth per ship.

**Backstop: if you push without writing the shipped file, Liam has to ping
chat with the SHA and chat has to ask. Always write the file BEFORE you say
"done."**

### Sections you write at push time

```
# pV2-XX — <one-line scope>

**Shipped:** <date>, chip `[Dev v2] vX.YYz`
**Commits:** `<sha1>` (one-line), `<sha2>` (one-line)

## What landed
3–5 bullets, the actual changes (not the prompt's wishlist)

## Files touched
| File | Lines (Δ) | SHA | Notes |
|---|---|---|---|
| path/to/file.ts | +162 / -41 | abc1234 | brief why |

## Acceptance — X / Y verified
- <criterion> — ✓ / ✗ / partial + how
- ...

## API audit checklist (when server routes touched)
#### `POST /api/...`
- per-endpoint walk from ENGINEERING.md Rule 10 — example:
- ✓ HTTP method semantics / ✓ Input validation (Zod schema) /
  ✓ Authorization / ✓ Status codes / ✓ Response shape /
  ✓ Information disclosure / ✓ Observability / N/A Idempotency /
  ✓ Performance

## Concerns not in spec
Items chat / Liam should know about (per ENGINEERING.md) — MANDATORY,
write "None." when empty.

## QC notes
(Liam fills this in)

## Chat audit
(chat fills this in — leave the section header so chat finds it)
```

### QC iterations — same file, stacked

When Liam sends a follow-up fix, push under the same chip suffix
(v2.10e → v2.10f) and APPEND a section to the same shipped file:

```
## Iteration — v2.10f (<date>)
**Triggered by QC:** <one-line>
**Commit:** `<sha>`
**Files:** <brief>
```

Do NOT create a new shipped file for QC fixes. One file per prompt,
multiple iterations stacked.

### Audit trigger

Liam tells chat "audit pV2-XX" — chat reads the shipped file + the diffs +
the touched files, updates the audit ledger + feature one-pager + backlog
row, and writes under `## Chat audit`. You read chat's findings + reply if
anything needs follow-up.

The shipped file is the permanent record. Bullets + file paths + selectors
+ concrete deltas — same tone as your reply to Liam, just persisted.

### "Concerns not in spec" — mandatory section

Every ship report MUST end with a section titled **"Concerns not in spec"**.
List anything you noticed during implementation that:

- The spec didn't ask about
- A careful reviewer would want to know
- Falls into one of these categories:
  - Engineering hygiene rules from `docs/ENGINEERING.md` that the spec didn't
    explicitly call out
  - Production-readiness concerns (rate limiting, error logging, metrics,
    health checks, retries, timeouts)
  - Schema decisions that produce dual sources of truth or coupling
  - Performance pitfalls (N+1 queries, unbatched HTTP, unbounded result sets)
  - Security smells (missing input validation, log injection, secret in
    response body)
  - Code patterns that work but feel wrong

Write the section even when empty:

```
## Concerns not in spec
None.
```

When non-empty, format each concern as:

```
### <Short name>
**Where:** file path + line range
**What:** one-paragraph description
**Suggested fix:** what you'd do (or note "deferred — needs design decision")
**Severity:** HIGH / MEDIUM / LOW
```

Spec-mandated code that violates `docs/ENGINEERING.md` §"Engineering hygiene"
goes under a sub-heading **"Spec-hygiene precedence deviations"** — you
implement the compliant version and record the delta here.

The PR/spec author then decides: fix now, fix in a follow-up prompt, or
formally defer. The choice is theirs; the SURFACING is yours.

### API audit checklist — required for every server route touched

When a prompt touches any `server/src/routes/*.js` file, your ship report
MUST include the API audit checklist from `docs/ENGINEERING.md` §"Rule 10 —
API audit checklist" filled in per endpoint you wrote or modified.

For routes you didn't touch, you don't need to walk the checklist. Only the
ones you wrote or modified.

This is process, not bureaucracy. Five minutes per endpoint catches issues
that take hours to debug post-deploy.

---

## The shipped status requires a code audit pass

After you write the ship report:

1. **Flip the backlog row to `Shipped`** (not Done).
2. **Post the ship report to Liam (or the calling agent) for review.**
3. **Wait** for explicit confirmation that the chat-side audit pass found no
   blockers. At that point chat / Liam flips the row to `Done`.

The audit pass:

1. Chat reads the actual code you wrote (not just the ship report).
2. Chat checks for `docs/ENGINEERING.md` violations (especially §"Engineering
   hygiene").
3. Chat compares the "Concerns not in spec" section against what the code
   actually contains — flags any missed concerns.
4. Chat either: clears for `Done`, requests a fix commit, or asks for more
   detail in the ship report.

This is process, not bureaucracy. The audit catches what the ship report
misses; the ship report catches what the audit misses. Both layers.

---

## How to ask for help

If a prompt is ambiguous or contradicts `docs/ENGINEERING.md` /
`docs/DESIGN.md` / `docs/ARCHITECTURE.md`:

1. **Stop. Don't guess.**
2. Reply to Liam: "Spec says X. I'd lean Y because Z. Two interpretations are
   possible — confirm which?"
3. Wait for his answer before implementing.

If you find a latent bug while doing other work:

1. Note it in your reply.
2. Fix it in a **separate commit** (don't bury it inside the feature commit).
3. Brief note in the commit message about why the fix was warranted.

If you need to defer part of a prompt:

1. Note it in your reply with the reasoning.
2. Leave a `TODO(pNNNN-§N)` marker in code at each deferred site.
3. Mark the prompt `Mostly Done` (not `Done`) in `backlog.md` and call out the
   deferred sections in your ship report.

---

## The test — before submitting any code

- "Would a senior Angular/Node developer look at this and feel at home immediately?"
- "Does every button, input, and modal look identical to every other one in the app?"
- "Does this route handler contain SQL or business logic?" → If yes, move to a service.
- "Is `org_id` coming from request body or query params?" → If yes, security violation. Fix.
- "Did I extract before duplicating?" → If you copy-pasted 30+ lines, go back, extract first.
- "Did I bump `environment.ts`?" → If no, the deployed version chip will lie.
- "Does my schema change update `migrate-schemas.js`?" → If no, preview and master will silently break.
- "Did I use a hex code or raw Tailwind color?" → v2 build will fail. Fix.
- "Did my service do >1 write without `withTransaction`?" → Hygiene Rule 1. Fix.
- "Does my JWT payload carry `role` or `is_admin`?" → Hygiene Rule 4. Fix.
- "Did I run the standing-checklist scan in my audit report?" → If no, the next bug class ships unsurfaced.

Any "no" or "I made the wrong call" — fix before committing.

---

## How Liam communicates

- **Tight and direct.** He prefers short, specific answers. Don't pad.
- **Specifics over generalities.** "Strip the heavier chrome" is OK if the
  heavier chrome was just defined. "Make it cleaner" without context is not.
- **He's the product owner.** He picks A vs B. Surface the tradeoff cleanly;
  let him choose.
- **He doesn't want blame.** When something goes wrong (it does), focus on the
  engineering: what went wrong, why, what to do next. Not "I'm sorry, my fault."
- **He'll QC visually.** Don't tell him it works — show him what to check and
  let him verify.

---

## Working with Claude chat

Claude chat writes the prompts you implement. When you finish a prompt, your
reply to Liam goes to chat too — that's where audits happen.

If chat queues a follow-up prompt while you're mid-flight, finish your current
commit cleanly first. Don't context-switch mid-extraction.

When chat writes a prompt, it has already read `docs/CLAUDE.md`, the topic
docs, and the backlog. The prompt is written assuming you'll follow them. So
when the prompt says "standard drawer pattern" — go to `docs/DESIGN.md`, not
your training data.

---

## What recently shipped (orientation)

Read `docs/PROGRESS.md` for the chronological log of what shipped. It's
faster than reading every shipped report and tells you where the active
focus is.

---

That's the rules of the road. Welcome to Ballpark. The first thing to do in
this session: confirm you can read `docs/CLAUDE.md` + `docs/ENGINEERING.md` +
`prompts/backlog.md`, then ask Liam what to start on.
