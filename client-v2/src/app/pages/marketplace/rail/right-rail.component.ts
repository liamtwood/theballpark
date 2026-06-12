import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { MarketplaceStore } from '../marketplace-store';
import { ItemPreviewComponent } from './item-preview.component';

/** pV2-06a/b — the polymorphic right rail, `@switch`ed on the DERIVED
 *  store.railMode(). Item mode is REAL since 06b (item-preview over the
 *  loaded row — selection never fetches); category summary lands 06e,
 *  the Project Quote 06f (MARKETPLACE.md: the rail IS the surface; no
 *  drawers). */
@Component({
  selector: 'app-right-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, ItemPreviewComponent],
  host: { class: 'block rounded-[var(--radius-card)] border border-hairline bg-surface p-5' },
  template: `
    @switch (store.railMode()) {
      @case ('item') {
        @if (store.selectedItem(); as item) {
          <app-item-preview
            [item]="item"
            [categoryName]="selectedItemCategory()"
            (closed)="store.selectItem(null)"
          />
        }
      }
      @case ('category') {
        <div class="bp-rail-empty">
          <span class="text-md font-medium text-text">{{ store.selectedCategory()?.name }}</span>
          <p class="bp-caption mt-1">Category summary + suppliers land in pV2-06e.</p>
        </div>
      }
      @default {
        <div class="bp-rail-empty items-center text-center">
          <lucide-icon name="store" [size]="22" [strokeWidth]="1.5" class="text-muted" />
          <p class="bp-body-small mt-2 text-secondary">Select a category or item to preview it here.</p>
        </div>
      }
    }
  `,
})
export class RightRailComponent {
  protected readonly store = inject(MarketplaceStore);

  /** The selected item's category name — resolved from the rail list the
   *  store already holds (selection never fetches). */
  protected readonly selectedItemCategory = computed(() => {
    const item = this.store.selectedItem();
    if (!item) return null;
    return this.store.categories().find((c) => c.id === item.categoryId)?.name ?? null;
  });
}
