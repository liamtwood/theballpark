import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { CalendarModule } from 'primeng/calendar';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { LucideAngularModule } from 'lucide-angular';
import { Subject, debounceTime } from 'rxjs';
import { FeedbackService, FeedbackEntry, TEAM_MEMBERS, TeamMember } from '../../core/services/feedback.service';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-meeting-detail',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    InputTextModule, InputTextareaModule, CalendarModule, CheckboxModule,
    DialogModule, TooltipModule,
    LucideAngularModule, LoadingSpinnerComponent
  ],
  template: `
    <app-loading *ngIf="loading"></app-loading>

    <ng-container *ngIf="!loading && entry">
      <!-- HEADER BAR -->
      <div class="bp-mtg-header">
        <button class="bp-mtg-back" routerLink="/ballpark-settings/feedback">
          <lucide-icon name="arrow-left" [size]="14"></lucide-icon> Back
        </button>
        <span class="bp-mtg-header-title">{{ entry.title }}</span>
        <button class="bp-mtg-open-btn" (click)="openNewTab()">Open in new tab</button>
      </div>

      <!-- BODY -->
      <div class="bp-mtg-body">
        <!-- LEFT COLUMN -->
        <div class="bp-mtg-left">
          <input class="bp-mtg-title" [(ngModel)]="entry.title"
            (blur)="saveField('title', entry.title)" placeholder="Meeting title"/>

          <!-- Type + Date + Time row -->
          <div class="bp-mtg-meta-row">
            <div class="bp-mtg-type-pills">
              <button *ngFor="let t of meetingTypes" class="bp-mtg-type-pill"
                [class.active]="entry.type === t" (click)="entry.type = t; saveField('type', t)">
                {{ t }}
              </button>
            </div>
            <p-calendar [(ngModel)]="meetingDateObj" [showIcon]="true" dateFormat="dd M yy"
              (onSelect)="onDateChange()" inputStyleClass="bp-mtg-date-input"
              styleClass="bp-mtg-date-cal"></p-calendar>
            <input class="bp-mtg-time-input" [(ngModel)]="entry.meeting_time"
              (blur)="saveField('meeting_time', entry.meeting_time)"
              placeholder="Time..." type="time"/>
          </div>

          <!-- AGENDA -->
          <div class="bp-mtg-section">
            <div class="bp-mtg-section-label">AGENDA</div>
            <div class="bp-mtg-agenda-list">
              <div *ngFor="let item of agenda; let i = index; trackBy: trackIdx"
                class="bp-mtg-agenda-item" (click)="openAgendaEdit(i)">
                <div class="bp-mtg-reorder" (click)="$event.stopPropagation()">
                  <button class="bp-mtg-reorder-btn" [disabled]="i === 0" (click)="moveAgenda(i, -1)">
                    <lucide-icon name="chevron-up" [size]="10"></lucide-icon>
                  </button>
                  <button class="bp-mtg-reorder-btn" [disabled]="i === agenda.length - 1" (click)="moveAgenda(i, 1)">
                    <lucide-icon name="chevron-down" [size]="10"></lucide-icon>
                  </button>
                </div>
                <span class="bp-mtg-agenda-num">{{ i + 1 }}.</span>
                <span class="bp-mtg-agenda-text">{{ agenda[i] }}</span>
                <span class="bp-mtg-agenda-linked" *ngIf="getAgendaChild(i)">
                  <lucide-icon name="link" [size]="10"></lucide-icon>
                </span>
                <button class="bp-mtg-remove" (click)="$event.stopPropagation(); removeAgenda(i)">
                  <lucide-icon name="x" [size]="12"></lucide-icon>
                </button>
              </div>
            </div>
            <div class="bp-mtg-inline-add">
              <input class="bp-mtg-agenda-input" [(ngModel)]="newAgendaItem"
                (keydown.enter)="addAgenda()" placeholder="Add agenda item..."/>
              <button class="bp-mtg-add-circle" (click)="addAgenda()" [disabled]="!newAgendaItem?.trim()">
                <lucide-icon name="plus" [size]="14"></lucide-icon>
              </button>
            </div>
          </div>

          <!-- NOTES -->
          <div class="bp-mtg-section bp-mtg-notes-section">
            <div class="bp-mtg-section-label">NOTES</div>
            <textarea pInputTextarea class="bp-mtg-notes" [(ngModel)]="entry.notes"
              (ngModelChange)="notesChanged$.next($event)"
              placeholder="Session notes..."></textarea>
          </div>
        </div>

        <!-- RIGHT COLUMN -->
        <div class="bp-mtg-right">
          <div class="bp-mtg-section">
            <div class="bp-mtg-section-label">ITEMS</div>

            <div *ngFor="let c of children" class="bp-mtg-row" [class.bp-mtg-row--done]="c.completed"
              (click)="openEdit(c)" [pTooltip]="c.description || ''" tooltipPosition="left">
              <p-checkbox [(ngModel)]="c.completed" [binary]="true"
                (onChange)="toggleComplete(c); $event.originalEvent?.stopPropagation()" styleClass="bp-mtg-check"></p-checkbox>
              <lucide-icon [name]="getTypeIcon(c)" [size]="14" class="bp-mtg-type-icon"></lucide-icon>
              <span class="bp-mtg-row-title">{{ c.title }}</span>
              <span class="bp-mtg-owner" *ngIf="c.owner">{{ getInitials(c.owner) }}</span>
            </div>

            <div *ngIf="!children.length" class="bp-mtg-empty">No items yet.</div>

            <!-- Inline add -->
            <div class="bp-mtg-inline-add">
              <div class="bp-mtg-type-selector">
                <button *ngFor="let t of childTypes" class="bp-mtg-type-btn"
                  [class.active]="newItemType === t.value" (click)="newItemType = t.value"
                  [title]="t.label">
                  <lucide-icon [name]="t.icon" [size]="12"></lucide-icon>
                </button>
              </div>
              <input class="bp-mtg-inline-input" [(ngModel)]="newItemTitle"
                (keydown.enter)="addItem()" placeholder="Title..."/>
              <div class="bp-mtg-owner-row">
                <button *ngFor="let m of team" class="bp-mtg-owner-btn"
                  [class.active]="newItemOwner === m.name" (click)="newItemOwner = m.name">{{ m.initials }}</button>
              </div>
              <button class="bp-mtg-add-text" (click)="addItem()" [disabled]="!newItemTitle?.trim()">Add</button>
            </div>
          </div>
        </div>
      </div>
    </ng-container>

    <!-- EDIT DIALOG -->
    <p-dialog [(visible)]="showEditDialog" [modal]="true" [closable]="true"
      [style]="{width:'520px'}" styleClass="bp-modal" (onHide)="cancelEdit()">
      <ng-template pTemplate="header">
        <span class="p-dialog-title">{{ editEntry?.type || 'Action Item' }}</span>
      </ng-template>

      <div class="bp-edit-step" *ngIf="editEntry">
        <div class="bp-fb-context">
          <lucide-icon [name]="getTypeIcon(editEntry)" [size]="14"></lucide-icon>
          <span style="font-weight:500;">{{ editEntry.type || 'Action Item' }}</span>
        </div>

        <div class="mb-4">
          <label class="bp-field-label">Type</label>
          <div class="bp-fb-sub-row">
            <button *ngFor="let t of childTypes" class="bp-fb-sub-pill"
              [class.active]="editType === t.value" (click)="editType = t.value">{{ t.label }}</button>
          </div>
        </div>

        <div class="mb-4">
          <label class="bp-field-label">Title *</label>
          <input pInputText [(ngModel)]="editTitle" class="w-full bp-input-edit" placeholder="What needs to be done?"/>
        </div>

        <div class="mb-4">
          <label class="bp-field-label">Description</label>
          <textarea pInputTextarea [(ngModel)]="editDescription" class="w-full bp-input-edit" [rows]="3"
            style="resize:none;" placeholder="Detail..."></textarea>
        </div>

        <div class="bp-field-grid-2">
          <div>
            <label class="bp-field-label">Owner</label>
            <div class="bp-owner-row">
              <button *ngFor="let m of team" class="bp-owner-circle"
                [class.active]="editOwner === m.name" (click)="editOwner = m.name">{{ m.initials }}</button>
            </div>
          </div>
          <div>
            <label class="bp-field-label">Due date</label>
            <p-calendar [(ngModel)]="editDueDate" [showIcon]="true" dateFormat="dd M yy"
              styleClass="w-full" inputStyleClass="bp-input-edit w-full"></p-calendar>
          </div>
        </div>
      </div>

      <ng-template pTemplate="footer">
        <div class="bp-fb-footer">
          <button class="bp-btn-delete" *ngIf="editEntry?.id" (click)="deleteFromEdit()">Delete</button>
          <span style="flex:1"></span>
          <button class="bp-btn-cancel" (click)="cancelEdit()">Cancel</button>
          <button class="bp-btn-save" [disabled]="!editTitle?.trim()" (click)="saveEdit()">Save</button>
        </div>
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    .bp-mtg-header {
      display: flex; align-items: center; gap: 16px;
      padding: 10px 24px; background: var(--color-surface);
      border-bottom: 0.5px solid var(--color-border);
    }
    .bp-mtg-back {
      display: flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 500;
      color: var(--color-text-muted); border: none; background: transparent;
      cursor: pointer; font-family: var(--font-body); transition: color 0.15s;
    }
    .bp-mtg-back:hover { color: var(--theme-accent); }
    .bp-mtg-header-title { flex: 1; text-align: center; font-size: 13px; color: var(--color-text-muted); font-weight: 500; }
    .bp-mtg-open-btn {
      font-size: 12px; font-weight: 500; color: var(--theme-accent);
      border: 1px solid var(--theme-accent); background: transparent;
      padding: 5px 14px; border-radius: 6px; cursor: pointer;
      font-family: var(--font-body); transition: all 0.15s;
    }
    .bp-mtg-open-btn:hover { background: var(--theme-accent); color: #fff; }

    .bp-mtg-body { display: grid; grid-template-columns: 40% 60%; height: calc(100vh - 97px); overflow: hidden; }
    .bp-mtg-left {
      padding: 28px 32px; overflow-y: auto; display: flex; flex-direction: column;
      border-right: 0.5px solid var(--color-border); background: var(--color-surface);
    }
    .bp-mtg-right { padding: 28px 32px; overflow-y: auto; background: var(--color-surface); }

    .bp-mtg-title {
      font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 600;
      color: var(--color-text-primary); border: none; outline: none;
      background: transparent; width: 100%; padding: 0; margin-bottom: 8px;
    }
    .bp-mtg-title::placeholder { color: var(--color-text-muted); }

    /* Meta row: type pills + date + time */
    .bp-mtg-meta-row { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
    .bp-mtg-type-pills { display: flex; gap: 0; border: 0.5px solid var(--color-border); border-radius: 6px; overflow: hidden; }
    .bp-mtg-type-pill {
      padding: 4px 12px; font-size: 11px; font-weight: 500; font-family: var(--font-body);
      border: none; background: var(--color-surface); color: var(--color-text-muted);
      cursor: pointer; transition: all 0.15s;
    }
    .bp-mtg-type-pill.active { background: var(--theme-bg); color: var(--theme-accent); font-weight: 600; }
    :host ::ng-deep .bp-mtg-date-cal { max-width: 180px; }
    :host ::ng-deep .bp-mtg-date-input {
      font-size: 12px !important; color: var(--color-text-muted) !important;
      border: none !important; background: transparent !important; padding: 0 !important; cursor: pointer;
    }
    .bp-mtg-time-input {
      font-size: 12px; color: var(--color-text-muted); border: none; background: transparent;
      font-family: var(--font-body); outline: none; padding: 0; width: 70px;
    }

    .bp-mtg-section { margin-bottom: 24px; padding-top: 20px; }
    .bp-mtg-section:first-child { padding-top: 0; }
    .bp-mtg-notes-section { flex: 1; display: flex; flex-direction: column; }
    .bp-mtg-section-label {
      font-size: 12px; font-weight: 600; letter-spacing: 0.06em;
      color: var(--color-text-muted); text-transform: uppercase;
      margin-bottom: 10px; padding-bottom: 8px;
      border-bottom: 0.5px solid var(--color-border);
    }

    .bp-mtg-agenda-list { display: flex; flex-direction: column; gap: 2px; margin-bottom: 6px; }
    .bp-mtg-agenda-item { display: flex; align-items: center; gap: 8px; padding: 5px 0; border-bottom: 0.5px solid var(--color-border); }
    .bp-mtg-agenda-num { font-size: 13px; font-weight: 600; color: var(--theme-accent); min-width: 20px; }
    .bp-mtg-agenda-input {
      flex: 1; border: none; outline: none; background: transparent;
      font-size: 14px; color: var(--color-text-primary); font-family: var(--font-body); padding: 3px 0;
    }
    .bp-mtg-agenda-input::placeholder { color: var(--color-text-muted); }
    .bp-mtg-agenda-text {
      flex: 1; font-size: 14px; color: var(--color-text-primary);
      font-family: var(--font-body); cursor: pointer;
    }
    .bp-mtg-agenda-item { cursor: pointer; border-radius: 6px; padding: 5px 4px; transition: background 0.1s; }
    .bp-mtg-agenda-item:hover { background: var(--theme-bg); }
    .bp-mtg-agenda-linked { color: var(--theme-accent); display: flex; align-items: center; flex-shrink: 0; }
    .bp-mtg-reorder {
      display: flex; flex-direction: column; gap: 0; flex-shrink: 0;
      opacity: 0; transition: opacity 0.15s;
    }
    .bp-mtg-agenda-item:hover .bp-mtg-reorder { opacity: 1; }
    .bp-mtg-reorder-btn {
      width: 16px; height: 12px; border: none; background: transparent;
      cursor: pointer; color: var(--color-text-muted); display: flex;
      align-items: center; justify-content: center; padding: 0;
    }
    .bp-mtg-reorder-btn:hover:not(:disabled) { color: var(--theme-accent); }
    .bp-mtg-reorder-btn:disabled { opacity: 0.2; cursor: default; }

    .bp-mtg-remove {
      width: 20px; height: 20px; border: none; background: transparent;
      cursor: pointer; color: var(--color-text-muted); display: flex;
      align-items: center; justify-content: center;
      opacity: 0; transition: opacity 0.15s; border-radius: 50%; flex-shrink: 0;
    }
    .bp-mtg-agenda-item:hover .bp-mtg-remove, .bp-mtg-row:hover .bp-mtg-remove { opacity: 1; }
    .bp-mtg-remove:hover { color: var(--theme-accent); background: var(--theme-bg); }

    .bp-mtg-inline-add { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
    .bp-mtg-add-circle {
      width: 24px; height: 24px; border-radius: 50%; border: 1px solid var(--color-border);
      background: transparent; cursor: pointer; color: var(--color-text-muted);
      display: flex; align-items: center; justify-content: center; transition: all 0.15s; flex-shrink: 0;
    }
    .bp-mtg-add-circle:hover:not(:disabled) { border-color: var(--theme-accent); color: var(--theme-accent); }
    .bp-mtg-add-circle:disabled { opacity: 0.3; cursor: not-allowed; }

    .bp-mtg-notes {
      width: 100%; flex: 1; min-height: 120px; border: none !important; outline: none;
      background: var(--theme-bg) !important; border-radius: 10px; padding: 14px 16px;
      font-size: 14px; line-height: 1.7; color: var(--color-text-primary);
      font-family: var(--font-body); resize: none;
    }
    .bp-mtg-notes::placeholder { color: var(--color-text-muted); }

    .bp-mtg-row {
      display: flex; align-items: flex-start; gap: 8px;
      padding: 8px 4px; border-bottom: 0.5px solid var(--color-border);
      cursor: pointer; border-radius: 6px; transition: background 0.1s;
    }
    .bp-mtg-row:hover { background: var(--theme-bg); }
    .bp-mtg-row--done { opacity: 0.5; }
    .bp-mtg-row--done .bp-mtg-row-title { text-decoration: line-through; }
    .bp-mtg-row-title { flex: 1; font-size: 13px; color: var(--color-text-primary); min-width: 0; }
    .bp-mtg-type-icon { color: var(--theme-accent); flex-shrink: 0; margin-top: 2px; }
    .bp-mtg-owner {
      width: 28px; height: 28px; border-radius: 50%; font-size: 10px; font-weight: 600;
      background: var(--theme-accent); color: #fff; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    :host ::ng-deep .bp-mtg-check .p-checkbox-box { width: 18px !important; height: 18px !important; border-radius: 4px !important; }
    .bp-mtg-empty { font-size: 12px; color: var(--color-text-muted); padding: 4px 0; }

    .bp-mtg-inline-input {
      flex: 1; border: none; outline: none; background: transparent;
      font-size: 13px; color: var(--color-text-primary); font-family: var(--font-body); padding: 4px 0; min-width: 0;
    }
    .bp-mtg-inline-input::placeholder { color: var(--color-text-muted); }
    .bp-mtg-owner-row { display: flex; gap: 4px; flex-shrink: 0; }
    .bp-mtg-owner-btn {
      width: 28px; height: 28px; border-radius: 50%; font-size: 9px; font-weight: 600;
      border: 1.5px solid var(--color-border); background: var(--color-surface);
      color: var(--color-text-muted); cursor: pointer; transition: all 0.15s;
      display: flex; align-items: center; justify-content: center; font-family: var(--font-body);
    }
    .bp-mtg-owner-btn:hover { border-color: var(--theme-accent); }
    .bp-mtg-owner-btn.active { border-color: var(--theme-accent); background: var(--theme-accent); color: #fff; }
    .bp-mtg-add-text {
      font-size: 12px; font-weight: 500; color: var(--theme-accent);
      border: none; background: transparent; cursor: pointer;
      font-family: var(--font-body); flex-shrink: 0; padding: 4px 8px;
    }
    .bp-mtg-add-text:disabled { opacity: 0.3; cursor: not-allowed; }
    .bp-mtg-type-selector { display: flex; gap: 2px; flex-shrink: 0; }
    .bp-mtg-type-btn {
      width: 24px; height: 24px; border-radius: 4px; border: 1px solid var(--color-border);
      background: var(--color-surface); color: var(--color-text-muted);
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: all 0.15s;
    }
    .bp-mtg-type-btn:hover { border-color: var(--theme-accent); color: var(--theme-accent); }
    .bp-mtg-type-btn.active { border-color: var(--theme-accent); background: var(--theme-accent); color: #fff; }

    /* Edit dialog */
    .bp-edit-step { padding: 8px 0; }
    .bp-fb-context { font-size: 12px; color: var(--color-text-muted); margin-bottom: 16px; display: flex; align-items: center; gap: 4px; }
    .bp-fb-sub-row { display: flex; flex-wrap: wrap; gap: 8px; }
    .bp-fb-sub-pill {
      padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 500;
      border: 1px solid var(--color-border); background: var(--color-surface);
      color: var(--color-text-secondary); cursor: pointer; transition: all 0.15s; font-family: var(--font-body);
    }
    .bp-fb-sub-pill:hover { border-color: var(--theme-accent); color: var(--theme-accent); }
    .bp-fb-sub-pill.active { border-color: var(--theme-accent); background: var(--theme-accent); color: var(--color-surface); }
    .bp-owner-row { display: flex; gap: 8px; margin-top: 4px; }
    .bp-owner-circle {
      width: 36px; height: 36px; border-radius: 50%; font-size: 11px; font-weight: 600;
      border: 2px solid var(--color-border); background: var(--color-surface);
      color: var(--color-text-secondary); cursor: pointer; transition: all 0.15s;
      display: flex; align-items: center; justify-content: center; font-family: var(--font-body);
    }
    .bp-owner-circle:hover { border-color: var(--theme-accent); }
    .bp-owner-circle.active { border-color: var(--theme-accent); background: var(--theme-accent); color: #fff; }
    .bp-fb-footer { display: flex; align-items: center; gap: 8px; }
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
    .bp-btn-delete {
      padding: 8px 16px; border-radius: 6px; font-size: 12px; font-weight: 500;
      border: 1px solid var(--color-border); background: transparent;
      color: var(--color-text-muted); cursor: pointer; font-family: var(--font-body);
    }
    .bp-btn-delete:hover { color: var(--color-text-primary); border-color: var(--color-text-muted); }

    @media (max-width: 768px) {
      .bp-mtg-body { grid-template-columns: 1fr; }
      .bp-mtg-left { border-right: none; border-bottom: 0.5px solid var(--color-border); }
    }
  `]
})
export class MeetingDetailComponent implements OnInit {
  loading = true;
  entry: FeedbackEntry | null = null;
  children: FeedbackEntry[] = [];
  agenda: string[] = [];
  meetingDateObj: Date = new Date();
  team: TeamMember[] = TEAM_MEMBERS;
  meetingTypes = ['Notes', 'Meeting', 'Call'];

