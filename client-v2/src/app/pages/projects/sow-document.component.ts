import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, resource } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { PdfPagesComponent } from '../../shared/pdf-pages.component';
import { MarkdownPipe } from '../../shared/markdown.pipe';
import { firstValueFrom } from 'rxjs';
import { ProjectService } from '../../core/projects/project.service';
import { OrganisationService, OrgProfile } from '../../core/organisation.service';
import { EstimateBreakdown, ProjectDetail, QuoteLine, groupByCategory } from '../../core/projects/project.types';
import { isDeclined } from './quote-line.util';

/** pV2-BUILDUP-04 — the client-facing STATEMENT OF WORK. A curated contract
 *  document (sibling to the Quote), reusing the same overlay + print isolation
 *  (.quote-doc / .quote-doc__paper / body.quote-doc-open) AND the Quote's visual
 *  language: agency header + meta table, title banner, boxed shaded sections, a
 *  gradient Fee banner. Structure follows the agency SOW: Parties, dates/version,
 *  Services & Goods (scope, seeded from the quote), Timeline, Fee (= estimate
 *  total, ex-VAT), Payment Terms, Special Terms, signatures. Editable content +
 *  the Annex A T&C merge land next; today the new fields render seeded/placeholder. */
@Component({
  selector: 'app-sow-document',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, LucideAngularModule, PdfPagesComponent, MarkdownPipe],
  host: { class: 'quote-doc fixed inset-0 z-50 overflow-y-auto bg-fill' },
  styles: [`
    .quote-doc__paper { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    /* Match the Quote's Default theme: soft brand gradient on the shaded bars,
       full gradient + white text on the headline Fee banner. */
    .sow-bar { background: var(--bp-gradient-soft); }
    .sow-fee { background: var(--bp-gradient); }
    .sow-fee, .sow-fee .bp-price-large, .sow-fee .bp-body-small { color: var(--bp-text-on-gradient); }
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
      <!-- Header — agency (logo + name + address) + meta table (Document / Version / Effective). -->
      <div class="mb-8 flex items-start justify-between gap-4">
        <div class="flex items-start gap-3">
          @if (org()?.logoUrl) {
            <img [src]="org()!.logoUrl" alt="" class="h-12 w-auto max-w-[120px] object-contain" />
          }
          <div>
            <div class="bp-list-title text-[length:var(--text-2xl)] font-bold tracking-tight">{{ org()?.name || 'Your Agency' }}</div>
            @for (ln of supplierAddressLines(); track $index) {
              <div class="bp-meta leading-relaxed">{{ ln }}</div>
            }
            @if (org()?.phone) {
              <div class="bp-meta font-medium leading-relaxed text-text">Phone: {{ org()!.phone }}</div>
            }
          </div>
        </div>
        <div class="shrink-0 overflow-hidden rounded-md border border-hairline bp-meta">
          <div class="grid grid-cols-[auto_auto]">
            <div class="border-b border-hairline bg-fill px-2.5 py-1 font-medium text-text">Project</div>
            <div class="border-b border-l border-hairline px-2.5 py-1 text-left text-text">{{ project().ref || '—' }}</div>
            <div class="border-b border-hairline bg-fill px-2.5 py-1 font-medium text-text">Type</div>
            <div class="border-b border-l border-hairline px-2.5 py-1 text-left text-text">Statement of Work</div>
            <div class="bg-fill px-2.5 py-1 font-medium text-text">Created</div>
            <div class="border-l border-hairline px-2.5 py-1 text-left text-text">{{ createdStr() }}</div>
          </div>
        </div>
      </div>

      <!-- Title banner -->
      <div class="mt-5 rounded-[var(--radius-card)] border border-hairline sow-bar px-6 py-6 text-center">
        <div class="bp-field-label">Statement of Work</div>
        <h1 class="bp-page-title text-[length:var(--text-hero)]">{{ project().name }}</h1>
      </div>

      <!-- Parties -->
      <section class="mt-6 overflow-hidden rounded-[var(--radius-card)] border border-hairline">
        <div class="sow-bar px-4 py-2.5 text-center"><span class="bp-page-label text-[length:var(--text-md)]">Parties</span></div>
        <div class="grid grid-cols-2 gap-4 border-t border-hairline px-4 py-3">
          <div>
            <div class="bp-field-label">Buyer</div>
            <div class="mt-1 bp-body-small text-text"><span class="font-semibold">{{ project().clientName || '[Client company]' }}</span>{{ buyerRest() }}</div>
          </div>
          <div>
            <div class="bp-field-label">Supplier</div>
            <div class="mt-1 bp-body-small text-text"><span class="font-semibold">{{ org()?.name || '[Your agency]' }}</span>{{ supplierRest() }}</div>
          </div>
        </div>
      </section>

      <!-- Services & Goods (scope) -->
      <section class="mt-6 overflow-hidden rounded-[var(--radius-card)] border border-hairline">
        <div class="sow-bar px-4 py-2.5 text-center"><span class="bp-page-label text-[length:var(--text-md)]">Services &amp; Goods</span></div>
        <div class="border-t border-hairline px-4 py-3 bp-body-small text-text">
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
      </section>

      <!-- Timeline -->
      <section class="mt-6 overflow-hidden rounded-[var(--radius-card)] border border-hairline">
        <div class="sow-bar px-4 py-2.5 text-center"><span class="bp-page-label text-[length:var(--text-md)]">Timeline</span></div>
        <div class="border-t border-hairline px-4 py-3 bp-body-small text-text">
          @if (timelineRows().length) {
            @for (row of timelineRows(); track $index) {
              <div class="flex items-baseline gap-3 border-b border-hairline py-1.5 last:border-b-0">
                <span class="min-w-0 flex-1">{{ row.label }}</span>
                <span class="w-24 shrink-0 text-right font-medium tabular-nums">{{ row.date1 }}</span>
                <span class="w-24 shrink-0 text-right font-medium tabular-nums">{{ row.date2 }}</span>
              </div>
            }
          } @else {
            <span class="italic text-secondary">Key dates &amp; milestones — add them on the project's Statement of Work section.</span>
          }
        </div>
      </section>

      <!-- Project Total — headline gradient banner (like the Quote). exc. VAT
           sits under the amount, same white as the price. -->
      <div class="sow-fee mt-6 flex items-center justify-between rounded-[var(--radius-card)] border border-hairline px-4 py-3">
        <span class="bp-price-large uppercase tracking-wide">Project Total</span>
        <span class="text-right leading-tight">
          <span class="bp-price-large block tabular-nums">{{ bd().projectTotal | currency: cur() : 'symbol' : '1.0-2' }}</span>
          <span class="bp-body-small block">exc. VAT</span>
        </span>
      </div>

      <!-- Payment Terms -->
      <section class="mt-6 overflow-hidden rounded-[var(--radius-card)] border border-hairline">
        <div class="sow-bar px-4 py-2.5 text-center"><span class="bp-page-label text-[length:var(--text-md)]">Payment Terms</span></div>
        <div class="border-t border-hairline px-4 py-3 bp-body-small text-text">
          @if (project().sowPaymentTerms) {
            <div class="bp-md" [innerHTML]="project().sowPaymentTerms | md"></div>
          } @else {
            <span class="italic text-secondary">Payment schedule — add it on the project's Statement of Work section.</span>
          }
        </div>
      </section>

      <!-- Special Terms -->
      <section class="mt-6 overflow-hidden rounded-[var(--radius-card)] border border-hairline">
        <div class="sow-bar px-4 py-2.5 text-center"><span class="bp-page-label text-[length:var(--text-md)]">Special Terms</span></div>
        <div class="border-t border-hairline px-4 py-3 bp-body-small text-text">
          @if (project().sowSpecialTerms) {
            <div class="bp-md" [innerHTML]="project().sowSpecialTerms | md"></div>
          } @else { N/A }
        </div>
      </section>

      <!-- Boilerplate + signatures -->
      <p class="bp-caption mt-6 text-secondary">
        This Statement of Work is entered into on the Effective Date pursuant to the supplier's standard terms of purchase set out in Annex A.
        @if (org()?.termsPdfUrl) {
          <a [href]="org()!.termsPdfUrl" target="_blank" rel="noopener" class="text-text underline">View Annex A — Terms &amp; Conditions</a> (attached to the PDF).
        } @else {
          <span class="italic">Annex A — Terms &amp; Conditions: upload your standard terms in the agency profile.</span>
        }
      </p>
      <div class="mt-6 grid grid-cols-2 gap-10">
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

      <!-- Annex A — the agency's standard T&C PDF, rendered inline as seamless
           pages (no viewer chrome) so it reads as part of the SOW. Screen preview;
           the crisp vector merge into the combined PDF lands with Puppeteer. -->
      @if (org()?.termsPdfUrl; as termsUrl) {
        <div class="mt-10 flex items-center gap-2 border-b-2 border-text pb-1.5">
          <span class="bp-page-label">Annex A — Terms &amp; Conditions</span>
        </div>
        <app-pdf-pages class="mt-4 block" [url]="termsUrl" />
      }
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
  /** Address wrapped on commas + city (phone rendered separately, labeled). */
  protected readonly supplierAddressLines = computed(() => {
    const o = this.org();
    if (!o) return [];
    const parts = (o.address ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (o.city) parts.push(o.city);
    return parts;
  });
  protected readonly supplierAddress = computed(() => this.supplierAddressLines().join(', '));
  /** The Buyer/Supplier sentence tail — ", company number …, whose principal
   *  place of business is at …." — assembled in code to avoid template-whitespace
   *  gaps (a space crept in before the period). */
  protected readonly buyerRest = computed(() => {
    const p = this.project();
    let s = '';
    if (p.clientCompanyNumber) s += `, company number ${p.clientCompanyNumber}`;
    if (p.clientAddress) s += `, whose principal place of business is at ${p.clientAddress}`;
    return `${s}.`;
  });
  protected readonly supplierRest = computed(() => {
    const o = this.org();
    let s = '';
    if (o?.companyNumber) s += `, company number ${o.companyNumber}`;
    if (this.supplierAddress()) s += `, whose principal place of business is at ${this.supplierAddress()}`;
    return `${s}.`;
  });
  /** The project's location value (the venue), not venue + city concatenated. */
  protected readonly location = computed(() => this.project().venueName || this.project().venueCity || '');
  /** Timeline → {label, date1, date2} rows for a 3-column table. Handles both
   *  input styles: label + date(s) inline ("Installation 20-Aug-2026 -
   *  21-Aug-2026"), AND a bare label line followed by a bare date line (blank
   *  lines ignored) — the two are paired into one milestone. date2 is '' when
   *  there's no range. */
  protected readonly timelineRows = computed(() => {
    const parse = (line: string) => {
      const m = line.match(/^(.*?)[\s—–-]*(\d{2}-[A-Za-z]{3}-\d{4})(?:\s*[–-]\s*(\d{2}-[A-Za-z]{3}-\d{4}))?\s*$/);
      return m ? { label: m[1].trim(), date1: m[2], date2: m[3] ?? '' } : { label: line, date1: '', date2: '' };
    };
    const lines = (this.project().sowTimeline ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
    const rows: { label: string; date1: string; date2: string }[] = [];
    for (let i = 0; i < lines.length; i += 1) {
      const cur = parse(lines[i]);
      // A bare label followed by a bare date → one milestone.
      if (cur.label && !cur.date1 && i + 1 < lines.length) {
        const next = parse(lines[i + 1]);
        if (!next.label && next.date1) {
          rows.push({ label: cur.label, date1: next.date1, date2: next.date2 });
          i += 1;
          continue;
        }
      }
      rows.push(cur);
    }
    return rows;
  });
  /** Created date + time (short, 24h) — matches the Quote's ref box. */
  protected readonly createdStr = computed(() => {
    const iso = this.project().createdAt;
    const t = iso ? Date.parse(iso) : NaN;
    if (Number.isNaN(t)) return '—';
    const d = new Date(t);
    const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${date} ${time}`;
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
    groupByCategory((this.lines.value() ?? []).filter((l) => !l.optionOfLineId && !isDeclined(l)))
      // Include the agent's own Fees/Project lines (uncategorised) as services.
      .map((g) => ({ ...g, name: g.id === '__none' ? 'Project Fees' : g.name })));

  protected print(): void { window.print(); }
}

const EMPTY_BD: EstimateBreakdown = {
  hardCosts: 0, marginPct: 0, marginAmount: 0, projectCosts: 0,
  contingencyPct: 0, contingency: 0, insurancePct: 0, insurance: 0,
  coverage: 0, fees: 0, projectTotal: 0, subtotal: 0, clientTotal: 0,
};
