import { Routes } from '@angular/router';

// TODO: replace with real admin guard once auth is in place (v1.3)
// import { AdminGuard } from '../../core/guards/admin.guard';

export const BALLPARK_SETTINGS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./ballpark-settings-shell.component').then(m => m.BallparkSettingsShellComponent),
    // canActivate: [AdminGuard],
    children: [
      { path: '', redirectTo: 'categories', pathMatch: 'full' },
      {
        path: 'categories',
        loadComponent: () => import('./categories/categories.component').then(m => m.CategoriesComponent)
      },
      {
        path: 'marketplace',
        loadComponent: () => import('./marketplace/marketplace.component').then(m => m.MarketplaceComponent)
      }
    ]
  }
];
