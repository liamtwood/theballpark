import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router } from '@angular/router';

import { PersonaService } from '../../core/services/persona.service';
import { MessageService } from '../../core/services/message.service';
import { ConfigService } from '../../core/services/config.service';
import { CreateProjectService } from '../../core/services/create-project.service';
import { HeroSettingsService } from '../../core/services/hero-settings.service';
import { HomeLauncherComponent, LauncherTile } from '../../shared/components/home-launcher/home-launcher.component';

/**
 * Home — v1.68w. The default landing. Resolves a per-persona config
 * (title + subtitle + tiles) and hands it to the shared <app-home-launcher>
 * MASTER, which owns the centred hero + tile layout. The old data dashboard
 * lives on at /dashboard.
 *
 * Two launchers on the one master: supplier (Events / Inbox / Marketplace
 * Profile) and agency/admin (Add / View / Inbox / Marketplace / Profile — the
 * same tiles the dashboard's agency launcher used). Title / Subtitle / Position
 * come from the per-page settings (per-profile), defaults below.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, HomeLauncherComponent],
  template: `
    <app-home-launcher [title]="title" [subtitle]="subtitle" [tiles]="tiles" [back]="back" [align]="align">
    </app-home-launcher>
  `,
})
export class HomeComponent implements OnInit {
  title = '';
  subtitle = '';
  align: 'left' | 'center' = 'center';
  tiles: LauncherTile[] = [];
  /** Supplier Inbox tile badge — unread thread count. */
  inboxUnread = 0;

  /** Per-page settings key (matches pagePatternKey for this route). */
  private readonly pageKey = '/home';
  /** Page defaults — used when no per-page override is set. */
  private defaultTitle = 'Welcome back';
  private defaultSubtitle = 'What opportunities are we working on today?';

  /** v1.68q — Home is the root, so Back uses browser history. */
  back = () => this.location.back();

  constructor(
    private personaSvc: PersonaService,
    private messageService: MessageService,
    private configService: ConfigService,
    private createProjectSvc: CreateProjectService,
    private heroSettings: HeroSettingsService,
    private location: Location,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (this.personaSvc.isSupplier()) {
      this.buildSupplier();
    } else {
      this.buildAgency();
    }
    // Re-resolve the hero whenever page settings change in the drawer, so
    // Title / Subtitle / Position edits apply live without a reload.
    this.configService.config$.subscribe(() => {
      this.applyHeroSettings();
      this.cdr.detectChanges();
    });
  }

  /** Resolve title / subtitle / alignment from the per-page settings, falling
      back to this page's defaults (set by the persona build below, so nothing
      changes until customised). */
  private applyHeroSettings(): void {
    this.title = this.heroSettings.title(this.pageKey, this.defaultTitle, {
      orgName: this.personaSvc.active?.orgName,
      userName: this.personaSvc.active?.name,
    });
    this.subtitle = this.heroSettings.subtitle(this.pageKey, this.defaultSubtitle);
    this.align = this.heroSettings.align(this.pageKey);
  }

  private buildSupplier(): void {
    const org = this.personaSvc.active?.orgName;
    this.defaultTitle = org ? `Welcome back, ${org}` : 'Welcome back';
    this.defaultSubtitle = 'What opportunities are we working on today?';
    this.applyHeroSettings();

    // The "Projects" tile uses the configurable Events label (pluralised).
    const eventsLabel = (this.configService.projectLabel || 'Event') + 's';

    this.tiles = [
      {
        icon: 'folder-open',
        title: eventsLabel,
        subtitle: 'Manage active opportunities, confirmed projects and ongoing work.',
        // v1.68t — lands on the Projects launch page (stage tiles), which drills
        // into the /projects list. Was /projects directly.
        go: () => this.router.navigate(['/projects-hub']),
      },
      {
        icon: 'inbox',
        title: 'Inbox',
        subtitle: 'View and respond to producer conversations.',
        badge: this.inboxUnread,
        go: () => this.router.navigate(['/inbox']),
      },
      {
        icon: 'store',
        title: 'Marketplace Profile',
        subtitle: 'Manage how your company appears in Ballpark Marketplace. Update categories, pricing, portfolio and company information.',
        go: () => this.router.navigate(['/marketplace-profile']),
      },
    ];

    this.loadInboxUnread();
  }

  /** Agency / admin launcher — the same five tiles the dashboard's agency
      launcher used (Add / View / Inbox / Marketplace / Profile), with their
      original icons + navigation. Add/View use the configurable Events label;
      Profile lands on /settings (no dedicated /profile route today). */
  private buildAgency(): void {
    const org = this.personaSvc.active?.orgName;
    this.defaultTitle = org ? `Welcome back, ${org}` : 'Welcome back';
    this.defaultSubtitle = 'What are we working on today?';
    this.applyHeroSettings();

    const label = this.configService.projectLabel || 'Event';
    const lower = label.toLowerCase();

    this.tiles = [
      {
        icon: 'folder-plus',
        title: `Add ${label}`,
        subtitle: `Start a new ${lower}`,
        go: () => this.createProjectSvc.open(),
      },
      {
        icon: 'folder-open',
        title: `View ${label}s`,
        subtitle: `Browse all your ${lower}s`,
        go: () => this.router.navigate(['/projects']),
      },
      {
        icon: 'inbox',
        title: 'Inbox',
        subtitle: 'Supplier replies and threads',
        go: () => this.router.navigate(['/inbox']),
      },
      {
        icon: 'store',
        title: 'Marketplace',
        subtitle: 'Browse items and suppliers',
        go: () => this.router.navigate(['/shop']),
      },
      {
        icon: 'circle-user',
        title: 'Profile',
        subtitle: 'Your account and settings',
        go: () => this.router.navigate(['/settings']),
      },
    ];
  }

  /** Supplier Inbox unread-thread count → the Inbox tile badge. Uses the shared
      MessageService.countUnreadThreads helper (same grouping as the inbox). */
  private loadInboxUnread(): void {
    const supId = this.personaSvc.active?.orgId;
    if (!supId) return;
    this.messageService.getAllBySupplier(supId).subscribe({
      next: (msgs: any[]) => {
        this.inboxUnread = MessageService.countUnreadThreads(msgs);
        const inboxTile = this.tiles.find(t => t.title === 'Inbox');
        if (inboxTile) inboxTile.badge = this.inboxUnread;
        this.cdr.detectChanges();
      },
      error: () => {},
    });
  }
}
