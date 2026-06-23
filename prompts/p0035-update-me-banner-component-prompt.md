# CC Prompt — p0035 — `<app-update-me>` banner component + apply to known offenders

Introduces the dev-only "UPDATE ME" banner referenced in p0034's WORKING_STANDARDS update. Makes hand-rolled page chrome debt visible in the dev environment until each page is refactored to use the real shared components.

Same rules as ever: existing v1.22 tokens only, Lucide icons only.

## 1. Extract `<app-update-me>` shared component

**Location:** `client-angular/src/app/shared/components/update-me/update-me.component.ts`

**Selector:** `<app-update-me>`. Standalone, OnPush.

**Inputs:**

```typescript
@Input() reason!: string;  // The shared component this surface should adopt
                            // e.g., 'app-page-header', 'app-section-card', 'app-edit-section'
@Input() note?: string;     // Optional additional context — e.g., 'has inline edit pencil'
```

**Render behaviour:**

- Renders ONLY when `environment.production === false`. In prod builds the entire banner is `*ngIf`'d out — never ships to users.
- Banner is a calm parchment strip with a warning icon + text. Not aggressive — should nudge, not scream.
- Lucide icon: `alert-triangle` at size 14, `--color-warning` colour (or `--color-action` if no `--color-warning` token exists)
- Text: `UPDATE ME — adopt <{{ reason }}> when next refactoring this page` (with the chevrons rendered as literal `<>`)
- Optional `note` shown in parentheses after the reason: `UPDATE ME — adopt <app-section-card> when next refactoring this page (has inline edit pencil)`
- Banner sits on its own row at full width of its parent. Background: `--color-warning-soft` (or `--theme-soft` fallback). Border: 1px dashed `--color-warning` (or `--theme-accent`). Border-radius: `--radius-button`. Padding: 8px 12px. Margin-bottom: 12px so it doesn't crowd the content below.
- Whole banner is non-interactive — no click, no dismiss. The only way to make it go away is to refactor the page.

**Template skeleton:**

```html
<div *ngIf="!isProduction" class="bp-update-me-banner" aria-label="Update me marker">
  <lucide-icon name="alert-triangle" [size]="14"></lucide-icon>
  <span>
    <strong>UPDATE ME</strong> — adopt 
    <code>&lt;{{ reason }}&gt;</code> 
    when next refactoring this page
    <span *ngIf="note" class="bp-update-me-note">({{ note }})</span>
  </span>
</div>
```

**Component class:**

```typescript
@Component({
  selector: 'app-update-me',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, LucideAngularModule.pick({ AlertTriangle })],
  template: `...`,
  styles: [`...`],
})
export class UpdateMeComponent {
  @Input() reason!: string;
  @Input() note?: string;
  readonly isProduction = environment.production;
}
```

Import the existing `environment` module from `client-angular/src/environments/environment` (the production environment will set `production: true` and the prod environment file uses the same `environment` object so the boolean works in both build targets).

## 2. Apply to known offenders

Audit pass already identified these surfaces as hand-rolled chrome. Drop the banner above each block. Don't refactor the markup itself — that's later prompts. Just mark.

| File | Banner placement | `reason` input |
|---|---|---|
| `features/settings/organisation/organisation.component.ts` | Top of template, above the page title | `app-page-header` |
| `features/settings/organisation/organisation.component.ts` | Inside template, above the "ORGANISATION DETAILS" section block | `app-edit-section` |
| `features/settings/organisation/organisation.component.ts` | Inside template, above the "FINANCIAL DEFAULTS" section block | `app-edit-section` |
| `features/settings/subscription/subscription.component.ts` | Top of template, above the page title | `app-page-header` |
| `features/settings/team/team.component.ts` | Top of template, above the page title | `app-page-header` |
| `features/profile/profile.component.ts` (or wherever Profile lives) | Top of template, above the page title | `app-page-header` |
| `features/profile/profile.component.ts` | Above the Organisation summary card block | `app-section-card` |

If the Profile page lives at a different path, grep for `Profile` heading + the Organisation summary card to find it. If any of these pages don't actually exist (e.g., Profile might still be planned), skip that row and note it in the ship report.

## What NOT to do

- **Don't extract the real shared components** (`<app-page-header>`, `<app-section-card>`, `<app-edit-section>`) in this prompt. That's separate work in later prompts. p0035 introduces ONLY the banner + applies it as markers.
- **Don't refactor the hand-rolled chrome** to use shared components. We're marking debt, not paying it off.
- **Don't add a dismiss button or "I know" affordance** to the banner. It's debt — the only way to make it go away is to fix the chrome.
- **Don't render in production.** The `*ngIf="!isProduction"` check is non-negotiable. Verify on a prod build that the banner doesn't render anywhere.
- **Don't apply on routes that are themselves dev-only** (e.g., the Ballpark settings pages or admin tooling). The banner is for production-bound pages that need to adopt the standard.

## Verify

- **Component exists** at `shared/components/update-me/`.
- **Dev build:** banner renders on Settings/Organisation, Settings/Subscription, Settings/Team, Profile. Each shows the appropriate `reason` text. The Organisation page shows three banners (top + two section markers).
- **Prod build** (`ng build --configuration production`): banner does NOT render anywhere. Verify by inspecting the built bundle or running the prod build locally.
- **Greppable inventory:** `grep -rn "<app-update-me" client-angular/src/app` returns ~7 hits (one per banner placement).
- **No regression** on the affected pages — they still function normally, just with a banner above the hand-rolled chrome.

When complete and verified, mark p0035 `Done` in `prompts/backlog.md` and write `p0035-update-me-banner-component-shipped.md` per the cc-onboarding ship-report convention.
