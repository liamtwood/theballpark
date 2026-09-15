import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MarketplaceStore } from './marketplace-store';
import { SelectComponent, SelectOption } from '../../shared/select/select.component';
import { PRICE_BRACKETS } from '../../shared/catalogue/catalogue.types';

/** The marketplace filter row — price / tier / supplier selects + clear.
 *  Store-driven; a horizontal row in the controls' options line. Item-mode only
 *  (price/tier/supplier don't fit supplier rows). */
@Component({
  selector: 'app-marketplace-filters',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SelectComponent],
  host: { class: 'block' },
  template: `
    @if (store.mode() === 'items') {
      <div class="flex flex-wrap items-center gap-3">
        <app-select ariaLabel="Price" class="w-40" [compact]="true" [options]="priceOptions"
          [value]="store.priceBracket() ?? 'any'"
          (changed)="store.setPriceBracket($event === 'any' ? null : $event)" />
        <app-select ariaLabel="Tier" class="w-32" [compact]="true" [options]="tierOptions"
          [value]="store.tier() ?? 'any'"
          (changed)="store.setTier($event === 'any' ? null : $event)" />
        <!-- Supplier filter is pointless on a pinned single-supplier store. -->
        @if (!store.pinnedSupplierId()) {
          <app-select ariaLabel="Supplier" class="w-44" [compact]="true" [options]="supplierOptions()"
            [value]="store.supplierId() ?? 'any'"
            (changed)="store.setSupplier($event === 'any' ? null : $event)" />
        }
        <!-- Owner / ballpark-admin only: approval status + publish state, so an
             owner can find pending / rejected / hidden (inactive) items. -->
        @if (store.showStatusFilters()) {
          <app-select ariaLabel="Approval status" class="w-40" [compact]="true" [options]="statusOptions"
            [value]="store.statusFilter() ?? 'all'"
            (changed)="store.setStatusFilter($event)" />
          <app-select ariaLabel="Visibility" class="w-36" [compact]="true" [options]="activeOptions"
            [value]="store.activeFilter() ?? 'all'"
            (changed)="store.setActiveFilter($event)" />
        }
        @if (store.hasFilters()) {
          <button type="button"
            class="bp-caption cursor-pointer border-none bg-transparent text-secondary underline hover:text-text"
            (click)="store.clearFilters()">Clear filters</button>
        }
      </div>
    } @else {
      <span class="bp-caption text-secondary">Filters apply to items — switch Type to Items.</span>
    }
  `,
})
export class MarketplaceFiltersComponent {
  protected readonly store = inject(MarketplaceStore);

  protected readonly priceOptions: SelectOption[] = [
    { label: 'Any price', value: 'any' },
    ...PRICE_BRACKETS.map((b) => ({ label: b.label, value: b.key })),
  ];

  protected readonly tierOptions: SelectOption[] = [
    { label: 'Any tier', value: 'any' },
    { label: 'Basic', value: 'basic' },
    { label: 'Mid', value: 'mid' },
    { label: 'Premium', value: 'premium' },
  ];

  protected readonly supplierOptions = computed<SelectOption[]>(() => [
    { label: 'Any supplier', value: 'any' },
    ...this.store.supplierOptions().map((s) => ({ label: `${s.name} (${s.count})`, value: s.id })),
  ]);

  /** Owner / ballpark-admin approval-status filter. */
  protected readonly statusOptions: SelectOption[] = [
    { label: 'Any status', value: 'all' },
    { label: 'Draft', value: 'draft' },
    { label: 'Pending', value: 'pending' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
  ];

  /** Owner / ballpark-admin publish-state (visibility) filter. */
  protected readonly activeOptions: SelectOption[] = [
    { label: 'Active & Inactive', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' },
  ];
}
