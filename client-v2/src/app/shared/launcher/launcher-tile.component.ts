import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';

/** pV2-04b — launcher tile (the v2 rebuild of v1's action-tile, p0019): a
 *  routerLink card with an icon square above the label. The primary variant
 *  wears the brand gradient + white text (DESIGN.md — gradient is brand-mark
 *  territory; the first tile is the home's primary action). */
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
      <span class="bp-launcher-tile__icon">
        <lucide-icon [name]="icon()" [size]="20" [strokeWidth]="1.5" />
      </span>
      <span class="bp-launcher-tile__label">{{ label() }}</span>
    </a>
  `,
  styles: [
    `
      :host {
        display: block;
        background: var(--color-surface);
        border: var(--border-hairline);
        border-radius: var(--radius-card);
        box-shadow: var(--shadow-md);
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
        gap: 14px;
        padding: 20px;
        min-height: 140px;
        text-decoration: none;
        color: var(--color-text);
        outline: none;
      }
      .bp-launcher-tile__icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border-radius: 14px;
        background: var(--theme-soft);
        color: var(--theme-accent);
      }
      .bp-launcher-tile__label {
        font-size: 14px;
        font-weight: 600;
        font-family: var(--font-body);
      }

      :host(.bp-launcher-tile--primary) {
        background: var(--bp-gradient);
        border: none;
      }
      :host(.bp-launcher-tile--primary) .bp-launcher-tile__link {
        color: var(--bp-text-on-gradient);
      }
      :host(.bp-launcher-tile--primary) .bp-launcher-tile__icon {
        background: var(--color-surface-alt);
        color: var(--theme-accent);
      }
    `,
  ],
})
export class LauncherTileComponent {
  readonly icon = input.required<string>();
  readonly label = input.required<string>();
  readonly href = input.required<string>();
  readonly primary = input<boolean>(false);
}
