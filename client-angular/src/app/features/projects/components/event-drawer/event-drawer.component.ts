import {
  Component, Input, Output, EventEmitter,
  ChangeDetectionStrategy, ChangeDetectorRef, OnChanges, SimpleChanges
} from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { DropdownModule } from 'primeng/dropdown';
import { SidebarModule } from 'primeng/sidebar';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LucideAngularModule, SquarePen, WandSparkles } from 'lucide-angular';

import { ProjectService } from '../../../../core/services/project.service';
import { Project } from '../../../../models';

/**
 * Event drawer — v1.29.
 *
 * Replaces the standalone /event tab. Opens from the Overview page's
 * event strip. Mirrors the Settings > Team "Member" drawer pattern
 * exactly:
 *   - p-sidebar position="right", styleClass="bp-drawer", 480px
 *   - parchment header with eyebrow + serif title + ✕ close
 *   - per-section edit toggle (pencil → tick/cross)
 *   - bp-section-header / bp-section-title section labels
 *   - view mode renders bp-field-readonly inputs, edit mode swaps to
 *     bp-input-edit
 *
 * All field definitions, dropdown options, sync/save logic come from
 * the original event.component.ts — same ProjectService.update() call,
 * same eventTypeOptions + tierOptions, same per-section snapshot/cancel.
 * The page-level tab component is no longer in the tab bar but is
 * retained on /event-legacy for git history.
 */
type SectionKey = 'details' | 'type' | 'logistics' | 'financials' | 'brief';

