import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, resource, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { ProjectService } from '../../core/projects/project.service';
import { EstimateBreakdown, ProjectDetail, QuoteLine, groupByCategory } from '../../core/projects/project.types';
import { MarkdownPipe } from '../../shared/markdown.pipe';
import { isDeclined, lineCost, unitPlain } from './quote-line.util';

/** pV2-BUILDUP-04 — the client-facing Quote DOCUMENT. A read-only, print-styled
 *  render of the Final Quote in the agency-SOW layout: Project Costs (banded per
 *  category, with the category icon) → Project Coverage → Project Fees → totals.
 *  Every line is one shape — name · description · qty · unit · cost. Margin is
 *  folded silently into Project Costs and never shown; VAT excluded. Descriptions
 *  come from the line today (supplier text); the agent-owned `quote_description`
 *  override lands next. Prints via the global `.quote-doc-open` isolation rule. */
@Component({
  selector: 'app-quote-document',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, LucideAngularModule, MarkdownPipe],
  host: { class: 'quote-doc fixed inset-0 z-50 overflow-y-auto bg-fill' },
  template: `
    <!-- Action bar (screen only — hidden on print). -->
    <div class="quote-doc__bar sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-hairline bg-surface px-5 py-3">
      <button type="button" class="flex items-center gap-2 bp-body-small text-secondary transition-colors hover:text-text" (click)="close.emit()">
        <lucide-icon name="arrow-left" [size]="16" /> Back to builder
      </button>
      <button type="button" class="bp-btn-grad flex items-center gap-2" (click)="print()">
        <lucide-icon name="printer" [size]="15" /> Print / Save PDF
      </button>
    </div>

    <!-- The paper. -->
    <div class="quote-doc__paper mx-auto my-8 w-full max-w-3xl bg-surface p-12 shadow-sm">
      <!-- Header -->
      <div class="mb-8 flex items-start justify-between gap-4">
        <div>
          <div class="bp-list-title text-[length:var(--text-2xl)] font-bold tracking-tight">{{ project().clientName || 'Your Agency' }}</div>
        </div>
        <div class="text-right bp-meta leading-relaxed">
          @if (project().ref) { {{ project().ref }}<br/> }
          @if (project().eventDate) { {{ project().eventDate }}<br/> }
          Quote
        </div>
      </div>
      <h1 class="bp-page-title text-[length:var(--text-hero)]">{{ project().name }}</h1>
      @if (subtitle()) {
        <p class="bp-section-subtitle mt-1">{{ subtitle() }}</p>
      }

      @if (est.isLoading()) {
        <p class="bp-body-small mt-8 text-secondary">Preparing the quote…</p>
      } @else {
        <!-- ===== PROJECT COSTS ===== -->
        <div class="quote-doc__section mt-8">
          <div class="mb-1 flex items-center gap-2 border-b-2 border-text pb-1.5">
            <span class="bp-page-label">Project Costs</span>
          </div>
          @for (g of costGroups(); track g.id) {
            <!-- Category band — icon + name, like the cost cards. -->
            <div class="mt-4 flex items-center gap-2">
              <lucide-icon [name]="g.iconName || 'folder-open'" [size]="16" class="text-[var(--theme-accent)]" />
              <span class="bp-field-label">{{ g.name }}</span>
            </div>
            @for (l of g.items; track l.id) {
              <div class="flex items-start justify-between gap-4 border-b border-hairline py-3">
                <div class="min-w-0 flex-1">
                  <div class="bp-body-small font-semibold text-text">{{ l.name }}</div>
                  @if (l.description) {
                    <div class="bp-md bp-meta mt-1 max-w-prose text-secondary" [innerHTML]="l.description | md"></div>
                  }
                </div>
                <div class="flex shrink-0 items-baseline gap-4 tabular-nums">
                  <span class="bp-meta w-10 text-right text-secondary">{{ l.quantity }}</span>
                  <span class="bp-meta w-16 text-right text-secondary">{{ (l.basePrice ?? 0) * markup() | currency: cur() : 'symbol' : '1.0-0' }}</span>
                  <span class="bp-body-small w-20 text-right font-semibold text-text">{{ lineTotal(l) | currency: cur() : 'symbol' : '1.0-0' }}</span>
                </div>
              </div>
            }
          }
          <div class="flex items-center justify-between border-t-2 border-text py-2.5">
            <span class="bp-field-label">Total project costs</span>
            <span class="bp-body-small font-bold tabular-nums text-text">{{ bd().projectCosts | currency: cur() : 'symbol' : '1.0-0' }}</span>
          </div>
        </div>

        <!-- ===== PROJECT COVERAGE ===== -->
        <div class="quote-doc__section mt-8">
          <div class="mb-1 flex items-center gap-2 border-b-2 border-text pb-1.5">
            <span class="bp-page-label">Project Coverage</span>
          </div>
          <div class="flex items-center justify-between border-b border-hairline py-3">
            <div class="flex items-center gap-2">
              <lucide-icon name="percent" [size]="16" class="text-[var(--theme-accent)]" />
              <div>
                <div class="bp-body-small font-semibold text-text">Contingency</div>
                <div class="bp-meta">{{ bd().contingencyPct }}% of project costs</div>
              </div>
            </div>
            <span class="bp-body-small w-20 text-right font-semibold tabular-nums text-text">{{ bd().contingency | currency: cur() : 'symbol' : '1.0-0' }}</span>
          </div>
          <div class="flex items-center justify-between border-b border-hairline py-3">
            <div class="flex items-center gap-2">
              <lucide-icon name="percent" [size]="16" class="text-[var(--theme-accent)]" />
              <div>
                <div class="bp-body-small font-semibold text-text">Insurance</div>
                <div class="bp-meta">{{ bd().insurancePct }}% of project costs</div>
              </div>
            </div>
            <span class="bp-body-small w-20 text-right font-semibold tabular-nums text-text">{{ bd().insurance | currency: cur() : 'symbol' : '1.0-0' }}</span>
          </div>
          <div class="flex items-center justify-between border-t-2 border-text py-2.5">
            <span class="bp-field-label">Total coverage</span>
            <span class="bp-body-small font-bold tabular-nums text-text">{{ bd().coverage | currency: cur() : 'symbol' : '1.0-0' }}</span>
          </div>
        </div>

        <!-- ===== PROJECT FEES ===== -->
        @if (feesGroup(); as fg) {
          <div class="quote-doc__section mt-8">
            <div class="mb-1 flex items-center gap-2 border-b-2 border-text pb-1.5">
              <span class="bp-page-label">Project Fees</span>
            </div>
            @for (l of fg.items; track l.id) {
              <div class="flex items-start justify-between gap-4 border-b border-hairline py-3">
                <div class="min-w-0 flex-1">
                  <div class="bp-body-small font-semibold text-text">{{ l.name }}</div>
                  @if (l.description) {
                    <div class="bp-md bp-meta mt-1 max-w-prose text-secondary" [innerHTML]="l.description | md"></div>
                  }
                </div>
                <div class="flex shrink-0 items-baseline gap-4 tabular-nums">
                  <span class="bp-meta w-10 text-right text-secondary">{{ l.quantity }}</span>
                  <span class="bp-meta w-16 text-right text-secondary">{{ l.basePrice != null ? (l.basePrice | currency: cur() : 'symbol' : '1.0-0') : '' }}</span>
                  <span class="bp-body-small w-20 text-right font-semibold text-text">{{ lineCostRaw(l) | currency: cur() : 'symbol' : '1.0-0' }}</span>
                </div>
              </div>
            }
            <div class="flex items-center justify-between border-t-2 border-text py-2.5">
              <span class="bp-field-label">Total fees</span>
              <span class="bp-body-small font-bold tabular-nums text-text">{{ bd().fees | currency: cur() : 'symbol' : '1.0-0' }}</span>
            </div>
          </div>
        }

        <!-- ===== SUMMARY ===== -->
        <div class="mt-10 border-t-2 border-text pt-4">
          <div class="flex justify-between py-1 bp-body-small text-secondary"><span>Project Costs</span><span class="tabular-nums">{{ bd().projectCosts | currency: cur() : 'symbol' : '1.0-0' }}</span></div>
          <div class="flex justify-between py-1 bp-body-small text-secondary"><span>Project Coverage</span><span class="tabular-nums">{{ bd().coverage | currency: cur() : 'symbol' : '1.0-0' }}</span></div>
          <div class="flex justify-between py-1 bp-body-small text-secondary"><span>Project Fees</span><span class="tabular-nums">{{ bd().fees | currency: cur() : 'symbol' : '1.0-0' }}</span></div>
          <div class="mt-2 flex items-baseline justify-between border-t border-hairline pt-3">
            <span class="bp-list-title">Project Total</span>
            <span class="bp-price-large tabular-nums">{{ bd().projectTotal | currency: cur() : 'symbol' : '1.0-0' }}</span>
          </div>
        </div>

        <p class="bp-caption mt-8 border-t border-hairline pt-3">
          Project Costs are shown inclusive of any agency margin; margin is not itemised. Excludes VAT.
        </p>
      }
    </div>
  `,
})
export class QuoteDocumentComponent {
  private readonly projects = inject(ProjectService);

