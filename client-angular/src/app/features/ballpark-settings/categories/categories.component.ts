import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { InputSwitchModule } from 'primeng/inputswitch';
import { DropdownModule } from 'primeng/dropdown';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SidebarModule } from 'primeng/sidebar';
import { ChipsModule } from 'primeng/chips';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LucideAngularModule } from 'lucide-angular';
import { CategoryService } from '../../../core/services/category.service';
import { FeedbackService, FeedbackCategory } from '../../../core/services/feedback.service';
import { Category, CatalogueEntity, CategoryInfo } from '../../../models';
import { InputNumberModule } from 'primeng/inputnumber';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { CatalogueGridComponent } from '../../../shared/components/catalogue-grid/catalogue-grid.component';
import { ImageUploadPanelComponent } from '../../../shared/components/image-upload-panel/image-upload-panel.component';

type NamespaceId = 'all' | 'catalogue' | 'feedback' | 'area';

interface NamespaceOption {
  id: NamespaceId;
  label: string;
  icon: string;
  bg: string;
}

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [
    CommonModule, FormsModule, LucideAngularModule,
    ButtonModule, InputTextModule, InputTextareaModule, InputSwitchModule, InputNumberModule,
    DropdownModule, SelectButtonModule, SidebarModule, ChipsModule, TagModule, ToastModule,
    LoadingSpinnerComponent, CatalogueGridComponent, ImageUploadPanelComponent
  ],
  providers: [MessageService],
  template: `
    <app-loading *ngIf="loading"></app-loading>

    <ng-container *ngIf="!loading">
      <!-- NAMESPACE CIRCLES -->
      <div class="bp-ns-circles-wrap">
        <div class="bp-ns-circles">
          <button *ngFor="let ns of namespaces"
            class="bp-ns-circle-btn"
            [class.active]="selectedNamespace === ns.id"
            (click)="setNamespace(ns.id)">
            <div class="bp-ns-circle" [style.background-color]="ns.bg">
              <lucide-icon [name]="ns.icon" [size]="24"></lucide-icon>
            </div>
            <span class="bp-ns-circle-label">{{ ns.label }}</span>
          </button>
        </div>
      </div>

      <!-- CATALOGUE GRID -->
      <app-catalogue-grid
        [entities]="catEntities"
        [categories]="circleCategories"
        [tags]="availableTags"
        entityType="item"
        entityLabel="category"
        sectionTitle="CATEGORIES"
        actionLabel="Edit category"
        [favouriteIds]="emptySet"
        [showFavourite]="false"
        [showEdit]="true"
        [totalCount]="catEntities.length"
        (entitySelected)="onEntitySelected($event)"
        (actionClicked)="onAction($event)"
        (imageEditRequested)="onImageEdit($event)"
        (categoryImageEditRequested)="onCategoryImageEdit($event)">
        <button catalogue-toggles class="bp-add-btn" (click)="openAdd()">
          <i class="pi pi-plus" style="font-size:11px;"></i> Add category
        </button>
      </app-catalogue-grid>
    </ng-container>

    <!-- Image upload panels -->
    <app-image-upload-panel
      *ngIf="uploadCatId"
      [entityId]="uploadCatId"
      type="category"
      [existingCoverUrl]="uploadCoverUrl"
      [existingCardColor]="uploadCardColor"
      [existingIconName]="uploadIconName"
      [existingIconColor]="uploadIconColor"
      [searchTerm]="uploadSearchTerm"
      (imagesUpdated)="onCatImageUpdated($event)"
      (closed)="uploadCatId = ''">
    </app-image-upload-panel>

    <!-- Icon-only panel for area rows (shared.feedback_categories) -->
    <app-image-upload-panel
      *ngIf="uploadAreaId"
      [entityId]="uploadAreaId"
      type="area"
      mode="icon-only"
      [existingIconName]="uploadAreaIconName"
      [existingIconColor]="uploadAreaIconColor"
      [searchTerm]="uploadAreaName"
      (imagesUpdated)="onAreaIconUpdated($event)"
      (closed)="uploadAreaId = ''">
    </app-image-upload-panel>

    <!-- CATEGORY EDIT DRAWER -->
    <p-sidebar [(visible)]="showDrawer" position="right"
      styleClass="bp-drawer" [style]="{width:'480px'}"
      [showCloseIcon]="false"
      (onHide)="closeDrawer()">

      <ng-template pTemplate="header">
        <div class="bp-drawer-header-row">
          <div class="bp-drawer-header">
            <span class="bp-drawer-label">CATEGORY</span>
            <div class="bp-drawer-title">{{ form.id ? (form.name || 'Category') : 'New category' }}</div>
          </div>
          <button class="bp-icon-btn" (click)="closeDrawer()" title="Close">
            <i class="pi pi-times"></i>
          </button>
        </div>
      </ng-template>

      <div class="bp-drawer-body">
        <div class="mb-4">
          <label class="bp-field-label">Name *</label>
          <input pInputText [(ngModel)]="form.name" class="w-full bp-input-edit" placeholder="Category name"/>
        </div>

        <div class="mb-4">
          <label class="bp-field-label">Namespace *</label>
          <p-dropdown [(ngModel)]="form.namespace" [options]="namespaceOptions"
            optionLabel="label" optionValue="value"
            (onChange)="onNamespaceFormChange()"
            styleClass="w-full bp-input-edit"
            placeholder="Select namespace">
          </p-dropdown>
        </div>

        <div class="mb-4" *ngIf="form.namespace === 'feedback'">
          <label class="bp-field-label">Object type</label>
          <p-selectButton [(ngModel)]="form.object_type"
            [options]="objectTypeOptions"
            optionLabel="label" optionValue="value"
            styleClass="bp-object-type-toggle">
          </p-selectButton>
        </div>

        <div class="mb-4" *ngIf="!isAreaForm">
          <label class="bp-field-label">Parent category</label>
          <p-dropdown [(ngModel)]="form.parent_id" [options]="parentOptions"
            optionLabel="label" optionValue="value"
            [showClear]="true"
            styleClass="w-full bp-input-edit"
            placeholder="— None (level 0) —">
          </p-dropdown>
          <div class="bp-field-hint">
            Level: {{ form.parent_id ? 1 : 0 }}
            <span *ngIf="form.parent_id"> — child of parent category</span>
          </div>
        </div>

        <div class="mb-4">
          <label class="bp-field-label">Tagline</label>
          <input pInputText [(ngModel)]="form.tagline" class="w-full bp-input-edit" placeholder="Short one-line description"/>
        </div>

        <div class="mb-4">
          <label class="bp-field-label">Description</label>
          <textarea pInputTextarea [(ngModel)]="form.description" class="w-full bp-input-edit" [rows]="3" style="resize:none;" placeholder="Describe this category..."></textarea>
        </div>

        <div class="mb-4" *ngIf="!isAreaForm && form.parent_id">
          <label class="bp-field-label">Model</label>
          <input pInputText [(ngModel)]="form.model" class="w-full bp-input-edit" placeholder="A / B / C / D" maxlength="1"/>
          <div class="bp-field-hint">For A/B/C/D taxonomy — optional</div>
        </div>

        <div class="mb-4" *ngIf="!isAreaForm">
          <label class="bp-field-label">Tags <span class="bp-field-hint-inline">— press Enter to add</span></label>
          <p-chips [(ngModel)]="form.tags" styleClass="w-full bp-input-edit" [allowDuplicate]="false" [addOnBlur]="true" placeholder="e.g. build, structure..."></p-chips>
        </div>

        <div class="mb-4" *ngIf="isAreaForm">
          <label class="bp-field-label">Sort order</label>
          <p-inputNumber [(ngModel)]="form.sort_order" [showButtons]="true" [min]="0" inputStyleClass="w-full bp-input-edit"></p-inputNumber>
          <div class="bp-field-hint">Controls left-to-right order in the area circles row</div>
        </div>

        <div class="mb-4" *ngIf="isAreaForm">
          <div class="bp-field-hint">Tip: click the pencil on an area circle to change its icon and colour.</div>
        </div>

        <div *ngIf="!isAreaForm">
          <label class="bp-field-label">Status</label>
          <div class="flex items-center gap-3 mt-1">
            <p-inputSwitch [(ngModel)]="form.enabled"></p-inputSwitch>
            <span style="font-size:var(--text-sm);color:var(--color-text-secondary);">
              {{ form.enabled ? 'Enabled' : 'Disabled' }}
            </span>
          </div>
        </div>

        <div *ngIf="showImagePanel" class="mt-4">
          <app-image-upload-panel
            [entityId]="form.id || 'new'"
            type="category"
            [existingCoverUrl]="form.cover_image_url || ''"
            [existingCardColor]="form.card_color || ''"
            [existingIconName]="form.icon_name || ''"
            [existingIconColor]="form.icon_color || ''"
            [searchTerm]="form.name || ''"
            (imagesUpdated)="onDrawerImageUpdated($event)"
            (closed)="showImagePanel = false">
          </app-image-upload-panel>
        </div>
      </div>

      <ng-template pTemplate="footer">
        <div class="bp-drawer-ops-footer">
          <div>
            <p-button *ngIf="form.id" label="Delete" icon="pi pi-trash"
              styleClass="p-button-danger" (onClick)="deleteCategory()">
            </p-button>
          </div>
          <div class="flex gap-2">
            <p-button *ngIf="!isAreaForm" label="Add image" icon="pi pi-image"
              styleClass="p-button-outlined" (onClick)="showImagePanel = !showImagePanel">
            </p-button>
            <p-button label="Cancel" styleClass="bp-btn-cancel" (onClick)="closeDrawer()"></p-button>
            <p-button [label]="form.id ? 'Save' : 'Create'" styleClass="bp-btn-save"
              [disabled]="!form.name?.trim() || !form.namespace"
              (onClick)="submit()">
            </p-button>
          </div>
        </div>
      </ng-template>

    </p-sidebar>

    <p-toast></p-toast>
  `,
  styles: [`
    /* ── NAMESPACE CIRCLES ── */
    .bp-ns-circles-wrap { padding: 20px 28px 4px; border-bottom: 0.5px solid var(--color-border); overflow: visible; }
    .bp-ns-circles { display: flex; gap: 20px; justify-content: center; padding: 4px 4px 16px; }
    .bp-ns-circle-btn { display: flex; flex-direction: column; align-items: center; gap: 6px; background: none; border: none; cursor: pointer; padding: 0; }
    .bp-ns-circle {
      width: 68px; height: 68px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      border: 2.5px solid transparent; transition: border-color 0.15s;
      color: var(--theme-accent);
      box-shadow: 0 0 0 0.5px var(--color-border);
    }
    .bp-ns-circle-btn.active .bp-ns-circle {
      border-color: var(--theme-accent);
      box-shadow: 0 0 0 2px var(--theme-accent);
    }
    .bp-ns-circle-label { font-size: 11px; font-weight: 500; color: var(--color-text-secondary); font-family: var(--font-body); }
    .bp-ns-circle-btn.active .bp-ns-circle-label { color: var(--theme-accent); font-weight: 600; }

    /* ── ADD BUTTON ── */
    .bp-add-btn {
      display: flex; align-items: center; gap: 4px;
      padding: 5px 14px; font-size: 12px; font-weight: 500;
      font-family: var(--font-body); border: 1px solid var(--theme-accent);
      background: transparent; color: var(--theme-accent);
      border-radius: 6px; cursor: pointer; transition: all 0.15s;
    }
    .bp-add-btn:hover { background: var(--theme-accent); color: #fff; }

    /* ── FIELD HINT ── */
    .bp-field-hint { font-size: 10px; color: var(--color-text-muted); margin-top: 4px; }
    .bp-field-hint-inline { font-size: 10px; color: var(--color-text-muted); font-weight: 400; }

    /* ── OBJECT TYPE TOGGLE ── */
    :host ::ng-deep .bp-object-type-toggle.p-selectbutton .p-button {
      padding: 6px 16px !important; font-size: 12px !important; font-weight: 500 !important;
      border-color: var(--color-border) !important;
      background: var(--color-surface) !important; color: var(--color-text-muted) !important;
    }
    :host ::ng-deep .bp-object-type-toggle.p-selectbutton .p-highlight {
      background: var(--theme-accent) !important; color: #fff !important;
      border-color: var(--theme-accent) !important;
    }
  `]
})
export class CategoriesComponent implements OnInit {
  loading = true;
  allCategories: Category[] = [];
  // Area rows live in shared.feedback_categories (cross-environment), loaded
  // separately via FeedbackService when the 'area' namespace is selected.
  areaCategories: FeedbackCategory[] = [];
  selectedNamespace: NamespaceId = 'all';
  emptySet = new Set<string>();

