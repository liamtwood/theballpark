import { Routes } from '@angular/router';

// v1.66ar — each tab is its own "page": hero title = the tab name, hero
// subtitle = the job done on that tab (sentence case). Set via route data
// so it uses the standard hero; the tab band comes from the parent route.
export const BALLPARK_SETTINGS_ROUTES: Routes = [
  { path: '', redirectTo: 'categories', pathMatch: 'full' },
  {
    path: 'categories',
    loadComponent: () => import('./categories/categories.component').then(m => m.CategoriesComponent),
    data: { heroTitle: 'Categories', heroSub: 'Manage the product categories suppliers list items under.' }
  },
  {
    path: 'marketplace',
    loadComponent: () => import('./marketplace/marketplace.component').then(m => m.MarketplaceComponent),
    data: { heroTitle: 'Marketplace', heroSub: 'Configure the marketplace and featured suppliers.' }
  },
  {
    path: 'orgs',
    loadComponent: () => import('./orgs/orgs.component').then(m => m.OrgsComponent),
    data: { heroTitle: 'Orgs', heroSub: 'Manage the organisations on the platform.' }
  },
  {
    path: 'early-access',
    loadComponent: () => import('./early-access/early-access.component').then(m => m.EarlyAccessComponent),
    data: { heroTitle: 'Early Access', heroSub: 'Manage early-access invites and the waitlist.' }
  },
  {
    path: 'feedback',
    loadComponent: () => import('./feedback/feedback.component').then(m => m.FeedbackComponent),
    data: { heroTitle: 'Feedback', heroSub: 'Review feedback, bugs and feature requests.' }
  }
];
