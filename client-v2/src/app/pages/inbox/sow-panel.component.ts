// pV2-SOW-01 (Phase 2) — the SOW at the top of a per-supplier inbox thread.
// Rendered as section CARDS with pill headers (+ ⊕ to add a row): Timeline and
// Fees & Payment as TABLES, Services & Goods as a row LIST. Each row has N/A and
// a pencil to edit its prose. Content-authored, pre-filled from the project +
// the supplier's items; boilerplate hidden. The supplier (author) edits while
// draft; the agency signs first, the supplier counter-signs.
//
// Edits use a LOCAL working copy (edited) so inline typing doesn't round-trip
// per keystroke; save() PATCHes the whole content on blur / discrete actions.

import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { SowService } from '../../core/sow/sow.service';
import { Sow, SowContent, SowPaymentRow, SowPrefill, SowSubSection, SowTimelineEntry } from '../../core/sow/sow.types';
import { InboxThread } from '../../core/inbox/inbox.service';
import { ModalComponent } from '../../shared/modal/modal.component';
import { StatusPillComponent } from '../../shared/status-pill/status-pill.component';
import { MarkdownPipe } from '../../shared/markdown.pipe';
import { errorDetail } from '../../core/http-error';

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
        @if (canSign()) { <button type="button" class="bp-act bp-act--green" (click)="openSign()">{{ signLabel() }}</button> }
      </div>
    </div>

    @if (sowsRes.isLoading()) { <p class="bp-body-small text-secondary mt-2">Loading…</p> }

    @if (current(); as s) {
      <div class="mt-3 flex flex-col gap-3">

        <!-- Section 3 — Timeline (table) -->
        <div class="bp-card">
          <div class="bp-sow-head">
            <span class="bp-card-title">Section 3 · Timeline</span>
            <div class="flex items-center gap-3">
              @if (editable()) { <label class="bp-caption flex items-center gap-1"><input type="checkbox" [checked]="isSectionNa('timeline')" (change)="toggleSectionNa('timeline', $any($event.target).checked)" /> N/A</label> }
              @if (editable() && !isSectionNa('timeline')) { <button type="button" class="bp-sow-add" title="Add date" (click)="addTimeline()"><lucide-icon name="circle-plus" [size]="20" /></button> }
            </div>
          </div>
          <div class="p-4 pt-3">
            @if (isSectionNa('timeline')) { <span class="bp-body-small text-muted italic">N/A</span> }
            @else if (timeline().length || editable()) {
              <table class="w-full bp-body-small">
                <thead><tr class="text-muted text-left"><th class="font-normal pb-1">Date</th><th class="font-normal pb-1">To</th><th class="font-normal pb-1">From</th><th class="font-normal pb-1">Details</th><th></th></tr></thead>
                <tbody>
                  @for (e of timeline(); track $index) {
                    <tr>
                      @if (editable()) {
                        <td class="pr-2 py-0.5"><input class="bp-sow-input w-full" [ngModel]="e.date" (ngModelChange)="mutTimeline($index,'date',$event)" (change)="save()" /></td>
                        <td class="pr-2 py-0.5"><input class="bp-sow-input w-full" [ngModel]="e.to" (ngModelChange)="mutTimeline($index,'to',$event)" (change)="save()" /></td>
                        <td class="pr-2 py-0.5"><input class="bp-sow-input w-full" [ngModel]="e.from" (ngModelChange)="mutTimeline($index,'from',$event)" (change)="save()" /></td>
                        <td class="pr-2 py-0.5"><input class="bp-sow-input w-full" [ngModel]="e.details" (ngModelChange)="mutTimeline($index,'details',$event)" (change)="save()" /></td>
                        <td class="py-0.5 text-right"><button type="button" class="bp-act bp-act--transparent" (click)="removeTimeline($index)"><lucide-icon name="trash-2" [size]="14" /></button></td>
                      } @else {
                        <td class="font-semibold pr-3 py-0.5">{{ e.date || '—' }}</td><td class="pr-3 py-0.5">{{ e.to }}</td><td class="pr-3 py-0.5">{{ e.from }}</td><td class="py-0.5">{{ e.details }}</td><td></td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
              @if (!timeline().length && !editable()) { <span class="bp-body-small text-muted italic">N/A</span> }
            } @else { <span class="bp-body-small text-muted italic">N/A</span> }
          </div>
        </div>

        <!-- Section 4 — Services & Goods (rows) -->
        <div class="bp-card">
          <div class="bp-sow-head">
            <span class="bp-card-title">Section 4 · Services &amp; Goods</span>
            @if (editable()) { <button type="button" class="bp-sow-add" title="Add section" (click)="addService()"><lucide-icon name="circle-plus" [size]="20" /></button> }
          </div>
          <div class="px-4 py-1">
            @for (sec of services(); track $index) {
              <div class="flex items-start justify-between gap-2 border-b border-hairline py-2.5 last:border-0 group">
                <div class="min-w-0 flex-1">
                  @if (editable()) {
                    <input class="bp-sow-input font-semibold" [ngModel]="sec.name" (ngModelChange)="mutServiceName($index,$event)" (change)="save()" />
                  } @else { <div class="bp-card-title">{{ sec.name }}</div> }
                  @if (sec.na) { <div class="bp-caption text-muted italic mt-1">N/A</div> }
                  @else if (sec.content) { <div class="bp-body-small text-secondary mt-1" [innerHTML]="sec.content | md"></div> }
                  @else if (editable()) { <div class="bp-caption text-muted mt-1">Click the pencil to add…</div> }
                </div>
                @if (editable()) {
                  <div class="flex shrink-0 items-center gap-2 opacity-0 group-hover:opacity-100">
                    <label class="bp-caption flex items-center gap-1 text-muted"><input type="checkbox" [checked]="!!sec.na" (change)="toggleServiceNa($index, $any($event.target).checked)" /> N/A</label>
                    @if (!sec.na) { <button type="button" class="bp-act bp-act--transparent" title="Edit" (click)="openEditService($index)"><lucide-icon name="pencil" [size]="15" /></button> }
                    <button type="button" class="bp-act bp-act--transparent" title="Remove" (click)="removeService($index)"><lucide-icon name="trash-2" [size]="14" /></button>
                  </div>
                }
              </div>
            }
          </div>
        </div>

        <!-- Section 5 — Fees & Payment (table) -->
        <div class="bp-card">
          <div class="bp-sow-head">
            <span class="bp-card-title">Section 5 · Fees &amp; Payment</span>
            <div class="flex items-center gap-3">
              @if (editable()) { <label class="bp-caption flex items-center gap-1"><input type="checkbox" [checked]="isSectionNa('payment')" (change)="toggleSectionNa('payment', $any($event.target).checked)" /> N/A</label> }
              @if (editable() && !isSectionNa('payment')) { <button type="button" class="bp-sow-add" title="Add row" (click)="addPayment()"><lucide-icon name="circle-plus" [size]="20" /></button> }
            </div>
          </div>
          <div class="p-4 pt-3">
            @if (isSectionNa('payment')) { <span class="bp-body-small text-muted italic">N/A</span> }
            @else {
            <table class="w-full bp-body-small">
              <thead><tr class="text-muted text-left"><th class="font-normal pb-1">Date</th><th class="font-normal pb-1">Grace</th><th class="font-normal pb-1">Amount</th><th class="font-normal pb-1">Refundable</th><th class="font-normal pb-1">Details</th><th></th></tr></thead>
              <tbody>
                @for (r of payment(); track $index) {
                  <tr>
                    @if (editable()) {
                      <td class="pr-2 py-0.5"><input class="bp-sow-input w-24" [ngModel]="r.date" (ngModelChange)="mutPay($index,'date',$event)" (change)="save()" /></td>
                      <td class="pr-2 py-0.5"><input class="bp-sow-input w-20" [ngModel]="r.grace" (ngModelChange)="mutPay($index,'grace',$event)" (change)="save()" /></td>
                      <td class="pr-2 py-0.5"><input class="bp-sow-input w-16" [ngModel]="r.amount" (ngModelChange)="mutPay($index,'amount',$event)" (change)="save()" /></td>
                      <td class="pr-2 py-0.5"><select class="bp-sow-input" [ngModel]="r.refundable" (ngModelChange)="mutPay($index,'refundable',$event); save()"><option value="yes">Yes</option><option value="no">No</option><option value="partial">Partial</option><option value="na">N/A</option></select></td>
                      <td class="pr-2 py-0.5"><input class="bp-sow-input w-full" [ngModel]="r.details" (ngModelChange)="mutPay($index,'details',$event)" (change)="save()" /></td>
                      <td class="py-0.5 text-right"><button type="button" class="bp-act bp-act--transparent" (click)="removePayment($index)"><lucide-icon name="trash-2" [size]="14" /></button></td>
                    } @else {
                      <td class="font-semibold pr-3 py-0.5">{{ r.date || '—' }}</td><td class="pr-3 py-0.5">{{ r.grace }}</td><td class="font-semibold pr-3 py-0.5">{{ r.amount }}</td><td class="pr-3 py-0.5">{{ refundableLabel(r.refundable) }}</td><td class="py-0.5">{{ r.details }}</td><td></td>
                    }
                  </tr>
                }
              </tbody>
            </table>
            <p class="bp-caption text-muted mt-2">Ballpark platform fee: {{ s.platformFeePct ?? 3 }}%</p>
            }
            <!-- Special Terms (own N/A + pencil) -->
            <div class="mt-2 flex items-start justify-between gap-2 border-t border-hairline pt-2 group">
              <div class="min-w-0 flex-1">
                <div class="bp-card-title">Special Terms</div>
                @if (special().na) { <div class="bp-caption text-muted italic mt-1">N/A</div> }
                @else if (special().content) { <div class="bp-body-small text-secondary mt-1" [innerHTML]="special().content | md"></div> }
                @else if (editable()) { <div class="bp-caption text-muted mt-1">Click the pencil to add…</div> }
              </div>
              @if (editable()) {
                <div class="flex shrink-0 items-center gap-2 opacity-0 group-hover:opacity-100">
                  <label class="bp-caption flex items-center gap-1 text-muted"><input type="checkbox" [checked]="!!special().na" (change)="toggleSpecialNa($any($event.target).checked)" /> N/A</label>
                  @if (!special().na) { <button type="button" class="bp-act bp-act--transparent" title="Edit" (click)="openEditSpecial()"><lucide-icon name="pencil" [size]="15" /></button> }
                </div>
              }
            </div>
          </div>
        </div>

        <!-- custom (Add-section) cards -->
        @for (ex of extra(); track $index) {
          <div class="bp-card">
            <div class="bp-sow-head">
              @if (editable()) { <input class="bp-sow-input font-semibold flex-1" [ngModel]="ex.name" (ngModelChange)="mutExtraName($index,$event)" (change)="save()" /> }
              @else { <span class="bp-card-title">{{ ex.name || 'Section' }}</span> }
              @if (editable()) {
                <div class="flex items-center gap-2">
                  <button type="button" class="bp-act bp-act--transparent" title="Edit" (click)="openEditExtra($index)"><lucide-icon name="pencil" [size]="15" /></button>
                  <button type="button" class="bp-act bp-act--transparent" title="Remove" (click)="removeExtra($index)"><lucide-icon name="trash-2" [size]="14" /></button>
                </div>
              }
            </div>
            <div class="p-4 pt-2 bp-body-small" [innerHTML]="(ex.content || '') | md"></div>
          </div>
        }
        @if (editable()) { <button type="button" class="bp-act bp-act--outline self-start" (click)="addExtra()">+ Add section</button> }

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
      <textarea class="bp-sow-input min-h-40 w-full" [ngModel]="editText()" (ngModelChange)="editText.set($event)" placeholder="Markdown supported"></textarea>
      <button modalFooter type="button" class="bp-btn--secondary" (click)="editOpen.set(false)">Cancel</button>
      <button modalFooter type="button" class="bp-btn--primary" [disabled]="busy()" (click)="saveEdit()">{{ busy() ? 'Saving…' : 'Save' }}</button>
    </app-modal>

    <!-- sign dialog -->
    <app-modal [open]="signOpen()" [title]="signLabel() + ' the SOW'" (close)="signOpen.set(false)">
      <div class="flex flex-col gap-3">
        <label class="bp-body-small text-secondary">Your name <input class="bp-sow-input" [ngModel]="signName()" (ngModelChange)="signName.set($event)" /></label>
        <label class="bp-body-small text-secondary">Title (optional) <input class="bp-sow-input" [ngModel]="signTitle()" (ngModelChange)="signTitle.set($event)" /></label>
      </div>
      <button modalFooter type="button" class="bp-btn--secondary" (click)="signOpen.set(false)">Cancel</button>
      <button modalFooter type="button" class="bp-btn--primary" [disabled]="busy() || !signName().trim()" (click)="doSign()">{{ busy() ? 'Signing…' : signLabel() }}</button>
    </app-modal>
  `,
  styles: [`
    .bp-sow-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; background: color-mix(in srgb, var(--theme-accent) 13%, var(--color-surface)); border-radius: 9999px; margin: 0.4rem 0.4rem 0.1rem; padding: 0.45rem 1.1rem; }
    .bp-sow-add { color: var(--theme-accent); display: inline-flex; align-items: center; justify-content: center; line-height: 0; }
    .bp-sow-input { border: 1px solid var(--color-hairline); border-radius: var(--radius-sm, 0.5rem); background: var(--color-surface); padding: 0.3rem 0.5rem; font: inherit; color: inherit; }
    table th { font-size: 0.72rem; }
  `],
})
export class SowPanelComponent {
  readonly thread = input.required<InboxThread>();
  readonly viewer = input.required<'agency' | 'supplier'>();

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
  protected readonly special = computed<SowSubSection>(() => this.edited().specialTerms ?? { name: 'Special Terms', content: null });

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected refundableLabel(r: SowPaymentRow['refundable']): string { return r === 'yes' ? 'Yes' : r === 'no' ? 'No' : r === 'partial' ? 'Partial' : 'N/A'; }

  private mut(fn: (c: SowContent) => SowContent): void { this.edited.update((c) => fn({ ...c })); }

  // timeline
  mutTimeline(i: number, f: keyof SowTimelineEntry, v: string): void { this.mut((c) => ({ ...c, timeline: { ...c.timeline, entries: this.timeline().map((e, idx) => (idx === i ? { ...e, [f]: v } : e)) } })); }
  addTimeline(): void { this.mut((c) => ({ ...c, timeline: { ...c.timeline, entries: [...this.timeline(), { date: null, to: null, from: null, details: null }] } })); this.save(); }
  removeTimeline(i: number): void { this.mut((c) => ({ ...c, timeline: { ...c.timeline, entries: this.timeline().filter((_, idx) => idx !== i) } })); this.save(); }

  // services
  mutServiceName(i: number, name: string): void { this.mut((c) => ({ ...c, services: this.services().map((x, idx) => (idx === i ? { ...x, name } : x)) })); }
  toggleServiceNa(i: number, na: boolean): void { this.mut((c) => ({ ...c, services: this.services().map((x, idx) => (idx === i ? { ...x, na } : x)) })); this.save(); }
  addService(): void { this.mut((c) => ({ ...c, services: [...this.services(), { name: 'New item', content: null }] })); this.save(); }
  removeService(i: number): void { this.mut((c) => ({ ...c, services: this.services().filter((_, idx) => idx !== i) })); this.save(); }

  // payment
  mutPay(i: number, f: keyof SowPaymentRow, v: string): void { this.mut((c) => ({ ...c, payment: { ...c.payment, rows: this.payment().map((r, idx) => (idx === i ? ({ ...r, [f]: v } as SowPaymentRow) : r)) } })); }
  addPayment(): void { this.mut((c) => ({ ...c, payment: { ...c.payment, rows: [...this.payment(), { date: null, grace: null, amount: null, refundable: 'na', details: null }] } })); this.save(); }
  removePayment(i: number): void { this.mut((c) => ({ ...c, payment: { ...c.payment, rows: this.payment().filter((_, idx) => idx !== i) } })); this.save(); }

  // section-level N/A (timeline / payment)
  isSectionNa(which: 'timeline' | 'payment'): boolean { const s = this.edited()[which] as { na?: boolean } | undefined; return !!s?.na; }
  toggleSectionNa(which: 'timeline' | 'payment', na: boolean): void {
    this.mut((c) => (which === 'timeline' ? { ...c, timeline: { entries: c.timeline?.entries ?? [], na } } : { ...c, payment: { rows: c.payment?.rows ?? [], na } }));
    this.save();
  }
  toggleSpecialNa(na: boolean): void { this.mut((c) => ({ ...c, specialTerms: { name: 'Special Terms', content: this.special().content, na } })); this.save(); }
  openEditSpecial(): void { this.editTarget = { kind: 'special' }; this.editLabel.set('Special Terms'); this.editText.set(this.special().content ?? ''); this.editOpen.set(true); }

  // extra
  mutExtraName(i: number, name: string): void { this.mut((c) => ({ ...c, extra: this.extra().map((x, idx) => (idx === i ? { ...x, name } : x)) })); }
  addExtra(): void { this.mut((c) => ({ ...c, extra: [...this.extra(), { name: 'New section', content: '' }] })); this.save(); }
  removeExtra(i: number): void { this.mut((c) => ({ ...c, extra: this.extra().filter((_, idx) => idx !== i) })); this.save(); }

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

  // prose edit dialog (services / extra content)
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
  const projectDetails = p
    ? [p.venueName ? `**Location:** ${p.venueName}` : null, p.eventDate ? `**Date:** ${p.eventDate}` : null, p.durationDays ? `**Duration:** ${p.durationDays} day(s)` : null, p.guestCount ? `**Guests:** ${p.guestCount}` : null].filter(Boolean).join('  \n') || null
    : null;
  const scope = pre.items.length ? pre.items.map((it) => `**${it.name}**${it.price != null ? ` — £${it.price}` : ''}${it.description ? `  \n${it.description}` : ''}`).join('\n\n') : null;
  const includedServices = pre.items.map((it) => it.installDescription).filter((x): x is string => !!x && !!x.trim()).join('  \n') || null;
  return {
    timeline: { entries: p?.eventDate ? [{ date: p.eventDate, to: null, from: null, details: null }] : [] },
    services: [
      { name: 'Project Details', content: projectDetails, na: !projectDetails },
      { name: 'Scope', content: scope, na: !scope },
      { name: 'Concept & Design', content: null, na: true },
      { name: 'Bespoke Render', content: null, na: true },
      { name: 'Included Services', content: includedServices, na: !includedServices },
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
