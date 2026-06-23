import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { can } from './permissions';

/** Functional guard for admin-only surfaces (Settings → Team): requires the
 *  org.invite_member permission — practically agency/supplier admins.
 *  Non-admins bounce to /home (the root went public in pV2-02b). Runs after
 *  requiresOrgGuard on the same route. */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return can(auth.role(), 'org.invite_member') ? true : router.createUrlTree(['/home']);
};
