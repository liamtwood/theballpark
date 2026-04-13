import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ButtonModule } from 'primeng/button';
import { LucideAngularModule } from 'lucide-angular';
import { Subject, debounceTime } from 'rxjs';
import { FeedbackService, FeedbackEntry, TEAM_MEMBERS } from '../../core/services/feedback.service';
import { FeedbackDialogComponent } from '../../shared/components/feedback-dialog/feedback-dialog.component';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-meeting-detail',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    InputTextModule, InputTextareaModule, ButtonModule, LucideAngularModule,
    FeedbackDialogComponent, LoadingSpinnerComponent
  ],
  template: `
    <app-loading *ngIf="loading"></app-loading>

    <div class="bp-meeting" *ngIf="!loading && entry">
      <!-- LEFT COLUMN -->
      <div class="bp-meeting-left">
        <!-- Title -->
        <input class="bp-meeting-title" [(ngModel)]="entry.title"
          (blur)="saveField('title', entry.title)" placeholder="Meeting title"/>
        <div class="bp-meeting-date">{{ formatDate(entry.meeting_date || entry.created_at) }}</div>

        <!-- AGENDA -->
        <div class="bp-meeting-section">
          <div class="bp-meeting-section-label">AGENDA</div>
          <div class="bp-agenda-list">
            <div *ngFor="let item of agenda; let i = index; trackBy: trackByIndex" class="bp-agenda-item">
              <span class="bp-agenda-num">{{ i + 1 }}.</span>
              <input class="bp-agenda-input" [(ngModel)]="agenda[i]"
                (blur)="saveAgenda()" placeholder="Agenda item..."/>
              <button class="bp-agenda-remove" (click)="removeAgenda(i)" title="Remove">
                <lucide-icon name="x" [size]="12"></lucide-icon>
              </button>
            </div>
          </div>
          <div class="bp-agenda-add">
            <input class="bp-agenda-input" [(ngModel)]="newAgendaItem"
              (keydown.enter)="addAgenda()" placeholder="Add agenda item..."/>
            <button class="bp-agenda-add-btn" (click)="addAgenda()" [disabled]="!newAgendaItem?.trim()">
              <lucide-icon name="plus" [size]="14"></lucide-icon>
            </button>
          </div>
        </div>

        <!-- NOTES -->
        <div class="bp-meeting-section bp-meeting-notes-section">
          <div class="bp-meeting-section-label">NOTES</div>
          <textarea class="bp-meeting-notes" [(ngModel)]="entry.notes"
            (ngModelChange)="notesChanged$.next($event)"
            placeholder="Session notes..."></textarea>
        </div>
      </div>

      <!-- RIGHT COLUMN -->
      <div class="bp-meeting-right">
        <!-- Action Items -->
        <div class="bp-meeting-section">
          <div class="bp-meeting-section-label">ACTION ITEMS</div>
          <div *ngFor="let child of actionItems" class="bp-action-row">
            <span class="bp-action-icon"><lucide-icon name="check-square" [size]="13"></lucide-icon></span>
            <span class="bp-action-title">{{ child.title }}</span>
            <span class="bp-action-owner" *ngIf="child.owner">{{ getInitials(child.owner) }}</span>
          </div>
          <div *ngIf="!actionItems.length" class="bp-muted-text bp-small">No action items yet.</div>
          <button class="bp-inline-add" (click)="openDialog('action')">
            <lucide-icon name="plus" [size]="12"></lucide-icon> Add action
          </button>
        </div>

        <!-- Bugs -->
        <div class="bp-meeting-section">
          <div class="bp-meeting-section-label">BUGS</div>
          <div *ngFor="let child of bugs" class="bp-action-row">
            <span class="bp-action-icon"><lucide-icon name="bug" [size]="13"></lucide-icon></span>
            <span class="bp-action-title">{{ child.title }}</span>
            <span class="bp-action-owner" *ngIf="child.owner">{{ getInitials(child.owner) }}</span>
          </div>
          <div *ngIf="!bugs.length" class="bp-muted-text bp-small">No bugs logged.</div>
          <button class="bp-inline-add" (click)="openDialog('bug')">
            <lucide-icon name="plus" [size]="12"></lucide-icon> Add bug
          </button>
        </div>

        <!-- Enhancements -->
        <div class="bp-meeting-section">
          <div class="bp-meeting-section-label">ENHANCEMENTS</div>
          <div *ngFor="let child of enhancements" class="bp-action-row">
            <span class="bp-action-icon"><lucide-icon name="lightbulb" [size]="13"></lucide-icon></span>
            <span class="bp-action-title">{{ child.title }}</span>
            <span class="bp-action-owner" *ngIf="child.owner">{{ getInitials(child.owner) }}</span>
          </div>
          <div *ngIf="!enhancements.length" class="bp-muted-text bp-small">No enhancements logged.</div>
          <button class="bp-inline-add" (click)="openDialog('action')">
            <lucide-icon name="plus" [size]="12"></lucide-icon> Add enhancement
          </button>
        </div>
      </div>
    </div>

    <!-- Add child dialog -->
    <app-feedback-dialog
      [(visible)]="showDialog"
      [initialFlow]="dialogFlow"
      [parentId]="entry?.id || ''"
      [parentTitle]="entry?.title || ''"
      (submitted)="onChildAdded()">
    </app-feedback-dialog>
  `,
  styles: [`
    .bp-meeting {
      display: grid; grid-template-columns: 1fr 380px;
      height: calc(100vh - var(--nav-height, 56px));
      overflow: hidden;
    }
    .bp-meeting-left {
      padding: 32px 40px; overflow-y: auto;
      display: flex; flex-direction: column;
    }
    .bp-meeting-right {
      padding: 32px 28px; overflow-y: auto;
      border-left: 0.5px solid var(--color-border);
      background: var(--color-surface);
    }

    .bp-meeting-title {
      font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 600;
      color: var(--color-text-primary); border: none; outline: none;
      background: transparent; width: 100%; padding: 0; margin-bottom: 4px;
    }
    .bp-meeting-title::placeholder { color: var(--color-text-muted); }
    .bp-meeting-date { font-size: 12px; color: var(--color-text-muted); margin-bottom: 28px; }

    .bp-meeting-section { margin-bottom: 28px; }
    .bp-meeting-section-label {
      font-size: 10px; font-weight: 600; letter-spacing: 0.06em;
      color: var(--color-text-muted); text-transform: uppercase;
      margin-bottom: 12px;
    }
    .bp-meeting-notes-section { flex: 1; display: flex; flex-direction: column; }

    /* Agenda */
    .bp-agenda-list { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }
    .bp-agenda-item {
      display: flex; align-items: center; gap: 8px;
      padding: 4px 0; border-bottom: 0.5px solid var(--color-border);
    }
    .bp-agenda-num { font-size: 13px; font-weight: 600; color: var(--theme-accent); min-width: 20px; }
    .bp-agenda-input {
      flex: 1; border: none; outline: none; background: transparent;
      font-size: 14px; color: var(--color-text-primary); font-family: var(--font-body);
      padding: 4px 0;
    }
    .bp-agenda-input::placeholder { color: var(--color-text-muted); }
    .bp-agenda-remove {
      width: 20px; height: 20px; border: none; background: transparent;
      cursor: pointer; color: var(--color-text-muted); display: flex;
      align-items: center; justify-content: center; opacity: 0; transition: opacity 0.15s;
      border-radius: 50%;
    }
    .bp-agenda-item:hover .bp-agenda-remove { opacity: 1; }
    .bp-agenda-remove:hover { color: var(--theme-accent); background: var(--theme-bg); }
    .bp-agenda-add {
      display: flex; align-items: center; gap: 8px; padding-left: 28px;
    }
    .bp-agenda-add-btn {
      width: 24px; height: 24px; border-radius: 50%; border: 1px solid var(--color-border);
      background: transparent; cursor: pointer; color: var(--color-text-muted);
      display: flex; align-items: center; justify-content: center; transition: all 0.15s;
    }
    .bp-agenda-add-btn:hover:not(:disabled) { border-color: var(--theme-accent); color: var(--theme-accent); }
    .bp-agenda-add-btn:disabled { opacity: 0.3; cursor: not-allowed; }

    /* Notes textarea */
    .bp-meeting-notes {
      width: 100%; flex: 1; min-height: 160px; border: none; outline: none;
      background: var(--theme-bg); border-radius: 10px; padding: 14px 16px;
      font-size: 14px; line-height: 1.7; color: var(--color-text-primary);
      font-family: var(--font-body); resize: none;
    }
    .bp-meeting-notes::placeholder { color: var(--color-text-muted); }

    /* Right column items */
    .bp-action-row {
      display: flex; align-items: center; gap: 8px; padding: 7px 0;
      border-bottom: 0.5px solid var(--color-border);
    }
    .bp-action-icon { color: var(--theme-accent); display: flex; flex-shrink: 0; }
    .bp-action-title { flex: 1; font-size: 13px; color: var(--color-text-primary); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bp-action-owner {
      width: 24px; height: 24px; border-radius: 50%; font-size: 9px; font-weight: 600;
      background: var(--theme-accent); color: #fff; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .bp-inline-add {
      display: flex; align-items: center; gap: 4px; margin-top: 8px;
      padding: 4px 0; font-size: 12px; font-weight: 500;
      border: none; background: transparent; cursor: pointer;
      color: var(--color-text-muted); font-family: var(--font-body); transition: color 0.15s;
    }
    .bp-inline-add:hover { color: var(--theme-accent); }
    .bp-small { font-size: 12px; }

    @media (max-width: 768px) {
      .bp-meeting { grid-template-columns: 1fr; }
      .bp-meeting-right { border-left: none; border-top: 0.5px solid var(--color-border); }
    }
  `]
})
export class MeetingDetailComponent implements OnInit {
  loading = true;
  entry: FeedbackEntry | null = null;
  children: FeedbackEntry[] = [];
  agenda: string[] = [];
  newAgendaItem = '';
  team = TEAM_MEMBERS;