  readonly projectId = input.required<string>();
  readonly project = input.required<ProjectDetail>();
  /** "Back to builder" — the host swaps the document back for the Final Quote. */
  readonly close = output<void>();

  constructor() {
    // Flag the body so the global print rule isolates the paper (see styles.css).
    document.body.classList.add('quote-doc-open');
    inject(DestroyRef).onDestroy(() => document.body.classList.remove('quote-doc-open'));
  }

  protected readonly cur = computed(() => this.project().currency || 'GBP');
  protected readonly subtitle = computed(() =>
    [this.project().eventType, this.project().venueCity].filter(Boolean).join(' · '));

  private readonly lines = resource<QuoteLine[], string>({
    params: () => this.projectId(),
    loader: ({ params }) => firstValueFrom(this.projects.quoteItems(params)),
  });
  protected readonly est = resource<EstimateBreakdown, string>({
    params: () => this.projectId(),
    loader: ({ params }) => firstValueFrom(this.projects.estimate(params, 'all')),
  });

  /** Zeroed placeholder until the cascade lands (keeps `%` labels from flashing). */
  protected readonly bd = computed<EstimateBreakdown>(() => this.est.value() ?? EMPTY_BD);

  /** Client-facing lines: top-level only (options fold under their parent, not
   *  listed here) and never the declined/cancelled rows. */
  private readonly liveLines = computed(() =>
    (this.lines.value() ?? []).filter((l) => !l.optionOfLineId && !isDeclined(l)));

