// pV2-SOW-01 (Phase 2) — the SOW at the top of a per-supplier inbox thread.
// Rendered as section cards with pink pill headers: Timeline and Fees & Payment
// show as clean read-only TABLES (edited in a dialog via the pencil); Services &
// Goods is a row list with per-row pencil/N/A. Boilerplate hidden. Content
// pre-filled from the project + the supplier's items. Author (supplier) edits
// while draft; the agency signs first, the supplier counter-signs.
// Edits use a local working copy (edited); save() PATCHes on change.

import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { SowService } from '../../core/sow/sow.service';
import { Sow, SowContent, SowItemOverride, SowParties, SowPaymentRow, SowPrefill, SowProductionItem, SowSection, SowTimelineEntry } from '../../core/sow/sow.types';
import { InboxThread, InboxProjectSummary } from '../../core/inbox/inbox.service';
import { ModalComponent } from '../../shared/modal/modal.component';
import { StatusPillComponent } from '../../shared/status-pill/status-pill.component';
import { MarkdownPipe } from '../../shared/markdown.pipe';
import { errorDetail } from '../../core/http-error';
import { CodelistService } from '../../core/codelists/codelist.service';

@Component({
  selector: 'app-sow-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule, ModalComponent, StatusPillComponent, MarkdownPipe],
  template: `
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-2.5">
        <h3 class="bp-card-title">Statement of Work</h3>
        @if (current(); as s) { <app-status-pill list="sow_status" [code]="s.status" /> }
      </div>
      <div class="flex items-center gap-2">
        @if (canCreate()) { <button type="button" class="bp-act bp-act--primary" [disabled]="busy()" (click)="create()">{{ busy() ? 'Creating…' : 'Create SOW' }}</button> }
      </div>
    </div>

    @if (sowsRes.isLoading()) { <p class="bp-body-small text-secondary mt-2">Loading…</p> }

    @if (current(); as s) {
      <div class="mt-3 flex flex-col gap-3">

        @for (sec of sections(); track $index; let si = $index) {
          <div class="bp-card">
            <div class="bp-sow-head">
              <div class="flex items-center gap-2 min-w-0 flex-1">
                <span class="bp-card-title whitespace-nowrap">Section {{ si + 1 }} ·</span>
                @if (editable() && !sec.signature) {
                  <input class="bp-sow-title flex-1" [ngModel]="sec.title" (ngModelChange)="mutSectionTitle(si, $event)" (change)="save()" placeholder="Section title" />
                } @else { <span class="bp-card-title">{{ sec.title }}</span> }
              </div>
              @if (editable() && !sec.signature) {
                <div class="flex shrink-0 items-center gap-2">
                  <label class="bp-caption flex items-center gap-1"><input type="checkbox" class="accent-[var(--theme-accent)]" [checked]="!!sec.na" (change)="mutSectionNa(si, $any($event.target).checked)" /> N/A</label>
                  @if (!sec.na) {
                    <button type="button" class="bp-sow-ibtn" title="Edit section text" (click)="openEditSection(si)"><lucide-icon name="pencil" [size]="15" /></button>
                    <button type="button" class="bp-sow-icon" title="Add subsection" (click)="addSub(si)"><lucide-icon name="circle-plus" [size]="18" /></button>
                  }
                  <button type="button" class="bp-sow-ibtn" title="Remove section" (click)="removeSection(si)"><lucide-icon name="trash-2" [size]="14" /></button>
                </div>
              }
            </div>

            @if (sec.na) {
              <div class="p-4 pt-3 bp-body-small text-muted italic">N/A</div>
            } @else if (sec.signature) {
              <div class="p-4 pt-3">
                <p class="bp-body-small text-secondary whitespace-pre-line">{{ bp('conclusion') }}</p>
                <div class="mt-3 flex flex-wrap items-end gap-8 bp-body-small">
                  <div><div class="bp-caption text-muted">Agency</div><div class="font-semibold">{{ s.status === 'counterparty_signed' || s.status === 'executed' ? 'Signed' : 'Awaiting signature' }}</div></div>
                  <div><div class="bp-caption text-muted">Supplier</div><div class="font-semibold">{{ s.status === 'executed' ? 'Signed' : 'Awaiting signature' }}</div></div>
                  @if (canSign()) { <button type="button" class="bp-act bp-act--green" (click)="openSign()">{{ signLabel() }}</button> }
                </div>
              </div>
            } @else {
              <div class="p-4 pt-3 flex flex-col gap-3">
                @if (sec.text) { <div class="bp-md bp-body-small text-secondary whitespace-pre-line" [innerHTML]="sec.text | md"></div> }
                @for (sub of sec.subs; track $index; let sj = $index) {
                  <div class="group">
                    <div class="flex items-start justify-between gap-2">
                      <div class="flex items-baseline gap-2 min-w-0 flex-1">
                        <span class="bp-card-title whitespace-nowrap">{{ si + 1 }}.{{ sj + 1 }}</span>
                        @if (editable()) {
                          <input class="bp-sow-title flex-1" [ngModel]="sub.title" (ngModelChange)="mutSubTitle(si, sj, $event)" (change)="save()" placeholder="Subsection title" />
                        } @else { <span class="bp-card-title">{{ sub.title }}</span> }
                      </div>
                      @if (editable()) {
                        <div class="flex shrink-0 items-center gap-2">
                          <label class="bp-caption flex items-center gap-1 text-muted"><input type="checkbox" class="accent-[var(--theme-accent)]" [checked]="!!sub.na" (change)="mutSubNa(si, sj, $any($event.target).checked)" /> N/A</label>
                          @if (!sub.na) { <button type="button" class="bp-sow-ibtn" title="Edit text" (click)="openEditSub(si, sj)"><lucide-icon name="pencil" [size]="15" /></button> }
                          <button type="button" class="bp-sow-ibtn" title="Remove" (click)="removeSub(si, sj)"><lucide-icon name="trash-2" [size]="14" /></button>
                        </div>
                      }
                    </div>
                    @if (sub.na) { <div class="bp-caption text-muted italic mt-1">N/A</div> }
                    @else {
                      @if (sub.text) { <div class="bp-md bp-body-small text-secondary mt-1" [innerHTML]="sub.text | md"></div> }
                      @switch (sub.table) {
                        @case ('parties') {
                          <div class="overflow-hidden rounded-md border border-hairline mt-1">
                            <div class="grid grid-cols-[150px_minmax(0,1fr)] gap-x-4 border-b border-hairline bg-fill px-3 py-2">
                              <span class="bp-table-column-header">Party</span><span class="bp-table-column-header">Details</span>
                            </div>
                            <div class="grid grid-cols-[150px_minmax(0,1fr)] items-start gap-x-4 border-b border-hairline px-3 py-1.5 bp-body-small">
                              <span class="font-semibold">Agency (Buyer)</span>
                              @if (editable()) { <input class="bp-sow-cell" [ngModel]="partyValue('agency')" (ngModelChange)="mutParty('agency',$event)" (change)="save()" /> } @else { <span>{{ partyValue('agency') }}</span> }
                            </div>
                            <div class="grid grid-cols-[150px_minmax(0,1fr)] items-start gap-x-4 px-3 py-1.5 bp-body-small">
                              <span class="font-semibold">Supplier</span>
                              @if (editable()) { <input class="bp-sow-cell" [ngModel]="partyValue('supplier')" (ngModelChange)="mutParty('supplier',$event)" (change)="save()" /> } @else { <span>{{ partyValue('supplier') }}</span> }
                            </div>
                          </div>
                        }
                        @case ('projectDetails') {
                          <div class="overflow-hidden rounded-md border border-hairline mt-1">
                            <div class="grid grid-cols-[160px_minmax(0,1fr)] gap-x-4 border-b border-hairline bg-fill px-3 py-2">
                              <span class="bp-table-column-header">Field</span><span class="bp-table-column-header">Value</span>
                            </div>
                            @for (row of projectDetailRows(); track row.label) {
                              <div class="grid grid-cols-[160px_minmax(0,1fr)] items-start gap-x-4 border-b border-hairline last:border-0 px-3 py-1.5 bp-body-small">
                                <span class="font-semibold">{{ row.label }}</span>
                                @if (editable()) { <input class="bp-sow-cell" [ngModel]="row.value" (ngModelChange)="mutDetail(row.label,$event)" (change)="save()" /> } @else { <span>{{ row.value || '—' }}</span> }
                              </div>
                            }
                          </div>
                        }
                        @case ('timeline') {
                          <div class="overflow-hidden rounded-md border border-hairline mt-1">
                            <div class="grid grid-cols-[110px_64px_64px_minmax(0,1fr)_32px] items-center gap-x-4 border-b border-hairline bg-fill px-3 py-2">
                              <span class="bp-table-column-header">Date</span><span class="bp-table-column-header">To</span><span class="bp-table-column-header">From</span><span class="bp-table-column-header">Details</span>
                              @if (editable()) { <button type="button" class="bp-sow-icon justify-self-end" title="Add date" (click)="addTimeline()"><lucide-icon name="circle-plus" [size]="18" /></button> }
                            </div>
                            @for (e of timeline(); track $index) {
                              <div class="grid grid-cols-[110px_64px_64px_minmax(0,1fr)_32px] items-center gap-x-4 border-b border-hairline last:border-0 px-3 py-1 bp-body-small">
                                @if (editable()) {
                                  <input class="bp-sow-cell" [ngModel]="e.date" (ngModelChange)="mutTimeline($index,'date',$event)" (change)="save()" />
                                  <input class="bp-sow-cell" [ngModel]="e.to" (ngModelChange)="mutTimeline($index,'to',$event)" (change)="save()" />
                                  <input class="bp-sow-cell" [ngModel]="e.from" (ngModelChange)="mutTimeline($index,'from',$event)" (change)="save()" />
                                  <input class="bp-sow-cell" [ngModel]="e.details" (ngModelChange)="mutTimeline($index,'details',$event)" (change)="save()" />
                                  <button type="button" class="bp-sow-ibtn justify-self-end" title="Remove" (click)="removeTimeline($index)"><lucide-icon name="trash-2" [size]="14" /></button>
                                } @else {
                                  <span class="font-semibold">{{ e.date || '—' }}</span><span>{{ e.to }}</span><span>{{ e.from }}</span><span>{{ e.details }}</span><span></span>
                                }
                              </div>
                            }
                            @if (!timeline().length && !editable()) { <div class="px-3 py-2 bp-body-small text-muted italic">—</div> }
                          </div>
                        }
                        @case ('production') {
                          <div class="overflow-hidden rounded-md border border-hairline mt-1">
                            <div class="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.8fr)_48px_minmax(0,1.3fr)_90px] items-center gap-x-3 border-b border-hairline bg-fill px-3 py-2">
                              <span class="bp-table-column-header">Item</span><span class="bp-table-column-header">Spec</span><span class="bp-table-column-header">Qty</span><span class="bp-table-column-header">Variant</span><span class="bp-table-column-header text-right">Total</span>
                            </div>
                            @for (it of items(); track it.itemId) {
                              <div class="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.8fr)_48px_minmax(0,1.3fr)_90px] items-start gap-x-3 border-b border-hairline last:border-0 px-3 py-1.5 bp-body-small">
                                <span class="font-semibold">{{ it.item }}</span>
                                @if (editable()) { <input class="bp-sow-cell text-secondary" [ngModel]="it.spec" (ngModelChange)="mutItem(it.itemId,'spec',$event)" (change)="save()" /> } @else { <span class="text-secondary">{{ it.spec }}</span> }
                                <span class="text-center">{{ it.qty }}</span>
                                <span>{{ it.variant || '—' }}</span>
                                <span class="text-right font-semibold">{{ money(it.total) }}</span>
                                @if (it.priceNotes) { <div class="col-span-5 bp-caption text-muted italic pt-0.5">{{ it.priceNotes }}</div> }
                                @else if (editable()) { <input class="bp-sow-cell col-span-5 bp-caption text-muted pt-0.5" placeholder="Price note (e.g. price-matched from …)" [ngModel]="it.priceNotes" (ngModelChange)="mutItem(it.itemId,'priceNotes',$event)" (change)="save()" /> }
                              </div>
                            } @empty {
                              <div class="px-3 py-3 bp-body-small text-muted italic">No agreed items yet — items appear here once both sides accept them.</div>
                            }
                            @if (items().length) {
                              <div class="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.8fr)_48px_minmax(0,1.3fr)_90px] items-center gap-x-3 bg-fill px-3 py-2 bp-body-small">
                                <span class="col-span-4 font-semibold">Total (exc. VAT)</span><span class="text-right font-semibold">{{ money(itemsTotal()) }}</span>
                              </div>
                            }
                          </div>
                        }
                        @case ('payment') {
                          <div class="overflow-hidden rounded-md border border-hairline mt-1">
                            <div class="grid grid-cols-[110px_90px_90px_110px_minmax(0,1fr)_32px] items-center gap-x-4 border-b border-hairline bg-fill px-3 py-2">
                              <span class="bp-table-column-header">Date</span><span class="bp-table-column-header">Grace</span><span class="bp-table-column-header">Amount</span><span class="bp-table-column-header">Refundable</span><span class="bp-table-column-header">Details</span>
                              @if (editable()) { <button type="button" class="bp-sow-icon justify-self-end" title="Add row" (click)="addPayment()"><lucide-icon name="circle-plus" [size]="18" /></button> }
                            </div>
                            @for (r of payment(); track $index) {
                              <div class="grid grid-cols-[110px_90px_90px_110px_minmax(0,1fr)_32px] items-center gap-x-4 border-b border-hairline last:border-0 px-3 py-1 bp-body-small">
                                @if (editable()) {
                                  <input class="bp-sow-cell" [ngModel]="r.date" (ngModelChange)="mutPay($index,'date',$event)" (change)="save()" />
                                  <input class="bp-sow-cell" [ngModel]="r.grace" (ngModelChange)="mutPay($index,'grace',$event)" (change)="save()" />
                                  <input class="bp-sow-cell" [ngModel]="r.amount" (ngModelChange)="mutPay($index,'amount',$event)" (change)="save()" />
                                  <select class="bp-sow-cell" [ngModel]="r.refundable" (ngModelChange)="mutPay($index,'refundable',$event); save()"><option value="yes">Yes</option><option value="no">No</option><option value="partial">Partial</option><option value="na">N/A</option></select>
                                  <input class="bp-sow-cell" [ngModel]="r.details" (ngModelChange)="mutPay($index,'details',$event)" (change)="save()" />
                                  <button type="button" class="bp-sow-ibtn justify-self-end" title="Remove" (click)="removePayment($index)"><lucide-icon name="trash-2" [size]="14" /></button>
                                } @else {
                                  <span class="font-semibold">{{ r.date || '—' }}</span><span>{{ r.grace }}</span><span class="font-semibold">{{ r.amount }}</span><span>{{ refundableLabel(r.refundable) }}</span><span>{{ r.details }}</span><span></span>
                                }
                              </div>
                            }
                            <div class="px-3 py-2 bp-caption text-muted">Ballpark platform fee: {{ s.platformFeePct ?? 3 }}%</div>
                          </div>
                        }
                      }
                      @if (sub.file) { <a class="bp-body-small text-secondary underline mt-1 inline-block" [href]="sub.file.url" target="_blank" rel="noopener">{{ sub.file.name }}</a> }
                    }
                  </div>
                }
              </div>
            }
          </div>
        }

        @if (editable()) { <button type="button" class="bp-act bp-act--outline self-start" (click)="addSection()">+ Add section</button> }

        @if (s.status === 'counterparty_signed') {
          <p class="bp-body-small text-secondary">
            @if (isAuthor()) { Signed by the other party — your counter-signature executes it. }
            @else { You've signed — awaiting the author's counter-signature. }
          </p>
        }
        @if (s.status === 'executed') { <p class="bp-body-small font-semibold text-success">Executed.</p> }
      </div>
    } @else if (!sowsRes.isLoading()) {
      <p class="bp-body-small text-secondary mt-2">
        @if (viewer() === 'supplier') { No SOW yet — create one to send to the agency. }
        @else { The supplier hasn't created a SOW yet. }
      </p>
    }

    @if (error()) { <p class="bp-body-small text-danger mt-2">{{ error() }}</p> }

    <!-- prose edit dialog -->
    <app-modal [open]="editOpen()" [title]="'Edit ' + editLabel()" (close)="editOpen.set(false)">
      <textarea class="ed-textarea min-h-40 w-full" [ngModel]="editText()" (ngModelChange)="editText.set($event)" placeholder="Markdown supported"></textarea>
      <button modalFooter type="button" class="bp-btn--secondary" (click)="editOpen.set(false)">Cancel</button>
      <button modalFooter type="button" class="bp-btn--primary" [disabled]="busy()" (click)="saveEdit()">{{ busy() ? 'Saving…' : 'Save' }}</button>
    </app-modal>

    <!-- sign dialog -->
    <app-modal [open]="signOpen()" [title]="signLabel() + ' the SOW'" (close)="signOpen.set(false)">
      <div class="flex flex-col gap-3">
        <label class="bp-body-small text-secondary">Your name <input class="ed-input" [ngModel]="signName()" (ngModelChange)="signName.set($event)" /></label>
        <label class="bp-body-small text-secondary">Title (optional) <input class="ed-input" [ngModel]="signTitle()" (ngModelChange)="signTitle.set($event)" /></label>
      </div>
      <button modalFooter type="button" class="bp-btn--secondary" (click)="signOpen.set(false)">Cancel</button>
      <button modalFooter type="button" class="bp-btn--primary" [disabled]="busy() || !signName().trim()" (click)="doSign()">{{ busy() ? 'Signing…' : signLabel() }}</button>
    </app-modal>
  `,
  styles: [`
    .bp-sow-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; background: color-mix(in srgb, var(--theme-accent) 13%, var(--color-surface)); border-radius: 9999px; margin: 0.4rem 0.4rem 0.1rem; padding: 0.45rem 1.1rem; }
    .bp-sow-icon { color: var(--theme-accent); display: inline-flex; align-items: center; justify-content: center; line-height: 0; }
    .bp-sow-ibtn { color: var(--color-text-secondary); display: inline-flex; align-items: center; justify-content: center; line-height: 0; padding: 2px; }
    .bp-sow-ibtn:hover { color: var(--color-text); }
    .bp-sow-cell { width: 100%; min-width: 0; border: none; background: transparent; padding: 0.25rem 0; font: inherit; color: inherit; }
    .bp-sow-cell:focus { outline: none; background: var(--color-fill); border-radius: 3px; }
    .bp-sow-title { min-width: 0; border: none; background: transparent; padding: 0 0.15rem; font-family: var(--bp-font); font-size: var(--text-xl); font-weight: 600; line-height: var(--leading-snug); color: var(--color-text-strong); }
    .bp-sow-title:focus { outline: none; background: var(--color-fill); border-radius: 3px; }
    table th { font-size: 0.72rem; }
  `],
})
export class SowPanelComponent {
  readonly thread = input.required<InboxThread>();
  readonly viewer = input.required<'agency' | 'supplier'>();
  readonly project = input<InboxProjectSummary | null>(null);