  showDialog = false;
  dialogFlow: 'bug' | 'action' = 'action';

  notesChanged$ = new Subject<string>();

  get actionItems(): FeedbackEntry[] {
    return this.children.filter(c => {
      const t = (c.title || '').toLowerCase();
      return !t.includes('bug') && !this.isBug(c) && !this.isEnhancement(c);
    });
  }

  get bugs(): FeedbackEntry[] {
    return this.children.filter(c => this.isBug(c));
  }

  get enhancements(): FeedbackEntry[] {
    return this.children.filter(c => this.isEnhancement(c));
  }

  constructor(
    private route: ActivatedRoute,
    private feedbackSvc: FeedbackService,
    private cdr: ChangeDetectorRef
  ) {
    this.notesChanged$.pipe(debounceTime(1000)).subscribe(notes => {
      if (this.entry) {
        this.feedbackSvc.patch(this.entry.id, { notes } as any).subscribe();
      }
    });
  }

  ngOnInit() {
    const id = this.route.snapshot.params['id'];
    this.feedbackSvc.getById(id).subscribe({
      next: (entry) => {
        this.entry = entry;
        this.agenda = entry?.agenda || [];
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

  // Agenda
  addAgenda() {
    if (!this.newAgendaItem?.trim()) return;
    this.agenda.push(this.newAgendaItem.trim());
    this.newAgendaItem = '';
    this.saveAgenda();
  }

  removeAgenda(index: number) {
    this.agenda.splice(index, 1);
    this.saveAgenda();
  }

  saveAgenda() {
    if (!this.entry) return;
    this.feedbackSvc.patch(this.entry.id, { agenda: this.agenda } as any).subscribe();
  }

  saveField(field: string, value: any) {
    if (!this.entry) return;
    this.feedbackSvc.patch(this.entry.id, { [field]: value } as any).subscribe();
  }

  trackByIndex(index: number) { return index; }

  // Dialog
  openDialog(flow: 'bug' | 'action') {
    this.dialogFlow = flow;
    this.showDialog = true;
    this.cdr.detectChanges();
  }

  onChildAdded() {
    this.loadChildren();
  }

  // Helpers
  getInitials(name: string): string {
    const member = this.team.find(m => m.name === name);
    return member?.initials || name.substring(0, 2).toUpperCase();
  }

  formatDate(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  private isBug(c: FeedbackEntry): boolean {
    return (c.title || '').toLowerCase().includes('bug') ||
           c.subcategory_name?.toLowerCase().includes('bug') ||
           c.category_name?.toLowerCase().includes('bug') || false;
  }

  private isEnhancement(c: FeedbackEntry): boolean {
    return (c.title || '').toLowerCase().includes('enhancement') ||
           c.subcategory_name?.toLowerCase().includes('enhancement') ||
           c.category_name?.toLowerCase().includes('enhancement') || false;
  }
}
