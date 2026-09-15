import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PageConfigService } from '../../core/config/page-config.service';
import { HomeLauncherComponent } from '../../shared/launcher/home-launcher.component';
import { STOREFRONT_TILES } from '../../shared/launcher/launcher-tiles';

/** v2.13b — the supplier Storefront hub (v1.68o's "Marketplace Profile",
 *  renamed per DESIGN.md §14: storefront = the public-face hub). v2.462: an
 *  eyebrow header matching the overview ("Supplier workspace"), and two tiles —
 *  My Shop (items) + My Shopfront (brand) — Marketplace lives in the nav. */
@Component({
  selector: 'app-storefront',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HomeLauncherComponent],
  host: { class: 'block' },
  template: `
    <app-home-launcher
      [eyebrow]="eyebrow()"
      title="Storefront"
      subtitle="Manage your Marketplace presence, products and company information."
      [tiles]="tiles"
    />
  `,
})
export class StorefrontComponent {
  private readonly config = inject(PageConfigService);
  /** Same eyebrow the overview shows (default "SUPPLIER WORKSPACE"). */
  protected readonly eyebrow = this.config.heroEyebrow;
  protected readonly tiles = STOREFRONT_TILES;
}
