// pV2-SOW-01 (Phase 2) — the SOW at the top of a per-supplier inbox thread,
// rendered as a DOCUMENT (not a form): structured sections with their headings,
// prose blocks shown as text with a hover → edit dialog, payment as inline
// fields, N/A where there's no data, boilerplate (intro/parties/schedule/
// signature) hidden. Content-authored, pre-filled from the project + the
// supplier's items. The supplier (author) edits while draft; the agency signs
// first, the supplier counter-signs.

import { ChangeDetectionStrategy, Component, computed, inject, input, resource, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { SowService } from '../../core/sow/sow.service';
import { Sow, SowContent, SowPaymentRow, SowPrefill } from '../../core/sow/sow.types';
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
    <!-- header -->
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
      <!-- the document -->
      <div class="mt-3 flex flex-col gap-4">
        <!-- Timeline -->
        <ng-container [ngTemplateOutlet]="proseTpl" [ngTemplateOutletContext]="{ row: { key: 'timeline', label: 'Timeline' } }" />

        <!-- Services & Goods -->
        <div>
          <div class="bp-caption uppercase tracking-wide text-muted">Services &amp; Goods</div>
          <div class="mt-1 flex flex-col gap-3">
            @for (row of servicesRows; track row.key) {
              <ng-container [ngTemplateOutlet]="proseTpl" [ngTemplateOutletContext]="{ row }" />
            }
          </div>
        </div>

        <!-- Fee & Payment -->
        <div>
          <div class="bp-caption uppercase tracking-wide text-muted">Fee &amp; Payment Terms</div>
          <div class="mt-1 flex flex-col gap-3">
            <ng-container [ngTemplateOutlet]="payTpl" [ngTemplateOutletContext]="{ which: 'deposit', label: 'Deposit' }" />
            <ng-container [ngTemplateOutlet]="payTpl" [ngTemplateOutletContext]="{ which: 'final', label: 'Final' }" />
            <ng-container [ngTemplateOutlet]="proseTpl" [ngTemplateOutletContext]="{ row: { key: 'specialTerms', label: 'Special Terms' } }" />
          </div>
          <p class="bp-caption text-muted mt-2">Ballpark platform fee: {{ s.platformFeePct ?? 3 }}%</p>
        </div>

        <!-- Extra (add-section) -->
        @for (ex of extra(); track $index) {
          <div class="grid grid-cols-[180px_1fr] gap-3 group">
            <div>
              @if (editable()) {
                <input class="bp-sow-input" [ngModel]="ex.name" (ngModelChange)="setExtraName($index, $event)" placeholder="Section" />
              } @else { <div class="bp-card-title">{{ ex.name || 'Section' }}</div> }
            </div>
            <div class="flex items-start justify-between gap-2">
              <div class="bp-body-small flex-1" [innerHTML]="ex.content | md"></div>
              @if (editable()) {
                <div class="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100">
                  <button type="button" class="bp-act bp-act--transparent" (click)="openEditExtra($index, ex.name)">Edit</button>
                  <button type="button" class="bp-act bp-act--transparent" (click)="removeExtra($index)">Remove</button>
                </div>
              }
            </div>
          </div>
        }
        @if (editable()) {
          <button type="button" class="bp-act bp-act--outline self-start" (click)="addExtra()">+ Add section</button>
        }

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

    <!-- reusable prose row: heading left, text (or N/A) right, hover → Edit -->
    <ng-template #proseTpl let-row="row">
      <div class="grid grid-cols-[180px_1fr] gap-3 group">
        <div class="bp-card-title">{{ row.label }}</div>
        <div class="flex items-start justify-between gap-2">
          @if (prose(row.key); as v) {
            <div class="bp-body-small flex-1" [innerHTML]="v | md"></div>
          } @else {
            <div class="bp-body-small flex-1 text-muted italic">N/A</div>
          }
          @if (editable()) {
            <button type="button" class="bp-act bp-act--transparent shrink-0 opacity-0 group-hover:opacity-100" (click)="openEdit(row.key, row.label)">Edit</button>
          }
        </div>
      </div>
    </ng-template>

    <!-- reusable payment row: inline fields + a description prose block -->
    <ng-template #payTpl let-which="which" let-label="label">
      <div class="grid grid-cols-[180px_1fr] gap-3 group">
        <div class="bp-card-title">{{ label }}</div>
        <div>
          <div class="flex flex-wrap items-center gap-2 bp-body-small">
            @if (editable()) {
              <input class="bp-sow-num" type="number" min="0" max="100" [ngModel]="pay(which).pct" (ngModelChange)="setPay(which, 'pct', $event)" />% ·
              due <input class="bp-sow-input w-28" [ngModel]="pay(which).dateLabel" (ngModelChange)="setPay(which, 'dateLabel', $event)" /> ·
              grace <input class="bp-sow-num" type="number" min="0" [ngModel]="pay(which).graceDays" (ngModelChange)="setPay(which, 'graceDays', $event)" />d ·
              refundable
              <select class="bp-sow-input" [ngModel]="pay(which).refundable" (ngModelChange)="setPay(which, 'refundable', $event)">
                <option value="yes">Yes</option><option value="no">No</option><option value="partial">Partial</option><option value="na">N/A</option>
              </select>
            } @else {
              <span><strong>{{ pay(which).pct ?? 0 }}%</strong> · due {{ pay(which).dateLabel || '—' }} · grace {{ pay(which).graceDays ?? 0 }}d · refundable {{ refundableLabel(pay(which).refundable) }}</span>
            }
          </div>
          <div class="mt-1 flex items-start justify-between gap-2">
            @if (pay(which).description; as d) {
              <div class="bp-body-small flex-1" [innerHTML]="d | md"></div>
            } @else { <div class="bp-caption flex-1 text-muted italic">No note</div> }
            @if (editable()) {
              <button type="button" class="bp-act bp-act--transparent shrink-0 opacity-0 group-hover:opacity-100" (click)="openEditPay(which, label)">Edit note</button>
            }
          </div>
        </div>
      </div>
    </ng-template>

    <!-- text-block edit dialog -->
    <app-modal [open]="editOpen()" [title]="'Edit ' + editLabel()" (close)="editOpen.set(false)">
      <textarea class="bp-sow-input min-h-40 w-full" [ngModel]="editText()" (ngModelChange)="editText.set($event)" placeholder="Markdown supported — leave blank for N/A"></textarea>
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
  host: { '[attr.data-sow]': '"1"' },
})
export class SowPanelComponent {
  readonly thread = input.required<InboxThread>();
  readonly viewer = input.required<'agency' | 'supplier'>();

