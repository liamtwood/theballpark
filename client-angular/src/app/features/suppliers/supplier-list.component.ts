import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { SupplierService } from '../../core/services/supplier.service';
import { CategoryService } from '../../core/services/category.service';
import { FavouriteService } from '../../core/services/favourite.service';
import { OrgService } from '../../core/services/org.service';
import { ProjectService } from '../../core/services/project.service';
import { ProjectItemService } from '../../core/services/project-item.service';
import { ShellContextService } from '../../core/services/shell-context.service';
import { ConfigService } from '../../core/services/config.service';
import { Org, CatalogueEntity, CategoryInfo, Item, ProjectItem } from '../../models';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { ImageUploadPanelComponent } from '../../shared/components/image-upload-panel/image-upload-panel.component';
import {
  CatalogueGridComponent, CircleSize, DetailSize
} from '../../shared/components/catalogue-grid/catalogue-grid.component';
import {
  ItemDrawerComponent, ItemDrawerMode
} from '../../shared/components/item-drawer/item-drawer.component';
import {
  PageConfigTogglesComponent, Layout, DetailMode, ThemeSwatch
} from '../../shared/components/page-config-toggles/page-config-toggles.component';

@Component({
  selector: 'app-supplier-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule, LucideAngularModule,
    LoadingSpinnerComponent, ImageUploadPanelComponent, CatalogueGridComponent,
    ItemDrawerComponent, PageConfigTogglesComponent
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
          [circleSize]="circleSize"
          [detailSize]="detailSize"
          [detailMode]="detailMode"
          [layout]="layout"
          [projectId]="projectId"
          [projectItems]="projectItems"
          [currentOrgId]="currentOrgId"
          [currentOrgType]="currentOrgType"
          panelContext="marketplace"
          (entitySelected)="onEntitySelected($event)"
          (favouriteToggled)="onFavToggled($event)"
          (imageEditRequested)="onImageEdit($event)"
          (actionClicked)="onAction($event)"
          (parentClicked)="onParentClicked($event)"
          (categoryChanged)="onCategoryChanged($event)"
          (tagChanged)="onTagChanged($event)"
          [subcategories]="availableSubcategories"
          [activeSubcategoryId]="activeSubcategoryId"
          (subcategoryChanged)="onSubcategoryChanged($event)"
          (searchChanged)="onSearchChanged($event)"
          (categoryImageEditRequested)="onCategoryImageEdit($event)"
          (viewRequested)="onViewItem($event)"
          (itemEditRequested)="onItemEditRequested($event)"
          (addToProject)="onAddToProject($event)"
          (removeFromProject)="onRemoveFromProject($event)">
          <div catalogue-toggles class="bp-cat-toggle-wrap">
            <button class="bp-toggle-btn" [class.active]="viewMode === 'items'"
              (click)="switchMode('items')">Items</button>
            <button class="bp-toggle-btn" [class.active]="viewMode === 'suppliers'"
              (click)="switchMode('suppliers')">Suppliers</button>
          </div>

          <!-- Shared config strip controls (toggled by cog in top-nav) -->
          <app-page-config-toggles config-content
            [(pageLabel)]="catalogueTitle"
            (pageLabelChange)="onPageLabelChange($event)"
            [(theme)]="theme"
            (themeChange)="onThemeChange()"
            [(circleSize)]="circleSize"
            (circleSizeChange)="persistConfig()"
            [(view)]="layout"
            (viewChange)="persistConfig()"
            [(detailSize)]="detailSize"
            (detailSizeChange)="persistConfig()"
            [(detailMode)]="detailMode"
            (detailModeChange)="persistConfig()"></app-page-config-toggles>
        </app-catalogue-grid>
      </ng-container>

      <!-- Image upload panels -->
      <app-image-upload-panel
        *ngIf="uploadEntityId && viewMode === 'items'"
        [entityId]="uploadEntityId"
        type="item"
        [existingCoverUrl]="uploadCoverUrl"
        [existingImageDisplay]="uploadImageDisplay"
        [searchTerm]="uploadSearchTerm"
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
        [searchTerm]="uploadSearchTerm"
        (imagesUpdated)="onSupplierImageUpdated($event)"
        (closed)="uploadEntityId = ''">
      </app-image-upload-panel>

      <app-image-upload-panel
        *ngIf="categoryUploadId"
        [entityId]="categoryUploadId"
        type="category"
        [existingCoverUrl]="categoryUploadCoverUrl"
        [existingIconName]="categoryUploadIconName"
        [existingIconColor]="categoryUploadIconColor"
        [searchTerm]="categoryUploadSearchTerm"
        (imagesUpdated)="onCategoryImageUpdated($event)"
        (closed)="categoryUploadId = ''">
      </app-image-upload-panel>

      <!-- v1.17: item drawer for view (always) + edit (own-org items only).
           Same component switches modes via the [mode] input. -->
      <app-item-drawer
        [(visible)]="showItemDrawer"
        [mode]="drawerMode"
        [item]="drawerItem"
        (saved)="onItemSaved($event)"
        (cancelled)="drawerItem = null">
      </app-item-drawer>
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
  /** v1.32: when ?favourites=true is in the URL, restrict the list to
      the user's hearted suppliers (or items) and surface a "My
      Suppliers" hero + back button so the entry-from-dashboard
      context is obvious. */
  favouritesOnly = false;
  activeCategory = 'all';
  activeTag = '';
  /** v1.41 — child-category chip filter on the marketplace. Empty
      string means "All" (no subcategory filter); a UUID filters items
      to exactly that subcategory_id. Cleared on category change. */
  activeSubcategoryId = '';
  availableSubcategories: Array<{ id: string; name: string }> = [];
  /** All catalogue child rows, indexed in memory once on init. The
      chip strip slices this by parent on every category change. */
  private allChildCategories: Array<{ id: string; name: string; parent_id: string; sort_order?: number }> = [];
  searchTerm = '';
  totalItems = 0;
  categoryCounts: Record<string, number> = {};

  // Editable page label bound to the config strip. Kept in sync with
  // ConfigService.catalogueLabel (org-wide) via the config$ subscription
  // in ngOnInit. The hero subtitle on the global app-shell hero also
  // mirrors this label (uppercased) and re-renders on change.
  catalogueTitle = 'Catalogue';

  // Layout-only config strip state — persisted per-user to localStorage
  // with the ballpark:marketplace:* key namespace. Page label lives in
  // ConfigService (org-wide), not here.
  private readonly LS = {
    theme:      'ballpark:marketplace:theme',
    circleSize: 'ballpark:marketplace:circleSize',
    detailSize: 'ballpark:marketplace:detailSize',
    layout:     'ballpark:marketplace:layout',
    detailMode: 'ballpark:marketplace:detailMode'
  };
  theme: ThemeSwatch = '';
  circleSize: CircleSize = 'lg';
  detailSize: DetailSize = 'md';
  layout: Layout = 'card';
  detailMode: DetailMode = 'inline';

  // Image upload
  categoryUploadId = '';
  categoryUploadCoverUrl = '';
  categoryUploadIconName = '';
  categoryUploadIconColor = '';
  categoryUploadSearchTerm = '';
  uploadEntityId = '';
  uploadSearchTerm = '';
  uploadCoverUrl = '';
  uploadLogoUrl = '';

  // Mapped entities
  supplierEntities: CatalogueEntity[] = [];
  itemEntities: CatalogueEntity[] = [];

  // ── v1.17 project-cart + drawer state ───────────────────────────────
  /** projectId from ?projectId= query param. When set, the detail panel's
      + / ♡ buttons wire to ProjectItemService for this project. */
  projectId: string | null = null;
  projectItems: ProjectItem[] = [];
  currentOrgId: string | null = null;
  currentOrgType: string | null = null;
  /** Item drawer state — shared mount handles view + edit. */
  showItemDrawer = false;
  drawerMode: ItemDrawerMode = 'view';
  drawerItem: Item | null = null;

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
    private projectItemSvc: ProjectItemService,
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
    this.loadConfig();
    this.catalogueTitle = this.configSvc.catalogueLabel;

    // v1.22i: ?view=suppliers | items lets the dashboard's Browse
    // Suppliers / My Suppliers links land directly on the Suppliers
    // toggle instead of the default Items view. Read this BEFORE any
    // data loads so loadItems doesn't fire unnecessarily.
    const viewParam = this.route.snapshot.queryParams['view'];
    if (viewParam === 'suppliers' || viewParam === 'items') {
      this.viewMode = viewParam;
    }
    // v1.32: ?favourites=true opt-in. The flag drives both the
    // mapSuppliers/mapItems filter and the hero label/back button.
    this.favouritesOnly = this.route.snapshot.queryParams['favourites'] === 'true';

    // Resolve the current org once on init — drives currentOrgId/Type for
    // the catalogue-grid detail-panel actions (agency vs supplier; isOwner).
    this.orgSvc.getCurrentOrg().subscribe(org => {
      if (org) {
        this.currentOrgId = org.id;
        this.currentOrgType = org.type || null;
        this.cdr.detectChanges();
      }
    });

    const projectId = this.route.snapshot.queryParams['projectId'];
    this.projectId = projectId || null;
    if (projectId) {
      this.projectSvc.getById(projectId).subscribe(p => {
        this.applyShellHero(p ? [p.event_name || p.name || ''] : []);
      });
      // Load the cart so the detail-panel +/♡ buttons reflect existing
      // selections on first paint.
      this.projectItemSvc.getByProject(projectId).subscribe(rows => {
        this.projectItems = rows || [];
        this.cdr.detectChanges();
      });
    } else {
      // Defer past NavigationEnd — AppShell's router subscription resets
      // shellCtx on every navigation, so a synchronous set in ngOnInit
      // would be wiped immediately afterwards.
      setTimeout(() => this.applyShellHero([]), 0);
    }

    this.configSvc.config$.subscribe(cfg => {
      const label = cfg.catalogueLabel || this.configSvc.catalogueLabel;
      if (label && label !== this.catalogueTitle) {
        this.catalogueTitle = label;
      }
      this.applyShellHero(this.shellCtx.current.pills || []);
      this.cdr.detectChanges();
    });

    this.loadCategoryCounts();
    this.categorySvc.getAll('catalogue').subscribe({
      next: cats => {
        const raw = ((cats || []) as any[]).filter((c: any) => c.enabled !== false);
        // v1.41 — cache the child rows once so the chip strip can
        // slice by parent on every category change without another
        // round-trip.
        this.allChildCategories = raw
          .filter((c: any) => c.parent_id)
          .map((c: any) => ({
            id: c.id, name: c.name, parent_id: c.parent_id,
            sort_order: c.sort_order
          }));
        this.categories = raw
          .map((c: any) => ({
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
      // v1.32: re-map so the favourites-only filter responds to
      // toggle events without a manual refresh.
      if (this.favouritesOnly) this.mapSuppliers();
      this.cdr.detectChanges();
    });
    this.favSvc.itemFavIds$.subscribe(ids => {
      this.itemFavIds = new Set(ids);
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy() { this.shellCtx.reset(); }

  private applyShellHero(pills: string[]) {
    // v1.32: hero swaps to "My Suppliers" + "SAVED CATALOGUE" when the
    // list is filtered to favourites.
    // v1.32a: Back button now shows on every supplier-list view (not
    // just the favourites one) — it's reachable from Browse Suppliers
    // on the dashboard and from the top-nav. history.back() with a
    // dashboard fallback handles both cases gracefully.
    const favHero = this.favouritesOnly;
    this.shellCtx.set({
      heroTitle: favHero ? 'My Suppliers' : this.configSvc.platformName,
      heroSub: (favHero ? 'SAVED ' : '') +
               this.configSvc.catalogueLabel.toUpperCase(),
      pills,
      tabs: [],
      back: { label: 'Back', onBack: () => this.goBack() }
    });
  }

  /** v1.32a: history.back() when there's a useful entry, otherwise
      land on the dashboard. Mirrors the supplier-detail goBack(). */
  private goBack() {
    if (history.length > 1) history.back();
    else this.router.navigate(['/']);
  }

  // ── Config strip persistence ──────────────────────────────────────────
  loadConfig() {
    const t  = (localStorage.getItem(this.LS.theme) || '') as ThemeSwatch;
    const cs = (localStorage.getItem(this.LS.circleSize) || 'lg') as CircleSize;
    const ds = (localStorage.getItem(this.LS.detailSize) || 'md') as DetailSize;
    const ly = (localStorage.getItem(this.LS.layout) || 'card') as Layout;
    const dm = (localStorage.getItem(this.LS.detailMode) || 'inline') as DetailMode;
    this.theme = t;
    this.circleSize = cs;
    this.detailSize = ds;
    this.layout = ly;
    this.detailMode = dm;
    this.applyTheme();
  }
  persistConfig() {
    localStorage.setItem(this.LS.theme, this.theme);
    localStorage.setItem(this.LS.circleSize, this.circleSize);
    localStorage.setItem(this.LS.detailSize, this.detailSize);
    localStorage.setItem(this.LS.layout, this.layout);
    localStorage.setItem(this.LS.detailMode, this.detailMode);
  }
  onThemeChange() {
    this.applyTheme();
    this.persistConfig();
  }
  /** Page label is org-wide — write through to ConfigService so the
      top-nav and admin terminology editor see the change too. */
  onPageLabelChange(label: string) {
    this.configSvc.update({ catalogueLabel: label });
  }
  private applyTheme() {
    if (this.theme) document.documentElement.setAttribute('data-theme', this.theme);
    else document.documentElement.removeAttribute('data-theme');
  }

  // ── Data mapping ──────────────────────────────────────────────────────

  mapSuppliers() {
    let filtered = this.suppliers;
    // v1.32: ?favourites=true restricts to hearted suppliers. The fav
    // ids are kept in sync via favSvc.supplierFavIds$ (subscribed in
    // ngOnInit) — same Set powering the heart fill state on cards.
    if (this.favouritesOnly) {
      filtered = filtered.filter(s => this.supplierFavIds.has(s.id));
    }
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
      image_display: i.image_url ? (i.image_display || 'cover') : (i.supplier_image_display || 'cover'),
      subtitle: i.supplier_name,
      category_id: i.category_id,
      // v1.41a — surface subcategory FK so the catalogue grid's
      // internal subcategory-pill filter (cast on `e.subcategory_id`)
      // works on pre-loaded entities too.
      subcategory_id: i.subcategory_id,
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
    if (this.activeSubcategoryId)      params.subcategory_id = this.activeSubcategoryId;
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
    // v1.41 — subcategory chip strip mirrors the active parent.
    // Clear filter + repopulate options.
    this.activeSubcategoryId = '';
    this.availableSubcategories = (catId === 'all')
      ? []
      : this.allChildCategories
          .filter(c => c.parent_id === catId)
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
          .map(c => ({ id: c.id, name: c.name }));
    if (catId !== 'all') this.loadTags(catId);
    if (this.viewMode === 'items') this.loadItems();
    else this.mapSuppliers();
  }

  onTagChanged(tag: string) {
    this.activeTag = tag;
    if (this.viewMode === 'items') this.loadItems();
  }

  /** v1.41 — chip click from <app-catalogue-grid>. '' = All. */
  onSubcategoryChanged(id: string) {
    this.activeSubcategoryId = id || '';
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
    this.uploadSearchTerm = entity.name;
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

  onCategoryImageEdit(cat: CategoryInfo) {
    this.categoryUploadId = cat.id;
    this.categoryUploadCoverUrl = cat.cover_image_url || '';
    this.categoryUploadIconName = cat.icon_name || '';
    this.categoryUploadIconColor = cat.icon_color || '';
    this.categoryUploadSearchTerm = cat.name;
    this.cdr.detectChanges();
  }

  onCategoryImageUpdated(event: { coverUrl: string; cardColor?: string; iconName?: string; iconColor?: string }) {
    const cat = this.categories.find(c => c.id === this.categoryUploadId);
    if (cat) {
      if (event.coverUrl !== undefined) cat.cover_image_url = event.coverUrl;
      if (event.iconName) cat.icon_name = event.iconName;
      if (event.iconColor) cat.icon_color = event.iconColor;
    }
    this.categories = [...this.categories];
    this.categoryUploadId = '';
    this.cdr.detectChanges();
  }

  // ── v1.17 detail-panel action handlers ───────────────────────────────

  /** v1.34a: "View item" navigates to /items/:id.
      v1.36: context=marketplace tells the item page to render the
      marketplace hero (org name + CATALOGUE eyebrow). */
  onViewItem(entity: CatalogueEntity) {
    const params: any = { context: 'marketplace' };
    if (this.projectId) params['projectId'] = this.projectId;
    this.router.navigate(['/items', entity.id], { queryParams: params });
  }

  onItemEditRequested(entity: CatalogueEntity) {
    const raw = this.rawItems.find(i => i.id === entity.id);
    if (!raw) return;
    this.drawerItem = raw as Item;
    this.drawerMode = 'edit';
    this.showItemDrawer = true;
    this.cdr.detectChanges();
  }

  onItemSaved(_item: Item) {
    // Reload items so the updated row reflects in the grid + detail panel.
    this.loadItems();
    this.drawerItem = null;
  }

  onAddToProject(event: { entity: CatalogueEntity; type: 'selected' | 'liked' }) {
    if (!this.projectId) return;
    this.projectItemSvc.add(this.projectId, event.entity.id, event.type).subscribe({
      next: () => this.refreshCart(),
      error: () => {}
    });
  }

  onRemoveFromProject(event: { entity: CatalogueEntity }) {
    if (!this.projectId) return;
    this.projectItemSvc.remove(this.projectId, event.entity.id).subscribe({
      next: () => this.refreshCart(),
      error: () => {}
    });
  }

  private refreshCart() {
    if (!this.projectId) return;
    this.projectItemSvc.getByProject(this.projectId).subscribe(rows => {
      this.projectItems = rows || [];
      this.cdr.detectChanges();
    });
  }
}
