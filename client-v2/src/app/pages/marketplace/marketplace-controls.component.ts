import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { TooltipModule } from 'primeng/tooltip';
import { MarketplaceStore } from './marketplace-store';
import { CatalogueSearchComponent } from '../../shared/catalogue/catalogue-search.component';
import { ViewToggleComponent } from '../../shared/catalogue/view-toggle.component';
import { TabBandComponent, TabBandTab } from '../../shared/tab-band/tab-band.component';
import { MarketplaceFiltersComponent } from './marketplace-filters.component';

/** Marketplace controls — a search box + a single options icon next to it.
 *  Clicking the icon reveals ONE horizontal line below the search with Type
 *  (Items|Suppliers), Filter (price/tier/supplier) and View (card/list/table).
 *  Store-driven — SHARED by the global marketplace page and the in-project tab. */
@Component({
  selector: 'app-marketplace-controls',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, TooltipModule, CatalogueSearchComponent, ViewToggleComponent, TabBandComponent, MarketplaceFiltersComponent],
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

      <!-- One options icon; opens the Type / Filter / View row below. -->
      <div class="inline-flex items-center rounded-[var(--radius-pill)] border border-hairline bg-surface p-1">
        <button type="button" class="bp-viewtoggle" [class.bp-viewtoggle--active]="open()"
          pTooltip="Type, filter & view" tooltipStyleClass="bp-tooltip" tooltipPosition="top"
          aria-label="Type, filter and view options" (click)="open.set(!open())">
          <lucide-icon name="sliders-horizontal" [size]="15" />
        </button>
      </div>
    </div>

    <!-- Row 2: Type (left, cat-container width) · Filter (left-aligned with the
         first item card) · View (right) — each titled, all the same 40px control
         height. gap-6 matches the rails gap so Filter lines up over the grid. -->
    @if (open()) {
      <div class="mt-3 flex items-start gap-6">
        <div class="w-[210px] shrink-0">
          <span class="bp-field-label mb-1.5 block font-bold text-text">Type</span>
          <app-tab-band [tabs]="modeTabs" [active]="store.mode()" [fill]="true" [compact]="true" (activeChange)="store.setMode($event)" />
        </div>
        <div class="flex min-w-0 flex-1 items-start justify-between gap-4">
          <div>
            <span class="bp-field-label mb-1.5 block font-bold text-text">Filter</span>
            <app-marketplace-filters />
          </div>
          <div>
            <span class="bp-field-label mb-1.5 block font-bold text-text">View</span>
            <app-view-toggle [active]="store.viewMode()" (activeChange)="store.setViewMode($event)" />
          </div>
        </div>
      </div>
    }
  `,
})
export class MarketplaceControlsComponent {
  protected readonly store = inject(MarketplaceStore);

  /** One toggle: reveals the Type / Filter / View options line. */
  protected readonly open = signal(false);

  protected readonly modeTabs: TabBandTab[] = [
    { key: 'items', label: 'Items' },
    { key: 'suppliers', label: 'Suppliers' },
  ];
}
