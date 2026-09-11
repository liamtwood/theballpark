import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { MarketplaceStore } from '../marketplace/marketplace-store';
import { CatalogueSearchComponent } from '../../shared/catalogue/catalogue-search.component';
import { ViewToggleComponent } from '../../shared/catalogue/view-toggle.component';
import { TabBandComponent, TabBandTab } from '../../shared/tab-band/tab-band.component';
import { SelectComponent, SelectOption } from '../../shared/select/select.component';
import { PRICE_BRACKETS } from '../../shared/catalogue/catalogue.types';

type Panel = 'type' | 'filter' | 'view';

/** Project Marketplace controls — compact by default: a search box + a 3-icon
 *  cluster (same pill container as the view toggle). Clicking a cluster icon
 *  reveals ONE options row below the search (one at a time):
 *    • Type   → Items / Suppliers (the mode toggle, hidden by default)
 *    • Filter → price / tier / supplier
 *    • View   → card / list / table (the existing view toggle)
 *  Project-scoped (injects the route's MarketplaceStore) so the shared
 *  filter-band used by the global marketplace/store is untouched. */
@Component({
  selector: 'app-project-marketplace-controls',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideAngularModule,
    CatalogueSearchComponent,
    ViewToggleComponent,
    TabBandComponent,
    SelectComponent,
  ],
  host: { class: 'block' },
  template: `
    <!-- Row 1: prominent full-width search + count + the 3-icon cluster. -->
    <div class="flex items-center gap-3">
      <div class="min-w-0 flex-1">
        <app-catalogue-search
          [large]="true"
          [value]="store.search()"
          [count]="store.total()"
          (valueChange)="store.setSearch($event)"
        />
      </div>

      <span class="bp-caption shrink-0 text-secondary">{{ store.total() }} items</span>

      <!-- Same container style as app-view-toggle. Each icon toggles its row. -->
      <div class="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-hairline bg-surface p-1">
        <button type="button" class="bp-viewtoggle" [class.bp-viewtoggle--active]="panel() === 'type'"
          aria-label="Browse items or suppliers" (click)="toggle('type')">
          <lucide-icon name="arrow-left-right" [size]="15" />
        </button>
        <button type="button" class="bp-viewtoggle" [class.bp-viewtoggle--active]="panel() === 'filter'"
          aria-label="Filters" (click)="toggle('filter')">
          <lucide-icon name="sliders-horizontal" [size]="15" />
        </button>
        <button type="button" class="bp-viewtoggle" [class.bp-viewtoggle--active]="panel() === 'view'"
          aria-label="View" (click)="toggle('view')">
          <lucide-icon name="layout-grid" [size]="15" />
        </button>
      </div>
    </div>

    <!-- Row 2: the active cluster icon's options (one at a time). -->
    @if (panel(); as p) {
      <div class="mt-3 flex flex-wrap items-center gap-3">
        @switch (p) {
          @case ('type') {
            <app-tab-band [tabs]="modeTabs()" [active]="store.mode()" (activeChange)="store.setMode($event)" />
          }
          @case ('filter') {
            @if (store.mode() === 'items') {
              <app-select ariaLabel="Price" class="w-40" [options]="priceOptions"
                [value]="store.priceBracket() ?? 'any'"
                (changed)="store.setPriceBracket($event === 'any' ? null : $event)" />
              <app-select ariaLabel="Tier" class="w-32" [options]="tierOptions"
                [value]="store.tier() ?? 'any'"
                (changed)="store.setTier($event === 'any' ? null : $event)" />
              <app-select ariaLabel="Supplier" class="w-44" [options]="supplierOptions()"
                [value]="store.supplierId() ?? 'any'"
                (changed)="store.setSupplier($event === 'any' ? null : $event)" />
              @if (store.hasFilters()) {
                <button type="button"
                  class="bp-caption cursor-pointer border-none bg-transparent text-secondary underline hover:text-text"
                  (click)="store.clearFilters()">Clear filters</button>
              }
            } @else {
              <span class="bp-caption text-secondary">Filters apply to items — switch Type to Items.</span>
            }
          }
          @case ('view') {
            <app-view-toggle [active]="store.viewMode()" (activeChange)="store.setViewMode($event)" />
          }
        }
      </div>
    }
  `,
})
export class ProjectMarketplaceControlsComponent {
  protected readonly store = inject(MarketplaceStore);

  /** Which options row is open (null = compact, just search + cluster). */
  protected readonly panel = signal<Panel | null>(null);
  protected toggle(p: Panel): void {
    this.panel.update((cur) => (cur === p ? null : p));
  }

  /** Counts on the Type toggle (same circle badges as Current/Completed).
   *  Items = total catalogue items; Suppliers = distinct suppliers. 0 → no badge. */
  protected readonly modeTabs = computed<TabBandTab[]>(() => [
    { key: 'items', label: 'Items', badge: this.store.categories().reduce((s, c) => s + c.count, 0) || undefined },
    { key: 'suppliers', label: 'Suppliers', badge: this.store.supplierOptions().length || undefined },
  ]);

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
