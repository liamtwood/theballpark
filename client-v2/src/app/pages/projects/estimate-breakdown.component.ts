import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { EstimateBreakdown } from '../../core/projects/project.types';

/** pV2-BUILDUP-04 — the SOW summary box: Project Costs / Project Coverage /
 *  Project Fees / Project Total (ex-VAT). Margin is folded silently into Project
 *  Costs and is NOT shown here — so a client viewing the page never reads the
 *  markup off the summary. Pure presentation over the server-computed breakdown. */
@Component({
  selector: 'app-estimate-breakdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe],
  host: { class: 'block' },
  template: `
    <div class="mt-5 flex flex-col gap-1.5">
      <div class="flex justify-between bp-body-small text-secondary">
        <span>Project Costs</span><span class="tabular-nums">{{ bd().projectCosts | currency: cur() : 'symbol' : '1.0-0' }}</span>
      </div>
      <div class="flex justify-between bp-body-small text-secondary">
        <span>Project Coverage</span><span class="tabular-nums">{{ bd().coverage | currency: cur() : 'symbol' : '1.0-0' }}</span>
      </div>
      <div class="flex justify-between bp-body-small text-secondary">
        <span>Project Fees</span><span class="tabular-nums">{{ bd().fees | currency: cur() : 'symbol' : '1.0-0' }}</span>
      </div>
    </div>
    <div class="mt-3 flex items-baseline justify-between border-t border-hairline pt-3">
      <span class="bp-list-title">Project Total</span>
      <span class="bp-price-large">{{ bd().projectTotal | currency: cur() : 'symbol' : '1.0-0' }}</span>
    </div>

    @if (budget() > 0) {
      <div class="bp-card mt-5 p-4">
        <div class="flex items-center justify-between">
          <span class="bp-field-label">{{ bd().projectTotal <= budget() ? 'Within budget' : 'Over budget' }}</span>
          <span class="bp-amount" [class.text-success]="bd().projectTotal <= budget()" [class.text-danger]="bd().projectTotal > budget()">
            {{ budgetDiff() | currency: cur() : 'symbol' : '1.0-0' }}
          </span>
        </div>
        <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-fill">
          <div class="h-full rounded-full" [class.bg-success]="bd().projectTotal <= budget()" [class.bg-danger]="bd().projectTotal > budget()" [style.width.%]="barPct()"></div>
        </div>
        <div class="mt-1.5 flex justify-between"><span class="bp-meta">Project total {{ bd().projectTotal | currency: cur() : 'symbol' : '1.0-0' }}</span><span class="bp-meta">Budget {{ budget() | currency: cur() : 'symbol' : '1.0-0' }}</span></div>
      </div>
    }
  `,
})
export class EstimateBreakdownComponent {
  readonly bd = input.required<EstimateBreakdown>();
  readonly budget = input<number>(0);
  readonly cur = input.required<string>();

  protected readonly budgetDiff = computed(() => (this.budget() > 0 ? this.bd().projectTotal - this.budget() : 0));
  protected readonly barPct = computed(() =>
    this.budget() > 0 ? Math.min((this.bd().projectTotal / this.budget()) * 100, 100) : 0
  );
}
