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
import { LucideAngularModule, Heart, ChevronRight, MapPin } from 'lucide-angular';
import { SupplierService } from '../../core/services/supplier.service';
import { ProjectService } from '../../core/services/project.service';
import { FavouriteService } from '../../core/services/favourite.service';
import { ShellContextService } from '../../core/services/shell-context.service';
import { OrgService } from '../../core/services/org.service';
import { ConfigService } from '../../core/services/config.service';
import { GbpPipe } from '../../shared/pipes/gbp.pipe';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { Project } from '../../models';

@Component({
  selector: 'app-item-detail',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    ButtonModule, DropdownModule, InputTextareaModule, SidebarModule, ToastModule,
    LucideAngularModule,
    GbpPipe, LoadingSpinnerComponent
  ],
  providers: [MessageService],
  template: `
    <div class="bp-page">
    <app-loading *ngIf="loading"></app-loading>
    <ng-container *ngIf="!loading && item">

      <!-- HERO IMAGE -->
      <div class="bp-item-hero-img"
        [style.background-image]="item.image_url ? 'url(' + item.image_url + ')' : null"
        [class.bp-item-hero-default]="!item.image_url">
        <button class="bp-hero-heart" [class.active]="isItemFav()" (click)="toggleItemFav()">
          <lucide-icon name="heart" [size]="18"></lucide-icon>
        </button>
      </div>

      <!-- PARCHMENT HERO -->
      <div class="bp-item-hero">
        <div class="bp-item-hero-cat">{{ item.category_name }}</div>
        <h1 class="bp-item-hero-name">{{ item.name }}</h1>
      </div>

      <!-- CONTENT -->
      <div class="bp-item-content">

        <!-- TAGS + PRICE -->
        <div class="bp-item-tags">
          <span class="bp-item-tag" *ngIf="item.category_name">{{ item.category_name }}</span>
          <span class="bp-item-tag bp-item-tag-tier" *ngIf="item.tier">{{ item.tier }}</span>
        </div>

        <div class="bp-item-price-row" *ngIf="item.base_price">
          <span class="bp-item-price">{{ item.base_price | gbp }}</span>
          <span class="bp-item-price-label" *ngIf="item.unit">per {{ item.unit }}</span>
        </div>

        <!-- DESCRIPTION -->
        <div class="bp-item-desc" *ngIf="item.description">{{ item.description }}</div>

        <!-- SPECS -->
        <div class="bp-item-specs" *ngIf="hasSpecs()">
          <div class="bp-item-spec" *ngIf="item.lead_time_days">
            <span class="bp-item-spec-label">Lead time</span>
            <span class="bp-item-spec-value">{{ item.lead_time_days }} working day{{ item.lead_time_days !== 1 ? 's' : '' }}</span>
          </div>
          <div class="bp-item-spec" *ngIf="item.coverage_area">
            <span class="bp-item-spec-label">Coverage</span>
            <span class="bp-item-spec-value">Up to {{ item.coverage_area }} sqm</span>
          </div>
          <div class="bp-item-spec" *ngIf="item.min_price && item.max_price">
            <span class="bp-item-spec-label">Price range</span>
            <span class="bp-item-spec-value">{{ item.min_price | gbp }} – {{ item.max_price | gbp }}</span>
          </div>
        </div>

        <!-- SUPPLIER ROW -->
        <div class="bp-item-supplier" *ngIf="supplier" [routerLink]="['/suppliers', supplier.id]">
          <div class="bp-item-sup-img"
            [style.background-image]="supplier.cover_image_url ? 'url(' + supplier.cover_image_url + ')' : null"
            [class.bp-item-sup-img-default]="!supplier.cover_image_url">
          </div>
          <div class="bp-item-sup-body">
            <div class="bp-item-sup-name">{{ supplier.name }}</div>
            <div class="bp-item-sup-city">
              <lucide-icon name="map-pin" [size]="10"></lucide-icon>
              {{ supplier.city || 'London' }}
            </div>
          </div>
          <lucide-icon name="chevron-right" [size]="16" style="color:var(--color-text-muted);"></lucide-icon>
        </div>

        <!-- ACTIONS -->
        <div class="bp-item-actions">
          <p-button
            label="+ Add to Project"
            styleClass="w-full bp-btn-add-project"
            (onClick)="openAddToProject()">
          </p-button>
          <p-button
            label="Request Quote →"
            styleClass="w-full bp-btn-request-quote"
            (onClick)="openQuote()">
          </p-button>
          <div class="bp-item-actions-sub">Requesting a quote uses 1 {{ creditLabel }}</div>
        </div>

      </div>
    </ng-container>

    <!-- ADD TO PROJECT DRAWER -->
    <p-sidebar [(visible)]="showAddDrawer" position="bottom"
      styleClass="bp-drawer bp-drawer-bottom"
      [style]="{height:'auto'}"
      [showCloseIcon]="false">
      <ng-template pTemplate="header">
        <div class="bp-drawer-header-row">
          <div class="bp-drawer-header">
            <span class="bp-drawer-label">{{ item?.name }}</span>
            <div class="bp-drawer-title">Add to Project</div>
          </div>
          <button class="bp-icon-btn" (click)="showAddDrawer = false"><i class="pi pi-times"></i></button>
        </div>
      </ng-template>
      <div class="bp-drawer-body">
        <div class="mb-4">
          <label class="bp-field-label">Select Project</label>
          <p-dropdown [(ngModel)]="selectedProjectId" [options]="projects"
            optionLabel="name" optionValue="id"
            styleClass="w-full bp-input-edit"
            placeholder="Choose a project">
          </p-dropdown>
        </div>
        <div class="bp-item-add-note">
          This adds the item to your project estimate as a ballpark cost. No Ball spent.
        </div>
      </div>
      <ng-template pTemplate="footer">
        <div class="bp-drawer-footer">
          <p-button label="Add to Project" styleClass="bp-drawer-cta w-full"
            [disabled]="!selectedProjectId"
            (onClick)="addToProject()">
          </p-button>
        </div>
      </ng-template>
    </p-sidebar>

    <!-- QUOTE DRAWER -->
    <p-sidebar [(visible)]="showQuoteDrawer" position="bottom"
      styleClass="bp-drawer bp-drawer-bottom"
      [style]="{height:'auto'}"
      [showCloseIcon]="false">
      <ng-template pTemplate="header">
        <div class="bp-drawer-header-row">
          <div class="bp-drawer-header">
            <span class="bp-drawer-label">{{ supplier?.name }}</span>
            <div class="bp-drawer-title">{{ item?.name }}</div>
          </div>
          <button class="bp-icon-btn" (click)="showQuoteDrawer = false"><i class="pi pi-times"></i></button>
        </div>
      </ng-template>
      <div class="bp-drawer-body">
        <div class="mb-4" *ngIf="!projectPreSelected">
          <label class="bp-field-label">Project</label>
          <p-dropdown [(ngModel)]="selectedProjectId" [options]="projects"
            optionLabel="name" optionValue="id"
            styleClass="w-full bp-input-edit"
            placeholder="Select a project">
          </p-dropdown>
        </div>
        <div class="mb-4">
          <label class="bp-field-label">Your requirements</label>
          <textarea pInputTextarea [(ngModel)]="quoteBrief" class="w-full bp-input-edit" [rows]="4"
            [placeholder]="'Tell ' + (supplier?.name || 'them') + ' what you need for ' + (item?.name || 'this item') + '...'">
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
    /* HERO IMAGE */
    .bp-item-hero-img { width: 100%; height: 200px; background-size: cover; background-position: center; position: relative; flex-shrink: 0; }
    .bp-item-hero-default { background: linear-gradient(160deg, #0d1b2a, #1b2838); }
    .bp-hero-heart { position: absolute; top: 12px; right: 12px; background: rgba(255,255,255,0.9); border: none; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--color-text-muted); transition: all 0.15s; }
    .bp-hero-heart:hover { color: #E11D48; }
    .bp-hero-heart.active { color: #E11D48; }

    /* PARCHMENT HERO */
    .bp-item-hero { background: var(--theme-bg); padding: 14px 16px 16px; border-bottom: 0.5px solid var(--theme-border); }
    .bp-item-hero-cat { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--theme-accent); margin-bottom: 4px; }
    .bp-item-hero-name { font-family: var(--font-display); font-size: 22px; font-weight: 400; color: var(--color-text-primary); line-height: 1.2; margin: 0; }

    /* CONTENT */
    .bp-item-content { padding: 16px; }

    /* TAGS */
    .bp-item-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
    .bp-item-tag { font-size: 11px; font-weight: 500; padding: 3px 10px; border-radius: 20px; background: var(--theme-bg); color: var(--theme-text); border: 0.5px solid var(--theme-border); }
    .bp-item-tag-tier { background: var(--color-tier-bg); color: var(--color-tier-text); border-color: var(--color-tier-border); }

    /* PRICE */
    .bp-item-price-row { display: flex; align-items: baseline; gap: 8px; margin-bottom: 14px; padding-bottom: 14px; border-bottom: 0.5px solid var(--color-border); }
    .bp-item-price { font-size: 28px; font-weight: 700; color: var(--color-text-primary); }
    .bp-item-price-label { font-size: 13px; color: var(--color-text-muted); }

    /* DESCRIPTION */
    .bp-item-desc { font-size: 13px; color: var(--color-text-secondary); line-height: 1.6; margin-bottom: 16px; }

    /* SPECS */
    .bp-item-specs { border: 0.5px solid var(--color-border); border-radius: 10px; overflow: hidden; margin-bottom: 16px; }
    .bp-item-spec { display: flex; justify-content: space-between; padding: 10px 14px; border-bottom: 0.5px solid var(--color-border); font-size: 13px; }
    .bp-item-spec:last-child { border-bottom: none; }
    .bp-item-spec-label { color: var(--color-text-muted); }
    .bp-item-spec-value { font-weight: 500; color: var(--color-text-primary); }

    /* SUPPLIER ROW */
    .bp-item-supplier { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 0.5px solid var(--color-border); border-radius: 10px; margin-bottom: 20px; cursor: pointer; transition: border-color 0.15s; }
    .bp-item-supplier:hover { border-color: var(--theme-accent); }
    .bp-item-sup-img { width: 36px; height: 36px; border-radius: 8px; flex-shrink: 0; background-size: cover; background-position: center; }
    .bp-item-sup-img-default { background: linear-gradient(160deg, #1a1a2e, #16213e); }
    .bp-item-sup-body { flex: 1; min-width: 0; }
    .bp-item-sup-name { font-size: 13px; font-weight: 500; color: var(--color-text-primary); }
    .bp-item-sup-city { font-size: 11px; color: var(--color-text-muted); display: flex; align-items: center; gap: 3px; margin-top: 1px; }

    /* ACTIONS */
    .bp-item-actions { display: flex; flex-direction: column; gap: 10px; }
    .bp-item-actions-sub { font-size: 11px; color: var(--color-text-muted); text-align: center; margin-top: 2px; }
    :host ::ng-deep .bp-btn-add-project.p-button { background: #fff !important; color: var(--theme-accent) !important; border: 1.5px solid var(--theme-accent) !important; font-weight: 600 !important; }
    :host ::ng-deep .bp-btn-request-quote.p-button { background: var(--theme-accent) !important; border-color: var(--theme-accent) !important; color: #fff !important; font-weight: 600 !important; }

    /* BALL CARD */
    .bp-review-ball-card { display: flex; align-items: center; justify-content: space-between; background: var(--theme-bg); border: 0.5px solid var(--theme-border); border-radius: 10px; padding: 12px 14px; margin-top: 8px; }
    .bp-review-ball-label { font-size: 13px; font-weight: 600; color: var(--theme-accent); margin-bottom: 2px; }
    .bp-review-ball-after { font-size: 11px; color: var(--color-text-muted); }
    .bp-review-ball-num { font-size: 22px; font-weight: 700; color: var(--color-text-primary); }

    /* ADD NOTE */
    .bp-item-add-note { font-size: 12px; color: var(--color-text-muted); background: var(--color-surface); border: 0.5px solid var(--color-border); border-radius: 8px; padding: 10px 12px; line-height: 1.5; }

    :host ::ng-deep .bp-drawer-bottom { border-radius: 16px 16px 0 0; }
  `]
})
export class ItemDetailComponent implements OnInit, OnDestroy {
  item: any = null;
  supplier: any = null;
  projects: Project[] = [];
  loading = true;
  selectedProjectId = '';
  projectPreSelected = false;
  showAddDrawer = false;
  showQuoteDrawer = false;
  quoteBrief = '';
  ballsBalance = 0;
  creditLabel = 'Ball';
  private itemId = '';
  private supplierId = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private supplierSvc: SupplierService,
    private projectSvc: ProjectService,
    private favSvc: FavouriteService,
    private orgSvc: OrgService,
    private configService: ConfigService,
    private shellCtx: ShellContextService,
    private msg: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.itemId     = this.route.snapshot.paramMap.get('itemId') || '';
    this.supplierId = this.route.snapshot.paramMap.get('id') || '';
    this.creditLabel = this.configService.current?.creditLabel || 'Ball';

