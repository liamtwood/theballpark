// pV2-SOW-01 (Phase 2) — the SOW panel at the top of a per-supplier inbox thread.
// Content-authored, bidirectional: the author (the supplier in v1) creates/edits
// the SOW; the counterparty signs first, the author counter-signs. Viewer-aware
// off the thread + the loaded doc's author org. First pass — renders content[]
// sections (md), the status pill, and the contextual action (create/edit/sign).

import { ChangeDetectionStrategy, Component, computed, inject, input, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { SowService } from '../../core/sow/sow.service';
import { Sow, SowSection } from '../../core/sow/sow.types';
import { InboxThread } from '../../core/inbox/inbox.service';
import { ModalComponent } from '../../shared/modal/modal.component';
import { StatusPillComponent } from '../../shared/status-pill/status-pill.component';
import { MarkdownPipe } from '../../shared/markdown.pipe';
import { errorDetail } from '../../core/http-error';

@Component({
  selector: 'app-sow-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ModalComponent, StatusPillComponent, MarkdownPipe],
  template: `
    <div class="rounded-[var(--radius-card)] border border-hairline bg-surface px-5 py-4">
      <!-- header: title + status + the one contextual action -->
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2.5">
          <h3 class="bp-card-title">Statement of Work</h3>
          @if (current(); as s) { <app-status-pill list="sow_status" [code]="s.status" /> }
        </div>
        <div class="flex items-center gap-2">
          @if (canCreate()) {
            <button type="button" class="bp-act bp-act--primary" (click)="startCreate()">Create SOW</button>
          }
          @if (canEdit()) {
            <button type="button" class="bp-act bp-act--outline" (click)="startEdit()">Edit</button>
          }
          @if (canSign()) {
            <button type="button" class="bp-act bp-act--green" (click)="openSign()">{{ signLabel() }}</button>
          }
        </div>
      </div>

      @if (sowsRes.isLoading()) {
        <p class="bp-body-small text-secondary mt-2">Loading…</p>
      }

      @if (mode() === 'edit') {
        <!-- author edit / create form -->
        <div class="mt-3 flex flex-col gap-3">
          <label class="bp-body-small text-secondary">Title
            <input class="bp-sow-input" [ngModel]="fName()" (ngModelChange)="fName.set($event)" placeholder="Statement of Work" />
          </label>

          @for (sec of fSections(); track $index) {
            <div class="rounded-md border border-hairline p-3">
              <div class="flex items-center justify-between gap-2">
                <input class="bp-sow-input flex-1" [ngModel]="sec.name" (ngModelChange)="setSectionName($index, $event)" placeholder="Section (e.g. Scope, Timeline, Payment)" />
                <button type="button" class="bp-act bp-act--transparent" (click)="removeSection($index)" [disabled]="fSections().length <= 1">Remove</button>
              </div>
              <textarea class="bp-sow-input mt-2 min-h-24 w-full" [ngModel]="sec.content" (ngModelChange)="setSectionContent($index, $event)" placeholder="What you'll deliver, prices, terms… (Markdown)"></textarea>
            </div>
          }
          <button type="button" class="bp-act bp-act--outline self-start" (click)="addSection()">+ Add section</button>

          <label class="bp-body-small text-secondary">Deposit %
            <input class="bp-sow-input w-32" type="number" min="0" max="100" [ngModel]="fDeposit()" (ngModelChange)="fDeposit.set($event)" placeholder="e.g. 30" />
          </label>

          <div class="flex items-center gap-2">
            <button type="button" class="bp-btn--primary" [disabled]="saving() || !fName().trim()" (click)="save()">{{ saving() ? 'Saving…' : 'Save' }}</button>
            <button type="button" class="bp-btn--secondary" (click)="mode.set('view')">Cancel</button>
          </div>
        </div>
      } @else if (current(); as s) {
        <!-- rendered SOW -->
        @for (sec of s.content; track sec.order) {
          <section class="mt-3">
            <h4 class="bp-card-title">{{ sec.name }}</h4>
            <div class="bp-body-small text-secondary" [innerHTML]="sec.content | md"></div>
          </section>
        }
        <div class="mt-3 border-t border-hairline pt-2">
          @if (s.depositPct != null) { <p class="bp-body-small">Deposit: <strong>{{ s.depositPct }}%</strong></p> }
          <p class="bp-body-small text-secondary">Ballpark platform fee: {{ s.platformFeePct ?? 3 }}%</p>
          @if (s.status === 'counterparty_signed') {
            <p class="bp-body-small text-secondary mt-1">
              @if (isAuthor()) { Signed by the other party — your counter-signature executes it. }
              @else { You've signed — awaiting the author's counter-signature. }
            </p>
          }
          @if (s.status === 'executed') { <p class="bp-body-small mt-1 font-semibold text-success">Executed.</p> }
        </div>
      } @else {
        <p class="bp-body-small text-secondary mt-2">
          @if (viewer() === 'supplier') { No SOW yet — create one to send to the agency. }
          @else { The supplier hasn't created a SOW yet. }
        </p>
      }

      @if (error()) { <p class="bp-body-small text-danger mt-2">{{ error() }}</p> }
    </div>

    <!-- sign dialog -->
    <app-modal [open]="signOpen()" [title]="signLabel() + ' the SOW'" (close)="signOpen.set(false)">
      <div class="flex flex-col gap-3">
        <label class="bp-body-small text-secondary">Your name
          <input class="bp-sow-input" [ngModel]="signName()" (ngModelChange)="signName.set($event)" />
        </label>
        <label class="bp-body-small text-secondary">Title (optional)
          <input class="bp-sow-input" [ngModel]="signTitle()" (ngModelChange)="signTitle.set($event)" />
        </label>
        @if (error()) { <p class="bp-body-small text-danger">{{ error() }}</p> }
      </div>
      <button modalFooter type="button" class="bp-btn--secondary" (click)="signOpen.set(false)">Cancel</button>
      <button modalFooter type="button" class="bp-btn--primary" [disabled]="saving() || !signName().trim()" (click)="doSign()">{{ saving() ? 'Signing…' : signLabel() }}</button>
    </app-modal>
  `,
  styles: [`
    .bp-sow-input {
      display: block; width: 100%; margin-top: 0.25rem;
      border: 1px solid var(--color-hairline); border-radius: var(--radius-sm, 0.5rem);
      background: var(--color-surface); padding: 0.5rem 0.75rem; font: inherit; color: inherit;
    }
  `],
})
export class SowPanelComponent {
  readonly thread = input.required<InboxThread>();
  readonly viewer = input.required<'agency' | 'supplier'>();

  private readonly sowSvc = inject(SowService);

  // ── load + current ──────────────────────────────────────────────────────────
  private readonly key = computed(() => {
    const t = this.thread();
    return t?.projectId ? t.projectId : undefined;
  });
  protected readonly sowsRes = resource({
    params: () => this.key(),
    loader: ({ params }) => firstValueFrom(this.sowSvc.list(params)),
  });
  // Scope to THIS thread's engagement (per-supplier), then "current" = latest
  // non-declined (the list is created_at DESC).
  private readonly sows = computed<Sow[]>(() => {
    const all = this.sowsRes.value() ?? [];
    const sup = this.thread()?.supplierOrgId;
    return all.filter((s) => s.supplierOrgId === sup);
  });
  protected readonly current = computed<Sow | null>(() => this.sows().find((s) => s.status !== 'declined') ?? null);

  // my org on this engagement; whether I authored the current doc
  private readonly myOrgId = computed(() => (this.viewer() === 'supplier' ? this.thread()?.supplierOrgId : this.thread()?.agencyOrgId) ?? null);
  protected readonly isAuthor = computed(() => {
    const s = this.current();
    return !!s && !!this.myOrgId() && s.orgId === this.myOrgId();
  });

  // ── contextual action gates ─────────────────────────────────────────────────
  // v1: the supplier authors. Counterparty signs first (from draft); author
  // counter-signs (from counterparty_signed).
  protected readonly canCreate = computed(() => !this.current() && this.viewer() === 'supplier');
  protected readonly canEdit = computed(() => {
    const s = this.current();
    return !!s && s.status === 'draft' && this.isAuthor();
  });
  protected readonly canSign = computed(() => {
    const s = this.current();
    if (!s) return false;
    return this.isAuthor() ? s.status === 'counterparty_signed' : s.status === 'draft';
  });
  protected readonly signLabel = computed(() => (this.isAuthor() ? 'Counter-sign' : 'Sign'));

  // ── edit form state ─────────────────────────────────────────────────────────
  protected readonly mode = signal<'view' | 'edit'>('view');
  protected readonly fName = signal('');
  protected readonly fDeposit = signal<number | null>(null);
  protected readonly fSections = signal<SowSection[]>([]);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  startCreate(): void {
    this.fName.set('Statement of Work');
    this.fDeposit.set(null);
    this.fSections.set([{ name: 'Scope', content: '', order: 1 }]);
    this.error.set(null);
    this.mode.set('edit');
  }
  startEdit(): void {
    const s = this.current();
    if (!s) return;
    this.fName.set(s.name);
    this.fDeposit.set(s.depositPct);
    this.fSections.set(s.content.length ? s.content.map((x) => ({ ...x })) : [{ name: 'Scope', content: '', order: 1 }]);
    this.error.set(null);
    this.mode.set('edit');
  }
  addSection(): void {
    this.fSections.update((xs) => [...xs, { name: '', content: '', order: xs.length + 1 }]);
  }
  removeSection(i: number): void {
    this.fSections.update((xs) => xs.filter((_, idx) => idx !== i).map((x, idx) => ({ ...x, order: idx + 1 })));
  }
  setSectionName(i: number, v: string): void {
    this.fSections.update((xs) => xs.map((x, idx) => (idx === i ? { ...x, name: v } : x)));
  }
  setSectionContent(i: number, v: string): void {
    this.fSections.update((xs) => xs.map((x, idx) => (idx === i ? { ...x, content: v } : x)));
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    const sections = this.fSections().map((x, idx) => ({ name: x.name, content: x.content, order: idx + 1 }));
    const deposit = this.fDeposit();
    try {
      const cur = this.current();
      if (cur && cur.status === 'draft' && this.isAuthor()) {
        await firstValueFrom(this.sowSvc.update(cur.id, { name: this.fName(), content: sections, depositPct: deposit ?? undefined }));
      } else {
        await firstValueFrom(this.sowSvc.create({ projectId: this.thread().projectId, name: this.fName(), content: sections, depositPct: deposit ?? undefined }));
      }
      this.mode.set('view');
      this.sowsRes.reload();
    } catch (e) {
      this.error.set(errorDetail(e) || 'Could not save the SOW');
    } finally {
      this.saving.set(false);
    }
  }

  // ── sign ────────────────────────────────────────────────────────────────────
  protected readonly signOpen = signal(false);
  protected readonly signName = signal('');
  protected readonly signTitle = signal('');

  openSign(): void {
    this.signName.set('');
    this.signTitle.set('');
    this.error.set(null);
    this.signOpen.set(true);
  }
  async doSign(): Promise<void> {
    const s = this.current();
    if (!s) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.sowSvc.sign(s.id, { name: this.signName(), title: this.signTitle() || undefined }));
      this.signOpen.set(false);
      this.sowsRes.reload();
    } catch (e) {
      this.error.set(errorDetail(e) || 'Could not sign');
    } finally {
      this.saving.set(false);
    }
  }
}
