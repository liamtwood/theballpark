# pV2-01c — Page Hero (`<app-page-hero>`)

## Read first

1. `WORKING_STANDARDS.md`
2. `prompts/cc-onboarding.md`
3. `prompts/pV2-01b-shell-chrome-shipped.md` (confirm shell ships first; hero sits below header)
4. This prompt

## Goal

Build the standard `<app-page-hero>` band that sits at the top of every feature
page in v2 — below the shell's transparent header, above the page content.

Drives:
- Optional back link (left)
- Title (text)
- Subtitle (text)
- Optional align (left | center, default left)
- Optional accent color treatment (theme | none, default theme — soft wash bg)
- Optional `<ng-content>` slot for right-side actions (e.g., a cog, tabs)

Replaces v1's hand-rolled per-page headers with one component. Every feature
page in v2 uses it.

This prompt builds the component + a demo on the hello page. Page-settings
overrides (the cog drawer from v1) are deferred to a later prompt — this one
just renders what the route hands it.

## Naming (locked per v2 standard)

| Thing | Name |
|---|---|
| Component | `PageHeroComponent` |
| Selector | `<app-page-hero>` |
| File | `client-v2/src/app/shell/page-hero/page-hero.component.ts` |
| Folder | `shell/page-hero/` |
| CSS root | `bp-page-hero` |
| CSS variant for align | `bp-page-hero--align-center` |
| CSS variant for accent | `bp-page-hero--accent-none` |

## Inputs + host (Angular 21 idiomatic)

The component instance IS the hero band — no inner `<header>` wrapper. CSS
classes and variant modifiers bind via `host:`.

```typescript
@Component({
  selector: 'app-page-hero',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, RouterLink],
  host: {
    'class': 'bp-page-hero',
    '[class.bp-page-hero--align-center]': "align() === 'center'",
    '[class.bp-page-hero--accent-none]':  "accent() === 'none'",
  },
  template: `...`,
  styles: [`...`]
})
export class PageHeroComponent {
  /** Optional back link target — when set, renders a back chevron + label. */
  readonly back = input<{ label: string; href: string } | null>(null);

  /** Main title — required. */
  readonly title = input.required<string>();

  /** Subtitle / lede — optional. */
  readonly subtitle = input<string>('');

  /** Alignment of title/subtitle text. */
  readonly align = input<'left' | 'center'>('left');

  /** Accent treatment. `'theme'` paints a soft theme wash behind the band;
   *  `'none'` is transparent over the page background. */
  readonly accent = input<'theme' | 'none'>('theme');
}
```

Right-side action slot via `<ng-content select="[hero-actions]">`.

Resulting DOM:
```html
<app-page-hero class="bp-page-hero bp-page-hero--align-center">
  <a class="bp-page-hero__back" ...>...</a>
  <div class="bp-page-hero__text">...</div>
  <div class="bp-page-hero__actions">...</div>
</app-page-hero>
```

One element, no wrapper waste.

## Template

```html
@if (back(); as b) {
  <a class="bp-page-hero__back" [routerLink]="b.href">
    <lucide-icon name="chevron-left" [size]="16"></lucide-icon>
    <span>{{ b.label }}</span>
  </a>
}

<div class="bp-page-hero__text">
  <h1 class="bp-page-hero__title">{{ title() }}</h1>
  @if (subtitle()) {
    <p class="bp-page-hero__subtitle">{{ subtitle() }}</p>
  }
</div>

<div class="bp-page-hero__actions">
  <ng-content select="[hero-actions]"></ng-content>
</div>
```

No outer wrapper — the `<app-page-hero>` host element IS the band.

## Styles

```css
.bp-page-hero {
  /* :host element — see component host: binding */
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-template-rows: auto auto;
  grid-template-areas:
    "back  text    actions"
    "back  text    actions";
  align-items: center;
  gap: 12px 20px;
  padding: 28px 32px 24px;
  background: var(--theme-soft);
  border-bottom: var(--border-hairline);
}

.bp-page-hero--accent-none {
  background: transparent;
}

.bp-page-hero__back {
  grid-area: back;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--color-text-secondary);
  text-decoration: none;
  padding-top: 4px;
}
.bp-page-hero__back:hover { color: var(--theme-accent); }

.bp-page-hero__text {
  grid-area: text;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.bp-page-hero--align-center .bp-page-hero__text {
  text-align: center;
}

.bp-page-hero__title {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.15;
  margin: 0;
  color: var(--color-text);
}

.bp-page-hero__subtitle {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 0;
}

.bp-page-hero__actions {
  grid-area: actions;
  display: flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 600px) {
  .bp-page-hero {
    padding: 20px 16px 16px;
    grid-template-columns: 1fr auto;
    grid-template-areas:
      "back    actions"
      "text    text";
  }
  .bp-page-hero__title { font-size: 22px; }
}
```

