// pV2-SOW-01 (Phase 2) — the SOW at the top of a per-supplier inbox thread,
// rendered as a DOCUMENT: structured sections with headings, prose blocks shown
// as text with a hover → edit dialog, Timeline as structured dated entries,
// Payment as inline fields, a per-section N/A checkbox, boilerplate hidden.
// Content-authored, pre-filled from the project + the supplier's items. The
// author (supplier) edits while draft; the agency signs first, supplier counter-signs.
//
// Edits go through a LOCAL working copy (edited) so inline typing doesn't
// round-trip per keystroke; save() PATCHes the whole content on blur / discrete
// actions and reloads.

import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, resource, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { SowService } from '../../core/sow/sow.service';
import { Sow, SowContent, SowPaymentRow, SowPrefill, SowTimelineEntry } from '../../core/sow/sow.types';
import { InboxThread } from '../../core/inbox/inbox.service';
import { ModalComponent } from '../../shared/modal/modal.component';
import { StatusPillComponent } from '../../shared/status-pill/status-pill.component';
import { MarkdownPipe } from '../../shared/markdown.pipe';
import { errorDetail } from '../../core/http-error';

interface ProseRow { key: keyof SowContent; label: string; }

@Component({
  selector: 'app-sow-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, FormsModule, ModalComponent, StatusPillComponent, MarkdownPipe],
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
      <!-- a stack of section CARDS (bp-card, like the project Ballpark item cards);
           ready to become drag-reorderable later -->
      <div class="mt-3 flex flex-col gap-3">
        <!-- Timeline card (structured dated entries) -->
        <div class="bp-card p-4">
          <ng-container [ngTemplateOutlet]="headTpl" [ngTemplateOutletContext]="{ key: 'timeline', label: 'Timeline' }" />
          <div class="mt-2">
            @if (isNa('timeline')) { <div class="bp-body-small text-muted italic">N/A</div> }
            @else {
              @for (e of timeline(); track $index) {
                <div class="mb-1 flex items-start gap-2 bp-body-small">
                  @if (editable()) {
                    <input class="bp-sow-input w-28" [ngModel]="e.date" (ngModelChange)="mutTimeline($index, 'date', $event)" (change)="save()" placeholder="Date" />
                    <input class="bp-sow-input flex-1" [ngModel]="e.note" (ngModelChange)="mutTimeline($index, 'note', $event)" (change)="save()" placeholder="What happens" />
                    <button type="button" class="bp-act bp-act--transparent" (click)="removeTimeline($index)">✕</button>
                  } @else {
                    <span class="font-semibold shrink-0">{{ e.date || '—' }}</span>
                    <span class="flex-1" [innerHTML]="(e.note || '') | md"></span>
                  }
                </div>
              }
              @if (editable()) { <button type="button" class="bp-act bp-act--outline mt-1" (click)="addTimeline()">+ Add date</button> }
              @else if (!timeline().length) { <span class="bp-body-small text-muted italic">N/A</span> }
            }
          </div>
        </div>

        <!-- Services & Goods cards -->
        @for (row of servicesRows; track row.key) {
          <ng-container [ngTemplateOutlet]="proseTpl" [ngTemplateOutletContext]="{ row }" />
        }

        <!-- Fee & Payment cards -->
        <ng-container [ngTemplateOutlet]="payTpl" [ngTemplateOutletContext]="{ which: 'deposit', label: 'Deposit' }" />
        <ng-container [ngTemplateOutlet]="payTpl" [ngTemplateOutletContext]="{ which: 'final', label: 'Final' }" />
        <ng-container [ngTemplateOutlet]="proseTpl" [ngTemplateOutletContext]="{ row: { key: 'specialTerms', label: 'Special Terms' } }" />

        <!-- Extra cards -->
        @for (ex of extra(); track $index) {
          <div class="bp-card p-4 group">
            <div class="flex items-center justify-between gap-2">
              @if (editable()) { <input class="bp-sow-input flex-1" [ngModel]="ex.name" (ngModelChange)="mutExtraName($index, $event)" (change)="save()" placeholder="Section" /> }
              @else { <div class="bp-card-title">{{ ex.name || 'Section' }}</div> }
              @if (editable()) {
                <div class="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100">
                  <button type="button" class="bp-act bp-act--transparent" (click)="openEditExtra($index, ex.name)">Edit</button>
                  <button type="button" class="bp-act bp-act--transparent" (click)="removeExtra($index)">Remove</button>
                </div>
              }
            </div>
            <div class="mt-2 bp-body-small" [innerHTML]="(ex.content || '') | md"></div>
          </div>
        }
        @if (editable()) { <button type="button" class="bp-act bp-act--outline self-start" (click)="addExtra()">+ Add section</button> }

        <p class="bp-caption text-muted">Ballpark platform fee: {{ s.platformFeePct ?? 3 }}%</p>

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

    <!-- heading + N/A checkbox -->
    <ng-template #headTpl let-key="key" let-label="label">
      <div class="flex items-start gap-2">
        <div class="bp-card-title">{{ label }}</div>
        @if (editable()) {
          <label class="bp-caption flex items-center gap-1 text-muted"><input type="checkbox" [checked]="isNa(key)" (change)="toggleNa(key, $any($event.target).checked)" /> N/A</label>
        }
      </div>
    </ng-template>

    <!-- prose section card: heading + N/A, then text (or N/A), hover → Edit -->
    <ng-template #proseTpl let-row="row">
      <div class="bp-card p-4 group">
        <ng-container [ngTemplateOutlet]="headTpl" [ngTemplateOutletContext]="{ key: row.key, label: row.label }" />
        <div class="mt-2 flex items-start justify-between gap-2">
          @if (isNa(row.key)) {
            <div class="bp-body-small flex-1 text-muted italic">N/A</div>
          } @else if (prose(row.key); as v) {
            <div class="bp-body-small flex-1" [innerHTML]="v | md"></div>
          } @else {
            <div class="bp-body-small flex-1 text-muted">—</div>
          }
          @if (editable() && !isNa(row.key)) {
            <button type="button" class="bp-act bp-act--transparent shrink-0 opacity-0 group-hover:opacity-100" (click)="openEdit(row.key, row.label)">Edit</button>
          }
        </div>
      </div>
    </ng-template>

    <!-- payment section card: inline fields + a description prose block, with N/A -->
    <ng-template #payTpl let-which="which" let-label="label">
      <div class="bp-card p-4 group">
        <ng-container [ngTemplateOutlet]="headTpl" [ngTemplateOutletContext]="{ key: which, label }" />
        <div class="mt-2">
          @if (isNa(which)) { <div class="bp-body-small text-muted italic">N/A</div> }
          @else {
            <div class="flex flex-wrap items-center gap-2 bp-body-small">
              @if (editable()) {
                <input class="bp-sow-num" type="number" min="0" max="100" [ngModel]="pay(which).pct" (ngModelChange)="mutPay(which, 'pct', $event)" (change)="save()" />% ·
                due <input class="bp-sow-input w-28" [ngModel]="pay(which).dateLabel" (ngModelChange)="mutPay(which, 'dateLabel', $event)" (change)="save()" /> ·
                grace <input class="bp-sow-num" type="number" min="0" [ngModel]="pay(which).graceDays" (ngModelChange)="mutPay(which, 'graceDays', $event)" (change)="save()" />d ·
                refundable
                <select class="bp-sow-input" [ngModel]="pay(which).refundable" (ngModelChange)="mutPay(which, 'refundable', $event); save()">
                  <option value="yes">Yes</option><option value="no">No</option><option value="partial">Partial</option><option value="na">N/A</option>
                </select>
              } @else {
                <span><strong>{{ pay(which).pct ?? 0 }}%</strong> · due {{ pay(which).dateLabel || '—' }} · grace {{ pay(which).graceDays ?? 0 }}d · refundable {{ refundableLabel(pay(which).refundable) }}</span>
              }
            </div>
            <div class="mt-1 flex items-start justify-between gap-2">
              @if (pay(which).description; as d) { <div class="bp-body-small flex-1" [innerHTML]="d | md"></div> }
              @else { <div class="bp-caption flex-1 text-muted italic">No note</div> }
              @if (editable()) {
                <button type="button" class="bp-act bp-act--transparent shrink-0 opacity-0 group-hover:opacity-100" (click)="openEditPay(which, label)">Edit note</button>
              }
            </div>
          }
        </div>
      </div>
    </ng-template>

    <!-- text-block edit dialog -->
    <app-modal [open]="editOpen()" [title]="'Edit ' + editLabel()" (close)="editOpen.set(false)">
      <textarea class="bp-sow-input min-h-40 w-full" [ngModel]="editText()" (ngModelChange)="editText.set($event)" placeholder="Markdown supported"></textarea>
      <button modalFooter type="button" class="bp-btn--secondary" (click)="editOpen.set(false)">Cancel</button>
      <button modalFooter type="button" class="bp-btn--primary" [disabled]="busy()" (click)="saveEdit()">{{ busy() ? 'Saving…' : 'Save' }}</button>
    </app-modal>

    <!-- sign dialog -->
    <app-modal [open]="signOpen()" [title]="signLabel() + ' the SOW'" (close)="signOpen.set(false)">
      <div class="flex flex-col gap-3">
        <label class="bp-body-small text-secondary">Your name
          <input class="bp-sow-input" [ngModel]="signName()" (ngModelChange)="signName.set($event)" />
        </label>
        <label class="bp-body-small text-secondary">Title (optional)
          <input class="bp-sow-input" [ngModel]="signTitle()" (ngModelChange)="signTitle.set($event)" />
        </label>
      </div>
      <button modalFooter type="button" class="bp-btn--secondary" (click)="signOpen.set(false)">Cancel</button>
      <button modalFooter type="button" class="bp-btn--primary" [disabled]="busy() || !signName().trim()" (click)="doSign()">{{ busy() ? 'Signing…' : signLabel() }}</button>
    </app-modal>
  `,
  styles: [`
    .bp-sow-input { border: 1px solid var(--color-hairline); border-radius: var(--radius-sm, 0.5rem); background: var(--color-surface); padding: 0.4rem 0.6rem; font: inherit; color: inherit; }
    .bp-sow-num { width: 3.5rem; border: 1px solid var(--color-hairline); border-radius: var(--radius-sm, 0.5rem); background: var(--color-surface); padding: 0.2rem 0.4rem; font: inherit; color: inherit; }
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

  // local working copy — tracks current content, mutated in place, saved on blur
  protected readonly edited = linkedSignal<SowContent>(() => (this.current()?.content as SowContent) ?? {});

  private readonly myOrgId = computed(() => (this.viewer() === 'supplier' ? this.thread()?.supplierOrgId : this.thread()?.agencyOrgId) ?? null);
  protected readonly isAuthor = computed(() => { const s = this.current(); return !!s && !!this.myOrgId() && s.orgId === this.myOrgId(); });
  protected readonly editable = computed(() => this.isAuthor() && this.current()?.status === 'draft');

  protected readonly canCreate = computed(() => !this.current() && this.viewer() === 'supplier');
  protected readonly canSign = computed(() => { const s = this.current(); if (!s) return false; return this.isAuthor() ? s.status === 'counterparty_signed' : s.status === 'draft'; });
  protected readonly signLabel = computed(() => (this.isAuthor() ? 'Counter-sign' : 'Sign'));

  protected readonly servicesRows: ProseRow[] = [
    { key: 'projectDetails', label: 'Project Details' },
    { key: 'conceptDesign', label: 'Concept & Design sign-off' },
    { key: 'bespokeRender', label: 'Bespoke Render' },
    { key: 'includedServices', label: 'Included Services' },
    { key: 'scope', label: 'Scope' },
  ];
  protected readonly timeline = computed<SowTimelineEntry[]>(() => this.edited().timeline?.entries ?? []);
  protected readonly extra = computed(() => this.edited().extra ?? []);

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  // reads
  protected isNa(key: string): boolean { return (this.edited().na ?? []).includes(key); }
  protected prose(key: keyof SowContent): string | null { const v = this.edited()[key]; return typeof v === 'string' && v.trim() ? v : null; }
  protected pay(which: 'deposit' | 'final'): SowPaymentRow {
    const p = this.edited().payment;
    return (p && p[which]) || { pct: null, dateLabel: null, graceDays: null, refundable: 'na', description: null };
  }
  protected refundableLabel(r: SowPaymentRow['refundable']): string { return r === 'yes' ? 'Yes' : r === 'no' ? 'No' : r === 'partial' ? 'Partial' : 'N/A'; }

  // local mutators (no server call) — paired with save() on blur/discrete action
  private mut(fn: (c: SowContent) => SowContent): void { this.edited.update((c) => fn({ ...c })); }
  mutPay(which: 'deposit' | 'final', field: keyof SowPaymentRow, value: unknown): void {
    this.mut((c) => {
      const p = c.payment ?? { deposit: this.pay('deposit'), final: this.pay('final') };
      return { ...c, payment: { ...p, [which]: { ...p[which], [field]: value } as SowPaymentRow } };
    });
  }
  mutTimeline(i: number, field: keyof SowTimelineEntry, value: string): void {
    this.mut((c) => ({ ...c, timeline: { entries: this.timeline().map((e, idx) => (idx === i ? { ...e, [field]: value } : e)) } }));
  }
  addTimeline(): void { this.mut((c) => ({ ...c, timeline: { entries: [...this.timeline(), { date: null, note: null }] } })); this.save(); }
  removeTimeline(i: number): void { this.mut((c) => ({ ...c, timeline: { entries: this.timeline().filter((_, idx) => idx !== i) } })); this.save(); }
  mutExtraName(i: number, name: string): void { this.mut((c) => ({ ...c, extra: this.extra().map((x, idx) => (idx === i ? { ...x, name } : x)) })); }
  addExtra(): void { this.mut((c) => ({ ...c, extra: [...this.extra(), { name: 'New section', content: '' }] })); this.save(); }
  removeExtra(i: number): void { this.mut((c) => ({ ...c, extra: this.extra().filter((_, idx) => idx !== i) })); this.save(); }
  toggleNa(key: string, checked: boolean): void {
    this.mut((c) => { const na = new Set(c.na ?? []); if (checked) na.add(key); else na.delete(key); return { ...c, na: [...na] }; });
    this.save();
  }

  // persist the working copy
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

  // create (pre-filled)
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

  // text-block edit dialog
  protected readonly editOpen = signal(false);
  protected readonly editLabel = signal('');
  protected readonly editText = signal('');
  private editTarget: { kind: 'prose'; key: keyof SowContent } | { kind: 'pay'; which: 'deposit' | 'final' } | { kind: 'extra'; i: number } | null = null;
  openEdit(key: keyof SowContent, label: string): void { this.editTarget = { kind: 'prose', key }; this.editLabel.set(label); this.editText.set(this.prose(key) ?? ''); this.editOpen.set(true); }
  openEditPay(which: 'deposit' | 'final', label: string): void { this.editTarget = { kind: 'pay', which }; this.editLabel.set(label + ' note'); this.editText.set(this.pay(which).description ?? ''); this.editOpen.set(true); }
  openEditExtra(i: number, label: string): void { this.editTarget = { kind: 'extra', i }; this.editLabel.set(label || 'Section'); this.editText.set(this.extra()[i]?.content ?? ''); this.editOpen.set(true); }
  async saveEdit(): Promise<void> {
    const t = this.editTarget;
    if (!t) return;
    const val = this.editText().trim() || null;
    if (t.kind === 'prose') { this.mut((c) => ({ ...c, [t.key]: val })); }
    else if (t.kind === 'pay') { this.mutPay(t.which, 'description', val); }
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
    ? [
        p.venueName ? `**Location:** ${p.venueName}` : null,
        p.eventDate ? `**Date:** ${p.eventDate}` : null,
        p.durationDays ? `**Duration:** ${p.durationDays} day(s)` : null,
        p.guestCount ? `**Guests:** ${p.guestCount}` : null,
      ].filter(Boolean).join('  \n') || null
    : null;
  const scope = pre.items.length
    ? pre.items.map((it) => `**${it.name}**${it.price != null ? ` — £${it.price}` : ''}${it.description ? `  \n${it.description}` : ''}`).join('\n\n')
    : null;
  const includedServices = pre.items.map((it) => it.installDescription).filter((x): x is string => !!x && !!x.trim()).join('  \n') || null;
  return {
    timeline: { entries: p?.eventDate ? [{ date: p.eventDate, note: null }] : [] },
    projectDetails,
    conceptDesign: null,
    bespokeRender: null,
    includedServices,
    scope,
    payment: {
      deposit: { pct: 50, dateLabel: 'SOW date', graceDays: 3, refundable: 'na', description: null },
      final: { pct: 50, dateLabel: 'Event date', graceDays: 7, refundable: 'na', description: null },
    },
    specialTerms: null,
    na: ['conceptDesign', 'bespokeRender', 'specialTerms'],
    extra: [],
  };
}