  private readonly sowSvc = inject(SowService);

  protected readonly sowsRes = resource({
    params: () => this.thread()?.projectId || undefined,
    loader: ({ params }) => firstValueFrom(this.sowSvc.list(params)),
  });
  private readonly sows = computed<Sow[]>(() => {
    const all = this.sowsRes.value() ?? [];
    const sup = this.thread()?.supplierOrgId;
    return all.filter((s) => s.supplierOrgId === sup);
  });
  protected readonly current = computed<Sow | null>(() => this.sows().find((s) => s.status !== 'declined') ?? null);

  protected readonly edited = linkedSignal<SowContent>(() => (this.current()?.content as SowContent) ?? {});

  private readonly myOrgId = computed(() => (this.viewer() === 'supplier' ? this.thread()?.supplierOrgId : this.thread()?.agencyOrgId) ?? null);
  protected readonly isAuthor = computed(() => { const s = this.current(); return !!s && !!this.myOrgId() && s.orgId === this.myOrgId(); });
  protected readonly editable = computed(() => this.isAuthor() && this.current()?.status === 'draft');

  protected readonly canCreate = computed(() => !this.current() && this.viewer() === 'supplier');
  protected readonly canSign = computed(() => { const s = this.current(); if (!s) return false; return this.isAuthor() ? s.status === 'counterparty_signed' : s.status === 'draft'; });
  protected readonly signLabel = computed(() => (this.isAuthor() ? 'Counter-sign' : 'Sign'));

