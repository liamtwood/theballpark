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
          <div class="grid max-w-4xl grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
            <!-- Brand panel -->
            <section class="rounded-[var(--radius-card)] border border-hairline bg-surface p-6">
              <div class="flex items-center gap-3">
                <span class="bp-supplier-card__logo !h-10 !w-10 text-md">{{ initial(sup) }}</span>
                <span>
                  <span class="block text-md font-medium text-text">{{ sup.name }}</span>
                  <span class="bp-caption">{{ location(sup) }}</span>
                </span>
              </div>
              @if (sup.description) {
                <p class="bp-body mt-4 text-secondary">{{ sup.description }}</p>
              }

              @if (sup.categories.length) {
                <h3 class="bp-field-label mt-6 uppercase tracking-wide">Categories</h3>
                <div class="mt-2 flex flex-wrap gap-2">
                  @for (cat of sup.categories; track cat.id) {
                    <button type="button" class="bp-cat-chip" (click)="openStore(cat.id)">
                      {{ cat.name }}
                      <span class="bp-meta">{{ cat.count }}</span>
                    </button>
                  }
                </div>
              }
            </section>

            <!-- Contact card -->
            <section class="rounded-[var(--radius-card)] border border-hairline bg-surface p-6">
              <h3 class="bp-field-label uppercase tracking-wide">Contact info</h3>
              <dl class="mt-3 flex flex-col gap-3">
                @if (sup.address) {
                  <div class="flex items-start gap-2.5">
                    <lucide-icon name="map-pin" [size]="15" class="mt-0.5 text-muted" />
                    <dd class="bp-body-small text-secondary">{{ sup.address }}<br />{{ location(sup) }}</dd>
                  </div>
                }
                @if (sup.phone) {
                  <div class="flex items-center gap-2.5">
                    <lucide-icon name="phone" [size]="15" class="text-muted" />
                    <dd><a class="bp-body-small text-secondary hover:text-accent" [href]="'tel:' + sup.phone">{{ sup.phone }}</a></dd>
                  </div>
                }
                @if (sup.email) {
                  <div class="flex items-center gap-2.5">
                    <lucide-icon name="mail" [size]="15" class="text-muted" />
                    <dd><a class="bp-body-small text-secondary hover:text-accent" [href]="'mailto:' + sup.email">{{ sup.email }}</a></dd>
                  </div>
                }
                @if (sup.website) {
                  <div class="flex items-center gap-2.5">
                    <lucide-icon name="globe" [size]="15" class="text-muted" />
                    <dd><a class="bp-body-small break-all text-secondary hover:text-accent" [href]="sup.website" target="_blank" rel="noopener">{{ sup.website }}</a></dd>
                  </div>
                }
              </dl>
            </section>
          </div>
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

            @if (store.items().length === 0 && !store.itemsRes.isLoading()) {
              <p class="bp-body-small text-secondary">No items.</p>
            } @else {
              <app-catalogue-grid
                [items]="store.items()"
                viewMode="card"
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

  protected readonly detail = resource({
    params: () => this.store.pinnedSupplierId() ?? '',
    loader: ({ params }) => this.catalogue.supplierDetail(params),
  });

  protected setTab(tab: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'store' ? 'store' : null, cat: null, item: null },
      queryParamsHandling: 'merge',
    });
  }

  protected openStore(catId: string | null): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: 'store', cat: catId, item: null },
      queryParamsHandling: 'merge',
    });
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

  protected location(sup: SupplierDetail): string {
    return [sup.city, sup.country].filter((x): x is string => !!x).join(', ');
  }

  protected initial(sup: SupplierDetail): string {
    return (sup.name || '?').charAt(0).toUpperCase();
  }
}
