import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';

/** pV2-04b — launcher tile (the v2 rebuild of v1's action-tile, p0019): a
 *  white routerLink card with a SOFT-pastel icon block (--theme-soft wash,
 *  --theme-accent icon stroke) above title + subtitle. Per the Figma
 *  correction in pV2-04b2-qc: all five tiles are uniform — the vivid
 *  --bp-gradient never appears on this surface (it's brand-mark territory:
 *  avatar fill, future brand CTAs). No primary variant. */
@Component({
  selector: 'app-launcher-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, RouterLink],
  host: { class: 'bp-launcher-tile' },
  template: `
    <a [routerLink]="href()" class="bp-launcher-tile__link" [attr.aria-label]="label()">
      <span class="bp-launcher-tile__icon-block">
        <lucide-icon [name]="icon()" [size]="24" [strokeWidth]="1.5" />
      </span>
      <span class="min-w-0">
        <span class="bp-card-title bp-launcher-tile__title">{{ label() }}</span>
        @if (subtitle()) {
          <span class="bp-card-subtitle bp-launcher-tile__subtitle">{{ subtitle() }}</span>
        }
      </span>
    </a>
  `,
  styles: [
    `
      :host {
        display: block;
        background: var(--color-surface);
        border: 1px solid var(--color-border-hairline);
        border-radius: var(--radius-card);
        /* md at rest (Figma lifted-card; xs was flagged as drift from v1) */
        box-shadow: var(--shadow-md);
        transition: transform 0.12s ease, box-shadow 0.12s ease;
      }
      /* Rest moved xs → md in pV2-04b2, which collapsed the old hover delta
         (md → lg + 1px reads as nothing). Stronger lift restores a visible
         animation against the lifted rest state. */
      :host(:hover) {
        transform: translateY(-3px);
        box-shadow: var(--shadow-lg);
      }
      :host(:focus-within) {
        outline: 2px solid var(--theme-accent);
        outline-offset: 2px;
      }
      .bp-launcher-tile__link {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 16px;
        padding: 24px;
        min-height: 150px;
        text-decoration: none;
        color: var(--color-text);
        outline: none;
      }
      /* Soft pastel icon square (--theme-soft wash) with the pink accent
         icon stroke — the calm tier of the two gradient tokens; the vivid
         --bp-gradient stays on brand marks only (DESIGN.md §2). */
      .bp-launcher-tile__icon-block {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 64px;
        height: 64px;
        border-radius: var(--radius-card);
        background: var(--theme-soft);
        color: var(--theme-accent);
      }
      /* Type comes from .bp-card-title / .bp-card-subtitle (pV2-TYPE-01);
         these structural classes keep only layout. */
      .bp-launcher-tile__title {
        display: block;
      }
      .bp-launcher-tile__subtitle {
        display: block;
        margin-top: 4px;
      }

    `,
  ],
})
export class LauncherTileComponent {
  readonly icon = input.required<string>();
  readonly label = input.required<string>();
  readonly subtitle = input<string>('');
  readonly href = input.required<string>();
}
