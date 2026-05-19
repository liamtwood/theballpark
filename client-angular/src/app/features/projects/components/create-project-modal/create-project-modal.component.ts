import {
  Component, ChangeDetectionStrategy, ChangeDetectorRef, OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LucideAngularModule, Paperclip, X, WandSparkles } from 'lucide-angular';

import { ProjectService } from '../../../../core/services/project.service';
import { ProjectCategoryService } from '../../../../core/services/project-category.service';
import { CategoryService } from '../../../../core/services/category.service';
import { OrgService } from '../../../../core/services/org.service';
import {
  CreateProjectService
} from '../../../../core/services/create-project.service';
import {
  BriefParserService, ParsedBrief, EXAMPLE_BRIEFS
} from '../../../../core/services/brief-parser.service';
import { Category } from '../../../../models';

/**
 * "New project" intake modal — v1.30.
 *
 * PrimeNG p-dialog mounted once at the app-shell level so every "+ New
 * project" call site (dashboard, project list, future top-nav) calls
 * CreateProjectService.open() and this single instance handles it.
 *
 * Flow:
 *   1. User fills name (required) + optional client / date / venue
 *   2. User pastes a brief OR uploads a file (file is captured for
 *      later AI parsing — not used by the rule-based parser yet)
 *   3. Click "Create & parse →"
 *      - Run BriefParserService.parseBrief(text) → ParsedBrief
 *      - ProjectService.create() with merged fields (modal fields
 *        take priority over parsed values)
 *      - For each parsed category, resolve to a real category_id via
 *        CategoryService.getAll() name-match, then
 *        ProjectCategoryService.upsert() with requirement_brief +
 *        ballpark_budget
 *      - Navigate to /projects/:id/brief
 *
 * The "Try an example" pills paste one of the EXAMPLE_BRIEFS into the
 * textarea + project name input.
 */
