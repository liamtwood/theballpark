import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { EstimateBreakdown, QuoteLine, groupByCategory } from '../../core/projects/project.types';
import { QtyInputComponent } from './qty-input.component';
import { isDeclined } from './quote-line.util';

/** pV2-PROJECTS-02 slice 2 — the Project Quote rail (Amazon-style cart): a
 *  simple Subtotal + "Go to Ballpark" CTA pinned at the top, then the list of
 *  items added to this project (name + price + qty + remove). The full pricing
 *  cascade (costs / fees / provisions / VAT) lives on the Ballpark Cost tab —
 *  the CTA takes you there. */
@Component({
  selector: 'app-project-quote-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, LucideAngularModule, QtyInputComponent],
  host: { class: 'bp-card block p-4' },
  template: `
    <div class="flex items-baseline justify-between">
      <h3 class="bp-card-title text-md">Project Quote</h3>
      <span class="bp-meta">{{ visibleLines().length }} item{{ visibleLines().length === 1 ? '' : 's' }}</span>
    </div>

    @if (visibleLines().length === 0) {
      <p class="bp-caption mt-3">No items yet — add from the marketplace with the + on a card.</p>
    } @else {
      <!-- Subtotal + primary CTA pinned at the top (Amazon-style). The
           authoritative Project Total (ex-VAT) when the cascade has loaded;
           a base-price subtotal until then. Full breakdown is on Ballpark Cost. -->
      <div class="mt-3 border-b border-hairline pb-4">
        <div class="flex items-baseline justify-between">
          <span class="bp-field-label">Subtotal</span>
          <span class="text-md font-semibold text-text">{{ headlineTotal() | currency: 'GBP' : 'symbol' : '1.0-0' }}</span>
        </div>
        <button type="button" class="bp-btn-accent mt-3 w-full" (click)="checkout.emit()">
          Go to Ballpark
        </button>
      </div>

      <div class="mt-4 flex flex-col gap-3">
        @for (g of groups(); track g.id) {
          <div>
            <div class="bp-cart-cat-band">{{ g.name }}</div>
            <ul class="flex flex-col">
              @for (l of g.items; track l.id) {
                <!-- Name gets the full column width on its own row (no thumb —
                     the cart is narrow); price + qty stepper sit below. -->
                <li class="flex flex-col gap-1.5 border-b border-hairline py-2.5 last:border-b-0">
                  <div class="flex items-start justify-between gap-2">
                    <span class="line-clamp-2 text-lg font-semibold leading-snug text-text">{{ l.name }}</span>
                    <button type="button" class="-mr-1 shrink-0 rounded-md p-1 text-muted hover:bg-fill hover:text-text" [attr.aria-label]="'Remove ' + l.name" (click)="removed.emit(l.itemId)">
                      <lucide-icon name="x" [size]="15" />
                    </button>
                  </div>
                  <div class="flex items-center justify-between gap-2">
                    <span class="bp-body-small text-secondary">{{ l.basePrice === null ? 'POA' : (l.basePrice | currency: 'GBP' : 'symbol' : '1.0-0') }}{{ l.unit ? ' / ' + l.unit : '' }}</span>
                    <app-qty-input
                      class="shrink-0"
                      [value]="l.quantity"
                      [label]="l.name"
                      (qtyCommit)="qtyChanged.emit({ itemId: l.itemId, quantity: $event })"
                    />
                  </div>
                </li>
              }
            </ul>
          </div>
        }
      </div>
    }
  `,
})
export class ProjectQuoteRailComponent {
  readonly lines = input.required<QuoteLine[]>();
  /** The server estimate cascade — null until loaded. When present the headline
   *  Subtotal shows Project Costs (the cart's categorised items, marked up);
   *  else a base subtotal. Fees/provisions are excluded — they're not in the cart. */
  readonly breakdown = input<EstimateBreakdown | null>(null);
  readonly removed = output<string>();
  readonly qtyChanged = output<{ itemId: string; quantity: number }>();
  readonly checkout = output<void>();

  /** Lines shown in the Project Quote. Declined/cancelled lines drop off (out of
   *  scope), and so do the agent's Fees — lines with no catalogue category
   *  (categoryId = null): those are entered/managed on Ballpark Cost, not the
   *  cart. */
  protected readonly visibleLines = computed(() =>
    this.lines().filter((l) => !isDeclined(l) && l.categoryId != null),
  );

  /** Cart lines grouped by category (shared helper — same grouping as the
   *  Estimate tab). Server returns lines category-ordered → display order. */
  protected readonly groups = computed(() => groupByCategory(this.visibleLines()));

  /** Base-price subtotal — indicative, used until the cascade loads. */
  private readonly subtotal = computed(() =>
    this.visibleLines().reduce((sum, l) => sum + (l.basePrice ?? 0) * (l.quantity ?? 1), 0)
  );

  /** The headline Subtotal (ex-VAT): Project Costs from the server cascade once
   *  loaded (matches Ballpark Cost's Project Costs — the cart's categorised
   *  items, marked up, excluding fees/provisions), else the indicative base
   *  subtotal. */
  protected readonly headlineTotal = computed(() => this.breakdown()?.projectCosts ?? this.subtotal());
}
