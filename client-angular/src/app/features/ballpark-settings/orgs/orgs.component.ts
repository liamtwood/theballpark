import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { SidebarModule } from 'primeng/sidebar';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LucideAngularModule } from 'lucide-angular';
import { OrgService } from '../../../core/services/org.service';
import { Org } from '../../../models';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';

@Component({
  selector: 'app-orgs',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TitleCasePipe,
    LucideAngularModule,
    ButtonModule, InputTextModule, DropdownModule, SidebarModule, ToastModule,
    LoadingSpinnerComponent, AvatarComponent, StatusBadgeComponent
  ],
  providers: [MessageService],
  template: `
    <app-loading *ngIf="loading"></app-loading>

    <ng-container *ngIf="!loading">
      <div class="bp-team-page">

        <div class="bp-team-title-bar">
          <h2 class="bp-page-title">Organisations</h2>
        </div>

        <div class="bp-team-body">

          <!-- SIDEBAR -->
          <div class="bp-team-sidebar">
            <div class="bp-sidebar-heading">Sort by</div>
            <div *ngFor="let s of sortOptions"
              class="bp-sidebar-item" [class.active]="currentSort === s.value"
              (click)="setSort(s.value)">
              {{ s.label }}
              <span class="bp-sidebar-arrow">{{ currentSort === s.value ? '↑' : '↕' }}</span>
            </div>

            <hr class="bp-sidebar-divider"/>

            <div class="bp-sidebar-heading">Filter by</div>
            <div class="bp-team-search">
              <i class="pi pi-search" style="color:var(--color-text-muted);font-size:12px;"></i>
              <input pInputText [(ngModel)]="searchTerm" placeholder="Search..."
                class="bp-team-search-input" (ngModelChange)="applyFilters()"/>
            </div>

            <div class="bp-sidebar-sublabel">Type</div>
            <div *ngFor="let t of typeFilters"
              class="bp-sidebar-item" [class.active]="typeFilter === t.value"
              (click)="setTypeFilter(t.value)">
              {{ t.label }}
              <span class="bp-sidebar-count">{{ getTypeCount(t.value) }}</span>
            </div>
          </div>

          <!-- MAIN LIST -->
          <div class="bp-team-main">
            <div class="bp-team-content">
              <div class="bp-section-header">
                <span class="bp-section-title">ORGANISATIONS</span>
                <div class="flex items-center gap-2">
                  <div class="bp-view-toggle">
                    <button class="bp-view-btn" [class.active]="viewMode==='list'" (click)="viewMode='list'" title="List view">
                      <i class="pi pi-bars"></i>
                    </button>
                    <button class="bp-view-btn" [class.active]="viewMode==='grid'" (click)="viewMode='grid'" title="Card view">
                      <i class="pi pi-th-large"></i>
                    </button>
                  </div>
                  <p-button label="Add Org" icon="pi pi-plus" styleClass="p-button-outlined" (onClick)="openAddDrawer()"></p-button>
                </div>
              </div>

              <p *ngIf="filteredOrgs.length===0" class="bp-muted-text">No organisations found.</p>

              <!-- LIST VIEW -->
              <ng-container *ngIf="viewMode==='list'">
                <div *ngFor="let o of filteredOrgs; let last = last"
                  class="bp-member-row bp-member-row-clickable"
                  [style.border-bottom]="!last ? '0.5px solid var(--color-border)' : 'none'"
                  (click)="viewOrg(o)">
                  <div class="flex items-center gap-3">
                    <app-avatar [name]="o.name"></app-avatar>
                    <div>
                      <p class="bp-member-name">{{ o.name }}</p>
                      <p class="bp-muted-text">{{ o.city || '—' }}</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2" (click)="$event.stopPropagation()">
                    <app-status-badge [status]="o.type"></app-status-badge>
                    <app-status-badge [status]="o.subscription_tier"></app-status-badge>
                    <span *ngIf="o.type === 'agency'" class="bp-member-joined">{{ o.balls_balance }} balls</span>
                    <app-status-badge [status]="o.is_active ? 'active' : 'disabled'"></app-status-badge>
                  </div>
                </div>
              </ng-container>

              <!-- GRID VIEW -->
              <div *ngIf="viewMode==='grid'" class="bp-member-grid">
                <div *ngFor="let o of filteredOrgs" class="bp-member-card bp-member-row-clickable"
                  (click)="viewOrg(o)">
                  <div class="flex items-center gap-3 mb-3">
                    <app-avatar [name]="o.name" [size]="44"></app-avatar>
                    <div>
                      <p class="bp-member-name">{{ o.name }}</p>
                      <p class="bp-muted-text">{{ o.city || '—' }}</p>
                    </div>
                  </div>
                  <div class="bp-member-card-footer" (click)="$event.stopPropagation()">
                    <div class="flex items-center gap-2">
                      <app-status-badge [status]="o.type"></app-status-badge>
                      <app-status-badge [status]="o.subscription_tier"></app-status-badge>
                    </div>
                    <span *ngIf="o.type === 'agency'" class="bp-member-joined">{{ o.balls_balance }} balls</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- RIGHT PANEL (placeholder) -->
          <div class="bp-invite-panel">
            <div class="bp-section-header">
              <span class="bp-section-title">SUMMARY</span>
            </div>
            <div class="bp-muted-text mb-2" style="font-size:11px;">{{ orgs.length }} total organisations</div>
            <div style="font-size:12px;color:var(--color-text-secondary);">
              <div class="mb-1">{{ getTypeCount('agency') }} agencies</div>
              <div>{{ getTypeCount('supplier') }} suppliers</div>
            </div>
          </div>

        </div>
      </div>
    </ng-container>

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
    /* Reuses bp-team-* classes from global styles.css */
    .bp-team-content { max-width: 560px; }
  `]
})
export class OrgsComponent implements OnInit {
  loading = true;
  orgs: Org[] = [];
  filteredOrgs: Org[] = [];
  viewMode: 'list' | 'grid' = 'list';
  currentSort = 'name';
  searchTerm = '';
  typeFilter = 'all';

