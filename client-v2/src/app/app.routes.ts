import { Routes } from '@angular/router';
import { AppShellComponent } from './shell/app-shell.component';
import { authGuard } from './core/auth/auth.guard';
import { adminGuard } from './core/auth/admin.guard';

export const routes: Routes = [
  {
    path: '',
    component: AppShellComponent, // header + outlet — every feature route gets the shell
    canActivate: [authGuard], // signed-out → /login (login + callback live outside)
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/hello/hello.component').then((m) => m.HelloComponent),
      },
      {
        // Settings → Team (pV2-03). Admin-only on top of the shell's authGuard.
        path: 'settings/team',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/settings/team/team.component').then((m) => m.TeamComponent),
      },
      {
        // Dev-only style sandbox — visual QC for shared chrome components.
        path: 'style/hero',
        loadComponent: () =>
          import('./pages/style/hero/hero-demo.component').then((m) => m.HeroDemoComponent),
      },
      // future feature routes go here, all get the shell
    ],
  },
  // Pure-bleed routes outside the shell (no header):
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'auth/callback',
    loadComponent: () =>
      import('./pages/auth-callback/auth-callback.component').then((m) => m.AuthCallbackComponent),
  },
  { path: '**', redirectTo: '' },
];
