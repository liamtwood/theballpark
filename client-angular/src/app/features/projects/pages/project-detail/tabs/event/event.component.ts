import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef,
  ElementRef, ViewChild, HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LucideAngularModule } from 'lucide-angular';

import { ProjectService } from '../../../../../../core/services/project.service';
import { Project } from '../../../../../../models';
import { LoadingSpinnerComponent } from '../../../../../../shared/components/loading-spinner/loading-spinner.component';
import { MarkdownEditorComponent } from '../../../../../../shared/components/markdown-editor/markdown-editor.component';

type SectionKey = 'details' | 'type' | 'logistics' | 'financials';

@Component({
  selector: 'app-event',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, LucideAngularModule,
    ButtonModule, InputTextModule, InputNumberModule, DropdownModule,
    CalendarModule, ToastModule,
    LoadingSpinnerComponent, MarkdownEditorComponent
  ],
  providers: [MessageService],
  template: `
    <app-loading *ngIf="loading"></app-loading>

    <ng-container *ngIf="!loading && project">
      <div class="bp-brief-body">

        <h2 class="bp-page-title">Event</h2>
        <div class="bp-page-divider"></div>

        <!-- ── EVENT DETAILS ── -->
        <div class="bp-brief-sec">
          <div class="bp-brief-sec-h">
            <span class="bp-brief-sec-label">EVENT DETAILS</span>
            <div class="bp-brief-sec-actions">
              <button *ngIf="!editing.details" class="bp-icon-btn" (click)="startEdit('details')" title="Edit">
                <lucide-icon name="square-pen" [size]="14"></lucide-icon>
              </button>
              <ng-container *ngIf="editing.details">
                <button class="bp-icon-btn bp-icon-save" (click)="saveSection('details')" [disabled]="saving" title="Save">
                  <i class="pi pi-check"></i>
                </button>
                <button class="bp-icon-btn bp-icon-cancel" (click)="cancelEdit('details')" title="Cancel">
                  <i class="pi pi-times"></i>
                </button>
              </ng-container>
            </div>
          </div>

          <div class="bp-brief-grid4">
            <div class="bp-brief-field">
              <label class="bp-brief-flabel">Ref</label>
              <input pInputText [value]="form.po_ref || '—'" *ngIf="!editing.details"
                class="bp-brief-finput" readonly/>
              <input pInputText [(ngModel)]="form.po_ref" *ngIf="editing.details"
                class="bp-brief-finput bp-brief-edit" placeholder="e.g. TVS-2026-047"/>
            </div>
            <div class="bp-brief-field bp-brief-s2">
              <label class="bp-brief-flabel">Event name</label>
              <input pInputText [value]="form.event_name || '—'" *ngIf="!editing.details"
                class="bp-brief-finput" readonly/>
              <input pInputText [(ngModel)]="form.event_name" *ngIf="editing.details"
                class="bp-brief-finput bp-brief-edit"/>
            </div>
            <div class="bp-brief-field">
              <label class="bp-brief-flabel">Client</label>
              <input pInputText [value]="form.client_name || '—'" *ngIf="!editing.details"
                class="bp-brief-finput" readonly/>
              <input pInputText [(ngModel)]="form.client_name" *ngIf="editing.details"
                class="bp-brief-finput bp-brief-edit"/>
            </div>

            <div class="bp-brief-field bp-brief-s2">
              <label class="bp-brief-flabel">Venue</label>
              <input pInputText [value]="form.venue_name || '—'" *ngIf="!editing.details"
                class="bp-brief-finput" readonly/>
              <input pInputText [(ngModel)]="form.venue_name" *ngIf="editing.details"
                class="bp-brief-finput bp-brief-edit"/>
            </div>
            <div class="bp-brief-field">
              <label class="bp-brief-flabel">City</label>
              <input pInputText [value]="form.venue_city || '—'" *ngIf="!editing.details"
                class="bp-brief-finput" readonly/>
              <input pInputText [(ngModel)]="form.venue_city" *ngIf="editing.details"
                class="bp-brief-finput bp-brief-edit"/>
            </div>
            <div></div>
          </div>
        </div>

        <hr class="bp-brief-divider">

        <!-- ── EVENT TYPE ── -->
        <div class="bp-brief-sec">
          <div class="bp-brief-sec-h">
            <span class="bp-brief-sec-label">EVENT TYPE</span>
            <div class="bp-brief-sec-actions">
              <button *ngIf="!editing.type" class="bp-icon-btn" (click)="startEdit('type')" title="Edit">
                <lucide-icon name="square-pen" [size]="14"></lucide-icon>
              </button>
              <ng-container *ngIf="editing.type">
                <button class="bp-icon-btn bp-icon-save" (click)="saveSection('type')" [disabled]="saving" title="Save">
                  <i class="pi pi-check"></i>
                </button>
                <button class="bp-icon-btn bp-icon-cancel" (click)="cancelEdit('type')" title="Cancel">
                  <i class="pi pi-times"></i>
                </button>
              </ng-container>
            </div>
          </div>

          <div class="bp-brief-grid4">
            <div class="bp-brief-field bp-brief-s2">
              <label class="bp-brief-flabel">Event type</label>
              <input pInputText [value]="(form.event_type | titlecase) || '—'" *ngIf="!editing.type"
                class="bp-brief-finput" readonly/>
              <p-dropdown *ngIf="editing.type"
                [(ngModel)]="form.event_type"
                [options]="eventTypeOptions"
                optionLabel="label" optionValue="value"
                styleClass="w-full bp-brief-dropdown bp-brief-edit"
                placeholder="Select event type">
              </p-dropdown>
            </div>
            <div class="bp-brief-field bp-brief-s2">
              <label class="bp-brief-flabel">Tier</label>
              <input pInputText [value]="(form.tier | titlecase) || '—'" *ngIf="!editing.type"
                class="bp-brief-finput" readonly/>
              <p-dropdown *ngIf="editing.type"
                [(ngModel)]="form.tier"
                [options]="tierOptions"
                optionLabel="label" optionValue="value"
                styleClass="w-full bp-brief-dropdown bp-brief-edit"
                placeholder="Select tier">
              </p-dropdown>
            </div>
          </div>
        </div>

        <hr class="bp-brief-divider">

        <!-- ── LOGISTICS ── -->
        <div class="bp-brief-sec">
          <div class="bp-brief-sec-h">
            <span class="bp-brief-sec-label">LOGISTICS</span>
            <div class="bp-brief-sec-actions">
              <button *ngIf="!editing.logistics" class="bp-icon-btn" (click)="startEdit('logistics')" title="Edit">
                <lucide-icon name="square-pen" [size]="14"></lucide-icon>
              </button>
              <ng-container *ngIf="editing.logistics">
                <button class="bp-icon-btn bp-icon-save" (click)="saveSection('logistics')" [disabled]="saving" title="Save">
                  <i class="pi pi-check"></i>
                </button>
                <button class="bp-icon-btn bp-icon-cancel" (click)="cancelEdit('logistics')" title="Cancel">
                  <i class="pi pi-times"></i>
                </button>
              </ng-container>
            </div>
          </div>

          <div class="bp-brief-grid4">
            <div class="bp-brief-field bp-brief-s2">
              <label class="bp-brief-flabel">Event date</label>
              <input pInputText [value]="formatDate(form.event_date) || '—'" *ngIf="!editing.logistics"
                class="bp-brief-finput" readonly/>
              <p-calendar *ngIf="editing.logistics"
                [(ngModel)]="eventDate"
                dateFormat="d M yy"
                [showIcon]="true"
                appendTo="body"
                styleClass="w-full bp-brief-cal bp-brief-edit">
              </p-calendar>
            </div>
            <div class="bp-brief-field">
              <label class="bp-brief-flabel">Duration (days)</label>
              <input pInputText [value]="form.duration_days || '—'" *ngIf="!editing.logistics"
                class="bp-brief-finput" readonly/>
              <p-inputNumber *ngIf="editing.logistics"
                [(ngModel)]="form.duration_days" [min]="1"
                styleClass="w-full bp-brief-num bp-brief-edit">
              </p-inputNumber>
            </div>
            <div class="bp-brief-field">
              <label class="bp-brief-flabel">Guest count</label>
              <input pInputText [value]="form.guest_count || '—'" *ngIf="!editing.logistics"
                class="bp-brief-finput" readonly/>
              <p-inputNumber *ngIf="editing.logistics"
                [(ngModel)]="form.guest_count" [min]="1"
                styleClass="w-full bp-brief-num bp-brief-edit">
              </p-inputNumber>
            </div>
          </div>
        </div>

        <hr class="bp-brief-divider">

        <!-- ── FINANCIALS ── -->
        <div class="bp-brief-sec">
          <div class="bp-brief-sec-h">
            <div>
              <span class="bp-brief-sec-label">FINANCIALS</span>
              <div class="bp-brief-sec-hint">Top-line numbers — full breakdown lives in Estimate</div>
            </div>
            <div class="bp-brief-sec-actions">
              <button *ngIf="!editing.financials" class="bp-icon-btn" (click)="startEdit('financials')" title="Edit">
                <lucide-icon name="square-pen" [size]="14"></lucide-icon>
              </button>
              <ng-container *ngIf="editing.financials">
                <button class="bp-icon-btn bp-icon-save" (click)="saveSection('financials')" [disabled]="saving" title="Save">
                  <i class="pi pi-check"></i>
                </button>
                <button class="bp-icon-btn bp-icon-cancel" (click)="cancelEdit('financials')" title="Cancel">
                  <i class="pi pi-times"></i>
                </button>
              </ng-container>
            </div>
          </div>

          <div class="bp-brief-grid4">
            <div class="bp-brief-field bp-brief-s2">
              <label class="bp-brief-flabel">Budget</label>
              <input pInputText [value]="formatCurrency(form.project_budget) || '—'" *ngIf="!editing.financials"
                class="bp-brief-finput" readonly/>
              <p-inputNumber *ngIf="editing.financials"
                [(ngModel)]="form.project_budget" prefix="£"
                [maxFractionDigits]="0" [min]="0"
                styleClass="w-full bp-brief-num bp-brief-edit">
              </p-inputNumber>
            </div>
            <div class="bp-brief-field">
              <label class="bp-brief-flabel">Margin %</label>
              <input pInputText [value]="(form.default_margin_pct ?? '—') + (form.default_margin_pct ? '%' : '')" *ngIf="!editing.financials"
                class="bp-brief-finput" readonly/>
              <p-inputNumber *ngIf="editing.financials"
                [(ngModel)]="form.default_margin_pct" suffix="%"
                [min]="0" [max]="100"
                styleClass="w-full bp-brief-num bp-brief-edit">
              </p-inputNumber>
            </div>
            <div class="bp-brief-field">
              <label class="bp-brief-flabel">Contingency %</label>
              <input pInputText [value]="(form.default_contingency_pct ?? '—') + (form.default_contingency_pct ? '%' : '')" *ngIf="!editing.financials"
                class="bp-brief-finput" readonly/>
              <p-inputNumber *ngIf="editing.financials"
                [(ngModel)]="form.default_contingency_pct" suffix="%"
                [min]="0" [max]="100"
                styleClass="w-full bp-brief-num bp-brief-edit">
              </p-inputNumber>
            </div>
          </div>
        </div>

        <hr class="bp-brief-divider">

        <!-- ── PROJECT BRIEF ── -->
        <!-- Click-to-edit. View mode renders the brief as marked HTML; click
             anywhere on the preview (or empty placeholder) flips to edit
             mode with the markdown editor + toolbar. Done button or click
             outside the editor returns to view mode. Autosaves while
             editing on every value change with an 800ms debounce. -->
        <div class="bp-brief-sec">
          <div class="bp-brief-sec-h">
            <span class="bp-brief-sec-label">PROJECT BRIEF</span>
            <div class="bp-brief-brief-actions">
              <button class="bp-brief-parse" (click)="parseBrief($event)">
                <lucide-icon name="wand-sparkles" [size]="12"></lucide-icon>
                Parse brief
              </button>
              <button *ngIf="briefEditing" class="bp-brief-done" (click)="exitBriefEdit($event)">
                Done
              </button>
            </div>
          </div>

          <ng-container *ngIf="!briefEditing">
            <div class="bp-brief-md-view bp-md-preview"
              (click)="enterBriefEdit($event)"
              *ngIf="form.raw_brief_text; else briefEmpty"
              [innerHTML]="briefHtml">
            </div>
            <ng-template #briefEmpty>
              <div class="bp-brief-md-view bp-brief-md-empty"
                (click)="enterBriefEdit($event)">
                Click to add your project brief...
              </div>
            </ng-template>
          </ng-container>

          <div #briefEditor *ngIf="briefEditing" class="bp-brief-md-edit">
            <app-markdown-editor
              [value]="form.raw_brief_text || ''"
              (valueChange)="onBriefValueChange($event)"
              placeholder="Paste or write the event brief here..."
              [rows]="6"
              [showLabel]="false">
            </app-markdown-editor>
          </div>
        </div>

        <hr class="bp-brief-divider">

      </div>
    </ng-container>

    <p-toast></p-toast>
  `,
  styles: [`
    /* ── PAGE ── */
    .bp-brief-body { max-width: 860px; margin: 0 auto; padding: 28px 40px 100px; }

    /* ── SECTION ── */
    .bp-brief-sec        { margin-bottom: 24px; }
    .bp-brief-sec-h      { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px; gap: 12px; }
    .bp-brief-sec-label  { display: block; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--theme-accent); }
    .bp-brief-sec-hint   { font-size: 11.5px; color: var(--color-text-secondary); }
    .bp-brief-sec-actions{ display: flex; align-items: center; gap: 2px; }
    .bp-brief-divider    { height: 1px; background: var(--color-border); margin: 24px 0; border: none; }

    /* ── 4-COL GRID ── */
    .bp-brief-grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .bp-brief-s2    { grid-column: span 2; }
    .bp-brief-field { display: flex; flex-direction: column; gap: 5px; }
    .bp-brief-flabel { font-size: 10.5px; color: var(--color-text-secondary); font-weight: 500; }

    /* ── INPUT (view + edit unified — view is just readonly) ── */
    :host ::ng-deep .bp-brief-finput.p-inputtext {
      font-size: 13px !important;
      padding: 8px 11px !important;
      border: 0.5px solid var(--color-border) !important;
      border-radius: 6px !important;
      background: var(--color-surface) !important;
      color: var(--color-text-primary) !important;
      width: 100% !important;
      box-shadow: none !important;
    }
    :host ::ng-deep .bp-brief-finput.p-inputtext:read-only,
    :host ::ng-deep .bp-brief-finput.p-inputtext[readonly] {
      cursor: default !important;
    }
    :host ::ng-deep .bp-brief-finput.bp-brief-edit.p-inputtext,
    :host ::ng-deep input.bp-brief-edit.p-inputtext,
    :host ::ng-deep .bp-brief-num.bp-brief-edit .p-inputtext,
    :host ::ng-deep .bp-brief-dropdown.bp-brief-edit.p-dropdown,
    :host ::ng-deep .bp-brief-cal.bp-brief-edit .p-inputtext {
      background: var(--theme-bg) !important;
      border-color: var(--theme-accent) !important;
    }
    :host ::ng-deep .bp-brief-num.bp-brief-edit,
    :host ::ng-deep .bp-brief-dropdown.bp-brief-edit,
    :host ::ng-deep .bp-brief-cal.bp-brief-edit .p-calendar {
      width: 100% !important;
    }
    :host ::ng-deep .bp-brief-num.p-inputnumber input.p-inputtext {
      width: 100% !important;
      font-size: 13px !important;
      padding: 8px 11px !important;
      border-radius: 6px !important;
      border: 0.5px solid var(--color-border) !important;
      box-shadow: none !important;
    }
    :host ::ng-deep .bp-brief-dropdown.p-dropdown {
      border: 0.5px solid var(--color-border) !important;
      border-radius: 6px !important;
      font-size: 13px !important;
    }
    :host ::ng-deep .bp-brief-cal.p-calendar input.p-inputtext {
      font-size: 13px !important;
      padding: 8px 11px !important;
      border: 0.5px solid var(--color-border) !important;
      border-radius: 6px !important;
      box-shadow: none !important;
    }

    /* ── BRIEF SECTION ACTIONS (Parse + Done) ── */
    .bp-brief-brief-actions { display: inline-flex; align-items: center; gap: 8px; }

    /* PARSE BUTTON (pill, parchment + amber border) */
    .bp-brief-parse {
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
    .bp-brief-parse:hover { background: var(--theme-accent); color: var(--color-surface); }

    /* DONE BUTTON (solid amber) — mirrors the parse-pill height/radius. */
    .bp-brief-done {
      display: inline-flex; align-items: center;
      height: 28px; padding: 0 14px;
      border: 0.5px solid var(--theme-accent);
      background: var(--theme-accent);
      color: var(--color-surface);
      border-radius: 14px;
      font-size: 11.5px; font-weight: 600;
      font-family: var(--font-body);
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .bp-brief-done:hover { background: var(--theme-text); border-color: var(--theme-text); }

    /* ── BRIEF VIEW MODE (rendered markdown) ── */
    .bp-brief-md-view {
      cursor: text;
      min-height: 60px;
      padding: 8px 0;
      font-family: var(--font-sans);
      color: var(--color-text-primary);
      line-height: 1.7;
    }
    .bp-brief-md-empty {
      color: var(--color-text-muted);
      font-style: italic;
    }
    .bp-brief-md-edit { /* wrapper used by ViewChild + click-outside check */ }

    /* Icon edit buttons inherit the global .bp-icon-btn from styles.css.
       Save = amber accent, cancel = neutral — handled there. */
  `]
})
export class EventComponent implements OnInit, OnDestroy {
  loading = true;
  saving = false;
  pid = '';

