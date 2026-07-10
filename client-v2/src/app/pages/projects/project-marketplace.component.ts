import { ChangeDetectionStrategy, Component, computed, inject, input, resource, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MessageService } from 'primeng/api';
import { MarketplaceStore } from '../marketplace/marketplace-store';
import { CatalogueService } from '../../core/marketplace/catalogue.service';
import { CatalogueSupplier } from '../../shared/catalogue/catalogue.types';
import { CatalogueFilterBandComponent } from '../../shared/catalogue/filter-band.component';
import { CatalogueGridComponent } from '../../shared/catalogue/catalogue-grid.component';
import { CategoryStripComponent } from '../../shared/catalogue/category-strip.component';
import { SupplierGridComponent } from '../../shared/catalogue/supplier-grid.component';
import { TabBandComponent, TabBandTab } from '../../shared/tab-band/tab-band.component';
import { FavouritesStore } from '../../core/marketplace/favourites.store';
import { ProjectService } from '../../core/projects/project.service';
import { EstimateBreakdown, QuoteLine } from '../../core/projects/project.types';
import { errorDetail } from '../../core/http-error';
import { ProjectQuoteRailComponent } from './project-quote-rail.component';

/** pV2-PROJECTS-02 slice 2 — the inside-project Marketplace tab. The SAME
 *  catalogue engine the global marketplace + supplier store mount (RP-06,
 *  third consumer: provides its own MarketplaceStore, reuses filter-band /
 *  category-strip / catalogue-grid / item-card). The right column is the
 *  persistent Project Quote rail (a cart always shows — so NOT the
 *  hide-in-card-view preview rail). The card + adds/removes THIS project's
 *  quote; the heart stays wishlist. */
