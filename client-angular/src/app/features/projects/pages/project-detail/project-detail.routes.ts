import { Routes } from '@angular/router';

export const PROJECT_DETAIL_ROUTES: Routes = [
  { path: '', redirectTo: 'brief', pathMatch: 'full' },
  {
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
