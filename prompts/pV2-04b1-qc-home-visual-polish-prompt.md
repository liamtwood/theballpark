# pV2-04b1-qc — Home visual polish to match v1 + `<app-edit-field>` foundation

> **QC-driven prompt** — follows pV2-04b's ship + Liam's visual QC against
> v1 `/home`. The `-qc` suffix marks it as a QC-feedback follow-up rather
> than a standalone feature.

**QC tested:** 2026-06-11, against pV2-04b chip `[Dev v2] v2.09c` (migration not yet run).

## Bugs

1. Tiles are too small — should match v1 proportions
2. Tiles laid out in single row — should wrap to 3+2 grid
3. Tiles missing subtitle copy beneath each title
4. Back button missing (v1 has one even at root)
5. Cog placed page-absolute top-right — should sit in the shell header
6. Drawer is raw form controls — should match the v1 Settings → Organisation section + edit-field visual
7. Settings save → 500 → optimistic rollback (NOT a code bug — pV2-04b's drawer is wired correctly; the `org_type_config` table doesn't exist yet because the migration hasn't been run. Run `cd server && npm run db:migrate:schemas` and acceptance criteria 12-14 from pV2-04b's prompt go green with zero code change. Not in scope for this prompt.)

## Enhancements

- Hover animation and overall structural shape: keep as-is (QC verdict: looks good)
- Drawer chrome treatment: align with the page-settings layout Profile will introduce (pV2-04c) — section + edit-field rows, not stacked inputs. This prompt builds the foundation: `<app-edit-field>` at drawer density (text + select types only). pV2-04c extends it to page density + more field types.

## Read first

1. `docs/CLAUDE.md`
2. `docs/DESIGN.md` (especially §6 components, §9 drawer standard, §10 edit patterns)
3. `docs/ENGINEERING.md` (especially Rule 9 precedence + v2 component standards)
4. `prompts/pV2-04b-launcher-home-shipped.md` (what landed in pV2-04b)
5. `prompts/backlog.md` — confirm pV2-04b1-qc row reads `Ready`
6. **v1 references (compare against):**
   - `client-angular/src/app/features/home/home.component.ts` — back-button wiring (`location.back()`)
   - `client-angular/src/app/shared/components/home-launcher/home-launcher.component.ts` — tile layout, sizing, subtitle prop, 3+2 wrap
   - `client-angular/src/app/shared/components/edit-field/edit-field.component.ts` — the v1 edit-field component (drawer + page densities). Port the drawer-density behavior here.
   - `client-angular/src/app/features/settings/organisation/organisation.component.ts` — the v1 Organisation page (visual reference for the drawer styling overhaul — section + edit-field structure)
7. This prompt

## Context

pV2-04b shipped the launcher-only `/home` with the right structural shape (no
hero band, centred title/subtitle, 5-tile launcher, single-body drawer). The
six bugs above are visual + structural deltas vs v1 `/home`; this prompt
closes them.

Bug 6 (drawer styling) also delivers a foundational primitive —
`<app-edit-field>` — that will be reused at page density in pV2-04c
(Profile). Build the drawer-density behavior here; page density extends in
pV2-04c without re-engineering.

## Goal

After this ships:

- v2 `/home` looks proportionally and structurally like v1 `/home`
- Tiles bigger, wrapped 3+2, each with a subtitle
- `← Back` link in the launcher's chrome block
- Cog moves to the shell header — same shell pattern that profile will adopt
- Page-settings drawer rebuilt with section + `<app-edit-field>` chrome (drawer density)

## v1 prompts describe WHAT — v2 patterns describe HOW

Per `docs/ENGINEERING.md` Rule 9 (precedence): if the v1 references use
`@Input` / `@Output` / `*ngIf` / `<p-sidebar>` / constructor injection / raw
colors / per-component `LucideAngularModule.pick({})`, implement the v2
equivalent and flag the deviation in your ship report under "Spec-hygiene
precedence deviations."

## Six fixes — detail per item

### 1. Tile size

Bigger. Approximate v1 proportions:

