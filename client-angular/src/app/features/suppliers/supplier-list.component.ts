import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { SupplierService } from '../../core/services/supplier.service';
import { CategoryService } from '../../core/services/category.service';
import { FavouriteService } from '../../core/services/favourite.service';
import { OrgService } from '../../core/services/org.service';
import { ProjectService } from '../../core/services/project.service';
import { ShellContextService } from '../../core/services/shell-context.service';
import { ConfigService } from '../../core/services/config.service';
import { Org, CatalogueEntity, CategoryInfo } from '../../models';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { ImageUploadPanelComponent } from '../../shared/components/image-upload-panel/image-upload-panel.component';
import { CatalogueGridComponent } from '../../shared/components/catalogue-grid/catalogue-grid.component';

@Component({
  selector: 'app-supplier-list',
  standalone: true,
  imports: [
    CommonModule, RouterModule, LucideAngularModule,
    LoadingSpinnerComponent, ImageUploadPanelComponent, CatalogueGridComponent
  ],
  template: `
    <div class="bp-page">
      <app-loading *ngIf="loading"></app-loading>
      <ng-container *ngIf="!loading">
        <app-catalogue-grid
          [entities]="currentEntities"
          [categories]="categories"
          [tags]="availableTags"
          [entityType]="entityType"
          [entityLabel]="viewMode === 'suppliers' ? 'supplier' : 'item'"
          [actionLabel]="viewMode === 'suppliers' ? 'View supplier' : '+ Add to Project'"
          [favouriteIds]="currentFavIds"
          [totalCount]="totalItems"
          (entitySelected)="onEntitySelected($event)"
          (favouriteToggled)="onFavToggled($event)"
          (imageEditRequested)="onImageEdit($event)"
          (actionClicked)="onAction($event)"
          (parentClicked)="onParentClicked($event)"
          (categoryChanged)="onCategoryChanged($event)"
          (tagChanged)="onTagChanged($event)"
          (searchChanged)="onSearchChanged($event)">
          <div catalogue-toggles class="bp-cat-toggle-wrap">
            <button class="bp-toggle-btn" [class.active]="viewMode === 'items'"
              (click)="switchMode('items')">Items</button>
            <button class="bp-toggle-btn" [class.active]="viewMode === 'suppliers'"
              (click)="switchMode('suppliers')">Suppliers</button>
          </div>
        </app-catalogue-grid>
      </ng-container>

      <!-- Image upload panels -->
      <app-image-upload-panel
        *ngIf="uploadEntityId && viewMode === 'items'"
        [entityId]="uploadEntityId"
        type="item"
        [existingCoverUrl]="uploadCoverUrl"
        [existingImageDisplay]="uploadImageDisplay"
        (imagesUpdated)="onItemImageUpdated($event)"
        (closed)="uploadEntityId = ''">
      </app-image-upload-panel>

      <app-image-upload-panel
        *ngIf="uploadEntityId && viewMode === 'suppliers'"
        [entityId]="uploadEntityId"
        type="supplier"
        [existingCoverUrl]="uploadCoverUrl"
        [existingLogoUrl]="uploadLogoUrl"
        [existingImageDisplay]="uploadImageDisplay"
        (imagesUpdated)="onSupplierImageUpdated($event)"
        (closed)="uploadEntityId = ''">
      </app-image-upload-panel>
    </div>
  `,
  styles: [`
    .bp-cat-toggle-wrap { display: flex; gap: 0; flex-shrink: 0; border: 0.5px solid var(--color-border); border-radius: 6px; overflow: hidden; }
    .bp-toggle-btn { padding: 5px 14px; font-size: 12px; font-weight: 500; font-family: var(--font-body); border: none; background: var(--color-surface); color: var(--color-text-muted); cursor: pointer; transition: all 0.15s; }
    .bp-toggle-btn.active { background: var(--theme-bg); color: var(--theme-accent); font-weight: 600; }
  `]
})
export class SupplierListComponent implements OnInit, OnDestroy {
  // Raw data
  suppliers: (Org & { category_ids?: string[]; item_count?: number })[] = [];
  rawItems: any[] = [];
  categories: CategoryInfo[] = [];
  availableTags: string[] = [];

  // State
  loading = true;
  viewMode: 'suppliers' | 'items' = 'items';
  activeCategory = 'all';
  activeTag = '';
  searchTerm = '';
  totalItems = 0;
  categoryCounts: Record<string, number> = {};

