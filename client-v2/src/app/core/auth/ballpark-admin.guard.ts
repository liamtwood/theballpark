import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { can } from './permissions';

/** Functional guard for PLATFORM-admin surfaces (/settings/pages): requires
 *  admin.cross_org_view — ballpark admins only. Org admins and members bounce
 *  to /home. Page settings write org_type-WIDE config (every agency / every
 *  supplier), which is why org-level admin is not enough (Liam, 2026-06-11 —
 *  restores v1's requirePlatformAdmin model). */
export const ballparkAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return can(auth.role(), 'admin.cross_org_view') ? true : router.createUrlTree(['/home']);
};
