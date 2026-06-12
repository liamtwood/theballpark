import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SupplierCardComponent } from './supplier-card.component';
import { CatalogueSupplier, ViewMode } from './catalogue.types';

/** pV2-06d (v2.15b QC fix) — the suppliers middle region with the SAME
 *  three view modes as items (the toggle was inert in suppliers mode).
 *  Pure: suppliers in, favourite events out; rows link to /suppliers/:id. */
@Component({
  selector: 'app-supplier-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SupplierCardComponent],
  host: { class: 'block' },
  template: `
    @switch (viewMode()) {
      @case ('card') {
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          @for (sup of suppliers(); track sup.id) {
            <app-supplier-card
              [supplier]="sup"
              [favourited]="favouriteIds().has(sup.id)"
              (favouriteToggled)="favouriteToggled.emit($event)"
            />
          }
        </div>
      }
      @case ('list') {
        <div class="overflow-hidden rounded-xl border border-hairline bg-surface">
          @for (sup of suppliers(); track sup.id) {
            <a
              [routerLink]="['/suppliers', sup.id]"
              class="grid grid-cols-[36px_1fr_auto] items-center gap-3 border-b border-hairline px-3 py-2 text-text no-underline last:border-b-0 hover:bg-fill"
            >
              <span class="bp-supplier-card__logo">{{ initial(sup) }}</span>
              <span class="min-w-0">
                <span class="block truncate text-md font-medium">{{ sup.name }}</span>
                <span class="bp-caption block truncate">{{ sup.city ?? '' }}</span>
              </span>
              <span class="bp-meta">{{ sup.count }} item{{ sup.count === 1 ? '' : 's' }}</span>
            </a>
          }
        </div>
      }
      @case ('table') {
        <div class="overflow-hidden rounded-xl border border-hairline bg-surface">
          <div class="grid grid-cols-[1.6fr_1fr_110px] gap-x-4 border-b border-hairline bg-fill px-4 py-2">
            <span class="bp-table-column-header">Supplier</span>
            <span class="bp-table-column-header">City</span>
            <span class="bp-table-column-header text-right">Items</span>
          </div>
          @for (sup of suppliers(); track sup.id) {
            <a
              [routerLink]="['/suppliers', sup.id]"
              class="grid grid-cols-[1.6fr_1fr_110px] gap-x-4 border-b border-hairline px-4 py-2 text-text no-underline last:border-b-0 hover:bg-fill"
            >
              <span class="truncate text-base">{{ sup.name }}</span>
              <span class="bp-body-small truncate text-secondary">{{ sup.city ?? '—' }}</span>
              <span class="bp-body-small text-right text-secondary">{{ sup.count }}</span>
            </a>
          }
        </div>
      }
    }
  `,
})
export class SupplierGridComponent {
  readonly suppliers = input.required<readonly CatalogueSupplier[]>();
  readonly viewMode = input<ViewMode>('card');
  readonly favouriteIds = input<ReadonlySet<string>>(new Set<string>());
  readonly favouriteToggled = output<string>();

  protected initial(sup: CatalogueSupplier): string {
    return (sup.name || '?').charAt(0).toUpperCase();
  }
}