## Where it sits in the layout

```
┌──────────────────────────────────────────────────────────────┐
│  Ballpark                              [SM] ▾                │  ← <app-shell> header (40px avatar)
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ← Back   Inbox                                              │  ← <app-page-hero>
│           Project conversations                              │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  <router-outlet> page body                                   │
│                                                              │
│                                              [Dev v2] v2.02a │  ← footer chip from shell
└──────────────────────────────────────────────────────────────┘
```

The hero is NOT part of `<app-shell>` — it's used per-page so each route can
choose its title/subtitle independently. Pages render it as the first child of
their template.

## Hello page update (the only feature route this prompt touches)

Update `pages/hello/hello.component.ts` to use the hero. Use `@let` to bind the
user signal locally — avoids repeating `user()?.x` lookups in template.

```html
@let u = authService.user();

<app-page-hero
  [title]="'Hello, ' + (u?.displayName ?? 'friend')"
  [subtitle]="(u?.activeOrgName ?? '') + ' · ' + (u?.role ?? '')">
</app-page-hero>

<div class="bp-page-body">
  <!-- existing API connection indicator + p-button stay -->
</div>
```

`bp-page-body` is a tiny wrapper class with standard page padding (`32px`).
Add it to `styles.css` as a global.

## Demo route `/style/hero` (dev-only sandbox)

To make the variants easy to visually QC, add a new route `/style/hero` showing
4 instances of the hero side by side / stacked:

1. Title only (left, theme wash)
2. Title + subtitle (left, theme wash)
3. Title + subtitle + back link (left, theme wash)
4. Title + subtitle, center, no accent

This is the v2 equivalent of v1's component playground — useful to add over
time. CC creates the route + page component. Lives at `pages/style/hero/` for
now; we may extract a proper `/style/*` index later.

## Acceptance criteria

1. `<app-page-hero>` renders on the hello page with title + subtitle reflecting the active user (from `AuthService.user()` signal).
2. The hero sits BELOW the shell's transparent header and ABOVE the page body.
3. Theme accent wash visible by default (soft pink-to-green gradient backdrop).
4. `accent="none"` removes the wash; band sits transparent over page bg.
5. `align="center"` centers title + subtitle text; `align="left"` keeps them left (default).
6. `back` input renders a back chevron + label as a link; click navigates via routerLink.
7. `<ng-content select="[hero-actions]">` slot accepts arbitrary right-side content (e.g., a button).
8. `/style/hero` route shows 4 variants for visual QC.
9. Responsive at < 600px: padding compresses, font sizes reduce, back link moves to top row.
10. No `*ngIf` / `*ngFor` / NgModules / `any`.
11. CSS uses ONLY existing tokens (`--theme-*`, `--color-*`, `--border-*`, `--radius-*`) — no raw hex.
12. `ng build` clean, `ng lint` clean.
13. Old `client-angular/` on 4200 unchanged.
14. Footer chip from pV2-01b bumps to `[Dev v2] v2.02a`.

## Out of scope

- Page-settings drawer (the v1 cog that lets user customize title source, hero color, align, etc.) — separate prompt
- Multiple title modes (org name / username / greeting) — defer to page-settings prompt
- `ShellContextService` for cross-component hero overrides — defer
- Tabs / pills / sub-navigation under the hero — separate prompt when first needed
- Touching `client-angular/`

## Bump + ship

1. Version chip → `[Dev v2] v2.02a`
2. Commit message: `feat(v2.02a): standard page hero component + demo route`
3. Ship report `prompts/pV2-01c-page-hero-shipped.md`
4. Flip backlog row to Done

## Reply with

- Commit SHA
- 14/14 acceptance criteria ticked
- Confirmation old app still works
- Brief on responsive breakpoint choice
- Any visual tweaks made (spacing, typography sizes)