  protected readonly timeline = computed<SowTimelineEntry[]>(() => this.edited().timeline?.entries ?? []);
  protected readonly payment = computed<SowPaymentRow[]>(() => this.edited().payment?.rows ?? []);
  // The document structure — the author's saved sections, or the seeded default
  // (which keeps re-rendering codelist boilerplate until the author first edits).
  protected readonly sections = computed<SowSection[]>(() => this.edited().sections ?? this.defaultSections());
  private defaultSections(): SowSection[] {
    return [
      { title: 'Document Purpose', text: this.bp('intro'), subs: [] },
      { title: 'Parties & Project', text: null, subs: [
        { title: 'SOW Parties', text: null, table: 'parties' },
        { title: 'Project Details', text: null, table: 'projectDetails' },
      ] },
      { title: 'Project Milestones', text: null, subs: [
        { title: 'Timeline', text: null, table: 'timeline' },
      ] },
      { title: 'Services & Goods', text: this.servicesIntro, subs: [
        { title: 'Scope', text: null },
        { title: 'Concept & Design Sign-off', text: null },
        { title: 'Bespoke Render', text: null },
        { title: 'Production, Pricing & Price-Matched Items', text: null, table: 'production' },
        { title: 'Install / De-rig', text: null },
        { title: 'Staffing', text: null },
        { title: 'Logistics & Other', text: null },
      ] },
      { title: 'Fees & Payment', text: null, subs: [
        { title: 'Payment Schedule', text: this.bp('payment_schedule'), table: 'payment' },
        { title: 'Special Terms', text: null },
      ] },
      { title: 'Signature', signature: true, subs: [] },
      { title: 'Terms & Conditions', text: "The Supplier's standard terms & conditions apply (attached at supplier level).", subs: [] },
    ];
  }
  // Section 4 items are DERIVED from the thread's approved (both-accepted) line
  // items — the agreed scope, not a hand-built list. source/priceNotes come from
  // the author's stored overlay (SowItemOverride), merged by itemId.
  protected readonly items = computed<SowProductionItem[]>(() => {
    const ov = new Map((this.edited().itemOverrides ?? []).map((o) => [o.itemId, o]));
    return (this.thread()?.items ?? [])
      .filter((it) => it.buyerAccepted && it.sellerAccepted)
      .map((it) => {
        const key = it.itemId ?? it.id;
        const o = ov.get(key);
        return {
          itemId: key,
          item: it.name,
          spec: o?.spec ?? it.description,
          qty: it.quantity,
          variant: it.variant ?? null,
          priceNotes: o?.priceNotes ?? null,
          total: it.priceCurrent ?? it.priceRef,
        } as SowProductionItem;
      });
  });
  protected readonly itemsTotal = computed(() => this.items().reduce((s, it) => s + (Number(it.total) || 0), 0));
  protected readonly servicesIntro = 'The Supplier is responsible for delivering the following services and scope of work, as confirmed and costed via Ballpark.';

