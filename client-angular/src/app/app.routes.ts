import { Routes } from '@angular/router';
import { AppShellComponent } from './shared/components/app-shell/app-shell.component';
import { devOnlyGuard } from './core/guards/dev-only.guard';
import { supplierOnlyGuard } from './core/guards/supplier-only.guard';
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
      // v1.68h — /home is now the "website-feel" launcher (HomeComponent, a
      // centred hero + action tiles). The data dashboard was renamed and moved
      // to /dashboard (same component, kept intact). Supplier first: agency /
      // admin /home falls back to /dashboard until their launcher configs land.
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      {
        path: 'home',
        loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent),
        data: {
          pageLabel: '',
          // v1.68i — the launcher renders its own centred title/subtitle, so
          // the shell hero band is suppressed here.
          hideHero: true,
          tabs: []
        }
      },
      {
        // v1.68h — the former /home data dashboard (stats + Upcoming / Credits
        // / Saved-suppliers panels), renamed to Dashboard.
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
        data: {
          pageLabel: '',
          heroTitle: 'Home',
          tabs: []
        }
      },

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
      // The marketplace list is /shop; supplier DETAIL stays /suppliers/:id.
      // (The legacy bare /suppliers → /shop redirect was removed in the
      //  v1.66 route cleanup — all internal links point at /shop now.)
      // v1.66db — SupplierDetailComponent now serves THREE URL-distinct
      // surfaces via route data.mode/surface:
      //   /suppliers/:id  → public detail (tabbed, read-only)
      //   /storefront     → owner's storefront management (single surface)
      //   /store          → owner's catalogue management (single surface)
      {
        path: 'suppliers/:id',
        loadComponent: () => import('./features/suppliers/supplier-detail.component').then(m => m.SupplierDetailComponent),
        // heroTitle is the page-settings label fallback ("Supplier"); the live
        // hero title is the supplier's own name, pushed via ShellContext.
        data: { pageLabel: '', tabs: [], heroTitle: 'Supplier', mode: 'public' }
      },
      // ── SUPPLIER MANAGEMENT SURFACES (owner only) ──
      // URL-distinct management surfaces — each its own URL, mounted on the
      // same component with a different `surface`. /orders, /analytics, etc.
      // would follow the same pattern.
      {
        // v1.68c — renamed /shopfront → /storefront (internal URL
        // consistency: "storefront" management surface vs "store" catalogue).
        // No legacy /shopfront alias — pre-launch, no saved links to break.
        path: 'storefront',
        canActivate: [supplierOnlyGuard],
        loadComponent: () => import('./features/suppliers/supplier-detail.component').then(m => m.SupplierDetailComponent),
        data: { pageLabel: '', tabs: [], mode: 'manage', surface: 'storefront', self: true }
      },
      {
        path: 'store',
        canActivate: [supplierOnlyGuard],
        loadComponent: () => import('./features/suppliers/supplier-detail.component').then(m => m.SupplierDetailComponent),
        data: { pageLabel: '', tabs: [], mode: 'manage', surface: 'store', self: true }
      },
      // v1.67d — Marketplace Profile hub. Supplier sub-hub reached from the
      // supplier home launcher tile; routes out to Marketplace / My Shop /
      // Profile via the canonical <app-action-tile> grid. Hero + Back link
      // come from this route data (rendered by the shell).
      {
        path: 'marketplace-profile',
        canActivate: [supplierOnlyGuard],
        loadComponent: () => import('./features/suppliers/marketplace-profile.component').then(m => m.MarketplaceProfileComponent),
        data: {
          pageLabel: '', tabs: [],
          // v1.68o — the shared <app-home-launcher> master renders its own
          // centred hero + Back, so the shell hero band is suppressed here.
          hideHero: true
        }
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
