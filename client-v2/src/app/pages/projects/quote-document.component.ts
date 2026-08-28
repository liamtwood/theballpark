import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, resource, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { ProjectService } from '../../core/projects/project.service';
import { OrganisationService, OrgProfile } from '../../core/organisation.service';
import { EstimateBreakdown, ProjectDetail, QuoteLine, groupByCategory } from '../../core/projects/project.types';
import { MarkdownPipe } from '../../shared/markdown.pipe';
import { ProjectSummaryTilesComponent } from './project-summary-tiles.component';
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
  imports: [CurrencyPipe, FormsModule, LucideAngularModule, MarkdownPipe, ProjectSummaryTilesComponent],
  host: {
    class: 'quote-doc fixed inset-0 z-50 overflow-y-auto bg-fill',
    '[style.--doc-accent]': 'docAccent()',
    '[style.--doc-bar-bg]': 'docBarBg()',
  },
  styles: [`
    /* Colour theming (Default / B&W / Pick a Colour) — driven by the host vars.
       Shaded bars tint with the accent; icons take it at full strength. */
    .doc-bar { background: var(--doc-bar-bg); }
    .doc-ink { color: var(--doc-accent); }
    /* Project Total (Default theme) — the full Ballpark gradient + white text,
       matching the app's brand total banner. */
    .doc-total--brand { background: var(--bp-gradient); }
    .doc-total--brand .bp-price-large { color: var(--bp-text-on-gradient); }
    /* Project Total (B&W theme) — solid black + white text. */
    .doc-total--bw { background: var(--color-text); }
    .doc-total--bw .bp-price-large { color: var(--bp-text-on-gradient); }
    /* Keep the shaded/tinted bars when printing (browsers drop backgrounds
       otherwise, so the PDF would lose the shading + colour). */
    .quote-doc__paper { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  `],
  template: `
    <!-- Action bar (screen only — hidden on print). -->
    <div class="quote-doc__bar sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-hairline bg-surface px-5 py-3">
      <button type="button" class="flex items-center gap-2 bp-body-small text-secondary transition-colors hover:text-text" (click)="close.emit()">
        <lucide-icon name="arrow-left" [size]="16" /> Back to builder
      </button>
      <button type="button" class="bp-btn-grad flex items-center gap-2" (click)="print()">
        <lucide-icon name="printer" [size]="15" /> Print / Save PDF
      </button>
    </div>

    <!-- The paper. -->
    <div class="quote-doc__paper mx-auto my-8 w-full max-w-3xl bg-surface p-12 shadow-sm">
      <!-- Header — the AGENCY (org sending the quote): logo, name, address. -->
      <div class="mb-8 flex items-start justify-between gap-4">
        <div class="flex items-start gap-3">
          @if (org()?.logoUrl) {
            <img [src]="org()!.logoUrl" alt="" class="h-12 w-auto max-w-[120px] object-contain" />
          }
          <div>
            <div class="bp-list-title text-[length:var(--text-2xl)] font-bold tracking-tight">{{ org()?.name || 'Your Agency' }}</div>
            @for (ln of agencyAddressLines(); track $index) {
              <div class="bp-meta leading-relaxed">{{ ln }}</div>
            }
          </div>
        </div>
        <!-- Meta table — shaded label column, left-justified values, address-size. -->
        <div class="shrink-0 overflow-hidden rounded-md border border-hairline bp-meta">
          <div class="grid grid-cols-[auto_auto]">
            <div class="border-b border-hairline bg-fill px-2.5 py-1 font-medium text-text">Project</div>
            <div class="border-b border-l border-hairline px-2.5 py-1 text-left text-text">{{ project().ref || '—' }}</div>
            <div class="border-b border-hairline bg-fill px-2.5 py-1 font-medium text-text">Type</div>
            <div class="border-b border-l border-hairline px-2.5 py-1 text-left text-text">Ballpark Quote</div>
            <div class="bg-fill px-2.5 py-1 font-medium text-text">Created</div>
            <div class="border-l border-hairline px-2.5 py-1 text-left text-text">{{ createdStr() }}</div>
          </div>
        </div>
      </div>
      <!-- Title banner — company + project name, shaded like the meta label
           column, rounded + bordered to match the tiles below. -->
      <div class="mt-5 rounded-[var(--radius-card)] border border-hairline doc-bar px-6 py-6 text-center">
        @if (project().clientName) {
          <div class="bp-field-label">{{ project().clientName }}</div>
        }
        <h1 class="bp-page-title text-[length:var(--text-hero)]">{{ project().name }}</h1>
      </div>

      <!-- Project overview — the project description (seeded from the brief),
           indented a little from both edges. -->
      @if (showOverview() && project().description) {
        <div class="bp-md bp-body-small mt-5 px-6 text-secondary" [innerHTML]="project().description | md"></div>
      }

      <!-- Date / Location / Duration / Guest count / Budget — the same tiles the
           builder shows, mounted here for parity. -->
      <div class="mt-5">
        <app-project-summary-tiles [project]="project()" [currency]="cur()" [stacked]="true" />
      </div>

      @if (est.isLoading()) {
        <p class="bp-body-small mt-8 text-secondary">Preparing the quote…</p>
      } @else {
        <!-- ===== PROJECT COSTS ===== -->
        <section class="mt-6 overflow-hidden rounded-[var(--radius-card)] border border-hairline">
          <div class="doc-bar px-4 py-2.5 text-center"><span class="bp-page-label text-[length:var(--text-md)]">Project Costs</span></div>
          <div class="border-t border-hairline px-4">
            @for (g of costGroups(); track g.id) {
              <!-- Category band — icon + name, like the cost cards. -->
              <div class="mt-3 flex items-center gap-2">
                <lucide-icon [name]="g.iconName || 'folder-open'" [size]="16" class="doc-ink" />
                <span class="bp-field-label">{{ g.name }}</span>
              </div>
              @for (l of g.items; track l.id) {
                <div class="flex items-start justify-between gap-4 border-b border-hairline py-3 last:border-b-0">
                  <div class="min-w-0 flex-1">
                    <div class="bp-body-small font-semibold text-text">{{ l.name }}</div>
                    @if (showItemDesc() && desc(l); as d) {
                      <div class="bp-md bp-meta mt-1 max-w-prose text-secondary" [innerHTML]="d | md"></div>
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
          </div>
          <div class="flex items-center justify-between border-t border-hairline doc-bar px-4 py-2.5">
            <span class="bp-field-label uppercase tracking-wide text-text">Total Project Costs</span>
            <span class="bp-body-small font-bold tabular-nums text-text">{{ bd().projectCosts | currency: cur() : 'symbol' : '1.0-0' }}</span>
          </div>
        </section>

        <!-- ===== PROJECT COVERAGE ===== -->
        <section class="mt-6 overflow-hidden rounded-[var(--radius-card)] border border-hairline">
          <div class="doc-bar px-4 py-2.5 text-center"><span class="bp-page-label text-[length:var(--text-md)]">Project Coverage</span></div>
          <div class="border-t border-hairline px-4">
            <div class="flex items-center justify-between border-b border-hairline py-3">
              <div class="flex items-center gap-2">
                <lucide-icon name="percent" [size]="16" class="doc-ink" />
                <div>
                  <div class="bp-body-small font-semibold text-text">Contingency</div>
                  <div class="bp-meta">{{ bd().contingencyPct }}% of project costs</div>
                </div>
              </div>
              <span class="bp-body-small w-20 text-right font-semibold tabular-nums text-text">{{ bd().contingency | currency: cur() : 'symbol' : '1.0-0' }}</span>
            </div>
            <div class="flex items-center justify-between py-3">
              <div class="flex items-center gap-2">
                <lucide-icon name="percent" [size]="16" class="doc-ink" />
                <div>
                  <div class="bp-body-small font-semibold text-text">Insurance</div>
                  <div class="bp-meta">{{ bd().insurancePct }}% of project costs</div>
                </div>
              </div>
              <span class="bp-body-small w-20 text-right font-semibold tabular-nums text-text">{{ bd().insurance | currency: cur() : 'symbol' : '1.0-0' }}</span>
            </div>
          </div>
          <div class="flex items-center justify-between border-t border-hairline doc-bar px-4 py-2.5">
            <span class="bp-field-label uppercase tracking-wide text-text">Total Coverage</span>
            <span class="bp-body-small font-bold tabular-nums text-text">{{ bd().coverage | currency: cur() : 'symbol' : '1.0-0' }}</span>
          </div>
        </section>

        <!-- ===== PROJECT FEES ===== -->
        @if (feesGroup(); as fg) {
          <section class="mt-6 overflow-hidden rounded-[var(--radius-card)] border border-hairline">
            <div class="doc-bar px-4 py-2.5 text-center"><span class="bp-page-label text-[length:var(--text-md)]">Project Fees</span></div>
            <div class="border-t border-hairline px-4">
              @for (l of fg.items; track l.id) {
                <div class="flex items-start justify-between gap-4 border-b border-hairline py-3 last:border-b-0">
                  <div class="min-w-0 flex-1">
                    <div class="bp-body-small font-semibold text-text">{{ l.name }}</div>
                    @if (showItemDesc() && desc(l); as d) {
                      <div class="bp-md bp-meta mt-1 max-w-prose text-secondary" [innerHTML]="d | md"></div>
                    }
                  </div>
                  <div class="flex shrink-0 items-baseline gap-4 tabular-nums">
                    <span class="bp-meta w-10 text-right text-secondary">{{ l.quantity }}</span>
                    <span class="bp-meta w-16 text-right text-secondary">{{ l.basePrice != null ? (l.basePrice | currency: cur() : 'symbol' : '1.0-0') : '' }}</span>
                    <span class="bp-body-small w-20 text-right font-semibold text-text">{{ lineCostRaw(l) | currency: cur() : 'symbol' : '1.0-0' }}</span>
                  </div>
                </div>
              }
            </div>
            <div class="flex items-center justify-between border-t border-hairline doc-bar px-4 py-2.5">
              <span class="bp-field-label uppercase tracking-wide text-text">Total Fees</span>
              <span class="bp-body-small font-bold tabular-nums text-text">{{ bd().fees | currency: cur() : 'symbol' : '1.0-0' }}</span>
            </div>
          </section>
        }

        <!-- ===== PROJECT SUMMARY ===== -->
        @if (showSummary()) {
        <section class="mt-6 overflow-hidden rounded-[var(--radius-card)] border border-hairline">
          <div class="doc-bar px-4 py-2.5 text-center"><span class="bp-page-label text-[length:var(--text-md)]">Project Summary</span></div>
          <div class="border-t border-hairline px-4">
            <div class="flex justify-between border-b border-hairline py-2.5"><span class="bp-body-small text-text">Project Costs</span><span class="bp-body-small tabular-nums text-text">{{ bd().projectCosts | currency: cur() : 'symbol' : '1.0-0' }}</span></div>
            <div class="flex justify-between border-b border-hairline py-2.5"><span class="bp-body-small text-text">Project Coverage</span><span class="bp-body-small tabular-nums text-text">{{ bd().coverage | currency: cur() : 'symbol' : '1.0-0' }}</span></div>
            <div class="flex justify-between py-2.5"><span class="bp-body-small text-text">Project Fees</span><span class="bp-body-small tabular-nums text-text">{{ bd().fees | currency: cur() : 'symbol' : '1.0-0' }}</span></div>
          </div>
          <div class="doc-total flex items-baseline justify-between border-t border-hairline px-4 py-3"
               [class.doc-total--brand]="mode() === 'default'" [class.doc-total--bw]="mode() === 'bw'" [class.doc-bar]="mode() === 'color'">
            <span class="bp-price-large uppercase tracking-wide">Project Total</span>
            <span class="bp-price-large tabular-nums">{{ bd().projectTotal | currency: cur() : 'symbol' : '1.0-0' }}</span>
          </div>
        </section>
        }

        @if (showVatNote() || footer() || showCreated()) {
          <div class="mt-8 flex items-end justify-between gap-4 border-t border-hairline pt-3">
            <div class="bp-caption">
              @if (showVatNote()) { <p>Excludes VAT.</p> }
              @if (footer()) { <p class="whitespace-pre-line">{{ footer() }}</p> }
            </div>
            @if (showCreated()) {
              <p class="bp-caption shrink-0">Created {{ createdStr() }}</p>
            }
          </div>
        }
      }
    </div>

    <!-- Options panel (screen only — outside .quote-doc__paper, so the global
         print rule hides it). Standard Ballpark card chrome. -->
    <aside class="fixed right-6 top-24 z-10 hidden w-64 lg:block">
      <div class="bp-card p-4">
        <h3 class="bp-edit-section-title">Options</h3>

        <div class="mt-4">
          <span class="bp-field-label">Theme</span>
          <div class="mt-2 flex flex-col gap-1.5">
            <button type="button" class="flex items-center justify-between rounded-[var(--radius-card)] border px-3 py-2 bp-body-small transition-colors"
                    [class.border-hairline]="mode() !== 'default'" [class.text-secondary]="mode() !== 'default'"
                    [class.border-text]="mode() === 'default'" [class.text-text]="mode() === 'default'"
                    (click)="setMode('default')">
              Default @if (mode() === 'default') { <lucide-icon name="check" [size]="15" /> }
            </button>
            <button type="button" class="flex items-center justify-between rounded-[var(--radius-card)] border px-3 py-2 bp-body-small transition-colors"
                    [class.border-hairline]="mode() !== 'bw'" [class.text-secondary]="mode() !== 'bw'"
                    [class.border-text]="mode() === 'bw'" [class.text-text]="mode() === 'bw'"
                    (click)="setMode('bw')">
              B &amp; W @if (mode() === 'bw') { <lucide-icon name="check" [size]="15" /> }
            </button>
            <button type="button" class="flex items-center justify-between gap-2 rounded-[var(--radius-card)] border px-3 py-2 bp-body-small transition-colors"
                    [class.border-hairline]="mode() !== 'color'" [class.text-secondary]="mode() !== 'color'"
                    [class.border-text]="mode() === 'color'" [class.text-text]="mode() === 'color'"
                    (click)="setMode('color')">
              <span>Pick a colour</span>
              <span class="flex items-center gap-2">
                <input type="color" class="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
                       [ngModel]="pickedColor()" (ngModelChange)="onColor($event)" (click)="$event.stopPropagation()" />
                @if (mode() === 'color') { <lucide-icon name="check" [size]="15" /> }
              </span>
            </button>
          </div>
        </div>

        <div class="mt-5">
          <span class="bp-field-label">Footer</span>
          <div class="mt-2 flex flex-col gap-2">
            <label class="flex items-center gap-2 bp-body-small text-secondary">
              <input type="checkbox" class="bp-check" [ngModel]="showVatNote()" (ngModelChange)="showVatNote.set($event); saveOptions()" /> Exclude VAT
            </label>
            <label class="flex items-center gap-2 bp-body-small text-secondary">
              <input type="checkbox" class="bp-check" [ngModel]="showPageNumbers()" (ngModelChange)="showPageNumbers.set($event); saveOptions()" /> Page numbers
            </label>
            <label class="flex items-center gap-2 bp-body-small text-secondary">
              <input type="checkbox" class="bp-check" [ngModel]="showCreated()" (ngModelChange)="showCreated.set($event); saveOptions()" /> Created date
            </label>
          </div>
          <textarea rows="2" class="bp-store-textarea mt-2 w-full" placeholder="Custom footer text…"
                    [ngModel]="footer()" (ngModelChange)="footer.set($event)" (blur)="saveOptions()"></textarea>
        </div>

        <div class="mt-5">
          <span class="bp-field-label">Body</span>
          <div class="mt-2 flex flex-col gap-2">
            <label class="flex items-center gap-2 bp-body-small text-secondary">
              <input type="checkbox" class="bp-check" [ngModel]="showItemDesc()" (ngModelChange)="showItemDesc.set($event); saveOptions()" /> Item descriptions
            </label>
            <label class="flex items-center gap-2 bp-body-small text-secondary">
              <input type="checkbox" class="bp-check" [ngModel]="showOverview()" (ngModelChange)="showOverview.set($event); saveOptions()" /> Project overview
            </label>
            <label class="flex items-center gap-2 bp-body-small text-secondary">
              <input type="checkbox" class="bp-check" [ngModel]="showSummary()" (ngModelChange)="showSummary.set($event); saveOptions()" /> Project summary
            </label>
          </div>
        </div>
      </div>
    </aside>
  `,
})
export class QuoteDocumentComponent implements OnInit {
  private readonly projects = inject(ProjectService);
  private readonly orgs = inject(OrganisationService);

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

