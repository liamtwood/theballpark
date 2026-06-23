# p0038A — Backup + Angular upgrade audit + execute

## Read first

1. `WORKING_STANDARDS.md`
2. `prompts/cc-onboarding.md`
3. `prompts/inbox-v2-plan.md` ← this is the orientation doc for the whole
   inbox-v2 arc. Read it. The plan is **strangler fig** — new `app/v2/`
   namespace, stricter standards there, gradually retire v1. This prompt is the
   PREP work for that arc.
4. `prompts/backlog.md` (confirm p0038A row reads Ready)

This prompt is one step before p0038. Goal: get the Angular major version
current so all `app/v2/` code we write from p0038 onwards uses the latest
patterns (signals, `@if` / `@for` control-flow blocks, new build pipeline) from
day 1 — instead of writing it at v17 and then refactoring through v2/ later.

## Step 1 — Backup

Before touching anything:

1. `git status` — confirm clean working tree. If anything is uncommitted, commit
   it (or stash) and note the commit SHA in your reply.
2. Tag the current state and push the tag:
   ```bash
   git tag pre-angular-upgrade-v1.69e
   git push origin pre-angular-upgrade-v1.69e
   ```
3. Create the upgrade branch and switch to it:
   ```bash
   git checkout -b upgrade/angular-v20
   ```
4. (Optional but cheap) Create a manual Supabase dev DB snapshot via the
   Supabase dashboard — no schema changes are planned but it's free insurance.
   Skip if it's friction; the upgrade is frontend-only.

Confirm in your reply: tag created + pushed, branch checked out.

## Step 2 — Audit (DO NOT execute yet)

From `client-angular/`:

1. Run `ng update` (no args) and capture the output — this lists what could be
   upgraded.
2. Run `ng update @angular/core@20 @angular/cli@20 --dry-run` (or `@22` if you
   judge that's the right target — see "target version" below).
3. Check PrimeNG compatibility against the target Angular version:
   - Current is `primeng@17` per the v1.65hJ comments.
   - PrimeNG has a tight Angular version matrix. Latest PrimeNG (19/20) requires
     Angular 18+/20+. Find the right PrimeNG version that pairs with the
     chosen Angular target.
4. Check the other key deps:
   - `lucide-angular` — version compatibility with target Angular
   - `tailwindcss` — usually unaffected
   - `rxjs` — Angular 18+ usually wants RxJS 7.8+
5. Search for any code patterns that will break in newer Angular versions:
   - `@ViewChild('x', { static: true })` inside structural directives
     (WORKING_STANDARDS already forbids these — sanity-check count)
   - `entryComponents`, `ModuleWithProviders` legacy patterns
   - Any custom Webpack config (we use the default builder, but check)
   - `Renderer` (deprecated long ago, but check)

### Target version

- Pick the **largest jump that doesn't require code changes >40 files**.
- Prefer `v17 → v20` (current LTS / latest stable as of 2026). If that requires
  too many code changes, fall back to `v17 → v18` (smaller jump, still gets
  control-flow blocks and signals).
- Do NOT jump to a version with poor PrimeNG support; the cost of replacing
  PrimeNG is much bigger than the gain.

## Step 3 — Checkpoint

STOP HERE and reply to Liam with the audit results. Use this format:

```
## Audit report (p0038A)

**Backup:** tag pre-angular-upgrade-v1.69e pushed, branch upgrade/angular-v20 checked out.

**Recommended target:** Angular vX  (current: v17)

**Expected code changes:** ~N files
- M from `ng update` migration schematics (automatic)
- K manual edits — list them with file paths

**Dependency bumps:**
- primeng: 17 → X  (notes on breaking API changes if any)
- lucide-angular: X → Y
- rxjs: X → Y
- other: ...

**Risks:**
- <anything that looks gnarly — PrimeNG component API breaks, custom builder config, etc>

**Recommendation:**
- "Proceed with v17 → vX upgrade" — small + clean
- OR "Hold at v17, build inbox-v2 first" — too disruptive
- OR "Smaller jump v17 → v18 only" — vX too gnarly, v18 is the sweet spot
```

Do not execute the upgrade until Liam replies with go/no-go. He'll either say
"go" (proceed to Step 4), "smaller jump" (revise target + proceed), or "hold"
(abandon, switch back to dev branch, delete `upgrade/angular-v20`).

## Step 4 — Execute (after Liam approves)

1. Run the chosen `ng update` commands for real (no `--dry-run`).
2. Bump PrimeNG + other deps to the versions you identified.
3. Run the migration schematics — let them auto-fix what they can.
4. Apply manual edits for the files the schematics can't handle.
5. `npm install` clean (delete `node_modules` + `package-lock.json` first if
   needed).
6. `ng build` — must succeed with zero errors.
7. `ng serve` and smoke-test these routes for visible breakage:
   - `/` (home / agent dashboard)
   - `/projects` (projects landing)
   - `/projects/:any-id` (project detail)
   - `/inbox` (v1 inbox — what's getting replaced)
   - `/inbox-v2` (the p0037 stub — must still render hero)
   - `/marketplace` (catalogue grid — high risk surface, uses many PrimeNG bits)
   - `/settings` (forms-heavy)
8. Console: no red errors on any route.

If anything breaks, fix it in this same commit — don't ship a broken upgrade.

## Step 5 — Bump + ship

1. Bump `client-angular/src/environments/environment.ts` version chip.
   Suggested: `v1.70a` to mark the major-version family.
2. Commit message: `chore(v1.70a): upgrade Angular v17 → vX, PrimeNG v17 → vX`
3. DO NOT merge to `dev` yet. Push the branch so Liam can pull, run locally, and
   QC.
4. Write `prompts/p0038A-angular-upgrade-shipped.md` per the ship-report format
   in cc-onboarding.
5. Flip backlog row `p0038A` to Done.

## Reply to Liam

After Step 5, reply with:

- Branch name + commit SHA
- Version chip
- Result of each smoke-test route (✓/note)
- Any non-trivial decisions made in Step 4
- "Ready for you to pull `upgrade/angular-v20`, run locally, QC. Merge to dev
  when satisfied."

## Out of scope

- Touching v1 code patterns beyond what the migration schematics need.
- Refactoring any v1 component to new control-flow blocks. That's a separate
  pass later (or just-in-time as v2 takes over each surface).
- Any inbox-v2 work — that starts in p0038.
- Schema changes — none planned in the whole arc.
