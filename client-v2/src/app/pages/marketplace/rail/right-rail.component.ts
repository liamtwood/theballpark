import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { MarketplaceStore } from '../marketplace-store';

/** pV2-06a — the polymorphic right rail, `@switch`ed on the DERIVED
 *  store.railMode(). This ship renders quiet placeholders for every mode
 *  — item preview lands 06b, category summary 06e, the Project Quote 06f
 *  (MARKETPLACE.md: the rail IS the surface; no drawers). */
@Component({
  selector: 'app-right-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'block rounded-[var(--radius-card)] border border-hairline bg-surface p-5' },
  template: `
    @switch (store.railMode()) {
      @case ('item') {
        <div class="bp-rail-empty">
          <span class="truncate text-md font-medium text-text">{{ store.selectedItem()?.name }}</span>
          <p class="bp-caption mt-1">Item preview lands in the next ship (pV2-06b).</p>
        </div>
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
  styles: [
    `
      .bp-rail-empty {
        display: flex;
        flex-direction: column;
        justify-content: center;
        min-height: 120px;
      }
    `,
  ],
})
export class RightRailComponent {
  protected readonly store = inject(MarketplaceStore);
}
