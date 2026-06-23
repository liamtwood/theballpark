# Shipped — pV2-01f — Brand visual pass: vivid gradient + size parity

**Version:** v2.02c (chip `[Dev v2] v2.02c`)
**Shipped:** see commit log
**Prompt:** `pV2-01f-brand-visual-pass-prompt.md`

## QC findings (Liam, quoted from the prompt)
1. "The Ballpark wordmark and the SM avatar initials are not visually the same size (despite both being specced at 16px). Something else — font weight, font face, line-height, or metrics — is making them look different."
2. "The current `--bp-gradient` (soft pink → pale green pastel) is too light to carry text legibly. The brand mark wants a **vivid** gradient with **white** text — the standard 'logo circle' treatment."

## Root cause of the size mismatch (DevTools audit, measured before fixing)
**The wordmark was rendering at `font-size: 14px` with `letter-spacing: −0.35px` (Tailwind `text-sm` + `tracking-tight`), while the avatar initials rendered at 16px / normal tracking.** Font family and weight were identical (both the system-sans stack at 600) — so NOT font face or weight. Canvas glyph measurement: "B" = 10px vs "S" = 11px before; **both 11px after** (≤1px criterion met exactly).

Fix: wordmark switched from Tailwind sizing utilities to explicit parity styles — `font-family: var(--bp-font); font-size: 16px; font-weight: 600; line-height: 1; letter-spacing: 0; color: var(--bp-text-color)`. Avatar initials got the same `line-height: 1 / letter-spacing: 0` so both sides pin to the target spec.

## What changed (all in `client-v2/`)
- `styles.css` — new brand tokens: **`--bp-gradient`** (vivid `#d63384 → #16a34a`, brand-mark territory only), **`--bp-text-on-gradient: #ffffff`**, **`--bp-font`** (master font stack; body now references it), **`--bp-text-color: #1f2937`** (master text; `--theme-text` now aliases it — one definition). `--theme-soft` (pastel) untouched — row tints unchanged.
- `shared/user-avatar` — initials: `background: var(--bp-gradient)`, `color: var(--bp-text-on-gradient)`, `font-family: var(--bp-font)`, `line-height: 1`, `letter-spacing: 0`.
- `shell/app-shell` — wordmark: explicit parity styles (above); Tailwind `text-sm`/`tracking-tight` removed.
- Env chips → `v2.02c`.

## Token-name note
The prompt's "Was" comment names the pastel as `--bp-gradient` — in the shipped code that pastel was `--theme-soft`. Per the prompt's own scoping ("the soft pastel use case is already covered by `--theme-soft`"), `--bp-gradient` lands as a NEW vivid token; nothing renamed. `--bp-font`/`--bp-text-color` are also new (the QC bullets' "master" tokens), ready to be DB-driven by pV2-01e.

## Verify — 10/10
1. ✓ Wordmark vs initials visual size: glyph "B" 11px = glyph "S" 11px (within 1px — identical).
2. ✓ Avatar: vivid pink→green gradient (`rgb(214,51,132) → #16a34a`), white initials, legible.
3. ✓ Hover preserves contrast (avatar button hover is opacity-only; white-on-vivid stays readable).
4. ✓ `--theme-soft` pastel unchanged (verified token value still `#fde7f0 …`).
5. ✓ `/login` picker avatars: vivid gradient + white.
6. ✓ `/style/hero` renders 4 variants, variant-4 wash intact — no regression.
7. ✓ Old `client-angular/` on 4200 unchanged (`[Dev] v1.70a`).
8. ✓ Chip `[Dev v2] v2.02c`.
9. ✓ QC findings quoted above.
10. ✓ Actual pre-fix difference documented above (font-size + letter-spacing; NOT weight/family).

pV2-01f flipped to `Done` in `prompts/backlog.md`. Next: pV2-01e (brand config from DB, seeds these vivid values).