```css
.bp-home-launcher__grid {
  grid-template-columns: repeat(3, minmax(280px, 340px));
  gap: 24px;
  justify-content: center;
}
.bp-launcher-tile {
  min-height: 150px;
  padding: 24px;
  border-radius: 16px;
  background: var(--color-surface);
  border: 1px solid var(--color-border-hairline);
  box-shadow: var(--shadow-xs);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
}
```

Icon block inside the tile becomes a soft pastel square (matches v1 — uses
`--theme-soft` gradient as the icon block bg, not the whole tile):

```css
.bp-launcher-tile__icon-block {
  width: 64px; height: 64px;
  border-radius: 12px;
  background: var(--theme-soft);
  display: flex; align-items: center; justify-content: center;
  color: var(--theme-accent);
}
```

### 2. Wrap to 3+2 grid

`grid-template-columns: repeat(3, ...)` with normal wrapping behavior — the
5th tile falls onto row 2, columns 1-2 of the new row OR stays centred via
`grid-column: span 1` and `justify-content: center` on the grid container.

V1 wraps 5th tile to row 2 column 1 (left-aligned to grid). Match that.

### 3. Tile subtitle

Add to `<app-launcher-tile>`:

```typescript
readonly subtitle = input<string>('');
```

Render below the title:

```html
<span class="bp-launcher-tile__title">{{ label() }}</span>
@if (subtitle()) {
  <span class="bp-launcher-tile__subtitle">{{ subtitle() }}</span>
}
```

Subtitles per tile (match v1 copy):

| Tile | Subtitle |
|---|---|
| + Add project | Start a new project |
| View projects | Browse all your projects |
| Inbox | Supplier replies and threads |
| Marketplace | Browse items and suppliers |
| Profile | Your account and settings |

`<app-home-launcher>`'s tile array gets the subtitle field; `LauncherTile`
interface gains `subtitle?: string`.

Styling:

```css
.bp-launcher-tile__title {
  font-size: 17px; font-weight: 600; color: var(--color-text);
  line-height: 1.3;
}
.bp-launcher-tile__subtitle {
  font-size: 13px; color: var(--color-text-secondary);
  line-height: 1.4;
}
```

For the primary (gradient) tile, the subtitle uses `--bp-text-on-gradient`
(white) — same logic as the title.

### 4. `← Back` link in the launcher chrome

V1's `HomeComponent`:

```typescript
back = () => this.location.back();
```

Bound to a `<button>` inside `<app-home-launcher>`'s chrome block. Even
though home is root, the button is shown — matches v1.

In v2, inject `Location` via `inject(Location)` and render:

```html
<div class="bp-home-launcher__chrome">
  <button class="bp-home-launcher__back" (click)="onBack()">
    <lucide-icon name="arrow-left" [size]="16"></lucide-icon>
    <span>Back</span>
  </button>
  <h1 class="bp-home-launcher__title">{{ title() }}</h1>
  @if (subtitle()) {
    <p class="bp-home-launcher__subtitle">{{ subtitle() }}</p>
  }
</div>
```

Or as a separate row above the chrome block (left-aligned to page) — your
call. v1 has it positioned top-left of the content area, above the
launcher's centred chrome.

`arrow-left` Lucide icon — register in the global `pick()` in
`app.config.ts` per DESIGN.md §12.

### 5. Move cog from page-absolute to shell header

`<app-shell>` currently renders: wordmark left + avatar right. Add a cog
button between them (or just before the avatar), visible only when:

