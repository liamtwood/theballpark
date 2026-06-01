# CC Prompt — p0005 — Remove the Plan tab (no regression)

The Plan tab is now fully redundant — the Marketplace covers the same ground (AI matching via the Recommend button + auto-fire on create, per-category brief editing via the category-context-panel). This prompt removes the tab, its route, its component file, and the in-app navigation that points at it. **No data migration is needed** — the underlying `requirement_brief` field and the `/taxonomy/match-items` endpoint both stay; only the redundant UI goes away.

Prompt-only — no mockup. Short, focused, no styling.

## Pre-flight (one-time sanity check, but expected to pass)

Before touching files, confirm these two paths still work as the alternatives to the Plan tab:

1. **AI matching on the Marketplace:** the `Recommend` button in `shared/components/catalogue-grid/catalogue-grid.component.ts` (around line 320) calls `POST /taxonomy/match-items` (around line 2780).
2. **AI matching auto-fires after Create Project:** `create-project-modal.component.ts` (around line 1402) navigates to `/projects/{id}/marketplace?recommend=1` when the user opts in; `marketplace.component.ts` (around line 192) reads `?recommend=1` and binds it to `[autoRecommend]` on the catalogue-grid.
3. **Per-category `requirement_brief` editing on the Marketplace:** catalogue-grid emits `categoryBriefChange` (line 1782, 2061); the Marketplace tab listens (line 88) and calls `projSvc.upsertCategory({ requirement_brief })` (line 394).

All three should pass without changes. If any are broken, stop and fix before continuing.

## Changes

### 1. Remove the Plan entry from the project tabs array
File: `client-angular/src/app/features/projects/pages/project-detail/project-detail.component.ts`

Delete the `{ label: 'Plan', path: ... /plan }` object from the `tabs` array (around line 110).

### 2. Replace the `/plan` and `/brief` routes with redirects
File: `client-angular/src/app/features/projects/pages/project-detail/project-detail.routes.ts`

- Replace the existing `path: 'plan'` route (loads `BriefComponent`) with: `{ path: 'plan', redirectTo: 'marketplace', pathMatch: 'full' }`.
- The existing `path: 'brief'` route already redirects to `/plan` — leave that line in place; it now chains through to `/marketplace`. (Or simplify it to redirect directly to `/marketplace` — your call. Both work.)
- Drop the `BriefComponent` import at the top.

### 3. Repoint the Overview's BRIEF card
File: `client-angular/src/app/features/projects/pages/project-detail/tabs/overview/overview.component.ts`

- The BRIEF card at line ~182 has `(click)="goTo('plan')"` — change to `goTo('marketplace')`.
- The `goTo()` method (line ~1060) has a type signature `'plan' | 'brief' | 'marketplace' | 'estimate' | 'messages'` and a legacy `'brief' → 'plan'` mapping. Remove `'plan'` and `'brief'` from the type, drop the legacy mapping. The method's job becomes "route to marketplace / estimate / messages." Update any callers.

### 4. Delete the Plan tab component
Delete the entire folder: `client-angular/src/app/features/projects/pages/project-detail/tabs/brief/`

(Class is `BriefComponent`, file `brief.component.ts`, 1664 lines. Only importer was `project-detail.routes.ts`, which step 2 already removed.)

### 5. Sweep stale references
- `shared/components/event-drawer/event-drawer.component.ts` line 919 has a code comment mentioning `BriefComponent` — update or remove the comment.
- Grep the codebase for `'/plan'`, `"/plan"`, `'/brief'`, `"/brief"`, `BriefComponent`, `tabs/brief` and clean up any remaining references that aren't covered above.

## Verify

- App builds without TypeScript errors (`BriefComponent` and `'plan'` literals are gone).
- Navigating to `/projects/{id}/plan` or `/projects/{id}/brief` lands on `/projects/{id}/marketplace`.
- Project tab bar shows `Overview / Marketplace / Inbox` (three tabs, no Plan).
- Overview's BRIEF card still clicks through, now lands on the Marketplace.
- Create Project → "Yes, recommend" still triggers the AI matcher on the Marketplace.
- The Recommend button on the Marketplace still works.
- Per-category brief editing still works in the Marketplace.

When complete and verified, mark p0005 `Done` in `prompts/README.md`.
