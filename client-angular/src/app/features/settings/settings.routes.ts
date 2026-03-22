import { Routes } from '@angular/router';

export const SETTINGS_ROUTES: Routes = [
  { path: '', redirectTo: 'organisation', pathMatch: 'full' },
  {
    path: 'organisation',
    loadComponent: () => import('./organisation/organisation.component').then(m => m.OrganisationComponent)
  },
  {
    path: 'team',
    loadComponent: () => import('./team/team.component').then(m => m.TeamComponent)
  },
  {
    path: 'subscription',
    loadComponent: () => import('./subscription/subscription.component').then(m => m.SubscriptionComponent)
  }
];