  /** Hard-cost categories (banded, marked up). '__none' is the Fees section. */
  protected readonly costGroups = computed(() =>
    groupByCategory(this.liveLines().filter((l) => l.categoryId != null)).map((g) => ({
      ...g,
      iconName: g.items[0]?.categoryIconName ?? null,
    })));
  protected readonly feesGroup = computed(() => {
    const fees = this.liveLines().filter((l) => l.categoryId == null);
    return fees.length ? { id: '__none', name: 'Fees', items: fees } : null;
  });

  /** Margin markup (1 + margin%) — applied to hard-cost display only. */
  protected readonly markup = computed(() => 1 + (this.bd().marginPct || 0) / 100);
  protected lineTotal(l: QuoteLine): number { return lineCost(l) * this.markup(); }
  protected lineCostRaw(l: QuoteLine): number { return lineCost(l); }
  protected unitText(l: QuoteLine): string { return unitPlain(l.unit); }

  protected print(): void { window.print(); }
}

const EMPTY_BD: EstimateBreakdown = {
  hardCosts: 0, marginPct: 0, marginAmount: 0, projectCosts: 0,
  contingencyPct: 0, contingency: 0, insurancePct: 0, insurance: 0,
  coverage: 0, fees: 0, projectTotal: 0, subtotal: 0, clientTotal: 0,
};
