import { Routes } from '@angular/router';
import { AppShellComponent } from './shared/components/app-shell/app-shell.component';
import { devOnlyGuard } from './core/guards/dev-only.guard';

export const routes: Routes = [
  // ── PUBLIC ── (rendered standalone, outside the app shell)
  {
    path: 'welcome',
    loadComponent: () => import('./public/welcome/welcome.component').then(m => m.WelcomeComponent)
  },

  // ── AUTHENTICATED APP ──
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
      // v1.30: /projects/new removed — replaced by the intake modal
      // mounted in app-shell and opened via CreateProjectService.
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
        // Page sets hero via ShellContextService (heroSub = catalogueLabel).
        data: { pageLabel: '', tabs: [] }
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
            { label: 'Orgs', path: '/ballpark-settings/orgs' },
            { label: 'Early Access', path: '/ballpark-settings/early-access' },
            { label: 'Feedback', path: '/ballpark-settings/feedback' }
          ]
        }
      },

      // ── FOLDER (meeting notes, sprints, test runs, workshops) ──
      {
        path: 'folder/:id',
        loadComponent: () => import('./features/meeting/meeting-detail.component').then(m => m.FolderDetailComponent),
        data: { pageLabel: '', tabs: [], hideHero: true }
      },
      { path: 'meeting/:id', redirectTo: 'folder/:id' },

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
