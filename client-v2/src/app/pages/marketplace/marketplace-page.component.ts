import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { PageConfigService } from '../../core/config/page-config.service';
import { PageHeroComponent } from '../../shell/page-hero/page-hero.component';
import { CategoryStripComponent } from '../../shared/catalogue/category-strip.component';
import { CatalogueFilterBandComponent } from '../../shared/catalogue/filter-band.component';
import { CatalogueGridComponent } from '../../shared/catalogue/catalogue-grid.component';
import { CatalogueLayoutComponent } from '../../shared/catalogue/catalogue-layout.component';
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
    CategoryStripComponent,
    CatalogueFilterBandComponent,
    CatalogueGridComponent,
    CatalogueLayoutComponent,
    RightRailComponent,
    SupplierGridComponent,
    TabBandComponent,
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
      <!-- Search + filters + view toggle — the SHARED band (RP-06: every
           MarketplaceStore consumer mounts it). -->
      <app-catalogue-filter-band [showSupplier]="true" />

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

  protected onItemClicked(id: string): void {
    // Toggle: clicking the selected card clears the selection.
    this.store.selectItem(this.store.itemId() === id ? null : id);
  }
}
