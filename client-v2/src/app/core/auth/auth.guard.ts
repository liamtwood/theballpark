import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Functional guard: signed-in users pass; everyone else → /login.
 *  Session is hydrated before routing (bootstrap initializer chain), so the
 *  signal is settled by the time this runs. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isLoggedIn() ? true : router.createUrlTree(['/login']);
};
