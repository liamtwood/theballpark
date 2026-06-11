# pV2-04e — Ballpark-admin home: role-keyed launcher (Profile + Page Settings)

> Number provisional — chat-driven (Liam, 2026-06-12: "give admin a new
> home, just profile and page settings"). Renumber if chat assigns one.

**Shipped:** 2026-06-12, chip `[Dev v2] v2.12a`
**Commits:** `450bb34` feat(v2.12a): ballpark-admin home — role-keyed launcher (Profile + Page Settings)

## What landed
- `BALLPARK_TILES` (2 tiles) added to the launcher registry: Profile →
  `/settings/profile` (circle-user) and Page Settings → `/settings/pages`
  (settings icon), with admin-appropriate subtitles.
- `home-agent`'s tile list is now a computed keyed on `auth.role()`:
  `ballpark_admin` → `BALLPARK_TILES`, every other role → `AGENT_TILES`
  (the supplier set still lands in pV2-05).
- `tileForPath()` searches both sets so stub heroes keep resolving.

## Files touched
| File | Lines (Δ) | SHA | Notes |
|---|---|---|---|
| client-v2/src/app/shared/launcher/agent-tiles.ts | +19 / −1 | 450bb34 | BALLPARK_TILES + tileForPath over both sets |
| client-v2/src/app/pages/home/home-agent.component.ts | +7 / −4 | 450bb34 | role-keyed computed tiles |
| client-v2/src/environments/environment.ts | +1 / −1 | 450bb34 | chip v2.12a |

## Acceptance — 4 / 4 verified
- Ballpark Admin persona's /home shows exactly Profile + Page Settings — ✓
  verified live on 4201 via the dev persona switcher (Beth): two tiles,
  correct hrefs
- Agent persona unchanged (5 agent tiles) — ✓ snapshot before the switch
- Both tiles route to real pages (no stubs) — ✓ /settings/profile +
  /settings/pages
- Build + lint + style guard green; 57/57 tests — ✓

## Concerns not in spec
### Hero greeting unchanged for admins
**Where:** home-agent.component.ts (heroTitle path)
**What:** the admin home keeps the role's configured greeting + subtitle
from /settings/pages (ballpark row) — likely desirable (admins can configure
their own hero), just noting no admin-specific default copy shipped.
**Severity:** LOW

### Launcher grid with 2 tiles
**Where:** home-launcher.component.ts (3-across grid)
**What:** the 3-wide grid renders 2 tiles as a single left-ish row pair —
looked fine in verification; flag in case Liam wants 2-up centring.
**Severity:** LOW

## QC notes
(Liam fills this in)

## Chat audit
(chat fills this in — leave the section header so chat finds it)
