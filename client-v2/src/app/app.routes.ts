import { Routes } from '@angular/router';
import { AppShellComponent } from './shell/app-shell.component';
import { requiresOrgGuard } from './core/auth/requires-org.guard';
import { needsOnboardingGuard } from './core/auth/needs-onboarding.guard';
import { adminGuard } from './core/auth/admin.guard';
import { ballparkAdminGuard } from './core/auth/ballpark-admin.guard';

export const routes: Routes = [
  {
    // PUBLIC front door (pV2-02b) — no guard, no shell. Matches `/` only;
    // deeper URLs fall through to the shell parent below.
    path: '',
    loadComponent: () =>
      import('./pages/landing/landing.component').then((m) => m.LandingComponent),
  },
  {
    // ORGLESS (signed in, no membership yet) — pure-bleed, outside the shell.
    path: 'onboarding',
    canActivate: [needsOnboardingGuard],
    loadComponent: () =>
      import('./pages/onboarding/onboarding.component').then((m) => m.OnboardingComponent),
  },
  {
    // PUBLIC marketing deck (welcome pages) — ported verbatim from v1. No
    // shell, no guard; fully self-contained (own brand styling, public
    // marketing endpoints on the shared server). Off the design system by
    // design (style-guard exempt).
    path: 'welcome',
    loadComponent: () =>
      import('./public/welcome/welcome.component').then((m) => m.WelcomeComponent),
  },
  {
    path: '',
    component: AppShellComponent, // header + outlet — every feature route gets the shell
    canActivate: [requiresOrgGuard], // signed-out → /login; orgless → /onboarding
    children: [
      {
        // The authenticated home surface (pV2-04b launcher-only agent home;
        // pV2-05 adds the supplier variant + role switch).
        path: 'home',
        loadComponent: () =>
          import('./pages/home/home-agent.component').then((m) => m.HomeAgentComponent),
      },
      {
        // Settings → Team (pV2-03). Admin-only on top of the shell's requiresOrgGuard.
        path: 'settings/team',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/settings/team/team.component').then((m) => m.TeamComponent),
      },
      {
        // Settings → Pages — the page-settings TABLE (Liam's simplification).
        // PLATFORM admins only: these settings are org_type-wide.
        path: 'settings/pages',
        canActivate: [ballparkAdminGuard],
        loadComponent: () =>
          import('./pages/settings/pages/pages-settings.component').then(
            (m) => m.PagesSettingsComponent
          ),
      },
      {
        // Settings → Categories (pV2-MARKET-00) — marketplace category
        // curation. PLATFORM admins only (matches the server's PATCH gate).
        path: 'settings/categories',
        canActivate: [ballparkAdminGuard],
        loadComponent: () =>
          import('./pages/settings/categories/categories-settings.component').then(
            (m) => m.CategoriesSettingsComponent
          ),
      },
      {
        // Settings → Codelists (pV2-CODELISTS-01) — reference-data curation
        // (RC/RCV). PLATFORM admins only (matches the server's write gate).
        path: 'settings/codelists',
        canActivate: [ballparkAdminGuard],
        loadComponent: () =>
          import('./pages/settings/codelists/codelists-settings.component').then(
            (m) => m.CodelistsSettingsComponent
          ),
      },
      {
        // Settings → Early Access (pV2-EA-02) — waitlist signups + welcome
        // content + admin notifications. Ballpark admins only, gated on the
        // SAME session role as Pages/Categories/Codelists (no separate secret).
        path: 'settings/early-access',
        canActivate: [ballparkAdminGuard],
        loadComponent: () =>
          import('./pages/settings/early-access/early-access.component').then(
            (m) => m.EarlyAccessComponent
          ),
      },
      {
        // Dev-only style sandbox — visual QC for shared chrome components.
        path: 'style/hero',
        loadComponent: () =>
          import('./pages/style/hero/hero-demo.component').then((m) => m.HeroDemoComponent),
      },
      {
        // Dev-only DIALOGS.md sandbox — every dialog archetype on one page.
        path: 'style/dialogs',
        loadComponent: () =>
          import('./pages/style/dialogs/dialogs-demo.component').then((m) => m.DialogsDemoComponent),
      },
      // Launcher-tile targets — placeholders until their prompts land.
      {
        // The agent New Project tile's create flow (v2.12g split — was the
        // same /projects target as the list tile).
        path: 'projects/new',
        loadComponent: () =>
          import('./pages/projects/projects-new.component').then((m) => m.ProjectsNewComponent),
      },
      {
        // pV2-PROJECTS-01 — the agency project list (was a coming-soon stub).
        path: 'projects',
        loadComponent: () =>
          import('./pages/projects/projects-page.component').then((m) => m.ProjectsPageComponent),
      },
      {
        // pV2-PROJECTS-02 — the inside-project view (3 tabs). Must sit
        // AFTER 'projects/new' so that matches first.
        path: 'projects/:id',
        loadComponent: () =>
          import('./pages/projects/project-detail.component').then((m) => m.ProjectDetailComponent),
      },
      {
        path: 'inbox',
        loadComponent: () => import('./pages/stub/coming-soon.component').then((m) => m.ComingSoonComponent),
        data: { feature: 'Inbox' },
      },
      {
        // pV2-06d — supplier storefront + store.
        path: 'suppliers/:id',
        loadComponent: () =>
          import('./pages/suppliers/supplier-detail.component').then(
            (m) => m.SupplierDetailComponent
          ),
      },
      {
        // pV2-06a — the browse foundation (was a coming-soon stub).
        path: 'marketplace',
        loadComponent: () =>
          import('./pages/marketplace/marketplace-page.component').then(
            (m) => m.MarketplacePageComponent
          ),
      },
      {
        // Supplier sub-hub (v2.13a — v1.68t port): stage tiles over /projects.
        path: 'projects-hub',
        loadComponent: () =>
          import('./pages/supplier/projects-hub.component').then((m) => m.ProjectsHubComponent),
      },
      {
        // Supplier sub-hub (v2.13a — v1.68o port; renamed v2.13b per §14:
        // storefront = the public-face hub, "Marketplace Profile" retired).
        path: 'storefront',
        loadComponent: () =>
          import('./pages/supplier/storefront.component').then((m) => m.StorefrontComponent),
      },
      {
        // Storefront hub tile target — the catalogue stub (§14 internal name
        // /store; "My Shop" is UI copy only).
        path: 'store',
        loadComponent: () => import('./pages/stub/coming-soon.component').then((m) => m.ComingSoonComponent),
        data: { feature: 'My Shop' },
      },
      {
        // Profile — the org's own profile + financial defaults (the v2 port
        // of v1's /settings/organisation; reference consumer of
        // edit-section + page-density edit-field).
        path: 'settings/profile',
        loadComponent: () =>
          import('./pages/settings/profile/profile.component').then((m) => m.ProfileComponent),
      },
      // future feature routes go here, all get the shell
    ],
  },
  // Pure-bleed routes outside the shell (no header):
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'auth/callback',
    loadComponent: () =>
      import('./pages/auth-callback/auth-callback.component').then((m) => m.AuthCallbackComponent),
  },
  { path: '**', redirectTo: 'welcome' },
];