  // Boilerplate (fixed) copy — shown but not editable (verbatim from the SOW spec).
  protected readonly introText =
    'This Statement of Work ("SOW") is entered into directly between the Agency and the Supplier named below in connection with the project described. It was generated using cost data and scope details submitted through the Ballpark platform (www.theballpark.ai — operated by The Ballpark AI Ltd, "Ballpark").\n\n' +
    'Ballpark is a technology platform that connects Agencies with Suppliers and provides ballpark cost estimates, booking tools and payment facilitation. Ballpark is not a party to this SOW, does not provide the Services or Deliverables described in it, and is not responsible for their delivery. See "Role of Ballpark" in Annex A for full detail.';
  protected readonly paymentBoilerplate =
    'A percentage of the total Fee is invoiced upon signature of this SOW by both the Agency and the Supplier. The negotiated percentage is defined in the table below, and paid by the Agency via Stripe. The remaining balance is invoiced on completion of the Services, payable within [30] days. Funds are collected and released by Ballpark acting solely as a payment facilitator on the Supplier’s behalf.';
  protected readonly conclusionText =
    'This Statement of Work is entered into on the Effective Date pursuant to the Supplier’s standard terms of purchase set out in Annex A. Any terms and conditions on the Agency’s form of purchase order are void and have no legal effect unless otherwise agreed. Each party warrants that they have all right, title and interest to bind the applicable entity on whose behalf they are signing.';

