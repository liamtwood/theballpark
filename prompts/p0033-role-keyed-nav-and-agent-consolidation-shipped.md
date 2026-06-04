# Shipped — p0033 — Role-keyed top-nav + `/agent` consolidation

**Version:** v1.66n
**Shipped:** see commit log
**Prompt:** `p0033-role-keyed-nav-and-agent-consolidation-prompt.md`

## What changed
Three IA changes in one commit — settles the p0020 "collapse /agent"
call and the nav-restructure conversation.

## 1. `/agent` collapsed into `/` (the dashboard)
- `app.routes.ts`: the `/agent` route is now
  `{ path: 'agent', redirectTo: '', pathMatch: 'full' }` — old links land
  on the canonical dashboard.
- `features/agent/agent.component.ts` deleted (folder gone). The rich
  dashboard at `/` IS the agency/agent surface.
- Zero remaining `AgentDashboardComponent` / `/agent` link references.

## 2. Role-keyed top-nav
- `top-nav.component.ts`: the five hard-coded nav links replaced with a
  single `*ngFor` over a `navItems` getter, computed from the active
  persona (recomputes reactively via the existing `active$` subscription).
- **Agency** (Sarah): `Agent · Inbox · Projects · Marketplace · {orgName}`
  → `/` · `/inbox` · `/projects` · `/suppliers` · `/settings`.
- **Platform admin** (Beth, `kind === 'admin'`): `Config Home · {orgName}`
  → `/` (placeholder) · `/settings`.
- Home objects route to `/` with `routerLinkActiveOptions {exact:true}`.

## 3. Org name as the Settings label
- The rightmost button label is `persona.orgName` (Woodland Agency /
  Ballpark), falling back to `Settings` before the persona loads. Routes
  to `/settings`. Updates reactively on persona switch.

## Deviations from the prompt (codebase reality)
- **No `/home` route** — the dashboard is `path: ''`, so "home" = `/`.
  Agent redirects to `''`; nav home links route to `/` (exact-active).
- **Persona gate** uses `persona.kind === 'admin'` (the real field), not
  `role === 'platform_admin'`.
- **Org label/icon** comes from `persona.orgName` (reactive on switch) +
  the `building-2` icon. The persona record carries no `logo_url`, so the
  org-logo avatar is the documented `building-2` fallback — a real logo
  avatar can be wired when per-persona org logos exist.
- **Projects label** is the literal object name "Projects" (per the
  locked Org/Projects/Inbox/Marketplace vocabulary), not the
  `projectLabel` token the p0024 nav button used.

## Notes
- Persona-dropdown switch routing is unchanged (Beth's switch still lands
  on `/ballpark-settings`); her "Config Home" nav button goes to `/` per
  spec. Reconcile when admin Config Home content is built.
- `personaHomeRoute` / `personaHomeQueryParams` getters are now unused by
  the desktop nav (left in place; the mobile bottom-nav is untouched).

## Verify (per prompt spec)
Build clean. Visual QC for Liam:
- ☐ Sarah active → nav: Agent · Inbox · Projects · Marketplace · Woodland Agency; each routes; active highlights.
- ☐ Beth active (persona switcher) → nav: Config Home · Ballpark; `/` renders the dashboard placeholder.
- ☐ `/agent` URL → redirects to `/`, no 404.
- ☐ Org-name label updates reactively on persona switch.
- ☐ No regression on `/`, `/inbox`, `/projects`, `/settings`.

p0033 → `Done` in backlog; p0020's "collapse /agent" item flipped to settled.
