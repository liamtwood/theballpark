import { Injectable, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { CatalogueService } from '../../core/marketplace/catalogue.service';
import {
  CatalogueItem,
  CategoryInfo,
  RailMode,
  SupplierOption,
  ViewMode,
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

  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  // ── Selection (URL) ──────────────────────────────────────────────────
  readonly categoryId = computed(() => this.query().get('cat'));
  readonly search = computed(() => this.query().get('q') ?? '');
  readonly viewMode = computed<ViewMode>(() => asViewMode(this.query().get('view')));
  readonly itemId = computed(() => this.query().get('item'));

  // pV2-06c filters (URL: ?price= bracket key, ?tier=, ?sup=)
  readonly priceBracket = computed(() => this.query().get('price'));
  readonly tier = computed(() => asTier(this.query().get('tier')));
  readonly supplierId = computed(() => this.query().get('sup'));
  readonly hasFilters = computed(
    () => !!(this.priceBracket() || this.tier() || this.supplierId())
  );

  /** The filter signature — offset + accumulation reset on ANY change. */
  private readonly filterKey = computed(
    () =>
      `${this.categoryId() ?? ''}|${this.search()}|${this.priceBracket() ?? ''}|${this.tier() ?? ''}|${this.supplierId() ?? ''}`
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
        q: this.search() || null,
        priceMin: bracket?.min ?? null,
        priceMax: bracket?.max ?? null,
        tier: this.tier(),
        supplier: this.supplierId(),
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
    this.merge({ cat: id, item: null });
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
  clearFilters(): void {
    this.merge({ price: null, tier: null, sup: null, item: null });
  }
  showMore(): void {
    // Next page starts where the accumulated list ends.
    this.offset.set(this.items().length);
  }

  private merge(queryParams: Record<string, string | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}
