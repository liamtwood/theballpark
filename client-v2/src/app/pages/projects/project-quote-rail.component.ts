import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { QuoteLine } from '../../core/projects/project.types';
import { QtyInputComponent } from './qty-input.component';

/** pV2-PROJECTS-02 slice 2 — the Project Quote rail: a simple list of the
 *  items added to this project (thumb + name + price + remove), a running
 *  count + indicative subtotal, and the "See Final Project Quote" CTA.
 *  (Liam's locked cart vision: a list with remove + a checkout CTA. Full
 *  pricing/checkout is 06f — the CTA is a stub here.) */
@Component({
  selector: 'app-project-quote-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, LucideAngularModule, QtyInputComponent],
  host: { class: 'bp-card block p-4' },
  template: `
    <div class="flex items-baseline justify-between">
      <h3 class="bp-card-title text-md">Project Quote</h3>
      <span class="bp-meta">{{ lines().length }} item{{ lines().length === 1 ? '' : 's' }}</span>
    </div>

    @if (lines().length === 0) {
      <p class="bp-caption mt-3">No items yet — add from the marketplace with the + on a card.</p>
    } @else {
      <ul class="mt-3 flex flex-col">
        @for (l of lines(); track l.id) {
          <li class="flex items-center gap-2.5 border-b border-hairline py-2 last:border-b-0">
            @if (l.imageUrl) {
              <img [src]="l.imageUrl" alt="" class="h-9 w-9 shrink-0 rounded-md object-cover" />
            } @else {
              <span class="bp-icon-block h-9 w-9 shrink-0"><lucide-icon name="store" [size]="14" /></span>
            }
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-medium text-text">{{ l.name }}</span>
              <span class="bp-meta">{{ l.basePrice === null ? 'POA' : (l.basePrice | currency: 'GBP' : 'symbol' : '1.0-0') }}{{ l.unit ? ' / ' + l.unit : '' }}</span>
            </span>
            <app-qty-input
              class="shrink-0"
              [value]="l.quantity"
              [label]="l.name"
              (qtyCommit)="qtyChanged.emit({ itemId: l.itemId, quantity: $event })"
            />
            @if (l.unit) {
              <span class="bp-meta w-12 shrink-0 truncate">{{ l.unit }}</span>
            }
            <button type="button" class="shrink-0 rounded-md p-1 text-muted hover:bg-fill hover:text-text" [attr.aria-label]="'Remove ' + l.name" (click)="removed.emit(l.itemId)">
              <lucide-icon name="x" [size]="15" />
            </button>
          </li>
        }
      </ul>

      <div class="mt-3 flex items-baseline justify-between border-t border-hairline pt-3">
        <span class="bp-field-label">Indicative subtotal</span>
        <span class="text-md font-semibold text-text">{{ subtotal() | currency: 'GBP' : 'symbol' : '1.0-0' }}</span>
      </div>
      <button type="button" class="bp-btn-grad mt-3 w-full" (click)="checkout.emit()">
        <lucide-icon name="arrow-right" [size]="16" />
        See Final Project Quote
      </button>
    }
  `,
})
export class ProjectQuoteRailComponent {
  readonly lines = input.required<QuoteLine[]>();
  readonly removed = output<string>();
  readonly qtyChanged = output<{ itemId: string; quantity: number }>();
  readonly checkout = output<void>();

  /** Indicative only — real pricing (margin/contingency/VAT) is 06f. */
  protected readonly subtotal = computed(() =>
    this.lines().reduce((sum, l) => sum + (l.basePrice ?? 0) * (l.quantity ?? 1), 0)
  );
}