  // Image upload
  uploadEntityId = '';
  uploadCoverUrl = '';
  uploadLogoUrl = '';

  // Mapped entities
  supplierEntities: CatalogueEntity[] = [];
  itemEntities: CatalogueEntity[] = [];

  get entityType(): 'item' | 'supplier' {
    return this.viewMode === 'suppliers' ? 'supplier' : 'item';
  }
  supplierFavIds = new Set<string>();
  itemFavIds = new Set<string>();

  constructor(
    private supplierSvc: SupplierService,
    private categorySvc: CategoryService,
    private favSvc: FavouriteService,
    private orgSvc: OrgService,
    private projectSvc: ProjectService,
    private shellCtx: ShellContextService,
    private configSvc: ConfigService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  get currentEntities(): CatalogueEntity[] {
    return this.viewMode === 'suppliers' ? this.supplierEntities : this.itemEntities;
  }

  get currentFavIds(): Set<string> {
    return this.viewMode === 'suppliers' ? this.supplierFavIds : this.itemFavIds;
  }

  ngOnInit() {
    const label = this.configSvc.catalogueLabel.toUpperCase();
    const projectId = this.route.snapshot.queryParams['projectId'];
    if (projectId) {
      this.projectSvc.getById(projectId).subscribe(p => {
        this.shellCtx.set({
          heroTitle: this.configSvc.platformName,
          heroSub: label,
          pills: p ? [p.event_name || p.name || ''] : [],
          tabs: []
        });
        this.cdr.detectChanges();
      });
    } else {
      this.shellCtx.set({ heroTitle: this.configSvc.platformName, heroSub: label, pills: [], tabs: [] });
    }

    this.loadCategoryCounts();
    this.categorySvc.getAll().subscribe({
      next: cats => {
        this.categories = ((cats || []) as any[])
          .filter((c: any) => c.enabled !== false)
          .map((c: any) => ({
            id: c.id,
            name: c.name,
            cover_image_url: c.cover_image_url,
            count: this.categoryCounts[c.id] || 0
          }));
        this.cdr.detectChanges();
      },
      error: () => {}
    });

    this.supplierSvc.getAll().subscribe({
      next: (suppliers: Org[]) => {
        this.suppliers = suppliers || [];
        this.mapSuppliers();
        this.loading = false;
        if (this.viewMode === 'items') this.loadItems();
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });

    this.favSvc.supplierFavIds$.subscribe(ids => {
      this.supplierFavIds = new Set(ids);
      this.cdr.detectChanges();
    });
    this.favSvc.itemFavIds$.subscribe(ids => {
      this.itemFavIds = new Set(ids);
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy() { this.shellCtx.reset(); }

  // ── Data mapping ──────────────────────────────────────────────────────

  mapSuppliers() {
    let filtered = this.suppliers;
    if (this.activeCategory !== 'all') {
      filtered = filtered.filter(s => {
        const catIds: string[] = (s as any).category_ids || [];
        return catIds.includes(this.activeCategory);
      });
    }
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(term) ||
        ((s as any).city || '').toLowerCase().includes(term)
      );
    }
    this.supplierEntities = filtered.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      cover_image_url: s.cover_image_url,
      logo_url: s.logo_url,
      image_display: (s as any).image_display || 'cover',
      subtitle: (s as any).city || 'London',
      specs: (s as any).item_count ? [{ label: 'Catalogue items', value: String((s as any).item_count) }] : [],
      _raw: s
    }));
  }

  mapItems() {
    this.itemEntities = (this.rawItems || []).map((i: any) => ({
      id: i.id,
      name: i.name,
      description: i.description,
      image_url: i.image_url,
      external_url: i.external_url,
      cover_image_url: i.supplier_cover_url,
      image_display: i.image_display || 'cover',
      subtitle: i.supplier_name,
      price: i.base_price ? Number(i.base_price) : undefined,
      priceRange: i.min_price && i.max_price ? { min: Number(i.min_price), max: Number(i.max_price) } : undefined,
      unit: i.unit,
      categoryLabel: i.category_name,
      specs: i.lead_time_days ? [{ label: 'Lead time', value: `${i.lead_time_days} working days` }] : [],
      parentEntity: i.supplier_name ? {
        id: i.org_id,
        name: i.supplier_name,
        subtitle: i.supplier_city,
        image_url: i.supplier_cover_url
      } : undefined,
      _raw: i
    }));
  }

  // ── Data loading ──────────────────────────────────────────────────────

