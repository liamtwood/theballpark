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
import { FeedbackService, TEAM_MEMBERS, TeamMember } from '../../../core/services/feedback.service';

type FlowType = 'bug' | 'note' | 'action' | 'question' | null;

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

      <!-- STEP 1: Type selection -->
      <div *ngIf="step === 'type'" class="bp-fb-step">
        <p class="bp-fb-prompt">What type of feedback?</p>
        <div class="bp-fb-cat-grid">
          <button class="bp-fb-cat-btn" (click)="startFlow('bug')">
            <lucide-icon name="bug" [size]="28" class="bp-fb-cat-icon"></lucide-icon>
            <span class="bp-fb-cat-name">Bug</span>
            <span class="bp-fb-cat-tagline">Something isn't working</span>
          </button>
          <button class="bp-fb-cat-btn" (click)="startFlow('note')">
            <lucide-icon name="clipboard-pen" [size]="28" class="bp-fb-cat-icon"></lucide-icon>
            <span class="bp-fb-cat-name">Meeting Note</span>
            <span class="bp-fb-cat-tagline">Log notes from a session</span>
          </button>
          <button class="bp-fb-cat-btn" (click)="startFlow('question')">
            <lucide-icon name="circle-help" [size]="28" class="bp-fb-cat-icon"></lucide-icon>
            <span class="bp-fb-cat-name">Question</span>
            <span class="bp-fb-cat-tagline">Something to discuss</span>
          </button>
          <button class="bp-fb-cat-btn" (click)="startFlow('action')">
            <lucide-icon name="check-square" [size]="28" class="bp-fb-cat-icon"></lucide-icon>
            <span class="bp-fb-cat-name">Action Item</span>
            <span class="bp-fb-cat-tagline">Task or follow-up</span>
          </button>
        </div>
      </div>

      <!-- BUG FLOW -->
      <div *ngIf="step === 'bug'" class="bp-fb-step">
        <div class="bp-fb-context">
          <lucide-icon name="bug" [size]="14"></lucide-icon>
          <span class="bp-fb-context-cat">Bug</span>
        </div>
        <div class="mb-4">
          <label class="bp-field-label">Title *</label>
          <input pInputText [(ngModel)]="title" class="w-full bp-input-edit" placeholder="What's broken?"/>
        </div>
        <div class="mb-4">
          <label class="bp-field-label">Description</label>
          <textarea pInputTextarea [(ngModel)]="notes" class="w-full bp-input-edit" [rows]="3"
            style="resize:none;" placeholder="Steps to reproduce, expected vs actual..."></textarea>
        </div>
        <div class="mb-4">
          <label class="bp-field-label">Owner</label>
          <div class="bp-owner-row">
            <button *ngFor="let m of team" class="bp-owner-circle"
              [class.active]="owner === m.name" (click)="owner = m.name">
              {{ m.initials }}
            </button>
          </div>
        </div>
        <div>
          <label class="bp-field-label">Page</label>
          <input pInputText [value]="pageUrl" class="w-full bp-field-readonly" readonly/>
        </div>
      </div>

      <!-- QUESTION FLOW -->
      <div *ngIf="step === 'question'" class="bp-fb-step">
        <div class="bp-fb-context">
          <lucide-icon name="circle-help" [size]="14"></lucide-icon>
          <span class="bp-fb-context-cat">Question</span>
        </div>
        <div class="mb-4">
          <label class="bp-field-label">Title *</label>
          <input pInputText [(ngModel)]="title" class="w-full bp-input-edit" placeholder="What do you want to know?"/>
        </div>
        <div class="mb-4">
          <label class="bp-field-label">Detail</label>
          <textarea pInputTextarea [(ngModel)]="notes" class="w-full bp-input-edit" [rows]="3"
            style="resize:none;" placeholder="Context or background..."></textarea>
        </div>
        <div>
          <label class="bp-field-label">Owner</label>
          <div class="bp-owner-row">
            <button *ngFor="let m of team" class="bp-owner-circle"
              [class.active]="owner === m.name" (click)="owner = m.name">
              {{ m.initials }}
            </button>
          </div>
        </div>
      </div>

      <!-- MEETING NOTE FLOW -->
      <div *ngIf="step === 'note'" class="bp-fb-step">
        <div class="bp-fb-context">
          <lucide-icon name="clipboard-pen" [size]="14"></lucide-icon>
          <span class="bp-fb-context-cat">Meeting Note</span>
        </div>
        <div class="mb-4">
          <label class="bp-field-label">Meeting date</label>
          <p-calendar [(ngModel)]="meetingDate" [showIcon]="true" dateFormat="dd M yy"
            styleClass="w-full" inputStyleClass="bp-input-edit w-full"></p-calendar>
        </div>
        <div class="mb-4">
          <label class="bp-field-label">Title *</label>
          <input pInputText [(ngModel)]="title" class="w-full bp-input-edit" [placeholder]="noteTitlePlaceholder"/>
        </div>
        <div>
          <label class="bp-field-label">Notes / summary</label>
          <textarea pInputTextarea [(ngModel)]="notes" class="w-full bp-input-edit" [rows]="4"
            style="resize:none;" placeholder="Key points, decisions, next steps..."></textarea>
        </div>
      </div>

      <!-- ACTION ITEM FLOW (child of a note) -->
      <div *ngIf="step === 'action'" class="bp-fb-step">
        <div class="bp-fb-context">
          <lucide-icon name="check-square" [size]="14"></lucide-icon>
          <span class="bp-fb-context-cat">Action Item</span>
          <span *ngIf="parentTitle" class="bp-fb-context-sep"> &rsaquo; </span>
          <span *ngIf="parentTitle" class="bp-fb-context-sub">{{ parentTitle }}</span>
        </div>
        <div class="mb-4">
          <label class="bp-field-label">Type</label>
          <div class="bp-fb-sub-row">
            <button *ngFor="let t of actionTypes" class="bp-fb-sub-pill"
              [class.active]="actionType === t.value" (click)="actionType = t.value">
              {{ t.label }}
            </button>
          </div>
        </div>
        <div class="mb-4">
          <label class="bp-field-label">Title *</label>
          <input pInputText [(ngModel)]="title" class="w-full bp-input-edit" placeholder="What needs to be done?"/>
        </div>
        <div class="mb-4">
          <label class="bp-field-label">Description</label>
          <textarea pInputTextarea [(ngModel)]="notes" class="w-full bp-input-edit" [rows]="2"
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

      <!-- POST-NOTE: add actions -->
      <div *ngIf="step === 'post-note'" class="bp-fb-step">
        <div class="bp-fb-success-msg">
          <lucide-icon name="check" [size]="18" class="bp-fb-success-icon"></lucide-icon>
          <span>Meeting note saved</span>
        </div>
        <p class="bp-fb-prompt">Add action items from this meeting?</p>
      </div>

      <ng-template pTemplate="footer">
        <div class="bp-fb-footer">
          <button class="bp-btn-cancel" (click)="step === 'post-note' ? onClose() : onClose()">
            {{ step === 'post-note' ? 'Done' : 'Cancel' }}
          </button>
          <button *ngIf="step === 'post-note'" class="bp-btn-save" (click)="startActionFlow()">
            + Add action item
          </button>
          <button *ngIf="step !== 'type' && step !== 'post-note'" class="bp-btn-save"
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
    .bp-fb-context-sep { color: var(--color-text-muted); }
    .bp-fb-context-sub { font-weight: 500; color: var(--theme-accent); }

    .bp-owner-row { display: flex; gap: 8px; margin-top: 4px; }
    .bp-owner-circle {
      width: 36px; height: 36px; border-radius: 50%; font-size: 11px; font-weight: 600;
      border: 2px solid var(--color-border); background: var(--color-surface);
      color: var(--color-text-secondary); cursor: pointer; transition: all 0.15s;
      display: flex; align-items: center; justify-content: center; font-family: var(--font-body);
    }
    .bp-owner-circle:hover { border-color: var(--theme-accent); }
    .bp-owner-circle.active { border-color: var(--theme-accent); background: var(--theme-accent); color: #fff; }

    .bp-fb-success-msg {
      display: flex; align-items: center; gap: 8px; padding: 12px 16px;
      background: var(--theme-bg); border-radius: 8px; margin-bottom: 16px;
      font-size: 14px; font-weight: 500; color: var(--color-text-primary);
    }
    .bp-fb-success-icon { color: var(--theme-accent); }

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
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() submitted = new EventEmitter<{ id: string; flow: string }>();

  step: 'type' | 'bug' | 'note' | 'question' | 'action' | 'post-note' = 'type';
  title = '';
  notes = '';
  owner = '';
  meetingDate: Date = new Date();
  dueDate: Date | null = null;
  actionType = 'action';
  pageUrl = '';
  lastCreatedId = '';

  team: TeamMember[] = TEAM_MEMBERS;
  actionTypes = [
    { label: 'Bug', value: 'bug' },
    { label: 'Enhancement', value: 'enhancement' },
    { label: 'Question', value: 'question' },
    { label: 'Action', value: 'action' }
  ];

  get dialogHeader(): string {
    switch (this.step) {
      case 'bug': return 'Log a Bug';
      case 'note': return 'Meeting Note';
      case 'question': return 'Question';
      case 'action': return 'Action Item';
      case 'post-note': return 'Meeting Note';
      default: return 'Log feedback';
    }
  }

  get noteTitlePlaceholder(): string {
    const d = this.meetingDate || new Date();
    const formatted = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return `e.g. Beth & Megan ${formatted}`;
  }

  constructor(
    private feedbackSvc: FeedbackService,
    private msg: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['visible'] && this.visible) {
      this.pageUrl = window.location.pathname;
      if (this.initialFlow) {
        this.startFlow(this.initialFlow);
      } else if (this.parentId) {
        this.step = 'action';
      } else {
        this.step = 'type';
      }
    }
  }

  startFlow(flow: FlowType) {
    this.step = flow || 'type';
    this.cdr.detectChanges();
  }

  startActionFlow() {
    this.title = '';
    this.notes = '';
    this.owner = '';
    this.dueDate = null;
    this.actionType = 'action';
    this.parentId = this.lastCreatedId;
    this.step = 'action';
    this.cdr.detectChanges();
  }

  submit() {
    if (!this.title?.trim()) return;

    const data: any = {
      title: this.title.trim(),
      notes: this.notes?.trim() || undefined,
      page_url: this.pageUrl,
      owner: this.owner || undefined
    };

    if (this.step === 'bug') {
      data.subcategory_id = undefined;
      data.submitted_by = this.owner || undefined;
    } else if (this.step === 'note') {
      data.meeting_date = this.meetingDate ? this.meetingDate.toISOString().split('T')[0] : undefined;
    } else if (this.step === 'action') {
      data.parent_id = this.parentId || undefined;
      data.due_date = this.dueDate ? this.dueDate.toISOString().split('T')[0] : undefined;
    }

    this.feedbackSvc.create(data).subscribe({
      next: (result) => {
        if (this.step === 'note') {
          this.msg.add({ severity: 'success', summary: 'Note saved \u2713' });
          this.submitted.emit({ id: result.id, flow: 'note' });
          this.reset();
          this.visible = false;
          this.visibleChange.emit(false);
          window.open('/meeting/' + result.id, '_blank');
          this.cdr.detectChanges();
        } else {
          this.msg.add({ severity: 'success', summary: 'Logged \u2713' });
          this.submitted.emit({ id: result.id, flow: this.step });
          this.reset();
          this.visible = false;
          this.visibleChange.emit(false);
          this.cdr.detectChanges();
        }
      },
      error: () => {
        this.msg.add({ severity: 'error', summary: 'Failed to save' });
      }
    });
  }

  onClose() {
    if (this.step === 'post-note') {
      this.submitted.emit({ id: this.lastCreatedId, flow: 'note' });
    }
    this.reset();
    this.visible = false;
    this.visibleChange.emit(false);
  }

  private reset() {
    this.step = 'type';
    this.title = '';
    this.notes = '';
    this.owner = '';
    this.meetingDate = new Date();
    this.dueDate = null;
    this.actionType = 'action';
    this.lastCreatedId = '';
    this.parentId = null;
    this.parentTitle = '';
    this.initialFlow = null;
  }
}
