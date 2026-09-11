import { ChangeDetectionStrategy, Component, computed, inject, input, resource, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MessageService } from 'primeng/api';
import { MarketplaceStore } from '../marketplace/marketplace-store';
import { CatalogueService } from '../../core/marketplace/catalogue.service';
import { CatalogueSupplier, CatalogueItem } from '../../shared/catalogue/catalogue.types';
import { QuickViewDialogComponent } from '../marketplace/quick-view-dialog.component';
import { CatalogueGridComponent } from '../../shared/catalogue/catalogue-grid.component';
import { CategoryStripComponent } from '../../shared/catalogue/category-strip.component';
import { SupplierGridComponent } from '../../shared/catalogue/supplier-grid.component';
import { ProjectMarketplaceControlsComponent } from './project-marketplace-controls.component';
import { ScrollPeekComponent } from '../../shared/scroll-peek/scroll-peek.component';
import { FavouritesStore } from '../../core/marketplace/favourites.store';
import { ProjectService } from '../../core/projects/project.service';
import { EstimateBreakdown, QuoteLine } from '../../core/projects/project.types';
import { errorDetail } from '../../core/http-error';
// ProjectQuoteRailComponent import intentionally removed while the rail is
// hidden (may return as a dialog) — the quote state/handlers stay in the class.

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
    ProjectMarketplaceControlsComponent,
    ScrollPeekComponent,
    CategoryStripComponent,
    CatalogueGridComponent,
    SupplierGridComponent,
    QuickViewDialogComponent,
  ],
  providers: [MarketplaceStore],
  /* Viewport-fit, independent column scroll — same structure as the global
     marketplace (catalogue-layout): filter band anchored, three columns
     each scroll within themselves. The quote rail is ALWAYS visible (a
     cart, not the hide-in-card preview), so this is a bespoke 3-col grid
     rather than catalogue-layout's slot. */
  host: { class: 'flex min-h-0 flex-1 flex-col' },
  template: `
    <!-- One rounded white container holds EVERYTHING (search + both rails),
         centred + gutter-reserved so its edges line up with the header. The
         search stays fixed at the top; only the rails scroll inside. -->
    <div class="min-h-0 flex-1 bp-gutter px-6 pt-1">
      <div class="mx-auto flex h-full min-h-0 w-full max-w-[var(--workspace-max)] flex-col overflow-hidden rounded-[28px] border border-hairline bg-surface shadow-[var(--shadow-xs)]">
        <!-- Search + the 3-icon cluster (Type / Filter / View), fixed at top. -->
        <div class="shrink-0 p-4 pb-3">
          <app-project-marketplace-controls class="block" />
        </div>
        <!-- Rails: cats fixed (no scrollbar — a down-arrow peek) + items scroll,
             so there's a single visible scrollbar (the items). -->
        <div class="flex min-h-0 flex-1 gap-6 px-4 pb-4">
          <div class="hidden w-[210px] shrink-0 min-h-0 xl:block">
            <!-- White card for the categories (strip internals unchanged).
                 Plain card, not the bp-card class (its display:block would beat
                 the flex column). -->
            <div class="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-hairline bg-surface p-2">
              <app-scroll-peek class="min-h-0 flex-1">
                <app-category-strip
                  [categories]="stripCategories()"
                  [activeId]="store.categoryId()"
                  [totalCount]="store.mode() === 'suppliers' ? scopedTotal() : allItemsCount()"
                  [subcategories]="store.mode() === 'items' ? stripSubcategories() : []"
                  [activeSubId]="store.subcategoryId()"
                  (categorySelected)="store.setCategory($event)"
                  (subcategorySelected)="store.setSubcategory($event)"
                />
              </app-scroll-peek>
            </div>
          </div>

          <div class="min-h-0 min-w-0 flex-1 overflow-y-auto">
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
            [showQuickView]="true"
            [dense]="true"
            (entitySelected)="openQuickView($event)"
            (quickView)="openQuickView($event)"
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

      <!-- Project Quote rail hidden for now (may move to a dialog). The quote
           state + handlers below (quoteLines/est/onQtyChange/onCheckout) are
           kept for that dialog; the card + still adds to the quote. TODO(quote-dialog). -->
        </div>
      </div>
    </div>

    <!-- Quick View — inside a project, "Add to ballpark" adds straight to
         THIS project's quote (no picker). -->
    <app-quick-view-dialog
      [item]="quickItem()"
      (close)="quickItem.set(null)"
      (add)="onQuickAdd($event)"
    />
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

  /** The item whose Quick View dialog is open (null = closed). */
  protected readonly quickItem = signal<CatalogueItem | null>(null);

  protected openQuickView(itemId: string): void {
    this.quickItem.set(this.store.items().find((i) => i.id === itemId) ?? null);
  }

  /** Quick View "Add to ballpark" → add to THIS project's quote (no picker).
   *  No-op with a note if it's already in the quote (toggle would remove it). */
  protected onQuickAdd(itemId: string): void {
    this.quickItem.set(null);
    if (this.quoteIds().has(itemId)) {
      this.toast.add({ severity: 'info', summary: 'Already in the ballpark.', life: 3000 });
      return;
    }
    void this.onQuoteToggle(itemId);
  }

  /** "All Categories" count = sum of the rail counts (no extra request). */
  protected readonly allItemsCount = computed(() =>
    this.store.categories().reduce((sum, c) => sum + c.count, 0)
  );

  /** The category set in the strip. Items mode = the full catalogue;
   *  Suppliers mode = only the categories present in this project's quote,
   *  so the agent fans out to project-relevant suppliers only. */
  protected readonly stripCategories = computed(() => {
    // Hide empty categories (no items) in the project Marketplace.
    const withItems = this.store.categories().filter((c) => c.count > 0);
    if (this.store.mode() !== 'suppliers') return withItems;
    const ids = this.quoteCategoryIds();
    return withItems.filter((c) => ids.has(c.id));
  });

  /** Subcategories with at least one item — empties hidden from the rail. */
  protected readonly stripSubcategories = computed(() =>
    this.store.subcategories().filter((s) => s.count > 0),
  );

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
