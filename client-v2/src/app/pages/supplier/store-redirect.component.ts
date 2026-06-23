import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

/** pV2-STORE — "My Shop" / `/store` resolves to the supplier's OWN storefront
 *  (`/suppliers/:id`). A supplier manages their shop on the same page buyers
 *  see, with owner affordances (Add/Edit product). Non-suppliers or orgless
 *  users bounce to /home. Replaces the old coming-soon stub. */
@Component({
  selector: 'app-store-redirect',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `<p class="bp-page-body bp-body-small text-secondary">Opening your store…</p>`,
})
export class StoreRedirectComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  constructor() {
    const u = this.auth.user();
    const target =
      u?.activeOrgType === 'supplier' && u.activeOrgId
        ? ['/suppliers', u.activeOrgId]
        : ['/home'];
    void this.router.navigate(target, { replaceUrl: true });
  }
}
