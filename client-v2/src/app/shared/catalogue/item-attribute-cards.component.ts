import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

interface Row { label: string; value: string; }

/** pV2-STORE-ATTRIBUTE-GROUPS-01 — shared attribute display for the item view +
 *  marketplace quick-view. DETAILS behind a "Show more details" drill: one rounded
 *  card per POPULATED group (icon + heading + label:value rows), empty hidden —
 *  reusing the quick-view `.bp-qv-spec` box + lucide icons (native Ballpark dialog
 *  look). Selectable choices are a VARIANT now (options retired,
 *  pV2-STORE-VARIANTS-EDIT-01) — the variant picker owns that on the price surface. */
const GROUPS: { key: string; title: string; icon: string }[] = [
  { key: 'measurements', title: 'Measurements', icon: 'ruler' },
  { key: 'materials', title: 'Materials', icon: 'package' },
  { key: 'style', title: 'Style', icon: 'palette' },
  { key: 'features', title: 'Features', icon: 'sparkles' },
  { key: 'specifications', title: 'Specifications', icon: 'info' },
  { key: 'ids', title: 'Identifiers', icon: 'hash' }, // SKU/MPN/GTIN/product id (vendor + agent key)
];

@Component({
  selector: 'app-item-attribute-cards',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [LucideAngularModule],
  template: `
    <!-- Options retired (pV2-STORE-VARIANTS-EDIT-01) — selectable choices are now a
         single-dimension VARIANT, rendered by app-item-variant-picker on the surface
         that owns price. This card only shows the descriptive spec groups. -->
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
  /** The item's `attributes` JSONB (grouped descriptive shape). */
  readonly attributes = input<Record<string, unknown> | null>(null);
  protected readonly expanded = signal(false);

  protected readonly groups = computed(() => {
    const a = this.attributes() ?? {};
    return GROUPS
      .map((g) => ({ ...g, rows: (Array.isArray(a[g.key]) ? a[g.key] : []) as Row[] }))
      .filter((g) => g.rows.length);
  });
}