@Component({
  selector: 'app-create-project-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, LucideAngularModule,
    DialogModule, ButtonModule, InputTextModule, InputTextareaModule, ToastModule
  ],
  providers: [MessageService],
  template: `
    <p-dialog [(visible)]="visible"
              (visibleChange)="onVisibleChange($event)"
              [modal]="true" [draggable]="false" [resizable]="false"
              [closable]="false"
              [style]="{width:'560px'}"
              styleClass="bp-cp-dialog">

      <ng-template pTemplate="header">
        <div class="bp-cp-head">
          <div>
            <div class="bp-cp-title">New project</div>
            <div class="bp-cp-sub">Enter the basics — AI will do the rest</div>
          </div>
          <button type="button" class="bp-icon-btn" (click)="close()" title="Close">
            <i class="pi pi-times"></i>
          </button>
        </div>
      </ng-template>

      <div class="bp-cp-body">

        <!-- Row 1: name (required) | client -->
        <div class="bp-cp-row">
          <div class="bp-cp-field">
            <label class="bp-field-label">Project name<span class="bp-cp-req">*</span></label>
            <input pInputText [(ngModel)]="form.name"
                   placeholder="e.g. TechVista London Tech Week"
                   class="w-full bp-input-edit"/>
          </div>
          <div class="bp-cp-field">
            <label class="bp-field-label">Client</label>
            <input pInputText [(ngModel)]="form.client_name"
                   placeholder="e.g. TechVista Solutions"
                   class="w-full bp-input-edit"/>
          </div>
        </div>

        <!-- Row 2: event date (free text) | venue -->
        <div class="bp-cp-row">
          <div class="bp-cp-field">
            <label class="bp-field-label">Event date</label>
            <input pInputText [(ngModel)]="form.event_date"
                   placeholder="e.g. 2-4 June 2026 or Late September"
                   class="w-full bp-input-edit"/>
          </div>
          <div class="bp-cp-field">
            <label class="bp-field-label">Venue</label>
            <input pInputText [(ngModel)]="form.venue_name"
                   placeholder="e.g. ExCeL London"
                   class="w-full bp-input-edit"/>
          </div>
        </div>

        <!-- Upload zone (hidden when textarea has content) -->
        <ng-container *ngIf="!form.brief.trim()">
          <label class="bp-cp-upload"
                 [class.has-file]="uploadedFile"
                 (dragover)="$event.preventDefault()"
                 (drop)="onDrop($event)">
            <input #fileInput type="file" hidden
                   accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                   (change)="onFilePicked($event)"/>
            <ng-container *ngIf="!uploadedFile">
              <lucide-icon name="paperclip" [size]="16"></lucide-icon>
              <div class="bp-cp-upload-text">
                <div class="bp-cp-upload-title">Upload brief</div>
                <div class="bp-cp-upload-sub">PDF, image, or Word doc</div>
              </div>
            </ng-container>
            <ng-container *ngIf="uploadedFile">
              <lucide-icon name="paperclip" [size]="14"></lucide-icon>
              <span class="bp-cp-upload-name">{{ uploadedFile.name }}</span>
              <button type="button" class="bp-cp-upload-x"
                      (click)="$event.preventDefault(); uploadedFile = null;">
                <i class="pi pi-times"></i>
              </button>
            </ng-container>
          </label>
        </ng-container>

        <!-- Divider — only when no file is uploaded -->
        <div class="bp-cp-or" *ngIf="!uploadedFile">
          <span class="bp-cp-or-line"></span>
          <span class="bp-cp-or-text">or paste text</span>
          <span class="bp-cp-or-line"></span>
        </div>

        <!-- Textarea (hidden if file uploaded) -->
        <textarea *ngIf="!uploadedFile"
                  pInputTextarea
                  [(ngModel)]="form.brief"
                  [rows]="6"
                  placeholder="Paste a client email, brief, or rough notes here..."
                  class="w-full bp-input-edit bp-cp-brief"></textarea>

        <!-- Example pills -->
        <div class="bp-cp-examples" *ngIf="!uploadedFile">
          <span class="bp-cp-examples-label">Try an example:</span>
          <button *ngFor="let ex of examples"
                  type="button"
                  class="bp-cp-example-pill"
                  (click)="loadExample(ex.key)">
            {{ ex.label }}
          </button>
        </div>

        <div *ngIf="errorMsg" class="bp-cp-error">{{ errorMsg }}</div>
      </div>

      <ng-template pTemplate="footer">
        <p-button label="Cancel" styleClass="bp-btn-cancel"
                  [disabled]="creating"
                  (onClick)="close()"></p-button>
        <p-button styleClass="bp-btn-save"
                  [disabled]="!form.name.trim() || creating"
                  (onClick)="createAndParse()">
          <ng-template pTemplate="content">
            <i *ngIf="creating" class="pi pi-spin pi-spinner" style="margin-right:6px"></i>
            {{ creating ? 'Creating project...' : 'Create & parse →' }}
          </ng-template>
        </p-button>
      </ng-template>
    </p-dialog>

    <p-toast></p-toast>
  `,
  styles: [`
    :host { font-family: var(--font-body); }

    /* Override the default p-dialog chrome to read more like the
       Settings / drawer pattern — parchment header, hairline border. */
    :host ::ng-deep .bp-cp-dialog .p-dialog-header {
      background: var(--color-background-secondary, var(--theme-bg));
      border-bottom: 0.5px solid var(--color-border);
      padding: 16px 20px;
    }
    :host ::ng-deep .bp-cp-dialog .p-dialog-content {
      padding: 16px 20px 8px;
    }
    :host ::ng-deep .bp-cp-dialog .p-dialog-footer {
      background: var(--color-background-secondary, var(--theme-bg));
      border-top: 0.5px solid var(--color-border);
      padding: 12px 20px;
      display: flex; justify-content: flex-end; gap: 10px;
    }

    .bp-cp-head {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: 12px; width: 100%;
    }
    .bp-cp-title {
      font-family: var(--font-display);
      font-size: 22px; font-weight: 400;
      color: var(--color-text-primary);
    }
    .bp-cp-sub {
      font-size: 12px; color: var(--color-text-muted);
      margin-top: 2px;
    }

    .bp-cp-body { display: flex; flex-direction: column; gap: 14px; }
    .bp-cp-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .bp-cp-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .bp-cp-req { color: var(--color-danger); margin-left: 2px; }

    /* Upload zone — dashed parchment block. */
    .bp-cp-upload {
      display: flex; align-items: center; gap: 10px;
      padding: 14px 16px;
      border: 1px dashed var(--color-border);
      border-radius: 8px;
      background: var(--color-background-secondary, var(--theme-bg));
      color: var(--color-text-muted);
      cursor: pointer;
      transition: border-color 0.15s, color 0.15s;
    }
    .bp-cp-upload:hover {
      border-color: var(--theme-accent);
      color: var(--theme-accent);
    }
    .bp-cp-upload.has-file { padding: 10px 14px; }
    .bp-cp-upload-text { display: flex; flex-direction: column; gap: 1px; }
    .bp-cp-upload-title { font-size: 13px; font-weight: 500; color: var(--color-text-primary); }
    .bp-cp-upload-sub   { font-size: 11px; color: var(--color-text-muted); }
    .bp-cp-upload-name  { flex: 1; font-size: 12.5px; color: var(--color-text-primary); }
    .bp-cp-upload-x {
      width: 22px; height: 22px;
      border-radius: 50%;
      border: 0.5px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text-muted);
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 10px;
    }
    .bp-cp-upload-x:hover {
      color: var(--color-danger);
      border-color: var(--color-danger);
    }

    /* "or paste text" divider. */
    .bp-cp-or {
      display: flex; align-items: center; gap: 10px;
      font-size: 10.5px;
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .bp-cp-or-line { flex: 1; height: 0.5px; background: var(--color-border); }

    /* Brief textarea — same input styling as drawer fields. */
    .bp-cp-brief { resize: vertical; min-height: 120px; }

    /* Example pills. */
    .bp-cp-examples {
      display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
      font-size: 11.5px;
      color: var(--color-text-muted);
    }
    .bp-cp-examples-label { color: var(--color-text-muted); }
    .bp-cp-example-pill {
      display: inline-flex; align-items: center;
      height: 26px; padding: 0 12px;
      border: 0.5px solid var(--color-border);
      border-radius: 13px;
      background: var(--color-surface);
      color: var(--color-text-secondary);
      font-size: 11.5px; font-weight: 500;
      font-family: var(--font-body);
      cursor: pointer;
      transition: all 0.15s;
    }
    .bp-cp-example-pill:hover {
      border-color: var(--theme-accent);
      color: var(--theme-accent);
      background: var(--theme-bg);
    }

    .bp-cp-error {
      font-size: 12px;
      color: var(--color-danger);
      padding: 8px 10px;
      background: rgba(225, 29, 72, 0.06);
      border-radius: 6px;
    }
  `]
})
export class CreateProjectModalComponent implements OnInit {
  visible = false;
  creating = false;
  errorMsg = '';