  project: Project | null = null;
  form: Partial<Project> = {};

  // ── Project brief click-to-edit ──
  briefEditing = false;
  briefHtml: SafeHtml = '';
  @ViewChild('briefEditor') briefEditorRef?: ElementRef<HTMLElement>;

  editing = { details: false, type: false, logistics: false, financials: false };
  private snapshots: Record<SectionKey, Partial<Project>> = {
    details: {}, type: {}, logistics: {}, financials: {}
  };

  // p-calendar binds Date, project stores ISO. Use a plain backing field —
  // a getter that returns `new Date(...)` on every read sends a fresh
  // reference into p-calendar each CD cycle, which sets ngModel back, which
  // triggers another CD pass — infinite loop, app freezes. Sync explicitly
  // when the project loads, when entering Logistics edit, and on save.
  eventDate: Date | null = null;

  private briefSaveTimer: any = null;

  eventTypeOptions = [
    { label: 'Gala',           value: 'gala' },
    { label: 'Conference',     value: 'conference' },
    { label: 'Activation',     value: 'activation' },
    { label: 'Exhibition',     value: 'exhibition' },
    { label: 'Summer Party',   value: 'summer_party' },
    { label: 'Awards',         value: 'awards' },
    { label: 'Corporate',      value: 'corporate' },
    { label: 'Private',        value: 'private' },
  ];
  tierOptions = [
    { label: 'Core',      value: 'core' },
    { label: 'Signature', value: 'signature' },
    { label: 'Premium',   value: 'premium' },
  ];

