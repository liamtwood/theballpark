import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Guard for /onboarding: only signed-in users WITHOUT an active org belong
 *  there. Users with an org bounce to /home; signed-out users also bounce to
 *  /home, where requiresOrgGuard sends them on to /login (two hops, correct). */
export const needsOnboardingGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isLoggedIn() && !auth.hasActiveOrg()) return true;
  return router.createUrlTree(['/home']);
};
