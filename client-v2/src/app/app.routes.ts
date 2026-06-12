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
        // Dev-only style sandbox — visual QC for shared chrome components.
        path: 'style/hero',
        loadComponent: () =>
          import('./pages/style/hero/hero-demo.component').then((m) => m.HeroDemoComponent),
      },
      // Launcher-tile targets — placeholders until their prompts land.
      {
        path: 'projects',
        loadComponent: () => import('./pages/stub/coming-soon.component').then((m) => m.ComingSoonComponent),
        data: { feature: 'Projects' },
      },
      {
        path: 'inbox',
        loadComponent: () => import('./pages/stub/coming-soon.component').then((m) => m.ComingSoonComponent),
        data: { feature: 'Inbox' },
      },
      {
        path: 'marketplace',
        loadComponent: () => import('./pages/stub/coming-soon.component').then((m) => m.ComingSoonComponent),
        data: { feature: 'Marketplace' },
      },
      {
        // Supplier-home tile target (v2.12f) — the supplier's storefront hub.
        path: 'marketplace-profile',
        loadComponent: () => import('./pages/stub/coming-soon.component').then((m) => m.ComingSoonComponent),
        data: { feature: 'Marketplace Profile' },
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
  { path: '**', redirectTo: '' },
];
