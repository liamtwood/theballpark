import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { SidebarModule } from 'primeng/sidebar';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { OrgService } from '../../../core/services/org.service';
import { Org, CatalogueEntity, CategoryInfo } from '../../../models';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { CatalogueGridComponent } from '../../../shared/components/catalogue-grid/catalogue-grid.component';
import { ImageUploadPanelComponent } from '../../../shared/components/image-upload-panel/image-upload-panel.component';

@Component({
  selector: 'app-orgs',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TitleCasePipe,
    ButtonModule, InputTextModule, DropdownModule, SidebarModule, ToastModule,
    LoadingSpinnerComponent, CatalogueGridComponent, ImageUploadPanelComponent
  ],
  providers: [MessageService],
  template: `
    <app-loading *ngIf="loading"></app-loading>

    <ng-container *ngIf="!loading">
      <app-catalogue-grid
        [entities]="orgEntities"
        [categories]="typeCategories"
        entityType="supplier"
        entityLabel="organisation"
        sectionTitle="ORGANISATIONS"
        actionLabel="View details"
        [favouriteIds]="emptySet"
        [showEdit]="true"
        [showFavourite]="false"
        [totalCount]="orgs.length"
        (entitySelected)="onEntitySelected($event)"
        (actionClicked)="onAction($event)"
        (imageEditRequested)="onImageEdit($event)">
        <button catalogue-toggles class="bp-add-btn" (click)="openAddDrawer()">
          <i class="pi pi-plus" style="font-size:11px;"></i> Add Org
        </button>
      </app-catalogue-grid>
    </ng-container>

    <!-- Image upload panel -->
    <app-image-upload-panel
      *ngIf="uploadEntityId"
      [entityId]="uploadEntityId"
      type="supplier"
      [existingCoverUrl]="uploadCoverUrl"
      [existingLogoUrl]="uploadLogoUrl"
      [existingImageDisplay]="uploadImageDisplay"
      (imagesUpdated)="onImageUpdated($event)"
      (closed)="uploadEntityId = ''">
    </app-image-upload-panel>

    <!-- ADD ORG DRAWER -->
    <p-sidebar [(visible)]="showAddDrawer" position="right"
      styleClass="bp-drawer" [style]="{width:'480px'}"
      [showCloseIcon]="false"
      (onHide)="closeAddDrawer()">
      <ng-template pTemplate="header">
        <div class="bp-drawer-header-row">
          <div class="bp-drawer-header">
            <span class="bp-drawer-label">ORGANISATION</span>
            <div class="bp-drawer-title">Add organisation</div>
          </div>
          <button class="bp-icon-btn" (click)="closeAddDrawer()" title="Close">
            <i class="pi pi-times"></i>
          </button>
        </div>
      </ng-template>
      <div class="bp-drawer-body">
        <div class="mb-4">
          <label class="bp-field-label">Organisation name *</label>
          <input pInputText [(ngModel)]="addForm.name" class="w-full bp-input-edit" placeholder="Organisation name"/>
        </div>
        <div class="mb-4">
          <label class="bp-field-label">Type</label>
          <p-dropdown [(ngModel)]="addForm.type" [options]="typeOptions"
            optionLabel="label" optionValue="value"
            styleClass="w-full bp-input-edit" placeholder="Select type">
          </p-dropdown>
        </div>
        <div class="mb-4">
          <label class="bp-field-label">City</label>
          <input pInputText [(ngModel)]="addForm.city" class="w-full bp-input-edit" placeholder="City"/>
        </div>
        <div>
          <label class="bp-field-label">Email</label>
          <input pInputText [(ngModel)]="addForm.email" class="w-full bp-input-edit" type="email" placeholder="contact@company.com"/>
        </div>
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Cancel" styleClass="bp-btn-cancel" (onClick)="closeAddDrawer()"></p-button>
        <p-button label="Create organisation" styleClass="bp-btn-save"
          [disabled]="!addForm.name?.trim()"
          (onClick)="submitAdd()">
        </p-button>
      </ng-template>
    </p-sidebar>

    <!-- VIEW ORG DRAWER -->
    <p-sidebar [(visible)]="showViewDrawer" position="right"
      styleClass="bp-drawer" [style]="{width:'480px'}"
      [showCloseIcon]="false"
      (onHide)="closeViewDrawer()">
      <ng-template pTemplate="header">
        <div class="bp-drawer-header-row">
          <div class="bp-drawer-header">
            <span class="bp-drawer-label">ORGANISATION</span>
            <div class="bp-drawer-title">{{ selectedOrg?.name || 'Organisation' }}</div>
          </div>
          <button class="bp-icon-btn" (click)="closeViewDrawer()" title="Close">
            <i class="pi pi-times"></i>
          </button>
        </div>
      </ng-template>
      <div class="bp-drawer-body" *ngIf="selectedOrg">
        <div class="bp-section-header mb-4">
          <span class="bp-section-title">DETAILS</span>
        </div>
        <div class="mb-4">
          <label class="bp-field-label">Name</label>
          <input pInputText [value]="selectedOrg.name" class="w-full bp-field-readonly" readonly/>
        </div>
        <div class="bp-field-grid-2 mb-4">
          <div>
            <label class="bp-field-label">Type</label>
            <input pInputText [value]="selectedOrg.type | titlecase" class="w-full bp-field-readonly" readonly/>
          </div>
          <div>
            <label class="bp-field-label">Subscription</label>
            <input pInputText [value]="selectedOrg.subscription_tier | titlecase" class="w-full bp-field-readonly" readonly/>
          </div>
        </div>
        <div class="bp-field-grid-2 mb-4">
          <div>
            <label class="bp-field-label">City</label>
            <input pInputText [value]="$any(selectedOrg).city || '—'" class="w-full bp-field-readonly" readonly/>
          </div>
          <div>
            <label class="bp-field-label">Email</label>
            <input pInputText [value]="$any(selectedOrg).email || '—'" class="w-full bp-field-readonly" readonly/>
          </div>
        </div>
        <div class="bp-field-grid-2 mb-4" *ngIf="selectedOrg.type === 'agency'">
          <div>
            <label class="bp-field-label">Balls balance</label>
            <input pInputText [value]="selectedOrg.balls_balance" class="w-full bp-field-readonly" readonly/>
          </div>
          <div>
            <label class="bp-field-label">Monthly allowance</label>
            <input pInputText [value]="selectedOrg.balls_monthly_allowance" class="w-full bp-field-readonly" readonly/>
          </div>
        </div>
        <div>
          <label class="bp-field-label">Status</label>
          <input pInputText [value]="selectedOrg.is_active ? 'Active' : 'Inactive'" class="w-full bp-field-readonly" readonly/>
        </div>
      </div>
    </p-sidebar>

    <p-toast></p-toast>
  `,
  styles: [`
    .bp-add-btn {
      display: flex; align-items: center; gap: 4px;
      padding: 5px 14px; font-size: 12px; font-weight: 500;
      font-family: var(--font-body); border: 1px solid var(--theme-accent);
      background: transparent; color: var(--theme-accent);
      border-radius: 6px; cursor: pointer; transition: all 0.15s;
    }
    .bp-add-btn:hover { background: var(--theme-accent); color: #fff; }
  `]
})
export class OrgsComponent implements OnInit {
  loading = true;
  orgs: Org[] = [];
  orgEntities: CatalogueEntity[] = [];
  typeCategories: CategoryInfo[] = [];
  emptySet = new Set<string>();

