import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { EstimateBreakdown } from '../../core/projects/project.types';

/** pV2-CART-01 — the estimate cascade rows (Subtotal → contingency → your cost
 *  → margin → VAT → client total) + the budget bar. Pure presentation over the
 *  server-computed breakdown; extracted from project-estimate (audit M1). */
@Component({
  selector: 'app-estimate-breakdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe],
  host: { class: 'block' },
  template: `
    <!-- Subtotal → contingency → your cost (v1 layout). -->
    <div class="mt-5 flex flex-col gap-1.5">
      <div class="flex justify-between bp-body-small text-secondary"><span>Subtotal</span><span>{{ bd().subtotal | currency: cur() : 'symbol' : '1.0-0' }}</span></div>
      @if (bd().contingencyPct > 0) {
        <div class="flex justify-between bp-body-small text-secondary"><span>Contingency ({{ bd().contingencyPct }}%)</span><span>{{ bd().contingency | currency: cur() : 'symbol' : '1.0-0' }}</span></div>
      }
      @if (bd().insurance > 0) {
        <div class="flex justify-between bp-body-small text-secondary"><span>Insurance@if (bd().insurancePct > 0) { ({{ bd().insurancePct }}%) }</span><span>{{ bd().insurance | currency: cur() : 'symbol' : '1.0-0' }}</span></div>
      }
    </div>
    <div class="mt-3 flex items-baseline justify-between border-t border-hairline pt-3">
      <span class="bp-field-label">Your cost</span>
      <span class="bp-amount text-text">{{ bd().ourCost | currency: cur() : 'symbol' : '1.0-0' }}</span>
    </div>

    <!-- Margin → VAT → client total. -->
    <div class="mt-3 flex flex-col gap-1.5">
      <div class="flex justify-between bp-body-small text-secondary"><span>Margin ({{ bd().marginPct }}%)</span><span>{{ bd().marginAmount | currency: cur() : 'symbol' : '1.0-0' }}</span></div>
      @if (bd().vatPct > 0) {
        <div class="flex justify-between bp-body-small text-secondary"><span>VAT ({{ bd().vatPct }}%)</span><span>{{ bd().vatAmount | currency: cur() : 'symbol' : '1.0-0' }}</span></div>
      }
    </div>
    <div class="mt-3 flex items-baseline justify-between border-t border-hairline pt-3">
      <span class="bp-list-title">Client total</span>
      <span class="bp-price-large">{{ bd().clientTotal | currency: cur() : 'symbol' : '1.0-0' }}</span>
    </div>

    @if (budget() > 0) {
      <div class="bp-card mt-5 p-4">
        <div class="flex items-center justify-between">
          <span class="bp-field-label">{{ bd().clientTotal <= budget() ? 'Within budget' : 'Over budget' }}</span>
          <span class="bp-amount" [class.text-success]="bd().clientTotal <= budget()" [class.text-danger]="bd().clientTotal > budget()">
            {{ budgetDiff() | currency: cur() : 'symbol' : '1.0-0' }}
          </span>
        </div>
        <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-fill">
          <div class="h-full rounded-full" [class.bg-success]="bd().clientTotal <= budget()" [class.bg-danger]="bd().clientTotal > budget()" [style.width.%]="barPct()"></div>
        </div>
        <div class="mt-1.5 flex justify-between"><span class="bp-meta">Client total {{ bd().clientTotal | currency: cur() : 'symbol' : '1.0-0' }}</span><span class="bp-meta">Budget {{ budget() | currency: cur() : 'symbol' : '1.0-0' }}</span></div>
      </div>
    }
  `,
})
export class EstimateBreakdownComponent {
  readonly bd = input.required<EstimateBreakdown>();
  readonly budget = input<number>(0);
  readonly cur = input.required<string>();

  protected readonly budgetDiff = computed(() => (this.budget() > 0 ? this.bd().clientTotal - this.budget() : 0));
  protected readonly barPct = computed(() =>
    this.budget() > 0 ? Math.min((this.bd().clientTotal / this.budget()) * 100, 100) : 0
  );
}