@Component({
  selector: 'app-event-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, TitleCasePipe, LucideAngularModule,
    ButtonModule, InputTextModule, InputNumberModule, InputTextareaModule,
    DropdownModule, SidebarModule, ToastModule
  ],
  providers: [MessageService],
  template: `
    <p-sidebar [(visible)]="visible" position="right"
               styleClass="bp-drawer" [style]="{width:'480px'}"
               [showCloseIcon]="false"
               (visibleChange)="visibleChange.emit($event)">

      <ng-template pTemplate="header">
        <div class="bp-drawer-header-row">
          <div class="bp-drawer-header">
            <span class="bp-drawer-label">PROJECT</span>
            <div class="bp-drawer-title">Event details</div>
          </div>
          <button class="bp-icon-btn" (click)="close()" title="Close">
            <i class="pi pi-times"></i>
          </button>
        </div>
      </ng-template>

      <div class="bp-drawer-body" *ngIf="project">

        <!-- ═══ SECTION 1: EVENT DETAILS ═══ -->
        <div class="bp-section-header">
          <span class="bp-section-title">EVENT DETAILS</span>
          <div class="bp-section-actions">
            <ng-container *ngIf="!editing.details">
              <button class="bp-icon-btn" (click)="startEdit('details')" title="Edit">
                <lucide-icon name="square-pen" [size]="14"></lucide-icon>
              </button>
            </ng-container>
            <ng-container *ngIf="editing.details">
              <button class="bp-icon-btn bp-icon-save" (click)="saveSection('details')"
                      [disabled]="saving" title="Save">
                <i class="pi pi-check"></i>
              </button>
              <button class="bp-icon-btn bp-icon-cancel" (click)="cancelEdit('details')" title="Cancel">
                <i class="pi pi-times"></i>
              </button>
            </ng-container>
          </div>
        </div>

        <!-- Ref is ALWAYS read-only per spec — even in edit mode. -->
        <div class="bp-evd-row bp-evd-row--ref">
          <div class="bp-evd-field">
            <label class="bp-field-label">Ref</label>
            <input pInputText [value]="form.po_ref || '—'" class="w-full bp-field-readonly bp-evd-ref" readonly/>
          </div>
          <div class="bp-evd-field">
            <label class="bp-field-label">Event name</label>
            <input pInputText *ngIf="!editing.details"
                   [value]="form.event_name || '—'"
                   class="w-full bp-field-readonly" readonly/>
            <input pInputText *ngIf="editing.details"
                   [(ngModel)]="form.event_name"
                   class="w-full bp-input-edit"/>
          </div>
          <div class="bp-evd-field">
            <label class="bp-field-label">Client</label>
            <input pInputText *ngIf="!editing.details"
                   [value]="form.client_name || '—'"
                   class="w-full bp-field-readonly" readonly/>
            <input pInputText *ngIf="editing.details"
                   [(ngModel)]="form.client_name"
                   class="w-full bp-input-edit"/>
          </div>
        </div>
        <div class="bp-evd-row bp-evd-row--2">
          <div class="bp-evd-field">
            <label class="bp-field-label">Venue</label>
            <input pInputText *ngIf="!editing.details"
                   [value]="form.venue_name || '—'"
                   class="w-full bp-field-readonly" readonly/>
            <input pInputText *ngIf="editing.details"
                   [(ngModel)]="form.venue_name"
                   class="w-full bp-input-edit"/>
          </div>
          <div class="bp-evd-field">
            <label class="bp-field-label">City</label>
            <input pInputText *ngIf="!editing.details"
                   [value]="form.venue_city || '—'"
                   class="w-full bp-field-readonly" readonly/>
            <input pInputText *ngIf="editing.details"
                   [(ngModel)]="form.venue_city"
                   class="w-full bp-input-edit"/>
          </div>
        </div>

        <!-- ═══ SECTION 2: EVENT TYPE ═══ -->
        <div class="bp-section-header bp-section-header--top">
          <span class="bp-section-title">EVENT TYPE</span>
          <div class="bp-section-actions">
            <ng-container *ngIf="!editing.type">
              <button class="bp-icon-btn" (click)="startEdit('type')" title="Edit">
                <lucide-icon name="square-pen" [size]="14"></lucide-icon>
              </button>
            </ng-container>
            <ng-container *ngIf="editing.type">
              <button class="bp-icon-btn bp-icon-save" (click)="saveSection('type')"
                      [disabled]="saving" title="Save">
                <i class="pi pi-check"></i>
              </button>
              <button class="bp-icon-btn bp-icon-cancel" (click)="cancelEdit('type')" title="Cancel">
                <i class="pi pi-times"></i>
              </button>
            </ng-container>
          </div>
        </div>

        <div class="bp-evd-row bp-evd-row--2">
          <div class="bp-evd-field">
            <label class="bp-field-label">Event type</label>
            <input pInputText *ngIf="!editing.type"
                   [value]="(form.event_type | titlecase) || '—'"
                   class="w-full bp-field-readonly" readonly/>
            <p-dropdown *ngIf="editing.type"
                        [(ngModel)]="form.event_type"
                        [options]="eventTypeOptions"
                        optionLabel="label" optionValue="value"
                        styleClass="w-full bp-input-edit"
                        placeholder="Select event type">
            </p-dropdown>
          </div>
          <div class="bp-evd-field">
            <label class="bp-field-label">Tier</label>
            <input pInputText *ngIf="!editing.type"
                   [value]="(form.tier | titlecase) || '—'"
                   class="w-full bp-field-readonly" readonly/>
            <p-dropdown *ngIf="editing.type"
                        [(ngModel)]="form.tier"
                        [options]="tierOptions"
                        optionLabel="label" optionValue="value"
                        styleClass="w-full bp-input-edit"
                        placeholder="Select tier">
            </p-dropdown>
          </div>
        </div>

        <!-- ═══ SECTION 3: LOGISTICS ═══ -->
        <div class="bp-section-header bp-section-header--top">
          <span class="bp-section-title">LOGISTICS</span>
          <div class="bp-section-actions">
            <ng-container *ngIf="!editing.logistics">
              <button class="bp-icon-btn" (click)="startEdit('logistics')" title="Edit">
                <lucide-icon name="square-pen" [size]="14"></lucide-icon>
              </button>
            </ng-container>
            <ng-container *ngIf="editing.logistics">
              <button class="bp-icon-btn bp-icon-save" (click)="saveSection('logistics')"
                      [disabled]="saving" title="Save">
                <i class="pi pi-check"></i>
              </button>
              <button class="bp-icon-btn bp-icon-cancel" (click)="cancelEdit('logistics')" title="Cancel">
                <i class="pi pi-times"></i>
              </button>
            </ng-container>
          </div>
        </div>

        <!-- v1.29: Event date is FREE TEXT per spec — dates are often
             approximate ("Late September", "TBC", "w/c 15 March").
             No p-calendar; just an input. -->
        <div class="bp-evd-row bp-evd-row--3">
          <div class="bp-evd-field">
            <label class="bp-field-label">Event date</label>
            <input pInputText *ngIf="!editing.logistics"
                   [value]="form.event_date || '—'"
                   class="w-full bp-field-readonly" readonly/>
            <input pInputText *ngIf="editing.logistics"
                   [(ngModel)]="form.event_date"
                   placeholder="e.g. 2 Jun 2026 / Late September / TBC"
                   class="w-full bp-input-edit"/>
          </div>
          <div class="bp-evd-field">
            <label class="bp-field-label">Duration (days)</label>
            <input pInputText *ngIf="!editing.logistics"
                   [value]="form.duration_days || '—'"
                   class="w-full bp-field-readonly" readonly/>
            <p-inputNumber *ngIf="editing.logistics"
                           [(ngModel)]="form.duration_days" [min]="1"
                           styleClass="w-full bp-input-edit">
            </p-inputNumber>
          </div>
          <div class="bp-evd-field">
            <label class="bp-field-label">Guest count</label>
            <input pInputText *ngIf="!editing.logistics"
                   [value]="form.guest_count || '—'"
                   class="w-full bp-field-readonly" readonly/>
            <p-inputNumber *ngIf="editing.logistics"
                           [(ngModel)]="form.guest_count" [min]="1"
                           styleClass="w-full bp-input-edit">
            </p-inputNumber>
          </div>
        </div>

        <!-- ═══ SECTION 4: FINANCIALS ═══ -->
        <div class="bp-section-header bp-section-header--top">
          <div class="bp-section-header-text">
            <span class="bp-section-title">FINANCIALS</span>
            <div class="bp-section-hint">
              Top-line numbers — full breakdown lives in Estimate
            </div>
          </div>
          <div class="bp-section-actions">
            <ng-container *ngIf="!editing.financials">
              <button class="bp-icon-btn" (click)="startEdit('financials')" title="Edit">
                <lucide-icon name="square-pen" [size]="14"></lucide-icon>
              </button>
            </ng-container>
            <ng-container *ngIf="editing.financials">
              <button class="bp-icon-btn bp-icon-save" (click)="saveSection('financials')"
                      [disabled]="saving" title="Save">
                <i class="pi pi-check"></i>
              </button>
              <button class="bp-icon-btn bp-icon-cancel" (click)="cancelEdit('financials')" title="Cancel">
                <i class="pi pi-times"></i>
              </button>
            </ng-container>
          </div>
        </div>

        <div class="bp-evd-row bp-evd-row--3">
          <div class="bp-evd-field">
            <label class="bp-field-label">Budget</label>
            <input pInputText *ngIf="!editing.financials"
                   [value]="formatCurrency(form.project_budget) || '—'"
                   class="w-full bp-field-readonly bp-evd-budget" readonly/>
            <p-inputNumber *ngIf="editing.financials"
                           [(ngModel)]="form.project_budget"
                           prefix="£" [maxFractionDigits]="0" [min]="0"
                           styleClass="w-full bp-input-edit">
            </p-inputNumber>
          </div>
          <div class="bp-evd-field">
            <label class="bp-field-label">Margin %</label>
            <input pInputText *ngIf="!editing.financials"
                   [value]="formatPct(form.default_margin_pct)"
                   class="w-full bp-field-readonly" readonly/>
            <p-inputNumber *ngIf="editing.financials"
                           [(ngModel)]="form.default_margin_pct"
                           suffix="%" [min]="0" [max]="100"
                           styleClass="w-full bp-input-edit">
            </p-inputNumber>
          </div>
          <div class="bp-evd-field">
            <label class="bp-field-label">Contingency %</label>
            <input pInputText *ngIf="!editing.financials"
                   [value]="formatPct(form.default_contingency_pct)"
                   class="w-full bp-field-readonly" readonly/>
            <p-inputNumber *ngIf="editing.financials"
                           [(ngModel)]="form.default_contingency_pct"
                           suffix="%" [min]="0" [max]="100"
                           styleClass="w-full bp-input-edit">
            </p-inputNumber>
          </div>
        </div>

        <!-- ═══ SECTION 5: PROJECT BRIEF ═══ -->
        <div class="bp-section-header bp-section-header--top">
          <span class="bp-section-title">PROJECT BRIEF</span>
          <div class="bp-section-actions">
            <ng-container *ngIf="!editing.brief">
              <button class="bp-icon-btn" (click)="startEdit('brief')" title="Edit">
                <lucide-icon name="square-pen" [size]="14"></lucide-icon>
              </button>
            </ng-container>
            <ng-container *ngIf="editing.brief">
              <button class="bp-icon-btn bp-icon-save" (click)="saveBrief()"
                      [disabled]="saving" title="Save">
                <i class="pi pi-check"></i>
              </button>
              <button class="bp-icon-btn bp-icon-cancel" (click)="cancelBrief()" title="Cancel">
                <i class="pi pi-times"></i>
              </button>
            </ng-container>
          </div>
        </div>

        <ng-container *ngIf="!editing.brief">
          <div class="bp-evd-brief-view"
               *ngIf="form.raw_brief_text; else briefEmpty">
            {{ form.raw_brief_text }}
          </div>
          <ng-template #briefEmpty>
            <div class="bp-evd-brief-view bp-evd-brief-empty">
              No brief written yet.
            </div>
          </ng-template>
        </ng-container>

        <ng-container *ngIf="editing.brief">
          <textarea pInputTextarea
                    [(ngModel)]="form.raw_brief_text"
                    [rows]="5"
                    class="w-full bp-input-edit"
                    placeholder="Paste or write the event brief here...">
          </textarea>
          <div class="bp-evd-brief-actions">
            <button type="button" class="bp-evd-parse" (click)="parseBrief()">
              <lucide-icon name="wand-sparkles" [size]="12"></lucide-icon>
              Parse brief
            </button>
          </div>
        </ng-container>

      </div>

      <ng-template pTemplate="footer">
        <div class="bp-evd-footer">
          Last edited {{ lastEditedLabel }}
        </div>
      </ng-template>
    </p-sidebar>

    <p-toast></p-toast>
  `,
  styles: [`
    /* Section padding inside the drawer body — first section sits flush
       with the header divider, subsequent sections get a top rule. */
    .bp-section-header--top {
      margin-top: 20px;
      padding-top: 16px;
      border-top: 0.5px solid var(--color-border);
    }
    .bp-section-header-text { display: flex; flex-direction: column; gap: 2px; }
    .bp-section-hint {
      font-size: 11px; font-style: italic;
      color: var(--color-text-muted);
    }

    /* Field grids — match the Member-drawer field labels but lay out
       in 2 or 3 columns per section per spec. */
    .bp-evd-row { display: grid; gap: 12px; margin-bottom: 12px; }
    .bp-evd-row--2 { grid-template-columns: 1fr 1fr; }
    .bp-evd-row--3 { grid-template-columns: 1fr 1fr 1fr; }
    .bp-evd-row--ref { grid-template-columns: 110px 1fr 1fr; }
    .bp-evd-field { display: flex; flex-direction: column; gap: 4px; }

    /* Ref is permanently read-only — render it slightly muted to read
       as an identifier rather than a field. */
    :host ::ng-deep .bp-evd-ref.bp-field-readonly {
      font-size: 11.5px !important;
      color: var(--color-text-muted) !important;
      letter-spacing: 0.04em;
    }
    /* Budget renders in serif when in view mode — matches the mockup. */
    :host ::ng-deep .bp-evd-budget.bp-field-readonly {
      font-family: var(--font-display) !important;
      font-size: 15px !important;
      color: var(--color-text-primary) !important;
    }

    /* Project brief — view mode prose block + edit-mode textarea. */
    .bp-evd-brief-view {
      padding: 9px 12px;
      background: var(--color-background-secondary, var(--theme-bg));
      border: 0.5px solid var(--color-border);
      border-radius: 6px;
      font-size: 12.5px; line-height: 1.55;
      color: var(--color-text-primary);
      white-space: pre-wrap;
      min-height: 60px;
    }
    .bp-evd-brief-empty {
      color: var(--color-text-muted);
      font-style: italic;
    }
    .bp-evd-brief-actions {
      display: flex; justify-content: flex-end;
      margin-top: 10px;
    }
    .bp-evd-parse {
      display: inline-flex; align-items: center; gap: 6px;
      height: 28px; padding: 0 12px;
      border: 0.5px solid var(--theme-accent);
      background: var(--theme-bg);
      color: var(--theme-accent);
      border-radius: 14px;
      font-size: 11.5px; font-weight: 600;
      font-family: var(--font-body);
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .bp-evd-parse:hover {
      background: var(--theme-accent);
      color: var(--color-surface);
    }

    /* Footer line — parchment background matching the header. */
    .bp-evd-footer {
      font-size: 11px;
      color: var(--color-text-muted);
      text-align: center;
      width: 100%;
    }
  `]
})
export class EventDrawerComponent implements OnChanges {
  /** Project loaded by the parent (Overview). When this swaps, the
      drawer re-syncs its form from the new instance. */
  @Input() project: Project | null = null;
  @Input() visible = false;

