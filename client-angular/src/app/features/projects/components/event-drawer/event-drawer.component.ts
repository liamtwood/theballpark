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
import { CodelistService } from '../../../../core/services/codelist.service';
import { Project, Codelist } from '../../../../models';

/**
 * Event drawer — v1.29b.
 *
 * Replaces the standalone /event tab. Opens from the Overview page's
 * event strip (and from the "⋯" menu on the strip). Mirrors the
 * Settings > Team "Member" drawer pattern exactly:
 *
 *   - p-sidebar position="right", styleClass="bp-drawer", 480px
 *   - parchment header — eyebrow + serif title + ✕ close
 *   - PER-SECTION edit toggle (pencil → tick/cross); only the touched
 *     section enters edit mode, only its fields persist on save
 *   - bp-section-header / bp-section-title section labels with a
 *     0.5px border under the title (matches the Member drawer rhythm)
 *   - view mode renders bp-field-readonly inputs, edit mode swaps to
 *     bp-input-edit (or p-dropdown for Event Type / Tier / Currency)
 *
 * Currency dropdown is populated from CodelistService.getByName('currency')
 * — the same shared.codelists table that drives item_unit / item_time_unit.
 * Project value is stored on projects.currency (ISO-4217 code, e.g. 'GBP').
 *
 * The legacy event.component.ts file stays in the repo (not routed) for
 * git-history continuity; the field definitions + dropdown options here
 * are lifted directly from it.
 */
