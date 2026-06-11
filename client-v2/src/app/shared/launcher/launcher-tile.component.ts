import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';

/** pV2-04b — launcher tile (the v2 rebuild of v1's action-tile, p0019): a
 *  white routerLink card with a brand-gradient icon block above title +
 *  subtitle (v1 proportions per pV2-04b1-qc; gradient-on-icon-block per
 *  Liam's follow-up QC — every tile identical, no primary variant). */
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
      /* Brand-gradient icon square (Liam's QC call): the ONE --bp-gradient
         token (styles.css fallback, DB-overridable via BrandConfigService) —
         same treatment as the avatar initials circle. White icon on it. */
      .bp-launcher-tile__icon-block {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 64px;
        height: 64px;
        border-radius: 12px;
        background: var(--bp-gradient);
        color: var(--bp-text-on-gradient);
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

    `,
  ],
})
export class LauncherTileComponent {
  readonly icon = input.required<string>();
  readonly label = input.required<string>();
  readonly subtitle = input<string>('');
  readonly href = input.required<string>();
}
