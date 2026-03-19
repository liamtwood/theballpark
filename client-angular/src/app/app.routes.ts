import { Routes } from '@angular/router';
import { devOnlyGuard } from './core/guards/dev-only.guard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent) },
  { path: 'projects', loadComponent: () => import('./features/projects/pages/project-list/project-list.component').then(m => m.ProjectListComponent) },
  { path: 'projects/new', loadComponent: () => import('./features/projects/pages/project-create/project-create.component').then(m => m.ProjectCreateComponent) },
  { path: 'projects/:id', loadComponent: () => import('./features/projects/pages/project-detail/project-detail.component').then(m => m.ProjectDetailComponent) },
  { path: 'suppliers', loadComponent: () => import('./features/suppliers/supplier-list.component').then(m => m.SupplierListComponent) },
  { path: 'clients', loadComponent: () => import('./features/clients/pages/client-list/client-list.component').then(m => m.ClientListComponent) },
  { path: 'clients/:id', loadComponent: () => import('./features/clients/pages/client-detail/client-detail.component').then(m => m.ClientDetailComponent) },
  { path: 'settings', loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent) },
  { path: 'about', loadComponent: () => import('./features/about/about.component').then(m => m.AboutComponent) },
  { path: 'test-images', loadComponent: () => import('./shared/components/image-test/image-test.component').then(m => m.ImageTestComponent), canActivate: [devOnlyGuard] },
  { path: '**', redirectTo: '' },
];
