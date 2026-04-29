import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { FeedbackService, FeedbackEntry, FeedbackCategory, TEAM_MEMBERS } from '../../../core/services/feedback.service';
import { CatalogueEntity, CategoryInfo } from '../../../models';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { CatalogueGridComponent } from '../../../shared/components/catalogue-grid/catalogue-grid.component';
import { FeedbackDialogComponent } from '../../../shared/components/feedback-dialog/feedback-dialog.component';
import { SidebarModule } from 'primeng/sidebar';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { ChipsModule } from 'primeng/chips';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-feedback',
  standalone: true,
  imports: [
    CommonModule, FormsModule, LucideAngularModule,
    LoadingSpinnerComponent, CatalogueGridComponent, FeedbackDialogComponent,
    SidebarModule, InputTextModule, ButtonModule, DropdownModule,
    ChipsModule, CheckboxModule, ConfirmDialogModule, ToastModule
  ],
  providers: [ConfirmationService, MessageService],
  template: `
    <app-loading *ngIf="loading"></app-loading>

    <ng-container *ngIf="!loading">
      <!-- AREA CIRCLES -->
      <div class="bp-fb-areas-wrap" *ngIf="areaCircles.length > 1">
        <div class="bp-fb-areas">
          <button *ngFor="let a of areaCircles"
            class="bp-fb-area-btn"
            [class.active]="selectedArea === a.id"
            (click)="setArea(a.id)">
            <div class="bp-fb-area-circle">
              <lucide-icon [name]="a.icon" [size]="22"></lucide-icon>
            </div>
            <span class="bp-fb-area-label">{{ a.label }}</span>
          </button>
        </div>
      </div>

      <!-- FILTER BAR -->
      <div class="bp-fb-filters">
        <p-dropdown [(ngModel)]="filterType" [options]="typeOptions" optionLabel="label" optionValue="value"
          (onChange)="applyFilters()" styleClass="bp-fb-filter" placeholder="Type"></p-dropdown>
        <p-dropdown [(ngModel)]="filterPage" [options]="pageOptions" optionLabel="label" optionValue="value"
          (onChange)="applyFilters()" styleClass="bp-fb-filter" placeholder="Page"></p-dropdown>
        <p-dropdown [(ngModel)]="filterOwner" [options]="ownerOptions" optionLabel="label" optionValue="value"
          (onChange)="applyFilters()" styleClass="bp-fb-filter" placeholder="Owner"></p-dropdown>
        <p-dropdown [(ngModel)]="filterStatus" [options]="statusOptions" optionLabel="label" optionValue="value"
          (onChange)="applyFilters()" styleClass="bp-fb-filter" placeholder="Status"></p-dropdown>
        <span class="bp-fb-filter-count">{{ filteredEntities.length }} of {{ allEntities.length }}</span>
      </div>

      <!-- BULK ACTION BAR -->
      <div class="bp-fb-bulk-bar" *ngIf="selectedIds.size > 0">
        <span class="bp-fb-bulk-count">{{ selectedIds.size }} selected</span>
        <button class="bp-fb-bulk-btn" (click)="bulkMarkDone()">
          <lucide-icon name="check" [size]="12"></lucide-icon> Mark done
        </button>
        <p-dropdown [(ngModel)]="bulkAssignOwner" [options]="ownerAssignOptions" optionLabel="label" optionValue="value"
          (onChange)="bulkAssign()" styleClass="bp-fb-filter" placeholder="Assign to..."></p-dropdown>
        <button class="bp-fb-bulk-btn bp-fb-bulk-btn--danger" (click)="bulkDelete()">
          <lucide-icon name="x" [size]="12"></lucide-icon> Delete
        </button>
      </div>

      <app-catalogue-grid
        [entities]="filteredEntities"
        [categories]="filterCategories"
        entityType="feedback"
        entityLabel="entry"
        sectionTitle="FEEDBACK"
        actionLabel="View"
        [favouriteIds]="emptySet"
        [showEdit]="false"
        [showFavourite]="false"
        [totalCount]="filteredEntities.length"
        (entitySelected)="onEntityPreview($event)"
        (actionClicked)="onEntitySelected($event)">
      </app-catalogue-grid>

      <div *ngIf="!filteredEntities.length && !loading" class="bp-empty-state">
        <p class="bp-muted-text">No feedback entries match your filters.</p>
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
        <!-- Type -->
        <div class="mb-4">
          <label class="bp-field-label">Type</label>
          <div class="bp-type-row">
            <button *ngFor="let t of typeEditOptions" class="bp-type-pill"
              [class.active]="editType === t.value" (click)="editType = t.value; markDirty()">
              <lucide-icon [name]="t.icon" [size]="12"></lucide-icon> {{ t.label }}
            </button>
          </div>
        </div>

        <!-- Status -->
        <div class="mb-4">
          <label class="bp-field-label">Status</label>
          <p-dropdown [(ngModel)]="editStatus" [options]="statusEditOptions" optionLabel="label" optionValue="value"
            styleClass="w-full" (onChange)="markDirty()"></p-dropdown>
        </div>

        <!-- Owner -->
        <div class="mb-4">
          <label class="bp-field-label">Owner</label>
          <div class="bp-owner-row">
            <button *ngFor="let m of team" class="bp-owner-circle"
              [class.active]="editOwner === m.name" (click)="editOwner = m.name; markDirty()">
              {{ m.initials }}
            </button>
            <button class="bp-owner-circle" [class.active]="!editOwner"
              (click)="editOwner = ''; markDirty()" title="Unassign">—</button>
          </div>
        </div>

        <!-- Meeting date if present -->
        <div class="mb-4" *ngIf="selectedEntry.event_date">
          <label class="bp-field-label">Meeting date</label>
          <input pInputText [value]="formatDate(selectedEntry.event_date)" class="w-full bp-field-readonly" readonly/>
        </div>

        <div class="mb-4">
          <label class="bp-field-label">Title</label>
          <input pInputText [(ngModel)]="editTitle" class="w-full bp-input-edit" (ngModelChange)="markDirty()"/>
        </div>
        <div class="mb-4">
          <label class="bp-field-label">Notes</label>
          <textarea pInputTextarea [(ngModel)]="editNotes" class="w-full bp-input-edit" [rows]="3"
            style="resize:none;" (ngModelChange)="markDirty()"></textarea>
        </div>

        <div class="bp-field-grid-2 mb-4">
          <div>
            <label class="bp-field-label">Page</label>
            <input pInputText [value]="selectedEntry.page_url || '—'" class="w-full bp-field-readonly" readonly/>
          </div>
          <div>
            <label class="bp-field-label">Date</label>
            <input pInputText [value]="formatDateTime(selectedEntry.created_at)" class="w-full bp-field-readonly" readonly/>
          </div>
        </div>

        <!-- Tags -->
        <div class="mb-4">
          <label class="bp-field-label">Tags</label>
          <p-chips [(ngModel)]="editTags" styleClass="w-full bp-input-edit" [addOnBlur]="true"
            placeholder="Add tag..." (ngModelChange)="markDirty()"></p-chips>
        </div>

        <!-- Children / action items (meeting notes only) -->
        <div *ngIf="childEntries.length && selectedEntry.event_date" class="mt-4">
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

        <div *ngIf="selectedEntry.event_date" class="mt-4">
          <button class="bp-add-action-btn" (click)="openAddAction()">
            <i class="pi pi-plus" style="font-size:11px;"></i> Add action item
          </button>
        </div>
      </div>

      <ng-template pTemplate="footer">
        <div class="bp-drawer-footer">
          <button class="bp-btn-delete" (click)="confirmDelete()">Delete</button>
          <span style="flex:1"></span>
          <button class="bp-btn-cancel" (click)="closeDrawer()">Cancel</button>
          <button class="bp-btn-save" [disabled]="!isDirty" (click)="saveDetail()">Save</button>
        </div>
      </ng-template>
    </p-sidebar>

    <!-- Add action dialog -->
    <app-feedback-dialog
      [(visible)]="showActionDialog"
      initialFlow="issue"
      [parentId]="selectedEntry?.id || ''"
      [parentTitle]="selectedEntry?.title || ''"
      (submitted)="onActionAdded()">
    </app-feedback-dialog>

    <p-confirmDialog></p-confirmDialog>
    <p-toast></p-toast>
  `,
  styles: [`
    .bp-empty-state { text-align: center; padding: 48px 24px; }

    /* Area circles */
    .bp-fb-areas-wrap { padding: 16px 28px 4px; border-bottom: 0.5px solid var(--color-border); }
    .bp-fb-areas { display: flex; gap: 18px; justify-content: center; padding: 4px 4px 12px; flex-wrap: wrap; }
    .bp-fb-area-btn { display: flex; flex-direction: column; align-items: center; gap: 5px; background: none; border: none; cursor: pointer; padding: 0; }
    .bp-fb-area-circle {
      width: 56px; height: 56px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      border: 2.5px solid transparent; transition: border-color 0.15s;
      color: var(--theme-accent); background: var(--theme-bg);
      box-shadow: 0 0 0 0.5px var(--color-border);
    }
    .bp-fb-area-btn.active .bp-fb-area-circle {
      border-color: var(--theme-accent);
      box-shadow: 0 0 0 2px var(--theme-accent);
    }
    .bp-fb-area-label {
      font-size: 11px; font-weight: 500; color: var(--color-text-secondary);
      font-family: var(--font-body); text-transform: capitalize;
    }
    .bp-fb-area-btn.active .bp-fb-area-label { color: var(--theme-accent); font-weight: 600; }

    /* Filter bar */
    .bp-fb-filters {
      display: flex; align-items: center; gap: 10px; padding: 12px 28px;
      border-bottom: 0.5px solid var(--color-border); flex-wrap: wrap;
    }
    :host ::ng-deep .bp-fb-filter { min-width: 130px; }
    :host ::ng-deep .bp-fb-filter .p-dropdown { font-size: 12px !important; }
    .bp-fb-filter-count { font-size: 12px; color: var(--color-text-muted); margin-left: auto; }

    /* Bulk action bar */
    .bp-fb-bulk-bar {
      display: flex; align-items: center; gap: 10px; padding: 8px 28px;
      background: var(--theme-bg); border-bottom: 0.5px solid var(--color-border);
    }
    .bp-fb-bulk-count { font-size: 12px; font-weight: 600; color: var(--color-text-primary); }
    .bp-fb-bulk-btn {
      display: flex; align-items: center; gap: 4px;
      padding: 5px 12px; font-size: 12px; font-weight: 500;
      border: 1px solid var(--color-border); background: var(--color-surface);
      color: var(--color-text-secondary); border-radius: 6px; cursor: pointer;
      font-family: var(--font-body); transition: all 0.15s;
    }
    .bp-fb-bulk-btn:hover { border-color: var(--theme-accent); color: var(--theme-accent); }
    .bp-fb-bulk-btn--danger:hover { border-color: var(--color-action-text); color: var(--color-action-text); }

    /* Status badge */
    .bp-status-pill {
      display: inline-flex; padding: 2px 8px; border-radius: 10px;
      font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em;
    }
    .bp-status-open { background: var(--color-quoted-bg); color: var(--color-quoted-text); }
    .bp-status-in_progress { background: var(--color-waiting-bg); color: var(--color-waiting-text); }
    .bp-status-done { background: var(--color-booked-bg); color: var(--color-booked-text); }
    .bp-status-wont_fix { background: var(--color-surface); color: var(--color-text-muted); }

    /* Detail panel */
    .bp-notes-block {
      font-size: 13px; color: var(--color-text-secondary); line-height: 1.6;
      padding: 10px 12px; background: var(--theme-bg); border-radius: 8px; white-space: pre-wrap;
    }
    .bp-owner-row { display: flex; gap: 6px; margin-top: 4px; }
    .bp-owner-circle {
      width: 32px; height: 32px; border-radius: 50%; font-size: 10px; font-weight: 600;
      border: 2px solid var(--color-border); background: var(--color-surface);
      color: var(--color-text-secondary); cursor: pointer; transition: all 0.15s;
      display: flex; align-items: center; justify-content: center; font-family: var(--font-body);
    }
    .bp-owner-circle:hover { border-color: var(--theme-accent); }
    .bp-owner-circle.active { border-color: var(--theme-accent); background: var(--theme-accent); color: #fff; }
    .bp-type-row { display: flex; flex-wrap: wrap; gap: 6px; }
    .bp-type-pill {
      display: flex; align-items: center; gap: 4px;
      padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 500;
      border: 1px solid var(--color-border); background: var(--color-surface);
      color: var(--color-text-secondary); cursor: pointer; transition: all 0.15s;
      font-family: var(--font-body);
    }
    .bp-type-pill:hover { border-color: var(--theme-accent); color: var(--theme-accent); }
    .bp-type-pill.active { border-color: var(--theme-accent); background: var(--theme-accent); color: #fff; }
    .bp-owner-display { display: flex; align-items: center; gap: 8px; margin-top: 4px; font-size: 13px; color: var(--color-text-primary); }
    .bp-owner-badge {
      width: 28px; height: 28px; border-radius: 50%; font-size: 10px; font-weight: 600;
      background: var(--theme-accent); color: #fff; display: flex; align-items: center; justify-content: center;
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
    .bp-drawer-footer { display: flex; align-items: center; gap: 8px; padding: 0; }
    .bp-btn-delete {
      padding: 8px 16px; border-radius: 6px; font-size: 12px; font-weight: 500;
      border: 1px solid var(--color-border); background: transparent;
      color: var(--color-text-muted); cursor: pointer; font-family: var(--font-body);
    }
    .bp-btn-delete:hover { color: var(--color-action-text); border-color: var(--color-action-text); }
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
export class FeedbackComponent implements OnInit {
  loading = true;
  allEntities: CatalogueEntity[] = [];
  filteredEntities: CatalogueEntity[] = [];
  entries: FeedbackEntry[] = [];
  childEntries: FeedbackEntry[] = [];
  emptySet = new Set<string>();
  team = TEAM_MEMBERS;
  selectedIds = new Set<string>();

  // Loaded from shared.feedback_categories on init. Aggregate 'folder' + 'note'
  // pseudo-pills are added at the front (they cover any folder / any note row,
  // not a single category).
  filterCategories: CategoryInfo[] = [
    { id: 'folder', name: 'Folders', icon: 'folder-open' }
  ];

  // Filter state
  filterType = '';
  filterPage = '';
  filterOwner = '';
  filterStatus = '';
  selectedArea: string = 'all';
  areaCircles: { id: string; label: string; icon: string }[] = [
    { id: 'all', label: 'All', icon: 'layers' }
  ];

  // Lucide icon map per area — falls back to 'circle' for unknown areas.
  private readonly areaIconMap: Record<string, string> = {
    auth: 'shield',
    projects: 'folder',
    catalogue: 'shopping-bag',
    suppliers: 'store',
    feedback: 'message-square',
    settings: 'settings',
    technical: 'cpu',
    mobile: 'smartphone',
    payments: 'credit-card',
    notifications: 'bell',
    dashboard: 'layout-dashboard',
    design: 'palette',
    categories: 'tags',
    marketing: 'megaphone',
    balls: 'circle-dot'
  };
  typeOptions = [{ label: 'All types', value: '' }];
  pageOptions = [{ label: 'All pages', value: '' }];
  ownerOptions = [{ label: 'All owners', value: '' }, ...TEAM_MEMBERS.map(m => ({ label: m.name, value: m.name }))];
  statusOptions = [
    { label: 'All statuses', value: '' },
    { label: 'Open', value: 'open' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Done', value: 'done' },
    { label: "Won't Fix", value: 'wont_fix' }
  ];
  ownerAssignOptions = TEAM_MEMBERS.map(m => ({ label: m.name, value: m.name }));
  bulkAssignOwner = '';

  // Detail panel edit state
  showDrawer = false;
  showActionDialog = false;
  selectedEntry: FeedbackEntry | null = null;
  editTitle = '';
  editNotes = '';
  editOwner = '';
  editStatus = 'open';
  editType = 'action';
  editTags: string[] = [];
  isDirty = false;

  typeEditOptions = [
    { label: 'Action', value: 'action', icon: 'check-square' },
    { label: 'Bug', value: 'bug', icon: 'bug' },
    { label: 'Enhancement', value: 'enhancement', icon: 'lightbulb' },
    { label: 'Question', value: 'question', icon: 'circle-help' },
    { label: 'Note', value: 'note', icon: 'clipboard-pen' }
  ];

  statusEditOptions = [
    { label: 'Open', value: 'open' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Done', value: 'done' },
    { label: "Won't Fix", value: 'wont_fix' }
  ];

  constructor(
    private feedbackSvc: FeedbackService,
    private confirmSvc: ConfirmationService,
    private msg: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.feedbackSvc.getFeedbackCategories().subscribe({
      next: (cats) => {
        const issueCats = (cats || [])
          .filter(c => c.object_type === 'issue')
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(c => ({
            id: c.name.toLowerCase().replace(/\s+/g, '_'),
            name: c.name + 's',
            icon: c.icon_name
          }));
        this.filterCategories = [
          { id: 'folder', name: 'Folders', icon: 'folder-open' },
          ...issueCats,
          { id: 'note', name: 'Notes', icon: 'file-text' }
        ];
        this.loadEntries();
      },
      error: () => { this.loadEntries(); }
    });
  }

  loadEntries() {
    this.feedbackSvc.getAll().subscribe({
      next: (entries) => {
        this.entries = entries || [];
        const topLevel = this.entries.filter(e => !e.parent_id);

        this.allEntities = topLevel.map(e => ({
          id: e.id,
          name: e.title,
          description: e.notes,
          subtitle: this.buildSubtitle(e),
          badge: e.version || undefined,
          category_id: this.inferType(e),
          categoryLabel: this.inferType(e),
          icon: this.getTypeIcon(e),
          specs: [
            ...(e.area ? [{ label: 'Area', value: e.area }] : []),
            ...(e.version ? [{ label: 'Version', value: e.version }] : []),
            ...(e.shipped_date ? [{ label: 'Shipped', value: this.formatDate(e.shipped_date) }] : []),
            ...(e.status ? [{ label: 'Status', value: e.status }] : []),
            ...(e.owner ? [{ label: 'Owner', value: e.owner }] : []),
            ...(e.page_url ? [{ label: 'Page', value: e.page_url }] : []),
          ],
          _raw: e
        }));

        // Derive distinct areas → circles. Always include 'All' first.
        const distinctAreas = [...new Set(topLevel.map(e => e.area).filter(Boolean) as string[])].sort();
        this.areaCircles = [
          { id: 'all', label: 'All', icon: 'layers' },
          ...distinctAreas.map(a => ({
            id: a,
            label: a.charAt(0).toUpperCase() + a.slice(1),
            icon: this.areaIconMap[a] || 'circle'
          }))
        ];

        // Build dynamic filter options
        const pages = [...new Set(topLevel.map(e => e.page_url).filter(Boolean) as string[])].sort();
        this.pageOptions = [{ label: 'All pages', value: '' }, ...pages.map(p => ({ label: p, value: p }))];
        const types = [...new Set(topLevel.map(e => this.inferType(e)))];
        this.typeOptions = [{ label: 'All types', value: '' }, ...types.map(t => ({ label: t.charAt(0).toUpperCase() + t.slice(1), value: t }))];

        this.filterCategories = this.filterCategories.map(c => ({
          ...c,
          count: topLevel.filter(e => this.inferType(e) === c.id).length
        }));

        this.applyFilters();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  buildSubtitle(e: FeedbackEntry): string {
    const parts: string[] = [];
    if (e.status === 'done' && e.shipped_date) parts.push(`Shipped ${this.formatDate(e.shipped_date)}`);
    else if (e.status && e.status !== 'open') parts.push(e.status.replace('_', ' '));
    if (e.area) parts.push(e.area);
    if (e.owner) parts.push(e.owner);
    if (e.page_url) parts.push(e.page_url);
    return parts.join(' · ');
  }

  setArea(id: string) {
    this.selectedArea = id;
    this.applyFilters();
  }

  applyFilters() {
    this.filteredEntities = this.allEntities.filter(e => {
      const raw: FeedbackEntry = e._raw;
      if (this.selectedArea !== 'all' && (raw.area || '') !== this.selectedArea) return false;
      if (this.filterType && this.inferType(raw) !== this.filterType) return false;
      if (this.filterPage && raw.page_url !== this.filterPage) return false;
      if (this.filterOwner && raw.owner !== this.filterOwner) return false;
      if (this.filterStatus && (raw.status || 'open') !== this.filterStatus) return false;
      return true;
    });
    this.selectedIds.clear();
    this.cdr.detectChanges();
  }

  inferType(e: FeedbackEntry): string {
    if (e.object_type === 'folder') return 'folder';
    if (e.object_type === 'note') return 'note';
    if (e.type) return e.type;
    if (e.event_date) return 'folder';
    return 'bug';
  }

  // Preview (click row) — lets grid show built-in detail panel
  onEntityPreview(entity: CatalogueEntity) {
    const entry = entity._raw as FeedbackEntry;
    if (entry?.object_type === 'folder') {
      window.open('/folder/' + entry.id, '_blank');
    }
    // Otherwise grid handles its own preview panel
  }

  // View (click action button) — opens full edit drawer
  onEntitySelected(entity: CatalogueEntity) {
    this.selectedEntry = entity._raw || this.entries.find(e => e.id === entity.id) || null;
    this.childEntries = [];
    if (this.selectedEntry) {
      if (this.selectedEntry.event_date) {
        window.open('/folder/' + this.selectedEntry.id, '_blank');
        return;
      }
      this.editTitle = this.selectedEntry.title;
      this.editNotes = this.selectedEntry.notes || '';
      this.editOwner = this.selectedEntry.owner || '';
      this.editStatus = this.selectedEntry.status || 'open';
      this.editType = this.inferType(this.selectedEntry);
      this.editTags = [];
      this.isDirty = false;
      this.showDrawer = true;
      this.feedbackSvc.getChildren(this.selectedEntry.id).subscribe({
        next: (children) => { this.childEntries = children || []; this.cdr.detectChanges(); }
      });
      this.cdr.detectChanges();
    }
  }

  markDirty() { this.isDirty = true; }

  saveDetail() {
    if (!this.selectedEntry) return;
    this.feedbackSvc.patch(this.selectedEntry.id, {
      title: this.editTitle,
      notes: this.editNotes || undefined,
      owner: this.editOwner || undefined,
      status: this.editStatus,
      type: this.editType,
    } as any).subscribe({
      next: () => {
        this.isDirty = false;
        this.msg.add({ severity: 'success', summary: 'Saved' });
        this.loadEntries();
        this.cdr.detectChanges();
      }
    });
  }

  confirmDelete() {
    if (!this.selectedEntry) return;
    this.confirmSvc.confirm({
      message: 'Delete this feedback entry?',
      accept: () => {
        this.feedbackSvc.remove(this.selectedEntry!.id).subscribe(() => {
          this.closeDrawer();
          this.loadEntries();
          this.msg.add({ severity: 'success', summary: 'Deleted' });
        });
      }
    });
  }

  // Bulk actions
  toggleSelect(id: string) {
    if (this.selectedIds.has(id)) this.selectedIds.delete(id);
    else this.selectedIds.add(id);
    this.cdr.detectChanges();
  }

  bulkMarkDone() {
    const ids = [...this.selectedIds];
    let done = 0;
    for (const id of ids) {
      this.feedbackSvc.patch(id, { status: 'done' } as any).subscribe(() => {
        done++;
        if (done === ids.length) { this.selectedIds.clear(); this.loadEntries(); this.msg.add({ severity: 'success', summary: `${ids.length} marked done` }); }
      });
    }
  }

  bulkAssign() {
    if (!this.bulkAssignOwner) return;
    const ids = [...this.selectedIds];
    let done = 0;
    for (const id of ids) {
      this.feedbackSvc.patch(id, { owner: this.bulkAssignOwner } as any).subscribe(() => {
        done++;
        if (done === ids.length) { this.selectedIds.clear(); this.bulkAssignOwner = ''; this.loadEntries(); this.msg.add({ severity: 'success', summary: `${ids.length} assigned` }); }
      });
    }
  }

  bulkDelete() {
    this.confirmSvc.confirm({
      message: `Delete ${this.selectedIds.size} entries?`,
      accept: () => {
        const ids = [...this.selectedIds];
        let done = 0;
        for (const id of ids) {
          this.feedbackSvc.remove(id).subscribe(() => {
            done++;
            if (done === ids.length) { this.selectedIds.clear(); this.loadEntries(); this.msg.add({ severity: 'success', summary: `${ids.length} deleted` }); }
          });
        }
      }
    });
  }

  selectChild(child: FeedbackEntry) {
    this.selectedEntry = child;
    this.editTitle = child.title;
    this.editNotes = child.notes || '';
    this.editOwner = child.owner || '';
    this.editStatus = child.status || 'open';
    this.editType = this.inferType(child);
    this.editTags = [];
    this.isDirty = false;
    this.childEntries = [];
    this.cdr.detectChanges();
  }

  openAddAction() { this.showActionDialog = true; this.cdr.detectChanges(); }

  onActionAdded() {
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
    this.isDirty = false;
    this.cdr.detectChanges();
  }

  getInitials(name: string): string {
    const member = this.team.find(m => m.name === name);
    return member?.initials || name.substring(0, 2).toUpperCase();
  }

  getTypeIcon(entry: FeedbackEntry): string {
    const type = this.inferType(entry);
    switch (type) {
      case 'folder': return 'folder-open';
      case 'bug': return 'bug';
      case 'enhancement': return 'lightbulb';
      case 'question': return 'circle-help';
      case 'prompt': return 'clipboard-pen';
      case 'note': return 'file-text';
      default: return 'check-square';
    }
  }

  getStatusClass(status: string): string {
    return 'bp-status-' + (status || 'open');
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
