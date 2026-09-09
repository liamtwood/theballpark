import { ChangeDetectionStrategy, Component, input } from '@angular/core';
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
  imports: [LauncherTileComponent],
  host: {
    class: 'bp-home-launcher',
    '[class.bp-home-launcher--left]': "align() === 'left'",
  },
  template: `
    <div class="bp-home-launcher__stack">
      <!-- No Back row — these launcher surfaces (home / supplier hub / storefront)
           are roots, so there's nowhere to go back to. -->
      <div class="bp-home-launcher__chrome">
        @if (eyebrow()) {
          <p class="bp-home-launcher__eyebrow">{{ eyebrow() }}</p>
        }
        <h1 class="bp-home-title bp-home-launcher__title">{{ title() }}</h1>
        @if (subtitle()) {
          <p class="bp-home-subtitle bp-home-launcher__subtitle">{{ subtitle() }}</p>
        }
      </div>

      <div class="bp-home-launcher__grid">
        @for (tile of tiles(); track tile.href + tile.label) {
          <app-launcher-tile
            [icon]="tile.icon"
            [label]="tile.label"
            [subtitle]="tile.subtitle ?? ''"
            [href]="tile.href"
            [query]="tile.query ?? null"
          />
        }
        <!-- Optional extra grid child (e.g. the agent Next-steps card) — takes
             one tile column, flows directly after the tiles. -->
        <ng-content select="[gridExtra]" />
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
      .bp-home-launcher__chrome {
        text-align: center;
        max-width: 720px;
        margin-bottom: 48px;
      }
      /* Eyebrow above the greeting — matches the project-hero eyebrow
         (small, tracked, uppercase, secondary). */
      .bp-home-launcher__eyebrow {
        margin: 0 0 6px;
        font-size: var(--text-lg);
        font-weight: 400;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-text-secondary);
      }
      /* Type comes from .bp-home-title / .bp-home-subtitle (pV2-TYPE-01);
         these structural classes keep only spacing. */
      .bp-home-launcher__title {
        margin: 0 0 10px;
      }
      .bp-home-launcher__subtitle {
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
      /* Title size is responsive in the --text-greeting clamp() token —
         no per-breakpoint font override needed. */
      @media (max-width: 640px) {
        .bp-home-launcher__grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class HomeLauncherComponent {
  readonly title = input<string>('');
  readonly subtitle = input<string>('');
  /** Optional eyebrow above the title (e.g. "AGENCY WORKSPACE"). */
  readonly eyebrow = input<string>('');
  readonly align = input<'left' | 'center'>('left');
  readonly tiles = input.required<readonly LauncherTile[]>();
}