  form = {
    name: '',
    client_name: '',
    event_date: '',
    venue_name: '',
    brief: ''
  };
  uploadedFile: File | null = null;
  examples = EXAMPLE_BRIEFS;

  private categories: Category[] = [];
  private orgId = '';

  constructor(
    private router: Router,
    private cpSvc: CreateProjectService,
    private parser: BriefParserService,
    private projSvc: ProjectService,
    private pcSvc: ProjectCategoryService,
    private catSvc: CategoryService,
    private orgSvc: OrgService,
    private msg: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // One subscription drives the modal's open state for every "+ New
    // project" call site in the app.
    this.cpSvc.visible$.subscribe(v => {
      this.visible = v;
      if (v) this.reset();
      this.cdr.markForCheck();
    });
    // Cache categories + org so Create & parse doesn't pay another
    // round-trip every click.
    this.catSvc.getAll('catalogue').subscribe(rows => {
      this.categories = rows || [];
      this.cdr.markForCheck();
    });
    this.orgSvc.getCurrentOrg().subscribe(org => {
      if (org) this.orgId = org.id;
    });
  }

  onVisibleChange(v: boolean) {
    this.cpSvc.setVisible(v);
  }

  close() {
    if (this.creating) return;
    this.cpSvc.close();
  }

  reset() {
    this.form = { name: '', client_name: '', event_date: '', venue_name: '', brief: '' };
    this.uploadedFile = null;
    this.errorMsg = '';
    this.creating = false;
  }

