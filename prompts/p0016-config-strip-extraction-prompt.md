# CC Prompt — p0016 — Config strip extraction + ViewChild lifecycle fix

A two-part task: a bug fix you need to ship today, plus the underlying refactor that should have happened before the bug was possible. The bug came from a pattern choice in v1.65hC/hD, not a typo — understanding what went wrong matters as much as fixing the symptom.

## What went wrong

When the agent page shipped (v1.65hC, hD), the config strip from `dashboard.component.ts` was **copy-pasted in full** into `agent.component.ts`:

- The `<ng-template>` body (≈80 lines)
- The handler methods (`saveLabels`, `onThemeChange`, `selectNavMode`, `selectHeroAlign`, `saveToggles`, `isComponentActive`, `toggleComponent`)
- The option arrays (`themeOptions`, `componentOptions`, `alignOptions`, `navOptions`)
- The `settingsDraft` shape + initial values
- The `ConfigService.config$` subscription pattern
- The `ConfigStripService.setTemplate()` registration + the `setTemplate(null)` cleanup

The v1.65hD commit message acknowledged this explicitly: *"mirrors home exactly"*. That was the wrong call. Two separate copies of ~170 lines of stateful UI cannot stay in sync without active discipline, and they immediately drifted in behaviour as soon as one side touched lifecycle.

The symptom: settings cog disappeared on home (dashboard). The mechanism:

1. Dashboard's `@ViewChild('cfgStripTpl', { static: true })` targets a template inside `*ngIf="activeTab === 'projects'"`.
2. `static: true` means "resolve before the first change-detection cycle" — only valid when the target is unconditionally present in the DOM at component creation. Templates inside structural directives (`*ngIf`, `*ngFor`, `<ng-template>`, `<ng-container *ngIf>`) **cannot** be queried with `static: true`. The query returns `undefined`.
3. Until v1.65hC, the *ngIf expression defaulted to true and `static: true` happened to work by timing accident. Adding the agent page changed the navigation lifecycle enough to expose the latent bug — `setTemplate(undefined)` ran, `hasConfig` stayed false, cog stayed hidden.

The duplication is what made the bug bite: agent's `ngOnDestroy` correctly calls `setTemplate(null)`, but dashboard's broken `static: true` ViewChild never re-registers cleanly when dashboard re-mounts. If the strip had been one shared component owning its own lifecycle, this whole class of bug couldn't exist.

## What should have happened

When you started adding the strip to a second page, the right move was to **extract `<app-config-strip>` as a shared standalone component first, then mount it in both consumers**. Not after the duplication shipped, not "we'll extract it later" — before.

The rule: **if you're about to copy-paste ~30+ lines of template, multiple handler methods, or any state that needs to sync via a service, stop and extract first.** Two or more of those criteria triggering means the next action is `ng generate component shared/components/<name>`, not Ctrl+C / Ctrl+V.

This applies regardless of how "tight" the timeline feels. Duplicated boilerplate is technical debt that compounds at the worst possible time — exactly like it just did here, mid-way through "some decent sized changes."

## What to do now

Two atomic commits. Ship Step 1 first so home isn't broken; Step 2 follows immediately so the bug can't recur.

### Step 1 — immediate fix (commit this first)

In `dashboard.component.ts`:

```typescript
// before
@ViewChild('cfgStripTpl', { static: true }) cfgStripTpl?: TemplateRef<any>;

// after — default behaviour, resolves AFTER the first CD cycle when *ngIf has run
@ViewChild('cfgStripTpl') cfgStripTpl?: TemplateRef<any>;
```

Verify cog reappears on home, opens the strip, settings still propagate.

**Also grep for other instances of the same latent bug:**

```bash
grep -rn "@ViewChild.*static.*true" client-angular/src/app
```

Any ViewChild target that lives inside `*ngIf`, `*ngFor`, `<ng-template>`, or a conditional `<ng-container>` has the same bug. Fix them all in this commit (default to `static: false`). Marketplace component is the most likely sibling — start there.

### Step 2 — extraction (next commit, before any new page consumes the strip)

Create `client-angular/src/app/shared/components/config-strip/config-strip.component.ts`. It owns:

- The `<ng-template>` body (page label, credits, events, theme swatches, components, align, nav). Template at component root — **not inside any structural directive**.
- The `themeOptions`, `componentOptions`, `alignOptions`, `navOptions` arrays.
- The handlers (`saveLabels`, `onThemeChange`, `selectNavMode`, `selectHeroAlign`, `saveToggles`, `isComponentActive`, `toggleComponent`).
- The `settingsDraft` state.
- The `ConfigService.config$` subscription.
- The `ConfigStripService.setTemplate(this.tpl)` registration in `ngAfterViewInit` (with `static: false` ViewChild, since it's the default and correct).
- The `setTemplate(null)` cleanup in `ngOnDestroy`.

Consumers become:

```typescript
@Component({
  selector: 'app-dashboard',
  imports: [..., ConfigStripComponent],
  template: `
    <app-config-strip />
    <!-- rest of dashboard -->
  `
})
```

That's the whole change at the call site: one import, one tag. The strip's lifecycle is owned by the strip. The *ngIf race condition can't exist because the template lives at the strip component's root.

Delete the duplicated template + handlers + arrays from both `dashboard.component.ts` and `agent.component.ts`. Verify both pages show the cog with identical behaviour, and the strip's settings sync via `ConfigService` exactly as before.

## Verify

- Home (dashboard) shows the settings cog. Open it, change the theme, close it, navigate to agent, open the cog there — the theme change is reflected.
- Agent page shows the cog and opens the strip with identical behaviour.
- Navigate from agent → inbox → back to home. Cog appears correctly each time.
- Pages without a config strip (inbox, brief detail) do NOT show a leaked cog from the previous page.
- The handler methods + option arrays + settingsDraft live in exactly one file. Grep should return one .ts hit:
  ```bash
  grep -rn "themeOptions\|componentOptions\|alignOptions\|navOptions" client-angular/src/app
  ```
- No `{ static: true }` remains on any ViewChild targeting a template inside `*ngIf` / `*ngFor` / `<ng-template>`:
  ```bash
  grep -rn "@ViewChild.*static.*true" client-angular/src/app
  ```
  Each remaining match should be on an element that's unconditionally in the DOM at component creation. Add a comment on each justifying it.

## The rule going forward (add to WORKING_STANDARDS)

Append to `WORKING_STANDARDS.md` under a new section "**Extract before duplicate**":

> When adding a UI block to a second page, if it would mean copying:
> - more than ~30 lines of template, OR
> - more than ~3 handler methods, OR
> - any state that needs to sync via a service,
>
> stop and extract first. `ng generate component shared/components/<name>` before the duplicate exists. Two or more of the above criteria triggering means extraction is mandatory, not optional.
>
> Symptom of skipping this rule: when you later need to change the shared behaviour, you'll change it in one place and silently leave the other broken. That's exactly the bug class v1.65hC/hD introduced (settings cog disappeared on home after agent's strip was copy-pasted).

And under the existing Lucide / Button / Drawer standards, add:

> **ViewChild `{ static: true }` is forbidden when the target is inside any structural directive** (`*ngIf`, `*ngFor`, `<ng-template>`, conditional `<ng-container>`). `static: true` resolves the query before the first change-detection cycle — which is before structural directives have run. The query will return `undefined` and any code in `ngOnInit` that depends on it will silently fail. Default behaviour (`static: false`, resolves after the first CD cycle) is correct for these cases.

When complete and verified, mark p0016 `Done` in `prompts/backlog.md`.
