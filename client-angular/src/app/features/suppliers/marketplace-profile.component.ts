import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ActionTileComponent } from '../../shared/components/action-tile/action-tile.component';

/**
 * Marketplace Profile hub — v1.67d.
 *
 * Supplier sub-hub reached from the supplier home's "Marketplace Profile"
 * launcher tile. Mounts the SAME canonical <app-action-tile> grid as the
 * agent / supplier home (no hand-rolled tile chrome) and routes out to the
 * three marketplace surfaces. Hero title/subtitle + the ← Back link are
 * supplied by the route data (see app.routes.ts) and rendered by the shell,
 * exactly like the /projects and /inbox landing pages.
 */
@Component({
  selector: 'app-marketplace-profile',
  standalone: true,
  imports: [CommonModule, ActionTileComponent],
  template: `
    <div class="bp-page">
      <div class="bp-mp-grid">
        <app-action-tile
          icon="store"
          title="Marketplace"
          subtitle="Browse the Ballpark Marketplace, explore suppliers and discover opportunities."
          (action)="go('/shop')">
        </app-action-tile>

        <app-action-tile
          icon="package"
          title="My Shop"
          subtitle="Manage how your company appears within Ballpark Marketplace. Update your storefront, branding and profile."
          (action)="go('/shopfront')">
        </app-action-tile>

        <app-action-tile
          icon="building-2"
          title="Profile"
          subtitle="Manage company information, payment details, team members and account settings."
          (action)="go('/settings')">
        </app-action-tile>
      </div>
    </div>
  `,
  styles: [`
    /* Same launcher-grid sizing as the home pages: auto-fit minmax(280,350)
       capped (not 1fr) so tiles keep their roomy footprint, centred, and
       wrap onto new rows as the viewport narrows. */
    .bp-mp-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 350px));
      justify-content: center;
      gap: 16px;
      padding: 24px 20px 40px;
    }
  `]
})
export class MarketplaceProfileComponent {
  constructor(private router: Router) {}
  go(path: string) { this.router.navigate([path]); }
}
