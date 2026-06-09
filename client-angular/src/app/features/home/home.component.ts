import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { PersonaService } from '../../core/services/persona.service';
import { MessageService } from '../../core/services/message.service';
import { ConfigService } from '../../core/services/config.service';
import { HomeLauncherComponent, LauncherTile } from '../../shared/components/home-launcher/home-launcher.component';

/**
 * Home — v1.68o. The default landing. Resolves a per-persona config
 * (title + subtitle + tiles) and hands it to the shared <app-home-launcher>
 * MASTER, which owns the centred hero + tile layout. The old data dashboard
 * lives on at /dashboard.
 *
 * Supplier first: agency / admin fall back to /dashboard until their launcher
 * configs are built on this same master.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, HomeLauncherComponent],
  template: `
    <app-home-launcher [title]="title" [subtitle]="subtitle" [tiles]="tiles">
    </app-home-launcher>
  `,
})
export class HomeComponent implements OnInit {
  title = '';
  subtitle = '';
  tiles: LauncherTile[] = [];
  /** Supplier Inbox tile badge — unread thread count. */
  inboxUnread = 0;

  constructor(
    private personaSvc: PersonaService,
    private messageService: MessageService,
    private configService: ConfigService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (this.personaSvc.isSupplier()) {
      this.buildSupplier();
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  private buildSupplier(): void {
    const org = this.personaSvc.active?.orgName;
    this.title = org ? `Welcome back, ${org}` : 'Welcome back';
    this.subtitle = 'What opportunities are we working on today?';

    // The "Projects" tile uses the configurable Events label (pluralised).
    const eventsLabel = ((this.configService.current as any)?.projectLabel || 'Event') + 's';

    this.tiles = [
      {
        icon: 'folder-open',
        title: eventsLabel,
        subtitle: 'Manage active opportunities, confirmed projects and ongoing work.',
        go: () => this.router.navigate(['/projects']),
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
