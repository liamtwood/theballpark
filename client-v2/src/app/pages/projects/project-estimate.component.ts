import { ChangeDetectionStrategy, Component, computed, inject, input, resource } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { ProjectService } from '../../core/projects/project.service';
import { ProjectDetail, QuoteLine } from '../../core/projects/project.types';

/** pV2-PROJECTS-02 slice 3 — the Estimate tab. Ports the v1 estimate
 *  breakdown (Subtotal → Contingency → Your cost → Margin → VAT → Client
 *  total + budget bar) computed from the project's quote items + its
 *  financial defaults — exactly v1's recalc() math (which itself sums the
 *  cart when category costs are stale, our case). INDICATIVE: the
 *  server-side priced rollup + checkout land in 06f. */
@Component({
  selector: 'app-project-estimate',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, LucideAngularModule],
  host: { class: 'block' },
  template: `
    <div class="mx-auto max-w-2xl">
      @if (lines.isLoading()) {
        <p class="bp-body-small text-secondary">Loading…</p>
      } @else if (rows().length === 0) {
        <p class="bp-body-small text-secondary">No items in the quote yet — add some from the Marketplace tab.</p>
      } @else {
        <p class="bp-field-label uppercase tracking-wide">Line items</p>
        <div class="mt-2 flex flex-col gap-2.5">
          @for (l of rows(); track l.id) {
            <!-- Card row (add-project-2 style): image left in the home
                 action-card rounded square, name, total on the right. -->
            <div class="bp-card flex items-center gap-3.5 p-3">
              @if (l.imageUrl) {
                <img [src]="l.imageUrl" alt="" class="bp-est-thumb shrink-0 object-cover" />
              } @else {
                <span class="bp-icon-block bp-est-thumb shrink-0"><lucide-icon name="store" [size]="20" [strokeWidth]="1.5" /></span>
              }
              <span class="min-w-0 flex-1">
                <span class="block truncate text-md font-medium text-text">{{ l.name }}</span>
                <span class="bp-meta">Estimated cost{{ l.unit ? ' · per ' + l.unit : '' }}</span>
              </span>
              <span class="shrink-0 text-md font-semibold text-text">{{ lineCost(l) | currency: cur() : 'symbol' : '1.0-0' }}</span>
            </div>
          }
        </div>

        <!-- Subtotal → contingency → your cost (v1 layout). -->
        <div class="mt-5 flex flex-col gap-1.5">
          <div class="flex justify-between bp-body-small text-secondary"><span>Subtotal</span><span>{{ subtotal() | currency: cur() : 'symbol' : '1.0-0' }}</span></div>
          @if (contingencyPct() > 0) {
            <div class="flex justify-between bp-body-small text-secondary"><span>Contingency ({{ contingencyPct() }}%)</span><span>{{ contingency() | currency: cur() : 'symbol' : '1.0-0' }}</span></div>
          }
        </div>
        <div class="mt-3 flex items-baseline justify-between border-t border-hairline pt-3">
          <span class="bp-field-label">Your cost</span>
          <span class="text-md font-semibold text-text">{{ ourCost() | currency: cur() : 'symbol' : '1.0-0' }}</span>
        </div>

        <!-- Margin → VAT → client total. -->
        <div class="mt-3 flex flex-col gap-1.5">
          <div class="flex justify-between bp-body-small text-secondary"><span>Margin ({{ marginPct() }}%)</span><span>{{ marginAmount() | currency: cur() : 'symbol' : '1.0-0' }}</span></div>
          @if (vatPct() > 0) {
            <div class="flex justify-between bp-body-small text-secondary"><span>VAT ({{ vatPct() }}%)</span><span>{{ vatAmount() | currency: cur() : 'symbol' : '1.0-0' }}</span></div>
          }
        </div>
        <div class="mt-3 flex items-baseline justify-between border-t border-hairline pt-3">
          <span class="bp-card-title text-md">Client total</span>
          <span class="bp-price-large">{{ clientTotal() | currency: cur() : 'symbol' : '1.0-0' }}</span>
        </div>

        @if (budget() > 0) {
          <div class="bp-card mt-5 p-4">
            <div class="flex items-center justify-between">
              <span class="bp-field-label">{{ clientTotal() <= budget() ? 'Within budget' : 'Over budget' }}</span>
              <span class="text-md font-semibold" [class.text-success]="clientTotal() <= budget()" [class.text-danger]="clientTotal() > budget()">
                {{ budgetDiff() | currency: cur() : 'symbol' : '1.0-0' }}
              </span>
            </div>
            <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-fill">
              <div class="h-full rounded-full" [class.bg-success]="clientTotal() <= budget()" [class.bg-danger]="clientTotal() > budget()" [style.width.%]="barPct()"></div>
            </div>
            <div class="mt-1.5 flex justify-between"><span class="bp-meta">Client total {{ clientTotal() | currency: cur() : 'symbol' : '1.0-0' }}</span><span class="bp-meta">Budget {{ budget() | currency: cur() : 'symbol' : '1.0-0' }}</span></div>
          </div>
        }

        <p class="bp-caption mt-4">Indicative — based on marketplace base prices. Final supplier quotes and the priced rollup land with checkout.</p>
      }
    </div>
  `,
})
export class ProjectEstimateComponent {
  private readonly projects = inject(ProjectService);

  readonly projectId = input.required<string>();
  readonly project = input.required<ProjectDetail>();

  protected readonly lines = resource<QuoteLine[], string>({
    params: () => this.projectId(),
    loader: ({ params }) => firstValueFrom(this.projects.quoteItems(params)),
  });
  protected readonly rows = computed(() => this.lines.value() ?? []);

  protected lineCost(l: QuoteLine): number {
    return (l.basePrice ?? 0) * (l.quantity ?? 1);
  }
  protected readonly cur = computed(() => this.project().currency || 'GBP');

  // v1 defaults when the project's are unset: margin 20 / contingency 10 / vat 20.
  protected readonly marginPct = computed(() => this.project().defaultMarginPct ?? 20);
  protected readonly contingencyPct = computed(() => this.project().defaultContingencyPct ?? 10);
  protected readonly vatPct = computed(() => this.project().defaultVatPct ?? 20);
  protected readonly budget = computed(() => this.project().projectBudget ?? 0);

  // v1 recalc(), verbatim.
  protected readonly subtotal = computed(() =>
    this.rows().reduce((s, l) => s + this.lineCost(l), 0)
  );
  protected readonly contingency = computed(() => this.subtotal() * (this.contingencyPct() / 100));
  protected readonly ourCost = computed(() => this.subtotal() + this.contingency());
  protected readonly marginAmount = computed(() => this.ourCost() * (this.marginPct() / 100));
  private readonly preVat = computed(() => this.ourCost() + this.marginAmount());
  protected readonly vatAmount = computed(() => this.preVat() * (this.vatPct() / 100));
  protected readonly clientTotal = computed(() => this.preVat() + this.vatAmount());
  protected readonly budgetDiff = computed(() => (this.budget() > 0 ? this.clientTotal() - this.budget() : 0));
  protected readonly barPct = computed(() =>
    this.budget() > 0 ? Math.min((this.clientTotal() / this.budget()) * 100, 100) : 0
  );
}