@Component({
  selector: 'app-project-marketplace',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CatalogueFilterBandComponent,
    CategoryStripComponent,
    CatalogueGridComponent,
    SupplierGridComponent,
    TabBandComponent,
    ProjectQuoteRailComponent,
  ],
  providers: [MarketplaceStore],
  /* Viewport-fit, independent column scroll — same structure as the global
     marketplace (catalogue-layout): filter band anchored, three columns
     each scroll within themselves. The quote rail is ALWAYS visible (a
     cart, not the hide-in-card preview), so this is a bespoke 3-col grid
     rather than catalogue-layout's slot. */
  host: { class: 'flex min-h-0 flex-1 flex-col' },
  template: `
    <!-- Items / Suppliers — the same mode toggle the global marketplace
         uses. Suppliers mode is the per-category supplier fan-out, scoped
         to the project's quote categories (pV2-INBOX-02). -->
    <div class="flex justify-center pb-3">
      <app-tab-band [tabs]="modeTabs" [active]="store.mode()" (activeChange)="store.setMode($event)" />
    </div>

    <!-- Item filters only apply to the Items grid (the supplier filter is
         meaningless in supplier mode). -->
    @if (store.mode() === 'items') {
      <app-catalogue-filter-band [showSupplier]="true" />
    }

    <div class="grid min-h-0 flex-1 grid-cols-1 gap-6 xl:grid-cols-[210px_1fr_320px]">
      <div class="hidden min-h-0 xl:block xl:overflow-y-auto">
        <!-- Suppliers mode: the strip is scoped to the quote's categories
             (no "All" browse) so only project-relevant suppliers surface. -->
        <app-category-strip
          [categories]="stripCategories()"
          [activeId]="store.categoryId()"
          [totalCount]="store.mode() === 'suppliers' ? scopedTotal() : allItemsCount()"
          [subcategories]="store.mode() === 'items' ? store.subcategories() : []"
          [activeSubId]="store.subcategoryId()"
          (categorySelected)="store.setCategory($event)"
          (subcategorySelected)="store.setSubcategory($event)"
        />
      </div>

      <div class="min-h-0 min-w-0 xl:overflow-y-auto xl:pr-1">
        @if (store.mode() === 'suppliers') {
          @if (relevantSuppliersRes.isLoading()) {
            <p class="bp-body-small text-secondary">Loading…</p>
          } @else if (relevantSuppliers().length === 0) {
            <p class="bp-body-small text-secondary">
              No suppliers serve {{ store.categoryId() ? 'this category' : 'your project categories' }} yet.
            </p>
          } @else {
            <app-supplier-grid
              [suppliers]="relevantSuppliers()"
              [viewMode]="store.viewMode()"
              [favouriteIds]="favs.suppliers()"
              (favouriteToggled)="favs.toggle('supplier', $event)"
            />
          }
        } @else if (store.loadingFirstPage()) {
          <p class="bp-body-small text-secondary">Loading…</p>
        } @else if (store.items().length === 0) {
          <p class="bp-body-small text-secondary">No items match — try a different search or category.</p>
        } @else {
          <app-catalogue-grid
            [items]="store.items()"
            [viewMode]="store.viewMode()"
            [selectedId]="store.itemId()"
            [favouriteIds]="favs.items()"
            [quoteDraftIds]="quoteIds()"
            (entitySelected)="store.selectItem($event)"
            (favouriteToggled)="favs.toggle('item', $event)"
            (quoteToggled)="onQuoteToggle($event)"
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
      </div>

      <div class="min-h-0 xl:overflow-y-auto">
        <app-project-quote-rail
          [lines]="quoteLines()"
          [breakdown]="est.value() ?? null"
          (removed)="onQuoteToggle($event)"
          (qtyChanged)="onQtyChange($event.itemId, $event.quantity)"
          (checkout)="onCheckout()"
        />
      </div>
    </div>
  `,
})
export class ProjectMarketplaceComponent {
  protected readonly store = inject(MarketplaceStore);
  protected readonly favs = inject(FavouritesStore);
  private readonly projects = inject(ProjectService);
  private readonly catalogue = inject(CatalogueService);
  private readonly toast = inject(MessageService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly projectId = input.required<string>();

  protected readonly modeTabs: TabBandTab[] = [
    { key: 'items', label: 'Items' },
    { key: 'suppliers', label: 'Suppliers' },
  ];

  /** "All Categories" count = sum of the rail counts (no extra request). */
  protected readonly allItemsCount = computed(() =>
    this.store.categories().reduce((sum, c) => sum + c.count, 0)
  );

  /** The category set in the strip. Items mode = the full catalogue;
   *  Suppliers mode = only the categories present in this project's quote,
   *  so the agent fans out to project-relevant suppliers only. */
  protected readonly stripCategories = computed(() => {
    if (this.store.mode() !== 'suppliers') return this.store.categories();
    const ids = this.quoteCategoryIds();
    return this.store.categories().filter((c) => ids.has(c.id));
  });

  /** The distinct categories present in this project's quote. */
  private readonly quoteCategoryIds = computed(
    () => new Set(this.quoteLines().map((l) => l.categoryId).filter((id): id is string => !!id))
  );

  /** "All Categories" count in Suppliers mode = the relevant categories'
   *  item counts only (not the whole catalogue). */
  protected readonly scopedTotal = computed(() =>
    this.stripCategories().reduce((sum, c) => sum + c.count, 0)
  );

  /** Suppliers shown in the fan-out. A specific category → that category's
   *  suppliers; "All Categories" → the UNION across the quote's categories
   *  (project-relevant only, never the whole catalogue). The per-category
   *  reads are cached by the catalogue service, so the union is cheap.
   *  First page per category by design (the supplier set is small); a
   *  no-silent-cap note rides the ship report. */
  protected readonly relevantSuppliersRes = resource({
    params: () => {
      if (this.store.mode() !== 'suppliers') return undefined;
      const cat = this.store.categoryId();
      const cats = cat ? [cat] : [...this.quoteCategoryIds()];
      return cats.length ? cats : undefined;
    },
    loader: async ({ params: cats }) => {
      const pages = await Promise.all(cats.map((c) => this.catalogue.suppliers({ cat: c })));
      const byId = new Map<string, CatalogueSupplier>();
      for (const page of pages) {
        for (const s of page.items) {
          if (!byId.has(s.id)) byId.set(s.id, s);
        }
      }
      return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
    },
  });
  protected readonly relevantSuppliers = computed(() => this.relevantSuppliersRes.value() ?? []);

  protected readonly quoteLines = signal<QuoteLine[]>([]);
  protected readonly quoteIds = computed(() => new Set(this.quoteLines().map((l) => l.itemId)));

  private readonly loader = resource<QuoteLine[], string>({
    params: () => this.projectId(),
    loader: async ({ params }) => {
      const lines = await firstValueFrom(this.projects.quoteItems(params));
      this.quoteLines.set(lines);
      return lines;
    },
  });

  /** The SAME server cascade the Final Quote uses (scope 'all') — so the
   *  Project Quote total is always identical: install, contingency, margin and
   *  VAT, declined lines excluded. Reloaded after every add / remove / qty. */
  protected readonly est = resource<EstimateBreakdown, string>({
    params: () => this.projectId(),
    loader: ({ params }) => firstValueFrom(this.projects.estimate(params, 'all')),
  });

  /** + on a card, or the rail's remove — toggles the item in this project's
   *  quote (optimistic, revert on failure). */
  protected async onQuoteToggle(itemId: string): Promise<void> {
    const id = this.projectId();
    const before = this.quoteLines();
    const inQuote = this.quoteIds().has(itemId);
    try {
      if (inQuote) {
        this.quoteLines.update((ls) => ls.filter((l) => l.itemId !== itemId));
        await firstValueFrom(this.projects.removeQuoteItem(id, itemId));
      } else {
        const line = await firstValueFrom(this.projects.addQuoteItem(id, itemId));
        this.quoteLines.update((ls) => [...ls, line]);
      }
      this.est.reload();
    } catch (err) {
      this.quoteLines.set(before);
      this.toast.add({ severity: 'error', summary: "Couldn't update the quote — please try again.", detail: errorDetail(err), life: 4000 });
    }
  }

  /** Inline quantity edit on a quote line — optimistic, revert + toast on
   *  failure (pV2-QUANTITY-01). */
  protected async onQtyChange(itemId: string, quantity: number): Promise<void> {
    const id = this.projectId();
    const before = this.quoteLines();
    this.quoteLines.update((ls) => ls.map((l) => (l.itemId === itemId ? { ...l, quantity } : l)));
    try {
      await firstValueFrom(this.projects.setQuoteItemQuantity(id, itemId, quantity));
      this.est.reload();
    } catch (err) {
      this.quoteLines.set(before);
      this.toast.add({ severity: 'error', summary: "Couldn't update the quantity — please try again.", detail: errorDetail(err), life: 4000 });
    }
  }

  /** Rail's "See Final Project Quote" → the Final Quote tab (matches the CTA
   *  label; the Message Suppliers action lives there). */
  protected onCheckout(): void {
    this.router
      .navigate([], { relativeTo: this.route, queryParams: { tab: 'final' }, queryParamsHandling: 'merge' })
      .catch((err) => console.warn('[ProjectMarketplace] nav failed', err));
  }
}
