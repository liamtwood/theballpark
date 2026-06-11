import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LauncherTileComponent } from './launcher-tile.component';
import { LauncherTile } from './launcher-tile.types';

/** pV2-04b — the launcher MASTER (v1's <app-home-launcher>, v1.68o, rebuilt):
 *  owns the centred chrome — display-face title, subtitle, tile grid — the
 *  whole stack top-anchored below the shell header. No <app-page-hero> band;
 *  this component IS the page chrome (v1's hideHero: true equivalent).
 *  Per surface only the inputs change (pV2-05's supplier home reuses it). */
@Component({
  selector: 'app-home-launcher',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LauncherTileComponent],
  host: {
    class: 'bp-home-launcher',
    '[class.bp-home-launcher--left]': "align() === 'left'",
  },
  template: `
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
          [href]="tile.href"
          [primary]="tile.primary ?? false"
        />
      }
    </div>
  `,
  styles: [
    `
      /* Top-anchored, not vertical-centred (the v1.68o lesson: centring makes
         the title's Y depend on tile wrap count; a vh-based offset is stable). */
      :host {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 48px;
        padding: clamp(40px, 12vh, 120px) 24px 48px;
      }
      .bp-home-launcher__chrome {
        text-align: center;
        max-width: 720px;
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
      .bp-home-launcher__grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 180px));
        justify-content: center;
        gap: 16px;
        width: 100%;
        max-width: 1000px;
      }

      :host(.bp-home-launcher--left) {
        align-items: flex-start;
      }
      :host(.bp-home-launcher--left) .bp-home-launcher__chrome {
        text-align: left;
      }
      :host(.bp-home-launcher--left) .bp-home-launcher__grid {
        justify-content: start;
      }

      @media (max-width: 768px) {
        .bp-home-launcher__title {
          font-size: 32px;
        }
        .bp-home-launcher__grid {
          grid-template-columns: repeat(2, minmax(140px, 1fr));
        }
      }
    `,
  ],
})
export class HomeLauncherComponent {
  readonly title = input<string>('');
  readonly subtitle = input<string>('');
  readonly align = input<'left' | 'center'>('center');
  readonly tiles = input.required<LauncherTile[]>();
}
