import {
  Component, Input, Output, EventEmitter,
  ChangeDetectionStrategy, ChangeDetectorRef, OnChanges, SimpleChanges
} from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
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
@Component({
  selector: 'app-event-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, TitleCasePipe, LucideAngularModule,
    ButtonModule, InputTextModule, InputTextareaModule,
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
          <div class="bp-evd-head-actions">
            <!-- v1.29a: single edit toggle for the WHOLE drawer.
                 Tick saves all changed fields in one ProjectService.update;
                 cross restores the snapshot taken when edit was entered. -->
            <ng-container *ngIf="!editing">
              <button class="bp-icon-btn" (click)="startEdit()" title="Edit">
                <lucide-icon name="square-pen" [size]="14"></lucide-icon>
              </button>
            </ng-container>
            <ng-container *ngIf="editing">
              <button class="bp-icon-btn bp-icon-save" (click)="saveAll()"
                      [disabled]="saving" title="Save">
                <i class="pi pi-check"></i>
              </button>
              <button class="bp-icon-btn bp-icon-cancel" (click)="cancelEdit()"
                      [disabled]="saving" title="Cancel">
                <i class="pi pi-times"></i>
              </button>
            </ng-container>
            <button class="bp-icon-btn" (click)="close()" title="Close">
              <i class="pi pi-times"></i>
            </button>
          </div>
        </div>
      </ng-template>

      <div class="bp-drawer-body" *ngIf="project">

        <!-- ═══ SECTION 1: EVENT DETAILS ═══ -->
        <div class="bp-section-header">
          <span class="bp-section-title">EVENT DETAILS</span>
        </div>

        <!-- v1.29a layout: row 1 = Ref + Event name, row 2 = Client
             (full width), row 3 = Venue + City. Ref is editable. -->
        <div class="bp-evd-row bp-evd-row--ref">
          <div class="bp-evd-field">
            <label class="bp-field-label">Ref</label>
            <input pInputText *ngIf="!editing"
                   [value]="form.po_ref || '—'"
                   class="w-full bp-field-readonly" readonly/>
            <input pInputText *ngIf="editing"
                   [(ngModel)]="form.po_ref"
                   placeholder="e.g. TVS-2026-047"
                   class="w-full bp-input-edit"/>
          </div>
          <div class="bp-evd-field">
            <label class="bp-field-label">Event name</label>
            <input pInputText *ngIf="!editing"
                   [value]="form.event_name || '—'"
                   class="w-full bp-field-readonly" readonly/>
            <input pInputText *ngIf="editing"
                   [(ngModel)]="form.event_name"
                   class="w-full bp-input-edit"/>
          </div>
        </div>
        <div class="bp-evd-row bp-evd-row--1">
          <div class="bp-evd-field">
            <label class="bp-field-label">Client</label>
            <input pInputText *ngIf="!editing"
                   [value]="form.client_name || '—'"
                   class="w-full bp-field-readonly" readonly/>
            <input pInputText *ngIf="editing"
                   [(ngModel)]="form.client_name"
                   class="w-full bp-input-edit"/>
          </div>
        </div>
        <div class="bp-evd-row bp-evd-row--2">
          <div class="bp-evd-field">
            <label class="bp-field-label">Venue</label>
            <input pInputText *ngIf="!editing"
                   [value]="form.venue_name || '—'"
                   class="w-full bp-field-readonly" readonly/>
            <input pInputText *ngIf="editing"
                   [(ngModel)]="form.venue_name"
                   class="w-full bp-input-edit"/>
          </div>
          <div class="bp-evd-field">
            <label class="bp-field-label">City</label>
            <input pInputText *ngIf="!editing"
                   [value]="form.venue_city || '—'"
                   class="w-full bp-field-readonly" readonly/>
            <input pInputText *ngIf="editing"
                   [(ngModel)]="form.venue_city"
                   class="w-full bp-input-edit"/>
          </div>
        </div>

        <!-- ═══ SECTION 2: EVENT TYPE ═══ -->
        <div class="bp-section-header bp-section-header--top">
          <span class="bp-section-title">EVENT TYPE</span>
        </div>

        <div class="bp-evd-row bp-evd-row--2">
          <div class="bp-evd-field">
            <label class="bp-field-label">Event type</label>
            <input pInputText *ngIf="!editing"
                   [value]="(form.event_type | titlecase) || '—'"
                   class="w-full bp-field-readonly" readonly/>
            <p-dropdown *ngIf="editing"
                        [(ngModel)]="form.event_type"
                        [options]="eventTypeOptions"
                        optionLabel="label" optionValue="value"
                        styleClass="w-full bp-evd-dropdown"
                        placeholder="Select event type">
            </p-dropdown>
          </div>
          <div class="bp-evd-field">
            <label class="bp-field-label">Tier</label>
            <input pInputText *ngIf="!editing"
                   [value]="(form.tier | titlecase) || '—'"
                   class="w-full bp-field-readonly" readonly/>
            <p-dropdown *ngIf="editing"
                        [(ngModel)]="form.tier"
                        [options]="tierOptions"
                        optionLabel="label" optionValue="value"
                        styleClass="w-full bp-evd-dropdown"
                        placeholder="Select tier">
            </p-dropdown>
          </div>
        </div>

        <!-- ═══ SECTION 3: LOGISTICS ═══ -->
        <div class="bp-section-header bp-section-header--top">
          <span class="bp-section-title">LOGISTICS</span>
        </div>

        <!-- v1.29: Event date is FREE TEXT per spec — dates are often
             approximate ("Late September", "TBC", "w/c 15 March"). -->
        <div class="bp-evd-row bp-evd-row--3">
          <div class="bp-evd-field">
            <label class="bp-field-label">Event date</label>
            <input pInputText *ngIf="!editing"
                   [value]="form.event_date || '—'"
                   class="w-full bp-field-readonly" readonly/>
            <input pInputText *ngIf="editing"
                   [(ngModel)]="form.event_date"
                   placeholder="e.g. 2 Jun 2026 / TBC"
                   class="w-full bp-input-edit"/>
          </div>
          <div class="bp-evd-field">
            <label class="bp-field-label">Duration (days)</label>
            <input pInputText *ngIf="!editing"
                   [value]="form.duration_days || '—'"
                   class="w-full bp-field-readonly" readonly/>
            <input pInputText *ngIf="editing"
                   type="number" min="1"
                   [(ngModel)]="form.duration_days"
                   class="w-full bp-input-edit"/>
          </div>
          <div class="bp-evd-field">
            <label class="bp-field-label">Guest count</label>
            <input pInputText *ngIf="!editing"
                   [value]="form.guest_count || '—'"
                   class="w-full bp-field-readonly" readonly/>
            <input pInputText *ngIf="editing"
                   type="number" min="1"
                   [(ngModel)]="form.guest_count"
                   class="w-full bp-input-edit"/>
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
        </div>

        <div class="bp-evd-row bp-evd-row--3">
          <div class="bp-evd-field">
            <label class="bp-field-label">Budget</label>
            <input pInputText *ngIf="!editing"
                   [value]="formatCurrency(form.project_budget) || '—'"
                   class="w-full bp-field-readonly bp-evd-budget" readonly/>
            <div *ngIf="editing" class="bp-evd-prefix">
              <span class="bp-evd-prefix-sym">£</span>
              <input pInputText
                     type="number" min="0" step="100"
                     [(ngModel)]="form.project_budget"
                     class="w-full bp-input-edit bp-evd-prefix-input"/>
            </div>
          </div>
          <div class="bp-evd-field">
            <label class="bp-field-label">Margin %</label>
            <input pInputText *ngIf="!editing"
                   [value]="formatPct(form.default_margin_pct)"
                   class="w-full bp-field-readonly" readonly/>
            <div *ngIf="editing" class="bp-evd-suffix">
              <input pInputText
                     type="number" min="0" max="100"
                     [(ngModel)]="form.default_margin_pct"
                     class="w-full bp-input-edit bp-evd-suffix-input"/>
              <span class="bp-evd-suffix-sym">%</span>
            </div>
          </div>
          <div class="bp-evd-field">
            <label class="bp-field-label">Contingency %</label>
            <input pInputText *ngIf="!editing"
                   [value]="formatPct(form.default_contingency_pct)"
                   class="w-full bp-field-readonly" readonly/>
            <div *ngIf="editing" class="bp-evd-suffix">
              <input pInputText
                     type="number" min="0" max="100"
                     [(ngModel)]="form.default_contingency_pct"
                     class="w-full bp-input-edit bp-evd-suffix-input"/>
              <span class="bp-evd-suffix-sym">%</span>
            </div>
          </div>
        </div>

        <!-- ═══ SECTION 5: PROJECT BRIEF ═══ -->
        <div class="bp-section-header bp-section-header--top">
          <span class="bp-section-title">PROJECT BRIEF</span>
        </div>

        <ng-container *ngIf="!editing">
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

        <ng-container *ngIf="editing">
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

    /* v1.29a: drawer header actions cluster (edit / save / cancel /
       close). Sits to the right of the parchment title; child buttons
       are the standard bp-icon-btn (28x28 pill). */
    .bp-evd-head-actions {
      display: inline-flex; align-items: center; gap: 4px;
    }

    /* Field grids — match the Member-drawer field labels but lay out
       in 1 / 2 / 3 columns per section per spec. */
    .bp-evd-row { display: grid; gap: 12px; margin-bottom: 12px; }
    .bp-evd-row--1 { grid-template-columns: 1fr; }
    .bp-evd-row--2 { grid-template-columns: 1fr 1fr; }
    .bp-evd-row--3 { grid-template-columns: 1fr 1fr 1fr; }
    /* v1.29a: Ref + Event name. Ref capped narrow so the long event
       name takes the remaining width. */
    .bp-evd-row--ref { grid-template-columns: 140px 1fr; }
    .bp-evd-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }

    /* v1.29a: native-number input prefix / suffix wrappers. Avoids
       p-inputNumber's PrimeNG-themed inner DOM which doesn't pick up
       our edit-input styling cleanly inside a tight grid. */
    .bp-evd-prefix, .bp-evd-suffix {
      position: relative;
      display: flex; align-items: center;
    }
    .bp-evd-prefix-sym, .bp-evd-suffix-sym {
      position: absolute;
      font-size: 13px;
      color: var(--color-text-muted);
      pointer-events: none;
    }
    .bp-evd-prefix-sym { left: 10px; }
    .bp-evd-suffix-sym { right: 12px; }
    :host ::ng-deep .bp-evd-prefix-input.p-inputtext  { padding-left:  22px !important; }
    :host ::ng-deep .bp-evd-suffix-input.p-inputtext  { padding-right: 22px !important; }
    /* Hide the spinner arrows that Chrome adds to type=number inputs —
       keeps the grid tidy and matches the Member-drawer aesthetic. */
    :host ::ng-deep input[type="number"].p-inputtext::-webkit-inner-spin-button,
    :host ::ng-deep input[type="number"].p-inputtext::-webkit-outer-spin-button {
      -webkit-appearance: none; margin: 0;
    }
    :host ::ng-deep input[type="number"].p-inputtext { -moz-appearance: textfield; }

    /* p-dropdown — pin it to the same height + radius as the text
       inputs so Event Type + Tier line up with everything else. */
    :host ::ng-deep .bp-evd-dropdown.p-dropdown {
      width: 100% !important;
      height: 34px !important;
      min-height: 34px !important;
      border-radius: 6px !important;
      border: 0.5px solid rgba(0,0,0,0.12) !important;
      font-size: 13px !important;
      align-items: center !important;
    }
    :host ::ng-deep .bp-evd-dropdown.p-dropdown .p-dropdown-label {
      padding: 6px 11px !important;
      font-size: 13px !important;
      font-family: var(--font-body) !important;
      line-height: 1.4 !important;
    }
    :host ::ng-deep .bp-evd-dropdown.p-dropdown .p-dropdown-trigger {
      width: 28px !important;
    }
    :host ::ng-deep .bp-evd-dropdown.p-dropdown.p-focus {
      border-color: var(--theme-accent) !important;
      box-shadow: none !important;
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
  /** v1.29a: single edit toggle for the whole drawer. Pencil in the
      header flips this; tick saves all fields in one update; cross
      restores the snapshot taken when edit was entered. */
  editing = false;
  private snapshot: Partial<Project> = {};

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

  // ── Whole-drawer edit controls (v1.29a) ─────────────────────────────
  startEdit() {
    this.snapshot = { ...this.form };
    this.editing = true;
    this.cdr.markForCheck();
  }
  cancelEdit() {
    Object.assign(this.form, this.snapshot);
    this.editing = false;
    this.cdr.markForCheck();
  }
  saveAll() {
    if (!this.project) return;
    this.saving = true;
    this.projSvc.update(this.project.id, this.form).subscribe({
      next: p => {
        this.project = p;
        this.syncForm(p);
        this.saving = false;
        this.editing = false;
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

  parseBrief() {
    // Stub — same behaviour as the legacy Event tab. AI parsing wires
    // in a later release.
    this.msg.add({ severity: 'info', summary: 'AI parsing coming soon', life: 2000 });
  }

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
