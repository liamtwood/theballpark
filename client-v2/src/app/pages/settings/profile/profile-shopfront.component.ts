import { ChangeDetectionStrategy, Component, inject, input, resource } from '@angular/core';
import { Router } from '@angular/router';
import { CatalogueService } from '../../../core/marketplace/catalogue.service';
import { SupplierSubcategory } from '../../../shared/catalogue/catalogue.types';
import { StorefrontPanelComponent } from '../../suppliers/storefront-panel.component';

/** pV2-STORE-01 — the Profile "Shopfront" tab body: the supplier's own
 *  consumer-facing storefront (the same panel the marketplace renders).
 *  Extracted from profile.component.ts (STORE-01 audit bloat). The parent owns
 *  the tab band; this renders only when the Shopfront tab is active for the
 *  owning supplier (`orgId` is the active org). */
@Component({
  selector: 'app-profile-shopfront',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  imports: [StorefrontPanelComponent],
  template: `
    <div class="bp-page-body">
      @if (shopfront.isLoading()) {
        <p class="bp-body-small text-secondary">Loading…</p>
      } @else if (shopfront.value(); as sup) {
        <div class="bp-settings-body">
          <app-storefront-panel
            [supplier]="sup"
            [subcategories]="shopfrontSubcats.value() ?? []"
            (subcategorySelected)="openStoreSubcat($event)"
          />
        </div>
      } @else {
        <p class="bp-body-small text-warn">Couldn't load your shopfront.</p>
      }
    </div>
  `,
})
export class ProfileShopfrontComponent {
  private readonly catalogue = inject(CatalogueService);
  private readonly router = inject(Router);

  /** The owner's active org id (the storefront to render). */
  readonly orgId = input.required<string>();

  protected readonly shopfront = resource({
    params: () => this.orgId(),
    loader: ({ params }) => this.catalogue.supplierDetail(params),
  });
  protected readonly shopfrontSubcats = resource({
    params: () => this.orgId(),
    loader: ({ params }) => this.catalogue.supplierSubcategories(params),
  });

  /** Subcat card → open that category in the owner's item store. */
  protected openStoreSubcat(sub: SupplierSubcategory): void {
    this.router
      .navigate(['/suppliers', this.orgId()], {
        queryParams: { tab: 'store', cat: sub.parentId, sub: sub.isCatchAll ? null : sub.id },
      })
      .catch((err) => console.warn('[Profile] navigation failed', err));
  }
}
