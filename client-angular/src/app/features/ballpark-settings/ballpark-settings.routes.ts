import { Routes } from '@angular/router';

export const BALLPARK_SETTINGS_ROUTES: Routes = [
  { path: '', redirectTo: 'categories', pathMatch: 'full' },
  {
    path: 'categories',
    loadComponent: () => import('./categories/categories.component').then(m => m.CategoriesComponent)
  },
  {
    path: 'marketplace',
    loadComponent: () => import('./marketplace/marketplace.component').then(m => m.MarketplaceComponent)
  },
  {
    path: 'orgs',
    loadComponent: () => import('./orgs/orgs.component').then(m => m.OrgsComponent)
  },
  {
    path: 'early-access',
    loadComponent: () => import('./early-access/early-access.component').then(m => m.EarlyAccessComponent)
  },
  {
    path: 'feedback',
    loadComponent: () => import('./feedback/feedback.component').then(m => m.FeedbackComponent)
  }
];
