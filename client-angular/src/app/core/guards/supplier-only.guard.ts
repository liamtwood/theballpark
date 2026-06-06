import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PersonaService } from '../services/persona.service';

/**
 * Gates the supplier management surfaces (/shopfront, /store). Only a supplier
 * persona has a shop to manage; an agency or admin landing here is bounced to
 * /home (forgiving — "you're not a supplier, here's your home") rather than a
 * 404. The component still re-checks ownership as a backstop.
 */
export const supplierOnlyGuard: CanActivateFn = () => {
  const persona = inject(PersonaService);
  const router = inject(Router);
  if (persona.active?.kind === 'supplier') return true;
  return router.createUrlTree(['/home']);
};