  // Boilerplate copy lives in the `sow_boilerplate` reference codelist (meta.text),
  // editable in Settings ▸ Codelists; the constants above are the fallback.
  private readonly codelistSvc = inject(CodelistService);
  private readonly boilerplateRes = resource({ loader: () => this.codelistSvc.list('sow_boilerplate') });
  protected bp(code: 'intro' | 'payment_schedule' | 'conclusion'): string {
    const text = this.boilerplateRes.value()?.find((x) => x.code === code)?.meta?.['text'];
    if (typeof text === 'string' && text.trim()) return text;
    return code === 'intro' ? this.introText : code === 'payment_schedule' ? this.paymentBoilerplate : this.conclusionText;
  }

  // Section 2 · Project Details — auto-populated from the project / thread, each
  // value editable (an edit stores an override by field label; see mutDetail).
  protected readonly projectDetailRows = computed(() => {
    const t = this.thread();
    const p = this.project();
    const executed = this.current()?.status === 'executed';
    const ov = this.edited().projectDetailOverrides ?? {};
    const base = [
      { label: 'Ballpark Reference', value: p?.ref ?? t?.refCode ?? null },
      { label: 'Effective Date', value: executed ? 'Signed' : 'On signing by both parties' },
      { label: 'SOW Version', value: 'V1' },
      { label: 'Project Title', value: t?.projectName ?? p?.name ?? null },
      { label: 'Event Date(s)', value: p?.eventDate ?? null },
      { label: 'Venue / Location', value: p?.location ?? null },
      { label: 'Category', value: t?.categoryName ?? null },
    ];
    return base.map((r) => ({ label: r.label, value: ov[r.label] ?? r.value }));
  });
  mutDetail(label: string, v: string): void {
    this.mut((c) => ({ ...c, projectDetailOverrides: { ...(c.projectDetailOverrides ?? {}), [label]: v } }));
  }

