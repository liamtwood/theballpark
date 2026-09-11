import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { TooltipModule } from 'primeng/tooltip';
import { MarketplaceStore } from './marketplace-store';
import { CatalogueSearchComponent } from '../../shared/catalogue/catalogue-search.component';
import { ViewToggleComponent } from '../../shared/catalogue/view-toggle.component';
import { TabBandComponent, TabBandTab } from '../../shared/tab-band/tab-band.component';

/** Marketplace controls — a search box + a 3-icon cluster (same pill container
 *  as the view toggle). Each icon toggles INDEPENDENTLY (on/off), with a hover
 *  tooltip:
 *    • Item or supplier → the mode toggle appears on the LEFT below the search
 *    • Filter           → the filter row shows ABOVE the grid (rendered by the
 *                         workspace via store.filtersOpen — it belongs over the
 *                         first grid item, not here)
 *    • View             → the view toggle appears on the RIGHT below the search
 *  Store-driven — SHARED by the global marketplace page and the in-project tab. */
@Component({
  selector: 'app-marketplace-controls',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, TooltipModule, CatalogueSearchComponent, ViewToggleComponent, TabBandComponent],
  host: { class: 'block' },
  template: `
    <!-- Row 1: prominent full-width search + count + the 3-icon cluster. -->
    <div class="flex items-center gap-3">
      <div class="min-w-0 flex-1">
        <app-catalogue-search
          [large]="true"
          [value]="store.search()"
          [count]="store.total()"
          (valueChange)="store.setSearch($event)"
        />
      </div>

      <span class="bp-caption shrink-0 text-secondary">{{ store.total() }} items</span>

      <!-- Same container style as app-view-toggle. Each icon toggles on/off. -->
      <div class="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-hairline bg-surface p-1">
        <button type="button" class="bp-viewtoggle" [class.bp-viewtoggle--active]="typeOpen()"
          pTooltip="Item or supplier" tooltipStyleClass="bp-tooltip" tooltipPosition="top"
          aria-label="Item or supplier" (click)="typeOpen.set(!typeOpen())">
          <lucide-icon name="arrow-left-right" [size]="15" />
        </button>
        <button type="button" class="bp-viewtoggle" [class.bp-viewtoggle--active]="store.filtersOpen()"
          pTooltip="Filter" tooltipStyleClass="bp-tooltip" tooltipPosition="top"
          aria-label="Filter" (click)="store.filtersOpen.set(!store.filtersOpen())">
          <lucide-icon name="sliders-horizontal" [size]="15" />
        </button>
        <button type="button" class="bp-viewtoggle" [class.bp-viewtoggle--active]="viewOpen()"
          pTooltip="View" tooltipStyleClass="bp-tooltip" tooltipPosition="top"
          aria-label="View" (click)="viewOpen.set(!viewOpen())">
          <lucide-icon name="layout-grid" [size]="15" />
        </button>
      </div>
    </div>

    <!-- Row 2: Item/Supplier on the LEFT, View on the RIGHT (each independent). -->
    @if (typeOpen() || viewOpen()) {
      <div class="mt-3 flex items-center justify-between gap-3">
        <div>
          @if (typeOpen()) {
            <app-tab-band [tabs]="modeTabs()" [active]="store.mode()" (activeChange)="store.setMode($event)" />
          }
        </div>
        <div>
          @if (viewOpen()) {
            <app-view-toggle [active]="store.viewMode()" (activeChange)="store.setViewMode($event)" />
          }
        </div>
      </div>
    }
  `,
})
export class MarketplaceControlsComponent {
  protected readonly store = inject(MarketplaceStore);

  /** Independent on/off for the Type + View rows (Filter lives on the store so
   *  the workspace can render it above the grid). */
  protected readonly typeOpen = signal(false);
  protected readonly viewOpen = signal(false);

  /** Counts on the Type toggle (same circle badges as Current/Completed).
   *  Items = total catalogue items; Suppliers = distinct suppliers. 0 → no badge. */
  protected readonly modeTabs = computed<TabBandTab[]>(() => [
    { key: 'items', label: 'Items', badge: this.store.categories().reduce((s, c) => s + c.count, 0) || undefined },
    { key: 'suppliers', label: 'Suppliers', badge: this.store.supplierOptions().length || undefined },
  ]);
}
