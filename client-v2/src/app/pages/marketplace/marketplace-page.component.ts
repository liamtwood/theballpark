import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { PageConfigService } from '../../core/config/page-config.service';
import { AddToProjectDialogComponent, AddToProjectItem } from './add-to-project-dialog.component';
import { QuickViewDialogComponent } from './quick-view-dialog.component';
import { CatalogueItem } from '../../shared/catalogue/catalogue.types';
import { PageHeroComponent } from '../../shell/page-hero/page-hero.component';
import { CategoryStripComponent } from '../../shared/catalogue/category-strip.component';
import { CatalogueGridComponent } from '../../shared/catalogue/catalogue-grid.component';
import { FavouritesStore } from '../../core/marketplace/favourites.store';
import { SupplierGridComponent } from '../../shared/catalogue/supplier-grid.component';
import { MarketplaceStore } from './marketplace-store';
import { MarketplaceWorkspaceComponent } from './marketplace-workspace.component';

/** pV2-06a — /marketplace: the browse foundation (MARKETPLACE.md five
 *  regions). Route shell only — mounts hero + search row + the three
 *  columns and wires the store to the engine. Items mode only (suppliers
 *  join in 06d); the right rail shows placeholder modes until 06b/e/f. */
@Component({
  selector: 'app-marketplace-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeroComponent,
    MarketplaceWorkspaceComponent,
    CategoryStripComponent,
    CatalogueGridComponent,
    SupplierGridComponent,
    ToastModule,
    AddToProjectDialogComponent,
    QuickViewDialogComponent,
  ],
  providers: [MarketplaceStore, MessageService],
  /* bp-vpfit (md+): the page fills the viewport exactly — hero + filter
     band anchored, the catalogue columns scroll independently. */
  host: { class: 'block bp-vpfit' },
  template: `
    <app-page-hero
      [eyebrow]="hero().eyebrow"
      [title]="hero().title"
      [subtitle]="hero().subtitle"
    />

    <div class="bp-page-body">
      <!-- SHARED marketplace chrome (same objects as the in-project tab):
           container + search/cluster + gray drill-down rail + dense grid. The
           "+" here opens the Add-to-project picker (vs the project tab's quote). -->
      <app-marketplace-workspace>
        <app-category-strip
          strip
          mode="drilldown"
          [categories]="stripCategories()"
          [activeId]="store.categoryId()"
          [totalCount]="allItemsCount()"
          [subcategories]="store.mode() === 'items' ? stripSubcategories() : []"
          [activeSubId]="store.subcategoryId()"
          (categorySelected)="store.setCategory($event)"
          (subcategorySelected)="store.setSubcategory($event)"
        />

        @if (store.mode() === 'suppliers') {
          @if (store.suppliersRes.isLoading() && store.supplierRows().length === 0) {
            <p class="bp-body-small text-secondary">Loading…</p>
          } @else if (store.supplierRows().length === 0) {
            <p class="bp-body-small text-secondary">No suppliers match.</p>
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
        } @else if (store.itemsRes.error()) {
          <p class="bp-body-small text-warn">Couldn't load the marketplace.</p>
        } @else if (store.items().length === 0) {
          <p class="bp-body-small text-secondary">No items match — try a different search or category.</p>
        } @else {
          <app-catalogue-grid
            [items]="store.items()"
            [viewMode]="store.viewMode()"
            [selectedId]="store.itemId()"
            [favouriteIds]="favs.items()"
            [quoteDraftIds]="favs.quoteDraft()"
            [showQuickView]="true"
            [dense]="true"
            (quickView)="openQuickView($event)"
            (entitySelected)="openQuickView($event)"
            (favouriteToggled)="favs.toggle('item', $event)"
            (quoteToggled)="openPicker($event)"
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
    </div>

    <!-- Quick View — opens on item click (Add → the project picker). -->
    <app-quick-view-dialog
      [item]="quickItem()"
      (close)="quickItem.set(null)"
      (add)="onQuickAdd($event)"
    />

    <!-- v1 feature (rebuilt): choose a project (or start new) to add the item. -->
    <app-add-to-project-dialog
      [item]="pickItem()"
      (close)="pickItem.set(null)"
      (added)="onAdded($event)"
    />
    <p-toast position="bottom-right" styleClass="bp-toast" />
  `,
})
export class MarketplacePageComponent {
  protected readonly store = inject(MarketplaceStore);
  protected readonly favs = inject(FavouritesStore);
  private readonly toast = inject(MessageService);

  /** The item whose Quick View dialog is open (null = closed). */
  protected readonly quickItem = signal<CatalogueItem | null>(null);

  /** The item whose "Add to project" picker is open (null = closed). */
  protected readonly pickItem = signal<AddToProjectItem | null>(null);

  /** Item click → Quick View dialog (replaces the right-rail selection). */
  protected openQuickView(itemId: string): void {
    this.quickItem.set(this.store.items().find((i) => i.id === itemId) ?? null);
  }

  /** Quick View "Add to ballpark" → close it, open the project picker. */
  protected onQuickAdd(itemId: string): void {
    this.quickItem.set(null);
    this.openPicker(itemId);
  }

  /** Open the project picker for the clicked item (standalone marketplace). */
  protected openPicker(itemId: string): void {
    const it = this.store.items().find((i) => i.id === itemId);
    if (!it) return;
    this.pickItem.set({ id: it.id, name: it.name, basePrice: it.basePrice, unit: it.unit });
  }

  protected onAdded(e: { projectId: string; itemName: string }): void {
    this.toast.add({
      severity: 'success',
      summary: `Added ${e.itemName} to the project.`,
      life: 4000,
    });
  }

  private readonly pageConfig = inject(PageConfigService);

  /** Hide empty categories/subcats in the rail — matches the in-project tab. */
  protected readonly stripCategories = computed(() => this.store.categories().filter((c) => c.count > 0));
  protected readonly stripSubcategories = computed(() => this.store.subcategories().filter((s) => s.count > 0));

  /** Hero rides the standard per-page settings (eyebrow / title / subtitle);
   *  /settings/pages overrides win over PAGE_HERO_DEFAULTS. HERO ONLY — v1's
   *  other marketplace view settings deliberately ignored (Liam 2026-06-12). */
  protected readonly hero = computed(() => this.pageConfig.pageHero('marketplace'));

  /** "All Categories" count = sum of the rail counts (matches the grid's
   *  unfiltered total without an extra request). */
  protected allItemsCount(): number {
    return this.store.categories().reduce((sum, c) => sum + c.count, 0);
  }
}
