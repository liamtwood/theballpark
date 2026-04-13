import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { CalendarModule } from 'primeng/calendar';
import { CheckboxModule } from 'primeng/checkbox';
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
        <button class="bp-mtg-open-btn" (click)="openNewTab()">
          Open in new tab
        </button>
      </div>

      <!-- BODY -->
      <div class="bp-mtg-body">
        <!-- LEFT COLUMN -->
        <div class="bp-mtg-left">
          <input class="bp-mtg-title" [(ngModel)]="entry.title"
            (blur)="saveField('title', entry.title)" placeholder="Meeting title"/>
          <div class="bp-mtg-date-row">
            <p-calendar [(ngModel)]="meetingDateObj" [showIcon]="true" dateFormat="DD dd M yy"
              (onSelect)="onDateChange()" inputStyleClass="bp-mtg-date-input"
              styleClass="bp-mtg-date-cal"></p-calendar>
          </div>

          <!-- AGENDA -->
          <div class="bp-mtg-section">
            <div class="bp-mtg-section-label">AGENDA</div>
            <div class="bp-mtg-agenda-list">
              <div *ngFor="let item of agenda; let i = index; trackBy: trackIdx" class="bp-mtg-agenda-item">
                <span class="bp-mtg-agenda-num">{{ i + 1 }}.</span>
                <input class="bp-mtg-agenda-input" [(ngModel)]="agenda[i]"
                  (blur)="saveAgenda()" placeholder="Agenda item..."/>
                <button class="bp-mtg-remove" (click)="removeAgenda(i)">
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
          <!-- ACTION ITEMS -->
          <div class="bp-mtg-section">
            <div class="bp-mtg-section-label">ACTION ITEMS</div>
            <div *ngFor="let c of actions" class="bp-mtg-row" [class.bp-mtg-row--done]="c.completed">
              <p-checkbox [(ngModel)]="c.completed" [binary]="true"
                (onChange)="toggleComplete(c)" styleClass="bp-mtg-check"></p-checkbox>
              <span class="bp-mtg-row-title">{{ c.title }}</span>
              <span class="bp-mtg-owner" *ngIf="c.owner">{{ getInitials(c.owner) }}</span>
              <button class="bp-mtg-remove" (click)="removeChild(c)">
                <lucide-icon name="x" [size]="12"></lucide-icon>
              </button>
            </div>
            <div *ngIf="!actions.length" class="bp-mtg-empty">No action items yet.</div>
            <div class="bp-mtg-inline-add">
              <input class="bp-mtg-inline-input" [(ngModel)]="newAction"
                (keydown.enter)="addChild('action')" placeholder="Title..."/>
              <div class="bp-mtg-owner-row">
                <button *ngFor="let m of team" class="bp-mtg-owner-btn"
                  [class.active]="newActionOwner === m.name" (click)="newActionOwner = m.name">
                  {{ m.initials }}
                </button>
              </div>
              <button class="bp-mtg-add-text" (click)="addChild('action')" [disabled]="!newAction?.trim()">Add</button>
            </div>
          </div>

          <!-- BUGS -->
          <div class="bp-mtg-section">
            <div class="bp-mtg-section-label">BUGS</div>
            <div *ngFor="let c of bugs" class="bp-mtg-row" [class.bp-mtg-row--done]="c.completed">
              <lucide-icon name="bug" [size]="14" class="bp-mtg-type-icon"></lucide-icon>
              <span class="bp-mtg-row-title">{{ c.title }}</span>
              <span class="bp-mtg-owner" *ngIf="c.owner">{{ getInitials(c.owner) }}</span>
              <button class="bp-mtg-remove" (click)="removeChild(c)">
                <lucide-icon name="x" [size]="12"></lucide-icon>
              </button>
            </div>
            <div *ngIf="!bugs.length" class="bp-mtg-empty">No bugs logged.</div>
            <div class="bp-mtg-inline-add">
              <input class="bp-mtg-inline-input" [(ngModel)]="newBug"
                (keydown.enter)="addChild('bug')" placeholder="Title..."/>
              <div class="bp-mtg-owner-row">
                <button *ngFor="let m of team" class="bp-mtg-owner-btn"
                  [class.active]="newBugOwner === m.name" (click)="newBugOwner = m.name">
                  {{ m.initials }}
                </button>
              </div>
              <button class="bp-mtg-add-text" (click)="addChild('bug')" [disabled]="!newBug?.trim()">Add</button>
            </div>
          </div>

          <!-- ENHANCEMENTS -->
          <div class="bp-mtg-section">
            <div class="bp-mtg-section-label">ENHANCEMENTS</div>
            <div *ngFor="let c of enhancements" class="bp-mtg-row" [class.bp-mtg-row--done]="c.completed">
              <lucide-icon name="lightbulb" [size]="14" class="bp-mtg-type-icon"></lucide-icon>
              <span class="bp-mtg-row-title">{{ c.title }}</span>
              <span class="bp-mtg-owner" *ngIf="c.owner">{{ getInitials(c.owner) }}</span>
              <button class="bp-mtg-remove" (click)="removeChild(c)">
                <lucide-icon name="x" [size]="12"></lucide-icon>
              </button>
            </div>
            <div *ngIf="!enhancements.length" class="bp-mtg-empty">No enhancements logged.</div>
            <div class="bp-mtg-inline-add">
              <input class="bp-mtg-inline-input" [(ngModel)]="newEnhancement"
                (keydown.enter)="addChild('enhancement')" placeholder="Title..."/>
              <div class="bp-mtg-owner-row">
                <button *ngFor="let m of team" class="bp-mtg-owner-btn"
                  [class.active]="newEnhancementOwner === m.name" (click)="newEnhancementOwner = m.name">
                  {{ m.initials }}
                </button>
              </div>
              <button class="bp-mtg-add-text" (click)="addChild('enhancement')" [disabled]="!newEnhancement?.trim()">Add</button>
            </div>
          </div>
        </div>
      </div>
    </ng-container>
  `,
  styles: [`
    /* Header */
    .bp-mtg-header {
      display: flex; align-items: center; gap: 16px;
      padding: 10px 24px; background: var(--color-surface);
      border-bottom: 0.5px solid var(--color-border);
    }
    .bp-mtg-back {
      display: flex; align-items: center; gap: 4px;
      font-size: 13px; font-weight: 500; color: var(--color-text-muted);
      border: none; background: transparent; cursor: pointer;
      font-family: var(--font-body); transition: color 0.15s;
    }
    .bp-mtg-back:hover { color: var(--theme-accent); }
    .bp-mtg-header-title {
      flex: 1; text-align: center; font-size: 13px;
      color: var(--color-text-muted); font-weight: 500;
    }
    .bp-mtg-open-btn {
      font-size: 12px; font-weight: 500; color: var(--theme-accent);
      border: 1px solid var(--theme-accent); background: transparent;
      padding: 5px 14px; border-radius: 6px; cursor: pointer;
      font-family: var(--font-body); transition: all 0.15s;
    }
    .bp-mtg-open-btn:hover { background: var(--theme-accent); color: #fff; }

    /* Body grid */
    .bp-mtg-body {
      display: grid; grid-template-columns: 40% 60%;
      height: calc(100vh - 97px); overflow: hidden;
    }
    .bp-mtg-left {
      padding: 28px 32px; overflow-y: auto;
      display: flex; flex-direction: column;
      border-right: 0.5px solid var(--color-border);
      background: var(--color-surface);
    }
    .bp-mtg-right {
      padding: 28px 32px; overflow-y: auto;
      background: var(--color-surface);
    }

    /* Title */
    .bp-mtg-title {
      font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 600;
      color: var(--color-text-primary); border: none; outline: none;
      background: transparent; width: 100%; padding: 0; margin-bottom: 8px;
    }
    .bp-mtg-title::placeholder { color: var(--color-text-muted); }

    /* Date */
    .bp-mtg-date-row { margin-bottom: 24px; }
    :host ::ng-deep .bp-mtg-date-cal { max-width: 220px; }
    :host ::ng-deep .bp-mtg-date-input {
      font-size: 12px !important; color: var(--color-text-muted) !important;
      border: none !important; background: transparent !important;
      padding: 0 !important; cursor: pointer;
    }

    /* Section labels */
    .bp-mtg-section { margin-bottom: 24px; padding-top: 20px; }
    .bp-mtg-section:first-child { padding-top: 0; }
    .bp-mtg-notes-section { flex: 1; display: flex; flex-direction: column; }
    .bp-mtg-section-label {
      font-size: 12px; font-weight: 600; letter-spacing: 0.06em;
      color: var(--color-text-muted); text-transform: uppercase;
      margin-bottom: 10px; padding-bottom: 8px;
      border-bottom: 0.5px solid var(--color-border);
    }

    /* Agenda */
    .bp-mtg-agenda-list { display: flex; flex-direction: column; gap: 2px; margin-bottom: 6px; }
    .bp-mtg-agenda-item {
      display: flex; align-items: center; gap: 8px;
      padding: 5px 0; border-bottom: 0.5px solid var(--color-border);
    }
    .bp-mtg-agenda-num {
      font-size: 13px; font-weight: 600; color: var(--theme-accent);
      min-width: 20px;
    }
    .bp-mtg-agenda-input {
      flex: 1; border: none; outline: none; background: transparent;
      font-size: 14px; color: var(--color-text-primary);
      font-family: var(--font-body); padding: 3px 0;
    }
    .bp-mtg-agenda-input::placeholder { color: var(--color-text-muted); }

    /* Remove button */
    .bp-mtg-remove {
      width: 20px; height: 20px; border: none; background: transparent;
      cursor: pointer; color: var(--color-text-muted); display: flex;
      align-items: center; justify-content: center;
      opacity: 0; transition: opacity 0.15s; border-radius: 50%; flex-shrink: 0;
    }
    .bp-mtg-agenda-item:hover .bp-mtg-remove,
    .bp-mtg-row:hover .bp-mtg-remove { opacity: 1; }
    .bp-mtg-remove:hover { color: var(--theme-accent); background: var(--theme-bg); }

    /* Inline add */
    .bp-mtg-inline-add {
      display: flex; align-items: center; gap: 8px; padding: 4px 0;
    }
    .bp-mtg-add-circle {
      width: 24px; height: 24px; border-radius: 50%;
      border: 1px solid var(--color-border); background: transparent;
      cursor: pointer; color: var(--color-text-muted);
      display: flex; align-items: center; justify-content: center;
      transition: all 0.15s; flex-shrink: 0;
    }
    .bp-mtg-add-circle:hover:not(:disabled) { border-color: var(--theme-accent); color: var(--theme-accent); }
    .bp-mtg-add-circle:disabled { opacity: 0.3; cursor: not-allowed; }

    /* Notes */
    .bp-mtg-notes {
      width: 100%; flex: 1; min-height: 120px; border: none !important; outline: none;
      background: var(--theme-bg) !important; border-radius: 10px; padding: 14px 16px;
      font-size: 14px; line-height: 1.7; color: var(--color-text-primary);
      font-family: var(--font-body); resize: none;
    }
    .bp-mtg-notes::placeholder { color: var(--color-text-muted); }

    /* Right column rows */
    .bp-mtg-row {
      display: flex; align-items: flex-start; gap: 8px;
      padding: 8px 0; border-bottom: 0.5px solid var(--color-border);
    }
    .bp-mtg-row--done { opacity: 0.5; }
    .bp-mtg-row--done .bp-mtg-row-title { text-decoration: line-through; }
    .bp-mtg-row-title {
      flex: 1; font-size: 13px; color: var(--color-text-primary);
      min-width: 0; word-wrap: break-word;
    }
    .bp-mtg-type-icon { color: var(--theme-accent); flex-shrink: 0; }
    .bp-mtg-owner {
      width: 28px; height: 28px; border-radius: 50%; font-size: 10px; font-weight: 600;
      background: var(--theme-accent); color: #fff; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    :host ::ng-deep .bp-mtg-check .p-checkbox-box {
      width: 18px !important; height: 18px !important; border-radius: 4px !important;
    }
    .bp-mtg-empty { font-size: 12px; color: var(--color-text-muted); padding: 4px 0; }

    /* Inline add for right column */
    .bp-mtg-inline-input {
      flex: 1; border: none; outline: none; background: transparent;
      font-size: 13px; color: var(--color-text-primary);
      font-family: var(--font-body); padding: 4px 0; min-width: 0;
    }
    .bp-mtg-inline-input::placeholder { color: var(--color-text-muted); }
    .bp-mtg-owner-row { display: flex; gap: 4px; flex-shrink: 0; }
    .bp-mtg-owner-btn {
      width: 28px; height: 28px; border-radius: 50%; font-size: 9px; font-weight: 600;
      border: 1.5px solid var(--color-border); background: var(--color-surface);
      color: var(--color-text-muted); cursor: pointer; transition: all 0.15s;
      display: flex; align-items: center; justify-content: center;
      font-family: var(--font-body);
    }
    .bp-mtg-owner-btn:hover { border-color: var(--theme-accent); }
    .bp-mtg-owner-btn.active {
      border-color: var(--theme-accent); background: var(--theme-accent); color: #fff;
    }
    .bp-mtg-add-text {
      font-size: 12px; font-weight: 500; color: var(--theme-accent);
      border: none; background: transparent; cursor: pointer;
      font-family: var(--font-body); flex-shrink: 0; padding: 4px 8px;
    }
    .bp-mtg-add-text:disabled { opacity: 0.3; cursor: not-allowed; }

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

  // New item inputs
  newAgendaItem = '';
  newAction = ''; newActionOwner = '';
  newBug = ''; newBugOwner = '';
  newEnhancement = ''; newEnhancementOwner = '';

  notesChanged$ = new Subject<string>();

  get actions(): FeedbackEntry[] {
    return this.children.filter(c => !this.isBug(c) && !this.isEnhancement(c));
  }
  get bugs(): FeedbackEntry[] {
    return this.children.filter(c => this.isBug(c));
  }
  get enhancements(): FeedbackEntry[] {
    return this.children.filter(c => this.isEnhancement(c));
  }

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

  // Title/date
  saveField(field: string, value: any) {
    if (this.entry) this.feedbackSvc.patch(this.entry.id, { [field]: value }).subscribe();
  }

  onDateChange() {
    if (this.entry && this.meetingDateObj) {
      const iso = this.meetingDateObj.toISOString().split('T')[0];
      this.feedbackSvc.patch(this.entry.id, { meeting_date: iso }).subscribe();
    }
  }

  // Agenda
  addAgenda() {
    if (!this.newAgendaItem?.trim()) return;
    this.agenda.push(this.newAgendaItem.trim());
    this.newAgendaItem = '';
    this.saveAgenda();
  }
  removeAgenda(i: number) { this.agenda.splice(i, 1); this.saveAgenda(); }
  saveAgenda() {
    if (this.entry) this.feedbackSvc.patch(this.entry.id, { agenda: this.agenda }).subscribe();
  }
  trackIdx(i: number) { return i; }

  // Children
  addChild(type: 'action' | 'bug' | 'enhancement') {
    if (!this.entry) return;
    let title = '', owner = '';
    if (type === 'action') { title = this.newAction; owner = this.newActionOwner; }
    else if (type === 'bug') { title = this.newBug; owner = this.newBugOwner; }
    else { title = this.newEnhancement; owner = this.newEnhancementOwner; }
    if (!title?.trim()) return;

    const prefix = type === 'bug' ? '[Bug] ' : type === 'enhancement' ? '[Enhancement] ' : '';
    this.feedbackSvc.create({
      title: prefix + title.trim(),
      parent_id: this.entry.id,
      owner: owner || undefined
    } as any).subscribe({
      next: () => {
        if (type === 'action') { this.newAction = ''; this.newActionOwner = ''; }
        else if (type === 'bug') { this.newBug = ''; this.newBugOwner = ''; }
        else { this.newEnhancement = ''; this.newEnhancementOwner = ''; }
        this.loadChildren();
        this.cdr.detectChanges();
      },
      error: (err: any) => { console.error('Failed to add child:', err); }
    });
  }

  toggleComplete(child: FeedbackEntry) {
    this.feedbackSvc.patch(child.id, { completed: child.completed }).subscribe();
  }

  removeChild(child: FeedbackEntry) {
    this.feedbackSvc.remove(child.id).subscribe(() => {
      this.children = this.children.filter(c => c.id !== child.id);
      this.cdr.detectChanges();
    });
  }

  openNewTab() {
    if (this.entry) window.open('/meeting/' + this.entry.id, '_blank');
  }

  // Helpers
  getInitials(name: string): string {
    const m = this.team.find(t => t.name === name);
    return m?.initials || name.substring(0, 2).toUpperCase();
  }

  private isBug(c: FeedbackEntry): boolean {
    return (c.title || '').toLowerCase().startsWith('[bug]');
  }
  private isEnhancement(c: FeedbackEntry): boolean {
    return (c.title || '').toLowerCase().startsWith('[enhancement]');
  }
}
