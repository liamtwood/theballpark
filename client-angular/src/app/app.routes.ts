import { Routes } from '@angular/router';
import { AppShellComponent } from './shared/components/app-shell/app-shell.component';
import { devOnlyGuard } from './core/guards/dev-only.guard';
import { environment } from '../environments/environment';

// v1.65gG — marketing-only route set used on prod (and any build
// where environment.marketingOnly === true). Only the public
// welcome page and the supplier brief surface register; every
// other URL bounces to /welcome. Lets us ship the full app bundle
// to prod (so the welcome page's /api/org call still works) without
// exposing the authenticated app surface to anonymous visitors.
const MARKETING_ROUTES: Routes = [
  {
    path: 'welcome',
    loadComponent: () => import('./public/welcome/welcome.component').then(m => m.WelcomeComponent)
  },
  {
    path: 'brief/:token',
    loadComponent: () => import('./features/brief-public/brief-public.component').then(m => m.BriefPublicComponent)
  },
  { path: '', pathMatch: 'full', redirectTo: 'welcome' },
  { path: '**', redirectTo: 'welcome' }
];

// v1.65dg — shared Home/Settings hero-tab band. Mounted on both the
// dashboard route (`/`) AND the settings sub-tree so the folder-tab
// band stays visible across both surfaces, matching the project tab
// pattern (Overview/Marketplace/Inbox is one band; Home/Settings is
// the other).
// v1.65e4 — top-nav now carries Home + Settings as text links per
// persona, so this band on the dashboard is duplicative. Kept for
// any consumer still referencing the constant; dashboard tabs entry
// now empty.
const HOME_SETTINGS_TABS = [
  { label: 'Home',     path: '/' },
  { label: 'Settings', path: '/settings' },
];

// v1.65e5 — Settings page sub-tabs (Organisation / Team / Subscription).
// Renders in the hero tab band when on /settings/*. The Subscription
// path is at /settings/subscription but the shell's startsWith match
// will light it up; same for Team. Organisation is the default child
// (SETTINGS_ROUTES redirects '' → 'organisation').
const SETTINGS_TABS = [
  { label: 'Organisation', path: '/settings/organisation' },
  { label: 'Team',         path: '/settings/team' },
  { label: 'Subscription', path: '/settings/subscription' },
];