  // ── Quote document options (persisted per project) ─────────────────────────
  protected readonly mode = signal<'default' | 'bw' | 'color'>('default');
  protected readonly pickedColor = signal('#6d28d9');
  protected readonly footer = signal('');
  protected readonly showCreated = signal(false);
  protected readonly showVatNote = signal(true);
  protected readonly showPageNumbers = signal(false);
  protected readonly showItemDesc = signal(true);
  protected readonly showOverview = signal(true);
  protected readonly showSummary = signal(true);

  /** Seed the options from the stored project values (defaults when unset). */
  ngOnInit(): void {
    const p = this.project();
    if (p.quoteThemeMode) this.mode.set(p.quoteThemeMode);
    if (p.quoteThemeColor) this.pickedColor.set(p.quoteThemeColor);
    // The old default footer text "Excludes VAT." migrates to the VAT-note toggle.
    this.footer.set(p.quoteFooter && p.quoteFooter !== 'Excludes VAT.' ? p.quoteFooter : '');
    this.showCreated.set(!!p.quoteShowCreated);
    this.showVatNote.set(p.quoteShowVatNote ?? true);
    this.showPageNumbers.set(!!p.quoteShowPageNumbers);
    this.showItemDesc.set(p.quoteShowItemDesc ?? true);
    this.showOverview.set(p.quoteShowOverview ?? true);
    this.showSummary.set(p.quoteShowSummary ?? true);
  }
  protected setMode(m: 'default' | 'bw' | 'color'): void { this.mode.set(m); this.saveOptions(); }
  protected onColor(hex: string): void { this.pickedColor.set(hex); this.mode.set('color'); this.saveOptions(); }
  /** Persist the options to the project (agent's own — project-owner PUT). */
  protected async saveOptions(): Promise<void> {
    try {
      await firstValueFrom(this.projects.update(this.projectId(), {
        quoteThemeMode: this.mode(),
        quoteThemeColor: this.pickedColor(),
        quoteFooter: this.footer().trim() || null,
        quoteShowCreated: this.showCreated(),
        quoteShowVatNote: this.showVatNote(),
        quoteShowPageNumbers: this.showPageNumbers(),
        quoteShowItemDesc: this.showItemDesc(),
        quoteShowOverview: this.showOverview(),
        quoteShowSummary: this.showSummary(),
      }));
    } catch {
      // Non-fatal — the local view keeps the choice; it just didn't persist.
    }
  }
  /** Accent for icons + Project Total: theme accent (default), grey (B&W), or
   *  the picked colour. */
  protected readonly docAccent = computed(() => {
    switch (this.mode()) {
      case 'bw': return 'var(--color-text-secondary)';
      case 'color': return this.pickedColor();
      default: return 'var(--theme-accent)';
    }
  });
  /** Shaded-bar background: the soft Ballpark brand gradient (Default), neutral
   *  fill (B&W), or a light wash of the picked colour. */
  protected readonly docBarBg = computed(() => {
    switch (this.mode()) {
      case 'color': return `color-mix(in srgb, ${this.pickedColor()} 12%, var(--color-surface))`;
      case 'bw': return 'var(--color-fill)';
      default: return 'var(--bp-gradient-soft)';
    }
  });

  protected readonly subtitle = computed(() =>
    [this.project().eventType, this.project().venueCity].filter(Boolean).join(' · '));

  /** The agency (the org sending the quote) — its own logo/name/address header. */
  private readonly orgRes = resource<OrgProfile, boolean>({
    params: () => true,
    loader: () => firstValueFrom(this.orgs.get()),
  });
  protected readonly org = computed(() => this.orgRes.value() ?? null);
  /** Address wrapped on commas + city on its own line (no country) — e.g.
   *  "Ballpark House, Kensington" + city "London" → 3 lines. */
  protected readonly agencyAddressLines = computed(() => {
    const o = this.org();
    if (!o) return [];
    const parts = (o.address ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (o.city) parts.push(o.city);
    return parts;
  });
  /** Quote created date + time — short form, 24h clock (e.g. "25 Aug 2026 13:10"). */
  protected readonly createdStr = computed(() => {
    const iso = this.project().createdAt;
    const t = iso ? Date.parse(iso) : NaN;
    if (Number.isNaN(t)) return '';
    const d = new Date(t);
    const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${date} ${time}`;
  });

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
  /** The client-facing description: the agent's override, else the supplier text. */
  protected desc(l: QuoteLine): string | null { return l.quoteDescription || l.description; }
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
