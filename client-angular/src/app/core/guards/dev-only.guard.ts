import { CanActivateFn } from '@angular/router';
import { environment } from '../../../environments/environment';

export const devOnlyGuard: CanActivateFn = () => {
  return !environment.production;
};
