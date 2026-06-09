import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { PersonaService } from '../../core/services/persona.service';
import { ShellContextService } from '../../core/services/shell-context.service';
import { MessageService } from '../../core/services/message.service';
import { ActionTileComponent } from '../../shared/components/action-tile/action-tile.component';

/**
 * Home — v1.68h. The "website-feel" landing: a calm hero + a centred row of
 * action tiles, replacing the data-dashboard as the default landing. The old
 * dashboard (stats + Upcoming / Credits / Saved-suppliers panels) lives on at
 * /dashboard.
 *
 * THE MASTER. The launcher is driven entirely by a per-persona `HomeConfig`
 * (hero subtitle + tiles), so the agency and admin homes are just two more
 * config entries — same template, same centred-tile chrome, only the folders
 * shown + the title/subtitle change. The hero TITLE is the shell's configured
 * greeting ("Welcome back, {name}"); each persona supplies the subtitle.
 *
 * v1.68h ships the SUPPLIER config only. Agency / admin fall back to /dashboard
 * until their configs land (next pass on this same master).
 */
interface LauncherTile {
  icon: string;
  title: string;
  subtitle: string;
  /** Optional count chip (e.g. Inbox unread threads). */
  badge?: number;
  go: () => void;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, ActionTileComponent],
  template: `
    <div class="bp-page">
      <div class="bp-home-launcher" *ngIf="tiles.length">
        <app-action-tile *ngFor="let t of tiles"
          [icon]="t.icon"
          [title]="t.title"
          [subtitle]="t.subtitle"
          [badge]="t.badge"
          (action)="t.go()">
        </app-action-tile>
      </div>
    </div>
  `,
  styles: [`
    /* Centred launcher row — full width, capped, wraps gracefully. Same tile
       grid pattern as the Marketplace Profile hub so the two read as one
       family. */
    .bp-home-launcher {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 360px));
      justify-content: center;
      gap: 20px;
      max-width: 1180px;
      margin: 0 auto;
      padding: 48px 24px 64px;
    }
  `]
})
export class HomeComponent implements OnInit, OnDestroy {
  tiles: LauncherTile[] = [];
  /** Supplier Inbox tile badge — unread thread count. */
  inboxUnread = 0;

  constructor(
    private personaSvc: PersonaService,
    private shellCtx: ShellContextService,
    private messageService: MessageService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // v1.68h — supplier first. Agency / admin keep the data dashboard as their
    // landing until their launcher configs are built on this same master.
    if (this.personaSvc.isSupplier()) {
      this.buildSupplier();
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  ngOnDestroy(): void {
    this.shellCtx.reset();
  }

  private buildSupplier(): void {
    // Hero: shell-configured greeting ("Welcome back, {org}") + persona subtitle.
    this.shellCtx.set({
      useConfiguredTitle: true,
      heroSub: 'What opportunities are we working on today?',
      pills: [],
      tabs: [],
      showStats: false,
    } as any);

    this.tiles = [
      {
        icon: 'folder-open',
        title: 'Projects',
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