  // Section 2 · SOW Parties — legal details resolved cross-org (gated definer),
  // shown by default; an edit stores an override per party (mutParty).
  private readonly partiesRes = resource({
    params: () => this.current()?.id,
    loader: ({ params }) => firstValueFrom(this.sowSvc.partiesFor(params)),
  });
  private partyLine(role: 'agency' | 'supplier'): string {
    const p = (this.partiesRes.value() as SowParties | undefined)?.[role] ?? null;
    const fallbackName = (role === 'agency' ? this.thread().agencyName : this.thread().supplierName) ?? '—';
    if (!p) return fallbackName;
    const bits: string[] = [];
    if (p.jurisdiction) bits.push(`a company registered in ${p.jurisdiction}`);
    if (p.companyNumber) bits.push(`under Company Number ${p.companyNumber}`);
    if (p.address) bits.push(`whose principal place of business is at ${p.address}`);
    return bits.length ? `${p.name || fallbackName}, ${bits.join(' ')}.` : (p.name || fallbackName);
  }
  /** The displayed party detail — the author's override if set, else the live line. */
  protected partyValue(role: 'agency' | 'supplier'): string {
    return this.edited().partyOverrides?.[role] ?? this.partyLine(role);
  }
  mutParty(role: 'agency' | 'supplier', v: string): void {
    this.mut((c) => ({ ...c, partyOverrides: { agency: null, supplier: null, ...(c.partyOverrides ?? {}), [role]: v } }));
  }

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected refundableLabel(r: SowPaymentRow['refundable']): string { return r === 'yes' ? 'Yes' : r === 'no' ? 'No' : r === 'partial' ? 'Partial' : 'N/A'; }

