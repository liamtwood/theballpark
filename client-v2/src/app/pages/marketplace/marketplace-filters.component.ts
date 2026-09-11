import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MarketplaceStore } from './marketplace-store';
import { SelectComponent, SelectOption } from '../../shared/select/select.component';
import { PRICE_BRACKETS } from '../../shared/catalogue/catalogue.types';

/** The marketplace filter row — price / tier / supplier selects + clear.
 *  Store-driven; stacked vertically (full-width) in the controls' left column
 *  under the Type toggle when the Filter cluster icon is on. Item-mode only
 *  (price/tier/supplier don't fit supplier rows). */
@Component({
  selector: 'app-marketplace-filters',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SelectComponent],
  host: { class: 'block' },
  template: `
    @if (store.mode() === 'items') {
      <div class="flex flex-col gap-2">
        <app-select ariaLabel="Price" class="block w-full" [options]="priceOptions"
          [value]="store.priceBracket() ?? 'any'"
          (changed)="store.setPriceBracket($event === 'any' ? null : $event)" />
        <app-select ariaLabel="Tier" class="block w-full" [options]="tierOptions"
          [value]="store.tier() ?? 'any'"
          (changed)="store.setTier($event === 'any' ? null : $event)" />
        <app-select ariaLabel="Supplier" class="block w-full" [options]="supplierOptions()"
          [value]="store.supplierId() ?? 'any'"
          (changed)="store.setSupplier($event === 'any' ? null : $event)" />
        @if (store.hasFilters()) {
          <button type="button"
            class="bp-caption cursor-pointer self-start border-none bg-transparent text-secondary underline hover:text-text"
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
}
