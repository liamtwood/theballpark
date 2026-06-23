import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogueSupplier, CategoryInfo } from '../../../shared/catalogue/catalogue.types';

/** pV2-06e — the rail's CATEGORY mode (the v1 category-context-panel
 *  port, simplified per MARKETPLACE.md): category name + tagline + item
 *  count, then the suppliers serving it (logo letter + name + count,
 *  linking to their storefront). The supplier list is GLOBAL-marketplace
 *  only — the pinned supplier-store scope passes an empty list and shows
 *  just the category header. */
@Component({
  selector: 'app-category-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  host: { class: 'block' },
  template: `
    <h3 class="text-md font-medium text-text">{{ category().name }}</h3>
    @if (category().tagline) {
      <p class="bp-body-small mt-1 text-secondary">{{ category().tagline }}</p>
    }
    <p class="bp-meta mt-1">{{ category().count }} item{{ category().count === 1 ? '' : 's' }}</p>

    @if (suppliers().length) {
      <h4 class="bp-field-label mt-5 uppercase tracking-wide">Suppliers</h4>
      <div class="mt-2 flex flex-col gap-1">
        @for (sup of suppliers(); track sup.id) {
          <a
            [routerLink]="['/suppliers', sup.id]"
            class="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-text no-underline hover:bg-fill"
          >
            <span class="bp-supplier-card__logo !h-6 !w-6 !text-xs">{{ initial(sup) }}</span>
            <span class="min-w-0 flex-1 truncate text-base">{{ sup.name }}</span>
            <span class="bp-meta">{{ sup.count }}</span>
          </a>
        }
      </div>
    }
  `,
})
export class CategorySummaryComponent {
  readonly category = input.required<CategoryInfo>();
  readonly suppliers = input<readonly CatalogueSupplier[]>([]);

  protected initial(sup: CatalogueSupplier): string {
    return (sup.name || '?').charAt(0).toUpperCase();
  }
}
