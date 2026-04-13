import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { FeedbackService, FeedbackEntry, TEAM_MEMBERS } from '../../../core/services/feedback.service';
import { CatalogueEntity, CategoryInfo } from '../../../models';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { CatalogueGridComponent } from '../../../shared/components/catalogue-grid/catalogue-grid.component';
import { FeedbackDialogComponent } from '../../../shared/components/feedback-dialog/feedback-dialog.component';
import { SidebarModule } from 'primeng/sidebar';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-feedback',
  standalone: true,
  imports: [
    CommonModule, LucideAngularModule,
    LoadingSpinnerComponent, CatalogueGridComponent, FeedbackDialogComponent,
    SidebarModule, InputTextModule, ButtonModule
  ],
  template: `
    <app-loading *ngIf="loading"></app-loading>

    <ng-container *ngIf="!loading">
      <app-catalogue-grid
        [entities]="feedbackEntities"
        [categories]="filterCategories"
        entityType="feedback"
        entityLabel="entry"
        sectionTitle="FEEDBACK"
        actionLabel="View"
        [favouriteIds]="emptySet"
        [showEdit]="false"
        [showFavourite]="false"
        [totalCount]="feedbackEntities.length"
        (entitySelected)="onEntitySelected($event)"
        (actionClicked)="onEntitySelected($event)">
      </app-catalogue-grid>

      <div *ngIf="!feedbackEntities.length && !loading" class="bp-empty-state">
        <p class="bp-muted-text">No feedback entries yet. Use the floating button to log feedback.</p>
      </div>
    </ng-container>

    <!-- Detail drawer -->
    <p-sidebar [(visible)]="showDrawer" position="right"
      styleClass="bp-drawer" [style]="{width:'480px'}"
      [showCloseIcon]="false"
      (onHide)="closeDrawer()">
      <ng-template pTemplate="header">
        <div class="bp-drawer-header-row">
          <div class="bp-drawer-header">
            <span class="bp-drawer-label">FEEDBACK</span>
            <div class="bp-drawer-title">{{ selectedEntry?.title || 'Entry' }}</div>
          </div>
          <button class="bp-icon-btn" (click)="closeDrawer()" title="Close">
            <i class="pi pi-times"></i>
          </button>
        </div>
      </ng-template>
      <div class="bp-drawer-body" *ngIf="selectedEntry">
        <!-- Meeting date if present -->
        <div class="mb-4" *ngIf="selectedEntry.meeting_date">
          <label class="bp-field-label">Meeting date</label>
          <input pInputText [value]="formatDate(selectedEntry.meeting_date)" class="w-full bp-field-readonly" readonly/>
        </div>

        <div class="mb-4">
          <label class="bp-field-label">Title</label>
          <input pInputText [value]="selectedEntry.title" class="w-full bp-field-readonly" readonly/>
        </div>
        <div class="mb-4" *ngIf="selectedEntry.notes">
          <label class="bp-field-label">Notes</label>
          <div class="bp-notes-block">{{ selectedEntry.notes }}</div>
        </div>

        <div class="bp-field-grid-2 mb-4">
          <div *ngIf="selectedEntry.owner">
            <label class="bp-field-label">Owner</label>
            <div class="bp-owner-display">
              <span class="bp-owner-badge">{{ getInitials(selectedEntry.owner) }}</span>
              {{ selectedEntry.owner }}
            </div>
          </div>
          <div>
            <label class="bp-field-label">Date</label>
            <input pInputText [value]="formatDateTime(selectedEntry.created_at)" class="w-full bp-field-readonly" readonly/>
          </div>
        </div>

        <div class="mb-4" *ngIf="selectedEntry.page_url">
          <label class="bp-field-label">Page</label>
          <input pInputText [value]="selectedEntry.page_url" class="w-full bp-field-readonly" readonly/>
        </div>

        <!-- Children / action items -->
        <div *ngIf="childEntries.length" class="mt-4">
          <div class="bp-section-header mb-3">
            <span class="bp-section-title">ACTION ITEMS</span>
          </div>
          <div *ngFor="let child of childEntries" class="bp-child-row" (click)="selectChild(child)">
            <span class="bp-child-icon">
              <lucide-icon [name]="getTypeIcon(child)" [size]="13"></lucide-icon>
            </span>
            <span class="bp-child-title">{{ child.title }}</span>
            <span class="bp-child-owner" *ngIf="child.owner">{{ getInitials(child.owner) }}</span>
            <span class="bp-child-due" *ngIf="child.due_date">{{ formatDate(child.due_date) }}</span>
          </div>
        </div>

        <!-- Add action button for notes -->
        <div *ngIf="!selectedEntry.parent_id" class="mt-4">
          <button class="bp-add-action-btn" (click)="openAddAction()">
            <i class="pi pi-plus" style="font-size:11px;"></i> Add action item
          </button>
        </div>
      </div>
    </p-sidebar>

    <!-- Add action dialog -->
    <app-feedback-dialog
      [(visible)]="showActionDialog"
      initialFlow="action"
      [parentId]="selectedEntry?.id || ''"
      [parentTitle]="selectedEntry?.title || ''"
      (submitted)="onActionAdded()">
    </app-feedback-dialog>
  `,
  styles: [`
    .bp-empty-state { text-align: center; padding: 48px 24px; }
    .bp-notes-block {
      font-size: 13px; color: var(--color-text-secondary); line-height: 1.6;
      padding: 10px 12px; background: var(--theme-bg); border-radius: 8px;
      white-space: pre-wrap;
    }
    .bp-owner-display { display: flex; align-items: center; gap: 8px; margin-top: 4px; font-size: 13px; color: var(--color-text-primary); }
    .bp-owner-badge {
      width: 28px; height: 28px; border-radius: 50%; font-size: 10px; font-weight: 600;
      background: var(--theme-accent); color: #fff;
      display: flex; align-items: center; justify-content: center;
    }
    .bp-child-row {
      display: flex; align-items: center; gap: 8px; padding: 8px 10px;
      border: 0.5px solid var(--color-border); border-radius: 8px; margin-bottom: 6px;
      cursor: pointer; transition: border-color 0.15s;
    }
    .bp-child-row:hover { border-color: var(--theme-accent); }
    .bp-child-icon { color: var(--theme-accent); display: flex; }
    .bp-child-title { flex: 1; font-size: 13px; font-weight: 500; color: var(--color-text-primary); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bp-child-owner {
      width: 24px; height: 24px; border-radius: 50%; font-size: 9px; font-weight: 600;
      background: var(--theme-accent); color: #fff; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .bp-child-due { font-size: 11px; color: var(--color-text-muted); flex-shrink: 0; }
    .bp-add-action-btn {
      display: flex; align-items: center; gap: 4px;
      padding: 6px 14px; font-size: 12px; font-weight: 500;
      font-family: var(--font-body); border: 1px solid var(--theme-accent);
      background: transparent; color: var(--theme-accent);
      border-radius: 6px; cursor: pointer; transition: all 0.15s;
    }
    .bp-add-action-btn:hover { background: var(--theme-accent); color: #fff; }
  `]
})
export class FeedbackComponent implements OnInit {
  loading = true;
  feedbackEntities: CatalogueEntity[] = [];
  entries: FeedbackEntry[] = [];
  childEntries: FeedbackEntry[] = [];
  emptySet = new Set<string>();
  team = TEAM_MEMBERS;

