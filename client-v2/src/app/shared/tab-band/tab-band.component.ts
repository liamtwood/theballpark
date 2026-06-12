import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** One tab in the band (badge optional — e.g. Inbox unread). */
export interface TabBandTab {
  key: string;
  label: string;
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
  host: { class: 'bp-tab-band' },
  template: `
    @for (tab of tabs(); track tab.key) {
      <button
        type="button"
        class="bp-tab"
        [class.bp-tab--active]="tab.key === active()"
        (click)="activeChange.emit(tab.key)"
      >
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
}
