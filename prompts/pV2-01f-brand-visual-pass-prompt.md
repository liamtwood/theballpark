# pV2-01f — Brand visual pass: vivid gradient + size parity

## Read first

1. `WORKING_STANDARDS.md`
2. `prompts/cc-onboarding.md`
3. `prompts/pV2-01b-shell-chrome-shipped.md` (the original `--bp-*` tokens)
4. `prompts/pV2-01d-visual-tweaks-shipped.md` (transparent header + hero)
5. This prompt

## Background — Liam's QC findings

After visiting `http://localhost:4201/`:

1. The Ballpark wordmark and the SM avatar initials are not visually the same size (despite both being specced at 16px). Something else — font weight, font face, line-height, or metrics — is making them look different.
2. The current `--bp-gradient` (soft pink → pale green pastel) is too light to carry text legibly. The brand mark wants a **vivid** gradient with **white** text — the standard "logo circle" treatment.

## Changes

### 1. `--bp-gradient` redefines to vivid

In `client-v2/src/styles.css`:

```css
:root {
  /* Was soft pastel gradient (too pale for text contrast):
     --bp-gradient: linear-gradient(135deg, #fde7f0 0%, #e6f4ea 100%);

     Now a vivid pink-to-green gradient — the "logo circle" treatment.
     White text reads cleanly on this. */
  --bp-gradient: linear-gradient(135deg, #d63384 0%, #16a34a 100%);

  /* NEW token — text color that sits ON the gradient (avatar initials, brand
     buttons that use the gradient as background). */
  --bp-text-on-gradient: #ffffff;
}
```

The soft pastel use case (active row tint, soft surfaces) is already covered by
`--theme-soft`. The new `--bp-gradient` is brand-mark territory only.

### 2. Avatar text color switches to `--bp-text-on-gradient`

In `client-v2/src/app/shared/user-avatar/user-avatar.component.ts`, the
initials block:

```css
/* Was:
   .bp-user-avatar__initials { color: var(--bp-text-color); ... }

   Now: */
.bp-user-avatar__initials {
  color: var(--bp-text-on-gradient);
  background: var(--bp-gradient);
  font-weight: 600;
  /* font-family + size from inputs/host */
}
```

### 3. Audit the wordmark vs avatar size parity

In `<app-shell>`'s header, the Ballpark wordmark needs to render at the **exact
same visual size** as the SM initials in the 40px avatar.

The 40px avatar uses `font-size: 16px` (size × 0.40 in the avatar's `fontSize`
computed signal). So the wordmark must also be 16px.

Things that can cause apparent size mismatch even when both say 16px:

- **Font family difference** — make sure both use `var(--bp-font)` explicitly.
  If the wordmark is inheriting the body font from a parent rather than
  setting `--bp-font` directly, fix.
- **Font weight** — if avatar initials are 600 and wordmark is 700 (or 500),
  they look different. Make both `font-weight: 600`.
- **Line height** — if one has `line-height: 1.5` (inherited) and the other
  `line-height: 1`, the visual box differs. Set both to `line-height: 1`.
- **Font features / letter-spacing** — `letter-spacing: 0.02em` on one and
  not the other will distort apparent size. Match them.
- **Display element** — wordmark in an `<h1>` will inherit heading sizes /
  weights from `styles.css` defaults; use a `<span>` or `<a>` with explicit
  styles instead.

CC: inspect both elements with DevTools, identify the difference, and bring
them to parity. Document in the ship report what was actually different.

Target spec (both must match):

```css
font-family: var(--bp-font);
font-size: 16px;
font-weight: 600;
line-height: 1;
letter-spacing: 0;
color: var(--bp-text-color);   /* wordmark color — text-on-gradient is for avatar */
```

(Wordmark text color stays `--bp-text-color` because it sits on the transparent
header, not on the gradient.)

## Acceptance criteria

1. `/` — Ballpark wordmark and the SM avatar initials are visually the same
   size when measured (screenshot test: take a screenshot, measure pixel
   heights of "B" and "S" — should match within 1px).
2. Avatar circle: vivid pink → green gradient (not pastel), white initials,
   clearly legible.
3. Hover / active states (if any) preserve contrast — don't lose readability.
4. The soft pastel look (used in `--theme-soft` for row highlights etc.) is
   unchanged — only `--bp-gradient` shifted to vivid.
5. `/login` dev picker avatars also render with the new vivid gradient + white
   initials.
6. `/style/hero` still renders correctly (no regression from this commit).
7. Old `client-angular/` on 4200 unchanged.
8. Bump version chip to `[Dev v2] v2.02c` (still in the visual-pass window).
9. Ship report quotes Liam's QC findings (the two issues at the top of this
   prompt) so the record is preserved.
10. Ship report documents what was actually different between the wordmark and
    avatar before the fix (font weight? line-height? font family inheritance?).

## Out of scope

- Adding the brand config DB load (that's pV2-01e — separate)
- New tokens beyond `--bp-text-on-gradient`
- Avatar size variants beyond 40px (those work fine already from pV2-01b)
- Touching `client-angular/`

## Bump + ship

1. Version chip → `[Dev v2] v2.02c`
2. Commit message: `feat(v2.02c): vivid bp-gradient + white-on-gradient + wordmark/avatar size parity`
3. Ship report `prompts/pV2-01f-brand-visual-pass-shipped.md`
4. Flip backlog row to Done

## Reply with

- Commit SHA
- 10/10 acceptance criteria ticked
- The actual root cause of the size mismatch (one sentence)
- Confirmation old app still works