  filterCategories: CategoryInfo[] = [
    { id: 'note', name: 'Notes', icon: 'clipboard-pen' },
    { id: 'bug', name: 'Bugs', icon: 'bug' },
    { id: 'action', name: 'Actions', icon: 'check-square' },
    { id: 'question', name: 'Questions', icon: 'circle-help' }
  ];

  showDrawer = false;
  showActionDialog = false;
  selectedEntry: FeedbackEntry | null = null;

  constructor(
    private feedbackSvc: FeedbackService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() { this.loadEntries(); }

  loadEntries() {
    this.feedbackSvc.getAll().subscribe({
      next: (entries) => {
        this.entries = entries || [];
        // Show top-level entries (no parent) — notes and standalone items
        const topLevel = this.entries.filter(e => !e.parent_id);
        this.feedbackEntities = topLevel.map(e => ({
          id: e.id,
          name: e.title,
          description: e.notes,
          subtitle: [e.owner, e.meeting_date ? this.formatDate(e.meeting_date) : null, e.page_url].filter(Boolean).join(' · '),
          category_id: this.inferType(e),
          categoryLabel: this.inferType(e),
          specs: [
            ...(e.owner ? [{ label: 'Owner', value: e.owner }] : []),
            ...(e.meeting_date ? [{ label: 'Meeting', value: this.formatDate(e.meeting_date) }] : []),
            ...(e.page_url ? [{ label: 'Page', value: e.page_url }] : []),
          ],
          _raw: e
        }));
        // Count children per type for filter categories
        this.filterCategories = this.filterCategories.map(c => ({
          ...c,
          count: topLevel.filter(e => this.inferType(e) === c.id).length
        }));
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  inferType(e: FeedbackEntry): string {
    if (e.meeting_date) return 'note';
    const title = (e.title || '').toLowerCase();
    if (title.includes('bug') || e.subcategory_name?.toLowerCase().includes('bug')) return 'bug';
    if (title.includes('question') || e.subcategory_name?.toLowerCase().includes('question')) return 'question';
    return 'action';
  }

  onEntitySelected(entity: CatalogueEntity) {
    this.selectedEntry = entity._raw || this.entries.find(e => e.id === entity.id) || null;
    this.childEntries = [];
    if (this.selectedEntry) {
      this.showDrawer = true;
      // Load children
      this.feedbackSvc.getChildren(this.selectedEntry.id).subscribe({
        next: (children) => { this.childEntries = children || []; this.cdr.detectChanges(); }
      });
      this.cdr.detectChanges();
    }
  }

  selectChild(child: FeedbackEntry) {
    this.selectedEntry = child;
    this.childEntries = [];
    this.cdr.detectChanges();
  }

  openAddAction() {
    this.showActionDialog = true;
    this.cdr.detectChanges();
  }

  onActionAdded() {
    // Reload children
    if (this.selectedEntry) {
      this.feedbackSvc.getChildren(this.selectedEntry.id).subscribe({
        next: (children) => { this.childEntries = children || []; this.cdr.detectChanges(); }
      });
    }
    this.loadEntries();
  }

  closeDrawer() {
    this.showDrawer = false;
    this.selectedEntry = null;
    this.childEntries = [];
    this.cdr.detectChanges();
  }

  getInitials(name: string): string {
    const member = this.team.find(m => m.name === name);
    return member?.initials || name.substring(0, 2).toUpperCase();
  }

  getTypeIcon(entry: FeedbackEntry): string {
    const type = this.inferType(entry);
    switch (type) {
      case 'bug': return 'bug';
      case 'question': return 'circle-help';
      case 'note': return 'clipboard-pen';
      default: return 'check-square';
    }
  }

  formatDate(iso: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  formatDateTime(iso: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
