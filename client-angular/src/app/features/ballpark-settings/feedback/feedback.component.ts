import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CategoryService } from '../../../core/services/category.service';
import { FeedbackService, FeedbackEntry } from '../../../core/services/feedback.service';
import { Category, CatalogueEntity, CategoryInfo } from '../../../models';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { CatalogueGridComponent } from '../../../shared/components/catalogue-grid/catalogue-grid.component';
import { SidebarModule } from 'primeng/sidebar';
import { InputTextModule } from 'primeng/inputtext';

@Component({
  selector: 'app-feedback',
  standalone: true,
  imports: [CommonModule, LoadingSpinnerComponent, CatalogueGridComponent, SidebarModule, InputTextModule],
  template: `
    <app-loading *ngIf="loading"></app-loading>

    <ng-container *ngIf="!loading">
      <app-catalogue-grid
        [entities]="feedbackEntities"
        [categories]="parentCategories"
        entityType="feedback"
        entityLabel="feedback entry"
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
        <div class="bp-field-grid-2 mb-4">
          <div>
            <label class="bp-field-label">Category</label>
            <input pInputText [value]="selectedEntry.category_name || '—'" class="w-full bp-field-readonly" readonly/>
          </div>
          <div>
            <label class="bp-field-label">Subcategory</label>
            <input pInputText [value]="selectedEntry.subcategory_name || '—'" class="w-full bp-field-readonly" readonly/>
          </div>
        </div>
        <div class="mb-4">
          <label class="bp-field-label">Title</label>
          <input pInputText [value]="selectedEntry.title" class="w-full bp-field-readonly" readonly/>
        </div>
        <div class="mb-4">
          <label class="bp-field-label">Notes</label>
          <input pInputText [value]="selectedEntry.notes || '—'" class="w-full bp-field-readonly" readonly/>
        </div>
        <div class="bp-field-grid-2 mb-4">
          <div>
            <label class="bp-field-label">Page</label>
            <input pInputText [value]="selectedEntry.page_url || '—'" class="w-full bp-field-readonly" readonly/>
          </div>
          <div>
            <label class="bp-field-label">Date</label>
            <input pInputText [value]="formatDate(selectedEntry.created_at)" class="w-full bp-field-readonly" readonly/>
          </div>
        </div>
        <div class="bp-field-grid-2 mb-4">
          <div>
            <label class="bp-field-label">Logged by</label>
            <input pInputText [value]="selectedEntry.submitted_by || '—'" class="w-full bp-field-readonly" readonly/>
          </div>
          <div *ngIf="selectedEntry.environment">
            <label class="bp-field-label">Environment</label>
            <input pInputText [value]="selectedEntry.environment" class="w-full bp-field-readonly" readonly/>
          </div>
        </div>
      </div>
    </p-sidebar>
  `,
  styles: [`
    .bp-empty-state { text-align: center; padding: 48px 24px; }
  `]
})
export class FeedbackComponent implements OnInit {
  loading = true;
  allCategories: Category[] = [];
  parentCategories: CategoryInfo[] = [];
  feedbackEntities: CatalogueEntity[] = [];
  entries: FeedbackEntry[] = [];
  emptySet = new Set<string>();

  private iconMap: Record<string, string> = {
    'Prompt': 'clipboard-pen', 'Question': 'circle-help', 'Works Well': 'check'
  };

  showDrawer = false;
  selectedEntry: FeedbackEntry | null = null;

  constructor(
    private catSvc: CategoryService,
    private feedbackSvc: FeedbackService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.catSvc.getAll('feedback').subscribe({
      next: (cats) => {
        this.allCategories = cats || [];
        this.buildCategoryCircles();
        this.loadEntries();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  buildCategoryCircles() {
    const parents = this.allCategories.filter(c => !c.parent_id);
    this.parentCategories = parents.map(p => ({
      id: p.id,
      name: p.name,
      cover_image_url: p.cover_image_url,
      icon: this.iconMap[p.name]
    }));
  }

  loadEntries() {
    this.feedbackSvc.getAll().subscribe({
      next: (entries) => {
        this.entries = entries || [];
        this.feedbackEntities = this.entries.map(e => ({
          id: e.id,
          name: e.title,
          description: e.notes,
          subtitle: [e.page_url, e.submitted_by].filter(Boolean).join(' · ') || '',
          category_id: e.category_id,
          categoryLabel: e.category_name,
          specs: [
            ...(e.page_url ? [{ label: 'Page', value: e.page_url }] : []),
            ...(e.submitted_by ? [{ label: 'Logged by', value: e.submitted_by }] : []),
          ],
          _raw: e
        }));
        // Update category counts
        const parents = this.allCategories.filter(c => !c.parent_id);
        this.parentCategories = parents.map(p => ({
          id: p.id,
          name: p.name,
          cover_image_url: p.cover_image_url,
          icon: this.iconMap[p.name],
          count: this.entries.filter(e => e.category_id === p.id).length
        }));
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  onEntitySelected(entity: CatalogueEntity) {
    this.selectedEntry = entity._raw || this.entries.find(e => e.id === entity.id) || null;
    if (this.selectedEntry) {
      this.showDrawer = true;
      this.cdr.detectChanges();
    }
  }

  closeDrawer() {
    this.showDrawer = false;
    this.selectedEntry = null;
    this.cdr.detectChanges();
  }

  formatDate(iso: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
