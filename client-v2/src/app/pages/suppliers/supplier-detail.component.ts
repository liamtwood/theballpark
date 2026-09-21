import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { CatalogueService } from '../../core/marketplace/catalogue.service';
import { FavouritesStore } from '../../core/marketplace/favourites.store';
import { MarketplaceStore } from '../marketplace/marketplace-store';
import { MarketplaceWorkspaceComponent } from '../marketplace/marketplace-workspace.component';
import { QuickViewDialogComponent } from '../marketplace/quick-view-dialog.component';
import { CatalogueGridComponent } from '../../shared/catalogue/catalogue-grid.component';
import { CategoryStripComponent } from '../../shared/catalogue/category-strip.component';
import { CatalogueItem, CategoryInfo, SupplierDetail, SupplierSubcategory } from '../../shared/catalogue/catalogue.types';
import { StorefrontPanelComponent } from './storefront-panel.component';
import { OrgProfileEditComponent } from '../settings/profile/org-profile-edit.component';
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
    CategoryStripComponent,
    MarketplaceWorkspaceComponent,
    QuickViewDialogComponent,
    StorefrontPanelComponent,
    OrgProfileEditComponent,
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
      <app-page-hero align="block" [eyebrow]="heroEyebrow()" [back]="heroBack()" [title]="sup.name" [subtitle]="sup.city ?? ''">
        <div hero-actions class="flex items-center gap-3">
          @if (isOwner()) {
            <!-- pV2-STORE-01 — owner manages their own shop here. -->
            <a routerLink="/store/items/new" class="bp-btn-grad">
              <lucide-icon name="plus" [size]="15" /> Add product
            </a>
          } @else if (isAgent()) {
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
          @if (isPlatformAdmin()) {
            <!-- pV2-ADMIN-ORG-PROFILE-EDIT-01 — a platform admin edits this org's
                 profile in place (save-on-blur); everyone else sees the read-only
                 storefront panel. -->
            <app-org-profile-edit [orgId]="store.pinnedSupplierId()" />
          } @else {
            <app-storefront-panel
              [supplier]="sup"
              [subcategories]="subcats.value() ?? []"
              (subcategorySelected)="openStoreSubcat($event)"
            />
          }
        } @else {
          <!-- STORE — the SHARED marketplace workspace, pinned to this supplier.
               Same chrome as the global + in-project marketplace; the controls
               self-hide the Items|Suppliers type + supplier filter when pinned. -->
          <app-marketplace-workspace>
            <app-category-strip
              strip
              mode="drilldown"
              [categories]="storeCategories(sup)"
              [activeId]="store.categoryId()"
              [totalCount]="supplierTotal(sup)"
              [subcategories]="storeSubcategories()"
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
                [showQuickView]="true"
                [dense]="true"
                (entitySelected)="openQuickView($event)"
                (quickView)="openQuickView($event)"
                (favouriteToggled)="favs.toggle('item', $event)"
                (quoteToggled)="favs.toggleQuoteDraft($event)"
                (changed)="store.reloadItems()"
              />
              @if (store.hasMore()) {
                <div class="mt-6 flex justify-center">
                  <button type="button" class="bp-btn-outline" [disabled]="store.loadingMore()" (click)="store.showMore()">
                    {{ store.loadingMore() ? 'Loading…' : 'Show more' }}
                  </button>
                </div>
              }
            }
          </app-marketplace-workspace>
        }
      </div>

      <!-- Item Quick View — a peek (no add-to-project here; buyers add via the
           card + / the global marketplace). -->
      <app-quick-view-dialog [item]="quickItem()" [showAdd]="false" (close)="quickItem.set(null)" />
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

  // pV2-ADMIN-ORGS — label-only rename (keys/URL ?tab= values unchanged to keep
  // deep links working): Storefront→Profile, Store→Shopfront.
  protected readonly tabs: TabBandTab[] = [
    { key: 'storefront', label: 'Profile' },
    { key: 'store', label: 'Shopfront' },
  ];

  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  /** The owner has no Storefront tab — their shop is items-only, so force Store. */
  protected readonly tab = computed(() =>
    this.isOwner() || this.query().get('tab') === 'store' ? 'store' : 'storefront'
  );

  /** Back walks the drill in reverse (QC): Store → Storefront (same route,
   *  params cleared by the hero's plain routerLink) → wherever you came from.
   *  The storefront leaf pops history so it returns to the actual entry point
   *  — the project supplier fan-out (with its category selected) or the
   *  global marketplace — rather than always /marketplace (INBOX-02 QC). The
   *  owner (no storefront tab) goes straight back Home. */
  protected readonly heroBack = computed(() => {
    if (this.isOwner()) return { label: 'Back', href: '/home', history: true };
    return this.tab() === 'store'
      ? { label: 'Back', href: `/suppliers/${this.store.pinnedSupplierId() ?? ''}`, history: true }
      : { label: 'Back', href: '/marketplace', history: true };
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

  /** Wishlist (favourite) is a buyer action — agency viewers only. */
  protected readonly isAgent = computed(() => this.auth.user()?.activeOrgType === 'agency');
  /** Platform admin (ballpark) — edits this org's Profile tab in place. */
  protected readonly isPlatformAdmin = computed(() => this.auth.user()?.activeOrgType === 'ballpark');

  /** Hero eyebrow (uppercased by the hero) — "My Shop" for the owner, else the
   *  public "Storefront". Mirrors the "Supplier workspace" eyebrow on overview. */
  protected readonly heroEyebrow = computed(() => (this.isOwner() ? 'My Shop' : 'Storefront'));

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

  /** The item whose Quick View dialog is open (null = closed). */
  protected readonly quickItem = signal<CatalogueItem | null>(null);

  protected openQuickView(itemId: string): void {
    this.quickItem.set(this.store.items().find((i) => i.id === itemId) ?? null);
  }

  /** Drill-down rail: the subcategories of the SELECTED macro, sourced from the
   *  ORG-SCOPED supplierSubcategories (not the global marketplace endpoint) so
   *  the rail counts match this supplier's item list (pV2-STORE-CAT-DISPLAY-01).
   *  Real subcats only, count-scoped (owner sees drafts too, server-side); the
   *  catch-all/uncategorised items surface at the macro level (cat-only list). */
  protected readonly storeSubcategories = computed<CategoryInfo[]>(() => {
    const cat = this.store.categoryId();
    return (this.subcats.value() ?? [])
      .filter((s) => !s.isCatchAll && s.parentId === cat && s.count > 0)
      .map((s) => ({
        id: s.id, name: s.name, count: s.count,
        tagline: null, iconName: null, isActive: true, sortOrder: null,
      }));
  });

  /** The strip wants CategoryInfo-ish rows — adapt the detail's counts, hiding
   *  empty categories (matches the marketplace drill-down rail). */
  protected storeCategories(sup: SupplierDetail) {
    return sup.categories
      .filter((c) => c.count > 0)
      .map((c) => ({
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