  namespaces: NamespaceOption[] = [
    { id: 'all',       label: 'All',       icon: 'layers',         bg: 'var(--color-surface)' },
    { id: 'catalogue', label: 'Catalogue', icon: 'shopping-bag',   bg: 'var(--theme-bg)' },
    { id: 'feedback',  label: 'Feedback',  icon: 'message-square', bg: 'var(--theme-bg)' },
    { id: 'area',      label: 'Area',      icon: 'compass',        bg: 'var(--theme-bg)' }
  ];

  namespaceOptions = [
    { label: 'Catalogue', value: 'catalogue' },
    { label: 'Feedback',  value: 'feedback'  },
    { label: 'Area',      value: 'area'      }
  ];

  objectTypeOptions = [
    { label: 'Folder type', value: 'folder' },
    { label: 'Issue type',  value: 'issue'  }
  ];

  // Data passed to CatalogueGridComponent
  catEntities: CatalogueEntity[] = [];
  circleCategories: CategoryInfo[] = [];
  availableTags: string[] = [];

  // Drawer state
  showDrawer = false;
  showImagePanel = false;
  form: any = this.emptyForm();
  parentOptions: { label: string; value: string }[] = [];

  // Image upload (from grid circle/card edit on catalogue / feedback rows)
  uploadCatId = '';
  uploadCoverUrl = '';
  uploadCardColor = '';
  uploadIconName = '';
  uploadIconColor = '';
  uploadSearchTerm = '';