const FULL_ROUTES: Routes = [
  // ── PUBLIC ── (rendered standalone, outside the app shell)
  {
    path: 'welcome',
    loadComponent: () => import('./public/welcome/welcome.component').then(m => m.WelcomeComponent)
  },
  // v1.65cv (p0008 §5) — supplier brief surface. No auth — the token
  // in the URL is the credential. Lives outside the agency app shell.
  {
    path: 'brief/:token',
    loadComponent: () => import('./features/brief-public/brief-public.component').then(m => m.BriefPublicComponent)
  },

  // ── AUTHENTICATED APP ──
  {
    path: '',
    component: AppShellComponent,
    children: [

      // ── DASHBOARD ──
      // v1.65dg — Home/Settings hero tabs added so the home screen
      // carries a folder-tab band like project pages do.
      // v1.65di — heroVariant='calm' reverted. The dashboard now uses
      // the default folder-tab chip treatment, matching the project
      // marketplace tabs exactly. The .bp-hero--calm CSS in styles.css
      // is dormant for now (kept in case a future page wants it).
      // v1.66ao — the dashboard now lives at /home; the root redirects to it.
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      {
        path: 'home',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
        data: {
          pageLabel: '',
          // heroTitle drives the "Purpose" title mode (→ "Home"); the
          // greeting mode ignores it and shows "Welcome back, …".
          heroTitle: 'Home',
          tabs: [{ label: 'Home', path: '/home' }]
        }
      },

      // ── AGENT → HOME ──
      // v1.66n (p0033): /agent collapsed into the canonical dashboard.
      // Redirect keeps old links / bookmarks working.
      { path: 'agent', redirectTo: 'home', pathMatch: 'full' },

      // ── PROJECTS ──
      // v1.30: /projects/new removed — replaced by the intake modal
      // mounted in app-shell and opened via CreateProjectService.
      // v1.33: /projects list removed — dashboard was the entry point.
      // v1.66e (p0024): /projects list re-added as a dedicated landing
      // page (the launcher "View Projects" tile + top-nav button land
      // here). Hero pushed via ShellContextService like dashboard/agent.
      {
        path: 'projects',
        loadComponent: () => import('./features/projects/projects-list.component').then(m => m.ProjectsListComponent),
        data: { pageLabel: '', tabs: [], heroTitle: '{Events}', heroSub: 'Manage your active and completed {events}.' }
      },
      {
        path: 'projects/:id',
        loadComponent: () => import('./features/projects/pages/project-detail/project-detail.component').then(m => m.ProjectDetailComponent),
        loadChildren: () => import('./features/projects/pages/project-detail/project-detail.routes').then(m => m.PROJECT_DETAIL_ROUTES),
        data: { pageLabel: '', tabs: [] }  // shell sets its own hero — no global tabs needed
      },

      // ── SUPPLIERS ──
      {
        path: 'shop',
        loadComponent: () => import('./features/suppliers/supplier-list.component').then(m => m.SupplierListComponent),
        data: { pageLabel: '', tabs: [], heroTitle: 'Marketplace', heroSub: 'Browse suppliers, products and services to build your {event}.' }
      },
      // v1.66al — the marketplace list moved /suppliers → /shop. Old
      // list links redirect; detail routes stay /suppliers/:id below.
      { path: 'suppliers', redirectTo: 'shop', pathMatch: 'full' },
      {
        path: 'suppliers/:id',
        loadComponent: () => import('./features/suppliers/supplier-detail.component').then(m => m.SupplierDetailComponent),
        data: { pageLabel: '', tabs: [] }
      },
      {
        path: 'suppliers/:id/items/:itemId',
        loadComponent: () => import('./features/suppliers/item-detail.component').then(m => m.ItemDetailComponent),
        data: { pageLabel: '', tabs: [] }
      },
      // v1.34: consumer-facing item detail page (gallery + specs + related).
      // The supplier-context page at /suppliers/:id/items/:itemId stays as-is.
      {
        path: 'items/:id',
        loadComponent: () => import('./features/items/pages/item-detail-page/item-detail-page.component').then(m => m.ItemDetailPageComponent),
        data: { pageLabel: '', tabs: [] }
      },
      {
        path: 'favourites',
        loadComponent: () => import('./features/favourites/favourites.component').then(m => m.FavouritesComponent),
        data: { pageLabel: '', tabs: [], heroTitle: 'Favourites', heroSub: "Suppliers and items you've saved." }
      },
      // v1.66l (p0015 close-out) — /messages redirects to the canonical
      // /inbox (object naming: Org / Projects / Inbox / Marketplace).
      { path: 'messages', redirectTo: 'inbox', pathMatch: 'full' },

      // ── INBOX ──
      // One canonical route + one viewer-aware component (InboxComponent)
      // for both agency and supplier — the viewer is chosen from the
      // active persona. Supersedes the GlobalMessages (/messages) +
      // SupplierInbox split.
      {
        path: 'inbox',
        loadComponent: () => import('./features/messages/inbox.component').then(m => m.InboxComponent),
        data: { pageLabel: '', tabs: [], heroTitle: 'Inbox', heroSub: 'Messages, supplier responses and updates.' }
      },

      // v1.65e4 — /admin-home retired. Beth's home is /ballpark-settings
      // (which already carries the Categories / Marketplace / Orgs /
      // Early Access / Feedback tabs).

      // ── CLIENTS ──
      {
        path: 'clients',
        loadComponent: () => import('./features/clients/pages/client-list/client-list.component').then(m => m.ClientListComponent),
        data: { pageLabel: '', tabs: [], heroTitle: 'Clients', heroSub: 'Manage your client organisations.' }
      },
      {
        path: 'clients/:id',
        loadComponent: () => import('./features/clients/pages/client-detail/client-detail.component').then(m => m.ClientDetailComponent),
        data: { pageLabel: 'CLIENTS', tabs: [] }
      },

      // ── SETTINGS ──
      // v1.65dg — Settings hero tabs were Home/Settings (shared with
      // the dashboard tab band).
      // v1.65e5 — swapped to the actual Settings sub-routes:
      // Organisation / Team / Subscription. Top-nav already carries
      // Home + Settings, so the hero band can finally show what was
      // marked TODO(v1.65dg-settings-subnav) — the secondary nav
      // between the three settings sub-pages.
      {
        path: 'settings',
        loadChildren: () => import('./features/settings/settings.routes').then(m => m.SETTINGS_ROUTES),
        data: {
          pageLabel: 'SETTINGS',
          // v1.66s — Profile/account surface. The shell hero now shows a
          // fixed "Profile" title + subtitle (replacing the orgName +
          // "SETTINGS" fallback and the old in-page <h2> per-tab title).
          heroTitle: 'Profile',
          heroSub: 'Manage your account, organisation and Ballpark usage.',
          // v1.35a: hero back button → dashboard. Reached via the cog icon
          // (or the dashboard's Invite Member quick action) so there's no
          // longer a nav link to return through.
          back: '/',
          tabs: SETTINGS_TABS
        }
      },

      // ── BALLPARK SETTINGS ──
      {
        path: 'ballpark-settings',
        loadChildren: () => import('./features/ballpark-settings/ballpark-settings.routes').then(m => m.BALLPARK_SETTINGS_ROUTES),
        data: {
          pageLabel: 'PLATFORM SETTINGS',
          tabs: [
            { label: 'Categories', path: '/ballpark-settings/categories' },
            { label: 'Marketplace', path: '/ballpark-settings/marketplace' },
            { label: 'Orgs', path: '/ballpark-settings/orgs' },
            { label: 'Early Access', path: '/ballpark-settings/early-access' },
            { label: 'Feedback', path: '/ballpark-settings/feedback' }
          ]
        }
      },

      // ── FOLDER (meeting notes, sprints, test runs, workshops) ──
      {
        path: 'folder/:id',
        loadComponent: () => import('./features/meeting/meeting-detail.component').then(m => m.FolderDetailComponent),
        data: { pageLabel: '', tabs: [], hideHero: true }
      },
      { path: 'meeting/:id', redirectTo: 'folder/:id' },

      // ── ABOUT ──
      {
        path: 'about',
        loadComponent: () => import('./features/about/about.component').then(m => m.AboutComponent),
        data: { pageLabel: 'ABOUT', tabs: [] }
      },

      // ── DEV ONLY ──
      {
        path: 'test-images',
        loadComponent: () => import('./shared/components/image-test/image-test.component').then(m => m.ImageTestComponent),
        canActivate: [devOnlyGuard],
        data: { pageLabel: 'TEST', tabs: [] }
      },

      // ── FALLBACK ──
      { path: '**', redirectTo: '' }
    ]
  }
];

// v1.65gG — final export: marketing-only on prod, full app
// everywhere else (dev + preview).
export const routes: Routes =
  (environment as any).marketingOnly ? MARKETING_ROUTES : FULL_ROUTES;
