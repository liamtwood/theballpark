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
import { EditSectionComponent } from '../../../shared/components/edit-section/edit-section.component';
import { EditFieldComponent } from '../../../shared/components/edit-field/edit-field.component';

@Component({
  selector: 'app-orgs',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TitleCasePipe,
    ButtonModule, InputTextModule, DropdownModule, SidebarModule, ToastModule,
    LoadingSpinnerComponent, CatalogueGridComponent, ImageUploadPanelComponent,
    EditSectionComponent, EditFieldComponent
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
        <p-button catalogue-toggles label="+ Add org"
          styleClass="p-button-outlined bp-section-add-btn"
          (onClick)="openAddDrawer()"></p-button>
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
        <!-- v1.66dr — Tier 2: always-edit add form on the shared standard
             (edit-section editable=false + edit-field, drawer density). Type
             stays a bespoke dropdown (EF-select zero-shift is a follow-up). -->
        <app-edit-section title="Details" density="drawer" [editable]="false">
          <div class="bp-field-grid-2">
            <app-edit-field span2 label="Organisation name *" density="drawer" [editing]="true"
                            [(value)]="addForm.name" placeholder="Organisation name"></app-edit-field>
            <div class="bp-field bp-field-s2 bp-field--drawer">
              <label class="bp-field-label">Type</label>
              <p-dropdown [(ngModel)]="addForm.type" [options]="typeOptions"
                optionLabel="label" optionValue="value"
                styleClass="w-full bp-input-edit" placeholder="Select type">
              </p-dropdown>
            </div>
            <app-edit-field span2 label="City" density="drawer" [editing]="true" [(value)]="addForm.city" placeholder="City"></app-edit-field>
            <app-edit-field span2 label="Email" type="email" density="drawer" [editing]="true" [(value)]="addForm.email" placeholder="contact@company.com"></app-edit-field>
          </div>
        </app-edit-section>
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
        <!-- v1.66dr — read-only view on the shared standard (edit-field
             readonlyAlways = transparent, zero-shift, drawer density). -->
        <app-edit-section title="Details" density="drawer" [editable]="false">
          <div class="bp-field-grid-2">
            <app-edit-field span2 label="Name" density="drawer" readonlyAlways [value]="selectedOrg.name"></app-edit-field>
            <app-edit-field label="Type" density="drawer" readonlyAlways [value]="selectedOrg.type | titlecase"></app-edit-field>
            <app-edit-field label="Subscription" density="drawer" readonlyAlways [value]="selectedOrg.subscription_tier | titlecase"></app-edit-field>
            <app-edit-field label="City" density="drawer" readonlyAlways [value]="$any(selectedOrg).city || '—'"></app-edit-field>
            <app-edit-field label="Email" density="drawer" readonlyAlways [value]="$any(selectedOrg).email || '—'"></app-edit-field>
            <ng-container *ngIf="selectedOrg.type === 'agency'">
              <app-edit-field label="Balls balance" density="drawer" readonlyAlways [value]="selectedOrg.balls_balance"></app-edit-field>
              <app-edit-field label="Monthly allowance" density="drawer" readonlyAlways [value]="selectedOrg.balls_monthly_allowance"></app-edit-field>
            </ng-container>
            <app-edit-field span2 label="Status" density="drawer" readonlyAlways [value]="selectedOrg.is_active ? 'Active' : 'Inactive'"></app-edit-field>
          </div>
        </app-edit-section>
      </div>
    </p-sidebar>

    <p-toast></p-toast>
  `,
  styles: [`
    /* Section-header add button — sized to match the view-toggle row. */
    :host ::ng-deep .bp-section-add-btn .p-button {
      height: 30px; padding: 0 12px;
      font-size: 12px; font-weight: 500;
      font-family: var(--font-body);
    }
  `]
})
export class OrgsComponent implements OnInit {
  loading = true;
  orgs: Org[] = [];
  orgEntities: CatalogueEntity[] = [];
  typeCategories: CategoryInfo[] = [];
  emptySet = new Set<string>();

  // v1.65e7 (p0015) — 'admin' added as a third org type. Platform-
  // admin orgs (e.g. Ballpark itself) sit alongside agencies and
  // suppliers. DB CHECK constraint expanded in
  // migrate-v1.65e7-admin-org-type.js.
  typeOptions = [
    { label: 'Agency',   value: 'agency'   },
    { label: 'Supplier', value: 'supplier' },
    { label: 'Admin',    value: 'admin'    }
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
        { label: 'Type', value: this.orgTypeLabel(o.type) },
        { label: 'Tier', value: o.subscription_tier || 'starter' },
        ...(o.type === 'agency' ? [{ label: 'Balls', value: String(o.balls_balance || 0) }] : [])
      ],
      _raw: o
    }));
  }

  buildTypeCategories() {
    const agencyCount   = this.orgs.filter(o => o.type === 'agency').length;
    const supplierCount = this.orgs.filter(o => o.type === 'supplier').length;
    const adminCount    = this.orgs.filter(o => o.type === 'admin').length;
    this.typeCategories = [
      { id: 'agency',   name: 'Agency',   count: agencyCount   },
      { id: 'supplier', name: 'Supplier', count: supplierCount },
      { id: 'admin',    name: 'Admin',    count: adminCount    }
    ];
  }

  /** v1.65e7 — labelled name for an org.type value (used by the row
      "Type" spec + any future read-only displays). Falls back to a
      title-cased version of the raw value so future types render
      without code change. */
  orgTypeLabel(t: string | undefined | null): string {
    switch (t) {
      case 'agency':   return 'Agency';
      case 'supplier': return 'Supplier';
      case 'admin':    return 'Admin';
      default:         return t ? (t.charAt(0).toUpperCase() + t.slice(1)) : '—';
    }
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
      type: this.addForm.type as 'agency' | 'supplier' | 'admin',
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