  newAgendaItem = '';
  newItemTitle = '';
  newItemOwner = '';
  newItemType = 'action';

  // Edit dialog
  showEditDialog = false;
  editEntry: FeedbackEntry | null = null;
  editTitle = '';
  editDescription = '';
  editOwner = '';
  editType = 'action';
  editDueDate: Date | null = null;
  childTypes = [
    { label: 'Action', value: 'action', icon: 'check-square' },
    { label: 'Bug', value: 'bug', icon: 'bug' },
    { label: 'Enhancement', value: 'enhancement', icon: 'lightbulb' },
    { label: 'Question', value: 'question', icon: 'circle-help' },
    { label: 'Agenda', value: 'agenda', icon: 'list' }
  ];

  notesChanged$ = new Subject<string>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private feedbackSvc: FeedbackService,
    private cdr: ChangeDetectorRef
  ) {
    this.notesChanged$.pipe(debounceTime(1000)).subscribe(notes => {
      if (this.entry) this.feedbackSvc.patch(this.entry.id, { notes }).subscribe();
    });
  }

  ngOnInit() {
    const id = this.route.snapshot.params['id'];
    const load$ = id === 'today' ? this.feedbackSvc.getToday() : this.feedbackSvc.getById(id);
    load$.subscribe({
      next: (entry) => {
        this.entry = entry;
        this.agenda = entry?.agenda || [];
        this.meetingDateObj = entry?.meeting_date ? new Date(entry.meeting_date) : new Date();
        this.loading = false;
        this.loadChildren();
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  loadChildren() {
    if (!this.entry) return;
    this.feedbackSvc.getChildren(this.entry.id).subscribe({
      next: (children) => { this.children = children || []; this.cdr.detectChanges(); }
    });
  }

  saveField(field: string, value: any) {
    if (this.entry) this.feedbackSvc.patch(this.entry.id, { [field]: value }).subscribe();
  }

  onDateChange() {
    if (this.entry && this.meetingDateObj) {
      this.feedbackSvc.patch(this.entry.id, { meeting_date: this.meetingDateObj.toISOString().split('T')[0] }).subscribe();
    }
  }

  addAgenda() {
    if (!this.newAgendaItem?.trim()) return;
    this.agenda.push(this.newAgendaItem.trim());
    this.newAgendaItem = '';
    this.saveAgenda();
  }
  removeAgenda(i: number) { this.agenda.splice(i, 1); this.saveAgenda(); }

  openAgendaEdit(i: number) {
    const text = this.agenda[i];
    const existing = this.children.find(c => c.type === 'agenda' && c.title === text);
    if (existing) {
      this.openEdit(existing);
    } else {
      this.editEntry = { id: '', title: text, type: 'agenda', created_at: '' } as FeedbackEntry;
      this.editTitle = text;
      this.editDescription = '';
      this.editOwner = '';
      this.editType = 'agenda';
      this.editDueDate = null;
      this.showEditDialog = true;
      this.cdr.detectChanges();
    }
  }

  getAgendaChild(i: number): FeedbackEntry | null {
    const text = this.agenda[i];
    return this.children.find(c => c.type === 'agenda' && c.title === text) || null;
  }
  moveAgenda(i: number, dir: number) {
    const j = i + dir;
    if (j < 0 || j >= this.agenda.length) return;
    [this.agenda[i], this.agenda[j]] = [this.agenda[j], this.agenda[i]];
    this.agenda = [...this.agenda];
    this.saveAgenda();
  }
  saveAgenda() { if (this.entry) this.feedbackSvc.patch(this.entry.id, { agenda: this.agenda }).subscribe(); }
  trackIdx(i: number) { return i; }

  addItem() {
    if (!this.entry || !this.newItemTitle?.trim()) return;
    this.feedbackSvc.create({
      title: this.newItemTitle.trim(),
      parent_id: this.entry.id,
      owner: this.newItemOwner || undefined,
      type: this.newItemType,
    } as any).subscribe({
      next: () => {
        this.newItemTitle = '';
        this.newItemOwner = '';
        this.loadChildren();
        this.cdr.detectChanges();
      },
      error: (err: any) => { console.error('Failed to add:', err); }
    });
  }

  // Edit dialog
  openEdit(child: FeedbackEntry) {
    this.editEntry = child;
    this.editTitle = child.title;
    this.editDescription = child.description || child.notes || '';
    this.editOwner = child.owner || '';
    this.editType = child.type || 'action';
    this.editDueDate = child.due_date ? new Date(child.due_date) : null;
    this.showEditDialog = true;
    this.cdr.detectChanges();
  }

  saveEdit() {
    if (!this.editEntry || !this.editTitle?.trim()) return;
    const data: any = {
      title: this.editTitle.trim(),
      description: this.editDescription?.trim() || null,
      owner: this.editOwner || null,
      due_date: this.editDueDate ? this.editDueDate.toISOString().split('T')[0] : null,
      type: this.editType,
    };
    if (this.editEntry.id) {
      this.feedbackSvc.patch(this.editEntry.id, data).subscribe({
        next: () => { this.showEditDialog = false; this.loadChildren(); }
      });
    } else {
      // Create new child
      data.parent_id = this.entry!.id;
      this.feedbackSvc.create(data).subscribe({
        next: () => { this.showEditDialog = false; this.loadChildren(); }
      });
    }
  }

  cancelEdit() { this.showEditDialog = false; }

  deleteFromEdit() {
    if (!this.editEntry?.id) { this.showEditDialog = false; return; }
    this.feedbackSvc.remove(this.editEntry.id).subscribe(() => {
      this.showEditDialog = false;
      this.children = this.children.filter(c => c.id !== this.editEntry!.id);
      this.cdr.detectChanges();
    });
  }

  toggleComplete(child: FeedbackEntry) {
    this.feedbackSvc.patch(child.id, { completed: child.completed }).subscribe();
  }

  openNewTab() { if (this.entry) window.open('/meeting/' + this.entry.id, '_blank'); }

  getInitials(name: string): string {
    const m = this.team.find(t => t.name === name);
    return m?.initials || name.substring(0, 2).toUpperCase();
  }

  getTypeIcon(entry: FeedbackEntry): string {
    switch (entry.type) {
      case 'bug': return 'bug';
      case 'enhancement': return 'lightbulb';
      case 'question': return 'circle-help';
      case 'agenda': return 'list';
      default: return 'check-square';
    }
  }
}
