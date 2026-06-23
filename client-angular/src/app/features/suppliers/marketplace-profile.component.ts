import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ConfigService } from '../../core/services/config.service';
import { HeroSettingsService } from '../../core/services/hero-settings.service';
import { HomeLauncherComponent, LauncherTile } from '../../shared/components/home-launcher/home-launcher.component';

/**
 * Marketplace Profile hub — v1.68o.
 *
 * Supplier sub-hub reached from the Home "Marketplace Profile" tile. Now
 * consumes the shared <app-home-launcher> MASTER (same centred hero + tiles as
 * Home), with a Back button whose left edge lines up with the first tile. The
 * route suppresses the shell hero; Title / Subtitle / Position come from the
 * per-page settings (defaults below) so they're editable without a release.
 */
@Component({
  selector: 'app-marketplace-profile',
  standalone: true,
  imports: [CommonModule, HomeLauncherComponent],
  template: `
    <app-home-launcher
      [title]="title"
      [subtitle]="subtitle"
      [tiles]="tiles"
      [back]="goBack"
      [align]="align">
    </app-home-launcher>
  `,
})
export class MarketplaceProfileComponent implements OnInit {
  title = 'Marketplace Profile';
  subtitle = 'Manage your Marketplace presence, products and company information.';
  align: 'left' | 'center' = 'center';

  private readonly pageKey = '/marketplace-profile';
  private readonly defaultTitle = 'Marketplace Profile';
  private readonly defaultSubtitle = 'Manage your Marketplace presence, products and company information.';

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

  constructor(
    private router: Router,
    private configService: ConfigService,
    private heroSettings: HeroSettingsService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.applyHeroSettings();
    this.configService.config$.subscribe(() => {
      this.applyHeroSettings();
      this.cdr.detectChanges();
    });
  }

  /** Resolve title / subtitle / alignment from the per-page settings. */
  private applyHeroSettings(): void {
    this.title = this.heroSettings.title(this.pageKey, this.defaultTitle);
    this.subtitle = this.heroSettings.subtitle(this.pageKey, this.defaultSubtitle);
    this.align = this.heroSettings.align(this.pageKey);
  }
}
