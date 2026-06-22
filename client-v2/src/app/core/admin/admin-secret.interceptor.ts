import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AdminSecretService } from './admin-secret.service';

/** pV2-EA-02 — attach the interim admin secret to every `/api/admin/*` request.
 *  The secret is only ever read from sessionStorage here and set as a header;
 *  it is never logged (RP-A1). Non-admin requests pass through untouched. */
export const adminSecretInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.includes('/api/admin/')) {
    const secret = inject(AdminSecretService).get();
    if (secret) {
      req = req.clone({ setHeaders: { 'x-bp-admin-secret': secret } });
    }
  }
  return next(req);
};
