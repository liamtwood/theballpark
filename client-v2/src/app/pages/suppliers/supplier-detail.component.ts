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
import { WebsiteImportPanelComponent } from './website-import-panel.component';
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
    WebsiteImportPanelComponent,
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
      <!-- Brand header (pV2-STOREFRONT-MENU-01 / Liam 2026-09-25): on the Shopfront
           tab the supplier's cover image sits BEHIND the hero (name + city) and the
           tab band, so the header IS the brand banner. Other tabs render it plain. -->
      <div
        class="bp-supplier-brandhead"
        [class.bp-supplier-brandhead--cover]="brandCover(sup)"
        [style.background-image]="brandCoverUrl(sup)"
      >
        <app-page-hero align="block" [eyebrow]="heroEyebrow()" [back]="heroBack()" [title]="sup.name" [subtitle]="sup.city ?? ''">
          <div hero-actions class="flex items-center gap-3">
            @if (isOwner()) {
              <!-- pV2-STORE-01 — owner manages their own shop here. -->
              <a routerLink="/store/items/new" class="bp-btn-grad">
                <lucide-icon name="plus" [size]="15" /> Add product
              </a>
            } @else if (isPlatformAdmin() && tab() === 'store') {
              <!-- pV2-ADMIN-ORG-ITEM-CREATE-01 — admin adds a product FOR this org. -->
              <a [routerLink]="['/admin/orgs', store.pinnedSupplierId(), 'items', 'new']" class="bp-btn-grad">
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

        <!-- Storefront / Store toggle — centred (pV2-MEDIA-01e QC). The OWNER's shop
             is items-only (pV2-STORE-01): their shopfront now lives on
             /settings/profile, so the toggle hides and Store shows. -->
        @if (!isOwner()) {
          <div class="flex justify-center px-6 pt-4 pb-1">
            <app-tab-band [tabs]="tabs()" [active]="tab()" (activeChange)="setTab($event)" />
          </div>
        }
      </div>

      <div class="bp-page-body" [class.overflow-y-auto]="tab() !== 'store'">
        @if (tab() === 'profile') {
          <!-- Profile — editable org editor (save-on-blur). Owner/admin only. -->
          <app-org-profile-edit [orgId]="store.pinnedSupplierId()" />
        } @else if (tab() === 'storefront') {
          <!-- Shopfront — the read-only public brand page, for everyone. -->
          <app-storefront-panel
            [supplier]="sup"
            [subcategories]="subcats.value() ?? []"
            [items]="store.items()"
            [itemsLoading]="store.itemsRes.isLoading()"
            [hasMore]="store.hasMore()"
            [favouriteIds]="favs.items()"
            [quoteDraftIds]="favs.quoteDraft()"
            (subcategorySelected)="openStoreSubcat($event)"
            (browse)="openStoreBrowse($event)"
            (quickView)="openQuickView($event)"
            (favouriteToggled)="favs.toggle('item', $event)"
            (quoteToggled)="favs.toggleQuoteDraft($event)"
            (showMore)="store.showMore()"
            (gridChanged)="store.reloadItems()"
          />
        } @else if (tab() === 'ai') {
          <!-- AI Assist — admin-only catalogue extractor (Analyse → Prepare → Load).
               Items land pending → Approvals. Its own tab (was an inline block on the
               Shop tab) so the wizard + background-job progress have room to breathe. -->
          @if (isPlatformAdmin() && store.pinnedSupplierId(); as orgId) {
            <div class="bp-gutter px-6">
              <div class="mx-auto w-full max-w-[var(--workspace-max)]">
                <app-website-import-panel [orgId]="orgId" (pulled)="store.reloadItems()" />
              </div>
            </div>
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
              [subSubcategories]="storeSubSubcategories()"
              [activeSubSubId]="store.subSubcategoryId()"
              (categorySelected)="store.setCategory($event)"
              (subcategorySelected)="store.setSubcategory($event)"
              (subSubcategorySelected)="store.setSubSubcategory($event)"
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
                [adminEditOrgId]="isPlatformAdmin() ? store.pinnedSupplierId() : null"
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

  // pV2-SUPPLIER-TABS-3-01 — three surfaces: Profile (editable, owner/admin only),
  // Shopfront (read-only public brand page, everyone), My Shop/Shop (items grid).
  // Items label is "My Shop" for the owner, "Shop" for admin/agents.
  protected readonly tabs = computed<TabBandTab[]>(() => {
    const items: TabBandTab = { key: 'store', label: this.isOwner() ? 'My Shop' : 'Shop' };
    const shopfront: TabBandTab = { key: 'storefront', label: 'Shopfront' };
    // AI Assist — the catalogue extractor. Platform-admin ONLY (cross-org tooling);
    // a supplier viewing their own page never sees it.
    if (this.isPlatformAdmin()) {
      return [{ key: 'profile', label: 'Profile' }, shopfront, items, { key: 'ai', label: 'AI Assist' }];
    }
    return this.isOwner()
      ? [{ key: 'profile', label: 'Profile' }, shopfront, items]
      : [shopfront, items];
  });

  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  /** Active tab. Owner's own page is items-only (no band) → 'store', unchanged.
   *  Non-owner: explicit ?tab= wins (profile falls back to storefront for
   *  non-admins who have no editable surface); default landing = profile for a
   *  platform admin, else the public storefront (pV2-SUPPLIER-TABS-3-01). */
  protected readonly tab = computed(() => {
    if (this.isOwner()) return 'store';
    const q = this.query().get('tab');
    if (q === 'store' || q === 'storefront') return q;
    if (q === 'ai') return this.isPlatformAdmin() ? 'ai' : 'storefront';
    if (q === 'profile') return this.isPlatformAdmin() ? 'profile' : 'storefront';
    return this.isPlatformAdmin() ? 'profile' : 'storefront';
  });

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

  /** Shopfront + Shop tabs: the supplier's cover backs the brand header (name +
   *  tabs ride on top of it). Profile/AI Assist — and suppliers with no cover —
   *  render plain (a photo backdrop would fight the editor / extractor). */
  protected brandCover(sup: SupplierDetail): boolean {
    return (this.tab() === 'storefront' || this.tab() === 'store') && !!sup.coverUrl;
  }
  /** The cover as a CSS background-image value (spaces encoded — some imported
   *  cover URLs carry raw spaces that break the load). Null when no cover shows. */
  protected brandCoverUrl(sup: SupplierDetail): string | null {
    if (!this.brandCover(sup)) return null;
    const u = (sup.coverUrl ?? '').trim().replace(/ /g, '%20');
    return u ? `url("${u}")` : null;
  }

  /** Hero eyebrow (uppercased by the hero) — "My Shop" for the owner, else a
   *  stable "Supplier" (the three tabs now name the surface; a fixed "Storefront"
   *  eyebrow read oddly above a Profile/Shopfront/Shop band). */
  protected readonly heroEyebrow = computed(() => (this.isOwner() ? 'My Shop' : 'Supplier'));

  /** The storefront's subcat-card grid rows (pV2-CARDS-01 QC #5). */
  protected readonly subcats = resource({
    params: () => this.store.pinnedSupplierId() ?? undefined,
    loader: ({ params }) => this.catalogue.supplierSubcategories(params),
  });

  protected setTab(tab: string): void {
    // Explicit key for all three surfaces (profile / storefront / store) so deep
    // links are unambiguous; clear the store's cat/item drill on tab switch.
    this.router
      .navigate([], {
        relativeTo: this.route,
        queryParams: { tab, cat: null, item: null },
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

  /** Shopfront category menu drill (pV2-STOREFRONT-MENU-01): the mega-menu emits
   *  a resolved {categoryId, subcategoryId} (subcategoryId may be an L2 or an L3),
   *  so navigate the Store tab straight to it. Both null = "All items". */
  protected openStoreBrowse(e: { categoryId: string | null; subcategoryId: string | null }): void {
    // Stay on the shopfront (tab:'storefront') — set the store's cat/sub so it loads
    // this supplier's items, which the panel renders inline (pV2-STOREFRONT-MENU-01).
    this.router
      .navigate([], {
        relativeTo: this.route,
        queryParams: { tab: 'storefront', cat: e.categoryId, sub: e.subcategoryId, item: null },
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

  /** 3rd rail level — the selected subcategory's children the supplier has items
   *  in (the query emits every node in the item's chain, so an L3 node like
   *  "Chiavari Chair" appears with parentId = its L2). Drills only when non-empty. */
  protected readonly storeSubSubcategories = computed<CategoryInfo[]>(() => {
    const sub = this.store.subcategoryId();
    if (!sub) return [];
    return (this.subcats.value() ?? [])
      .filter((s) => !s.isCatchAll && s.parentId === sub && s.count > 0)
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