- A page-config registration exists for the current route, AND
- The current user is an admin (`auth.user()?.isAdmin === true`)
- AND `can(role, 'org.invite_member')` (matches pV2-04b's gate)

The cog click opens the page-settings drawer for the current route. Mechanism:

- Add a `ShellContextService` (or extend an existing one) with a signal:
  `pageSettingsConfig: Signal<PageSettingsConfig | null>`
- Pages that have settings push a config when they mount:
  `shellContext.setPageSettings({ pageKey: 'v2Home', label: 'Customise your home' })`
- Pages unmount → push `null`
- Shell reads the signal; renders the cog when it's non-null AND user is admin
- Cog click → opens a single `<app-page-settings-drawer>` mounted at the
  shell level (move it from `<app-home-agent>` to `<app-shell>`)

This pattern scales: pV2-04c (Profile) will set its own `pageSettings`
config; the same shell cog opens the drawer for the page that's active.

Remove the absolute-positioned cog from `<app-home-agent>` — `<app-shell>`
now owns it.

### 6. Drawer styling pass — `<app-edit-field>` foundation

Drop the raw `<input>` / `<p-select>` stacked in the drawer body. Replace
with `<app-edit-field>` instances at drawer density.

#### Build `<app-edit-field>` (v2, drawer density only for this prompt)

Location: `client-v2/src/app/shared/edit-field/edit-field.component.ts`

```typescript
@Component({
  selector: 'app-edit-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [/* SelectModule, InputTextModule per type */],
  host: {
    'class': 'bp-edit-field',
    '[class.bp-edit-field--drawer]': "density() === 'drawer'",
    '[class.bp-edit-field--page]':   "density() === 'page'",
    '[class.bp-edit-field--editing]': 'editing()',
  },
  template: `
    <div class="bp-edit-field__label">{{ label() }}</div>
    @switch (type()) {
      @case ('text') {
        @if (editing()) {
          <input pInputText [ngModel]="value()" (ngModelChange)="onChange($event)" />
        } @else {
          <div class="bp-edit-field__value">{{ value() || placeholder() }}</div>
        }
      }
      @case ('select') {
        @if (editing()) {
          <p-select
            [options]="options()"
            [ngModel]="value()"
            (ngModelChange)="onChange($event)"
            optionLabel="label"
            optionValue="value" />
        } @else {
          <div class="bp-edit-field__value">{{ selectedLabel() }}</div>
        }
      }
      @default {
        <div class="bp-edit-field__value">[unsupported type {{ type() }}]</div>
      }
    }
  `,
  styles: [`/* token-only, no raw colors */`],
})
export class EditFieldComponent {
  readonly label = input.required<string>();
  readonly type = input.required<'text' | 'select'>();
  readonly value = input<string>('');
  readonly options = input<{ label: string; value: string }[]>([]);
  readonly placeholder = input<string>('');
  readonly density = input<'drawer' | 'page'>('drawer');
  readonly editing = input<boolean>(false);
  readonly valueChange = output<string>();

  protected onChange(v: string): void {
    this.valueChange.emit(v);
  }

  protected selectedLabel = computed(() => {
    const v = this.value();
    return this.options().find(o => o.value === v)?.label ?? v;
  });
}
```

**This prompt's scope:**
- Type support: `text` and `select` only (drawer needs both for the title mode dropdown + subtitle + position)
- Density: `drawer` only (page density comes in pV2-04c — different visual treatment)
- Editing mode: drawer fields are always in `editing=true` (save-on-change pattern); page fields use the View/Edit toggle pattern from v1 (pV2-04c work)

**Not in this prompt** (don't build, don't stub):
- `textarea`, `email`, `phone`, `number` types (pV2-04c will add as needed)
- Per-section Edit lifecycle (pV2-04c builds `<app-edit-section>` and its
  View/Edit toggle)
- Validation surfacing (pV2-04c)

#### Drawer rebuild using `<app-edit-field>`

`<app-page-settings-drawer>` body becomes:

```html
<div class="bp-drawer-body">
  <app-edit-field
    label="Title"
    type="select"
    [options]="titleOptions"
    [value]="config()?.heroTitleMode ?? 'greeting'"
    density="drawer"
    [editing]="true"
    (valueChange)="updateTitleMode($event)" />

  @if ((config()?.heroTitleMode ?? 'greeting') === 'fixed') {
    <app-edit-field
      label="Title text"
      type="text"
      [value]="config()?.heroTitleFixed ?? ''"
      density="drawer"
      [editing]="true"
      (valueChange)="updateField('heroTitleFixed', $event)" />
  }

  <app-edit-field
    label="Subtitle"
    type="text"
    [value]="config()?.heroSubtitle ?? ''"
    density="drawer"
    [editing]="true"
    (valueChange)="updateField('heroSubtitle', $event)" />

  <app-edit-field
    label="Position"
    type="select"
    [options]="alignOptions"
    [value]="config()?.heroAlign ?? 'center'"
    density="drawer"
    [editing]="true"
    (valueChange)="updateField('heroAlign', $event)" />
</div>
```

Delete `<app-settings-select-row>` and `<app-settings-input-row>` from
pV2-04b — they're superseded by `<app-edit-field>`. Their job moves into the
unified primitive.

#### Drawer visual

Section + label + field rows with proper spacing and dividers. Match v1's
Organisation page rhythm (consult v1's organisation.component.ts and
edit-field.component.ts).

Drawer width: keep at 420px from pV2-04b.

## Acceptance

### Layout (compared to v1 `/home`)
1. Tiles wrap to 3+2 grid (3 across, 5th wraps to row 2)
2. Each tile is at least 280px wide × 150px tall — matches v1 proportions
3. Each tile has an icon block (soft pastel bg, accent color icon) + title + subtitle
4. Primary tile (Add project) keeps the vivid gradient + white text + white subtitle
5. `← Back` link visible top-left of launcher chrome — clicking calls `location.back()` (matches v1 behavior — even at root)

### Shell cog
6. Cog button in `<app-shell>` header, positioned between wordmark and avatar (or just before avatar)
7. Cog renders only when current route registered page settings AND user has `org.invite_member` perm
8. Cog click → opens page-settings drawer for the active page
9. Drawer is mounted at shell level (single instance); pages register their settings config via a service signal

### Drawer
10. Drawer body uses `<app-edit-field>` instances (no raw inputs / no `<app-settings-*-row>` components)
11. Each field has a labelled row with v1-style chrome — clear label / value separation / hairline dividers between sections (if grouped)
12. Title dropdown + conditional fixed-text input + Subtitle + Position — 3 rows + 1 conditional, unchanged scope
13. Save-on-change still works (verifies against the migrated `org_type_config`)

### v2 hygiene compliance
14. Zero `*ngIf` / `*ngFor` / NgModules / `any` types
15. Zero raw color Tailwind utilities (build still fails on them; verify)
16. `<app-edit-field>` uses `host:` binding (no inner wrapper); inputs are signal-based; outputs use `output<T>()`
17. `arrow-left` Lucide icon registered in global `pick()` in `app.config.ts`
18. `<app-settings-select-row>` + `<app-settings-input-row>` from pV2-04b are deleted (not orphaned — search for any usage and remove)

### Smoke
19. Old `client-angular/` on port 4200 still works unchanged
20. Switching dev users on `/home` updates greeting + cog visibility correctly
21. Drawer persistence still works (after Liam runs migration)

## Out of scope

- `<app-edit-field>` page density — pV2-04c
- `<app-edit-section>` (per-card View/Edit lifecycle) — pV2-04c
- More field types beyond `text` and `select` — pV2-04c
- Profile page itself — pV2-04c
- Stub route polish
- Animation tweaks beyond v1 parity

## Concerns not in spec

Per ENGINEERING.md — mandatory in your ship report. Items I'd particularly
want to know:

- Anything in v1's `edit-field.component.ts` you couldn't faithfully replicate
  in v2 patterns (and your alternative)
- Whether moving the cog to the shell required a `ShellContextService` extension
  or whether existing service signals are enough
- Any visual diff you couldn't close (e.g., v1's exact tile shadow vs v2's
  `--shadow-xs` — small drift is OK; flag it)
- Tile gradient subtitle contrast — white-on-gradient must read clearly

## Bump + ship

1. Chip `[Dev v2] v2.09d`
2. Commits (suggested):
   - `feat(v2.09d-pt1): <app-edit-field> primitive (drawer density, text + select)`
   - `feat(v2.09d-pt2): shell cog + ShellContextService page-settings registry`
   - `feat(v2.09d-pt3): launcher tile size + subtitle + 3+2 wrap + Back button`
   - `feat(v2.09d): drawer rebuild via <app-edit-field>; delete superseded row components`
   - `feat(v2.09d): ship report + backlog → Shipped`
3. Ship report `prompts/pV2-04b1-home-visual-polish-shipped.md` with
   "Concerns not in spec" section
4. Flip backlog to `Shipped`; await audit-before-shipped pass for Done

## Reply with

- Commit SHAs
- 21/21 acceptance verified
- Concerns not in spec
- Confirmation v1 on 4200 unchanged
- Visual screenshot (if easy) of the new `/home` for side-by-side compare with v1