  typeOptions = [
    { label: 'Agency', value: 'agency' },
    { label: 'Supplier', value: 'supplier' }
  ];

  // Drawers
  showAddDrawer = false;
  showViewDrawer = false;
  selectedOrg: Org | null = null;
  addForm = { name: '', type: 'agency', city: '', email: '' };

  constructor(
    private orgSvc: OrgService,
    private msg: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.orgSvc.getAll().subscribe({
      next: (data) => {
        this.orgs = data || [];
        this.mapOrgs();
        this.buildTypeCategories();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  mapOrgs() {
    this.orgEntities = this.orgs.map(o => ({
      id: o.id,
      name: o.name,
      description: o.description,
      cover_image_url: o.cover_image_url,
      logo_url: o.logo_url,
      image_display: (o as any).image_display || 'cover',
      category_id: o.type,
      subtitle: (o as any).city || '—',
      specs: [
        { label: 'Type', value: o.type === 'agency' ? 'Agency' : 'Supplier' },
        { label: 'Tier', value: o.subscription_tier || 'starter' },
        ...(o.type === 'agency' ? [{ label: 'Balls', value: String(o.balls_balance || 0) }] : [])
      ],
      _raw: o
    }));
  }

  buildTypeCategories() {
    const agencyCount = this.orgs.filter(o => o.type === 'agency').length;
    const supplierCount = this.orgs.filter(o => o.type === 'supplier').length;
    this.typeCategories = [
      { id: 'agency', name: 'Agency', count: agencyCount },
      { id: 'supplier', name: 'Supplier', count: supplierCount }
    ];
  }

  // Image upload
  uploadEntityId = '';
  uploadCoverUrl = '';
  uploadLogoUrl = '';
  uploadImageDisplay: 'cover' | 'contain' = 'cover';

  onEntitySelected(_entity: CatalogueEntity) {}

  onImageEdit(entity: CatalogueEntity) {
    this.uploadEntityId = entity.id;
    this.uploadCoverUrl = entity.cover_image_url || '';
    this.uploadLogoUrl = entity.logo_url || '';
    this.uploadImageDisplay = entity.image_display || 'cover';
    this.cdr.detectChanges();
  }

  onImageUpdated(event: { coverUrl: string; logoUrl: string; imageDisplay?: 'cover' | 'contain' }) {
    const org = this.orgs.find(o => o.id === this.uploadEntityId);
    if (org) {
      org.cover_image_url = event.coverUrl;
      org.logo_url = event.logoUrl;
      if (event.imageDisplay) (org as any).image_display = event.imageDisplay;
    }
    this.mapOrgs();
    this.uploadEntityId = '';
    this.cdr.detectChanges();
  }

  onAction(entity: CatalogueEntity) {
    const org = this.orgs.find(o => o.id === entity.id);
    if (org) this.viewOrg(org);
  }

  viewOrg(o: Org) {
    this.selectedOrg = o;
    this.showViewDrawer = true;
    this.cdr.detectChanges();
  }

  closeViewDrawer() {
    this.showViewDrawer = false;
    this.selectedOrg = null;
    this.cdr.detectChanges();
  }

  openAddDrawer() {
    this.addForm = { name: '', type: 'agency', city: '', email: '' };
    this.showAddDrawer = true;
    this.cdr.detectChanges();
  }

  closeAddDrawer() {
    this.showAddDrawer = false;
    this.cdr.detectChanges();
  }

  submitAdd() {
    if (!this.addForm.name?.trim()) return;
    this.orgSvc.create({
      name: this.addForm.name,
      type: this.addForm.type as 'agency' | 'supplier',
      city: this.addForm.city,
      email: this.addForm.email
    } as any).subscribe({
      next: (org) => {
        this.orgs = [...this.orgs, org];
        this.mapOrgs();
        this.buildTypeCategories();
        this.closeAddDrawer();
        this.msg.add({ severity: 'success', summary: `${org.name} created` });
      },
      error: () => {
        this.msg.add({ severity: 'error', summary: 'Failed to create organisation' });
      }
    });
  }
}