    const qp = this.route.snapshot.queryParams;
    if (qp['projectId']) {
      this.selectedProjectId = qp['projectId'];
      this.projectPreSelected = true;
    }

    this.orgSvc.getCurrentOrg().subscribe(org => {
      if (org) { this.ballsBalance = org.balls_balance || 0; this.cdr.detectChanges(); }
    });

    this.projectSvc.getAll().subscribe({
      next: projects => {
        this.projects = (projects || []).filter(p => ['active','costing','draft'].includes(p.status_name || ''));
        if (!this.selectedProjectId && this.projects.length > 0) this.selectedProjectId = this.projects[0].id;
        this.cdr.detectChanges();
      }
    });

    // Load supplier + find item in catalogue
    this.supplierSvc.getAll().subscribe({
      next: (suppliers: any[]) => {
        this.supplier = suppliers.find(s => s.id === this.supplierId) || null;
        this.cdr.detectChanges();
      }
    });

    this.supplierSvc.getCatalogue(this.supplierId).subscribe({
      next: (items: any[]) => {
        this.item = (items || []).find(i => i.id === this.itemId) || null;
        if (this.item && this.supplier) {
          this.shellCtx.set({
            heroTitle: this.item.name,
            heroSub: '',
            pills: [],
            tabs: [],
            backPath: `/suppliers/${this.supplierId}`
          });
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });

    this.favSvc.itemFavIds$.subscribe(() => this.cdr.detectChanges());
  }

  ngOnDestroy() { this.shellCtx.reset(); }

  hasSpecs(): boolean { return !!(this.item?.lead_time_days || this.item?.coverage_area || (this.item?.min_price && this.item?.max_price)); }

  isItemFav(): boolean { return this.favSvc.isItemFavourited(this.itemId); }
  toggleItemFav() { this.favSvc.toggleItem(this.itemId).subscribe(() => this.cdr.detectChanges()); }

  openAddToProject() { this.showAddDrawer = true; }
  openQuote() { this.quoteBrief = ''; this.showQuoteDrawer = true; }

  addToProject() {
    // TODO: wire to project-category service to add item to estimate
    this.showAddDrawer = false;
    this.msg.add({ severity: 'success', summary: 'Added to project', detail: `${this.item?.name} added to your estimate.`, life: 3000 });
    this.cdr.detectChanges();
  }

  sendQuote() {
    this.showQuoteDrawer = false;
    this.msg.add({ severity: 'success', summary: 'Quote requested!', detail: `${this.supplier?.name} will be in touch.`, life: 3000 });
    this.ballsBalance = Math.max(0, this.ballsBalance - 1);
    this.cdr.detectChanges();
  }
}
