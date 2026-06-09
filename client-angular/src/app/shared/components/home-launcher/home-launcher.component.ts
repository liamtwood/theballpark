import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { ActionTileComponent } from '../action-tile/action-tile.component';

export interface LauncherTile {
  icon: string;
  title: string;
  subtitle: string;
  /** Optional count chip (e.g. Inbox unread threads). */
  badge?: number;
  go: () => void;
}

/**
 * <app-home-launcher> — v1.68o. The shared "website-feel" launcher MASTER,
 * extracted from the supplier Home so every launcher surface (Home,
 * Marketplace Profile hub, future agency/admin homes) renders one consistent
 * thing: a hero (title + subtitle) above a centred row of action tiles, the
 * whole stack centred vertically + horizontally below the header.
 *
 * Per surface, only the inputs change — the folders shown + the title/subtitle
 * (+ an optional Back). The Back button's left edge lines up with the LEFT
 * edge of the first tile (the tiles fill the stack's max-width, and Back is
 * `align-self: flex-start` within that same width).
 */
@Component({
  selector: 'app-home-launcher',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, ActionTileComponent],
  template: `
    <div class="bp-launcher-page">
      <div class="bp-launcher-stack" *ngIf="tiles.length">

        <!-- Title + subtitle -->
        <div class="bp-launcher-hero">
          <h1 class="bp-launcher-title">{{ title }}</h1>
          <p class="bp-launcher-sub" *ngIf="subtitle">{{ subtitle }}</p>
        </div>

        <!-- Back (optional) + tiles. The wrap fills the stack width so Back's
             left edge aligns with the first tile's left edge. -->
        <div class="bp-launcher-tiles-wrap">
          <button *ngIf="back" type="button" class="bp-launcher-back" (click)="back()">
            <lucide-icon name="arrow-left" [size]="16"></lucide-icon> {{ backLabel }}
          </button>
          <div class="bp-launcher-tiles">
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
    </div>
  `,
  styles: [`
    .bp-launcher-page {
      min-height: calc(100vh - var(--nav-height));
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px 24px;
      box-sizing: border-box;
    }
    /* max-width == 3 tiles (3×360 + 2×20 gap) so the tiles fill the stack
       edge-to-edge — that's what lets Back align to the first tile's left. */
    .bp-launcher-stack {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 40px;
      width: 100%;
      max-width: 1120px;
    }

    .bp-launcher-hero { text-align: center; }
    .bp-launcher-title {
      margin: 0 0 12px;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 60px; font-weight: 400; line-height: 1.1;
      letter-spacing: -0.01em;
      color: var(--color-text-primary);
    }
    .bp-launcher-sub {
      margin: 0;
      font-family: var(--font-body);
      font-size: 20px; font-weight: 400;
      color: var(--color-text-secondary);
    }

    .bp-launcher-tiles-wrap {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    /* Back — left edge aligned to the tile row's left edge. */
    .bp-launcher-back {
      align-self: flex-start;
      display: inline-flex; align-items: center; gap: 6px;
      background: none; border: none; padding: 0;
      cursor: pointer;
      font-family: var(--font-body);
      font-size: 15px; color: var(--color-text-secondary);
      transition: color 0.15s;
    }
    .bp-launcher-back:hover { color: var(--theme-accent); }
    .bp-launcher-back lucide-icon { display: inline-flex; }

    .bp-launcher-tiles {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 360px));
      justify-content: center;
      gap: 20px;
      width: 100%;
    }

    @media (max-width: 640px) {
      .bp-launcher-title { font-size: 40px; }
      .bp-launcher-sub   { font-size: 18px; }
      .bp-launcher-stack { gap: 32px; }
    }
  `]
})
export class HomeLauncherComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() tiles: LauncherTile[] = [];
  /** Optional Back action; when set, renders a Back button aligned to the
      first tile's left edge. */
  @Input() back?: () => void;
  @Input() backLabel = 'Back';
}
