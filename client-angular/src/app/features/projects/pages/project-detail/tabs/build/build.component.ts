import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { SidebarModule } from 'primeng/sidebar';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LucideAngularModule, ChevronRight, MapPin } from 'lucide-angular';
import { ProjectCategoryService } from '../../../../../../core/services/project-category.service';
import { CategoryService } from '../../../../../../core/services/category.service';
import { SupplierService } from '../../../../../../core/services/supplier.service';
import { OrgService } from '../../../../../../core/services/org.service';
import { ConfigService } from '../../../../../../core/services/config.service';
import { LoadingSpinnerComponent } from '../../../../../../shared/components/loading-spinner/loading-spinner.component';

interface CategoryWithBrief {
  id: string;
  name: string;
  category_id: string;
  ballpark_cost: number;
  requirement_brief: string;
  status_name: string;
  editingBrief: boolean;
  briefDraft: string;
  selectedVendorIds: string[];
  vendors?: any[];
  vendorsLoaded?: boolean;
}

@Component({
  selector: 'app-build',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    LucideAngularModule,
    ButtonModule, InputTextareaModule,
    SidebarModule, ToastModule, DropdownModule, LoadingSpinnerComponent
  ],
  providers: [MessageService],
  template: `
    <app-loading *ngIf="loading"></app-loading>

    <ng-container *ngIf="!loading">

      <!-- EMPTY STATE -->
      <div *ngIf="categories.length === 0" class="bp-build-empty">
        <div class="bp-build-empty-icon">🏗️</div>
        <h3 class="bp-build-empty-title">No categories yet</h3>
        <p class="bp-build-empty-body">Start with the Brief tab to let AI parse your project brief and populate categories automatically.</p>
        <p-button label="Go to Brief →" styleClass="p-button-outlined" [routerLink]="['../brief']"></p-button>
      </div>

      <!-- CATEGORY LIST -->
      <div *ngIf="categories.length > 0" class="bp-build-body">

        <div class="bp-build-header">
          <div>
            <div class="bp-build-title">Build</div>
            <div class="bp-build-sub">{{ categories.length }} categories · {{ totalSelectedVendors() }} vendors selected</div>
          </div>
          <p-button label="+ Add Category" styleClass="bp-btn-save p-button-sm" (onClick)="openAddCategory()"></p-button>
          <p-button
            *ngIf="totalSelectedVendors() > 0"
            label="Request Quotes →"
            styleClass="bp-btn-request-quote"
            (onClick)="openQuoteReview()">
          </p-button>
        </div>

        <!-- CATEGORY CARDS -->
        <div class="bp-cat-list">
          <div *ngFor="let cat of categories" class="bp-cat-item">

            <!-- CATEGORY HEADER -->
            <div class="bp-cat-header" (click)="toggleCategory(cat)">
              <div class="bp-cat-header-left">
                <lucide-icon [name]="getCatIcon(cat)" [size]="18"
                  style="color: var(--theme-accent);">
                </lucide-icon>
                <div>
                  <div class="bp-cat-name">{{ cat.name }}</div>
                  <div class="bp-cat-cost">Est. {{ fmtCurrency(cat.ballpark_cost) }}
                    <span *ngIf="cat.selectedVendorIds.length > 0" class="bp-cat-vendor-count">
                      · {{ cat.selectedVendorIds.length }} vendor{{ cat.selectedVendorIds.length > 1 ? 's' : '' }} selected
                    </span>
                  </div>
                </div>
              </div>
              <lucide-icon name="chevron-right" [size]="16"
                class="bp-cat-chevron"
                [class.open]="expandedCatId === cat.id">
              </lucide-icon>
            </div>

            <!-- EXPANDED CONTENT -->
            <div *ngIf="expandedCatId === cat.id" class="bp-cat-expanded">

              <!-- BRIEF -->
              <div class="bp-cat-brief-section">
                <div class="bp-cat-section-label">
                  Category Brief
                  <button *ngIf="!cat.editingBrief" class="bp-icon-btn" (click)="startEditBrief(cat); $event.stopPropagation()">
                    <i class="pi pi-pencil"></i>
                  </button>
                </div>
                <div *ngIf="!cat.editingBrief" class="bp-cat-brief-text">
                  {{ cat.requirement_brief || 'No brief yet — click the pencil to add requirements for this category.' }}
                </div>
                <ng-container *ngIf="cat.editingBrief">
                  <textarea pInputTextarea [(ngModel)]="cat.briefDraft"
                    class="w-full bp-input-edit bp-brief-textarea"
                    [rows]="4"
                    placeholder="Describe what you need for this category...">
                  </textarea>
                  <div class="bp-brief-actions">
                    <p-button label="Save" icon="pi pi-check" styleClass="p-button-sm" (onClick)="saveBrief(cat)"></p-button>
                    <p-button label="Cancel" icon="pi pi-times" styleClass="p-button-sm p-button-outlined" (onClick)="cancelBrief(cat)"></p-button>
                  </div>
                </ng-container>
              </div>

              <!-- VENDORS -->
              <div class="bp-cat-section-label" style="margin-top:16px;">
                Select Vendors
                <span class="bp-cat-section-hint">Tap to select · all receive the same brief simultaneously</span>
              </div>

              <app-loading *ngIf="!cat.vendorsLoaded"></app-loading>

              <div *ngIf="cat.vendorsLoaded && cat.vendors?.length === 0" class="bp-vendor-empty">
                No suppliers found for this category yet.
              </div>

              <div *ngIf="cat.vendorsLoaded" class="bp-vendor-list">
                <div *ngFor="let v of cat.vendors"
                  class="bp-vendor-row"
                  [class.selected]="cat.selectedVendorIds.includes(v.id)"
                  (click)="toggleVendor(cat, v.id)">
                  <div class="bp-vendor-img"
                    [style.background-image]="v.cover_image_url ? 'url(' + v.cover_image_url + ')' : null"
                    [class.bp-vendor-grad]="!v.cover_image_url">
                  </div>
                  <div class="bp-vendor-info">
                    <div class="bp-vendor-name">{{ v.name }}</div>
                    <div class="bp-vendor-meta">
                      <lucide-icon name="map-pin" [size]="10"></lucide-icon>
                      {{ v.city || 'London' }}
                    </div>
                  </div>
                  <div class="bp-vendor-check" [class.checked]="cat.selectedVendorIds.includes(v.id)">
                    <i *ngIf="cat.selectedVendorIds.includes(v.id)" class="pi pi-check" style="font-size:10px;"></i>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        <!-- BOTTOM CTA (mobile-sticky) -->
        <div *ngIf="totalSelectedVendors() > 0" class="bp-build-footer">
          <p-button
            label="Request Quotes →"
            styleClass="w-full bp-btn-request-quote"
            (onClick)="openQuoteReview()">
          </p-button>
          <div class="bp-build-footer-sub">{{ ballsBalance }} {{ creditLabel }}{{ ballsBalance !== 1 ? 's' : '' }} remaining · 1 {{ creditLabel }} per category</div>
        </div>

      </div>
    </ng-container>

    <!-- ADD CATEGORY DRAWER -->
    <p-sidebar [(visible)]="showAddCatDrawer" position="bottom" styleClass="bp-drawer bp-drawer-bottom" [style]="{height:'auto'}" [showCloseIcon]="false">
      <ng-template pTemplate="header">
        <div class="bp-drawer-header-row">
          <div class="bp-drawer-header"><div class="bp-drawer-title">Add Category</div></div>
          <button class="bp-icon-btn" (click)="showAddCatDrawer = false"><i class="pi pi-times"></i></button>
        </div>
      </ng-template>
      <div class="bp-drawer-body">
        <label class="bp-field-label">Category</label>
        <p-dropdown [(ngModel)]="selectedNewCatId" [options]="availableCategories" optionLabel="name" optionValue="id" styleClass="w-full bp-input-edit" placeholder="Select a category"></p-dropdown>
      </div>
      <ng-template pTemplate="footer">
        <div class="bp-drawer-footer">
          <p-button label="Add Category" styleClass="bp-drawer-cta w-full" [disabled]="!selectedNewCatId" [loading]="addingCat" (onClick)="addCategory()"></p-button>
        </div>
      </ng-template>
    </p-sidebar>

    <!-- QUOTE REVIEW DRAWER -->
    <p-sidebar [(visible)]="showQuoteDrawer" position="right"
      styleClass="bp-drawer" [style]="{width:'480px'}"
      [showCloseIcon]="false">
      <ng-template pTemplate="header">
        <div class="bp-drawer-header-row">
          <div class="bp-drawer-header">
            <span class="bp-drawer-label">QUOTE REQUEST</span>
            <div class="bp-drawer-title">Ready to send?</div>
          </div>
          <button class="bp-icon-btn" (click)="showQuoteDrawer = false"><i class="pi pi-times"></i></button>
        </div>
      </ng-template>

      <div class="bp-drawer-body">

        <!-- CATEGORIES WITH VENDORS -->
        <div *ngFor="let cat of categoriesWithSelections()" class="bp-review-cat">
          <div class="bp-review-cat-name">{{ cat.name }}</div>
          <div *ngFor="let vid of cat.selectedVendorIds" class="bp-review-vendor">
            <i class="pi pi-check-circle" style="color:var(--theme-accent);font-size:12px;"></i>
            <span>{{ getVendorName(cat, vid) }}</span>
          </div>
          <div class="bp-review-brief" *ngIf="cat.requirement_brief">
            <span class="bp-review-brief-lbl">Brief: </span>{{ cat.requirement_brief }}
          </div>
        </div>

        <!-- BALL COST -->
        <div class="bp-review-ball-card">
          <div class="bp-review-ball-left">
            <div class="bp-review-ball-label">Using {{ categoriesWithSelections().length }} {{ creditLabel }}{{ categoriesWithSelections().length !== 1 ? 's' : '' }}</div>
            <div class="bp-review-ball-after">{{ ballsBalance - categoriesWithSelections().length }} remaining after send</div>
          </div>
          <div class="bp-review-ball-num">{{ ballsBalance }}→{{ ballsBalance - categoriesWithSelections().length }}</div>
        </div>

      </div>

      <ng-template pTemplate="footer">
        <div class="bp-drawer-footer">
          <p-button
            label="Request Quotes →"
            styleClass="bp-drawer-cta w-full"
            [loading]="sending"
            (onClick)="sendQuotes()">
          </p-button>
          <p class="bp-drawer-footer-sub">
            All selected vendors contacted simultaneously.
            This will use {{ categoriesWithSelections().length }} {{ creditLabel }}{{ categoriesWithSelections().length !== 1 ? 's' : '' }}.
          </p>
        </div>
      </ng-template>
    </p-sidebar>

    <p-toast></p-toast>
  `,
  styles: [`
    /* ── LAYOUT ── */
    .bp-build-body   { display: flex; flex-direction: column; min-height: 100%; }
    .bp-build-header { display: flex; align-items: center; justify-content: space-between; padding: 16px var(--section-pad) 12px; border-bottom: 0.5px solid var(--color-border); text-align: center; flex-direction: column; gap: 4px; }
    .bp-build-title  { font-family: var(--font-display); font-size: 22px; font-weight: 400; color: var(--color-text-primary); text-align: center; }
    .bp-build-sub    { font-size: 12px; color: var(--color-text-muted); margin-top: 2px; text-align: center; }

    /* ── EMPTY STATE ── */
    .bp-build-empty       { text-align: center; padding: 80px 24px; }
    .bp-build-empty-icon  { font-size: 48px; margin-bottom: 16px; }
    .bp-build-empty-title { font-family: var(--font-display); font-size: 22px; font-weight: 400; color: var(--color-text-primary); margin-bottom: 8px; }
    .bp-build-empty-body  { font-size: 14px; color: var(--color-text-muted); margin-bottom: 20px; }

    /* ── CATEGORY LIST ── */
    .bp-cat-list { padding: 12px var(--section-pad); flex: 1; }
    .bp-cat-item { border: 0.5px solid var(--color-border); border-radius: 10px; margin-bottom: 10px; overflow: hidden; background: var(--color-surface); }

    /* ── CATEGORY HEADER ── */
    .bp-cat-header       { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; cursor: pointer; transition: background 0.15s; }
    .bp-cat-header:hover { background: var(--color-surface); }
    .bp-cat-header-left  { display: flex; align-items: center; gap: 12px; }
    .bp-cat-name         { font-size: 14px; font-weight: 500; color: var(--color-text-primary); }
    .bp-cat-cost         { font-size: 12px; color: var(--color-text-muted); margin-top: 1px; }
    .bp-cat-vendor-count { color: var(--theme-accent); font-weight: 500; }
    .bp-cat-chevron      { color: var(--color-text-muted); transition: transform 0.2s; }
    .bp-cat-chevron.open { transform: rotate(90deg); }

    /* ── EXPANDED CONTENT ── */
    .bp-cat-expanded        { border-top: 0.5px solid var(--color-border); padding: 16px; background: var(--color-surface); }
    .bp-cat-section-label   { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--theme-accent); margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
    .bp-cat-section-hint    { font-size: 10px; color: var(--color-text-muted); text-transform: none; letter-spacing: 0; font-weight: 400; }
    .bp-cat-brief-text      { font-size: 13px; color: var(--color-text-secondary); line-height: 1.6; padding: 10px 12px; background: var(--color-surface); border: 0.5px solid var(--color-border); border-radius: 6px; }
    .bp-brief-textarea      { font-size: 13px; line-height: 1.6; }
    .bp-brief-actions       { display: flex; gap: 8px; margin-top: 8px; }

    /* ── VENDORS ── */
    .bp-vendor-list  { display: flex; flex-direction: column; gap: 8px; }
    .bp-vendor-empty { font-size: 13px; color: var(--color-text-muted); padding: 12px 0; }
    .bp-vendor-row   { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 0.5px solid var(--color-border); border-radius: 8px; background: var(--color-surface); cursor: pointer; transition: border-color 0.15s, background 0.15s; }
    .bp-vendor-row.selected { border-color: var(--theme-accent); background: var(--theme-bg); }
    .bp-vendor-img   { width: 36px; height: 36px; border-radius: 8px; flex-shrink: 0; background-size: cover; background-position: center; }
    .bp-vendor-grad  { background-image: linear-gradient(160deg, #1a1a2e, #16213e); }
    .bp-vendor-info  { flex: 1; min-width: 0; }
    .bp-vendor-name  { font-size: 13px; font-weight: 500; color: var(--color-text-primary); }
    .bp-vendor-meta  { font-size: 11px; color: var(--color-text-muted); display: flex; align-items: center; gap: 3px; margin-top: 1px; }
    .bp-vendor-check { width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid var(--color-border); display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background 0.15s, border-color 0.15s; }
    .bp-vendor-check.checked { background: var(--theme-accent); border-color: var(--theme-accent); color: #fff; }

    /* ── REQUEST QUOTE BUTTON ── */
    :host ::ng-deep .bp-btn-request-quote.p-button {
      background: var(--theme-accent) !important;
      border-color: var(--theme-accent) !important;
      color: #fff !important;
      font-weight: 600 !important;
    }
    :host ::ng-deep .bp-btn-request-quote.p-button:hover {
      filter: brightness(0.9);
    }

    /* ── STICKY FOOTER (mobile) ── */
    .bp-build-footer     { padding: 16px var(--section-pad); border-top: 0.5px solid var(--color-border); background: var(--color-surface); }
    .bp-build-footer-sub { font-size: 11px; color: var(--color-text-muted); text-align: center; margin-top: 6px; }

    /* ── QUOTE REVIEW DRAWER ── */
    .bp-review-cat        { padding: 12px 0; border-bottom: 0.5px solid var(--color-border); }
    .bp-review-cat:last-child { border-bottom: none; }
    .bp-review-cat-name   { font-size: 13px; font-weight: 600; color: var(--color-text-primary); margin-bottom: 6px; }
    .bp-review-vendor     { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--color-text-secondary); margin-bottom: 4px; }
    .bp-review-brief      { font-size: 11px; color: var(--color-text-muted); margin-top: 6px; line-height: 1.5; }
    .bp-review-brief-lbl  { font-weight: 600; color: var(--theme-accent); }
    .bp-review-ball-card  { display: flex; align-items: center; justify-content: space-between; margin-top: 20px; background: var(--theme-bg); border: 0.5px solid var(--theme-border); border-radius: 10px; padding: 14px 16px; }
    .bp-review-ball-label { font-size: 13px; font-weight: 600; color: var(--theme-accent); margin-bottom: 3px; }
    .bp-review-ball-after { font-size: 11px; color: var(--color-text-muted); }
    .bp-review-ball-num   { font-size: 24px; font-weight: 700; color: var(--color-text-primary); }

    /* ── RESPONSIVE ── */
    @media (max-width: 768px) {
      .bp-build-header { padding: 14px 16px 10px; flex-direction: column; gap: 10px; }
      .bp-build-header p-button { width: 100%; }
      .bp-cat-list { padding: 10px 12px; }
      .bp-build-footer { position: sticky; bottom: 0; z-index: 10; }
    }
  `]
})
export class BuildComponent implements OnInit {
  loading = true;
  categories: CategoryWithBrief[] = [];
  expandedCatId = '';
  showQuoteDrawer = false;
  sending = false;
  ballsBalance = 0;
  creditLabel = 'Ball';
  private projectId = '';
  showAddCatDrawer = false;
  availableCategories: any[] = [];
  selectedNewCatId = '';
  addingCat = false;

