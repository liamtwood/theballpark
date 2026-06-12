import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { PageConfigService } from '../../core/config/page-config.service';
import { PageHeroComponent } from '../../shell/page-hero/page-hero.component';
import { CatalogueSearchComponent } from '../../shared/catalogue/catalogue-search.component';
import { CategoryStripComponent } from '../../shared/catalogue/category-strip.component';
import { CatalogueGridComponent } from '../../shared/catalogue/catalogue-grid.component';
import { CatalogueLayoutComponent } from '../../shared/catalogue/catalogue-layout.component';
import { EditFieldComponent, EditFieldOption } from '../../shared/edit-field/edit-field.component';
import { ViewToggleComponent } from '../../shared/catalogue/view-toggle.component';
import { PRICE_BRACKETS } from '../../shared/catalogue/catalogue.types';
import { FavouritesStore } from '../../core/marketplace/favourites.store';
import { SupplierGridComponent } from '../../shared/catalogue/supplier-grid.component';
import { TabBandComponent, TabBandTab } from '../../shared/tab-band/tab-band.component';
import { MarketplaceStore } from './marketplace-store';
import { RightRailComponent } from './rail/right-rail.component';

/** pV2-06a — /marketplace: the browse foundation (MARKETPLACE.md five
 *  regions). Route shell only — mounts hero + search row + the three
 *  columns and wires the store to the engine. Items mode only (suppliers
 *  join in 06d); the right rail shows placeholder modes until 06b/e/f. */
@Component({
  selector: 'app-marketplace-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideAngularModule,
    PageHeroComponent,
    CatalogueSearchComponent,
    CategoryStripComponent,
    CatalogueGridComponent,
    CatalogueLayoutComponent,
    EditFieldComponent,
    RightRailComponent,
    SupplierGridComponent,
    TabBandComponent,
    ViewToggleComponent,
  ],
  providers: [MarketplaceStore],
  /* bp-vpfit (md+): the page fills the viewport exactly — hero + filter
     band anchored, the catalogue columns scroll independently. */
  host: { class: 'block bp-vpfit' },
  template: `
    <app-page-hero
      [back]="{ label: 'Back', href: '/home' }"
      [title]="heroTitle()"
      [subtitle]="heroSubtitle()"
    >
      <app-tab-band
        hero-actions
        [tabs]="modeTabs"
        [active]="store.mode()"
        (activeChange)="store.setMode($event)"
      />
    </app-page-hero>

    <div class="bp-page-body">
      <!-- Search row: box + filter selects + view toggle -->
      <div class="mb-5 flex flex-wrap items-center gap-3">
        <div class="w-full max-w-md">
          <app-catalogue-search
            [value]="store.search()"
            [count]="store.total()"
            (valueChange)="store.setSearch($event)"
          />
        </div>

        <!-- pV2-06c filters — items mode only (price/tier/supplier don't
             apply to supplier rows). -->
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
        <app-edit-field
          label=""
          type="select"
          class="w-44"
          [options]="supplierOptions()"
          [value]="store.supplierId() ?? 'any'"
          [editing]="true"
          (valueChange)="store.setSupplier($event === 'any' ? null : $event)"
        />
        @if (store.hasFilters()) {
          <button type="button" class="bp-caption cursor-pointer border-none bg-transparent text-secondary underline hover:text-text" (click)="store.clearFilters()">
            Clear filters
          </button>
        }
        }

        <app-view-toggle class="ml-auto" [active]="store.viewMode()" (activeChange)="store.setViewMode($event)" />
      </div>

      <!-- Three regions on the shared layout shell -->
      <app-catalogue-layout>
        <app-category-strip
          strip
          [categories]="store.categories()"
          [activeId]="store.categoryId()"
          [totalCount]="allItemsCount()"
          [subcategories]="store.mode() === 'items' ? store.subcategories() : []"
          [activeSubId]="store.subcategoryId()"
          (categorySelected)="store.setCategory($event)"
          (subcategorySelected)="store.setSubcategory($event)"
        />

        <div>
          @if (store.mode() === 'suppliers') {
            @if (store.suppliersRes.isLoading() && store.supplierRows().length === 0) {
              <p class="bp-body-small text-secondary">Loading…</p>
            } @else if (store.supplierRows().length === 0) {
              <p class="bp-body-small text-secondary">No suppliers match.</p>
            } @else {
              <app-supplier-grid
                [suppliers]="store.supplierRows()"
                [viewMode]="store.viewMode()"
                [favouriteIds]="favs.suppliers()"
                (favouriteToggled)="favs.toggle('supplier', $event)"
              />
              @if (store.suppliersHasMore()) {
                <div class="mt-6 flex justify-center">
                  <button type="button" class="bp-btn-outline" (click)="store.showMore()">Show more</button>
                </div>
              }
            }
          } @else if (store.loadingFirstPage()) {
            <p class="bp-body-small text-secondary">Loading…</p>
          } @else if (store.itemsRes.error()) {
            <p class="bp-body-small text-warn">Couldn't load the marketplace.</p>
          } @else if (store.items().length === 0) {
            <p class="bp-body-small text-secondary">No items match — try a different search or category.</p>
          } @else {
            <app-catalogue-grid
              [items]="store.items()"
              [viewMode]="store.viewMode()"
              [selectedId]="store.itemId()"
              [favouriteIds]="favs.items()"
              (entitySelected)="onItemClicked($event)"
              (favouriteToggled)="favs.toggle('item', $event)"
            />
            @if (store.hasMore()) {
              <div class="mt-6 flex justify-center">
                <button type="button" class="bp-btn-outline" [disabled]="store.loadingMore()" (click)="store.showMore()">
                  {{ store.loadingMore() ? 'Loading…' : 'Show more' }}
                </button>
              </div>
            }
          }
        </div>

        <app-right-rail rail />
      </app-catalogue-layout>
    </div>
  `,
})
export class MarketplacePageComponent {
  protected readonly store = inject(MarketplaceStore);
  protected readonly favs = inject(FavouritesStore);

  protected readonly modeTabs: TabBandTab[] = [
    { key: 'items', label: 'Items' },
    { key: 'suppliers', label: 'Suppliers' },
  ];
  private readonly pageConfig = inject(PageConfigService);

  /** Hero rides the standard per-page settings (HERO ONLY — v1's other
   *  marketplace view settings deliberately ignored, Liam 2026-06-12);
   *  /settings/pages overrides win, defaults below. */
  protected readonly heroTitle = computed(() => this.pageConfig.marketplaceTitle() || 'Marketplace');
  protected readonly heroSubtitle = computed(
    () =>
      this.pageConfig.marketplaceSubtitle() ||
      'Browse suppliers, products and services to build your project.'
  );

  /** "All Categories" count = sum of the rail counts (matches the grid's
   *  unfiltered total without an extra request). */
  protected allItemsCount(): number {
    return this.store.categories().reduce((sum, c) => sum + c.count, 0);
  }

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

  protected onItemClicked(id: string): void {
    // Toggle: clicking the selected card clears the selection.
    this.store.selectItem(this.store.itemId() === id ? null : id);
  }
}
