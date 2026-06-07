import {
  Component, OnInit, OnDestroy,
  ChangeDetectionStrategy, ChangeDetectorRef
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

import { forkJoin, Subscription } from 'rxjs';

import { ProjectService } from '../../../core/services/project.service';
import { CodelistService } from '../../../core/services/codelist.service';
import { ClientService } from '../../../core/services/client.service';
import { CategoryService } from '../../../core/services/category.service';
import { AiService } from '../../../core/services/ai.service';
import { ApiService } from '../../../core/services/api.service';
import {
  EventDrawerService, EventDrawerSection
} from '../../../core/services/event-drawer.service';
import { Project, Codelist, Client, Category, ParsedBrief, ParsedBriefCategory } from '../../../models';
import { EditSectionComponent } from '../edit-section/edit-section.component';
import { EditFieldComponent } from '../edit-field/edit-field.component';

/**
 * Event drawer — v1.65o.
 *
 * v1.65o relocated this component from features/projects/components/ to
 * shared/components/ and switched it from @Input-driven to
 * service-driven. Mounted ONCE globally in app-shell, opened from any
 * surface via `EventDrawerService.open(projectId, section?)`. Mirrors
 * the established shared-drawer pattern (Outreach / Estimate / AddCategory).
 *
 * On a successful save the drawer re-fetches the project and pushes the
 * fresh copy via `EventDrawerService.markSaved(p)`, so every subscriber
 * (overview event strip, marketplace project-summary panel, etc.) can
 * refresh local state without re-loading the page.
 *
 * Originally — v1.29b — replaced the standalone /event tab and opened
 * from the Overview page's event strip (and from the "⋯" menu on the
 * strip). Mirrors the Settings > Team "Member" drawer pattern exactly:
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
type SectionKey = EventDrawerSection;

@Component({
  selector: 'app-event-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, TitleCasePipe, LucideAngularModule,
    ButtonModule, InputTextModule, InputTextareaModule,
    DropdownModule, SidebarModule, ToastModule,
    EditSectionComponent, EditFieldComponent
  ],
  providers: [MessageService],
  template: `
    <p-sidebar [(visible)]="visible" position="right"
               styleClass="bp-drawer" [style]="{width:'480px'}"
               [showCloseIcon]="false"
               (visibleChange)="onVisibleChange($event)">

      <ng-template pTemplate="header">
        <div class="bp-drawer-header-row">
          <div class="bp-drawer-header">
            <span class="bp-drawer-label">
              PROJECT
              <span *ngIf="project?.ref" class="bp-drawer-ref-chip">{{ project?.ref }}</span>
            </span>
            <div class="bp-drawer-title">Event details</div>
          </div>
          <button class="bp-icon-btn" (click)="close()" title="Close">
            <i class="pi pi-times"></i>
          </button>
        </div>
      </ng-template>

      <div class="bp-drawer-body" *ngIf="project">

        <!-- ═══ SECTION 1: EVENT DETAILS ═══ -->
        <!-- v1.66dm — Tier 2: adopts the shared <app-edit-section> +
             <app-edit-field> at drawer density. Status keeps its bespoke
             colour-pill (view) / dropdown (edit) — colour carries meaning. -->
        <app-edit-section title="Event details" density="drawer"
                          [(editing)]="editing.details" [saving]="saving"
                          (edit)="snapshotSection('details')" (cancel)="restoreSection('details')"
                          (save)="saveSection('details')">
          <div class="bp-evd-row bp-evd-row--2">
            <app-edit-field label="PO Ref" density="drawer" [editing]="editing.details"
                            [(value)]="form.po_ref" placeholder="e.g. TVS-2026-047"></app-edit-field>
            <div class="bp-evd-field bp-field--drawer">
              <label class="bp-field-label">Status</label>
              <div *ngIf="!editing.details" class="bp-evd-status-view">
                <span class="bp-evd-status-pill" [style.background-color]="statusColor()">{{ statusLabel() }}</span>
              </div>
              <p-dropdown *ngIf="editing.details"
                          [(ngModel)]="form.status_code"
                          [options]="statusOptions" optionLabel="label" optionValue="code"
                          styleClass="w-full bp-evd-dropdown" placeholder="Draft"></p-dropdown>
            </div>
          </div>
          <div class="bp-evd-row bp-evd-row--2">
            <app-edit-field label="Event name" density="drawer" [editing]="editing.details" [(value)]="form.event_name"></app-edit-field>
            <app-edit-field label="Client" density="drawer" [editing]="editing.details" [(value)]="form.client_name"></app-edit-field>
          </div>
          <div class="bp-evd-row bp-evd-row--2">
            <app-edit-field label="Venue" density="drawer" [editing]="editing.details" [(value)]="form.venue_name"></app-edit-field>
            <app-edit-field label="City" density="drawer" [editing]="editing.details" [(value)]="form.venue_city"></app-edit-field>
          </div>
        </app-edit-section>

        <!-- ═══ SECTION 2: EVENT TYPE ═══ -->
        <!-- Dropdowns kept bespoke (view = label, edit = p-dropdown) inside the
             shared drawer-density section; EF-select zero-shift is a follow-up. -->
        <app-edit-section title="Event type" density="drawer"
                          [(editing)]="editing.type" [saving]="saving"
                          (edit)="snapshotSection('type')" (cancel)="restoreSection('type')"
                          (save)="saveSection('type')">
          <div class="bp-evd-row bp-evd-row--2">
            <div class="bp-evd-field bp-field--drawer">
              <label class="bp-field-label">Event type</label>
              <input pInputText *ngIf="!editing.type"
                     [value]="(form.event_type | titlecase) || '—'"
                     class="w-full bp-field-readonly" readonly/>
              <p-dropdown *ngIf="editing.type"
                          [(ngModel)]="form.event_type"
                          [options]="eventTypeOptions" optionLabel="label" optionValue="value"
                          styleClass="w-full bp-evd-dropdown" placeholder="Select event type"></p-dropdown>
            </div>
            <div class="bp-evd-field bp-field--drawer">
              <label class="bp-field-label">Tier</label>
              <input pInputText *ngIf="!editing.type"
                     [value]="tierDisplay()"
                     class="w-full bp-field-readonly" readonly/>
              <p-dropdown *ngIf="editing.type"
                          [(ngModel)]="form.tier"
                          [options]="tierOptions" optionLabel="label" optionValue="code"
                          styleClass="w-full bp-evd-dropdown" placeholder="Select tier"></p-dropdown>
            </div>
          </div>
        </app-edit-section>

        <!-- ═══ SECTION 3: LOGISTICS ═══ -->
        <!-- Event date is FREE TEXT (often approximate — "Late September"/"TBC"). -->
        <app-edit-section title="Logistics" density="drawer"
                          [(editing)]="editing.logistics" [saving]="saving"
                          (edit)="snapshotSection('logistics')" (cancel)="restoreSection('logistics')"
                          (save)="saveSection('logistics')">
          <div class="bp-evd-row bp-evd-row--2">
            <app-edit-field label="Event date" density="drawer" [editing]="editing.logistics"
                            [(value)]="form.event_date" placeholder="e.g. 2 Jun 2026 / TBC"></app-edit-field>
            <app-edit-field label="Duration (days)" type="number" density="drawer"
                            [editing]="editing.logistics" [(value)]="form.duration_days"></app-edit-field>
          </div>
          <div class="bp-evd-row bp-evd-row--1">
            <app-edit-field label="Guest count" type="number" density="drawer"
                            [editing]="editing.logistics" [(value)]="form.guest_count"></app-edit-field>
          </div>
        </app-edit-section>

        <!-- ═══ SECTION 4: FINANCIALS ═══
             No subtitle per spec.
             v1.65g4 — hidden in view mode per UX request: agents
             don't need to see budget / margins inline while glancing
             at event details. The block stays in the template so we
             can re-enable it later by flipping showLegacySections. -->
        <ng-container *ngIf="showLegacySections">
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
        </ng-container><!-- /showLegacySections (FINANCIALS) -->

        <!-- ═══ SECTION 5: PROJECT BRIEF ═══
             v1.65g4 — hidden in view mode (same reasoning as
             FINANCIALS above). Brief is still captured during the new
             project flow; the event drawer just doesn't re-surface it
             here. -->
        <ng-container *ngIf="showLegacySections">
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
            <button type="button" class="bp-evd-parse"
                    [disabled]="aiParsing"
                    (click)="parseBrief()">
              <lucide-icon name="wand-sparkles" [size]="12"></lucide-icon>
              {{ aiParsing ? 'Parsing…' : 'Parse brief' }}
            </button>
          </div>
        </ng-container>
        </ng-container><!-- /showLegacySections (PROJECT BRIEF) -->

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

    /* v1.65cp — .bp-evd-ref-chip renamed + promoted to global
       .bp-drawer-ref-chip so the estimate drawer reuses the same
       header chip. See styles.css for the canonical rule. */

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

    /* v1.31a: Ref now uses the standard bp-field-readonly font like
       every other view-mode field. Previously it was rendered smaller
       + muted + letter-spaced which made it inconsistent with Event
       name and Client sitting next to it on the same row. */
    /* v1.31b: Budget view-mode now uses the standard body font like
       every other view-mode field — the serif Playfair was sticking
       out against its siblings (Margin %, Contingency %, VAT %). */

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

    /* v1.65ab — dropdowns inherit the unified calm style from styles.css
       (.p-dropdown rules). Width 100% kept so they fill the field column. */
    :host ::ng-deep .bp-evd-dropdown.p-dropdown { width: 100% !important; }

    /* Project brief — view mode prose + edit-mode textarea + parse pill. */
    .bp-evd-brief-view {
      padding: 9px 12px;
      background: var(--color-background-secondary, var(--color-fill));
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
      background: var(--color-fill); color: var(--theme-accent);
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
export class EventDrawerComponent implements OnInit, OnDestroy {
  /** Service-driven — the drawer fetches the project itself when
      EventDrawerService.open(projectId) fires. No @Inputs / @Outputs. */
  project: Project | null = null;
  visible = false;

  private sub?: Subscription;

  saving = false;
  form: Partial<Project> = {};
  /** v1.65g4 — gate for the FINANCIALS + PROJECT BRIEF sections.
      Hidden in view mode per UX request: agents don't need to see
      budget/margins or the full brief inline while glancing at event
      details. Flip to `true` to re-enable both sections (template
      still references the same `editing.financials` / `editing.brief`
      flags so the original save/cancel wiring is intact). */
  showLegacySections = false;
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
  /** v1.31a: code → id map built from /api/statuses on init. Used at
      save-time to resolve form.status_code → projects.status_id
      client-side, so the change persists without the v1.31 backend
      restart. */
  private statusIdByCode = new Map<string, string>();
  /** v1.31a: client list cached for find-or-create on save. Same
      reasoning as status above. */
  private clients: Client[] = [];

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
    private clientSvc: ClientService,
    private apiSvc: ApiService,
    private catSvc: CategoryService,
    private aiSvc: AiService,
    private msg: MessageService,
    private cdr: ChangeDetectorRef,
    private svc: EventDrawerService
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
    // v1.31a: code → id map for status_code → status_id resolution
    // on save. Done client-side so the change persists without the
    // backend's v1.31 status_code support being deployed.
    this.apiSvc.get<any[]>('/statuses').subscribe(rows => {
      for (const r of rows || []) {
        if (r.entity_type === 'project') this.statusIdByCode.set(r.name, r.id);
      }
    });
    // v1.31a: cache clients for find-or-create on save.
    this.clientSvc.getAll().subscribe(rows => { this.clients = rows || []; });
  }

  ngOnInit(): void {
    // v1.65o — service-driven. open(projectId, section?) fetches the
    // project and surfaces the drawer; close() (or the sidebar close
    // button) clears it. Optional `section` jumps straight into edit
    // mode for that section (replaces the legacy openSection() call
    // that the Overview kebab menu used).
    this.sub = this.svc.request$.subscribe(req => {
      if (!req) {
        this.visible = false;
        this.project = null;
        this.cdr.markForCheck();
        return;
      }
      this.projSvc.getById(req.projectId).subscribe({
        next: p => {
          this.project = p;
          this.syncForm(p);
          this.visible = true;
          if (req.section) {
            // Wait a frame so the section is rendered before flipping
            // its edit flag (the pencil button needs to be in the DOM).
            setTimeout(() => {
              this.startEdit(req.section as SectionKey);
              this.cdr.markForCheck();
            }, 0);
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.msg.add({
            severity: 'error', summary: 'Could not load project',
            detail: 'Try refreshing the page.', life: 3000
          });
          this.svc.close();
        }
      });
    });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  /** PrimeNG sidebar's two-way visible binding — only react on close,
      since we control open via the service. */
  onVisibleChange(open: boolean): void { if (!open) this.close(); }

  close(): void {
    this.visible = false;
    this.svc.close();
  }

  // ── Form sync ───────────────────────────────────────────────────────
  private syncForm(p: Project) {
    this.form = {
      // v1.66dm — sanitise the legacy literal "null" string at the source
      // (EF shows the raw value; the old poRefDisplay em-dash guard is gone).
      po_ref:                  (p.po_ref != null && String(p.po_ref).trim().toLowerCase() !== 'null') ? p.po_ref : '',
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

  /** v1.65g3 — PO Ref display value. Treats both real null and the
      literal string "null" (which legacy data sometimes stores)
      as empty so the field shows "—". */
  get poRefDisplay(): string {
    const v = (this.form as any)?.po_ref;
    if (v == null) return '—';
    const s = String(v).trim();
    return (s === '' || s.toLowerCase() === 'null') ? '—' : s;
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
  // v1.66dm — <app-edit-section> owns the `editing` flag via [(editing)];
  // these own the DATA. (edit)→snapshotSection, (cancel)→restoreSection,
  // (save)→saveSection. startEdit stays for programmatic open (req.section),
  // where it sets the flag too (which flows into the section via [(editing)]).
  snapshotSection(section: SectionKey) {
    this.snapshots[section] = { ...this.form };
  }
  restoreSection(section: SectionKey) {
    Object.assign(this.form, this.snapshots[section]);
    this.cdr.markForCheck();
  }
  startEdit(section: SectionKey) {
    this.snapshotSection(section);
    this.editing[section] = true;
    this.cdr.markForCheck();
  }
  cancelEdit(section: SectionKey) {
    this.restoreSection(section);
    this.editing[section] = false;
    this.cdr.markForCheck();
  }
  saveSection(section: SectionKey) {
    if (!this.project) return;
    // Only send the columns this section owns — never the whole form.
    const patch: any = {};
    for (const k of this.sectionFields[section]) {
      patch[k] = (this.form as any)[k];
    }

    // v1.31a: client-side resolution for the two fields whose form
    // value doesn't match a real projects column. Doing this here
    // (rather than relying on backend support) means the change
    // persists even when the running backend hasn't been restarted
    // since v1.31 shipped.
    const finish = (resolved: any) => {
      this.saving = true;
      this.projSvc.update(this.project!.id, resolved).subscribe({
        next: () => {
          // v1.31c: re-read via getById so the form picks up the
          // joined columns (client_name, status_name, status_color)
          // that the older backend's update() doesn't return on its
          // raw INSERT/UPDATE RETURNING *. Without this the input
          // briefly shows the patched fields as empty until a page
          // refresh repopulates from the joined SELECT.
          this.projSvc.getById(this.project!.id).subscribe({
            next: p => {
              this.project = p;
              this.syncForm(p);
              this.saving = false;
              this.editing[section] = false;
              this.msg.add({ severity: 'success', summary: 'Saved ✓', life: 1500 });
              this.projSvc.triggerRefresh();
              this.svc.markSaved(p);
              this.cdr.markForCheck();
            },
            error: () => {
              // Save did succeed; the re-fetch failed. Surface a
              // milder message but still close the editor.
              this.saving = false;
              this.editing[section] = false;
              this.projSvc.triggerRefresh();
              this.cdr.markForCheck();
            }
          });
        },
        error: () => {
          this.saving = false;
          this.msg.add({ severity: 'error', summary: 'Failed to save', life: 3000 });
          this.cdr.markForCheck();
        }
      });
    };

    if (section === 'details') {
      this.resolveDetailsPatch(patch).then(finish).catch(() => {
        this.saving = false;
        this.msg.add({ severity: 'error', summary: 'Failed to save', life: 3000 });
        this.cdr.markForCheck();
      });
    } else {
      finish(patch);
    }
  }

  /** v1.31a: pre-flight the Event Details patch so the backend gets
      real FK columns (status_id / client_id) instead of synthetic
      form fields. Status code → id is a Map lookup. Client name →
      id is a find-or-create against the cached client list. */
  private async resolveDetailsPatch(patch: any): Promise<any> {
    // Status — code → id via /api/statuses map.
    if (patch.status_code) {
      const id = this.statusIdByCode.get(patch.status_code);
      if (id) patch.status_id = id;
    }
    delete patch.status_code;

    // Client — find or create by name within the org.
    const name = (patch.client_name || '').trim();
    if (name) {
      const match = this.clients.find(c =>
        (c.name || '').toLowerCase() === name.toLowerCase()
      );
      if (match) {
        patch.client_id = match.id;
      } else {
        // Create a new client row so subsequent saves don't dupe.
        const created = await new Promise<Client | null>((resolve) =>
          this.clientSvc.create({ name }).subscribe({
            next: c => resolve(c),
            error: () => resolve(null)
          })
        );
        if (created) {
          patch.client_id = created.id;
          this.clients.push(created);
        }
      }
    } else if (patch.client_name === '') {
      // User cleared the field → detach the client.
      patch.client_id = null;
    }
    delete patch.client_name;

    return patch;
  }

  /** v1.34 — "✦ Parse brief" — calls the upgraded Haiku parser on the
      current raw_brief_text, then upserts each returned category onto
      project_categories with the AI's supplier-ready oneLiner as
      requirement_brief. The Brief tab picks the new rows up on its
      next load (projSvc.triggerRefresh() fires). Drawer stays focused
      on event-facts edit — it does not auto-fill event-level fields. */
  aiParsing = false;
  parseBrief() {
    if (this.aiParsing) return;
    const text = (this.form.raw_brief_text || '').toString().trim();
    const pid = (this.project as any)?.id;
    if (!text) {
      this.msg.add({ severity: 'warn', summary: 'Add a project brief first, then Parse', life: 2500 });
      return;
    }
    if (!pid) {
      this.msg.add({ severity: 'error', summary: 'Project id unavailable', life: 2500 });
      return;
    }
    this.aiParsing = true;
    this.cdr.markForCheck();

    this.aiSvc.parseBrief(text).subscribe({
      next: (parsed: ParsedBrief) => this.applyAiCategories(pid, parsed),
      error: err => {
        this.aiParsing = false;
        this.msg.add({
          severity: 'error',
          summary: 'Brief parse failed',
          detail: err?.error?.error || 'AI parser unreachable — try again shortly.',
          life: 4000
        });
        this.cdr.markForCheck();
      }
    });
  }

  /** AI categoryId → DB catalogue category name. Mirrored exactly
      from CreateProjectModalComponent so both parse-brief paths
      upsert against the same catalogue rows.
      v1.39f: added venues + photography rows.
      v1.65cg (p0005): BriefComponent removed from the mirror list —
      the Plan/Brief tab was deleted along with this prompt. */
  private static readonly AI_CATEGORY_TO_DB: Record<string, string> = {
    'set-build':     'Stand Structure',
    'print':         'Graphics & Signage',
    'av':            'AV & Technology',
    'floral':        'Florals',
    'venues':        'Venue',
    'catering':      'Catering & Hospitality',
    'photography':   'Photography',
    'staffing':      'Staffing',
    'h-and-s':       'Health & Safety',
    'furniture':     'Furniture & Fixtures',
    'logistics':     'Logistics & Transport',
    'entertainment': 'Entertainment',
    'lighting':      'Lighting'
  };

  private applyAiCategories(pid: string, parsed: ParsedBrief) {
    const cats: ParsedBriefCategory[] = parsed?.categories || [];
    if (!cats.length) {
      this.aiParsing = false;
      this.msg.add({ severity: 'info', summary: '✦ Brief parsed — no categories identified', life: 2500 });
      this.cdr.markForCheck();
      return;
    }

    this.catSvc.getAll('catalogue').subscribe({
      next: catalogueCategories => {
        const cats0 = (catalogueCategories || []).filter(c => !(c as any).parent_id);
        const resolved: Array<{ ai: ParsedBriefCategory; db: Category }> = [];
        for (const ai of cats) {
          const dbName = EventDrawerComponent.AI_CATEGORY_TO_DB[ai.categoryId];
          let db = dbName ? cats0.find(c => c.name === dbName) : undefined;
          if (!db && ai.categoryLabel) {
            const lc = ai.categoryLabel.toLowerCase();
            db = cats0.find(c => lc.includes(c.name.toLowerCase()));
          }
          if (db) resolved.push({ ai, db });
        }

        if (!resolved.length) {
          this.aiParsing = false;
          this.msg.add({ severity: 'info', summary: '✦ Brief parsed — no matching catalogue categories', life: 3000 });
          this.cdr.markForCheck();
          return;
        }

        const upserts = resolved.map(({ ai, db }) =>
          this.projSvc.upsertCategory(pid, db.id, { requirement_brief: ai.oneLiner })
        );
        forkJoin(upserts).subscribe({
          next: () => {
            this.aiParsing = false;
            this.projSvc.triggerRefresh();
            this.msg.add({
              severity: 'success',
              summary: `✦ Brief parsed — ${resolved.length} categories identified`,
              detail: 'Open the Brief tab to review.',
              life: 3500
            });
            this.cdr.markForCheck();
          },
          error: () => {
            this.aiParsing = false;
            this.msg.add({ severity: 'error', summary: 'Failed to save AI categories', life: 3000 });
            this.cdr.markForCheck();
          }
        });
      },
      error: () => {
        this.aiParsing = false;
        this.msg.add({ severity: 'error', summary: 'Failed to load catalogue categories', life: 3000 });
        this.cdr.markForCheck();
      }
    });
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
