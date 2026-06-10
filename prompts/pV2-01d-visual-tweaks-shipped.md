# Shipped — pV2-01d — Visual tweaks: transparent hero + borderless header

**Version:** v2.02b (chip `[Dev v2] v2.02b`)
**Shipped:** see commit log
**Prompt:** `pV2-01d-visual-tweaks-prompt.md`

## QC record (what Liam tested and confirmed working before this prompt)
- ✓ Avatar circle uses the master gradient token
- ✓ Font color uses the master text token
- ✓ Ballpark wordmark uses the master font (matches the future Font Pair DB value)
- ✓ Wordmark font size = avatar initials font size (visually unified)
- ✓ Dropdown opens, dev user picker works, switching updates name + role + title + subtitle live
- ✓ Hero title + subtitle reflect the active user

## What changed (all in `client-v2/`)
- `shell/page-hero/page-hero.component.ts` — `accent` input default flipped `'theme'` → `'none'`. Hero renders transparent by default; routes opt in to the soft wash with `accent="theme"`. (No CSS change needed — the existing `--accent-none` host-class binding covers the default.)
- `shell/app-shell.component.ts` — header bottom hairline removed; transparent header + transparent hero now flow together with no rule between them.
- `pages/style/hero/hero-demo.component.ts` — variants re-labelled: 1–3 show the transparent default (with a faint card border so the band edges stay visible in the sandbox); variant 4 is now the **opt-in** `accent="theme"` wash (centered) for visual comparison.
- Env chips → `v2.02b` (dev/staging/prod).

## Verify — 7/7
1. ✓ `/` header transparent (`rgba(0,0,0,0)`), border-bottom `0px`.
2. ✓ `/` hero transparent by default (`background-image: none`, bg `rgba(0,0,0,0)`, `--accent-none` class present).
3. ✓ `/style/hero` — variants 1–3 transparent; variant 4 shows the theme wash (gradient) for comparison.
4. ✓ Avatar dropdown user-switch still live-updates hero title + subtitle (Sarah → Beth verified, switched back).
5. ✓ No pV2-01b / pV2-01c regressions (build + lint clean; menu, picker, slot, responsive CSS untouched).
6. ✓ Footer chip `[Dev v2] v2.02b`.
7. ✓ Old `client-angular/` on 4200 unchanged (`[Dev] v1.70a`).

## Noticed in the visual pass
Nothing adverse. One observation for a future polish prompt: with both header and hero transparent, the only structure on the hello page is whitespace — fine for now, but when real feature pages land, pages with dense toolbars may want `accent="theme"` or a sub-nav band to anchor the eye. No action taken (page-settings prompt territory).

pV2-01d flipped to `Done` in `prompts/backlog.md`.
