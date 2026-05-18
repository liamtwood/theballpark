import { Routes } from '@angular/router';

export const PROJECT_DETAIL_ROUTES: Routes = [
  // v1.24: Overview is the default landing tab.
  { path: '', redirectTo: 'overview', pathMatch: 'full' },
  {
    // Overview tab (v1.24) — action-oriented dashboard. Event strip
    // + 2×2 inbox cards (Brief / Marketplace / Estimate / Messages)
    // surfaced as the project's first impression.
    path: 'overview',
    loadComponent: () => import('./tabs/overview/overview.component').then(m => m.OverviewComponent)
  },
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
    // Estimate tab (v1.18b rename of the "Build" tab) — unified
    // compressed category cards (left) with sticky estimate summary
    // (right). Class is still BuildComponent and the file lives at
    // tabs/build/build.component.ts for git-history continuity; only
    // the user-visible label + URL slug were renamed.
    path: 'estimate',
    loadComponent: () => import('./tabs/build/build.component').then(m => m.BuildComponent)
  },
  {
    // Backward compat: anyone with a saved /build link lands on the
    // renamed Estimate route. Re-slug rather than dual-mount so the
    // canonical URL is stable.
    path: 'build',
    redirectTo: 'estimate',
    pathMatch: 'full'
  },
  {
    // Legacy "vendor selection" Build tab — preserved at /supplier for
    // safety. Not surfaced in the project tab bar after v1.18.
    path: 'supplier',
    loadComponent: () => import('./tabs/build/build-legacy.component').then(m => m.BuildLegacyComponent)
  },
  {
    // Legacy standalone Estimate page (pre-v1.18). The /estimate slug
    // now points at the unified Build/Estimate component above; the
    // legacy file is preserved here under -legacy in case anyone needs
    // to compare the older summary view.
    path: 'estimate-legacy',
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