  loadItems() {
    const params: any = {};
    if (this.activeCategory !== 'all') params.category_id = this.activeCategory;
    if (this.activeTag) params.tag = this.activeTag;
    this.supplierSvc.getItems(params).subscribe({
      next: (items: any[]) => {
        let result = items || [];
        if (this.searchTerm.trim()) {
          const term = this.searchTerm.toLowerCase();
          result = result.filter(i =>
            i.name.toLowerCase().includes(term) ||
            (i.supplier_name || '').toLowerCase().includes(term)
          );
        }
        this.rawItems = result;
        this.mapItems();
        this.cdr.detectChanges();
      },
      error: () => this.cdr.detectChanges()
    });
  }

  loadCategoryCounts() {
    this.supplierSvc.getItemCounts().subscribe({
      next: (data: any) => {
        this.categoryCounts = data.counts || {};
        this.totalItems = data.total || 0;
        // Update category counts
        this.categories = this.categories.map(c => ({
          ...c,
          count: this.categoryCounts[c.id] || 0
        }));
        this.cdr.detectChanges();
      }
    });
  }

  loadTags(categoryId: string) {
    this.supplierSvc.getTagsByCategory(categoryId).subscribe({
      next: (tags: string[]) => { this.availableTags = (tags || []).sort(); this.cdr.detectChanges(); },
      error: () => this.cdr.detectChanges()
    });
  }

  // ── Event handlers ────────────────────────────────────────────────────

  switchMode(mode: 'items' | 'suppliers') {
    this.viewMode = mode;
    if (mode === 'items') this.loadItems();
    else this.mapSuppliers();
    this.cdr.detectChanges();
  }

  onCategoryChanged(catId: string) {
    this.activeCategory = catId;
    this.activeTag = '';
    this.availableTags = [];
    if (catId !== 'all') this.loadTags(catId);
    if (this.viewMode === 'items') this.loadItems();
    else this.mapSuppliers();
  }

  onTagChanged(tag: string) {
    this.activeTag = tag;
    if (this.viewMode === 'items') this.loadItems();
  }

  onSearchChanged(query: string) {
    this.searchTerm = query;
    if (this.viewMode === 'items') this.loadItems();
    else this.mapSuppliers();
  }

  onEntitySelected(_entity: CatalogueEntity) {}

  onFavToggled(entityId: string) {
    if (this.viewMode === 'suppliers') {
      this.favSvc.toggleSupplier(entityId).subscribe(() => this.cdr.detectChanges());
    } else {
      this.favSvc.toggleItem(entityId).subscribe(() => this.cdr.detectChanges());
    }
  }

  uploadImageDisplay: 'cover' | 'contain' = 'cover';

  onImageEdit(entity: CatalogueEntity) {
    this.uploadEntityId = entity.id;
    this.uploadCoverUrl = entity.cover_image_url || entity.image_url || '';
    this.uploadLogoUrl = entity.logo_url || '';
    this.uploadImageDisplay = entity.image_display || 'cover';
    this.cdr.detectChanges();
  }

  onAction(entity: CatalogueEntity) {
    if (this.viewMode === 'suppliers') {
      this.router.navigate(['/suppliers', entity.id]);
    } else {
      const projectId = this.route.snapshot.queryParams['projectId'];
      if (projectId) {
        this.router.navigate(['/projects', projectId], { queryParams: { addItem: entity.id } });
      }
    }
  }

  onParentClicked(entity: CatalogueEntity) {
    if (entity.parentEntity) {
      this.router.navigate(['/suppliers', entity.parentEntity.id]);
    }
  }

  onItemImageUpdated(event: { coverUrl: string; imageDisplay?: 'cover' | 'contain' }) {
    const raw = this.rawItems.find(i => i.id === this.uploadEntityId);
    if (raw) {
      raw.image_url = event.coverUrl;
      if (event.imageDisplay) raw.image_display = event.imageDisplay;
    }
    this.mapItems();
    this.uploadEntityId = '';
    this.cdr.detectChanges();
  }

  onSupplierImageUpdated(event: { coverUrl: string; logoUrl: string; imageDisplay?: 'cover' | 'contain' }) {
    const raw = this.suppliers.find(s => s.id === this.uploadEntityId);
    if (raw) {
      raw.cover_image_url = event.coverUrl;
      raw.logo_url = event.logoUrl;
      if (event.imageDisplay) (raw as any).image_display = event.imageDisplay;
    }
    this.mapSuppliers();
    this.uploadEntityId = '';
    this.cdr.detectChanges();
  }
}
