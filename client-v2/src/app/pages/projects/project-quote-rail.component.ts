import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { QuoteLine, groupByCategory } from '../../core/projects/project.types';
import { QtyInputComponent } from './qty-input.component';
import { ProjectOutreachStore } from './project-outreach.store';

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
      <div class="mt-3 flex flex-col gap-3">
        @for (g of groups(); track g.id) {
          <div>
            <div class="bp-cart-cat-band">{{ g.name }}</div>
            <!-- pV2-INBOX-02: suppliers added to quote this category (the
                 ephemeral roster). Removable; nothing persists until send. -->
            @if (outreach.pickedFor(g.id); as picks) {
              @if (picks.length) {
                <div class="mt-1.5 flex flex-wrap gap-1.5">
                  @for (s of picks; track s.id) {
                    <span class="inline-flex items-center gap-1 rounded-full border border-hairline bg-fill px-2 py-0.5 text-sm text-text">
                      {{ s.name }}
                      <button type="button" class="text-muted hover:text-text" [attr.aria-label]="'Remove ' + s.name" (click)="outreach.remove(g.id, s.id)">
                        <lucide-icon name="x" [size]="12" />
                      </button>
                    </span>
                  }
                </div>
              }
            }
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
  protected readonly outreach = inject(ProjectOutreachStore);

  readonly lines = input.required<QuoteLine[]>();
  readonly removed = output<string>();
  readonly qtyChanged = output<{ itemId: string; quantity: number }>();
  readonly checkout = output<void>();

  /** Cart lines grouped by category (shared helper — same grouping as the
   *  Estimate tab). Server returns lines category-ordered → display order. */
  protected readonly groups = computed(() => groupByCategory(this.lines()));

  /** Indicative only — real pricing (margin/contingency/VAT) is 06f. */
  protected readonly subtotal = computed(() =>
    this.lines().reduce((sum, l) => sum + (l.basePrice ?? 0) * (l.quantity ?? 1), 0)
  );
}
