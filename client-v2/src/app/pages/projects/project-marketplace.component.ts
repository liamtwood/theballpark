import { ChangeDetectionStrategy, Component, computed, inject, input, resource, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MessageService } from 'primeng/api';
import { MarketplaceStore } from '../marketplace/marketplace-store';
import { CatalogueFilterBandComponent } from '../../shared/catalogue/filter-band.component';
import { CatalogueGridComponent } from '../../shared/catalogue/catalogue-grid.component';
import { CategoryStripComponent } from '../../shared/catalogue/category-strip.component';
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
    <app-catalogue-filter-band [showSupplier]="true" />

    <div class="grid min-h-0 flex-1 grid-cols-1 gap-6 xl:grid-cols-[210px_1fr_320px]">
      <div class="hidden min-h-0 xl:block xl:overflow-y-auto">
        <app-category-strip
          [categories]="store.categories()"
          [activeId]="store.categoryId()"
          [totalCount]="allItemsCount()"
          [subcategories]="store.subcategories()"
          [activeSubId]="store.subcategoryId()"
          (categorySelected)="store.setCategory($event)"
          (subcategorySelected)="store.setSubcategory($event)"
        />
      </div>

      <div class="min-h-0 min-w-0 xl:overflow-y-auto xl:pr-1">
        @if (store.loadingFirstPage()) {
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

  /** "All Categories" count = sum of the rail counts (no extra request). */
  protected allItemsCount(): number {
    return this.store.categories().reduce((sum, c) => sum + c.count, 0);
  }

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