  private readonly sowSvc = inject(SowService);

  // needed because we use ngTemplateOutlet in the template
  // (NgTemplateOutlet is part of CommonModule, imported via FormsModule? no —
  //  it's a structural directive; add it explicitly below in imports)

  // ── load + current ──
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
  protected readonly doc = computed<SowContent>(() => (this.current()?.content as SowContent) ?? {});

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
  protected readonly extra = computed(() => this.doc().extra ?? []);

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  // ── reads for the template ──
  protected prose(key: keyof SowContent): string | null {
    const v = this.doc()[key];
    return typeof v === 'string' && v.trim() ? v : null;
  }
  protected pay(which: 'deposit' | 'final'): SowPaymentRow {
    const p = this.doc().payment;
    return (p && p[which]) || { pct: null, dateLabel: null, graceDays: null, refundable: 'na', description: null };
  }
  protected refundableLabel(r: SowPaymentRow['refundable']): string {
    return r === 'yes' ? 'Yes' : r === 'no' ? 'No' : r === 'partial' ? 'Partial' : 'N/A';
  }

  // ── create (pre-filled) ──
  async create(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      const pre = await firstValueFrom(this.sowSvc.prefill(this.thread().projectId));
      const content = buildInitial(pre);
      await firstValueFrom(this.sowSvc.create({ projectId: this.thread().projectId, name: 'Statement of Work', content }));
      this.sowsRes.reload();
    } catch (e) {
      this.error.set(errorDetail(e) || 'Could not create the SOW');
    } finally {
      this.busy.set(false);
    }
  }

  // ── persist a content change (merge + PATCH + reload) ──
  private async patchContent(partial: Partial<SowContent>): Promise<void> {
    const cur = this.current();
    if (!cur) return;
    this.busy.set(true);
    this.error.set(null);
    const merged: SowContent = { ...this.doc(), ...partial };
    try {
      await firstValueFrom(this.sowSvc.update(cur.id, { content: merged }));
      this.sowsRes.reload();
    } catch (e) {
      this.error.set(errorDetail(e) || 'Could not save');
    } finally {
      this.busy.set(false);
    }
  }

  setPay(which: 'deposit' | 'final', field: keyof SowPaymentRow, value: unknown): void {
    const p = this.doc().payment ?? { deposit: this.pay('deposit'), final: this.pay('final') };
    const row = { ...p[which], [field]: value } as SowPaymentRow;
    this.patchContent({ payment: { ...p, [which]: row } });
  }

  // extra sections
  addExtra(): void { this.patchContent({ extra: [...this.extra(), { name: 'New section', content: '' }] }); }
  removeExtra(i: number): void { this.patchContent({ extra: this.extra().filter((_, idx) => idx !== i) }); }
  setExtraName(i: number, name: string): void { this.patchContent({ extra: this.extra().map((x, idx) => (idx === i ? { ...x, name } : x)) }); }

  // ── text-block edit dialog ──
  protected readonly editOpen = signal(false);
  protected readonly editLabel = signal('');
  protected readonly editText = signal('');
  private editTarget: { kind: 'prose'; key: keyof SowContent } | { kind: 'pay'; which: 'deposit' | 'final' } | { kind: 'extra'; i: number } | null = null;

  openEdit(key: keyof SowContent, label: string): void {
    this.editTarget = { kind: 'prose', key };
    this.editLabel.set(label);
    this.editText.set(this.prose(key) ?? '');
    this.editOpen.set(true);
  }
  openEditPay(which: 'deposit' | 'final', label: string): void {
    this.editTarget = { kind: 'pay', which };
    this.editLabel.set(label + ' note');
    this.editText.set(this.pay(which).description ?? '');
    this.editOpen.set(true);
  }
  openEditExtra(i: number, label: string): void {
    this.editTarget = { kind: 'extra', i };
    this.editLabel.set(label || 'Section');
    this.editText.set(this.extra()[i]?.content ?? '');
    this.editOpen.set(true);
  }
  async saveEdit(): Promise<void> {
    const t = this.editTarget;
    if (!t) return;
    const val = this.editText().trim() || null;
    if (t.kind === 'prose') { await this.patchContent({ [t.key]: val } as Partial<SowContent>); }
    else if (t.kind === 'pay') { this.setPay(t.which, 'description', val); }
    else { await this.patchContent({ extra: this.extra().map((x, idx) => (idx === t.i ? { ...x, content: val ?? '' } : x)) }); }
    this.editOpen.set(false);
  }

  // ── sign ──
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

// Build the initial structured content from the prefill (project + items).
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
    timeline: p?.eventDate ? `Event date: ${p.eventDate}` : null,
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
    extra: [],
  };
}
