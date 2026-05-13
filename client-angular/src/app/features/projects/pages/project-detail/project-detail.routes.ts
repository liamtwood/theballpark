import { Routes } from '@angular/router';

export const PROJECT_DETAIL_ROUTES: Routes = [
  { path: '', redirectTo: 'event', pathMatch: 'full' },
  {
    // Event tab — project facts (details, type, logistics, financials,
    // project brief markdown). Was the original Brief tab.
    path: 'event',
    loadComponent: () => import('./tabs/event/event.component').then(m => m.EventComponent)
  },
  {
    // Brief tab — In Scope picker (split out of the original Brief tab).
    path: 'brief',
    loadComponent: () => import('./tabs/brief/brief.component').then(m => m.BriefComponent)
  },
  {
    // Marketplace tab (v1.18) — catalogue-grid browse in project context.
    // Previously served from /build with the "Marketplace" label;
    // the unified Build tab now owns /build, so this moved to its own
    // route. Component logic is the v1.17 catalogue-grid + cart wiring
    // verbatim.
    path: 'marketplace',
    loadComponent: () => import('./tabs/marketplace/marketplace.component').then(m => m.MarketplaceComponent)
  },
  {
    // Build tab (v1.18) — unified Build + Estimate. Compressed category
    // cards (left) with sticky estimate summary (right). Replaced the
    // catalogue-grid wrapper that used to live here.
    path: 'build',
    loadComponent: () => import('./tabs/build/build.component').then(m => m.BuildComponent)
  },
  {
    // Legacy "vendor selection" Build tab — preserved at /supplier for
    // safety. Not surfaced in the project tab bar after v1.18.
    path: 'supplier',
    loadComponent: () => import('./tabs/build/build-legacy.component').then(m => m.BuildLegacyComponent)
  },
  {
    // Estimate tab — dropped from the project tab bar in v1.18 (the
    // estimate summary is now embedded in the Build tab). Route kept
    // for safety / direct-link callers; file unchanged.
    path: 'estimate',
    loadComponent: () => import('./tabs/estimate/estimate.component').then(m => m.EstimateComponent)
  },
  {
    path: 'suppliers',
    loadComponent: () => import('./tabs/suppliers/suppliers.component').then(m => m.SuppliersComponent)
  },
  {
    path: 'messages',
    loadComponent: () => import('./tabs/messages/messages.component').then(m => m.MessagesComponent)
  },
];
