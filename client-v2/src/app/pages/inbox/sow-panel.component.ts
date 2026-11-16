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
import { Sow, SowContent, SowItemOverride, SowParties, SowPaymentRow, SowPrefill, SowProductionItem, SowSubSection, SowTimelineEntry } from '../../core/sow/sow.types';
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

        <!-- Section 1 — Standard Intro (boilerplate) -->
        <div class="bp-card">
          <div class="bp-sow-head"><span class="bp-card-title">Section 1 · Standard Intro</span></div>
          <div class="p-4 pt-3 bp-body-small text-secondary whitespace-pre-line">{{ bp('intro') }}</div>
        </div>

        <!-- Section 2 — Parties & Project -->
        <div class="bp-card">
          <div class="bp-sow-head"><span class="bp-card-title">Section 2 · Parties &amp; Project</span></div>
          <div class="p-4 pt-3 flex flex-col gap-3">
            <!-- SOW Parties -->
            <div>
              <div class="bp-caption text-muted mb-1">SOW Parties</div>
              <div class="overflow-hidden rounded-md border border-hairline">
                <div class="grid grid-cols-[150px_minmax(0,1fr)] gap-x-4 border-b border-hairline bg-fill px-3 py-2">
                  <span class="bp-table-column-header">Party</span><span class="bp-table-column-header">Details</span>
                </div>
                <div class="grid grid-cols-[150px_minmax(0,1fr)] items-start gap-x-4 border-b border-hairline px-3 py-1.5 bp-body-small">
                  <span class="font-semibold">Agency (Buyer)</span>
                  @if (editable()) { <input class="bp-sow-cell" [ngModel]="partyValue('agency')" (ngModelChange)="mutParty('agency',$event)" (change)="save()" /> }
                  @else { <span>{{ partyValue('agency') }}</span> }
                </div>
                <div class="grid grid-cols-[150px_minmax(0,1fr)] items-start gap-x-4 px-3 py-1.5 bp-body-small">
                  <span class="font-semibold">Supplier</span>
                  @if (editable()) { <input class="bp-sow-cell" [ngModel]="partyValue('supplier')" (ngModelChange)="mutParty('supplier',$event)" (change)="save()" /> }
                  @else { <span>{{ partyValue('supplier') }}</span> }
                </div>
              </div>
            </div>
            <!-- Project Details -->
            <div>
              <div class="bp-caption text-muted mb-1">Project Details</div>
              <div class="overflow-hidden rounded-md border border-hairline">
                <div class="grid grid-cols-[160px_minmax(0,1fr)] gap-x-4 border-b border-hairline bg-fill px-3 py-2">
                  <span class="bp-table-column-header">Field</span><span class="bp-table-column-header">Value</span>
                </div>
                @for (row of projectDetailRows(); track row.label) {
                  <div class="grid grid-cols-[160px_minmax(0,1fr)] items-start gap-x-4 border-b border-hairline last:border-0 px-3 py-1.5 bp-body-small">
                    <span class="font-semibold">{{ row.label }}</span>
                    @if (editable()) { <input class="bp-sow-cell" [ngModel]="row.value" (ngModelChange)="mutDetail(row.label,$event)" (change)="save()" /> }
                    @else { <span>{{ row.value || '—' }}</span> }
                  </div>
                }
              </div>
            </div>
          </div>
        </div>

        <!-- Section 3 — Project Milestones -->
        <div class="bp-card">
          <div class="bp-sow-head">
            <span class="bp-card-title">Section 3 · Project Milestones</span>
            @if (editable()) { <label class="bp-caption flex items-center gap-1"><input type="checkbox" class="accent-[var(--theme-accent)]" [checked]="isSectionNa('timeline')" (change)="toggleSectionNa('timeline', $any($event.target).checked)" /> N/A</label> }
          </div>
          <div class="p-4 pt-3">
            @if (isSectionNa('timeline')) { <span class="bp-body-small text-muted italic">N/A</span> }
            @else {
              <div class="overflow-hidden rounded-md border border-hairline">
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
                @if (!timeline().length && !editable()) { <div class="px-3 py-2 bp-body-small text-muted italic">N/A</div> }
              </div>
            }
          </div>
        </div>

        <!-- Section 4 — Services & Goods -->
        <div class="bp-card">
          <div class="bp-sow-head">
            <span class="bp-card-title">Section 4 · Services &amp; Goods</span>
            @if (editable()) { <button type="button" class="bp-sow-icon" title="Add item" (click)="addService()"><lucide-icon name="circle-plus" [size]="20" /></button> }
          </div>
          <div class="px-4 py-1">
            <p class="bp-body-small text-secondary py-1">{{ servicesIntro }}</p>
            @for (sec of services(); track $index) {
              <div class="flex items-start justify-between gap-2 border-b border-hairline py-2.5 last:border-0 group">
                <div class="min-w-0 flex-1">
                  @if (editable()) { <input class="bp-sow-cell font-semibold" [ngModel]="sec.name" (ngModelChange)="mutServiceName($index,$event)" (change)="save()" /> }
                  @else { <div class="bp-card-title">{{ sec.name }}</div> }
                  @if (sec.na) { <div class="bp-caption text-muted italic mt-1">N/A</div> }
                  @else if (sec.content) { <div class="bp-md bp-body-small text-secondary mt-1" [innerHTML]="sec.content | md"></div> }
                </div>
                @if (editable()) {
                  <div class="flex shrink-0 items-center gap-2 opacity-0 group-hover:opacity-100">
                    <label class="bp-caption flex items-center gap-1 text-muted"><input type="checkbox" class="accent-[var(--theme-accent)]" [checked]="!!sec.na" (change)="toggleServiceNa($index, $any($event.target).checked)" /> N/A</label>
                    @if (!sec.na) { <button type="button" class="bp-sow-ibtn" title="Edit" (click)="openEditService($index)"><lucide-icon name="pencil" [size]="15" /></button> }
                    <button type="button" class="bp-sow-ibtn" title="Remove" (click)="removeService($index)"><lucide-icon name="trash-2" [size]="14" /></button>
                  </div>
                }
              </div>
            }

            <!-- Production, Pricing & Price-Matched Items — the agreed (both-accepted)
                 line items from this engagement; author may overlay Source + a price note. -->
            <div class="mt-3 border-t border-hairline pt-3">
              <div class="bp-caption text-muted mb-1">Production, Pricing &amp; Price-Matched Items</div>
              <div class="overflow-hidden rounded-md border border-hairline">
                <div class="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.8fr)_48px_minmax(0,1.3fr)_90px] items-center gap-x-3 border-b border-hairline bg-fill px-3 py-2">
                  <span class="bp-table-column-header">Item</span><span class="bp-table-column-header">Spec</span><span class="bp-table-column-header">Qty</span><span class="bp-table-column-header">Source</span><span class="bp-table-column-header text-right">Total</span>
                </div>
                @for (it of items(); track it.itemId) {
                  <div class="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.8fr)_48px_minmax(0,1.3fr)_90px] items-start gap-x-3 border-b border-hairline last:border-0 px-3 py-1.5 bp-body-small">
                    <span class="font-semibold">{{ it.item }}</span>
                    @if (editable()) { <input class="bp-sow-cell text-secondary" [ngModel]="it.spec" (ngModelChange)="mutItem(it.itemId,'spec',$event)" (change)="save()" /> }
                    @else { <span class="text-secondary">{{ it.spec }}</span> }
                    <span class="text-center">{{ it.qty }}</span>
                    @if (editable()) {
                      <input class="bp-sow-cell" [ngModel]="it.source" (ngModelChange)="mutItem(it.itemId,'source',$event)" (change)="save()" />
                    } @else { <span>{{ it.source }}</span> }
                    <span class="text-right font-semibold">{{ money(it.total) }}</span>
                    @if (it.priceNotes) { <div class="col-span-5 bp-caption text-muted italic pt-0.5">{{ it.priceNotes }}</div> }
                    @else if (editable()) {
                      <input class="bp-sow-cell col-span-5 bp-caption text-muted pt-0.5" placeholder="Price note (e.g. price-matched from …)" [ngModel]="it.priceNotes" (ngModelChange)="mutItem(it.itemId,'priceNotes',$event)" (change)="save()" />
                    }
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
            </div>
          </div>
        </div>

        <!-- Section 5 — Fees & Payment -->
        <div class="bp-card">
          <div class="bp-sow-head">
            <span class="bp-card-title">Section 5 · Fees &amp; Payment</span>
            @if (editable()) { <label class="bp-caption flex items-center gap-1"><input type="checkbox" class="accent-[var(--theme-accent)]" [checked]="isSectionNa('payment')" (change)="toggleSectionNa('payment', $any($event.target).checked)" /> N/A</label> }
          </div>
          <div class="p-4 pt-3">
            @if (isSectionNa('payment')) { <span class="bp-body-small text-muted italic">N/A</span> }
            @else {
              <p class="bp-body-small text-secondary mb-2 whitespace-pre-line">{{ bp('payment_schedule') }}</p>
              <div class="bp-caption text-muted mb-1">Payment schedule</div>
              <div class="overflow-hidden rounded-md border border-hairline">
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
              </div>
              <p class="bp-caption text-muted mt-2">Ballpark platform fee: {{ s.platformFeePct ?? 3 }}%</p>
            }
            <!-- Special Terms (sub-row under Fees & Payment) -->
            <div class="mt-3 flex items-start justify-between gap-2 border-t border-hairline pt-3 group">
              <div class="min-w-0 flex-1">
                <div class="bp-card-title">Special Terms</div>
                @if (special().na) { <div class="bp-caption text-muted italic mt-1">N/A</div> }
                @else if (special().content) { <div class="bp-md bp-body-small text-secondary mt-1" [innerHTML]="special().content | md"></div> }
              </div>
              @if (editable()) {
                <div class="flex shrink-0 items-center gap-2 opacity-0 group-hover:opacity-100">
                  <label class="bp-caption flex items-center gap-1 text-muted"><input type="checkbox" class="accent-[var(--theme-accent)]" [checked]="!!special().na" (change)="toggleSpecialNa($any($event.target).checked)" /> N/A</label>
                  @if (!special().na) { <button type="button" class="bp-sow-ibtn" title="Edit" (click)="openEditSpecial()"><lucide-icon name="pencil" [size]="15" /></button> }
                </div>
              }
            </div>
          </div>
        </div>

        <!-- custom (Add-section) cards -->
        @for (ex of extra(); track $index) {
          <div class="bp-card">
            <div class="bp-sow-head">
              @if (editable()) { <input class="bp-sow-cell font-semibold flex-1" [ngModel]="ex.name" (ngModelChange)="mutExtraName($index,$event)" (change)="save()" /> }
              @else { <span class="bp-card-title">{{ ex.name || 'Section' }}</span> }
              @if (editable()) {
                <div class="flex items-center gap-2">
                  <button type="button" class="bp-sow-ibtn" title="Edit" (click)="openEditExtra($index)"><lucide-icon name="pencil" [size]="15" /></button>
                  <button type="button" class="bp-sow-ibtn" title="Remove" (click)="removeExtra($index)"><lucide-icon name="trash-2" [size]="14" /></button>
                </div>
              }
            </div>
            <div class="bp-md p-4 pt-2 bp-body-small" [innerHTML]="(ex.content || '') | md"></div>
          </div>
        }
        @if (editable()) { <button type="button" class="bp-act bp-act--outline self-start" (click)="addExtra()">+ Add section</button> }

        <!-- Section 6 — Signature (boilerplate) -->
        <div class="bp-card">
          <div class="bp-sow-head"><span class="bp-card-title">Section 6 · Signature</span></div>
          <div class="p-4 pt-3">
            <p class="bp-body-small text-secondary whitespace-pre-line">{{ bp('conclusion') }}</p>
            <div class="mt-3 flex flex-wrap items-end gap-8 bp-body-small">
              <div><div class="bp-caption text-muted">Agency</div><div class="font-semibold">{{ s.status === 'counterparty_signed' || s.status === 'executed' ? 'Signed' : 'Awaiting signature' }}</div></div>
              <div><div class="bp-caption text-muted">Supplier</div><div class="font-semibold">{{ s.status === 'executed' ? 'Signed' : 'Awaiting signature' }}</div></div>
              @if (canSign()) { <button type="button" class="bp-act bp-act--green" (click)="openSign()">{{ signLabel() }}</button> }
            </div>
          </div>
        </div>

        <!-- Section 7 — Terms & Conditions -->
        <div class="bp-card">
          <div class="bp-sow-head"><span class="bp-card-title">Section 7 · Terms &amp; Conditions</span></div>
          <div class="p-4 pt-3 bp-body-small text-secondary">The supplier's standard terms &amp; conditions apply (attached at supplier level).</div>
        </div>

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
  protected readonly services = computed<SowSubSection[]>(() => this.edited().services ?? []);
  protected readonly payment = computed<SowPaymentRow[]>(() => this.edited().payment?.rows ?? []);
  protected readonly extra = computed<SowSubSection[]>(() => this.edited().extra ?? []);
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
          source: o?.source ?? 'This Supplier — own design',
          priceNotes: o?.priceNotes ?? null,
          total: it.priceCurrent ?? it.priceRef,
        } as SowProductionItem;
      });
  });
  protected readonly itemsTotal = computed(() => this.items().reduce((s, it) => s + (Number(it.total) || 0), 0));
  protected readonly servicesIntro = 'The Supplier is responsible for delivering the following services and scope of work, as confirmed and costed via Ballpark.';
  protected readonly special = computed<SowSubSection>(() => this.edited().specialTerms ?? { name: 'Special Terms', content: null });

  // Boilerplate (fixed) copy — shown but not editable (verbatim from the SOW spec).
  protected readonly introText =
    'This Statement of Work ("SOW") is entered into directly between the Agency and the Supplier named below in connection with the project described. It was generated using cost data and scope details submitted through the Ballpark platform (www.theballpark.ai — operated by The Ballpark AI Ltd, "Ballpark").\n\n' +
    'Ballpark is a technology platform that connects Agencies with Suppliers and provides ballpark cost estimates, booking tools and payment facilitation. Ballpark is not a party to this SOW, does not provide the Services or Deliverables described in it, and is not responsible for their delivery. See "Role of Ballpark" in Annex A for full detail.';
  protected readonly paymentBoilerplate =
    '50% of the Fee is invoiced and taken via Stripe upon signature of this SOW by both the Agency and the Supplier. The remaining 50% is invoiced on completion of the Services, payable within [30] days. Funds are collected and released by Ballpark acting solely as a payment facilitator on the Supplier’s behalf.';
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

  mutServiceName(i: number, name: string): void { this.mut((c) => ({ ...c, services: this.services().map((x, idx) => (idx === i ? { ...x, name } : x)) })); }
  toggleServiceNa(i: number, na: boolean): void { this.mut((c) => ({ ...c, services: this.services().map((x, idx) => (idx === i ? { ...x, na } : x)) })); this.save(); }
  addService(): void { this.mut((c) => ({ ...c, services: [...this.services(), { name: 'New section', content: null }] })); this.save(); }
  removeService(i: number): void { this.mut((c) => ({ ...c, services: this.services().filter((_, idx) => idx !== i) })); this.save(); }

  mutPay(i: number, f: keyof SowPaymentRow, v: string): void { this.mut((c) => ({ ...c, payment: { ...c.payment, rows: this.payment().map((r, idx) => (idx === i ? ({ ...r, [f]: v } as SowPaymentRow) : r)) } })); }
  addPayment(): void { this.mut((c) => ({ ...c, payment: { ...c.payment, rows: [...this.payment(), { date: null, grace: null, amount: null, refundable: 'na', details: null }] } })); this.save(); }
  removePayment(i: number): void { this.mut((c) => ({ ...c, payment: { ...c.payment, rows: this.payment().filter((_, idx) => idx !== i) } })); this.save(); }

  mutExtraName(i: number, name: string): void { this.mut((c) => ({ ...c, extra: this.extra().map((x, idx) => (idx === i ? { ...x, name } : x)) })); }
  addExtra(): void { this.mut((c) => ({ ...c, extra: [...this.extra(), { name: 'New section', content: '' }] })); this.save(); }
  removeExtra(i: number): void { this.mut((c) => ({ ...c, extra: this.extra().filter((_, idx) => idx !== i) })); this.save(); }

  // Items are derived (no add/remove). The author may only overlay source + a
  // price note per row; the overlay is keyed by itemId and merged in items().
  mutItem(itemId: string, f: 'spec' | 'source' | 'priceNotes', v: string): void {
    this.mut((c) => {
      const list = (c.itemOverrides ?? []).slice();
      const i = list.findIndex((o) => o.itemId === itemId);
      const next: SowItemOverride = { ...(i >= 0 ? list[i] : { itemId, source: null, priceNotes: null }), [f]: v };
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

  isSectionNa(which: 'timeline' | 'payment'): boolean { const s = this.edited()[which] as { na?: boolean } | undefined; return !!s?.na; }
  toggleSectionNa(which: 'timeline' | 'payment', na: boolean): void {
    this.mut((c) => (which === 'timeline' ? { ...c, timeline: { entries: c.timeline?.entries ?? [], na } } : { ...c, payment: { rows: c.payment?.rows ?? [], na } }));
    this.save();
  }
  toggleSpecialNa(na: boolean): void { this.mut((c) => ({ ...c, specialTerms: { name: 'Special Terms', content: this.special().content, na } })); this.save(); }
  openEditSpecial(): void { this.editTarget = { kind: 'special' }; this.editLabel.set('Special Terms'); this.editText.set(this.special().content ?? ''); this.editOpen.set(true); }

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

  // prose edit dialog (services / special / extra)
  protected readonly editOpen = signal(false);
  protected readonly editLabel = signal('');
  protected readonly editText = signal('');
  private editTarget: { kind: 'service' | 'extra'; i: number } | { kind: 'special' } | null = null;
  openEditService(i: number): void { this.editTarget = { kind: 'service', i }; this.editLabel.set(this.services()[i]?.name ?? 'Section'); this.editText.set(this.services()[i]?.content ?? ''); this.editOpen.set(true); }
  openEditExtra(i: number): void { this.editTarget = { kind: 'extra', i }; this.editLabel.set(this.extra()[i]?.name ?? 'Section'); this.editText.set(this.extra()[i]?.content ?? ''); this.editOpen.set(true); }
  async saveEdit(): Promise<void> {
    const t = this.editTarget;
    if (!t) return;
    const val = this.editText().trim() || null;
    if (t.kind === 'service') { this.mut((c) => ({ ...c, services: this.services().map((x, idx) => (idx === t.i ? { ...x, content: val, na: false } : x)) })); }
    else if (t.kind === 'special') { this.mut((c) => ({ ...c, specialTerms: { name: 'Special Terms', content: val, na: false } })); }
    else { this.mut((c) => ({ ...c, extra: this.extra().map((x, idx) => (idx === t.i ? { ...x, content: val ?? '' } : x)) })); }
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

function buildInitial(pre: SowPrefill): SowContent {
  const p = pre.project;
  const includedServices = pre.items.map((it) => it.installDescription).filter((x): x is string => !!x && !!x.trim()).join('  \n') || null;
  return {
    timeline: { entries: p?.eventDate ? [{ date: p.eventDate, to: null, from: null, details: null }] : [] },
    services: [
      { name: 'Concept & Design Sign-off', content: null, na: true },
      { name: 'Bespoke Render', content: null, na: true },
      { name: 'Install / De-rig', content: includedServices, na: !includedServices },
      { name: 'Staffing', content: null, na: true },
      { name: 'Logistics & Other', content: null, na: true },
    ],
    payment: {
      rows: [
        { date: 'SOW date', grace: '3 days', amount: '50%', refundable: 'na', details: null },
        { date: 'Event date', grace: '7 days', amount: '50%', refundable: 'na', details: null },
      ],
    },
    specialTerms: { name: 'Special Terms', content: null, na: true },
    extra: [],
  };
}
