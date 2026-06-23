import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { CatalogueService } from '../../core/marketplace/catalogue.service';
import { FavouritesStore } from '../../core/marketplace/favourites.store';
import { MarketplaceStore } from '../marketplace/marketplace-store';
import { RightRailComponent } from '../marketplace/rail/right-rail.component';
import { CatalogueGridComponent } from '../../shared/catalogue/catalogue-grid.component';
import { CatalogueFilterBandComponent } from '../../shared/catalogue/filter-band.component';
import { CatalogueLayoutComponent } from '../../shared/catalogue/catalogue-layout.component';
import { CategoryStripComponent } from '../../shared/catalogue/category-strip.component';
import { SupplierDetail, SupplierSubcategory } from '../../shared/catalogue/catalogue.types';
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
    RouterLink,
    LucideAngularModule,
    PageHeroComponent,
    TabBandComponent,
    CatalogueGridComponent,
    CatalogueLayoutComponent,
    CategoryStripComponent,
    RightRailComponent,
    CatalogueFilterBandComponent,
    StorefrontPanelComponent,
  ],
  providers: [MarketplaceStore],
  /* Both tabs are viewport-fit: the hero + Storefront/Store toggle stay
     anchored and only the content from the banner down scrolls (Liam QC
     2026-06-22). Store scrolls per-column inside catalogue-layout; Storefront
     scrolls its own single column (overflow-y on .bp-page-body below). md+
     only — mobile keeps the natural page scroll (the .bp-vpfit media query). */
  host: { class: 'block bp-vpfit' },
  template: `
    @if (detail.value(); as sup) {
      <app-page-hero [back]="heroBack()" [title]="sup.name" [subtitle]="sup.city ?? ''">
        <div hero-actions class="flex items-center gap-3">
          @if (isOwner()) {
            <!-- pV2-STORE-01 — owner manages their own shop here. -->
            <a routerLink="/store/items/new" class="bp-btn-grad">
              <lucide-icon name="plus" [size]="15" /> Add product
            </a>
          } @else {
            <button
              type="button"
              class="bp-fav-btn !static"
              [class.bp-fav-btn--on]="favs.suppliers().has(sup.id)"
              [attr.aria-label]="'Favourite ' + sup.name"
              (click)="favs.toggle('supplier', sup.id)"
            >
              <lucide-icon name="heart" [size]="15" />
            </button>
          }
        </div>
      </app-page-hero>

      <!-- Storefront / Store toggle — above the banner, centred (pV2-MEDIA-01e QC).
           The OWNER's shop is items-only (pV2-STORE-01): their shopfront now
           lives on /settings/profile, so the toggle hides and Store shows. -->
      @if (!isOwner()) {
        <div class="flex justify-center px-6 pt-4">
          <app-tab-band [tabs]="tabs" [active]="tab()" (activeChange)="setTab($event)" />
        </div>
      }

      <div class="bp-page-body" [class.overflow-y-auto]="tab() === 'storefront'">
        @if (tab() === 'storefront') {
          <app-storefront-panel
            [supplier]="sup"
            [subcategories]="subcats.value() ?? []"
            (subcategorySelected)="openStoreSubcat($event)"
          />
        } @else {
          <!-- STORE — the marketplace engine, pinned to this supplier. -->
          <!-- The shared search/filter band (RP-06 extraction) — supplier
               select off (the store is already pinned to one). -->
          <app-catalogue-filter-band />
          <app-catalogue-layout>
            <app-category-strip
              strip
              [categories]="storeCategories(sup)"
              [activeId]="store.categoryId()"
              [totalCount]="supplierTotal(sup)"
              [subcategories]="store.subcategories()"
              [activeSubId]="store.subcategoryId()"
              (categorySelected)="store.setCategory($event)"
              (subcategorySelected)="store.setSubcategory($event)"
            />

            @if (store.items().length === 0 && !store.itemsRes.isLoading()) {
              <p class="bp-body-small text-secondary">No items.</p>
            } @else {
              <app-catalogue-grid
                [items]="store.items()"
                [viewMode]="store.viewMode()"
                [selectedId]="store.itemId()"
                [favouriteIds]="favs.items()"
                [quoteDraftIds]="favs.quoteDraft()"
                (entitySelected)="toggleItem($event)"
                (favouriteToggled)="favs.toggle('item', $event)"
                (quoteToggled)="favs.toggleQuoteDraft($event)"
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
  private readonly auth = inject(AuthService);
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

  /** The owner has no Storefront tab — their shop is items-only, so force Store. */
  protected readonly tab = computed(() =>
    this.isOwner() || this.query().get('tab') === 'store' ? 'store' : 'storefront'
  );

  /** Back walks the drill in reverse (QC): Store → Storefront (same route,
   *  params cleared by the hero's plain routerLink) → Marketplace. The owner
   *  (no storefront tab) goes straight back Home. */
  protected readonly heroBack = computed(() => {
    if (this.isOwner()) return { label: 'Home', href: '/home' };
    return this.tab() === 'store'
      ? { label: 'Storefront', href: `/suppliers/${this.store.pinnedSupplierId() ?? ''}` }
      : { label: 'Marketplace', href: '/marketplace' };
  });

  /** Skips entirely until :id resolves — no empty-id fetch (audit C1). */
  protected readonly detail = resource({
    params: () => this.store.pinnedSupplierId() ?? undefined,
    loader: ({ params }) => this.catalogue.supplierDetail(params),
  });

  /** Owner mode (pV2-STORE-01) — the viewer's own-org storefront. Unlocks
   *  "Add product" + per-item Edit; hides the favourite heart. */
  protected readonly isOwner = computed(() => {
    const id = this.store.pinnedSupplierId();
    return !!id && this.auth.user()?.activeOrgId === id;
  });

  /** The storefront's subcat-card grid rows (pV2-CARDS-01 QC #5). */
  protected readonly subcats = resource({
    params: () => this.store.pinnedSupplierId() ?? undefined,
    loader: ({ params }) => this.catalogue.supplierSubcategories(params),
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

  /** Subcat-card drill: Store tab pre-filtered to cat + sub (QC #5).
   *  Catch-all cards (items with no subcat) drill cat-only. */
  protected openStoreSubcat(sub: SupplierSubcategory): void {
    this.router
      .navigate([], {
        relativeTo: this.route,
        queryParams: {
          tab: 'store',
          cat: sub.parentId,
          sub: sub.isCatchAll ? null : sub.id,
          item: null,
        },
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

  protected categoryName(sup: SupplierDetail, id: string): string {
    return sup.categories.find((c) => c.id === id)?.name ?? '';
  }

  protected supplierTotal(sup: SupplierDetail): number {
    return sup.categories.reduce((sum, c) => sum + c.count, 0);
  }

}
