import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { SidebarModule } from 'primeng/sidebar';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LucideAngularModule, MapPin, ChevronRight, Heart } from 'lucide-angular';
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
import { Project, CatalogueEntity, CategoryInfo, Item } from '../../models';

@Component({
  selector: 'app-supplier-detail',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    ButtonModule, DropdownModule, InputTextareaModule, SidebarModule, ToastModule,
    LucideAngularModule,
    GbpPipe, LoadingSpinnerComponent, ImageUploadPanelComponent, CatalogueGridComponent,
    ItemDrawerComponent
  ],
  providers: [MessageService],
  template: `
    <div class="bp-page">
    <app-loading *ngIf="loading"></app-loading>
    <ng-container *ngIf="!loading && supplier">

      <!-- SUPPLIER CATALOGUE via reusable grid.
           showItemEdit surfaces the inline-detail edit pencil so users
           can open the item drawer without first navigating to the
           full-page item detail route.

           The Add item + Upload buttons project through the
           [catalogue-toggles] content slot, which sits inline in the
           section header next to the list/card/table view-toggle —
           matches the standard "actions next to display choices" layout.

           TODO: gate the action buttons on ownership
           (currentUser.org_id === supplier.id) once real auth lands.
           Currently always visible in dev. -->
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
          <!-- Hidden file input; Upload button click forwards to it.
               Stub — onCatalogueUploadSelected toasts filename; real xls
               parsing wires later. -->
          <input #fileInput type="file"
                 accept=".xls,.xlsx,.csv"
                 (change)="onCatalogueUploadSelected($event)"
                 style="display:none"/>
        </div>
      </app-catalogue-grid>

      <!-- Item add/edit drawer — always mounted so the inline-panel pencil
           can open it regardless of the ownsCatalogue / auth state.
           TODO: gate this on ownership once real auth lands. -->
      <app-item-drawer
        [(visible)]="showItemDrawer"
        [item]="editingItem"
        [prefill]="addPrefill"
        (saved)="onItemSaved($event)"
        (cancelled)="onItemDrawerCancelled()">
      </app-item-drawer>

      <!-- Image upload panel for items -->
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
