import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Functional guard for the authenticated shell (pV2-02b — supersedes the
 *  old authGuard, which only knew signed-in/out): signed-out → /login,
 *  signed-in-but-orgless → /onboarding, has-org → pass. Session is hydrated
 *  before routing (bootstrap initializer chain), so the signals are settled
 *  by the time this runs. */
export const requiresOrgGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) return router.createUrlTree(['/login']);
  if (!auth.hasActiveOrg()) return router.createUrlTree(['/onboarding']);
  return true;
};
