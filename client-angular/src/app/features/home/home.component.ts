import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { PersonaService } from '../../core/services/persona.service';
import { MessageService } from '../../core/services/message.service';
import { ActionTileComponent } from '../../shared/components/action-tile/action-tile.component';

/**
 * Home — v1.68i. The "website-feel" landing: the page body holds a single
 * centred stack (vertically + horizontally) of TWO blocks — the title/subtitle,
 * then the folder/action tiles. The shell hero band is suppressed for /home
 * (route data `hideHero: true`); the title/subtitle live here instead so the
 * whole thing centres in the viewport below the header. The old data dashboard
 * lives on at /dashboard.
 *
 * THE MASTER. Driven by a per-persona config (title + subtitle + tiles) so the
 * agency and admin homes are just two more config entries — same centred-stack
 * template, only the folders shown + the title/subtitle change.
 *
 * v1.68i ships the SUPPLIER config only. Agency / admin fall back to /dashboard
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
    <div class="bp-home-page">
      <div class="bp-home-stack" *ngIf="tiles.length">

        <!-- Container 1 — title + subtitle -->
        <div class="bp-home-hero">
          <h1 class="bp-home-title">{{ title }}</h1>
          <p class="bp-home-sub" *ngIf="subtitle">{{ subtitle }}</p>
        </div>

        <!-- Container 2 — folders / action tiles -->
        <div class="bp-home-launcher">
          <app-action-tile *ngFor="let t of tiles"
            [icon]="t.icon"
            [title]="t.title"
            [subtitle]="t.subtitle"
            [badge]="t.badge"
            (action)="t.go()">
          </app-action-tile>
        </div>

      </div>
    </div>
  `,
  styles: [`
    /* Fill the viewport below the header and centre the stack both axes. */
    .bp-home-page {
      min-height: calc(100vh - var(--nav-height));
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px 24px;
      box-sizing: border-box;
    }
    .bp-home-stack {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 48px;
      width: 100%;
      max-width: 1180px;
    }

    /* Container 1 — title + subtitle */
    .bp-home-hero { text-align: center; }
    /* v1.68j — match the mockup's "Welcome back" exactly: text-6xl (60px),
       weight 400, and the system-UI sans stack (Tailwind font-sans default),
       NOT the app's Playfair display font. Scoped to the home launcher. */
    .bp-home-title {
      margin: 0 0 12px;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 60px; font-weight: 400; line-height: 1.1;
      letter-spacing: -0.01em;
      color: var(--color-text-primary);
    }
    .bp-home-sub {
      margin: 0;
      font-family: var(--font-body);
      font-size: 18px; font-weight: 400;
      color: var(--color-text-secondary);
    }

    /* Container 2 — centred launcher row, wraps gracefully. Same tile grid as
       the Marketplace Profile hub. */
    .bp-home-launcher {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 360px));
      justify-content: center;
      gap: 20px;
      width: 100%;
    }

    @media (max-width: 640px) {
      .bp-home-title { font-size: 40px; }
      .bp-home-sub   { font-size: 16px; }
      .bp-home-stack { gap: 32px; }
    }
  `]
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

  private buildSupplier(): void {
    const org = this.personaSvc.active?.orgName;
    this.title = org ? `Welcome back, ${org}` : 'Welcome back';
    this.subtitle = 'What opportunities are we working on today?';

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
