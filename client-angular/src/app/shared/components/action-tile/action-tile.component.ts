// v1.65hP (p0019 §1) — Shared <app-action-tile> standalone component.
//
// Extracted from the agent page's bp-agent-card (per WORKING_STANDARDS
// "Extract Before Duplicate" — the home launcher grid is about to use
// the same card shape, so it's lifted to a shared component BEFORE the
// duplicate ships). The agent-page chrome (20px radius, --shadow-md
// drop, 40px icon square) is the canonical action-tile shape.
//
// The tile is presentational only — it emits (action) and the parent
// wires what that does (open a modal, router.navigate, …). Routing is
// never baked into the tile.

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-action-tile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Bare LucideAngularModule (no .pick()) is intentional here: the tile
  // renders whatever icon NAME the consumer passes at runtime, so it
  // cannot pre-pick a fixed set. Names resolve from the global
  // LUCIDE_ICONS provider (app.config.ts → ICON_REGISTRY); the consumer
  // page is responsible for ensuring the name it passes is registered.
  imports: [CommonModule, LucideAngularModule],
  template: `
    <button type="button"
            class="bp-action-tile"
            (click)="action.emit()"
            [attr.aria-label]="ariaLabel || title">
      <div class="bp-action-tile-icon">
        <lucide-icon [name]="icon" [size]="20"></lucide-icon>
      </div>
      <div class="bp-action-tile-body">
        <h3 class="bp-action-tile-title">{{ title }}</h3>
        <p class="bp-action-tile-sub" *ngIf="subtitle">{{ subtitle }}</p>
      </div>
    </button>
  `,
  styles: [`
    /* Canonical action-tile chrome (lifted verbatim from the agent
       page's bp-agent-card):
        · --color-surface fill + var(--border-hairline) + 20px radius
        · --shadow-md drop (the intentional agent-page deviation from
          the two-tier --shadow-xs rule — now the action-tile standard)
        · button so it's keyboard-focusable + fires on Enter/Space
        · icon stacked ABOVE the body (flex column, align flex-start) */
    .bp-action-tile {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 14px;
      padding: 26px;
      min-height: 200px;
      width: 100%;
      text-align: left;
      font: inherit;
      cursor: pointer;
      background: var(--color-surface);
      border: var(--border-hairline);
      border-radius: 20px;
      box-shadow: var(--shadow-md);
      transition: box-shadow 0.18s, transform 0.18s;
    }
    .bp-action-tile:hover {
      box-shadow: var(--shadow-lg);
      transform: translateY(-1px);
    }
    .bp-action-tile:active {
      transform: translateY(0);
    }
    .bp-action-tile:focus-visible {
      outline: 2px solid var(--theme-accent);
      outline-offset: 2px;
    }

    /* 40px icon square — themed-soft bg, themed-accent glyph, 14px
       corners to echo the card's 20px silhouette. */
    .bp-action-tile-icon {
      flex-shrink: 0;
      width: 40px; height: 40px;
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 14px;
      background: var(--theme-soft);
      color: var(--theme-accent);
    }

    .bp-action-tile-body {
      min-width: 0;
      flex: 1;
    }
    .bp-action-tile-title {
      margin: 0 0 4px 0;
      font-family: var(--font-display);   /* Playfair Display */
      font-size: 18px;
      font-weight: 400;
      color: var(--color-text-primary);
      line-height: 1.2;
    }
    .bp-action-tile-sub {
      margin: 0;
      font-family: var(--font-body);      /* Libre Franklin */
      font-size: 13px;
      color: var(--color-text-secondary);
      line-height: 1.4;
    }
  `],
})
export class ActionTileComponent {
  /** Lucide icon name, e.g. 'folder-plus'. Must be registered in
      ICON_REGISTRY (core/icons.ts) by the time a consumer passes it. */
  @Input() icon!: string;
  /** Primary card label. */
  @Input() title!: string;
  /** Optional muted subline. */
  @Input() subtitle?: string;
  /** Optional aria-label override (defaults to title). */
  @Input() ariaLabel?: string;

  /** Fired on click / Enter / Space. Parent wires the behaviour. */
  @Output() action = new EventEmitter<void>();
}