  loadExample(key: string) {
    const ex = this.examples.find(e => e.key === key);
    if (!ex) return;
    this.form.name = ex.projectName;
    this.form.client_name = ex.client;
    this.form.brief = ex.text;
    this.uploadedFile = null;
    this.cdr.markForCheck();
  }

  onFilePicked(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0];
    if (f) this.uploadedFile = f;
  }
  onDrop(ev: DragEvent) {
    ev.preventDefault();
    const f = ev.dataTransfer?.files?.[0];
    if (f) this.uploadedFile = f;
  }

  createAndParse() {
    if (!this.form.name.trim()) return;
    this.creating = true;
    this.errorMsg = '';
    this.cdr.markForCheck();

    const parsed: ParsedBrief = this.form.brief.trim()
      ? this.parser.parseBrief(this.form.brief)
      : { categories: [] };

    // Modal-typed fields always win over parsed values.
    const payload: any = {
      org_id:        this.orgId || null,
      name:          this.form.name.trim() || parsed.eventName,
      event_name:    this.form.name.trim() || parsed.eventName,
      client_name:   this.form.client_name.trim() || parsed.client,
      venue_name:    this.form.venue_name.trim() || parsed.venue,
      venue_city:    parsed.city,
      event_date:    this.form.event_date.trim() || parsed.eventDate,
      duration_days: parsed.durationDays,
      guest_count:   parsed.guestCount,
      project_budget: parsed.budget,
      event_type:    parsed.eventType,
      tier:          parsed.budgetSignal && parsed.budgetSignal !== 'unknown' ? parsed.budgetSignal : null,
      raw_brief_text: this.form.brief.trim(),
      currency:      'GBP'
    };

    this.projSvc.create(payload).subscribe({
      next: project => {
        // Resolve each parsed category to a real category_id and
        // upsert. Failures don't block the project navigation — the
        // user can scope categories manually on the Brief tab.
        const upserts = parsed.categories
          .map(pc => {
            const match = this.categories.find(c =>
              (c.name || '').toLowerCase() === pc.categoryName.toLowerCase()
            );
            if (!match) return null;
            return this.projSvc.upsertCategory(project.id, match.id, {
              requirement_brief: pc.requirementBrief,
              ballpark_budget:   pc.budgetEstimate ?? null
            });
          })
          .filter(Boolean) as any[];

        const finish = () => {
          this.creating = false;
          this.cpSvc.close();
          this.projSvc.triggerRefresh();
          this.router.navigate(['/projects', project.id, 'brief']);
        };

        if (!upserts.length) { finish(); return; }
        // Fire upserts in parallel; navigate when all resolve (or
        // settle — any error just shows a toast and we still navigate).
        let outstanding = upserts.length;
        upserts.forEach(o => o.subscribe({
          next: () => { if (--outstanding === 0) finish(); },
          error: () => {
            if (--outstanding === 0) finish();
            this.msg.add({
              severity: 'warn',
              summary: 'Some categories could not be created',
              life: 3000
            });
          }
        }));
      },
      error: () => {
        this.creating = false;
        this.errorMsg = 'Could not create the project. Try again.';
        this.cdr.markForCheck();
      }
    });
  }
}
