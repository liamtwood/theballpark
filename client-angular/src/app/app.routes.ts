import { Routes } from '@angular/router';
import { AppShellComponent } from './shared/components/app-shell/app-shell.component';
import { devOnlyGuard } from './core/guards/dev-only.guard';

// v1.65dg — shared Home/Settings hero-tab band. Mounted on both the
// dashboard route (`/`) AND the settings sub-tree so the folder-tab
// band stays visible across both surfaces, matching the project tab
// pattern (Overview/Marketplace/Inbox is one band; Home/Settings is
// the other).
const HOME_SETTINGS_TABS = [
  { label: 'Home',     path: '/' },
  // `/settings` (not `/settings/organisation`) so the shell's
  // startsWith isActive() match lights up on every sub-URL
  // (`/settings/team`, `/settings/subscription`); the route itself
  // redirects to /organisation via SETTINGS_ROUTES' default.
  { label: 'Settings', path: '/settings' },
];

export const routes: Routes = [
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
      {
        path: '',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
        data: { pageLabel: '', tabs: HOME_SETTINGS_TABS }
      },

      // ── PROJECTS ──
      // v1.30: /projects/new removed — replaced by the intake modal
      // mounted in app-shell and opened via CreateProjectService.
      // v1.33: /projects list removed — dashboard is the entry point.
      {
        path: 'projects/:id',
        loadComponent: () => import('./features/projects/pages/project-detail/project-detail.component').then(m => m.ProjectDetailComponent),
        loadChildren: () => import('./features/projects/pages/project-detail/project-detail.routes').then(m => m.PROJECT_DETAIL_ROUTES),
        data: { pageLabel: '', tabs: [] }  // shell sets its own hero — no global tabs needed
      },

      // ── SUPPLIERS ──
      {
        path: 'suppliers',
        loadComponent: () => import('./features/suppliers/supplier-list.component').then(m => m.SupplierListComponent),
        // Page sets hero via ShellContextService (heroSub = catalogueLabel).
        data: { pageLabel: '', tabs: [] }
      },
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
        data: { pageLabel: 'FAVOURITES', tabs: [] }
      },
      {
        path: 'messages',
        loadComponent: () => import('./features/messages/global-messages.component').then(m => m.GlobalMessagesComponent),
        data: { pageLabel: 'MESSAGES', tabs: [] }
      },

      // ── SUPPLIER PERSONA INBOX ──
      // v1.65dz (p0015) — supplier-side mount of the shared
      // MessagesInboxComponent with viewer='supplier'. Reached from
      // the supplier persona's top-nav (PersonaService gating).
      {
        path: 'inbox',
        loadComponent: () => import('./features/messages/supplier-inbox.component').then(m => m.SupplierInboxComponent),
        data: { pageLabel: 'INBOX', tabs: [] }
      },

      // v1.65e4 — /admin-home retired. Beth's home is /ballpark-settings
      // (which already carries the Categories / Marketplace / Orgs /
      // Early Access / Feedback tabs).

      // ── CLIENTS ──
      {
        path: 'clients',
        loadComponent: () => import('./features/clients/pages/client-list/client-list.component').then(m => m.ClientListComponent),
        data: { pageLabel: 'CLIENTS', tabs: [] }
      },
      {
        path: 'clients/:id',
        loadComponent: () => import('./features/clients/pages/client-detail/client-detail.component').then(m => m.ClientDetailComponent),
        data: { pageLabel: 'CLIENTS', tabs: [] }
      },

      // ── SETTINGS ──
      // v1.65dg — Settings hero tabs are now Home / Settings (shared
      // with the dashboard) so the band stays consistent across both
      // surfaces. Organisation / Team / Subscription routes still
      // resolve by URL; a secondary in-page nav for switching between
      // them is TODO(v1.65dg-settings-subnav).
      // v1.65di — heroVariant='calm' reverted; default folder-tab
      // chrome (matches dashboard + project marketplace).
      {
        path: 'settings',
        loadChildren: () => import('./features/settings/settings.routes').then(m => m.SETTINGS_ROUTES),
        data: {
          pageLabel: 'SETTINGS',
          // v1.35a: hero back button → dashboard. Reached via the cog icon
          // (or the dashboard's Invite Member quick action) so there's no
          // longer a nav link to return through.
          back: '/',
          tabs: HOME_SETTINGS_TABS
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
