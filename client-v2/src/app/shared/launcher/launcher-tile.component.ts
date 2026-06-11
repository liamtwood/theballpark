import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';

/** pV2-04b — launcher tile (the v2 rebuild of v1's action-tile, p0019): a
 *  routerLink card with a soft pastel icon block above title + subtitle
 *  (v1 proportions per pV2-04b1-qc). The primary variant wears the brand
 *  gradient + white text. */
@Component({
  selector: 'app-launcher-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, RouterLink],
  host: {
    class: 'bp-launcher-tile',
    '[class.bp-launcher-tile--primary]': 'primary()',
  },
  template: `
    <a [routerLink]="href()" class="bp-launcher-tile__link" [attr.aria-label]="label()">
      <span class="bp-launcher-tile__icon-block">
        <lucide-icon [name]="icon()" [size]="24" [strokeWidth]="1.5" />
      </span>
      <span class="min-w-0">
        <span class="bp-launcher-tile__title">{{ label() }}</span>
        @if (subtitle()) {
          <span class="bp-launcher-tile__subtitle">{{ subtitle() }}</span>
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
        border-radius: 16px;
        box-shadow: var(--shadow-xs);
        transition: transform 0.12s ease, box-shadow 0.12s ease;
      }
      :host(:hover) {
        transform: translateY(-1px);
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
      /* Soft pastel icon square (v1 parity) — the gradient stays on
         --theme-soft INSIDE the block, not across the tile. */
      .bp-launcher-tile__icon-block {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 64px;
        height: 64px;
        border-radius: 12px;
        background: var(--theme-soft);
        color: var(--theme-accent);
      }
      .bp-launcher-tile__title {
        display: block;
        font-family: var(--font-body);
        font-size: 17px;
        font-weight: 600;
        line-height: 1.3;
      }
      .bp-launcher-tile__subtitle {
        display: block;
        margin-top: 4px;
        font-family: var(--font-body);
        font-size: 13px;
        line-height: 1.4;
        color: var(--color-text-secondary);
      }

      :host(.bp-launcher-tile--primary) {
        background: var(--bp-gradient);
        border: none;
      }
      :host(.bp-launcher-tile--primary) .bp-launcher-tile__link {
        color: var(--bp-text-on-gradient);
      }
      :host(.bp-launcher-tile--primary) .bp-launcher-tile__icon-block {
        background: var(--color-surface-alt);
        color: var(--theme-accent);
      }
      :host(.bp-launcher-tile--primary) .bp-launcher-tile__subtitle {
        color: var(--bp-text-on-gradient);
        opacity: 0.85;
      }
    `,
  ],
})
export class LauncherTileComponent {
  readonly icon = input.required<string>();
  readonly label = input.required<string>();
  readonly subtitle = input<string>('');
  readonly href = input.required<string>();
  readonly primary = input<boolean>(false);
}
