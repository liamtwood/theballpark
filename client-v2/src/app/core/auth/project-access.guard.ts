import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** `/projects/:id` is the AGENCY project workspace. A supplier's surface for a
 *  project is the conversation at `/inbox/:id`, so redirect suppliers there
 *  (they reach projects only as quote requests). Non-suppliers pass through. */
export const projectDetailAccessGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.user()?.activeOrgType !== 'supplier') return true;
  const id = route.paramMap.get('id');
  return router.createUrlTree(id ? ['/inbox', id] : ['/home']);
};

/** Agency-only surfaces (e.g. the New project brief flow). A supplier can't
 *  author a brief, so bounce them home. Non-suppliers pass through. */
export const agencyOnlyGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.user()?.activeOrgType === 'supplier' ? router.createUrlTree(['/home']) : true;
};
