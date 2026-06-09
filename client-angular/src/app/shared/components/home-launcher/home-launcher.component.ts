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
  /** Optional footer line below a divider (e.g. "3 projects"). */
  meta?: string;
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

        <!-- Back row — only rendered when there's a Back. Its left edge aligns
             to the first tile's left edge (the row spans the tile-row width). -->
        <div class="bp-launcher-backrow" *ngIf="back">
          <button type="button" class="bp-launcher-back" (click)="back()">
            <lucide-icon name="arrow-left" [size]="16"></lucide-icon> {{ backLabel }}
          </button>
        </div>

        <!-- Title + subtitle -->
        <div class="bp-launcher-hero">
          <h1 class="bp-launcher-title">{{ title }}</h1>
          <p class="bp-launcher-sub" *ngIf="subtitle">{{ subtitle }}</p>
        </div>

        <!-- Tiles -->
        <div class="bp-launcher-tiles">
          <app-action-tile *ngFor="let t of tiles"
            [icon]="t.icon"
            [title]="t.title"
            [subtitle]="t.subtitle"
            [badge]="t.badge"
            [meta]="t.meta"
            (action)="t.go()">
          </app-action-tile>
        </div>

      </div>
    </div>
  `,
  styles: [`
    /* TOP-ANCHORED, not vertical-centred. Vertical-centring made the Back/title
       Y depend on the stack's total height, so pages whose tallest tile wraps to
       a different line count (Home vs the hub) put Back ~11px apart. A vh-based
       top offset is the SAME for both pages at a given viewport, so Back + title
       land at an identical Y regardless of tile content. clamp keeps it low
       enough to still feel balanced while staying deterministic. */
    .bp-launcher-page {
      min-height: calc(100vh - var(--nav-height));
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: clamp(56px, 14vh, 140px) 24px 48px;
      box-sizing: border-box;
    }
    /* max-width == 3 tiles (3×360 + 2×20 gap) so the tiles fill the stack
       edge-to-edge — that's what lets Back align to the first tile's left. */
    .bp-launcher-stack {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
      max-width: 1120px;
    }

    /* Back row — full tile-row width, only present when there's a Back.
       ~5 lines above the title; Back sits at the row's left edge. */
    .bp-launcher-backrow {
      width: 100%;
      margin-bottom: 84px;
      display: flex;
      align-items: flex-start;
    }
    .bp-launcher-back {
      display: inline-flex; align-items: center; gap: 6px;
      background: none; border: none; padding: 0;
      cursor: pointer;
      font-family: var(--font-body);
      font-size: 15px; color: var(--color-text-secondary);
      transition: color 0.15s;
    }
    .bp-launcher-back:hover { color: var(--theme-accent); }
    .bp-launcher-back lucide-icon { display: inline-flex; }

    .bp-launcher-hero { text-align: center; margin-bottom: 48px; }
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

    .bp-launcher-tiles {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 360px));
      justify-content: center;
      gap: 20px;
      width: 100%;
    }

    @media (max-width: 640px) {
      .bp-launcher-title   { font-size: 40px; }
      .bp-launcher-sub     { font-size: 18px; }
      .bp-launcher-backrow { margin-bottom: 48px; }
      .bp-launcher-hero    { margin-bottom: 32px; }
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
