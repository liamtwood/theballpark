import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { ItemPreviewComponent } from '../marketplace/rail/item-preview.component';
import { CatalogueItem } from '../../shared/catalogue/catalogue.types';
import { QuoteLine } from '../../core/projects/project.types';
import { lineCost, quoteLineToCatalogueItem } from './quote-line.util';
import { MarkdownPipe } from '../../shared/markdown.pipe';
import { currencySymbol, detailsTotalStr } from '../../shared/details-format';

/** pV2-CART-01 — the right-rail marketplace preview for the selected quote
 *  line. Owns the eye toggle (hides the card for ALL selections until clicked
 *  again). Extracted from project-estimate (audit M1). */
@Component({
  selector: 'app-estimate-preview-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, LucideAngularModule, ItemPreviewComponent, MarkdownPipe],
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
              <app-item-preview [item]="previewItem()!" [categoryName]="l.categoryName" [showFromPrefix]="false" [showStoreLink]="false"
                                closeIcon="eye" closeLabel="Hide preview" (closed)="hidden.set(true)" />
              <!-- pV2-BUILDUP-04 — the line's Details (same free-text markdown the
                   inbox card shows), with its running total. -->
              @if (l.details) {
                <div class="mt-3 border-t border-hairline pt-3">
                  <div class="flex items-center justify-between gap-2">
                    <span class="bp-field-label">Details</span>
                    @if (detailsTotal(l); as tot) {
                      <span class="bp-body-small font-semibold tabular-nums text-text">{{ tot }}</span>
                    }
                  </div>
                  <div class="bp-md bp-body-small mt-1 text-secondary" [innerHTML]="l.details | md"></div>
                </div>
              }
              <!-- pV2-BUILDUP-03 — this line's picked options, listed on the card. -->
              @if (options().length) {
                <div class="mt-3 rounded-[var(--radius-card)] border border-hairline">
                  <div class="flex items-center gap-2 border-b border-hairline bg-fill px-3 py-2">
                    <lucide-icon name="list-checks" [size]="14" class="shrink-0 text-muted" />
                    <span class="bp-field-label">Options</span>
                  </div>
                  @for (op of options(); track op.id) {
                    <div class="flex items-center gap-2 border-b border-hairline px-3 py-2 last:border-b-0">
                      <span class="min-w-0 flex-1 truncate bp-meta text-text">{{ op.name }}</span>
                      <span class="bp-meta shrink-0 tabular-nums text-secondary">× {{ op.quantity }}</span>
                      <span class="bp-body-small w-16 shrink-0 text-right tabular-nums text-secondary">{{ optCost(op) | currency: cur() : 'symbol' : '1.0-0' }}</span>
                    </div>
                  }
                </div>
              }
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
  /** pV2-BUILDUP-03 — the selected line's picked options, listed on the card. */
  readonly options = input<QuoteLine[]>([]);
  readonly cur = input<string>('GBP');
  /** "Explore More" → the host opens the supplier-browse dialog for this line. */
  readonly exploreMore = output<void>();
  protected optCost(l: QuoteLine): number { return lineCost(l); }
  /** The line's Details running total ("£3,100"), or '' when no costs. */
  protected detailsTotal(l: QuoteLine): string { return detailsTotalStr(l.details, currencySymbol(l.supplierCurrency)); }
  /** Eye toggle — suppresses the preview for ALL selections (session-local). */
  protected readonly hidden = signal(false);

  /** The selected line mapped to the marketplace preview's CatalogueItem shape
   *  (the quote line already carries everything the preview renders). */
  protected readonly previewItem = computed<CatalogueItem | null>(() => {
    const l = this.line();
    return l ? quoteLineToCatalogueItem(l) : null;
  });
}
