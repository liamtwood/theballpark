import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MarketplaceStore } from '../../pages/marketplace/marketplace-store';
import { CatalogueSearchComponent } from './catalogue-search.component';
import { EditFieldComponent, EditFieldOption } from '../edit-field/edit-field.component';
import { ViewToggleComponent } from './view-toggle.component';
import { PRICE_BRACKETS } from './catalogue.types';

/** pV2-CARDS-01 (QC — RP-06 extraction): the catalogue search + filter
 *  band, ONE definition mounted by EVERY MarketplaceStore consumer
 *  (/marketplace + the supplier Store tab — the band was inline on
 *  marketplace-page only, so the Store tab silently lacked search).
 *  Injects the page's route-scoped store; filters apply in items mode
 *  (price/tier don't fit supplier rows). The supplier select only makes
 *  sense un-pinned — marketplace turns it on, the Store tab doesn't.
 *  NOTE (RP-04 closed row): tier filters items.tier — an item_tier
 *  codelist candidate for the /store arc, not budget_tier. */
@Component({
  selector: 'app-catalogue-filter-band',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CatalogueSearchComponent, EditFieldComponent, ViewToggleComponent],
  host: { class: 'mb-3 flex flex-wrap items-center gap-3' },
  template: `
    <div class="w-full max-w-md">
      <app-catalogue-search
        [value]="store.search()"
        [count]="store.total()"
        (valueChange)="store.setSearch($event)"
      />
    </div>

    @if (store.mode() === 'items') {
      <app-edit-field
        label=""
        type="select"
        class="w-40"
        [options]="priceOptions"
        [value]="store.priceBracket() ?? 'any'"
        [editing]="true"
        (valueChange)="store.setPriceBracket($event === 'any' ? null : $event)"
      />
      <app-edit-field
        label=""
        type="select"
        class="w-32"
        [options]="tierOptions"
        [value]="store.tier() ?? 'any'"
        [editing]="true"
        (valueChange)="store.setTier($event === 'any' ? null : $event)"
      />
      @if (store.showStatusFilters()) {
        <!-- pV2-STORE-01 — owner + ballpark-admin, same select standard as price/tier. -->
        <app-edit-field
          label=""
          type="select"
          class="w-40"
          [options]="statusOptions"
          [value]="store.statusFilter() ?? 'all'"
          [editing]="true"
          (valueChange)="store.setStatusFilter($event)"
        />
        <app-edit-field
          label=""
          type="select"
          class="w-32"
          [options]="activeOptions"
          [value]="store.activeFilter() ?? 'all'"
          [editing]="true"
          (valueChange)="store.setActiveFilter($event)"
        />
      }
      @if (showSupplier()) {
        <app-edit-field
          label=""
          type="select"
          class="w-44"
          [options]="supplierOptions()"
          [value]="store.supplierId() ?? 'any'"
          [editing]="true"
          (valueChange)="store.setSupplier($event === 'any' ? null : $event)"
        />
      }
      @if (store.hasFilters()) {
        <button
          type="button"
          class="bp-caption cursor-pointer border-none bg-transparent text-secondary underline hover:text-text"
          (click)="store.clearFilters()"
        >
          Clear filters
        </button>
      }
    }

    <app-view-toggle class="ml-auto" [active]="store.viewMode()" (activeChange)="store.setViewMode($event)" />
  `,
})
export class CatalogueFilterBandComponent {
  protected readonly store = inject(MarketplaceStore);

  /** Marketplace shows the supplier filter; the pinned Store tab doesn't. */
  readonly showSupplier = input<boolean>(false);

  protected readonly priceOptions: EditFieldOption[] = [
    { label: 'Any price', value: 'any' },
    ...PRICE_BRACKETS.map((b) => ({ label: b.label, value: b.key })),
  ];

  protected readonly tierOptions: EditFieldOption[] = [
    { label: 'Any tier', value: 'any' },
    { label: 'Basic', value: 'basic' },
    { label: 'Mid', value: 'mid' },
    { label: 'Premium', value: 'premium' },
  ];

  protected readonly supplierOptions = computed<EditFieldOption[]>(() => [
    { label: 'Any supplier', value: 'any' },
    ...this.store.supplierOptions().map((s) => ({ label: `${s.name} (${s.count})`, value: s.id })),
  ]);

  // pV2-STORE-01 — owner store filters (only rendered on the owner's own store).
  protected readonly statusOptions: EditFieldOption[] = [
    { label: 'Any Status', value: 'all' },
    { label: 'Draft', value: 'draft' },
    { label: 'Pending', value: 'pending' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
  ];

  protected readonly activeOptions: EditFieldOption[] = [
    { label: 'All', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' },
  ];
}
