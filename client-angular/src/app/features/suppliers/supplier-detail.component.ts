import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { SidebarModule } from 'primeng/sidebar';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LucideAngularModule, MapPin, ChevronRight, Heart, SquarePen, Globe, Phone, Mail } from 'lucide-angular';
import { SupplierService } from '../../core/services/supplier.service';
import { ProjectService } from '../../core/services/project.service';
import { FavouriteService } from '../../core/services/favourite.service';
import { OrgService } from '../../core/services/org.service';
import { ConfigService } from '../../core/services/config.service';
import { ShellContextService } from '../../core/services/shell-context.service';
import { GbpPipe } from '../../shared/pipes/gbp.pipe';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { ImageUploadPanelComponent } from '../../shared/components/image-upload-panel/image-upload-panel.component';
import { CatalogueGridComponent } from '../../shared/components/catalogue-grid/catalogue-grid.component';
import { ItemDrawerComponent } from '../../shared/components/item-drawer/item-drawer.component';
import { SupplierDrawerComponent } from '../../shared/components/supplier-drawer/supplier-drawer.component';
import { Project, CatalogueEntity, CategoryInfo, Item, Org } from '../../models';

@Component({
  selector: 'app-supplier-detail',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    ButtonModule, DropdownModule, InputTextareaModule, SidebarModule, ToastModule,
    LucideAngularModule,
    GbpPipe, LoadingSpinnerComponent, ImageUploadPanelComponent, CatalogueGridComponent,
    ItemDrawerComponent, SupplierDrawerComponent
  ],
  providers: [MessageService],
  template: `
    <div class="bp-page">
    <app-loading *ngIf="loading"></app-loading>
    <ng-container *ngIf="!loading && supplier">

      <!-- ═══ HOME / STORE TAB BAR ═══════════════════════════════════
           Reuses the global .bp-hero-tabs / .bp-hero-tab styles from
           styles.css (the same look the project detail tabs use).
           Tabs are page-local state, not routed. -->
      <div class="bp-hero-tabs bp-supplier-tabs">
        <button class="bp-hero-tab"
                [class.active]="activeTab === 'home'"
                (click)="activeTab = 'home'">Home</button>
        <button class="bp-hero-tab"
                [class.active]="activeTab === 'store'"
                (click)="activeTab = 'store'">Store</button>
      </div>

      <!-- ═══ HOME TAB ════════════════════════════════════════════════
           Profile page: cover, logo, description, contact card.
           Edit pencil top-right (always visible in dev — TODO gate on
           currentOrg.id === supplier.id when auth lands). -->
      <ng-container *ngIf="activeTab === 'home'">
        <div class="bp-supplier-home">

          <button class="bp-supplier-home-edit"
                  (click)="openSupplierEditDrawer()"
                  title="Edit supplier details">
            <lucide-icon name="square-pen" [size]="14"></lucide-icon>
          </button>

          <!-- Cover image / logo / initials fallback -->
          <div class="bp-supplier-cover"
               [style.background-image]="supplier.cover_image_url ? 'url(' + supplier.cover_image_url + ')' : null"
               [class.bp-supplier-cover--empty]="!supplier.cover_image_url">
            <div class="bp-supplier-logo-wrap" *ngIf="supplier.logo_url || !supplier.cover_image_url">
              <div class="bp-supplier-logo"
                   [style.background-image]="supplier.logo_url ? 'url(' + supplier.logo_url + ')' : null"
                   [class.bp-supplier-logo--initials]="!supplier.logo_url">
                <span *ngIf="!supplier.logo_url">{{ supplier.name.charAt(0) }}</span>
              </div>
            </div>
          </div>

          <!-- Description (plain text for now — markdown renderer adds later) -->
          <p class="bp-supplier-desc" *ngIf="supplier.description">{{ supplier.description }}</p>
          <p class="bp-supplier-desc bp-supplier-desc--muted" *ngIf="!supplier.description">
            No description yet.
          </p>

          <!-- Contact card — two-column grid, skip null rows -->
          <div class="bp-supplier-card" *ngIf="hasAnyContact()">
            <div class="bp-supplier-row" *ngIf="supplier.address">
              <span class="bp-supplier-row-label">Address</span>
              <span class="bp-supplier-row-value">{{ supplier.address }}</span>
            </div>
            <div class="bp-supplier-row" *ngIf="supplier.city">
              <span class="bp-supplier-row-label">City</span>
              <span class="bp-supplier-row-value">{{ supplier.city }}</span>
            </div>
            <div class="bp-supplier-row" *ngIf="supplier.country">
              <span class="bp-supplier-row-label">Country</span>
              <span class="bp-supplier-row-value">{{ supplier.country }}</span>
            </div>
            <div class="bp-supplier-row" *ngIf="supplier.phone">
              <span class="bp-supplier-row-label">Phone</span>
              <a class="bp-supplier-row-value bp-supplier-link"
                 [href]="'tel:' + supplier.phone">{{ supplier.phone }}</a>
            </div>
            <div class="bp-supplier-row" *ngIf="supplier.email">
              <span class="bp-supplier-row-label">Email</span>
              <a class="bp-supplier-row-value bp-supplier-link"
                 [href]="'mailto:' + supplier.email">{{ supplier.email }}</a>
            </div>
            <div class="bp-supplier-row" *ngIf="supplier.website">
              <span class="bp-supplier-row-label">Website</span>
              <a class="bp-supplier-row-value bp-supplier-link"
                 [href]="supplier.website" target="_blank" rel="noopener">{{ supplier.website }}</a>
            </div>
            <div class="bp-supplier-row">
              <span class="bp-supplier-row-label">VAT</span>
              <span class="bp-supplier-row-value">
                <ng-container *ngIf="supplier.vat_registered">
                  Registered<span *ngIf="supplier.vat_number"> · {{ supplier.vat_number }}</span>
                </ng-container>
                <ng-container *ngIf="!supplier.vat_registered">Not registered</ng-container>
              </span>
            </div>
          </div>
        </div>

        <!-- Supplier edit drawer — mounted at page level (TODO: gate on
             ownership). Visible on Home tab where the pencil lives. -->
        <app-supplier-drawer
          [(visible)]="showSupplierDrawer"
          [supplier]="supplier"
          (saved)="onSupplierSaved($event)"
          (cancelled)="showSupplierDrawer = false">
        </app-supplier-drawer>
      </ng-container>

      <!-- ═══ STORE TAB ═══════════════════════════════════════════════
           The existing catalogue grid + add/upload buttons + item drawer
           + image upload — unchanged behaviour, just gated by tab. -->
      <ng-container *ngIf="activeTab === 'store'">
        <app-catalogue-grid
          [entities]="itemEntities"
          [categories]="categories"
          entityType="item"
          entityLabel="item"
          [actionLabel]="'View →'"
          [favouriteIds]="itemFavIds"
          [showEdit]="true"
          [showItemEdit]="true"
          [showFavourite]="true"
          [showBack]="true"
          backLabel="Back to catalogue"
          [totalCount]="itemEntities.length"
          sectionTitle="CATALOGUE"
          (entitySelected)="onEntitySelected($event)"
          (favouriteToggled)="onFavToggled($event)"
          (imageEditRequested)="onImageEdit($event)"
          (itemEditRequested)="onItemEditRequested($event)"
          (actionClicked)="onAction($event)"
          (backClicked)="goBack()">
          <div catalogue-toggles class="bp-cat-actions">
            <p-button label="+ Add item"
              styleClass="p-button-outlined bp-section-add-btn"
              (onClick)="openAddItemDrawer()">
            </p-button>
            <p-button label="Upload" icon="pi pi-upload"
              styleClass="p-button-outlined bp-section-add-btn"
              (onClick)="fileInput.click()">
            </p-button>
            <input #fileInput type="file"
                   accept=".xls,.xlsx,.csv"
                   (change)="onCatalogueUploadSelected($event)"
                   style="display:none"/>
          </div>
        </app-catalogue-grid>

        <app-item-drawer
          [(visible)]="showItemDrawer"
          [item]="editingItem"
          [prefill]="addPrefill"
          (saved)="onItemSaved($event)"
          (cancelled)="onItemDrawerCancelled()">
        </app-item-drawer>

        <app-image-upload-panel
          *ngIf="uploadEntityId"
          [entityId]="uploadEntityId"
          type="item"
          [existingCoverUrl]="uploadCoverUrl"
          [existingImageDisplay]="uploadImageDisplay"
          (imagesUpdated)="onItemImageUpdated($event)"
          (closed)="uploadEntityId = ''">
        </app-image-upload-panel>
      </ng-container>

    </ng-container>

    <!-- QUOTE DRAWER -->
    <p-sidebar [(visible)]="showQuoteDrawer" position="bottom"
      styleClass="bp-drawer bp-drawer-bottom"
      [style]="{height:'auto'}"
      [showCloseIcon]="false">
      <ng-template pTemplate="header">
        <div class="bp-drawer-header-row">
          <div class="bp-drawer-header">
            <span class="bp-drawer-label">{{ supplier?.name }}</span>
            <div class="bp-drawer-title">{{ selectedItem ? selectedItem.name : 'Custom Quote' }}</div>
          </div>
          <button class="bp-icon-btn" (click)="showQuoteDrawer = false"><i class="pi pi-times"></i></button>
        </div>
      </ng-template>
      <div class="bp-drawer-body">
        <div class="mb-4" *ngIf="projects.length > 0 && !projectPreSelected">
          <label class="bp-field-label">Project</label>
          <p-dropdown [(ngModel)]="selectedProjectId" [options]="projects"
            optionLabel="name" optionValue="id"
            styleClass="w-full bp-input-edit"
            placeholder="Select a project">
          </p-dropdown>
        </div>
        <div class="mb-4" *ngIf="projects.length === 0">
          <label class="bp-field-label">Project</label>
          <p style="font-size:13px;color:var(--color-text-muted);">
            No active projects. <a routerLink="/projects/new" style="color:var(--theme-accent);">Create one first →</a>
          </p>
        </div>
        <div class="mb-4">
          <label class="bp-field-label">Your requirements</label>
          <textarea pInputTextarea [(ngModel)]="quoteBrief" class="w-full bp-input-edit" [rows]="4"
            [placeholder]="selectedItem ? 'Tell ' + supplier?.name + ' what you need for ' + selectedItem.name + '...' : 'Describe what you need...'">
          </textarea>
        </div>
        <div class="bp-review-ball-card">
          <div>
            <div class="bp-review-ball-label">Using 1 {{ creditLabel }}</div>
            <div class="bp-review-ball-after">{{ ballsBalance - 1 }} remaining after send</div>
          </div>
          <div class="bp-review-ball-num">{{ ballsBalance }}→{{ ballsBalance - 1 }}</div>
        </div>
      </div>
      <ng-template pTemplate="footer">
        <div class="bp-drawer-footer">
          <p-button label="Request Quote →" styleClass="bp-drawer-cta w-full"
            [disabled]="!selectedProjectId || !quoteBrief.trim()"
            (onClick)="sendQuote()">
          </p-button>
          <p class="bp-drawer-footer-sub">{{ supplier?.name }} will receive your brief and respond directly.</p>
        </div>
      </ng-template>
    </p-sidebar>

    <p-toast></p-toast>
    </div>
  `,
  styles: [`
    .bp-review-ball-card { display: flex; align-items: center; justify-content: space-between; background: var(--theme-bg); border: 0.5px solid var(--theme-border); border-radius: 10px; padding: 12px 14px; margin-top: 8px; }
    .bp-review-ball-label { font-size: 13px; font-weight: 600; color: var(--theme-accent); margin-bottom: 2px; }
    .bp-review-ball-after { font-size: 11px; color: var(--color-text-muted); }
    .bp-review-ball-num { font-size: 22px; font-weight: 700; color: var(--color-text-primary); }
    :host ::ng-deep .bp-drawer-bottom { border-radius: 16px 16px 0 0; }

    /* Action group projected into catalogue-grid's [catalogue-toggles]
       slot. Sits inline in the section header, between the entity count
       and the list/card/table view-toggle. */
    .bp-cat-actions { display: flex; gap: 8px; align-items: center; }
    :host ::ng-deep .bp-section-add-btn .p-button {
      height: 30px; padding: 0 12px;
      font-size: 12px; font-weight: 500;
      font-family: var(--font-body);
    }

    /* ── Home/Store tab bar ───────────────────────────────────────────
       Reuses .bp-hero-tabs / .bp-hero-tab from styles.css. We just
       center the bar within the page and put a little vertical padding
       so the tabs sit naturally below the shell hero. */
    .bp-supplier-tabs {
      justify-content: center;
      padding: 0 28px;
    }

    /* ── HOME TAB ───────────────────────────────────────────────────── */
    .bp-supplier-home {
      max-width: 720px;
      margin: 0 auto;
      padding: 28px;
      position: relative;
    }
    .bp-supplier-home-edit {
      position: absolute; top: 20px; right: 20px;
      width: 32px; height: 32px;
      display: flex; align-items: center; justify-content: center;
      background: var(--color-surface); border: 0.5px solid var(--theme-border);
      border-radius: 50%; cursor: pointer; color: var(--theme-accent);
      transition: background 0.15s, color 0.15s, border-color 0.15s;
      z-index: 2;
    }
    .bp-supplier-home-edit:hover {
      background: var(--theme-accent); border-color: var(--theme-accent);
      color: var(--color-surface);
    }

    .bp-supplier-cover {
      position: relative;
      height: 200px;
      border-radius: 12px;
      background-size: cover;
      background-position: center;
      border: 0.5px solid var(--color-border);
      margin-bottom: 48px;
    }
    .bp-supplier-cover--empty {
      background: linear-gradient(160deg, var(--theme-bg), var(--theme-border));
    }
    .bp-supplier-logo-wrap {
      position: absolute;
      left: 24px;
      bottom: -32px;
    }
    .bp-supplier-logo {
      width: 80px; height: 80px;
      border-radius: 50%;
      background-size: cover;
      background-position: center;
      border: 3px solid var(--color-surface);
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      display: flex; align-items: center; justify-content: center;
      background-color: var(--theme-bg);
      color: var(--theme-accent);
      font-family: var(--font-display);
      font-size: 32px;
      font-weight: 400;
    }

    .bp-supplier-desc {
      font-size: 14px;
      line-height: 1.6;
      color: var(--color-text-primary);
      margin: 0 0 20px;
      white-space: pre-wrap;
    }
    .bp-supplier-desc--muted { color: var(--color-text-muted); font-style: italic; }

    .bp-supplier-card {
      background: var(--theme-bg);
      border: 0.5px solid var(--theme-border);
      border-radius: 12px;
      padding: 20px;
    }
    .bp-supplier-row {
      display: grid;
      grid-template-columns: 100px 1fr;
      gap: 12px;
      padding: 8px 0;
      font-size: 13px;
      border-bottom: 0.5px solid var(--theme-border);
    }
    .bp-supplier-row:last-child { border-bottom: none; }
    .bp-supplier-row-label {
      color: var(--color-text-muted);
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding-top: 2px;
    }
    .bp-supplier-row-value { color: var(--color-text-primary); word-break: break-word; }
    .bp-supplier-link { color: var(--theme-accent); text-decoration: none; }
    .bp-supplier-link:hover { text-decoration: underline; }
  `]
})
export class SupplierDetailComponent implements OnInit, OnDestroy {
  supplier: any = null;
  catalogueItems: any[] = [];
  projects: Project[] = [];
  loading = true;
  showQuoteDrawer = false;
  selectedItem: any = null;
  selectedProjectId = '';
  quoteBrief = '';
  ballsBalance = 0;
  creditLabel = 'Ball';
  projectPreSelected = false;
  private sid = '';