  constructor(
    private route: ActivatedRoute,
    private projSvc: ProjectService,
    private msg: MessageService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.pid = this.route.parent?.snapshot.paramMap.get('id') || '';
    if (!this.pid) {
      this.loading = false;
      this.cdr.markForCheck();
      return;
    }

    this.projSvc.getById(this.pid).subscribe({
      next: project => {
        this.project = project;
        this.syncForm(project);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  ngOnDestroy() {
    if (this.briefSaveTimer) clearTimeout(this.briefSaveTimer);
  }

  // ── Project form sync ──
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
    this.syncEventDate();
    this.refreshBriefPreview();
  }

  private syncEventDate() {
    if (!this.form.event_date) { this.eventDate = null; return; }
    const d = new Date(this.form.event_date as any);
    this.eventDate = isNaN(d.getTime()) ? null : d;
  }

  private refreshBriefPreview() {
    const html = marked.parse(this.form.raw_brief_text || '', { async: false }) as string;
    this.briefHtml = this.sanitizer.bypassSecurityTrustHtml(html);
  }

  // ── Section edit controls ──
  startEdit(section: SectionKey) {
    this.snapshots[section] = { ...this.form };
    // Re-sync the calendar field whenever Logistics enters edit so the
    // p-calendar shows the current ISO value as a Date.
    if (section === 'logistics') this.syncEventDate();
    this.editing[section] = true;
    this.cdr.markForCheck();
  }

  cancelEdit(section: SectionKey) {
    Object.assign(this.form, this.snapshots[section]);
    if (section === 'logistics') this.syncEventDate();
    this.editing[section] = false;
    this.cdr.markForCheck();
  }

  saveSection(section: SectionKey) {
    if (section === 'logistics') {
      this.form.event_date = this.eventDate ? this.eventDate.toISOString() : undefined;
    }
    this.saving = true;
    this.projSvc.update(this.pid, this.form).subscribe({
      next: p => {
        this.project = p;
        this.syncForm(p);
        this.saving = false;
        this.editing[section] = false;
        this.msg.add({ severity: 'success', summary: 'Saved ✓', life: 1500 });
        this.projSvc.triggerRefresh();
        this.cdr.markForCheck();
      },
      error: () => {
        this.saving = false;
        this.msg.add({ severity: 'error', summary: 'Failed to save', life: 3000 });
        this.cdr.markForCheck();
      }
    });
  }

  // ── Project brief click-to-edit ──
  enterBriefEdit(ev: MouseEvent) {
    // Stop propagation so the document:click listener doesn't immediately
    // close the editor we're about to open.
    ev.stopPropagation();
    if (this.briefEditing) return;
    this.briefEditing = true;
    this.cdr.markForCheck();
  }

  exitBriefEdit(ev?: MouseEvent) {
    if (ev) ev.stopPropagation();
    if (!this.briefEditing) return;
    // Flush any pending autosave so the latest text persists.
    if (this.briefSaveTimer) {
      clearTimeout(this.briefSaveTimer);
      this.briefSaveTimer = null;
      this.persistBrief(this.form.raw_brief_text || '');
    }
    this.briefEditing = false;
    this.refreshBriefPreview();
    this.cdr.markForCheck();
  }

  // Click-outside-to-exit. Skipped while not editing so it's free; uses
  // ViewChild ref + .contains() so toolbar / preview-tab clicks INSIDE
  // the editor don't close it.
  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent) {
    if (!this.briefEditing) return;
    const ref = this.briefEditorRef?.nativeElement;
    if (!ref) return;
    if (ref.contains(ev.target as Node)) return;
    this.exitBriefEdit();
  }

  // ── Project brief autosave (markdown editor) ──
  onBriefValueChange(value: string) {
    this.form.raw_brief_text = value;
    if (this.briefSaveTimer) clearTimeout(this.briefSaveTimer);
    this.briefSaveTimer = setTimeout(() => {
      this.briefSaveTimer = null;
      this.persistBrief(value);
    }, 800);
  }

  private persistBrief(value: string) {
    this.projSvc.update(this.pid, { raw_brief_text: value || '' }).subscribe({
      next: () => this.msg.add({ severity: 'success', summary: 'Saved ✓', life: 1200 }),
      error: () => this.msg.add({ severity: 'error', summary: 'Failed to save brief', life: 3000 })
    });
  }

  parseBrief(ev?: MouseEvent) {
    // Stub — AI brief parsing lives behind this in a later release.
    if (ev) ev.stopPropagation();
    this.msg.add({ severity: 'info', summary: 'AI parsing coming soon', life: 2000 });
  }

  // ── Display helpers ──
  formatDate(value: any): string {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  formatCurrency(value: any): string {
    if (value === null || value === undefined || value === '') return '';
    const n = Number(value);
    if (isNaN(n)) return '';
    return '£' + n.toLocaleString('en-GB', { maximumFractionDigits: 0 });
  }
}
