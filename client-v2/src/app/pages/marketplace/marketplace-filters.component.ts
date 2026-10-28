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
      <!-- Each filter is a labelled column (label above, in the editable-form
           field-label style — matches Profile > Organisation name). Row bottom-aligns
           so the selects line up under their labels. (Liam 2026-10-28) -->
      <div class="flex flex-wrap items-end gap-3">
        <div class="flex flex-col gap-1">
          <span class="bp-field-label">Price</span>
          <app-select ariaLabel="Price" class="w-40" [compact]="true" [options]="priceOptions"
            [value]="store.priceBracket() ?? 'any'"
            (changed)="store.setPriceBracket($event === 'any' ? null : $event)" />
        </div>
        <div class="flex flex-col gap-1">
          <span class="bp-field-label">Tier</span>
          <app-select ariaLabel="Tier" class="w-32" [compact]="true" [options]="tierOptions"
            [value]="store.tier() ?? 'any'"
            (changed)="store.setTier($event === 'any' ? null : $event)" />
        </div>
        <!-- Supplier filter is pointless on a pinned single-supplier store. -->
        @if (!store.pinnedSupplierId()) {
          <div class="flex flex-col gap-1">
            <span class="bp-field-label">Supplier</span>
            <app-select ariaLabel="Supplier" class="w-64" [compact]="true" [options]="supplierOptions()"
              [value]="store.supplierId() ?? 'any'"
              (changed)="store.setSupplier($event === 'any' ? null : $event)" />
          </div>
        }
        <!-- Owner / ballpark-admin only: approval status + publish state, so an
             owner can find pending / rejected / hidden (inactive) items. -->
        @if (store.showStatusFilters()) {
          <div class="flex flex-col gap-1">
            <span class="bp-field-label">Status</span>
            <app-select ariaLabel="Status" class="w-40" [compact]="true" [options]="statusOptions"
              [value]="store.statusFilter() ?? 'all'"
              (changed)="store.setStatusFilter($event)" />
          </div>
          <div class="flex flex-col gap-1">
            <span class="bp-field-label">Active</span>
            <app-select ariaLabel="Active" class="w-32" [compact]="true" [options]="activeOptions"
              [value]="store.activeFilter() ?? 'all'"
              (changed)="store.setActiveFilter($event)" />
          </div>
          <div class="flex flex-col gap-1">
            <span class="bp-field-label">Images</span>
            <app-select ariaLabel="Images" class="w-32" [compact]="true" [options]="imageOptions"
              [value]="store.imageFilter() ?? 'any'"
              (changed)="store.setImageFilter($event === 'any' ? null : $event)" />
          </div>
        }
        @if (store.hasFilters()) {
          <button type="button"
            class="bp-caption cursor-pointer self-end border-none bg-transparent pb-2 text-secondary underline hover:text-text"
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

  // Labels are now terse (the filter NAME is the column label above the select):
  // "Any" for the no-filter default, plus Yes/No on the binary filters (Active/Images).
  protected readonly priceOptions: SelectOption[] = [
    { label: 'Any', value: 'any' },
    ...PRICE_BRACKETS.map((b) => ({ label: b.label, value: b.key })),
  ];

  protected readonly tierOptions: SelectOption[] = [
    { label: 'Any', value: 'any' },
    { label: 'Basic', value: 'basic' },
    { label: 'Mid', value: 'mid' },
    { label: 'Premium', value: 'premium' },
  ];

  protected readonly supplierOptions = computed<SelectOption[]>(() => [
    { label: 'Any', value: 'any' },
    ...this.store.supplierOptions().map((s) => ({ label: `${s.name} (${s.count})`, value: s.id })),
  ]);

  /** Owner / ballpark-admin approval-status filter. */
  protected readonly statusOptions: SelectOption[] = [
    { label: 'Any', value: 'all' },
    { label: 'Draft', value: 'draft' },
    { label: 'Pending', value: 'pending' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
  ];

  /** Owner / ballpark-admin publish-state (Active?) filter. */
  protected readonly activeOptions: SelectOption[] = [
    { label: 'Any', value: 'all' },
    { label: 'Yes', value: 'active' },
    { label: 'No', value: 'inactive' },
  ];

  /** Owner / ballpark-admin "has a photo?" filter (pV2-ITEM-BULK-ACTIONS-01). */
  protected readonly imageOptions: SelectOption[] = [
    { label: 'Any', value: 'any' },
    { label: 'Yes', value: 'with' },
    { label: 'No', value: 'without' },
  ];
}
