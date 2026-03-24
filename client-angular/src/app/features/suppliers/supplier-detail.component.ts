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
import { ShellContextService } from '../../core/services/shell-context.service';
import { OrgService } from '../../core/services/org.service';
import { ConfigService } from '../../core/services/config.service';
import { GbpPipe } from '../../shared/pipes/gbp.pipe';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { Project } from '../../models';

@Component({
  selector: 'app-supplier-detail',
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
    <ng-container *ngIf="!loading && supplier">

      <!-- HERO IMAGE -->
      <div class="bp-sup-hero-img"
        [style.background-image]="supplier.cover_image_url ? 'url(' + supplier.cover_image_url + ')' : null"
        [class.bp-sup-hero-img-default]="!supplier.cover_image_url">
        <!-- Heart on supplier -->
        <button class="bp-hero-heart" [class.active]="isSupplierFav()" (click)="toggleSupplierFav()">
          <lucide-icon name="heart" [size]="20"></lucide-icon>
        </button>
      </div>

      <!-- SUPPLIER INFO -->
      <div class="bp-sup-info">
        <div class="bp-sup-info-name">{{ supplier.name }}</div>
        <div class="bp-sup-info-meta">
          <lucide-icon name="map-pin" [size]="12"></lucide-icon>
          {{ supplier.city || 'London' }}
        </div>
        <div class="bp-sup-info-desc" *ngIf="supplier.description">{{ supplier.description }}</div>
      </div>

      <!-- CATEGORY TABS -->
      <div class="bp-sup-cats" *ngIf="categoryGroups.length > 1">
        <button class="bp-sup-cat-tab" [class.active]="activeCategory === 'all'" (click)="setCategory('all')">All</button>
        <button *ngFor="let g of categoryGroups"
          class="bp-sup-cat-tab"
          [class.active]="activeCategory === g.categoryId"
          (click)="setCategory(g.categoryId)">
          {{ g.categoryName }}
          <span class="bp-sup-cat-count">{{ g.items.length }}</span>
        </button>
      </div>

      <!-- CATALOGUE ITEMS -->
      <div class="bp-sup-items">
        <div *ngFor="let item of filteredItems()" class="bp-sup-item"
          [class.bp-sup-item-highlighted]="item.id === highlightedItemId"
          [id]="'item-' + item.id">
          <div class="bp-sup-item-body">
            <div class="bp-sup-item-name">{{ item.name }}</div>
            <div class="bp-sup-item-desc" *ngIf="item.description">{{ item.description }}</div>
            <div class="bp-sup-item-meta">
              <span class="bp-sup-item-tag">{{ item.category_name }}</span>
              <span class="bp-sup-item-tag" *ngIf="item.tier">{{ item.tier }}</span>
            </div>
          </div>
          <div class="bp-sup-item-right">
            <div class="bp-sup-item-price" *ngIf="item.base_price">{{ item.base_price | gbp }}</div>
            <div class="bp-sup-item-actions">
              <!-- Heart on item -->
              <button class="bp-heart-btn-sm" [class.active]="isItemFav(item.id)" (click)="toggleItemFav(item.id)">
                <lucide-icon name="heart" [size]="14"></lucide-icon>
              </button>
              <button class="bp-sup-item-quote-btn" (click)="goToItem(item)">View →</button>
            </div>
          </div>
        </div>

        <!-- Custom quote -->
        <div class="bp-sup-custom">
          <div class="bp-sup-custom-label">Don't see what you need?</div>
          <button class="bp-sup-custom-btn" (click)="openQuote(null)">Request custom quote →</button>
        </div>
      </div>

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
        <!-- Project selector -->
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
        <!-- Brief -->
        <div class="mb-4">
          <label class="bp-field-label">Your requirements</label>
          <textarea pInputTextarea [(ngModel)]="quoteBrief" class="w-full bp-input-edit" [rows]="4"
            [placeholder]="selectedItem ? 'Tell ' + supplier?.name + ' what you need for ' + selectedItem.name + '...' : 'Describe what you need...'">
          </textarea>
        </div>
        <!-- Ball cost -->
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
    .bp-sup-hero-img { width: 100%; height: 200px; background-size: cover; background-position: center; position: relative; }
    .bp-sup-hero-img-default { background: linear-gradient(160deg, #1a1a2e, #16213e); }
    .bp-hero-heart { position: absolute; top: 12px; right: 12px; background: rgba(255,255,255,0.9); border: none; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--color-text-muted); transition: all 0.15s; }
    .bp-hero-heart:hover { color: #E11D48; }
    .bp-hero-heart.active { color: #E11D48; background: #fff; }
    .bp-sup-info { padding: 16px; border-bottom: 0.5px solid var(--color-border); background: var(--color-surface); }
    .bp-sup-info-name { font-family: var(--font-display); font-size: 22px; font-weight: 400; color: var(--color-text-primary); margin-bottom: 4px; }
    .bp-sup-info-meta { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--color-text-muted); margin-bottom: 6px; }
    .bp-sup-info-desc { font-size: 13px; color: var(--color-text-secondary); line-height: 1.5; }
    .bp-sup-cats { display: flex; overflow-x: auto; border-bottom: 0.5px solid var(--color-border); background: var(--color-surface); scrollbar-width: none; padding: 0 8px; }
    .bp-sup-cats::-webkit-scrollbar { display: none; }
    .bp-sup-cat-tab { padding: 10px 12px; font-size: 13px; font-weight: 500; color: var(--color-text-muted); white-space: nowrap; background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; font-family: var(--font-body); flex-shrink: 0; display: flex; align-items: center; gap: 5px; }
    .bp-sup-cat-tab.active { color: var(--theme-accent); border-bottom-color: var(--theme-accent); font-weight: 600; }
    .bp-sup-cat-count { font-size: 10px; background: var(--color-surface); border: 0.5px solid var(--color-border); border-radius: 20px; padding: 1px 6px; color: var(--color-text-muted); }
    .bp-sup-items { background: var(--color-bg); }
    .bp-sup-item { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 14px 16px; border-bottom: 0.5px solid var(--color-border); background: var(--color-surface); transition: background 0.15s; }
    .bp-sup-item-highlighted { background: var(--theme-bg) !important; border-left: 3px solid var(--theme-accent); }
    .bp-sup-item-body { flex: 1; min-width: 0; }
    .bp-sup-item-name { font-size: 14px; font-weight: 500; color: var(--color-text-primary); margin-bottom: 3px; }
    .bp-sup-item-desc { font-size: 12px; color: var(--color-text-muted); line-height: 1.4; margin-bottom: 6px; }
    .bp-sup-item-meta { display: flex; flex-wrap: wrap; gap: 4px; }
    .bp-sup-item-tag { font-size: 10px; font-weight: 500; background: var(--theme-bg); color: var(--theme-text); border: 0.5px solid var(--theme-border); border-radius: 20px; padding: 1px 7px; }
    .bp-sup-item-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
    .bp-sup-item-price { font-size: 13px; font-weight: 600; color: var(--color-text-primary); }
    .bp-sup-item-actions { display: flex; align-items: center; gap: 6px; }
    .bp-heart-btn-sm { background: none; border: none; cursor: pointer; color: var(--color-text-muted); padding: 2px; display: flex; align-items: center; transition: color 0.15s; }
    .bp-heart-btn-sm:hover { color: #E11D48; }
    .bp-heart-btn-sm.active { color: #E11D48; }
    .bp-sup-item-quote-btn { font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 6px; border: 1.5px solid var(--theme-accent); color: var(--theme-accent); background: transparent; cursor: pointer; font-family: var(--font-body); transition: all 0.15s; white-space: nowrap; }
    .bp-sup-item-quote-btn:hover { background: var(--theme-accent); color: #fff; }
    .bp-sup-custom { padding: 16px; text-align: center; }
    .bp-sup-custom-label { font-size: 12px; color: var(--color-text-muted); margin-bottom: 8px; }
    .bp-sup-custom-btn { font-size: 13px; font-weight: 500; color: var(--theme-accent); background: none; border: none; cursor: pointer; font-family: var(--font-body); }
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
  categoryGroups: { categoryId: string; categoryName: string; items: any[] }[] = [];
  projects: Project[] = [];
  loading = true;
  activeCategory = 'all';
  highlightedItemId = '';
  showQuoteDrawer = false;
  selectedItem: any = null;
  selectedProjectId = '';
  quoteBrief = '';
  ballsBalance = 0;
  creditLabel = 'Ball';
  projectPreSelected = false;
  private sid = '';

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

  goToItem(item: any) {
    const params: any = {};
    if (this.selectedProjectId) params['projectId'] = this.selectedProjectId;
    this.router.navigate(['/suppliers', this.sid, 'items', item.id], { queryParams: params });
  }

  ngOnInit() {
    this.sid = this.route.snapshot.paramMap.get('id') || '';
    this.creditLabel = this.configService.current?.creditLabel || 'Ball';

    const qp = this.route.snapshot.queryParams;
    if (qp['cat']) this.activeCategory = qp['cat'];
    if (qp['item']) this.highlightedItemId = qp['item'];
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
          this.shellCtx.set({ heroTitle: this.supplier.name, heroSub: this.supplier.city || 'London', pills: [], tabs: [], backPath: '/suppliers' });
        }
        this.cdr.detectChanges();
      }
    });

    this.supplierSvc.getCatalogue(this.sid).subscribe({
      next: (items: any[]) => {
        this.catalogueItems = items || [];
        this.buildCategoryGroups();
        this.loading = false;
        this.cdr.detectChanges();
        if (this.highlightedItemId) {
          setTimeout(() => {
            const el = document.getElementById('item-' + this.highlightedItemId);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 200);
        }
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });

    this.favSvc.supplierFavIds$.subscribe(() => this.cdr.detectChanges());
    this.favSvc.itemFavIds$.subscribe(() => this.cdr.detectChanges());
  }

  ngOnDestroy() { this.shellCtx.reset(); }

  buildCategoryGroups() {
    const map: Record<string, { categoryId: string; categoryName: string; items: any[] }> = {};
    for (const item of this.catalogueItems) {
      const key = item.category_id || 'other';
      if (!map[key]) map[key] = { categoryId: key, categoryName: item.category_name || 'Other', items: [] };
      map[key].items.push(item);
    }
    this.categoryGroups = Object.values(map);
  }

  setCategory(catId: string) { this.activeCategory = catId; this.cdr.detectChanges(); }

  filteredItems(): any[] {
    if (this.activeCategory === 'all') return this.catalogueItems;
    return this.catalogueItems.filter(i => i.category_id === this.activeCategory);
  }

  isSupplierFav(): boolean { return this.favSvc.isSupplierFavourited(this.sid); }
  isItemFav(itemId: string): boolean { return this.favSvc.isItemFavourited(itemId); }

  toggleSupplierFav() {
    this.favSvc.toggleSupplier(this.sid).subscribe(() => this.cdr.detectChanges());
  }

  toggleItemFav(itemId: string) {
    this.favSvc.toggleItem(itemId).subscribe(() => this.cdr.detectChanges());
  }

  openQuote(item: any | null) {
    this.selectedItem = item;
    this.quoteBrief = '';
    this.showQuoteDrawer = true;
  }

  sendQuote() {
    this.showQuoteDrawer = false;
    this.msg.add({ severity: 'success', summary: 'Quote requested!', detail: `${this.supplier?.name} will be in touch.`, life: 3000 });
    this.ballsBalance = Math.max(0, this.ballsBalance - 1);
    this.cdr.detectChanges();
  }
}
