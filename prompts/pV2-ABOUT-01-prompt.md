# pV2-ABOUT-01 — In-app About (version / release / What's New)

**Type:** client-v2 UI · small
**Owner:** CC implements + commits. Chat authored this. Tracker: **FR-00207**
(under EP-00016 Requirements Management). Target **v0.1.2**.
**Standard-first:** use the standard page-hero/dialog + tokens + `bp-*` fonts
(per `docs/DESIGN.md`); no hex, no raw Tailwind colours.

## Why
`pV2-RELEASE-VERSIONING-01` added an About *line* in the user menu (release +
build). FR-00207 wants a small, self-contained **About** view the user can open —
kept current automatically each release from the same single source.

## What to build
An **About** entry in the user menu (near "What's new") opening a compact About
panel/page showing:
- **App name** — Ballpark.
- **Version** — the client release headline (**"Preview v0.1.x"**) with the
  build (`v2.NNN`) as a muted sub-line. Read from `environment` (`release` +
  `build`) — the SAME single source the chip/About-line use, so it updates every
  release with no separate edit.
- **Environment** — Dev / Preview / (Prod later), from env.
- **What's New** — a link/button through to the What's New page.
- (Optional, cheap) a one-line product tagline + a link to any public
  terms/privacy if they exist; skip if not.

Keep it small — a menu item → a dialog or a short `/about` view using the
standard shell. No new backend; everything reads from `environment`.

## Acceptance
- [ ] "About" reachable from the user menu; shows app name + release (headline)
      + build (sub) + environment, read from `environment`.
- [ ] Link through to What's New works.
- [ ] Values update automatically on the next release (no hard-coded version).
- [ ] Standard layout/tokens; v2 standards (OnPush/signals); builds clean; chip
      bumped; shipped file written.

## Concerns not in spec
Standard section. Note if the About should also show anything org/user-specific
(kept out of scope here — this is app version/release info only).
