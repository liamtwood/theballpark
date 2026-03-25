import { Routes } from '@angular/router';
import { AppShellComponent } from './shared/components/app-shell/app-shell.component';
import { devOnlyGuard } from './core/guards/dev-only.guard';

export const routes: Routes = [
  {
    path: '',
    component: AppShellComponent,
    children: [

      // ── DASHBOARD ──
      {
        path: '',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
        data: { pageLabel: '', tabs: [] }
      },

      // ── PROJECTS ──
      {
        path: 'projects',
        loadComponent: () => import('./features/projects/pages/project-list/project-list.component').then(m => m.ProjectListComponent),
        data: { pageLabel: '', tabs: [] }
      },
      {
        path: 'projects/new',
        loadComponent: () => import('./features/projects/pages/project-create/project-create.component').then(m => m.ProjectCreateComponent),
        data: { pageLabel: '', tabs: [] }
      },
      {
        path: 'projects/:id',
        loadComponent: () => import('./features/projects/pages/project-detail/project-detail.component').then(m => m.ProjectDetailComponent),
        loadChildren: () => import('./features/projects/pages/project-detail/project-detail.routes').then(m => m.PROJECT_DETAIL_ROUTES),
        data: { pageLabel: '', tabs: [] }  // shell sets its own hero — no global tabs needed
      },

      // ── SUPPLIERS ──
      {
        path: 'suppliers',
        loadComponent: () => import('./features/suppliers/supplier-list.component').then(m => m.SupplierListComponent),
        data: { pageLabel: 'CATALOGUE', tabs: [] }
      },
      {
        path: 'suppliers/:id',
        loadComponent: () => import('./features/suppliers/supplier-detail.component').then(m => m.SupplierDetailComponent),
        data: { pageLabel: '', tabs: [] }
      },
      {
        path: 'suppliers/:id/items/:itemId',
        loadComponent: () => import('./features/suppliers/item-detail.component').then(m => m.ItemDetailComponent),
        data: { pageLabel: '', tabs: [] }
      },
      {
        path: 'favourites',
        loadComponent: () => import('./features/favourites/favourites.component').then(m => m.FavouritesComponent),
        data: { pageLabel: 'FAVOURITES', tabs: [] }
      },
      {
        path: 'messages',
        loadComponent: () => import('./features/messages/global-messages.component').then(m => m.GlobalMessagesComponent),
        data: { pageLabel: 'MESSAGES', tabs: [] }
      },

      // ── CLIENTS ──
      {
        path: 'clients',
        loadComponent: () => import('./features/clients/pages/client-list/client-list.component').then(m => m.ClientListComponent),
        data: { pageLabel: 'CLIENTS', tabs: [] }
      },
      {
        path: 'clients/:id',
        loadComponent: () => import('./features/clients/pages/client-detail/client-detail.component').then(m => m.ClientDetailComponent),
        data: { pageLabel: 'CLIENTS', tabs: [] }
      },

      // ── SETTINGS ──
      {
        path: 'settings',
        loadChildren: () => import('./features/settings/settings.routes').then(m => m.SETTINGS_ROUTES),
        data: {
          pageLabel: 'SETTINGS',
          tabs: [
            { label: 'Organisation', path: '/settings/organisation' },
            { label: 'Team',         path: '/settings/team' },
            { label: 'Subscription', path: '/settings/subscription' }
          ]
        }
      },

      // ── BALLPARK SETTINGS ──
      {
        path: 'ballpark-settings',
        loadChildren: () => import('./features/ballpark-settings/ballpark-settings.routes').then(m => m.BALLPARK_SETTINGS_ROUTES),
        data: {
          pageLabel: 'PLATFORM SETTINGS',
          tabs: [
            { label: 'Categories', path: '/ballpark-settings/categories' },
            { label: 'Marketplace', path: '/ballpark-settings/marketplace' },
            { label: 'Orgs', path: '/ballpark-settings/orgs' }
          ]
        }
      },

      // ── ABOUT ──
      {
        path: 'about',
        loadComponent: () => import('./features/about/about.component').then(m => m.AboutComponent),
        data: { pageLabel: 'ABOUT', tabs: [] }
      },

      // ── DEV ONLY ──
      {
        path: 'test-images',
        loadComponent: () => import('./shared/components/image-test/image-test.component').then(m => m.ImageTestComponent),
        canActivate: [devOnlyGuard],
        data: { pageLabel: 'TEST', tabs: [] }
      },

      // ── FALLBACK ──
      { path: '**', redirectTo: '' }
    ]
  }
];