  // Icon-only upload (for area rows in shared.feedback_categories)
  uploadAreaId = '';
  uploadAreaIconName = '';
  uploadAreaIconColor = '';
  uploadAreaName = '';

  constructor(
    private catSvc: CategoryService,
    private feedbackSvc: FeedbackService,
    private msg: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // Load both catalogue/feedback (per-env) and area (shared) in parallel.
    let pending = 2;
    const done = () => { if (--pending === 0) { this.loading = false; this.rebuild(); this.cdr.detectChanges(); } };
    this.catSvc.getAll().subscribe({
      next: (cats) => {
        this.allCategories = (cats || []).map((c: any) => ({ ...c, enabled: c.enabled !== false }));
        done();
      },
      error: () => done()
    });
    this.feedbackSvc.getFeedbackCategories('area').subscribe({
      next: (areas) => { this.areaCategories = areas || []; done(); },
      error: () => done()
    });
  }

  private emptyForm() {
    return {
      id: '', name: '', namespace: 'catalogue', object_type: 'folder',
      parent_id: null, tagline: '', description: '', model: '',
      tags: [], enabled: true, sort_order: 0,
      cover_image_url: '', card_color: '', icon_name: '', icon_color: 'var(--theme-bg)'
    };
  }

  // Convenience getter — drawer hides catalogue/feedback-only fields when true.
  get isAreaForm(): boolean { return this.form?.namespace === 'area'; }