  private mut(fn: (c: SowContent) => SowContent): void { this.edited.update((c) => fn({ ...c })); }

  mutTimeline(i: number, f: keyof SowTimelineEntry, v: string): void { this.mut((c) => ({ ...c, timeline: { ...c.timeline, entries: this.timeline().map((e, idx) => (idx === i ? { ...e, [f]: v } : e)) } })); }
  addTimeline(): void { this.mut((c) => ({ ...c, timeline: { ...c.timeline, entries: [...this.timeline(), { date: null, to: null, from: null, details: null }] } })); this.save(); }
  removeTimeline(i: number): void { this.mut((c) => ({ ...c, timeline: { ...c.timeline, entries: this.timeline().filter((_, idx) => idx !== i) } })); this.save(); }

  mutPay(i: number, f: keyof SowPaymentRow, v: string): void { this.mut((c) => ({ ...c, payment: { ...c.payment, rows: this.payment().map((r, idx) => (idx === i ? ({ ...r, [f]: v } as SowPaymentRow) : r)) } })); }
  addPayment(): void { this.mut((c) => ({ ...c, payment: { ...c.payment, rows: [...this.payment(), { date: null, grace: null, amount: null, refundable: 'na', details: null }] } })); this.save(); }
  removePayment(i: number): void { this.mut((c) => ({ ...c, payment: { ...c.payment, rows: this.payment().filter((_, idx) => idx !== i) } })); this.save(); }

  // ── Section / subsection structure (SOW → Section → SubSection) ───────────────
  private setSections(next: SowSection[]): void { this.mut((c) => ({ ...c, sections: next })); }
  private patchSection(i: number, patch: Partial<SowSection>): void { this.setSections(this.sections().map((s, idx) => (idx === i ? { ...s, ...patch } : s))); }
  private patchSub(i: number, j: number, patch: Partial<SowSection['subs'][number]>): void {
    this.setSections(this.sections().map((s, idx) => (idx === i ? { ...s, subs: s.subs.map((x, jx) => (jx === j ? { ...x, ...patch } : x)) } : s)));
  }
  mutSectionTitle(i: number, title: string): void { this.patchSection(i, { title }); }
  mutSectionNa(i: number, na: boolean): void { this.patchSection(i, { na }); this.save(); }
  addSection(): void { this.setSections([...this.sections(), { title: 'New section', text: null, subs: [] }]); this.save(); }
  removeSection(i: number): void { this.setSections(this.sections().filter((_, idx) => idx !== i)); this.save(); }
  addSub(i: number): void { this.setSections(this.sections().map((s, idx) => (idx === i ? { ...s, subs: [...s.subs, { title: 'New subsection', text: null }] } : s))); this.save(); }
  removeSub(i: number, j: number): void { this.setSections(this.sections().map((s, idx) => (idx === i ? { ...s, subs: s.subs.filter((_, jx) => jx !== j) } : s))); this.save(); }
  mutSubTitle(i: number, j: number, title: string): void { this.patchSub(i, j, { title }); }
  mutSubNa(i: number, j: number, na: boolean): void { this.patchSub(i, j, { na }); this.save(); }

