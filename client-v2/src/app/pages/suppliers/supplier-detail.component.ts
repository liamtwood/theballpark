import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { LucideAngularModule } from 'lucide-angular';
import { CatalogueService } from '../../core/marketplace/catalogue.service';
import { FavouritesStore } from '../../core/marketplace/favourites.store';
import { MarketplaceStore } from '../marketplace/marketplace-store';
import { RightRailComponent } from '../marketplace/rail/right-rail.component';
import { CatalogueGridComponent } from '../../shared/catalogue/catalogue-grid.component';
import { CatalogueLayoutComponent } from '../../shared/catalogue/catalogue-layout.component';
import { CategoryStripComponent } from '../../shared/catalogue/category-strip.component';
import { SupplierDetail } from '../../shared/catalogue/catalogue.types';
import { ViewToggleComponent } from '../../shared/catalogue/view-toggle.component';
import { StorefrontPanelComponent } from './storefront-panel.component';
import { PageHeroComponent } from '../../shell/page-hero/page-hero.component';
import { TabBandComponent, TabBandTab } from '../../shared/tab-band/tab-band.component';

/** pV2-06d — /suppliers/:id (the v1.65dm supplier detail, decomposed):
 *  hero (name + city + favourite heart + tab band) over two tabs —
 *  STOREFRONT (brand panel, category chips with counts, contact card) and
 *  STORE: the SAME engine + store + rail the marketplace mounts
 *  (v2.15b chat-audit fix — MarketplaceStore is PROVIDED here with its
 *  pinned-supplier scope from :id; the mini-store duplication is gone).
 *  Tab + drill live in the URL (?tab=store&cat=&item=). */
@Component({
  selector: 'app-supplier-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideAngularModule,
    PageHeroComponent,
    TabBandComponent,
    CatalogueGridComponent,
    CatalogueLayoutComponent,
    CategoryStripComponent,
    RightRailComponent,
    StorefrontPanelComponent,
    ViewToggleComponent,
  ],
  providers: [MarketplaceStore],
  host: { class: 'block' },
  template: `
    @if (detail.value(); as sup) {
      <app-page-hero [back]="{ label: 'Marketplace', href: '/marketplace' }" [title]="sup.name" [subtitle]="sup.city ?? ''">
        <div hero-actions class="flex items-center gap-3">
          <button
            type="button"
            class="bp-fav-btn !static"
            [class.bp-fav-btn--on]="favs.suppliers().has(sup.id)"
            [attr.aria-label]="'Favourite ' + sup.name"
            (click)="favs.toggle('supplier', sup.id)"
          >
            <lucide-icon name="heart" [size]="15" />
          </button>
          <app-tab-band [tabs]="tabs" [active]="tab()" (activeChange)="setTab($event)" />
        </div>
      </app-page-hero>

      <div class="bp-page-body">
        @if (tab() === 'storefront') {
          <app-storefront-panel [supplier]="sup" (categorySelected)="openStore($event)" />
        } @else {
          <!-- STORE — the marketplace engine, pinned to this supplier. -->
          <app-catalogue-layout>
            <app-category-strip
              strip
              [categories]="storeCategories(sup)"
              [activeId]="store.categoryId()"
              [totalCount]="supplierTotal(sup)"
              (categorySelected)="store.setCategory($event)"
            />

            <div class="mb-4 flex justify-end">
              <app-view-toggle [active]="store.viewMode()" (activeChange)="store.setViewMode($event)" />
            </div>
            @if (store.items().length === 0 && !store.itemsRes.isLoading()) {
              <p class="bp-body-small text-secondary">No items.</p>
            } @else {
              <app-catalogue-grid
                [items]="store.items()"
                [viewMode]="store.viewMode()"
                [selectedId]="store.itemId()"
                [favouriteIds]="favs.items()"
                (entitySelected)="toggleItem($event)"
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

            <app-right-rail rail />
          </app-catalogue-layout>
        }
      </div>
    } @else if (detail.error()) {
      <div class="bp-page-body"><p class="bp-body-small text-warn">Supplier not found.</p></div>
    } @else {
      <div class="bp-page-body"><p class="bp-body-small text-secondary">Loading…</p></div>
    }
  `,
})
export class SupplierDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly catalogue = inject(CatalogueService);
  protected readonly favs = inject(FavouritesStore);
  /** The SAME store class the marketplace provides — pinned via :id. */
  protected readonly store = inject(MarketplaceStore);

  protected readonly tabs: TabBandTab[] = [
    { key: 'storefront', label: 'Storefront' },
    { key: 'store', label: 'Store' },
  ];

  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  protected readonly tab = computed(() => (this.query().get('tab') === 'store' ? 'store' : 'storefront'));

  /** Skips entirely until :id resolves — no empty-id fetch (audit C1). */
  protected readonly detail = resource({
    params: () => this.store.pinnedSupplierId() ?? undefined,
    loader: ({ params }) => this.catalogue.supplierDetail(params),
  });

  protected setTab(tab: string): void {
    this.router
      .navigate([], {
        relativeTo: this.route,
        queryParams: { tab: tab === 'store' ? 'store' : null, cat: null, item: null },
        queryParamsHandling: 'merge',
      })
      .catch((err) => console.warn('[SupplierDetail] navigation failed', err));
  }

  protected openStore(catId: string | null): void {
    this.router
      .navigate([], {
        relativeTo: this.route,
        queryParams: { tab: 'store', cat: catId, item: null },
        queryParamsHandling: 'merge',
      })
      .catch((err) => console.warn('[SupplierDetail] navigation failed', err));
  }

  protected toggleItem(id: string): void {
    this.store.selectItem(this.store.itemId() === id ? null : id);
  }

  /** The strip wants CategoryInfo-ish rows — adapt the detail's counts. */
  protected storeCategories(sup: SupplierDetail) {
    return sup.categories.map((c) => ({
      id: c.id,
      name: c.name,
      count: c.count,
      tagline: null,
      iconName: null,
      isActive: true,
      sortOrder: null,
    }));
  }

  protected supplierTotal(sup: SupplierDetail): number {
    return sup.categories.reduce((sum, c) => sum + c.count, 0);
  }

}
