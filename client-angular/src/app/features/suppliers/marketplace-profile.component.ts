import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HomeLauncherComponent, LauncherTile } from '../../shared/components/home-launcher/home-launcher.component';

/**
 * Marketplace Profile hub — v1.68o.
 *
 * Supplier sub-hub reached from the Home "Marketplace Profile" tile. Now
 * consumes the shared <app-home-launcher> MASTER (same centred hero + tiles as
 * Home), with a Back button whose left edge lines up with the first tile. Hero
 * title/subtitle live in the component; the route suppresses the shell hero.
 */
@Component({
  selector: 'app-marketplace-profile',
  standalone: true,
  imports: [CommonModule, HomeLauncherComponent],
  template: `
    <app-home-launcher
      title="Marketplace Profile"
      subtitle="Manage your Marketplace presence, products and company information."
      [tiles]="tiles"
      [back]="goBack">
    </app-home-launcher>
  `,
})
export class MarketplaceProfileComponent {
  tiles: LauncherTile[] = [
    {
      icon: 'store',
      title: 'Marketplace',
      subtitle: 'Browse the Ballpark Marketplace, explore suppliers and discover opportunities.',
      go: () => this.router.navigate(['/shop']),
    },
    {
      icon: 'package',
      title: 'My Shop',
      subtitle: 'Manage how your company appears within Ballpark Marketplace. Update your storefront, branding and profile.',
      go: () => this.router.navigate(['/store']),
    },
    {
      icon: 'building-2',
      title: 'Profile',
      subtitle: 'Manage company information, payment details, team members and account settings.',
      go: () => this.router.navigate(['/storefront']),
    },
  ];

  /** Arrow function so `this` binds when passed as the launcher's [back] input. */
  goBack = () => this.router.navigate(['/home']);

  constructor(private router: Router) {}
}
