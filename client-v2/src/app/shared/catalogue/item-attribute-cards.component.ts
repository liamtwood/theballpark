import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

interface Row { label: string; value: string; }
interface Opt { name: string; price: number; }

/** pV2-STORE-ATTRIBUTE-GROUPS-01 — shared attribute display for the item view +
 *  marketplace quick-view. KEY: the Options "Choose your option" picklist (shown
 *  when present). DETAILS behind a "Show more details" drill: one rounded card per
 *  POPULATED group (icon + heading + label:value rows), empty hidden — reusing the
 *  quick-view `.bp-qv-spec` box + lucide icons (native Ballpark dialog look). Volume
 *  pricing + qty/add/price/image are KEY data owned by the surrounding surface.
 *  Selection→line-price via the SSOT is a noted follow-up (picklist display-only). */
const GROUPS: { key: string; title: string; icon: string }[] = [
  { key: 'measurements', title: 'Measurements', icon: 'ruler' },
  { key: 'materials', title: 'Materials', icon: 'package' },
  { key: 'style', title: 'Style', icon: 'palette' },
  { key: 'features', title: 'Features', icon: 'sparkles' },
  { key: 'specifications', title: 'Specifications', icon: 'info' },
];

@Component({
  selector: 'app-item-attribute-cards',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [FormsModule, LucideAngularModule],
  template: `
    <!-- KEY: Options picklist (only when populated). -->
    @if (options().length) {
      <div class="mb-3">
        <label class="bp-field-label">Choose your option</label>
        <select class="bp-input-field mt-1 w-full" [ngModel]="selected()" (ngModelChange)="selected.set($event)">
          <option value="">Select one…</option>
          @for (o of options(); track $index) {
            <option [value]="o.name">{{ o.name }}{{ o.price ? ' (+£' + o.price + ')' : ' (included)' }}</option>
          }
        </select>
        <p class="bp-caption text-secondary mt-1">Selecting an option will adjust the line price (coming soon).</p>
      </div>
    }

    <!-- DETAILS: the spec-group cards behind a Show-more drill (empty groups hidden). -->
    @if (groups().length) {
      <button type="button" class="bp-btn-outline bp-body-small" (click)="expanded.set(!expanded())">
        <lucide-icon [name]="expanded() ? 'chevron-up' : 'chevron-down'" [size]="14" />
        {{ expanded() ? 'Hide details' : 'Show more details' }}
      </button>
      @if (expanded()) {
        <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          @for (g of groups(); track g.key) {
            <div class="bp-qv-spec">
              <span class="bp-qv-spec__label"><lucide-icon [name]="g.icon" [size]="13" /> {{ g.title }}</span>
              <dl class="mt-2 grid grid-cols-[130px_minmax(0,1fr)] gap-x-3 gap-y-1.5">
                @for (r of g.rows; track $index) {
                  <dt class="bp-body-small text-secondary">{{ r.label }}</dt>
                  <dd class="bp-body-small text-text">{{ r.value }}</dd>
                }
              </dl>
            </div>
          }
        </div>
      }
    }
  `,
})
export class ItemAttributeCardsComponent {
  /** The item's `attributes` JSONB (grouped shape, incl. options). */
  readonly attributes = input<Record<string, unknown> | null>(null);
  protected readonly selected = signal('');
  protected readonly expanded = signal(false);

  protected readonly groups = computed(() => {
    const a = this.attributes() ?? {};
    return GROUPS
      .map((g) => ({ ...g, rows: (Array.isArray(a[g.key]) ? a[g.key] : []) as Row[] }))
      .filter((g) => g.rows.length);
  });
  protected readonly options = computed(() => {
    const a = this.attributes() ?? {};
    return (Array.isArray(a['options']) ? a['options'] : []) as Opt[];
  });
}
