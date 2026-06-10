import { Routes } from '@angular/router';
import { AppShellComponent } from './shell/app-shell.component';

export const routes: Routes = [
  {
    path: '',
    component: AppShellComponent, // header + outlet — every feature route gets the shell
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/hello/hello.component').then((m) => m.HelloComponent),
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