  // Catalogue grid data
  itemEntities: CatalogueEntity[] = [];
  categories: CategoryInfo[] = [];
  itemFavIds = new Set<string>();

  // Image upload
  uploadEntityId = '';
  uploadCoverUrl = '';
  uploadImageDisplay: 'cover' | 'contain' = 'cover';

  // Item add/edit drawer — only used when current org owns the catalogue
  ownsCatalogue = false;
  showItemDrawer = false;
  editingItem: Item | null = null;

  // Home / Store tabs — default 'home'. Page-local state, not routed.
  activeTab: 'home' | 'store' = 'home';

  // Supplier edit drawer state.
  showSupplierDrawer = false;
  /** Seed values passed to the drawer in add mode. Computed from the
      catalogue-grid's current category filter on each Add click so the
      drawer lands pre-populated with the user's contextual view. */
  addPrefill: { category_id?: string; subcategory_id?: string } | null = null;

  @ViewChild(CatalogueGridComponent) private catGrid?: CatalogueGridComponent;

  constructor(
    private route: ActivatedRoute,
    private supplierSvc: SupplierService,
    private projectSvc: ProjectService,
    private favSvc: FavouriteService,
    private orgSvc: OrgService,
    private configService: ConfigService,
    private shellCtx: ShellContextService,
    private msg: MessageService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.sid = this.route.snapshot.paramMap.get('id') || '';
    this.creditLabel = this.configService.current?.creditLabel || 'Ball';

    const qp = this.route.snapshot.queryParams;
    if (qp['projectId']) { this.selectedProjectId = qp['projectId']; this.projectPreSelected = true; }

    this.orgSvc.getCurrentOrg().subscribe(org => {
      if (org) {
        this.ballsBalance = org.balls_balance || 0;
        this.ownsCatalogue = org.id === this.sid;
        this.cdr.detectChanges();
      }
    });

    this.projectSvc.getAll().subscribe({
      next: projects => {
        this.projects = (projects || []).filter(p => ['active','costing','draft'].includes(p.status_name || ''));
        if (this.projects.length > 0 && !this.projectPreSelected) this.selectedProjectId = this.projects[0].id;
        this.cdr.detectChanges();
      }
    });

    this.supplierSvc.getAll().subscribe({
      next: (suppliers: any[]) => {
        this.supplier = suppliers.find(s => s.id === this.sid) || null;
        if (this.supplier) {
          this.shellCtx.set({ heroTitle: this.supplier.name, heroSub: this.supplier.city || 'London', pills: [], tabs: [] });
        }
        this.cdr.detectChanges();
      }
    });

    this.supplierSvc.getCatalogue(this.sid).subscribe({
      next: (items: any[]) => {
        this.catalogueItems = items || [];
        this.mapItems();
        this.buildCategories();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });

    this.favSvc.itemFavIds$.subscribe(ids => {
      this.itemFavIds = new Set(ids);
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy() { this.shellCtx.reset(); }

  mapItems() {
    this.itemEntities = this.catalogueItems.map((i: any) => ({
      id: i.id,
      name: i.name,
      description: i.description,
      image_url: i.image_url,
      external_url: i.external_url,
      cover_image_url: this.supplier?.cover_image_url,
      image_display: i.image_url ? (i.image_display || 'cover') : (this.supplier?.image_display || 'cover'),
      category_id: i.category_id,
      subtitle: i.category_name,
      price: i.base_price ? Number(i.base_price) : undefined,
      priceRange: i.min_price && i.max_price ? { min: Number(i.min_price), max: Number(i.max_price) } : undefined,
      unit: i.unit,
      categoryLabel: i.category_name,
      specs: i.lead_time_days ? [{ label: 'Lead time', value: `${i.lead_time_days} working days` }] : [],
      _raw: i
    }));
  }

  buildCategories() {
    const map: Record<string, { id: string; name: string; count: number }> = {};
    for (const item of this.catalogueItems) {
      const key = item.category_id || 'other';
      if (!map[key]) map[key] = { id: key, name: item.category_name || 'Other', count: 0 };
      map[key].count++;
    }
    this.categories = Object.values(map);
  }

  // ── Event handlers ────────────────────────────────────────────────────

  goBack() {
    this.router.navigate(['/suppliers']);
  }

  onEntitySelected(_entity: CatalogueEntity) {}

  onFavToggled(entityId: string) {
    this.favSvc.toggleItem(entityId).subscribe(() => this.cdr.detectChanges());
  }

  onImageEdit(entity: CatalogueEntity) {
    this.uploadEntityId = entity.id;
    this.uploadCoverUrl = entity.image_url || '';
    this.uploadImageDisplay = entity.image_display || 'cover';
    this.cdr.detectChanges();
  }

  onAction(entity: CatalogueEntity) {
    // Own-supplier view: tapping the row CTA opens the edit drawer pre-populated.
    // Edit-pencil-on-shared-item-detail is the eventual trigger (deferred until
    // the shared item-detail component lands); for now we re-use actionClicked.
    if (this.ownsCatalogue) {
      const raw = this.catalogueItems.find(i => i.id === entity.id);
      if (raw) this.openEditItemDrawer(raw as Item);
      return;
    }
    const params: any = {};
    if (this.selectedProjectId) params['projectId'] = this.selectedProjectId;
    this.router.navigate(['/suppliers', this.sid, 'items', entity.id], { queryParams: params });
  }

  // ── Item drawer wiring ────────────────────────────────────────────────

  openAddItemDrawer() {
    this.editingItem = null;
    this.addPrefill = this.computeAddPrefill();
    this.showItemDrawer = true;
    this.cdr.detectChanges();
  }

  /** Read the catalogue-grid's current filter state and translate it into
      the drawer's prefill shape. activeCategory is always a top-level id
      (or 'all'); when drilled, drilledCategory carries the parent and
      activeChildCategory may hold the selected subcategory.
      Returns null when there's nothing useful to pre-populate. */
  private computeAddPrefill(): { category_id?: string; subcategory_id?: string } | null {
    const grid = this.catGrid;
    if (!grid) return null;
    let category_id: string | undefined;
    let subcategory_id: string | undefined;
    if (grid.drilledCategory) {
      category_id = grid.drilledCategory.id;
      if (grid.activeChildCategory) subcategory_id = grid.activeChildCategory;
    } else if (grid.activeCategory && grid.activeCategory !== 'all') {
      category_id = grid.activeCategory;
    }
    if (!category_id && !subcategory_id) return null;
    return { category_id, subcategory_id };
  }

  openEditItemDrawer(item: Item) {
    this.editingItem = item;
    this.showItemDrawer = true;
    this.cdr.detectChanges();
  }

  /** Fired from catalogue-grid's inline-detail edit pencil. The grid
      surfaces a CatalogueEntity (display projection); we need the raw
      item row for the drawer's pre-population so we look it up in
      catalogueItems and delegate to openEditItemDrawer. */
  onItemEditRequested(entity: CatalogueEntity) {
    const raw = this.catalogueItems.find(i => i.id === entity.id);
    if (raw) this.openEditItemDrawer(raw as Item);
  }

  onItemSaved(_item: Item) {
    // Refresh the catalogue so the grid reflects the new/updated row.
    this.supplierSvc.getCatalogue(this.sid).subscribe({
      next: (items: any[]) => {
        this.catalogueItems = items || [];
        this.mapItems();
        this.buildCategories();
        this.cdr.detectChanges();
      }
    });
    this.editingItem = null;
  }

  onItemDrawerCancelled() {
    this.editingItem = null;
  }

  // ── Home tab + supplier edit drawer ──────────────────────────────────

  /** Does this supplier have at least one contact-card row worth showing?
      Address/city/country/phone/email/website are optional; VAT always
      shows (Registered / Not registered). */
  hasAnyContact(): boolean {
    const s = this.supplier;
    if (!s) return false;
    return !!(s.address || s.city || s.country || s.phone || s.email || s.website) || true;
    // Note: returning true unconditionally because the VAT row always
    // renders. The early checks remain so a future caller can flip the
    // VAT-always-shown rule by dropping the `|| true`.
  }

  openSupplierEditDrawer() {
    this.showSupplierDrawer = true;
    this.cdr.detectChanges();
  }

  onSupplierSaved(updated: Org) {
    // Replace the rendered supplier with the saved row; shell hero name
    // also updates since it reads supplier.name in onInit. We keep the
    // existing supplier reference's identity by mutation-then-detect to
    // avoid downstream child re-renders if not needed.
    this.supplier = { ...this.supplier, ...updated };
    this.showSupplierDrawer = false;
    // Update the shell hero label so the page header reflects any name change.
    this.shellCtx.set({
      heroTitle: this.supplier.name,
      heroSub: this.supplier.city || 'London',
      pills: [],
      tabs: []
    });
    this.cdr.detectChanges();
  }

  /** Catalogue xls upload — stub for now. We capture the chosen file and
      acknowledge it so the user knows the picker fires; real parsing
      (xlsx → bulk item create) wires later. Resets the input so the same
      file can be re-picked next time. */
  onCatalogueUploadSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) return;
    this.msg.add({
      severity: 'info',
      summary: 'File selected',
      detail: `${file.name} — upload wiring coming next.`,
      life: 4000
    });
    // Reset so picking the same file again still fires change.
    input.value = '';
    this.cdr.detectChanges();
  }

  onItemImageUpdated(event: { coverUrl: string; imageDisplay?: 'cover' | 'contain' }) {
    const raw = this.catalogueItems.find(i => i.id === this.uploadEntityId);
    if (raw) {
      raw.image_url = event.coverUrl;
      if (event.imageDisplay) raw.image_display = event.imageDisplay;
    }
    this.mapItems();
    this.uploadEntityId = '';
    this.cdr.detectChanges();
  }

  sendQuote() {
    this.showQuoteDrawer = false;
    this.msg.add({ severity: 'success', summary: 'Quote requested!', detail: `${this.supplier?.name} will be in touch.`, life: 3000 });
    this.ballsBalance = Math.max(0, this.ballsBalance - 1);
    this.cdr.detectChanges();
  }
}
