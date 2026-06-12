import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { PageConfigService } from '../../core/config/page-config.service';
import { PageHeroComponent } from '../../shell/page-hero/page-hero.component';
import { CatalogueSearchComponent } from '../../shared/catalogue/catalogue-search.component';
import { CategoryStripComponent } from '../../shared/catalogue/category-strip.component';
import { CatalogueGridComponent } from '../../shared/catalogue/catalogue-grid.component';
import { ViewMode } from '../../shared/catalogue/catalogue.types';
import { MarketplaceStore } from './marketplace-store';
import { RightRailComponent } from './rail/right-rail.component';

/** pV2-06a — /marketplace: the browse foundation (MARKETPLACE.md five
 *  regions). Route shell only — mounts hero + search row + the three
 *  columns and wires the store to the engine. Items mode only (suppliers
 *  join in 06d); the right rail shows placeholder modes until 06b/e/f. */
@Component({
  selector: 'app-marketplace-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideAngularModule,
    PageHeroComponent,
    CatalogueSearchComponent,
    CategoryStripComponent,
    CatalogueGridComponent,
    RightRailComponent,
  ],
  providers: [MarketplaceStore],
  host: { class: 'block' },
  template: `
    <app-page-hero
      [back]="{ label: 'Back', href: '/home' }"
      [title]="heroTitle()"
      [subtitle]="heroSubtitle()"
    />

    <div class="bp-page-body">
      <!-- Search row: box + view toggle -->
      <div class="mb-5 flex items-center gap-3">
        <div class="w-full max-w-md">
          <app-catalogue-search
            [value]="store.search()"
            [count]="store.total()"
            (valueChange)="store.setSearch($event)"
          />
        </div>
        <div class="ml-auto flex items-center gap-1 rounded-[var(--radius-pill)] border border-hairline bg-surface p-1">
          @for (v of views; track v.mode) {
            <button
              type="button"
              class="bp-viewtoggle"
              [class.bp-viewtoggle--active]="store.viewMode() === v.mode"
              [attr.aria-label]="v.label"
              (click)="store.setViewMode(v.mode)"
            >
              <lucide-icon [name]="v.icon" [size]="15" />
            </button>
          }
        </div>
      </div>

      <!-- Three regions: category rail / grid / right rail -->
      <div class="grid grid-cols-[210px_1fr] gap-6 xl:grid-cols-[210px_1fr_300px]">
        <app-category-strip
          [categories]="store.categories()"
          [activeId]="store.categoryId()"
          [totalCount]="allItemsCount()"
          (categorySelected)="store.setCategory($event)"
        />

        <div class="min-w-0">
          @if (store.loadingFirstPage()) {
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
              (entitySelected)="onItemClicked($event)"
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

        <div class="hidden xl:block">
          <app-right-rail />
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .bp-viewtoggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        border: none;
        border-radius: var(--radius-pill);
        background: transparent;
        color: var(--color-text-secondary);
        cursor: pointer;
      }
      .bp-viewtoggle:hover {
        background: var(--color-fill);
      }
      .bp-viewtoggle--active {
        background: var(--theme-soft);
        color: var(--color-text);
      }
    `,
  ],
})
export class MarketplacePageComponent {
  protected readonly store = inject(MarketplaceStore);
  private readonly pageConfig = inject(PageConfigService);

  /** Hero rides the standard per-page settings (HERO ONLY — v1's other
   *  marketplace view settings deliberately ignored, Liam 2026-06-12);
   *  /settings/pages overrides win, defaults below. */
  protected readonly heroTitle = computed(() => this.pageConfig.marketplaceTitle() || 'Marketplace');
  protected readonly heroSubtitle = computed(
    () =>
      this.pageConfig.marketplaceSubtitle() ||
      'Browse suppliers, products and services to build your project.'
  );

  protected readonly views: { mode: ViewMode; icon: string; label: string }[] = [
    { mode: 'card', icon: 'layout-grid', label: 'Card view' },
    { mode: 'list', icon: 'list', label: 'List view' },
    { mode: 'table', icon: 'table', label: 'Table view' },
  ];

  /** "All Categories" count = sum of the rail counts (matches the grid's
   *  unfiltered total without an extra request). */
  protected allItemsCount(): number {
    return this.store.categories().reduce((sum, c) => sum + c.count, 0);
  }

  protected onItemClicked(id: string): void {
    // Toggle: clicking the selected card clears the selection.
    this.store.selectItem(this.store.itemId() === id ? null : id);
  }
}