  sortOptions = [
    { label: 'Name', value: 'name' },
    { label: 'City', value: 'city' },
    { label: 'Type', value: 'type' },
    { label: 'Created', value: 'created' }
  ];

  typeFilters = [
    { label: 'All', value: 'all' },
    { label: 'Agency', value: 'agency' },
    { label: 'Supplier', value: 'supplier' }
  ];

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
        this.applyFilters();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  getTypeCount(type: string): number {
    if (type === 'all') return this.orgs.length;
    return this.orgs.filter(o => o.type === type).length;
  }

  setSort(val: string) { this.currentSort = val; this.applyFilters(); }
  setTypeFilter(val: string) { this.typeFilter = val; this.applyFilters(); }

  applyFilters() {
    let list = [...this.orgs];
    if (this.typeFilter !== 'all') {
      list = list.filter(o => o.type === this.typeFilter);
    }
    if (this.searchTerm.trim()) {
      const q = this.searchTerm.toLowerCase();
      list = list.filter(o => o.name?.toLowerCase().includes(q) || (o as any).city?.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      if (this.currentSort === 'name') return (a.name || '').localeCompare(b.name || '');
      if (this.currentSort === 'city') return ((a as any).city || '').localeCompare((b as any).city || '');
      if (this.currentSort === 'type') return (a.type || '').localeCompare(b.type || '');
      if (this.currentSort === 'created') return (b.created_at || '').localeCompare(a.created_at || '');
      return 0;
    });
    this.filteredOrgs = list;
    this.cdr.detectChanges();
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
        this.applyFilters();
        this.closeAddDrawer();
        this.msg.add({ severity: 'success', summary: `${org.name} created` });
      },
      error: () => {
        this.msg.add({ severity: 'error', summary: 'Failed to create organisation' });
      }
    });
  }
}