type SectionKey = 'details' | 'type' | 'logistics' | 'financials' | 'brief';

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
              <button class="bp-icon-btn bp-icon-cancel" (click)="cancelEdit('details')"
                      [disabled]="saving" title="Cancel">
                <i class="pi pi-times"></i>
              </button>
            </ng-container>
          </div>
        </div>

        <!-- v1.31: Status row sits at the top of EVENT DETAILS. Pill
             rendered with the codelist meta.color in view mode;
             dropdown (project_status codelist) in edit mode. -->
        <div class="bp-evd-row bp-evd-row--1">
          <div class="bp-evd-field">
            <label class="bp-field-label">Status</label>
            <div *ngIf="!editing.details" class="bp-evd-status-view">
              <span class="bp-evd-status-pill"
                    [style.background-color]="statusColor()">
                {{ statusLabel() }}
              </span>
            </div>
            <p-dropdown *ngIf="editing.details"
                        [(ngModel)]="form.status_code"
                        [options]="statusOptions"
                        optionLabel="label" optionValue="code"
                        styleClass="w-full bp-evd-dropdown"
                        placeholder="Draft">
            </p-dropdown>
          </div>
        </div>

        <!-- Row 1: Ref (narrow) | Event name | Client.
             Ref is read-only in view mode but editable when the
             section's pencil is clicked. -->
        <div class="bp-evd-row bp-evd-row--ref">
          <div class="bp-evd-field">
            <label class="bp-field-label">Ref</label>
            <input pInputText *ngIf="!editing.details"
                   [value]="form.po_ref || '—'"
                   class="w-full bp-field-readonly bp-evd-ref" readonly/>
            <input pInputText *ngIf="editing.details"
                   [(ngModel)]="form.po_ref"
                   placeholder="e.g. TVS-2026-047"
                   class="w-full bp-input-edit"/>
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
        <!-- Row 2: Venue | City -->
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
              <button class="bp-icon-btn bp-icon-cancel" (click)="cancelEdit('type')"
                      [disabled]="saving" title="Cancel">
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
                        styleClass="w-full bp-evd-dropdown"
                        placeholder="Select event type">
            </p-dropdown>
          </div>
          <div class="bp-evd-field">
            <label class="bp-field-label">Tier</label>
            <input pInputText *ngIf="!editing.type"
                   [value]="tierDisplay()"
                   class="w-full bp-field-readonly" readonly/>
            <p-dropdown *ngIf="editing.type"
                        [(ngModel)]="form.tier"
                        [options]="tierOptions"
                        optionLabel="label" optionValue="code"
                        styleClass="w-full bp-evd-dropdown"
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
              <button class="bp-icon-btn bp-icon-cancel" (click)="cancelEdit('logistics')"
                      [disabled]="saving" title="Cancel">
                <i class="pi pi-times"></i>
              </button>
            </ng-container>
          </div>
        </div>

        <!-- Row 1: Event date | Duration. Event date is FREE TEXT per
             spec — dates are often approximate ("Late September", "TBC"). -->
        <div class="bp-evd-row bp-evd-row--2">
          <div class="bp-evd-field">
            <label class="bp-field-label">Event date</label>
            <input pInputText *ngIf="!editing.logistics"
                   [value]="form.event_date || '—'"
                   class="w-full bp-field-readonly" readonly/>
            <input pInputText *ngIf="editing.logistics"
                   [(ngModel)]="form.event_date"
                   placeholder="e.g. 2 Jun 2026 / TBC"
                   class="w-full bp-input-edit"/>
          </div>
          <div class="bp-evd-field">
            <label class="bp-field-label">Duration (days)</label>
            <input pInputText *ngIf="!editing.logistics"
                   [value]="form.duration_days || '—'"
                   class="w-full bp-field-readonly" readonly/>
            <input pInputText *ngIf="editing.logistics"
                   type="number" min="1"
                   [(ngModel)]="form.duration_days"
                   class="w-full bp-input-edit"/>
          </div>
        </div>
        <!-- Row 2: Guest count (alone, full-width below Event date). -->
        <div class="bp-evd-row bp-evd-row--1">
          <div class="bp-evd-field">
            <label class="bp-field-label">Guest count</label>
            <input pInputText *ngIf="!editing.logistics"
                   [value]="form.guest_count || '—'"
                   class="w-full bp-field-readonly" readonly/>
            <input pInputText *ngIf="editing.logistics"
                   type="number" min="1"
                   [(ngModel)]="form.guest_count"
                   class="w-full bp-input-edit"/>
          </div>
        </div>

        <!-- ═══ SECTION 4: FINANCIALS ═══
             No subtitle per spec. -->
        <div class="bp-section-header bp-section-header--top">
          <span class="bp-section-title">FINANCIALS</span>
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
              <button class="bp-icon-btn bp-icon-cancel" (click)="cancelEdit('financials')"
                      [disabled]="saving" title="Cancel">
                <i class="pi pi-times"></i>
              </button>
            </ng-container>
          </div>
        </div>

        <!-- Row 1: Budget | Currency -->
        <div class="bp-evd-row bp-evd-row--2">
          <div class="bp-evd-field">
            <label class="bp-field-label">Budget</label>
            <input pInputText *ngIf="!editing.financials"
                   [value]="formatBudgetView()"
                   class="w-full bp-field-readonly bp-evd-budget" readonly/>
            <div *ngIf="editing.financials" class="bp-evd-prefix">
              <span class="bp-evd-prefix-sym">{{ currencySymbol }}</span>
              <input pInputText
                     type="number" min="0" step="100"
                     [(ngModel)]="form.project_budget"
                     class="w-full bp-input-edit bp-evd-prefix-input"/>
            </div>
          </div>
          <div class="bp-evd-field">
            <label class="bp-field-label">Currency</label>
            <input pInputText *ngIf="!editing.financials"
                   [value]="currencyDisplay()"
                   class="w-full bp-field-readonly" readonly/>
            <p-dropdown *ngIf="editing.financials"
                        [(ngModel)]="form.currency"
                        [options]="currencyOptions"
                        optionLabel="label" optionValue="code"
                        styleClass="w-full bp-evd-dropdown"
                        placeholder="GBP">
            </p-dropdown>
          </div>
        </div>
        <!-- Row 2: Margin % | Contingency % | VAT Rate % -->
        <div class="bp-evd-row bp-evd-row--3">
          <div class="bp-evd-field">
            <label class="bp-field-label">Margin %</label>
            <input pInputText *ngIf="!editing.financials"
                   [value]="formatPct(form.default_margin_pct)"
                   class="w-full bp-field-readonly" readonly/>
            <div *ngIf="editing.financials" class="bp-evd-suffix">
              <input pInputText
                     type="number" min="0" max="100"
                     [(ngModel)]="form.default_margin_pct"
                     class="w-full bp-input-edit bp-evd-suffix-input"/>
              <span class="bp-evd-suffix-sym">%</span>
            </div>
          </div>
          <div class="bp-evd-field">
            <label class="bp-field-label">Contingency %</label>
            <input pInputText *ngIf="!editing.financials"
                   [value]="formatPct(form.default_contingency_pct)"
                   class="w-full bp-field-readonly" readonly/>
            <div *ngIf="editing.financials" class="bp-evd-suffix">
              <input pInputText
                     type="number" min="0" max="100"
                     [(ngModel)]="form.default_contingency_pct"
                     class="w-full bp-input-edit bp-evd-suffix-input"/>
              <span class="bp-evd-suffix-sym">%</span>
            </div>
          </div>
          <div class="bp-evd-field">
            <label class="bp-field-label">VAT rate %</label>
            <input pInputText *ngIf="!editing.financials"
                   [value]="formatPct(form.default_vat_pct)"
                   class="w-full bp-field-readonly" readonly/>
            <div *ngIf="editing.financials" class="bp-evd-suffix">
              <input pInputText
                     type="number" min="0" max="100"
                     [(ngModel)]="form.default_vat_pct"
                     class="w-full bp-input-edit bp-evd-suffix-input"/>
              <span class="bp-evd-suffix-sym">%</span>
            </div>
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
              <button class="bp-icon-btn bp-icon-save" (click)="saveSection('brief')"
                      [disabled]="saving" title="Save">
                <i class="pi pi-check"></i>
              </button>
              <button class="bp-icon-btn bp-icon-cancel" (click)="cancelEdit('brief')"
                      [disabled]="saving" title="Cancel">
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
    :host { font-family: var(--font-body); }

    /* Section spacing — first section sits flush under the header; the
       rest get a top divider via --top. */
    .bp-section-header--top {
      margin-top: 20px;
      padding-top: 16px;
      border-top: 0.5px solid var(--color-border);
    }

    /* v1.31: status pill in the drawer's Status row. Colour comes
       from the project_status codelist meta JSONB; padding +
       border-radius match the dashboard project-card pill. */
    .bp-evd-status-view {
      display: flex; align-items: center;
      height: 34px;
    }
    .bp-evd-status-pill {
      display: inline-flex; align-items: center;
      padding: 4px 12px;
      border-radius: 14px;
      font-size: 11px; font-weight: 600;
      color: #fff;
      text-transform: none;
      letter-spacing: 0.02em;
    }

    /* Field grids — 1 / 2 / 3 / ref column variants per section spec. */
    .bp-evd-row   { display: grid; gap: 12px; margin-bottom: 12px; }
    .bp-evd-row--1 { grid-template-columns: 1fr; }
    .bp-evd-row--2 { grid-template-columns: 1fr 1fr; }
    .bp-evd-row--3 { grid-template-columns: 1fr 1fr 1fr; }
    /* Ref is permanently read-only and narrow; Name + Client share the
       remaining width. */
    .bp-evd-row--ref { grid-template-columns: 110px 1fr 1fr; }
    .bp-evd-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }

    /* Ref read-only field reads as an identifier, not a normal value. */
    :host ::ng-deep .bp-evd-ref.bp-field-readonly {
      font-size: 11.5px !important;
      color: var(--color-text-muted) !important;
      letter-spacing: 0.04em;
    }
    /* Budget — serif display, 16px, per spec. */
    :host ::ng-deep .bp-evd-budget.bp-field-readonly {
      font-family: var(--font-display) !important;
      font-size: 16px !important;
      color: var(--color-text-primary) !important;
    }

    /* Native-number prefix / suffix wrappers — keep inputs in sync with
       the rest of the grid (p-inputNumber's inner DOM doesn't pick up
       bp-input-edit cleanly). Chrome spinner arrows hidden. */
    .bp-evd-prefix, .bp-evd-suffix { position: relative; display: flex; align-items: center; }
    .bp-evd-prefix-sym, .bp-evd-suffix-sym {
      position: absolute; font-size: 13px;
      color: var(--color-text-muted); pointer-events: none;
    }
    .bp-evd-prefix-sym { left: 10px; }
    .bp-evd-suffix-sym { right: 12px; }
    :host ::ng-deep .bp-evd-prefix-input.p-inputtext { padding-left:  22px !important; }
    :host ::ng-deep .bp-evd-suffix-input.p-inputtext { padding-right: 22px !important; }
    :host ::ng-deep input[type="number"].p-inputtext::-webkit-inner-spin-button,
    :host ::ng-deep input[type="number"].p-inputtext::-webkit-outer-spin-button {
      -webkit-appearance: none; margin: 0;
    }
    :host ::ng-deep input[type="number"].p-inputtext { -moz-appearance: textfield; }

    /* p-dropdown alignment — match text-input height/radius so dropdowns
       line up with plain inputs in the same grid row. */
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
    :host ::ng-deep .bp-evd-dropdown.p-dropdown .p-dropdown-trigger { width: 28px !important; }
    :host ::ng-deep .bp-evd-dropdown.p-dropdown.p-focus {
      border-color: var(--theme-accent) !important;
      box-shadow: none !important;
    }

    /* Project brief — view mode prose + edit-mode textarea + parse pill. */
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
    .bp-evd-brief-empty { color: var(--color-text-muted); font-style: italic; }
    .bp-evd-brief-actions { display: flex; justify-content: flex-end; margin-top: 10px; }
    .bp-evd-parse {
      display: inline-flex; align-items: center; gap: 6px;
      height: 28px; padding: 0 12px;
      border: 0.5px solid var(--theme-accent);
      background: var(--theme-bg); color: var(--theme-accent);
      border-radius: 14px;
      font-size: 11.5px; font-weight: 600;
      font-family: var(--font-body);
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .bp-evd-parse:hover { background: var(--theme-accent); color: var(--color-surface); }

    /* Footer line — parchment background matches the header. */
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
      replaces its local copy so the Overview event strip reflects the
      new values immediately. */
  @Output() projectUpdated = new EventEmitter<Project>();

  saving = false;
  form: Partial<Project> = {};
  /** Per-section edit flags — only the touched section's fields go to
      the server on save. */
  editing = { details: false, type: false, logistics: false, financials: false, brief: false };
  private snapshots: Record<SectionKey, Partial<Project>> = {
    details: {}, type: {}, logistics: {}, financials: {}, brief: {}
  };

  /** Lifted verbatim from event.component.ts — same labels, same DB values. */
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
  /** v1.30: tier dropdown is now codelist-driven (budget_tier rows
      seeded into shared.codelists). Values stored on projects.tier:
      'starter' / 'professional' / 'premium' / 'unknown'. The rule-
      based brief parser writes the same codes verbatim. */
  tierOptions: Codelist[] = [];
  /** Hydrated on init from CodelistService.getByName('currency'). */
  currencyOptions: Codelist[] = [];
  /** v1.31: project_status codelist drives the Status dropdown +
      pill colour. Stored as projects.status_id (FK to statuses); the
      codelist code matches statuses.name one-to-one. */
  statusOptions: Codelist[] = [];

  /** Which DB columns each section is allowed to persist on save. Save
      only sends these — never the whole form. */
  private sectionFields: Record<SectionKey, (keyof Project)[]> = {
    details:    ['po_ref', 'event_name', 'client_name', 'venue_name', 'venue_city', 'status_code' as any],
    type:       ['event_type', 'tier'],
    logistics:  ['event_date', 'duration_days', 'guest_count'],
    financials: ['project_budget', 'currency', 'default_margin_pct', 'default_contingency_pct', 'default_vat_pct'],
    brief:      ['raw_brief_text'],
  };

  constructor(
    private projSvc: ProjectService,
    private codelistSvc: CodelistService,
    private msg: MessageService,
    private cdr: ChangeDetectorRef
  ) {
    this.codelistSvc.getByName('currency').subscribe(rows => {
      this.currencyOptions = rows || [];
      this.cdr.markForCheck();
    });
    this.codelistSvc.getByName('budget_tier').subscribe(rows => {
      this.tierOptions = rows || [];
      this.cdr.markForCheck();
    });
    this.codelistSvc.getByName('project_status').subscribe(rows => {
      this.statusOptions = rows || [];
      this.cdr.markForCheck();
    });
  }

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
      currency:                p.currency || 'GBP',
      default_margin_pct:      p.default_margin_pct,
      default_contingency_pct: p.default_contingency_pct,
      default_vat_pct:         p.default_vat_pct,
      raw_brief_text:          p.raw_brief_text,
      // v1.31: synthetic status_code mirrors p.status_name so the
      // dropdown two-way-binds correctly. On save the backend
      // resolves the code → status_id (see project.service.js).
      status_code:             (p as any).status_name || 'draft',
    } as any;
  }

  /** v1.31: pill label resolved against the project_status codelist. */
  statusLabel(): string {
    const code = (this.form as any).status_code || 'draft';
    return this.codelistSvc.getLabel('project_status', code) || 'Draft';
  }
  /** v1.31: pill colour from the codelist meta.color (falls back to
      amber so the pill never renders un-coloured). */
  statusColor(): string {
    const code = (this.form as any).status_code || 'draft';
    const meta = this.codelistSvc.getMeta('project_status', code);
    return meta?.['color'] || '#F59E0B';
  }

  // ── Per-section edit controls ───────────────────────────────────────
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
    // Only send the columns this section owns — never the whole form.
    const patch: Partial<Project> = {};
    for (const k of this.sectionFields[section]) {
      (patch as any)[k] = (this.form as any)[k];
    }
    this.saving = true;
    this.projSvc.update(this.project.id, patch).subscribe({
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

  parseBrief() {
    // Stub — same behaviour as the legacy Event tab. AI parsing wires
    // in a later release.
    this.msg.add({ severity: 'info', summary: 'AI parsing coming soon', life: 2000 });
  }

  /** v1.29b: drive the section pencil from outside (e.g. the kebab menu's
      "Edit event" option). Caller should `[visible]=true` first. */
  openSection(section: SectionKey) {
    this.startEdit(section);
  }

  // ── Display helpers ─────────────────────────────────────────────────
  /** View-mode Budget — symbol from the currency code, 0 decimals. */
  formatBudgetView(): string {
    const n = Number(this.form.project_budget);
    if (!isFinite(n) || n === 0) return '—';
    return this.currencySymbol + n.toLocaleString('en-GB', { maximumFractionDigits: 0 });
  }
  formatPct(value: any): string {
    if (value === null || value === undefined || value === '') return '—';
    return value + '%';
  }
  /** Symbol for the currently-selected currency (defaults to £). */
  get currencySymbol(): string {
    const code = this.form.currency || 'GBP';
    const row = this.currencyOptions.find(c => c.code === code);
    return row?.symbol || '£';
  }
  /** Tier label for view mode (resolved against the budget_tier
      codelist; falls back to the raw code for legacy values). */
  tierDisplay(): string {
    const code = this.form.tier;
    if (!code) return '—';
    const row = this.tierOptions.find(t => t.code === code);
    return row?.label || code;
  }
  /** Long display value for view mode — e.g. "GBP (£)". */
  currencyDisplay(): string {
    const code = this.form.currency || 'GBP';
    const row = this.currencyOptions.find(c => c.code === code);
    return row?.label || code;
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
