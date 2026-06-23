# CC Prompt — p0033 — Role-keyed top-nav + `/agent` consolidation

Three changes in one commit. Settles the IA decisions deferred from p0020 ("collapse /agent into /home") and from the recent nav-restructure conversation.

Builds on the mechanical bits CC just did (drop dashboard hero tab band, add Inbox to top-nav). Same rules: existing v1.22 tokens only, Lucide icons only, PrimeNG + Tailwind + CSS vars per WORKING_STANDARDS.

## 1. Collapse `/agent` into `/home`

The `/agent` route was a stepping-stone surface that mirrored `/home`'s launcher (per p0019). The rich `/home` IS the agent dashboard now — there's no reason to keep two surfaces rendering the same content.

### Changes

- **Delete `/agent` route entry** from `app.routes.ts`
- **Add redirect** in its place: `{ path: 'agent', redirectTo: 'home', pathMatch: 'full' }` so any existing bookmark or hard-coded link lands cleanly on `/home`
- **Delete `features/agent/agent.component.ts`** (and the `features/agent/` folder if nothing else lives there)
- Remove the lazy `loadComponent` import for the agent component
- Search for any remaining references to `/agent` or `AgentDashboardComponent` and update them to `/home` / the dashboard component

### What stays

- The `/home` route and its dashboard component are unchanged — they already render the launcher + stats + body sections that constitute the agent's daily surface
- Any `goToAgent()` or similar handlers route to `/home` after this change

## 2. Role-keyed top-nav

The top-nav becomes persona-aware. Each persona's nav set is the set of objects that role interacts with.

### Agency role (Sarah-as-agent at Woodland Agency)

Five buttons, left to right:

| Label | Lucide icon | Route |
|---|---|---|
| Agent | `home` (or `layout-dashboard`) | `/home` |
| Inbox | `inbox` | `/inbox` (per p0015) |
| Projects | `folder-open` | `/projects` (per p0024) |
| Marketplace | `store` | `/suppliers` — confirm against `app.routes.ts`; rename to `/marketplace` if cleaner |
| {{ org.name }} | `building-2` (or org avatar if `org.logo_url` exists) | `/settings` |

### Platform-admin role (Beth-as-Ballpark-admin)

Two buttons for now (cross-org admin tools deferred to a future prompt):

| Label | Lucide icon | Route |
|---|---|---|
| Config Home | `home` | `/home` (placeholder — admin content TBD) |
| Ballpark | Ballpark logo or `building-2` fallback | `/settings` |

### Supplier role

**Out of scope for this prompt.** Supplier nav set lands in p0021 (Front / Store / Inbox / Marketplace per the p0015 mockup).

### Implementation pattern

Inject `PersonaService` into the top-nav component. Subscribe to the active persona observable. Compute the nav set reactively:

```typescript
get navItems(): NavItem[] {
  const persona = this.personaSvc.active;
  const orgName = this.orgSvc.activeOrg?.name || 'Settings';
  const orgLogo = this.orgSvc.activeOrg?.logo_url;

  if (persona?.role === 'platform_admin') {
    return [
      { label: 'Config Home', icon: 'home',        route: '/home' },
      { label: 'Ballpark',    icon: 'building-2',  route: '/settings' },
    ];
  }

  // Default: agency role (supplier comes in p0021)
  return [
    { label: 'Agent',        icon: 'home',        route: '/home' },
    { label: 'Inbox',        icon: 'inbox',       route: '/inbox' },
    { label: 'Projects',     icon: 'folder-open', route: '/projects' },
    { label: 'Marketplace',  icon: 'store',       route: '/suppliers' },
    { label: orgName,        icon: 'building-2',  avatar: orgLogo, route: '/settings' },
  ];
}
```

Render the nav array as a single `*ngFor` loop. Each item uses `routerLink` + `routerLinkActive` for the highlight.

## 3. Org-name as Settings label

The rightmost nav button's label becomes the active org's name. Three details:

- **Label binding:** `org.name || 'Settings'` (fallback when org isn't loaded yet — prevents an empty button on first paint)
- **Icon:** prefer `org.logo_url` as a small (16-20px) circular avatar; fall back to Lucide `building-2` when no logo
- **Route:** stays `/settings` — no route rename; just the label changes

When Sarah is the active persona, the button reads `Woodland Agency`. When Beth is active, the button reads `Ballpark`. When the persona switcher swaps the active persona, the label updates reactively because the `OrgService.activeOrg` observable changes with the persona switch (already wired per persona work).

## What NOT to do

- **Don't build Config Home content** for the Ballpark admin role. The route renders the existing `/home` for now — admin cross-org tooling is a separate prompt.
- **Don't change supplier persona nav.** That's p0021's scope.
- **Don't restyle the top-nav.** Same button chrome, same hover state, same active treatment — just a different array of items.
- **Don't change `PersonaService` or `OrgService`.** They already expose `active$` / `activeOrg$` and the persona role/type info. Just consume what's there.
- **Don't add new ConfigService flags.** Persona-keyed nav is intrinsic to the architecture, not a user preference.
- **Don't touch `/home`'s content, drawer, hero, or any other surface.** Top-nav and route deletion only.

## Verify

- **Sarah persona active:** top-nav shows `Agent · Inbox · Projects · Marketplace · Woodland Agency`. Each button routes correctly. Active route highlights.
- **Beth persona active** (via the dev-only persona switcher in the avatar dropdown): top-nav shows `Config Home · Ballpark`. `/home` renders the existing dashboard for now (placeholder content).
- **`/agent` URL** (paste it in the address bar): redirects to `/home` cleanly. No 404.
- **`agent.component.ts` removed** — grep confirms:
  ```bash
  grep -rn "agent.component\|AgentDashboardComponent" client-angular/src/
  ```
  Should return zero hits.
- **Org-name label updates reactively** when persona switches.
- **Org-logo avatar renders** when `org.logo_url` exists; falls back to `building-2` icon otherwise.
- **No regression** on `/home`, `/inbox`, `/projects`, `/settings`, or other routes.
- **Existing tests pass.** If any tests referenced `AgentDashboardComponent` or `/agent`, update them to point at the dashboard component / `/home`.

When complete and verified, mark p0033 `Done` in `prompts/backlog.md` and write `p0033-role-keyed-nav-and-agent-consolidation-shipped.md` per the cc-onboarding ship-report convention.

Also: flip p0020's status note in the backlog — its "collapse /agent into /home" item is now settled by p0033.
