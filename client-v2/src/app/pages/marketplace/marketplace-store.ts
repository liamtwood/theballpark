import { Injectable, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth/auth.service';
import { CatalogueService } from '../../core/marketplace/catalogue.service';
import {
  BrowseMode,
  CatalogueItem,
  CatalogueSupplier,
  CategoryInfo,
  RailMode,
  SupplierOption,
  ViewMode,
  asBrowseMode,
  asTier,
  asViewMode,
  bracketFor,
} from '../../shared/catalogue/catalogue.types';

/** pV2-06a — the marketplace browse store. ROUTE-scoped (provided by the
 *  route, never root — a future second catalogue context must not share
 *  state). URL is state: ?cat / ?q / ?view / ?item are the source of
 *  truth (shareable links, Back works); writers NAVIGATE, they never set
 *  selection signals directly. Pagination offset is the one local piece —
 *  it resets whenever the filter signature changes (linkedSignal) and
 *  grows via showMore(). */
@Injectable()
export class MarketplaceStore {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly catalogue = inject(CatalogueService);
  private readonly auth = inject(AuthService);

  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  /** CatalogueScope (architecture §2): when the host route carries a
   *  supplier :id (supplier-detail's Store tab), the store is PINNED to
   *  that supplier — items queries scope to it and suppliers mode stays
   *  idle. Provided per route, so each context gets its own instance.
   *
   *  Gated to the suppliers route (PROJECTS-02 fix): /projects/:id ALSO
   *  carries an :id, but that's a project, not a supplier — leaking it as
   *  a supplier filter emptied the inside-project grid. Only pin when the
   *  host route is actually suppliers/:id. */
  readonly pinnedSupplierId = computed(() => {
    const path = this.route.snapshot.routeConfig?.path ?? '';
    return path.startsWith('suppliers/') ? this.params().get('id') || null : null;
  });

  // ── Selection (URL) ──────────────────────────────────────────────────
  readonly categoryId = computed(() => this.query().get('cat') || null); // '' normalised
  readonly search = computed(() => this.query().get('q') ?? '');
  readonly viewMode = computed<ViewMode>(() => asViewMode(this.query().get('view')));
  readonly itemId = computed(() => this.query().get('item') || null);
  /** Items (default) or suppliers — the hero tab band (pV2-06d). */
  readonly mode = computed<BrowseMode>(() => asBrowseMode(this.query().get('mode')));

  /** Subcategory drill (?sub=) — only meaningful with a category set. */
  readonly subcategoryId = computed(() => this.query().get('sub') || null);

  // pV2-06c filters (URL: ?price= bracket key, ?tier=, ?sup=)
  readonly priceBracket = computed(() => this.query().get('price') || null);
  readonly tier = computed(() => asTier(this.query().get('tier')));
  readonly supplierId = computed(() => this.query().get('sup') || null);
  readonly hasFilters = computed(
    () => !!(this.priceBracket() || this.tier() || this.supplierId())
  );

  /** Owner store (pV2-STORE-01) — the viewer's OWN pinned store. Only here do
   *  the status/active filters apply; elsewhere they stay null (public grid). */
  readonly isOwnerStore = computed(() => {
    const id = this.pinnedSupplierId();
    return !!id && this.auth.user()?.activeOrgId === id;
  });
  /** Approval-status filter (owner only): all|draft|pending|approved|rejected. */
  readonly statusFilter = computed(() =>
    this.isOwnerStore() ? this.query().get('status') || 'all' : null
  );
  /** Publish-state filter (owner only). Defaults to `all` — the supplier sees
   *  their whole catalogue, then narrows to Active/Inactive. */
  readonly activeFilter = computed(() =>
    this.isOwnerStore() ? this.query().get('active') || 'all' : null
  );

  /** The filter signature — offset + accumulation reset on ANY change. */
  private readonly filterKey = computed(
    () =>
      `${this.pinnedSupplierId() ?? ''}|${this.mode()}|${this.categoryId() ?? ''}|${this.subcategoryId() ?? ''}|${this.search()}|${this.priceBracket() ?? ''}|${this.tier() ?? ''}|${this.supplierId() ?? ''}|${this.statusFilter() ?? ''}|${this.activeFilter() ?? ''}`
  );

  /** Local page offset; snaps back to 0 when the filters change. */
  private readonly offset = linkedSignal<string, number>({
    source: this.filterKey,
    computation: () => 0,
  });

  // ── Data ─────────────────────────────────────────────────────────────
  readonly categoriesRes = resource<CategoryInfo[], void>({
    loader: () => this.catalogue.categories(),
  });
  readonly categories = computed(() => this.categoriesRes.value() ?? []);

  /** The selected category's subcategory strip (cached reads; skips when
   *  no category is selected). */
  readonly subcategoriesRes = resource({
    params: () => this.categoryId() ?? undefined,
    loader: ({ params }) => this.catalogue.subcategories(params),
  });
  readonly subcategories = computed(() => this.subcategoriesRes.value() ?? []);

  /** Suppliers serving the selected category — the rail's CATEGORY mode
   *  (pV2-06e). ONE definition everywhere (Liam, 2026-06-12: the store
   *  rail shows the SAME card as the marketplace, suppliers list
   *  included — watch supplier sentiment on seeing competitors in their
   *  own store). Cached read; first page is plenty for a rail. */
  readonly categorySuppliersRes = resource({
    params: () => (this.categoryId() ? { cat: this.categoryId() } : undefined),
    // First page only by design — a read-only rail list (12 suppliers
    // total today; no-silent-caps note lives in the 06e ship report).
    loader: async ({ params }) => (await this.catalogue.suppliers(params)).items,
  });
  readonly categorySuppliers = computed(() => this.categorySuppliersRes.value() ?? []);

  readonly supplierOptionsRes = resource<SupplierOption[], void>({
    loader: () => this.catalogue.supplierOptions(),
  });
  readonly supplierOptions = computed(() => this.supplierOptionsRes.value() ?? []);

  /** Accumulated grid rows (page 0 replaces, later pages append — set by
   *  the loader, the established fetch-into-state pattern). */
  readonly items = signal<CatalogueItem[]>([]);
  readonly total = signal(0);
  readonly hasMore = signal(false);

  readonly itemsRes = resource({
    params: () => {
      const bracket = bracketFor(this.priceBracket());
      return {
        cat: this.categoryId(),
        sub: this.subcategoryId(),
        q: this.search() || null,
        priceMin: bracket?.min ?? null,
        priceMax: bracket?.max ?? null,
        tier: this.tier(),
        supplier: this.pinnedSupplierId() ?? this.supplierId(),
        // Owner-only — null elsewhere, so the public grid is unaffected.
        status: this.statusFilter() === 'all' ? null : this.statusFilter(),
        active: this.activeFilter() === 'all' ? null : this.activeFilter(),
        offset: this.offset(),
      };
    },
    loader: async ({ params }) => {
      const page = await this.catalogue.items(params);
      if (params.offset === 0) this.items.set(page.items);
      else this.items.update((list) => [...list, ...page.items]);
      this.total.set(page.total);
      this.hasMore.set(page.hasMore);
      return page;
    },
  });

  /** Suppliers mode data (pV2-06d) — same accumulate-by-offset shape.
   *  The resource SKIPS while mode=items (params → undefined). */
  readonly supplierRows = signal<CatalogueSupplier[]>([]);
  readonly suppliersTotal = signal(0);
  readonly suppliersHasMore = signal(false);

  readonly suppliersRes = resource({
    params: () =>
      this.mode() === 'suppliers' && !this.pinnedSupplierId()
        ? { cat: this.categoryId(), q: this.search() || null, offset: this.offset() }
        : undefined,
    loader: async ({ params }) => {
      const page = await this.catalogue.suppliers(params);
      if (params.offset === 0) this.supplierRows.set(page.items);
      else this.supplierRows.update((list) => [...list, ...page.items]);
      this.suppliersTotal.set(page.total);
      this.suppliersHasMore.set(page.hasMore);
      return page;
    },
  });

  /** First-page load only — appends keep the grid on screen. */
  readonly loadingFirstPage = computed(() => this.itemsRes.isLoading() && this.offset() === 0);
  readonly loadingMore = computed(() => this.itemsRes.isLoading() && this.offset() > 0);

  /** The selected entities (derived — selection NEVER fetches). */
  readonly selectedItem = computed(
    () => this.items().find((i) => i.id === this.itemId()) ?? null
  );
  readonly selectedCategory = computed(
    () => this.categories().find((c) => c.id === this.categoryId()) ?? null
  );

  /** Right-rail mode, derived from selection ('quote' joins in 06f). */
  readonly railMode = computed<RailMode>(() => {
    if (this.itemId() && this.selectedItem()) return 'item';
    if (this.categoryId()) return 'category';
    return 'empty';
  });

  // ── Writers (navigate — never set state) ─────────────────────────────
  setCategory(id: string | null): void {
    // Changing category invalidates the subcategory drill.
    this.merge({ cat: id, sub: null, item: null });
  }
  setSubcategory(id: string | null): void {
    this.merge({ sub: id, item: null });
  }
  setMode(mode: string): void {
    // Item-only filters don't apply to suppliers — drop them on switch.
    this.merge({
      mode: mode === 'suppliers' ? 'suppliers' : null,
      item: null,
      ...(mode === 'suppliers' ? { price: null, tier: null, sup: null } : {}),
    });
  }
  setSearch(q: string): void {
    this.merge({ q: q || null, item: null });
  }
  setViewMode(view: ViewMode): void {
    this.merge({ view: view === 'card' ? null : view });
  }
  selectItem(id: string | null): void {
    this.merge({ item: id });
  }
  setPriceBracket(key: string | null): void {
    this.merge({ price: key, item: null });
  }
  setTier(tier: string | null): void {
    this.merge({ tier: tier, item: null });
  }
  setSupplier(id: string | null): void {
    this.merge({ sup: id, item: null });
  }
  /** Owner store filters (pV2-STORE-01). `all`/default values clear the param. */
  setStatusFilter(status: string | null): void {
    this.merge({ status: status && status !== 'all' ? status : null, item: null });
  }
  setActiveFilter(active: string | null): void {
    this.merge({ active: active && active !== 'all' ? active : null, item: null });
  }
  clearFilters(): void {
    this.merge({ price: null, tier: null, sup: null, item: null });
  }
  showMore(): void {
    // Next page starts where the accumulated list ends (per mode).
    this.offset.set(
      this.mode() === 'suppliers' ? this.supplierRows().length : this.items().length
    );
  }

  private merge(queryParams: Record<string, string | null>): void {
    // Navigation rarely fails, but a silent failure leaves the UI lying
    // about its own URL state (audit L9) — log it.
    this.router
      .navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge' })
      .catch((err) => console.warn('[MarketplaceStore] navigation failed', err));
  }
}
