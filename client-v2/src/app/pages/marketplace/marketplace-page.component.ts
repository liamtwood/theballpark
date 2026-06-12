import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { PageConfigService } from '../../core/config/page-config.service';
import { PageHeroComponent } from '../../shell/page-hero/page-hero.component';
import { CatalogueSearchComponent } from '../../shared/catalogue/catalogue-search.component';
import { CategoryStripComponent } from '../../shared/catalogue/category-strip.component';
import { CatalogueGridComponent } from '../../shared/catalogue/catalogue-grid.component';
import { EditFieldComponent, EditFieldOption } from '../../shared/edit-field/edit-field.component';
import { PRICE_BRACKETS, ViewMode } from '../../shared/catalogue/catalogue.types';
import { FavouritesStore } from '../../core/marketplace/favourites.store';
import { SupplierCardComponent } from '../../shared/catalogue/supplier-card.component';
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
    EditFieldComponent,
    RightRailComponent,
    SupplierCardComponent,
    TabBandComponent,
  ],
  providers: [MarketplaceStore],
  host: { class: 'block' },
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

        <div class="ml-auto flex items-center gap-1 rounded-[var(--radius-pill)] border border-hairline bg-surface p-1">
          @for (v of views; track v.mode) {
            <button
              type="button"
              class="bp-viewtoggle"
              [class.bp-viewtoggle--active]="store.viewMode() === v.mode"
              [attr.aria-label]="v.label"
              (click)="store.setViewMode(v.mode)"
            >
              <lucide-icon [name]="v.icon" [size]="15" />
            </button>
          }
        </div>
      </div>

      <!-- Three regions: category rail / grid / right rail -->
      <div class="grid grid-cols-[210px_1fr] gap-6 xl:grid-cols-[210px_1fr_300px]">
        <app-category-strip
          [categories]="store.categories()"
          [activeId]="store.categoryId()"
          [totalCount]="allItemsCount()"
          (categorySelected)="store.setCategory($event)"
        />

        <div class="min-w-0">
          @if (store.mode() === 'suppliers') {
            @if (store.suppliersRes.isLoading() && store.supplierRows().length === 0) {
              <p class="bp-body-small text-secondary">Loading…</p>
            } @else if (store.supplierRows().length === 0) {
              <p class="bp-body-small text-secondary">No suppliers match.</p>
            } @else {
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                @for (sup of store.supplierRows(); track sup.id) {
                  <app-supplier-card
                    [supplier]="sup"
                    [favourited]="favs.suppliers().has(sup.id)"
                    (favouriteToggled)="favs.toggle('supplier', $event)"
                  />
                }
              </div>
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

        <div class="hidden xl:block">
          <app-right-rail />
        </div>
      </div>
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

  protected readonly views: { mode: ViewMode; icon: string; label: string }[] = [
    { mode: 'card', icon: 'layout-grid', label: 'Card view' },
    { mode: 'list', icon: 'list', label: 'List view' },
    { mode: 'table', icon: 'table', label: 'Table view' },
  ];

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
