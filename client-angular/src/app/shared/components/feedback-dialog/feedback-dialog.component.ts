import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { CalendarModule } from 'primeng/calendar';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LucideAngularModule } from 'lucide-angular';
import { FeedbackService, FeedbackCategory, TEAM_MEMBERS, TeamMember } from '../../../core/services/feedback.service';

interface TypeOption { label: string; value: string; id: string; }

function tokenize(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_');
}

type FlowType = 'folder' | 'issue' | 'note' | null;

@Component({
  selector: 'app-feedback-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    DialogModule, InputTextModule, InputTextareaModule, CalendarModule, ButtonModule, ToastModule,
    LucideAngularModule
  ],
  providers: [MessageService],
  template: `
    <p-dialog [(visible)]="visible" [modal]="true" [closable]="true"
      [style]="{width:'520px'}" styleClass="bp-modal"
      (onHide)="onClose()">
      <ng-template pTemplate="header">
        <span class="p-dialog-title">{{ dialogHeader }}</span>
      </ng-template>

      <!-- STEP 1: Object type -->
      <div *ngIf="step === 'pick'" class="bp-fb-step">
        <p class="bp-fb-prompt">What are you logging?</p>
        <div class="bp-fb-cat-grid bp-fb-cat-grid--3">
          <button class="bp-fb-cat-btn" (click)="startFlow('folder')">
            <lucide-icon name="folder-open" [size]="28" class="bp-fb-cat-icon"></lucide-icon>
            <span class="bp-fb-cat-name">Folder</span>
            <span class="bp-fb-cat-tagline">Meeting, sprint, test run</span>
          </button>
          <button class="bp-fb-cat-btn" (click)="startFlow('issue')">
            <lucide-icon name="alert-triangle" [size]="28" class="bp-fb-cat-icon"></lucide-icon>
            <span class="bp-fb-cat-name">Issue</span>
            <span class="bp-fb-cat-tagline">Bug, enhancement, question</span>
          </button>
          <button class="bp-fb-cat-btn" (click)="startFlow('note')">
            <lucide-icon name="file-text" [size]="28" class="bp-fb-cat-icon"></lucide-icon>
            <span class="bp-fb-cat-name">Note</span>
            <span class="bp-fb-cat-tagline">Free-text note</span>
          </button>
        </div>
      </div>

      <!-- FOLDER FLOW -->
      <div *ngIf="step === 'folder'" class="bp-fb-step">
        <div class="bp-fb-context">
          <lucide-icon name="folder-open" [size]="14"></lucide-icon>
          <span class="bp-fb-context-cat">Folder</span>
        </div>
        <div class="mb-4">
          <label class="bp-field-label">Type</label>
          <div class="bp-fb-sub-row">
            <button *ngFor="let t of folderTypes" class="bp-fb-sub-pill"
              [class.active]="folderType === t.value" (click)="folderType = t.value">
              {{ t.label }}
            </button>
          </div>
        </div>
        <div class="mb-4">
          <label class="bp-field-label">{{ dateLabel }}</label>
          <p-calendar [(ngModel)]="eventDate" [showIcon]="true" dateFormat="dd M yy"
            styleClass="w-full" inputStyleClass="bp-input-edit w-full"></p-calendar>
        </div>
        <div class="mb-4">
          <label class="bp-field-label">Title *</label>
          <input pInputText [(ngModel)]="title" class="w-full bp-input-edit" [placeholder]="folderTitlePlaceholder"/>
        </div>
        <div>
          <label class="bp-field-label">Description</label>
          <textarea pInputTextarea [(ngModel)]="notes" class="w-full bp-input-edit" [rows]="3"
            style="resize:none;" placeholder="Notes or summary..."></textarea>
        </div>
      </div>

      <!-- ISSUE FLOW -->
      <div *ngIf="step === 'issue'" class="bp-fb-step">
        <div class="bp-fb-context">
          <lucide-icon name="alert-triangle" [size]="14"></lucide-icon>
          <span class="bp-fb-context-cat">Issue</span>
        </div>
        <div class="mb-4">
          <label class="bp-field-label">Type</label>
          <div class="bp-fb-sub-row">
            <button *ngFor="let t of issueTypes" class="bp-fb-sub-pill"
              [class.active]="issueType === t.value" (click)="issueType = t.value">
              {{ t.label }}
            </button>
          </div>
        </div>
        <div class="mb-4">
          <label class="bp-field-label">Title *</label>
          <input pInputText [(ngModel)]="title" class="w-full bp-input-edit" [placeholder]="issuePlaceholder"/>
        </div>
        <div class="mb-4">
          <label class="bp-field-label">Description</label>
          <textarea pInputTextarea [(ngModel)]="notes" class="w-full bp-input-edit" [rows]="3"
            style="resize:none;" placeholder="Detail..."></textarea>
        </div>
        <div class="bp-field-grid-2">
          <div>
            <label class="bp-field-label">Owner</label>
            <div class="bp-owner-row">
              <button *ngFor="let m of team" class="bp-owner-circle"
                [class.active]="owner === m.name" (click)="owner = m.name">
                {{ m.initials }}
              </button>
            </div>
          </div>
          <div>
            <label class="bp-field-label">Due date</label>
            <p-calendar [(ngModel)]="dueDate" [showIcon]="true" dateFormat="dd M yy"
              styleClass="w-full" inputStyleClass="bp-input-edit w-full"></p-calendar>
          </div>
        </div>
      </div>

      <!-- NOTE FLOW -->
      <div *ngIf="step === 'note'" class="bp-fb-step">
        <div class="bp-fb-context">
          <lucide-icon name="file-text" [size]="14"></lucide-icon>
          <span class="bp-fb-context-cat">Note</span>
        </div>
        <div class="mb-4">
          <label class="bp-field-label">Title *</label>
          <input pInputText [(ngModel)]="title" class="w-full bp-input-edit" placeholder="Note title..."/>
        </div>
        <div>
          <label class="bp-field-label">Content</label>
          <textarea pInputTextarea [(ngModel)]="notes" class="w-full bp-input-edit" [rows]="5"
            style="resize:none;" placeholder="Write your note..."></textarea>
        </div>
      </div>

      <ng-template pTemplate="footer">
        <div class="bp-fb-footer">
          <button class="bp-btn-cancel" (click)="onClose()">Cancel</button>
          <button *ngIf="step !== 'pick'" class="bp-btn-save"
            [disabled]="!title?.trim()" (click)="submit()">
            Submit
          </button>
        </div>
      </ng-template>
    </p-dialog>
    <p-toast></p-toast>
  `,
  styles: [`
    .bp-fb-step { padding: 8px 0; }
    .bp-fb-prompt { font-size: 14px; font-weight: 500; color: var(--color-text-primary); margin-bottom: 16px; }
    .bp-fb-cat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .bp-fb-cat-grid--3 { grid-template-columns: 1fr 1fr 1fr; }
    .bp-fb-cat-btn {
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      padding: 20px 12px; border-radius: 10px; cursor: pointer;
      border: 1px solid var(--color-border); background: var(--color-surface); transition: all 0.15s;
      font-family: var(--font-body);
    }
    .bp-fb-cat-btn:hover { border-color: var(--theme-accent); }
    .bp-fb-cat-icon { color: var(--theme-accent); }
    .bp-fb-cat-name { font-size: 14px; font-weight: 600; color: var(--color-text-primary); }
    .bp-fb-cat-tagline { font-size: 11px; color: var(--color-text-muted); text-align: center; }
    .bp-fb-sub-row { display: flex; flex-wrap: wrap; gap: 8px; }
    .bp-fb-sub-pill {
      padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 500;
      border: 1px solid var(--color-border); background: var(--color-surface);
      color: var(--color-text-secondary); cursor: pointer; transition: all 0.15s; font-family: var(--font-body);
    }
    .bp-fb-sub-pill:hover { border-color: var(--theme-accent); color: var(--theme-accent); }
    .bp-fb-sub-pill.active { border-color: var(--theme-accent); background: var(--theme-accent); color: var(--color-surface); }
    .bp-fb-context { font-size: 12px; color: var(--color-text-muted); margin-bottom: 16px; display: flex; align-items: center; gap: 4px; }
    .bp-fb-context-cat { font-weight: 500; }
    .bp-owner-row { display: flex; gap: 8px; margin-top: 4px; }
    .bp-owner-circle {
      width: 36px; height: 36px; border-radius: 50%; font-size: 11px; font-weight: 600;
      border: 2px solid var(--color-border); background: var(--color-surface);
      color: var(--color-text-secondary); cursor: pointer; transition: all 0.15s;
      display: flex; align-items: center; justify-content: center; font-family: var(--font-body);
    }
    .bp-owner-circle:hover { border-color: var(--theme-accent); }
    .bp-owner-circle.active { border-color: var(--theme-accent); background: var(--theme-accent); color: #fff; }
    .bp-fb-footer { display: flex; justify-content: flex-end; gap: 8px; }
    .bp-btn-cancel {
      padding: 8px 20px; border-radius: 6px; font-size: 13px; font-weight: 500;
      border: 1px solid var(--color-border); background: transparent;
      color: var(--color-text-secondary); cursor: pointer; font-family: var(--font-body);
    }
    .bp-btn-save {
      padding: 8px 20px; border-radius: 6px; font-size: 13px; font-weight: 500;
      border: 1px solid var(--theme-accent); background: var(--theme-accent);
      color: #fff; cursor: pointer; font-family: var(--font-body);
    }
    .bp-btn-save:disabled { opacity: 0.4; cursor: not-allowed; }
  `]
})
export class FeedbackDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() initialFlow: FlowType = null;
  @Input() parentId: string | null = null;
  @Input() parentTitle: string = '';
  @Input() folderTypePreset: string = '';
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() submitted = new EventEmitter<{ id: string; object_type: string; type: string }>();

  step: 'pick' | 'folder' | 'issue' | 'note' = 'pick';
  title = '';
  notes = '';
  owner = '';
  eventDate: Date = new Date();
  dueDate: Date | null = null;
  folderType = 'minutes';
  issueType = 'bug';

  team: TeamMember[] = TEAM_MEMBERS;

  // Type options driven from shared.feedback_categories (loaded once).
  // 'Note' folder type is intentionally excluded — the dialog has its own
  // top-level Note flow (step === 'note').
  folderTypes: TypeOption[] = [];
  issueTypes: TypeOption[] = [];

  get dialogHeader(): string {
    switch (this.step) {
      case 'folder': return 'New Folder';
      case 'issue': return 'Log Issue';
      case 'note': return 'New Note';
      default: return 'Log feedback';
    }
  }

  get dateLabel(): string {
    switch (this.folderType) {
      case 'minutes': return 'Meeting date';
      case 'sprint': return 'Sprint end date';
      case 'test_run': return 'Completed date';
      default: return 'Date';
    }
  }

  get folderTitlePlaceholder(): string {
    const d = (this.eventDate || new Date()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    switch (this.folderType) {
      case 'minutes': return `e.g. Beth & Megan ${d}`;
      case 'sprint': return `e.g. Sprint 12 — ${d}`;
      case 'test_run': return `e.g. Regression test ${d}`;
      default: return `e.g. Workshop ${d}`;
    }
  }

  get issuePlaceholder(): string {
    switch (this.issueType) {
      case 'bug': return "What's broken?";
      case 'enhancement': return 'What would you like?';
      case 'question': return 'What do you want to know?';
      default: return 'Describe the requirement';
    }
  }

  constructor(
    private feedbackSvc: FeedbackService,
    private msg: MessageService,
    private cdr: ChangeDetectorRef
  ) {
    this.feedbackSvc.getFeedbackCategories().subscribe({
      next: (cats) => {
        const toOption = (c: FeedbackCategory): TypeOption => ({ label: c.name, value: tokenize(c.name), id: c.id });
        this.folderTypes = (cats || [])
          .filter(c => c.object_type === 'folder' && c.name !== 'Note')
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(toOption);
        this.issueTypes = (cats || [])
          .filter(c => c.object_type === 'issue')
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(toOption);
        this.cdr.detectChanges();
      }
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['visible'] && this.visible) {
      if (this.initialFlow) {
        this.step = this.initialFlow;
        if (this.folderTypePreset) this.folderType = this.folderTypePreset;
      } else {
        this.step = 'pick';
      }
    }
  }

  startFlow(flow: FlowType) {
    this.step = flow || 'pick';
    this.cdr.detectChanges();
  }

  submit() {
    if (!this.title?.trim()) return;

    const data: any = {
      title: this.title.trim(),
      notes: this.notes?.trim() || undefined,
      page_url: window.location.pathname
    };

    if (this.step === 'folder') {
      data.object_type = 'folder';
      data.type = this.folderType;
      data.feedback_category_id = this.folderTypes.find(t => t.value === this.folderType)?.id;
      data.event_date = this.eventDate ? this.eventDate.toISOString().split('T')[0] : undefined;
      if (this.folderType === 'minutes' || this.folderType === 'workshop') {
        data.agenda = [];
      }
    } else if (this.step === 'issue') {
      data.object_type = 'issue';
      data.type = this.issueType;
      data.feedback_category_id = this.issueTypes.find(t => t.value === this.issueType)?.id;
      data.owner = this.owner || undefined;
      data.due_date = this.dueDate ? this.dueDate.toISOString().split('T')[0] : undefined;
      if (this.parentId) data.parent_id = this.parentId;
    } else {
      data.object_type = 'note';
      data.type = 'note';
    }

    this.feedbackSvc.create(data).subscribe({
      next: (result) => {
        this.msg.add({ severity: 'success', summary: 'Logged \u2713' });
        this.submitted.emit({ id: result.id, object_type: result.object_type || 'issue', type: result.type || '' });
        if (this.step === 'folder') {
          window.open('/folder/' + result.id, '_blank');
        }
        this.reset();
        this.visible = false;
        this.visibleChange.emit(false);
        this.cdr.detectChanges();
      },
      error: () => { this.msg.add({ severity: 'error', summary: 'Failed to save' }); }
    });
  }

  onClose() {
    this.reset();
    this.visible = false;
    this.visibleChange.emit(false);
  }

  private reset() {
    this.step = 'pick';
    this.title = '';
    this.notes = '';
    this.owner = '';
    this.eventDate = new Date();
    this.dueDate = null;
    this.folderType = 'minutes';
    this.issueType = 'bug';
    this.parentId = null;
    this.parentTitle = '';
    this.initialFlow = null;
    this.folderTypePreset = '';
  }
}
