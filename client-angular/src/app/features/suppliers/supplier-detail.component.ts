import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
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
import { CategoryService } from '../../core/services/category.service';
import { ShellContextService } from '../../core/services/shell-context.service';
import { GbpPipe } from '../../shared/pipes/gbp.pipe';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { ImageUploadPanelComponent } from '../../shared/components/image-upload-panel/image-upload-panel.component';
import { CatalogueGridComponent } from '../../shared/components/catalogue-grid/catalogue-grid.component';
import { Project, CatalogueEntity, CategoryInfo } from '../../models';

@Component({
  selector: 'app-supplier-detail',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    ButtonModule, DropdownModule, InputTextareaModule, SidebarModule, ToastModule,
    LucideAngularModule,
    GbpPipe, LoadingSpinnerComponent, ImageUploadPanelComponent, CatalogueGridComponent
  ],
  providers: [MessageService],
  template: `
    <div class="bp-page">
    <app-loading *ngIf="loading"></app-loading>
    <ng-container *ngIf="!loading && supplier">

      <!-- SUPPLIER CATALOGUE via reusable grid -->
      <app-catalogue-grid
        [entities]="itemEntities"
        [categories]="categories"
        [childCategories]="childCategories"
        entityType="item"
        entityLabel="item"
        [actionLabel]="'View →'"
        [favouriteIds]="itemFavIds"
        [showEdit]="true"
        [showFavourite]="true"
        [showBack]="true"
        backLabel="Back to catalogue"
        [totalCount]="itemEntities.length"
        sectionTitle="CATALOGUE"
        (entitySelected)="onEntitySelected($event)"
        (favouriteToggled)="onFavToggled($event)"
        (imageEditRequested)="onImageEdit($event)"
        (actionClicked)="onAction($event)"
        (categoryChanged)="onCategoryChanged($event)"
        (backClicked)="goBack()">
      </app-catalogue-grid>

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
  childCategories: CategoryInfo[] = [];
  itemFavIds = new Set<string>();

  // Image upload
  uploadEntityId = '';
  uploadCoverUrl = '';
  uploadImageDisplay: 'cover' | 'contain' = 'cover';

  constructor(
    private route: ActivatedRoute,
    private supplierSvc: SupplierService,
    private projectSvc: ProjectService,
    private favSvc: FavouriteService,
    private orgSvc: OrgService,
    private configService: ConfigService,
    private catSvc: CategoryService,
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
      if (org) { this.ballsBalance = org.balls_balance || 0; this.cdr.detectChanges(); }
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
    const map: Record<string, CategoryInfo> = {};
    for (const item of this.catalogueItems) {
      const key = item.category_id || 'other';
      if (!map[key]) map[key] = {
        id: key,
        name: item.category_name || 'Other',
        cover_image_url: item.category_cover_image_url,
        tagline: item.category_tagline,
        description: item.category_description,
        tags: item.category_tags,
        count: 0
      };
      map[key].count!++;
    }
    this.categories = Object.values(map);
  }

  // ── Event handlers ────────────────────────────────────────────────────

  onCategoryChanged(catId: string) {
    this.childCategories = [];
    if (catId !== 'all') {
      this.catSvc.getChildren(catId).subscribe({
        next: (children) => {
          this.childCategories = children.map(c => ({
            id: c.id, name: c.name, cover_image_url: c.cover_image_url,
            tagline: c.tagline, description: c.description, tags: c.tags
          }));
          this.cdr.detectChanges();
        }
      });
    }
  }

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
    const params: any = {};
    if (this.selectedProjectId) params['projectId'] = this.selectedProjectId;
    this.router.navigate(['/suppliers', this.sid, 'items', entity.id], { queryParams: params });
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
