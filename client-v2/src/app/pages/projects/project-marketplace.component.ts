import { ChangeDetectionStrategy, Component, computed, inject, input, resource, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MessageService } from 'primeng/api';
import { MarketplaceStore } from '../marketplace/marketplace-store';
import { CatalogueFilterBandComponent } from '../../shared/catalogue/filter-band.component';
import { CatalogueGridComponent } from '../../shared/catalogue/catalogue-grid.component';
import { CategoryStripComponent } from '../../shared/catalogue/category-strip.component';
import { SupplierGridComponent } from '../../shared/catalogue/supplier-grid.component';
import { TabBandComponent, TabBandTab } from '../../shared/tab-band/tab-band.component';
import { FavouritesStore } from '../../core/marketplace/favourites.store';
import { ProjectService } from '../../core/projects/project.service';
import { QuoteLine } from '../../core/projects/project.types';
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
          [hideAll]="store.mode() === 'suppliers'"
          [activeId]="store.categoryId()"
          [totalCount]="allItemsCount()"
          [subcategories]="store.mode() === 'items' ? store.subcategories() : []"
          [activeSubId]="store.subcategoryId()"
          (categorySelected)="store.setCategory($event)"
          (subcategorySelected)="store.setSubcategory($event)"
        />
      </div>

      <div class="min-h-0 min-w-0 xl:overflow-y-auto xl:pr-1">
        @if (store.mode() === 'suppliers') {
          @if (!store.categoryId()) {
            <p class="bp-body-small text-secondary">
              Select one of your project's categories on the left to see the suppliers who serve it — then add them to the quote.
            </p>
          } @else if (store.suppliersRes.isLoading() && store.supplierRows().length === 0) {
            <p class="bp-body-small text-secondary">Loading…</p>
          } @else if (store.supplierRows().length === 0) {
            <p class="bp-body-small text-secondary">No suppliers serve this category yet.</p>
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
  private readonly toast = inject(MessageService);

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
    const ids = new Set(this.quoteLines().map((l) => l.categoryId).filter(Boolean));
    return this.store.categories().filter((c) => ids.has(c.id));
  });

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
    } catch (err) {
      this.quoteLines.set(before);
      this.toast.add({ severity: 'error', summary: "Couldn't update the quantity — please try again.", detail: errorDetail(err), life: 4000 });
    }
  }

  protected onCheckout(): void {
    this.toast.add({ severity: 'info', summary: 'The final quote & checkout land in the next arc (pV2-06f).', life: 4000 });
  }
}
