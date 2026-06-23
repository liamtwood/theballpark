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
  host: { class: 'bp-card bp-card--lifted bp-launcher-tile' },
  template: `
    <a [routerLink]="href()" [queryParams]="query()" class="bp-launcher-tile__link" [attr.aria-label]="label()">
      <span class="bp-icon-block h-16 w-16">
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
      /* Chrome comes from .bp-card .bp-card--lifted (pV2-CARDS-01 — the
         md-rest / lg-hover Figma look is the --lifted modifier; the icon
         square is the global .bp-icon-block). Only LAYOUT remains here. */
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
  /** Optional query params for the routerLink (null = none). */
  readonly query = input<Record<string, string> | null>(null);
}
