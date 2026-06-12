import { ChangeDetectionStrategy, Component } from '@angular/core';
import { HomeLauncherComponent } from '../../shared/launcher/home-launcher.component';
import { MARKETPLACE_PROFILE_TILES } from '../../shared/launcher/agent-tiles';

/** v2.13a — the supplier Marketplace Profile hub (v1.68o port): the
 *  launcher master with the storefront trio. Profile lands on the REAL
 *  /settings/profile; Marketplace + My Shop stub until their arcs. */
@Component({
  selector: 'app-marketplace-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HomeLauncherComponent],
  host: { class: 'block' },
  template: `
    <app-home-launcher
      title="Marketplace Profile"
      subtitle="Manage your Marketplace presence, products and company information."
      [tiles]="tiles"
    />
  `,
})
export class MarketplaceProfileComponent {
  protected readonly tiles = MARKETPLACE_PROFILE_TILES;
}
