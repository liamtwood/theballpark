import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Location } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { LauncherTileComponent } from './launcher-tile.component';
import { LauncherTile } from './launcher-tile.types';

/** pV2-04b — the launcher MASTER (v1's <app-home-launcher>, v1.68o, rebuilt):
 *  owns the centred chrome — Back link, display-face title, subtitle, tile
 *  grid — the whole stack top-anchored below the shell header. No
 *  <app-page-hero> band; this component IS the page chrome. Per surface only
 *  the inputs change (pV2-05's supplier home reuses it).
 *  pV2-04b1-qc: v1 proportions — 3-across tile grid wrapping 3+2, Back
 *  rendered even at root (v1 behaviour, browser history). */
@Component({
  selector: 'app-home-launcher',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, LauncherTileComponent],
  host: {
    class: 'bp-home-launcher',
    '[class.bp-home-launcher--left]': "align() === 'left'",
  },
  template: `
    <div class="bp-home-launcher__stack">
      <!-- Back row — left edge aligns with the first tile's left edge (the
           row spans the grid width), matching v1's launcher chrome. -->
      <div class="bp-home-launcher__backrow">
        <button type="button" class="bp-home-launcher__back" (click)="onBack()">
          <lucide-icon name="arrow-left" [size]="16" />
          <span>Back</span>
        </button>
      </div>

      <div class="bp-home-launcher__chrome">
        <h1 class="bp-home-launcher__title">{{ title() }}</h1>
        @if (subtitle()) {
          <p class="bp-home-launcher__subtitle">{{ subtitle() }}</p>
        }
      </div>

      <div class="bp-home-launcher__grid">
        @for (tile of tiles(); track tile.href + tile.label) {
          <app-launcher-tile
            [icon]="tile.icon"
            [label]="tile.label"
            [subtitle]="tile.subtitle ?? ''"
            [href]="tile.href"
            [primary]="tile.primary ?? false"
          />
        }
      </div>
    </div>
  `,
  styles: [
    `
      /* Top-anchored, not vertical-centred (the v1.68o lesson: centring makes
         the title's Y depend on tile wrap count; a vh-based offset is stable). */
      :host {
        display: flex;
        justify-content: center;
        padding: clamp(24px, 8vh, 80px) 24px 48px;
      }
      /* Stack width = the 3-tile row (3×340 + 2×24 gap) so Back's left edge
         lines up with the first tile (v1 parity). */
      .bp-home-launcher__stack {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        max-width: 1068px;
      }
      .bp-home-launcher__backrow {
        width: 100%;
        margin-bottom: 48px;
        display: flex;
        align-items: flex-start;
      }
      .bp-home-launcher__back {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        font-family: var(--font-body);
        font-size: 15px;
        color: var(--color-text-secondary);
        transition: color 0.15s;
      }
      .bp-home-launcher__back:hover {
        color: var(--theme-accent);
      }
      .bp-home-launcher__chrome {
        text-align: center;
        max-width: 720px;
        margin-bottom: 48px;
      }
      .bp-home-launcher__title {
        font-family: var(--font-display);
        font-size: 44px;
        font-weight: 400;
        line-height: 1.1;
        letter-spacing: -0.01em;
        color: var(--color-text);
        margin: 0 0 10px;
      }
      .bp-home-launcher__subtitle {
        font-family: var(--font-body);
        font-size: 17px;
        color: var(--color-text-secondary);
        margin: 0;
      }
      /* 3-across, wrapping 3+2 left-aligned into the grid (v1 behaviour). */
      .bp-home-launcher__grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(280px, 340px));
        justify-content: center;
        gap: 24px;
        width: 100%;
      }

      :host(.bp-home-launcher--left) .bp-home-launcher__stack {
        align-items: flex-start;
      }
      :host(.bp-home-launcher--left) .bp-home-launcher__chrome {
        text-align: left;
      }
      :host(.bp-home-launcher--left) .bp-home-launcher__grid {
        justify-content: start;
      }

      @media (max-width: 1024px) {
        .bp-home-launcher__grid {
          grid-template-columns: repeat(2, minmax(260px, 340px));
        }
      }
      @media (max-width: 640px) {
        .bp-home-launcher__title {
          font-size: 32px;
        }
        .bp-home-launcher__backrow {
          margin-bottom: 32px;
        }
        .bp-home-launcher__grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class HomeLauncherComponent {
  private readonly location = inject(Location);

  readonly title = input<string>('');
  readonly subtitle = input<string>('');
  readonly align = input<'left' | 'center'>('center');
  readonly tiles = input.required<LauncherTile[]>();

  /** v1 parity: Back uses browser history, rendered even at root. */
  protected onBack(): void {
    this.location.back();
  }
}