  // Items are derived (no add/remove). The author may only overlay source + a
  // price note per row; the overlay is keyed by itemId and merged in items().
  mutItem(itemId: string, f: 'spec' | 'priceNotes', v: string): void {
    this.mut((c) => {
      const list = (c.itemOverrides ?? []).slice();
      const i = list.findIndex((o) => o.itemId === itemId);
      const next: SowItemOverride = { ...(i >= 0 ? list[i] : { itemId, priceNotes: null }), [f]: v };
      if (i >= 0) list[i] = next; else list.push(next);
      return { ...c, itemOverrides: list };
    });
  }

  /** Display helper — GBP, no decimals for whole amounts. Empty for null/blank. */
  money(v: number | string | null | undefined): string {
    if (v === null || v === undefined || v === '') return '—';
    const n = Number(v);
    if (!isFinite(n)) return '—';
    return n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: n % 1 === 0 ? 0 : 2 });
  }

  async save(): Promise<void> {
    const cur = this.current();
    if (!cur) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.sowSvc.update(cur.id, { content: this.edited() }));
      this.sowsRes.reload();
    } catch (e) {
      this.error.set(errorDetail(e) || 'Could not save');
    } finally {
      this.busy.set(false);
    }
  }

  async create(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      const pre = await firstValueFrom(this.sowSvc.prefill(this.thread().projectId));
      await firstValueFrom(this.sowSvc.create({ projectId: this.thread().projectId, name: 'Statement of Work', content: buildInitial(pre) }));
      this.sowsRes.reload();
    } catch (e) {
      this.error.set(errorDetail(e) || 'Could not create the SOW');
    } finally {
      this.busy.set(false);
    }
  }

  // prose edit dialog — edits a section's text or a subsection's text
  protected readonly editOpen = signal(false);
  protected readonly editLabel = signal('');
  protected readonly editText = signal('');
  private editTarget: { kind: 'sectionText'; i: number } | { kind: 'subText'; i: number; j: number } | null = null;
  openEditSection(i: number): void { this.editTarget = { kind: 'sectionText', i }; this.editLabel.set(this.sections()[i]?.title ?? 'Section'); this.editText.set(this.sections()[i]?.text ?? ''); this.editOpen.set(true); }
  openEditSub(i: number, j: number): void { const sub = this.sections()[i]?.subs[j]; this.editTarget = { kind: 'subText', i, j }; this.editLabel.set(sub?.title ?? 'Subsection'); this.editText.set(sub?.text ?? ''); this.editOpen.set(true); }
  async saveEdit(): Promise<void> {
    const t = this.editTarget;
    if (!t) return;
    const val = this.editText().trim() || null;
    if (t.kind === 'sectionText') this.patchSection(t.i, { text: val });
    else this.patchSub(t.i, t.j, { text: val });
    this.editOpen.set(false);
    await this.save();
  }

  // sign
  protected readonly signOpen = signal(false);
  protected readonly signName = signal('');
  protected readonly signTitle = signal('');
  openSign(): void { this.signName.set(''); this.signTitle.set(''); this.error.set(null); this.signOpen.set(true); }
  async doSign(): Promise<void> {
    const s = this.current();
    if (!s) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.sowSvc.sign(s.id, { name: this.signName(), title: this.signTitle() || undefined }));
      this.signOpen.set(false);
      this.sowsRes.reload();
    } catch (e) {
      this.error.set(errorDetail(e) || 'Could not sign');
    } finally {
      this.busy.set(false);
    }
  }
}

// The section structure + boilerplate text come from defaultSections() at render
// time (so they keep tracking the codelist until edited); buildInitial seeds only
// the table DATA that needs the project context — the timeline and payment rows.
function buildInitial(pre: SowPrefill): SowContent {
  const p = pre.project;
  return {
    timeline: { entries: p?.eventDate ? [{ date: p.eventDate, to: null, from: null, details: null }] : [] },
    payment: {
      rows: [
        { date: 'SOW date', grace: '3 days', amount: '50%', refundable: 'na', details: null },
        { date: 'Event date', grace: '7 days', amount: '50%', refundable: 'na', details: null },
      ],
    },
  };
}
