import { Routes } from '@angular/router';

export const PROJECT_DETAIL_ROUTES: Routes = [
  // v1.67 — Project Details is the default landing tab (was Overview).
  { path: '', redirectTo: 'details', pathMatch: 'full' },
  {
    // v1.67 — Project Details tab. Page form of the (deprecated) event
    // drawer: the shared <app-project-event-form> at card density
    // (Event details / Event type / Logistics).
    path: 'details',
    loadComponent: () => import('./tabs/details/details.component').then(m => m.ProjectDetailsComponent)
  },
  {
    // Overview tab (v1.24) — kept mounted for back-compat links, but
    // v1.67 removed it from the visible tab band.
    path: 'overview',
    loadComponent: () => import('./tabs/overview/overview.component').then(m => m.OverviewComponent)
  },
  {
    // v1.65cg (p0005) — Plan tab removed. AI matching + per-category
    // brief editing both live on the Marketplace now, so /plan and
    // /brief redirect there.
    path: 'plan',
    redirectTo: 'marketplace',
    pathMatch: 'full'
  },
  {
    // Backward compat: anyone with a saved /brief link lands on the
    // Marketplace.
    path: 'brief',
    redirectTo: 'marketplace',
    pathMatch: 'full'
  },
  {
    // Marketplace tab (v1.18) — catalogue-grid browse in project context.
    path: 'marketplace',
    loadComponent: () => import('./tabs/marketplace/marketplace.component').then(m => m.MarketplaceComponent)
  },
  {
    // v1.67 — Estimate tab. Page form of the (deprecated) estimate
    // drawer: the read-only <app-estimate> summary inside card chrome.
    // Was the BuildComponent two-column Build/Estimate view, which is
    // retired from routing (file kept in tree for history).
    path: 'estimate',
    loadComponent: () => import('./tabs/estimate/estimate-page.component').then(m => m.EstimatePageComponent)
  },
  {
    // Backward compat: anyone with a saved /build link lands on the
    // Estimate tab.
    path: 'build',
    redirectTo: 'estimate',
    pathMatch: 'full'
  },
  // v1.67 — UNROUTED (files kept in tree for git history, no longer
  // surfaced): the BuildComponent two-column Build/Estimate view
  // (tabs/build/build.component.ts), the legacy vendor-selection Build
  // tab (tabs/build/build-legacy.component.ts, was /supplier), and the
  // standalone legacy Estimate summary route (was /estimate-legacy;
  // EstimateComponent itself lives on, mounted by the Estimate tab page
  // + the deprecated estimate drawer).
  {
    path: 'suppliers',
    loadComponent: () => import('./tabs/suppliers/suppliers.component').then(m => m.SuppliersComponent)
  },
  {
    path: 'messages',
    loadComponent: () => import('./tabs/messages/messages.component').then(m => m.MessagesComponent)
  },
];