  setNamespace(ns: NamespaceId) {
    this.selectedNamespace = ns;
    this.rebuild();
    this.cdr.detectChanges();
  }

  private rebuild() {
    if (this.selectedNamespace === 'area') {
      this.rebuildAreas();
      return;
    }
    const filtered = this.allCategories.filter(c =>
      this.selectedNamespace === 'all' || (c.namespace || 'catalogue') === this.selectedNamespace
    );

    // Map to CategoryInfo (circles) — include all levels so child rows work
    this.circleCategories = filtered.map(c => this.toCategoryInfo(c));

    // Map to CatalogueEntity (cards in grid body)
    this.catEntities = filtered.map(c => this.toEntity(c));

    // Aggregate unique tags
    const tagSet = new Set<string>();
    filtered.forEach(c => (c.tags || []).forEach(t => tagSet.add(t)));
    this.availableTags = Array.from(tagSet).sort();

    // Parent options for drawer (level-0 only)
    this.parentOptions = this.allCategories
      .filter(c => !c.parent_id)
      .map(c => ({ label: `${c.name} (${c.namespace || 'catalogue'})`, value: c.id }));
  }

  private rebuildAreas() {
    const sorted = [...this.areaCategories].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    this.circleCategories = sorted.map(a => ({
      id: a.id,
      name: a.name,
      icon_name: a.icon_name,
      icon_color: a.icon_color,
      tagline: a.tagline,
      description: a.description,
      namespace: 'area'
    }));
    this.catEntities = sorted.map(a => ({
      id: a.id,
      name: a.name,
      description: a.description,
      icon: a.icon_name,
      subtitle: `Area · sort ${a.sort_order ?? 0}`,
      categoryLabel: 'area',
      category_id: a.id,
      specs: [
        { label: 'Namespace',  value: 'area' },
        { label: 'Sort order', value: String(a.sort_order ?? 0) },
        { label: 'Icon',       value: a.icon_name || '—' }
      ],
      _raw: a
    }));
    this.availableTags = [];
    this.parentOptions = [];
  }

