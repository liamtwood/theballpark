import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { SupplierDetail } from '../../shared/catalogue/catalogue.types';

/** pV2-06d (v2.15c audit fix M7) — the Storefront tab content extracted
 *  from supplier-detail (was pushing the shell toward the 250-line warn):
 *  brand panel (logo letter, name, description, category chips) +
 *  contact card. Category chips emit — the shell owns the Store drill. */
@Component({
  selector: 'app-storefront-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'grid max-w-4xl grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]' },
  template: `
    <!-- Brand panel -->
    <section class="rounded-[var(--radius-card)] border border-hairline bg-surface p-6">
      <div class="flex items-center gap-3">
        <span class="bp-supplier-card__logo !h-10 !w-10 text-md">{{ initial() }}</span>
        <span>
          <span class="block text-md font-medium text-text">{{ supplier().name }}</span>
          <span class="bp-caption">{{ location() }}</span>
        </span>
      </div>
      @if (supplier().description) {
        <p class="bp-body mt-4 text-secondary">{{ supplier().description }}</p>
      }

      @if (supplier().categories.length) {
        <h3 class="bp-field-label mt-6 uppercase tracking-wide">Categories</h3>
        <div class="mt-2 flex flex-wrap gap-2">
          @for (cat of supplier().categories; track cat.id) {
            <button type="button" class="bp-cat-chip" (click)="categorySelected.emit(cat.id)">
              {{ cat.name }}
              <span class="bp-meta">{{ cat.count }}</span>
            </button>
          }
        </div>
      }
    </section>

    <!-- Contact card -->
    <section class="rounded-[var(--radius-card)] border border-hairline bg-surface p-6">
      <h3 class="bp-field-label uppercase tracking-wide">Contact info</h3>
      <dl class="mt-3 flex flex-col gap-3">
        @if (supplier().address) {
          <div class="flex items-start gap-2.5">
            <lucide-icon name="map-pin" [size]="15" class="mt-0.5 text-muted" />
            <dd class="bp-body-small text-secondary">{{ supplier().address }}<br />{{ location() }}</dd>
          </div>
        }
        @if (supplier().phone) {
          <div class="flex items-center gap-2.5">
            <lucide-icon name="phone" [size]="15" class="text-muted" />
            <dd><a class="bp-body-small text-secondary hover:text-accent" [href]="'tel:' + supplier().phone">{{ supplier().phone }}</a></dd>
          </div>
        }
        @if (supplier().email) {
          <div class="flex items-center gap-2.5">
            <lucide-icon name="mail" [size]="15" class="text-muted" />
            <dd><a class="bp-body-small text-secondary hover:text-accent" [href]="'mailto:' + supplier().email">{{ supplier().email }}</a></dd>
          </div>
        }
        @if (supplier().website) {
          <div class="flex items-center gap-2.5">
            <lucide-icon name="globe" [size]="15" class="text-muted" />
            <dd><a class="bp-body-small break-all text-secondary hover:text-accent" [href]="supplier().website" target="_blank" rel="noopener">{{ supplier().website }}</a></dd>
          </div>
        }
      </dl>
    </section>
  `,
})
export class StorefrontPanelComponent {
  readonly supplier = input.required<SupplierDetail>();
  readonly categorySelected = output<string>();

  protected initial(): string {
    return (this.supplier().name || '?').charAt(0).toUpperCase();
  }

  protected location(): string {
    const s = this.supplier();
    return [s.city, s.country].filter((x): x is string => !!x).join(', ');
  }
}
