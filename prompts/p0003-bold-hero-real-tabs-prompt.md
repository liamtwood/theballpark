# CC Prompt — p0003 — Bold hero mode + real tabs

Adds a new **Bold** display mode and restyles the project tab bar as real, obviously-clickable tabs. The mockup (`p0003-bold-hero-real-tabs-mockup.html`) shows the pink theme in Bold mode — the same treatment applies to every preset.

Same rules as earlier prompts: use existing v1.22 tokens, plus the one new token defined below. No hardcoded shadows / radii / hex beyond the new token values. Icons are Lucide only.

## Background — the problem

The project tabs (`Overview / Plan / Marketplace / Inbox`) render in `app-shell.component.ts` as `.bp-hero-tab` buttons inside `.bp-hero-tabs`, styled in `styles.css` (~lines 1188–1213). They read as faint caption text, not navigation. The active tab sets `border-bottom-color` but there is **no `border-bottom` width/style**, so the underline never renders — active is only a colour shift from `--color-text-muted`. New users miss the nav entirely.

## 1. New token — `--theme-contrast`

Each theme preset gets a contrast colour, as a three-stop set. It drives both the Bold-mode hero orbs and the active tab.

| Preset | `--theme-contrast-soft` (tab fill) | `--theme-contrast` (orbs) | `--theme-contrast-strong` (tab text) |
|---|---|---|---|
| Pink | `#DFF0E4` | `#3DBE73` | `#0F6E56` |
| Ocean | `#FBECD3` | `#F0A93E` | `#854F0B` |
| Emerald | `#FBE4EC` | `#F06F9C` | `#993556` |
| Amber | `#DDEEF2` | `#3FA8C4` | `#0C447C` |
| Slate | `#F6E6E1` | `#D88A6E` | `#7A3A26` |

Define these alongside the other `--theme-*` tokens in `styles.css`, set per preset by `ConfigService` the same way the existing theme tokens are.

## 2. Real tabs — `.bp-hero-tabs` / `.bp-hero-tab` (all modes)

Restyle in `styles.css`. Markup is unchanged — same elements.

- **Sentence case.** Drop any `text-transform: uppercase` and wide letter-spacing. Bump to `--text-base` (13px).
- **Inactive tab** — readable, not faint. The colour must suit the hero background per mode: dark-muted text on the Light hero, light text (~90% white) on the Bold and Dark heroes. On hover, inactive shifts toward full-strength text colour.
- **Active tab** — `background: var(--theme-contrast-soft)`, `color: var(--theme-contrast-strong)`, `border-radius: 9px 9px 0 0` (folder-tab top corners). This is the same in **every mode and every preset** — light contrast fill, so it stands out against a light, bold, or dark hero without any per-mode logic.
- **Delete the dead `border-bottom` rule** on `.bp-hero-tab.active`.
- Keep `.bp-hero-tab-badge` as is; on the Bold hero the danger-red badge sits on bold accent — flip the badge to a white fill with accent text in Bold mode so it stays legible.

## 3. New Bold mode — `[data-mode="bold"]`

A third display mode alongside Light and Dark. Per-user, toggled from the same control as the current light/dark switch (the mode button in `top-nav.component.ts`) — make it a three-way choice. Persist it wherever the existing `data-mode` preference is stored.

**Bold mode changes only the hero.** All panels, content, and work surfaces stay exactly as Light mode. Specifically, in `[data-mode="bold"]`:

- `.bp-hero` / `.bp-hero-tab-band` background → `var(--theme-accent)`.
- **Orb layer** — add an inline SVG to the hero template in `app-shell.component.ts`: two circles filled `var(--theme-contrast)`, wrapped in `<g filter="url(#blur)">` with `<feGaussianBlur stdDeviation="55">`, positioned to bleed from opposite corners. Same recipe as `welcome.component.ts`.
- **Grain** — an overlay div, `feTurbulence` noise (`baseFrequency 0.8`, `numOctaves 3`), `mix-blend-mode: overlay`, opacity ~0.18. Same as the welcome page.
- Hero text — title, pills, eyebrow switch to light/white treatment for contrast on the bold base.
- `.bp-hero` gets **rounded top corners** (`--radius-card` or larger) and the **bottom hairline removed**.

The orb SVG + grain elements live in the hero template always, but are `display:none` outside `[data-mode="bold"]` so Light and Dark are untouched. **Light and Dark hero appearance does not change** — only the tabs (section 2) change there.

## Files in scope

- `client-angular/src/styles.css` — `--theme-contrast-*` tokens per preset, `.bp-hero-tab*` restyle, `[data-mode="bold"]` hero overrides.
- `client-angular/src/app/shared/components/app-shell/app-shell.component.ts` — add orb SVG + grain elements to the hero template.
- `client-angular/src/app/layout/top-nav.component.ts` — mode toggle becomes three-way (Light / Dark / Bold).
- The `data-mode` preference store/service — extend to accept `'bold'`.

## Verify

- All three modes: tabs are obviously navigation; inactive tabs readable; active tab is the light-contrast folder tab and unmistakable in each mode.
- Switch theme preset across all five — orbs and active tab recolour via `--theme-contrast`.
- Bold mode: accent hero, two blurred orbs, grain, rounded top, no bottom hairline; Inbox badge legible.
- Light and Dark heroes look exactly as before (only the tabs changed).
- Mode preference persists across reload.
- No hardcoded shadow / radius / hex beyond the new token values.

When complete and verified, mark p0003 `Done` in `prompts/README.md`.
