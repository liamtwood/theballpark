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
