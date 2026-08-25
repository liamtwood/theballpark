import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ItemPreviewComponent } from '../marketplace/rail/item-preview.component';
import { CatalogueItem } from '../../shared/catalogue/catalogue.types';
import { QuoteLine } from '../../core/projects/project.types';
import { quoteLineToCatalogueItem } from './quote-line.util';

/** pV2-CART-01 — the right-rail marketplace preview for the selected quote
 *  line. Owns the eye toggle (hides the card for ALL selections until clicked
 *  again). Extracted from project-estimate (audit M1). */
@Component({
  selector: 'app-estimate-preview-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, ItemPreviewComponent],
  host: { class: 'contents' },
  template: `
    @if (line(); as l) {
      <!-- Rail spans the gap between the centered column's right edge
           (50% + half of max-w-2xl = 21rem) and the screen edge; the card is
           centered in it. Full-height so the inner sticky card stays put. -->
      <aside class="absolute inset-y-0 right-0 left-[calc(50%_+_21rem)] hidden items-start justify-center lg:flex">
        <div class="sticky top-32 w-80">
          @if (hidden()) {
            <!-- Hidden: just the eye, in the same top-right spot as the preview
                 card's eye (matches the card's p-4 inset). -->
            <div class="flex justify-end px-4 pt-4">
              <button type="button" class="bp-itemprev-close" (click)="hidden.set(false)"
                      title="Show item preview" aria-label="Show item preview">
                <lucide-icon name="eye" [size]="14" />
              </button>
            </div>
          } @else {
            <div class="bp-card p-4">
              <app-item-preview [item]="previewItem()!" [categoryName]="l.categoryName"
                                closeIcon="eye" closeLabel="Hide preview" (closed)="hidden.set(true)" />
              <!-- pV2-BUILDUP-01 (UI1): browse more of this item's supplier. -->
              @if (l.supplierId) {
                <button type="button"
                        class="mt-3 flex w-full items-center justify-center gap-2 rounded-[var(--radius-card)] border border-hairline px-3 py-2.5 text-secondary transition-colors hover:bg-fill hover:text-text"
                        (click)="exploreMore.emit()">
                  <lucide-icon name="layout-grid" [size]="15" /> Explore More
                </button>
              }
            </div>
          }
        </div>
      </aside>
    }
  `,
})
export class EstimatePreviewRailComponent {
  readonly line = input<QuoteLine | null>(null);
  /** "Explore More" → the host opens the supplier-browse dialog for this line. */
  readonly exploreMore = output<void>();
  /** Eye toggle — suppresses the preview for ALL selections (session-local). */
  protected readonly hidden = signal(false);

  /** The selected line mapped to the marketplace preview's CatalogueItem shape
   *  (the quote line already carries everything the preview renders). */
  protected readonly previewItem = computed<CatalogueItem | null>(() => {
    const l = this.line();
    return l ? quoteLineToCatalogueItem(l) : null;
  });
}
