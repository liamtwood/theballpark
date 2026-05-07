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
    path: 'build',
    loadComponent: () => import('./tabs/build/build.component').then(m => m.BuildComponent)
  },
  {
    // Supplier tab — re-surfaces the legacy build component (vendor
    // selection per category + request-quotes flow). File kept under
    // build/ for git-history continuity; class is BuildLegacyComponent.
    path: 'supplier',
    loadComponent: () => import('./tabs/build/build-legacy.component').then(m => m.BuildLegacyComponent)
  },
  {
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