  private toCategoryInfo(c: Category): CategoryInfo {
    return {
      id: c.id,
      name: c.name,
      cover_image_url: c.cover_image_url,
      logo_url: c.logo_url,
      icon_name: c.icon_name,
      icon_color: c.icon_color,
      parent_id: c.parent_id || undefined,
      tagline: c.tagline,
      description: c.description,
      model: c.model || 'A',
      namespace: c.namespace,
      object_type: c.object_type,
      enabled: c.enabled,
      card_color: c.card_color,
      tags: c.tags
    };
  }

  private toEntity(c: Category): CatalogueEntity {
    const level = c.parent_id ? 1 : 0;
    const parentName = c.parent_id
      ? (this.allCategories.find(p => p.id === c.parent_id)?.name || '')
      : '';
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      cover_image_url: c.cover_image_url,
      logo_url: c.logo_url,
      image_display: 'cover',
      // Category_id drives grid filtering by selected circle:
      // level-0 → own id (itself appears when its own circle is active)
      // level-1 → parent_id (appears under parent)
      category_id: c.parent_id || c.id,
      subtitle: `${c.namespace || 'catalogue'} · level ${level}`,
      categoryLabel: parentName || (c.namespace || 'catalogue'),
      icon: c.icon_name,
      specs: [
        { label: 'Namespace',   value: c.namespace || 'catalogue' },
        { label: 'Level',       value: String(level) },
        { label: 'Object type', value: c.object_type || '—' },
        { label: 'Enabled',     value: c.enabled !== false ? 'Yes' : 'No' }
      ],
      _raw: c
    };
  }

  // ── Events from CatalogueGridComponent ──────────────────────────────────

  onEntitySelected(_e: CatalogueEntity) { /* detail panel is built-in */ }

  onAction(e: CatalogueEntity) {
    // "Edit" button clicked in detail panel → open drawer
    if (this.selectedNamespace === 'area') {
      const area = this.areaCategories.find(a => a.id === e.id);
      if (area) this.openEditArea(area);
      return;
    }
    const cat = this.allCategories.find(c => c.id === e.id);
    if (cat) this.openEdit(cat);
  }

  onImageEdit(e: CatalogueEntity) {
    if (this.selectedNamespace === 'area') {
      const area = this.areaCategories.find(a => a.id === e.id);
      if (area) this.beginAreaIconEdit(area);
      return;
    }
    const cat = this.allCategories.find(c => c.id === e.id);
    if (!cat) return;
    this.beginImageUpload(cat);
  }

  onCategoryImageEdit(ci: CategoryInfo) {
    if (this.selectedNamespace === 'area') {
      const area = this.areaCategories.find(a => a.id === ci.id);
      if (area) this.beginAreaIconEdit(area);
      return;
    }
    const cat = this.allCategories.find(c => c.id === ci.id);
    if (!cat) return;
    this.beginImageUpload(cat);
  }

  private beginAreaIconEdit(a: FeedbackCategory) {
    this.uploadAreaId = a.id;
    this.uploadAreaIconName = a.icon_name || '';
    this.uploadAreaIconColor = a.icon_color || 'var(--theme-bg)';
    this.uploadAreaName = a.name;
    this.cdr.detectChanges();
  }

  onAreaIconUpdated(event: { iconName?: string; iconColor?: string }) {
    const a = this.areaCategories.find(x => x.id === this.uploadAreaId);
    if (a) {
      if (event.iconName !== undefined) a.icon_name = event.iconName;
      if (event.iconColor !== undefined) a.icon_color = event.iconColor;
      this.rebuild();
    }
    this.uploadAreaId = '';
    this.cdr.detectChanges();
  }

  private openEditArea(a: FeedbackCategory) {
    this.form = {
      ...this.emptyForm(),
      id: a.id,
      name: a.name || '',
      namespace: 'area',
      object_type: null,
      parent_id: null,
      tagline: a.tagline || '',
      description: a.description || '',
      sort_order: a.sort_order ?? 0,
      icon_name: a.icon_name || '',
      icon_color: a.icon_color || 'var(--theme-bg)'
    };
    this.showImagePanel = false;
    this.showDrawer = true;
    this.cdr.detectChanges();
  }

  private beginImageUpload(cat: Category) {
    this.uploadCatId = cat.id;
    this.uploadCoverUrl = cat.cover_image_url || '';
    this.uploadCardColor = cat.card_color || '';
    this.uploadIconName = cat.icon_name || '';
    this.uploadIconColor = cat.icon_color || 'var(--theme-bg)';
    this.uploadSearchTerm = cat.name;
    this.cdr.detectChanges();
  }

  onCatImageUpdated(event: { coverUrl?: string; cardColor?: string; iconName?: string; iconColor?: string }) {
    const cat = this.allCategories.find(c => c.id === this.uploadCatId);
    if (!cat) { this.uploadCatId = ''; return; }
    const patch: any = {};
    if (event.coverUrl !== undefined) { cat.cover_image_url = event.coverUrl; patch.cover_image_url = event.coverUrl; }
    if (event.cardColor !== undefined) { cat.card_color = event.cardColor; patch.card_color = event.cardColor; }
    if (event.iconName !== undefined) { cat.icon_name = event.iconName; patch.icon_name = event.iconName; }
    if (event.iconColor !== undefined) { cat.icon_color = event.iconColor; patch.icon_color = event.iconColor; }
    this.rebuild();
    this.catSvc.patch(cat.id, patch).subscribe({
      next: () => this.cdr.detectChanges(),
      error: () => this.msg.add({ severity: 'error', summary: 'Failed to save image' })
    });
    this.uploadCatId = '';
    this.cdr.detectChanges();
  }

  // ── Drawer ──────────────────────────────────────────────────────────────

  openAdd() {
    this.form = this.emptyForm();
    if (this.selectedNamespace !== 'all') this.form.namespace = this.selectedNamespace;
    this.showImagePanel = false;
    this.showDrawer = true;
    this.cdr.detectChanges();
  }

  openEdit(c: Category) {
    this.form = {
      id: c.id,
      name: c.name || '',
      namespace: c.namespace || 'catalogue',
      object_type: c.object_type || 'folder',
      parent_id: c.parent_id || null,
      tagline: c.tagline || '',
      description: c.description || '',
      model: c.model || '',
      tags: c.tags ? [...c.tags] : [],
      enabled: c.enabled !== false,
      cover_image_url: c.cover_image_url || '',
      card_color: c.card_color || '',
      icon_name: c.icon_name || '',
      icon_color: c.icon_color || 'var(--theme-bg)'
    };
    this.showImagePanel = false;
    this.showDrawer = true;
    this.cdr.detectChanges();
  }

  closeDrawer() {
    this.showDrawer = false;
    this.showImagePanel = false;
    this.cdr.detectChanges();
  }

  onNamespaceFormChange() {
    if (this.form.namespace !== 'feedback') this.form.object_type = null;
    else if (!this.form.object_type) this.form.object_type = 'folder';
  }

  onDrawerImageUpdated(event: { coverUrl?: string; cardColor?: string; iconName?: string; iconColor?: string }) {
    if (event.coverUrl !== undefined) this.form.cover_image_url = event.coverUrl;
    if (event.cardColor !== undefined) this.form.card_color = event.cardColor;
    if (event.iconName !== undefined) this.form.icon_name = event.iconName;
    if (event.iconColor !== undefined) this.form.icon_color = event.iconColor;
    this.cdr.detectChanges();
  }

  submit() {
    if (!this.form.name?.trim() || !this.form.namespace) return;
    if (this.form.namespace === 'area') return this.submitArea();

    const payload: any = {
      name: this.form.name.trim(),
      namespace: this.form.namespace,
      parent_id: this.form.parent_id || null,
      tagline: this.form.tagline || null,
      description: this.form.description || null,
      tags: this.form.tags || [],
      enabled: this.form.enabled,
      model: this.form.model || 'A',
      cover_image_url: this.form.cover_image_url || null,
      card_color: this.form.card_color || null,
      icon_name: this.form.icon_name || null,
      icon_color: this.form.icon_color || null,
      object_type: this.form.namespace === 'feedback' ? (this.form.object_type || 'folder') : null
    };
    const obs = this.form.id
      ? this.catSvc.patch(this.form.id, payload)
      : this.catSvc.create(payload);

    obs.subscribe({
      next: (saved: any) => {
        const normalised = { ...saved, enabled: saved.enabled !== false };
        const idx = this.allCategories.findIndex(c => c.id === saved.id);
        if (idx > -1) this.allCategories[idx] = normalised;
        else this.allCategories = [...this.allCategories, normalised];
        this.rebuild();
        this.closeDrawer();
        this.msg.add({ severity: 'success', summary: this.form.id ? 'Category saved' : 'Category created' });
        this.cdr.detectChanges();
      },
      error: () => this.msg.add({ severity: 'error', summary: 'Failed to save category' })
    });
  }

  private submitArea() {
    const payload: Partial<FeedbackCategory> = {
      name: this.form.name.trim(),
      namespace: 'area',
      object_type: undefined,  // server stores NULL for areas
      tagline: this.form.tagline || undefined,
      description: this.form.description || undefined,
      icon_name: this.form.icon_name || undefined,
      icon_color: this.form.icon_color || undefined,
      sort_order: this.form.sort_order ?? 0
    };
    const obs = this.form.id
      ? this.feedbackSvc.patchFeedbackCategory(this.form.id, payload)
      : this.feedbackSvc.createFeedbackCategory(payload);
    obs.subscribe({
      next: (saved) => {
        const idx = this.areaCategories.findIndex(a => a.id === saved.id);
        if (idx > -1) this.areaCategories[idx] = saved;
        else this.areaCategories = [...this.areaCategories, saved];
        this.rebuild();
        this.closeDrawer();
        this.msg.add({ severity: 'success', summary: this.form.id ? 'Area saved' : 'Area created' });
        this.cdr.detectChanges();
      },
      error: () => this.msg.add({ severity: 'error', summary: 'Failed to save area' })
    });
  }

  deleteCategory() {
    if (!this.form.id) return;
    const id = this.form.id;
    if (this.form.namespace === 'area') {
      this.feedbackSvc.deleteFeedbackCategory(id).subscribe({
        next: () => {
          this.areaCategories = this.areaCategories.filter(a => a.id !== id);
          this.rebuild();
          this.closeDrawer();
          this.msg.add({ severity: 'success', summary: 'Area deleted' });
          this.cdr.detectChanges();
        },
        error: () => this.msg.add({ severity: 'error', summary: 'Failed to delete area' })
      });
      return;
    }
    this.catSvc.delete(id).subscribe({
      next: () => {
        this.allCategories = this.allCategories.filter(c => c.id !== id);
        this.rebuild();
        this.closeDrawer();
        this.msg.add({ severity: 'success', summary: 'Category deleted' });
        this.cdr.detectChanges();
      },
      error: () => this.msg.add({ severity: 'error', summary: 'Failed to delete category' })
    });
  }
}
