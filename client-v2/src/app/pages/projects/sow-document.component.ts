import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, resource, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { ProjectService } from '../../core/projects/project.service';
import { OrganisationService, OrgProfile } from '../../core/organisation.service';
import { EstimateBreakdown, ProjectDetail, QuoteLine, groupByCategory } from '../../core/projects/project.types';
import { isDeclined } from './quote-line.util';

/** pV2-BUILDUP-04 — the client-facing STATEMENT OF WORK. A curated contract
 *  document (sibling to the Quote), reusing the same overlay + print isolation
 *  (.quote-doc / .quote-doc__paper / body.quote-doc-open). Structure follows the
 *  agency SOW: Buyer/Supplier parties, dates, Services & Goods (scope), Timeline,
 *  Fee (= the estimate total, ex-VAT), Payment Terms, Special Terms, signatures.
 *  Editable content fields + the Annex A T&C merge land next; today the new
 *  fields render seeded/placeholder text so the shape is real. */
@Component({
  selector: 'app-sow-document',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, LucideAngularModule],
  host: { class: 'quote-doc fixed inset-0 z-50 overflow-y-auto bg-fill' },
  styles: [`
    .quote-doc__paper { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    /* SOW table — bordered rows, bold label column. */
    .sow-row { display: grid; grid-template-columns: 9.5rem 1fr; border: 1px solid var(--color-border-hairline); border-top: 0; }
    .sow-row:first-child { border-top: 1px solid var(--color-border-hairline); }
    .sow-row > .sow-label { border-right: 1px solid var(--color-border-hairline); background: var(--color-fill); }
  `],
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

    <div class="quote-doc__paper mx-auto my-8 w-full max-w-3xl bg-surface p-12 shadow-sm">
      <!-- Agency logo + title -->
      <div class="mb-6 flex flex-col items-center gap-3 text-center">
        @if (org()?.logoUrl) {
          <img [src]="org()!.logoUrl" alt="" class="h-12 w-auto max-w-[140px] object-contain" />
        }
        <h1 class="bp-page-title text-[length:var(--text-2xl)] font-bold uppercase tracking-wide underline">Statement of Work</h1>
      </div>

      <!-- SOW table -->
      <div class="mt-2">
        <div class="sow-row">
          <div class="sow-label px-3 py-2.5 bp-body-small font-semibold text-text">Buyer</div>
          <div class="px-3 py-2.5 bp-body-small text-text">
            <span class="font-semibold">{{ project().clientName || '[Client company]' }}</span> — company registered in England &amp; Wales.
          </div>
        </div>
        <div class="sow-row">
          <div class="sow-label px-3 py-2.5 bp-body-small font-semibold text-text">Supplier</div>
          <div class="px-3 py-2.5 bp-body-small text-text">
            <span class="font-semibold">{{ org()?.name || '[Your agency]' }}</span>@if (supplierAddress()) { , whose principal place of business is at {{ supplierAddress() }} }.
          </div>
        </div>
        <div class="sow-row">
          <div class="sow-label px-3 py-2.5 bp-body-small font-semibold text-text">Effective Date</div>
          <div class="px-3 py-2.5 bp-body-small text-text">{{ effectiveDate() }}</div>
        </div>
        <div class="sow-row">
          <div class="sow-label px-3 py-2.5 bp-body-small font-semibold text-text">SOW Version</div>
          <div class="px-3 py-2.5 bp-body-small text-text">V1</div>
        </div>
        <div class="sow-row">
          <div class="sow-label px-3 py-2.5 bp-body-small font-semibold text-text">Project Title</div>
          <div class="px-3 py-2.5 bp-body-small text-text">{{ project().name }}</div>
        </div>

        <!-- Services & Goods — seeded from the quote's categories + lines. -->
        <div class="sow-row">
          <div class="sow-label px-3 py-2.5 bp-body-small font-semibold text-text">Services &amp; Goods</div>
          <div class="px-3 py-2.5 bp-body-small text-text">
            <p class="text-secondary">The supplier is responsible for delivering the following services and scope of work:</p>
            @if (location()) {
              <p class="mt-2"><span class="font-semibold">Location:</span> {{ location() }}</p>
            }
            @for (g of scopeGroups(); track g.id) {
              <p class="mt-2 font-semibold">{{ g.name }}</p>
              <ul class="ml-4 list-disc text-secondary">
                @for (l of g.items; track l.id) { <li>{{ l.name }}@if (l.quantity > 1) { × {{ l.quantity }} }</li> }
              </ul>
            }
          </div>
        </div>

        <div class="sow-row">
          <div class="sow-label px-3 py-2.5 bp-body-small font-semibold text-text">Timeline</div>
          <div class="px-3 py-2.5 bp-body-small text-secondary italic">Key dates &amp; milestones — to be added.</div>
        </div>
        <div class="sow-row">
          <div class="sow-label px-3 py-2.5 bp-body-small font-semibold text-text">Fee</div>
          <div class="px-3 py-2.5 bp-body-small font-semibold text-text">{{ bd().projectTotal | currency: cur() : 'symbol' : '1.0-2' }} (exc. VAT)</div>
        </div>
        <div class="sow-row">
          <div class="sow-label px-3 py-2.5 bp-body-small font-semibold text-text">Payment Terms</div>
          <div class="px-3 py-2.5 bp-body-small text-secondary italic">Payment schedule — to be added (e.g. 50% on signature, 50% on completion).</div>
        </div>
        <div class="sow-row">
          <div class="sow-label px-3 py-2.5 bp-body-small font-semibold text-text">Special Terms</div>
          <div class="px-3 py-2.5 bp-body-small text-text">N/A</div>
        </div>
      </div>

      <!-- Boilerplate + signatures -->
      <p class="bp-caption mt-6 text-secondary">
        This Statement of Work is entered into on the Effective Date pursuant to the supplier's standard terms of purchase set out in Annex A.
      </p>
      <div class="mt-8 grid grid-cols-2 gap-10">
        @for (party of ['Signed by Buyer', 'Signed by Supplier']; track party) {
          <div>
            <div class="bp-body-small font-semibold text-text">{{ party }}</div>
            @for (field of ['By', 'Name', 'Title', 'Date']; track field) {
              <div class="mt-4 flex items-baseline gap-2 bp-body-small text-text">
                <span class="font-semibold">{{ field }}:</span>
                <span class="flex-1 border-b border-dotted border-hairline">&nbsp;</span>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class SowDocumentComponent {
  private readonly projects = inject(ProjectService);
  private readonly orgs = inject(OrganisationService);

  readonly projectId = input.required<string>();
  readonly project = input.required<ProjectDetail>();
  readonly close = output<void>();

  constructor() {
    document.body.classList.add('quote-doc-open');
    inject(DestroyRef).onDestroy(() => document.body.classList.remove('quote-doc-open'));
  }

  protected readonly cur = computed(() => this.project().currency || 'GBP');

  private readonly orgRes = resource<OrgProfile, boolean>({
    params: () => true,
    loader: () => firstValueFrom(this.orgs.get()),
  });
  protected readonly org = computed(() => this.orgRes.value() ?? null);
  protected readonly supplierAddress = computed(() => {
    const o = this.org();
    return o ? [o.address, o.city].filter(Boolean).join(', ') : '';
  });
  protected readonly location = computed(() =>
    [this.project().venueName, this.project().venueCity].filter(Boolean).join(', '));
  /** Effective date — the project's created date, long form. */
  protected readonly effectiveDate = computed(() => {
    const iso = this.project().createdAt;
    const t = iso ? Date.parse(iso) : NaN;
    return Number.isNaN(t) ? '—' : new Date(t).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  });

  private readonly est = resource<EstimateBreakdown, string>({
    params: () => this.projectId(),
    loader: ({ params }) => firstValueFrom(this.projects.estimate(params, 'all')),
  });
  protected readonly bd = computed<EstimateBreakdown>(() => this.est.value() ?? EMPTY_BD);

  private readonly lines = resource<QuoteLine[], string>({
    params: () => this.projectId(),
    loader: ({ params }) => firstValueFrom(this.projects.quoteItems(params)),
  });
  /** Scope narrative seed — the quote's categories + their line names. */
  protected readonly scopeGroups = computed(() =>
    groupByCategory((this.lines.value() ?? []).filter((l) => !l.optionOfLineId && !isDeclined(l) && l.categoryId != null)));

  protected print(): void { window.print(); }
}

const EMPTY_BD: EstimateBreakdown = {
  hardCosts: 0, marginPct: 0, marginAmount: 0, projectCosts: 0,
  contingencyPct: 0, contingency: 0, insurancePct: 0, insurance: 0,
  coverage: 0, fees: 0, projectTotal: 0, subtotal: 0, clientTotal: 0,
};
