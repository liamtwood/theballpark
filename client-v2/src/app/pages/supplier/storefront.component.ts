import { ChangeDetectionStrategy, Component } from '@angular/core';
import { HomeLauncherComponent } from '../../shared/launcher/home-launcher.component';
import { STOREFRONT_TILES } from '../../shared/launcher/launcher-tiles';

/** v2.13b — the supplier Storefront hub (v1.68o's "Marketplace Profile",
 *  renamed per DESIGN.md §14: storefront = the public-face hub; the old
 *  label read as one thing when it's a hub of three). Launcher master with
 *  the storefront trio: Profile lands on the REAL /settings/profile;
 *  Marketplace + My Shop (/store) stub until their arcs. */
@Component({
  selector: 'app-storefront',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HomeLauncherComponent],
  host: { class: 'block' },
  template: `
    <app-home-launcher
      title="Storefront"
      subtitle="Manage your Marketplace presence, products and company information."
      [tiles]="tiles"
    />
  `,
})
export class StorefrontComponent {
  protected readonly tiles = STOREFRONT_TILES;
}