  constructor(
    private route: ActivatedRoute,
    private projectCategorySvc: ProjectCategoryService,
    private supplierSvc: SupplierService,
    private orgSvc: OrgService,
    private configService: ConfigService,
    private msg: MessageService,
    private cdr: ChangeDetectorRef,
    private categorySvc: CategoryService
  ) {}

  ngOnInit() {
    this.creditLabel = this.configService.current?.creditLabel || 'Ball';

    this.orgSvc.getCurrentOrg().subscribe(org => {
      if (org) { this.ballsBalance = org.balls_balance || 0; this.cdr.detectChanges(); }
    });

    // Get project id from parent route
    let r = this.route;
    while (r.parent) { r = r.parent; }
    const pid = r.snapshot.paramMap.get('id') || this.route.parent?.snapshot.paramMap.get('id') || '';
    this.projectId = pid;

    if (pid) {
      this.projectCategorySvc.getByProject(pid).subscribe({
        next: cats => {
          this.categories = (cats || []).map((c: any) => ({
            ...c,
            editingBrief: false,
            briefDraft: c.requirement_brief || '',
            selectedVendorIds: [],
            vendors: [],
            vendorsLoaded: false
          }));
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: () => { this.loading = false; this.cdr.detectChanges(); }
      });
    } else {
      this.loading = false;
    }

    this.categorySvc.getAll('catalogue').subscribe({
      next: cats => {
        this.availableCategories = (cats || []).filter((c: any) => c.enabled !== false);
        this.cdr.detectChanges();
      }
    });
  }

  openAddCategory() {
    this.selectedNewCatId = '';
    this.showAddCatDrawer = true;
  }

  addCategory() {
    if (!this.selectedNewCatId || !this.projectId) return;
    this.addingCat = true;
    const cat = this.availableCategories.find((c: any) => c.id === this.selectedNewCatId);
    this.projectCategorySvc.create({
      project_id: this.projectId,
      category_id: this.selectedNewCatId,
      name: cat?.name || 'New Category',
      ballpark_cost: 0,
      sort_order: this.categories.length
    }).subscribe({
      next: () => {
        this.addingCat = false;
        this.showAddCatDrawer = false;
        this.projectCategorySvc.getByProject(this.projectId).subscribe({
          next: cats => {
            this.categories = (cats || []).map((c: any) => ({
              ...c, editingBrief: false, briefDraft: c.requirement_brief || '',
              selectedVendorIds: [], vendors: [], vendorsLoaded: false
            }));
            this.cdr.detectChanges();
          }
        });
      },
      error: () => { this.addingCat = false; this.cdr.detectChanges(); }
    });
  }

  getCatIcon(cat: CategoryWithBrief): string {
    const map: Record<string, string> = {
      'stand structure': 'warehouse', 'structure': 'warehouse', 'set build': 'warehouse',
      'lighting': 'spotlight', 'av': 'headset', 'av & production': 'headset', 'audio visual': 'headset',
      'permits': 'signature', 'permits & logistics': 'signature',
      'catering': 'martini', 'talent': 'person-standing', 'talent & staffing': 'person-standing',
      'entertainment': 'person-standing',
      'av & technology': 'headset', 'graphics': 'image', 'graphics & signage': 'image',
      'signage': 'image', 'print': 'printer', 'hospitality': 'martini',
      'catering & hospitality': 'martini', 'bar': 'martini',
      'staffing': 'person-standing', 'security': 'shield',
    };
    const key = (cat.name || '').toLowerCase();
    for (const [k, v] of Object.entries(map)) {
      if (key.includes(k)) return v;
    }
    return 'warehouse';
  }

  toggleCategory(cat: CategoryWithBrief) {
    if (this.expandedCatId === cat.id) {
      this.expandedCatId = '';
    } else {
      this.expandedCatId = cat.id;
      if (!cat.vendorsLoaded) this.loadVendors(cat);
    }
    this.cdr.detectChanges();
  }

  loadVendors(cat: CategoryWithBrief) {
    this.supplierSvc.getAll().subscribe({
      next: (suppliers: any[]) => {
        cat.vendors = suppliers || [];
        cat.vendorsLoaded = true;
        this.cdr.detectChanges();
      },
      error: () => { cat.vendors = []; cat.vendorsLoaded = true; this.cdr.detectChanges(); }
    });
  }

  startEditBrief(cat: CategoryWithBrief) {
    cat.briefDraft = cat.requirement_brief || '';
    cat.editingBrief = true;
    this.cdr.detectChanges();
  }

  saveBrief(cat: CategoryWithBrief) {
    this.projectCategorySvc.update(cat.id, { requirement_brief: cat.briefDraft }).subscribe({
      next: () => {
        cat.requirement_brief = cat.briefDraft;
        cat.editingBrief = false;
        this.msg.add({ severity: 'success', summary: 'Brief saved', life: 2000 });
        this.cdr.detectChanges();
      },
      error: () => {
        this.msg.add({ severity: 'error', summary: 'Save failed', life: 3000 });
      }
    });
  }

  cancelBrief(cat: CategoryWithBrief) {
    cat.editingBrief = false;
    cat.briefDraft = cat.requirement_brief || '';
    this.cdr.detectChanges();
  }

  toggleVendor(cat: CategoryWithBrief, vendorId: string) {
    const idx = cat.selectedVendorIds.indexOf(vendorId);
    if (idx === -1) {
      cat.selectedVendorIds = [...cat.selectedVendorIds, vendorId];
    } else {
      cat.selectedVendorIds = cat.selectedVendorIds.filter(id => id !== vendorId);
    }
    this.cdr.detectChanges();
  }

  totalSelectedVendors(): number {
    return this.categories.reduce((sum, c) => sum + c.selectedVendorIds.length, 0);
  }

  categoriesWithSelections(): CategoryWithBrief[] {
    return this.categories.filter(c => c.selectedVendorIds.length > 0);
  }

  getVendorName(cat: CategoryWithBrief, vendorId: string): string {
    return cat.vendors?.find(v => v.id === vendorId)?.name || vendorId;
  }

  openQuoteReview() {
    this.showQuoteDrawer = true;
  }

  sendQuotes() {
    this.sending = true;
    // TODO: wire to balls transaction service + messaging service
    // For now simulate a send
    setTimeout(() => {
      this.sending = false;
      this.showQuoteDrawer = false;
      this.msg.add({
        severity: 'success',
        summary: 'Quotes requested!',
        detail: `${this.categoriesWithSelections().length} categories sent to ${this.totalSelectedVendors()} vendors.`,
        life: 4000
      });
      // Clear selections
      this.categories.forEach(c => c.selectedVendorIds = []);
      this.ballsBalance -= this.categoriesWithSelections().length;
      this.cdr.detectChanges();
    }, 1200);
  }

  fmtCurrency(v: any): string { return ConfigService.formatCurrency(v); }
}