  @Output() visibleChange = new EventEmitter<boolean>();
  /** Fires after a successful save with the updated project. Parent
      should replace its local copy so the Overview event strip
      reflects the new values immediately. */
  @Output() projectUpdated = new EventEmitter<Project>();

  saving = false;
  form: Partial<Project> = {};
  editing = { details: false, type: false, logistics: false, financials: false, brief: false };
  private snapshots: Record<string, Partial<Project>> = {
    details: {}, type: {}, logistics: {}, financials: {}, brief: {}
  };

  /** Lifted from event.component.ts — same labels, same DB values. */
  eventTypeOptions = [
    { label: 'Gala',         value: 'gala' },
    { label: 'Conference',   value: 'conference' },
    { label: 'Activation',   value: 'activation' },
    { label: 'Exhibition',   value: 'exhibition' },
    { label: 'Summer Party', value: 'summer_party' },
    { label: 'Awards',       value: 'awards' },
    { label: 'Corporate',    value: 'corporate' },
    { label: 'Private',      value: 'private' },
  ];
  tierOptions = [
    { label: 'Core',      value: 'core' },
    { label: 'Signature', value: 'signature' },
    { label: 'Premium',   value: 'premium' },
  ];

  constructor(
    private projSvc: ProjectService,
    private msg: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['project'] && this.project) {
      this.syncForm(this.project);
    }
  }

  close() {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  // ── Form sync ───────────────────────────────────────────────────────
  private syncForm(p: Project) {
    this.form = {
      po_ref:                  p.po_ref,
      event_name:              p.event_name,
      client_name:             p.client_name,
      venue_name:              p.venue_name,
      venue_city:              p.venue_city,
      event_date:              p.event_date,
      event_type:              p.event_type,
      tier:                    p.tier,
      duration_days:           p.duration_days,
      guest_count:             p.guest_count,
      project_budget:          p.project_budget,
      default_margin_pct:      p.default_margin_pct,
      default_contingency_pct: p.default_contingency_pct,
      raw_brief_text:          p.raw_brief_text,
    };
  }

  // ── Section edit controls ────────────────────────────────────────────
  startEdit(section: SectionKey) {
    this.snapshots[section] = { ...this.form };
    this.editing[section] = true;
    this.cdr.markForCheck();
  }
  cancelEdit(section: SectionKey) {
    Object.assign(this.form, this.snapshots[section]);
    this.editing[section] = false;
    this.cdr.markForCheck();
  }
  saveSection(section: SectionKey) {
    if (!this.project) return;
    this.saving = true;
    this.projSvc.update(this.project.id, this.form).subscribe({
      next: p => {
        this.project = p;
        this.syncForm(p);
        this.saving = false;
        this.editing[section] = false;
        this.msg.add({ severity: 'success', summary: 'Saved ✓', life: 1500 });
        this.projSvc.triggerRefresh();
        this.projectUpdated.emit(p);
        this.cdr.markForCheck();
      },
      error: () => {
        this.saving = false;
        this.msg.add({ severity: 'error', summary: 'Failed to save', life: 3000 });
        this.cdr.markForCheck();
      }
    });
  }

  // ── Project brief — separate save so the textarea has tick/cross too ─
  startEditBrief() { this.startEdit('details'); }
  saveBrief() {
    if (!this.project) return;
    this.saving = true;
    this.projSvc.update(this.project.id, { raw_brief_text: this.form.raw_brief_text || '' }).subscribe({
      next: p => {
        this.project = p;
        this.syncForm(p);
        this.saving = false;
        this.editing.brief = false;
        this.msg.add({ severity: 'success', summary: 'Saved ✓', life: 1500 });
        this.projSvc.triggerRefresh();
        this.projectUpdated.emit(p);
        this.cdr.markForCheck();
      },
      error: () => {
        this.saving = false;
        this.msg.add({ severity: 'error', summary: 'Failed to save brief', life: 3000 });
        this.cdr.markForCheck();
      }
    });
  }
  cancelBrief() {
    Object.assign(this.form, this.snapshots['brief']);
    this.editing.brief = false;
    this.cdr.markForCheck();
  }
  parseBrief() {
    // Stub — same behaviour as the legacy Event tab. AI parsing wires
    // in a later release.
    this.msg.add({ severity: 'info', summary: 'AI parsing coming soon', life: 2000 });
  }

  // Override startEdit for 'brief' to also snapshot raw_brief_text.
  // (Sections 1–4 share the per-section snapshot above.)
  // Kept in one helper so the template stays simple.

  // ── Display helpers ─────────────────────────────────────────────────
  formatCurrency(value: any): string {
    if (value === null || value === undefined || value === '') return '';
    const n = Number(value);
    if (isNaN(n)) return '';
    return '£' + n.toLocaleString('en-GB', { maximumFractionDigits: 0 });
  }
  formatPct(value: any): string {
    if (value === null || value === undefined || value === '') return '—';
    return value + '%';
  }

  get lastEditedLabel(): string {
    const iso = (this.project as any)?.updated_at;
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const diffMs = Date.now() - d.getTime();
    const m = Math.floor(diffMs / 60000);
    const h = Math.floor(m / 60);
    const days = Math.floor(h / 24);
    if (m < 1)   return 'just now';
    if (m < 60)  return m + ' min ago';
    if (h < 24)  return h + ' hour' + (h === 1 ? '' : 's') + ' ago';
    if (days < 30) return days + ' day' + (days === 1 ? '' : 's') + ' ago';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
