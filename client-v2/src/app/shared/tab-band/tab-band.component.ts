import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

/** One tab in the band (icon + badge optional — e.g. Inbox unread). */
export interface TabBandTab {
  key: string;
  label: string;
  icon?: string;
  badge?: number;
}

/** pV2-06d — the hero tab band primitive (the "06c-pre" piece from the
 *  arc plan): the pill row v1 pushed into the shell hero, as a standalone
 *  component. Three planned consumers: marketplace Items|Suppliers,
 *  supplier-detail Storefront|Store, project-detail tabs (with badge).
 *  Dumb: tabs + active in, key out — the consumer owns what a tab means
 *  (usually a URL param). Classes live in styles.css (RP-05). */
@Component({
  selector: 'app-tab-band',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: {
    class: 'bp-tab-band',
    '[class.bp-tab-band--even]': 'equalWidth()',
  },
  template: `
    @for (tab of tabs(); track tab.key) {
      <button
        type="button"
        class="bp-tab"
        [class.bp-tab--active]="tab.key === active()"
        (click)="activeChange.emit(tab.key)"
      >
        @if (tab.icon) {
          <lucide-icon [name]="tab.icon" [size]="16" [strokeWidth]="1.75" />
        }
        {{ tab.label }}
        @if (tab.badge) {
          <span class="bp-tab__badge">{{ tab.badge }}</span>
        }
      </button>
    }
  `,
})
export class TabBandComponent {
  readonly tabs = input.required<readonly TabBandTab[]>();
  readonly active = input.required<string>();
  readonly activeChange = output<string>();
  /** Give every tab an equal (fixed) width so the band reads even. */
  readonly equalWidth = input<boolean>(false);
}
