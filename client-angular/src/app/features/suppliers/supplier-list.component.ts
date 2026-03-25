import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { LucideAngularModule, ChevronRight, ChevronDown, Search, Heart, List, Layers } from 'lucide-angular';
import { SupplierService } from '../../core/services/supplier.service';
import { CategoryService } from '../../core/services/category.service';
import { FavouriteService } from '../../core/services/favourite.service';
import { OrgService } from '../../core/services/org.service';
import { ProjectService } from '../../core/services/project.service';
import { ShellContextService } from '../../core/services/shell-context.service';
import { Org } from '../../models';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';

interface SupplierWithState extends Org {
  expanded: boolean;
  catalogueItems: any[];
  catalogueLoaded: boolean;
  cover_image_url?: string;
}

@Component({
  selector: 'app-supplier-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    InputTextModule,
    LucideAngularModule,
    LoadingSpinnerComponent
  ],
  template: `
    <div class="bp-page">
    <app-loading *ngIf="loading"></app-loading>
    <ng-container *ngIf="!loading">

      <!-- DESKTOP LAYOUT -->
      <div class="bp-sup-body">

        <!-- SIDEBAR -->
        <div class="bp-sup-sidebar">
          <!-- Search -->
          <div class="bp-sidebar-search">
            <lucide-icon name="search" [size]="14" class="bp-sidebar-search-icon"></lucide-icon>
            <input pInputText [(ngModel)]="searchTerm" (ngModelChange)="applyFilters()"
              placeholder="Search..." class="bp-sidebar-search-input"/>
          </div>

          <!-- Category filters -->
          <div class="bp-sidebar-sublabel">Category</div>
          <button class="bp-sidebar-item" [class.active]="activeCategory === 'all'" (click)="setCategory('all')">
            <span>All</span>
            <span class="bp-sidebar-count">{{ suppliers.length }}</span>
          </button>
          <button *ngFor="let cat of categories"
            class="bp-sidebar-item"
            [class.active]="activeCategory === cat.id"
            (click)="setCategory(cat.id)">
            <span>{{ cat.name }}</span>
            <span class="bp-sidebar-count">{{ countByCategory(cat.id) }}</span>
          </button>
        </div>

        <!-- MAIN -->
        <div class="bp-sup-main">

          <!-- Section header -->
          <div class="bp-sup-section-header">
            <span class="bp-sup-section-title">SUPPLIERS</span>
            <span class="bp-sup-section-count">{{ filtered.length }} supplier{{ filtered.length !== 1 ? 's' : '' }}</span>
            <div class="bp-view-toggle">
              <button class="bp-view-btn" [class.active]="viewMode === 'list'" (click)="viewMode = 'list'">
                <lucide-icon name="list" [size]="14"></lucide-icon>
              </button>
              <button class="bp-view-btn" [class.active]="viewMode === 'grid'" (click)="viewMode = 'grid'">
                <lucide-icon name="layers" [size]="14"></lucide-icon>
              </button>
            </div>
          </div>

          <div *ngIf="filtered.length === 0" class="bp-sup-empty">
            No suppliers found{{ searchTerm ? ' matching "' + searchTerm + '"' : '' }}.
          </div>

          <!-- LIST VIEW -->
          <div *ngIf="viewMode === 'list'" class="bp-sup-list-view">
            <div *ngFor="let s of filtered" class="bp-member-row bp-member-row-clickable" (click)="goToSupplier(s, null)">
              <div class="bp-member-img"
                [style.background-image]="s.cover_image_url ? 'url(' + s.cover_image_url + ')' : null"
                [class.bp-member-img-default]="!s.cover_image_url">
              </div>
              <div class="bp-member-body">
                <div class="bp-member-name">{{ s.name }}</div>
                <div class="bp-member-meta">{{ $any(s).city || 'London' }}</div>
              </div>
              <button class="bp-heart-btn" [class.active]="isFav(s.id)" (click)="toggleFav($event, s.id)">
                <lucide-icon name="heart" [size]="16"></lucide-icon>
              </button>
              <lucide-icon name="chevron-right" [size]="16" class="bp-member-chev"></lucide-icon>
            </div>
          </div>

          <!-- GRID VIEW -->
          <div *ngIf="viewMode === 'grid'" class="bp-sup-grid-view">
            <div *ngFor="let s of filtered" class="bp-sup-grid-card" (click)="goToSupplier(s, null)">
              <div class="bp-sup-grid-img"
                [style.background-image]="s.cover_image_url ? 'url(' + s.cover_image_url + ')' : null"
                [class.bp-sup-grid-img-default]="!s.cover_image_url">
                <button class="bp-grid-heart" [class.active]="isFav(s.id)" (click)="toggleFav($event, s.id)">
                  <lucide-icon name="heart" [size]="14"></lucide-icon>
                </button>
              </div>
              <div class="bp-sup-grid-body">
                <div class="bp-sup-grid-name">{{ s.name }}</div>
                <div class="bp-sup-grid-meta">{{ $any(s).city || 'London' }}</div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- MOBILE LAYOUT (existing pattern) -->
      <div class="bp-sup-mobile">
        <div class="bp-sup-search-bar">
          <div class="bp-sup-search-wrap">
            <lucide-icon name="search" [size]="14" class="bp-sup-search-icon"></lucide-icon>
            <input pInputText [(ngModel)]="searchTerm" (ngModelChange)="applyFilters()"
              placeholder="Search suppliers..." class="bp-sup-search-input"/>
            <button *ngIf="searchTerm" class="bp-sup-search-clear" (click)="searchTerm=''; applyFilters()">
              <i class="pi pi-times" style="font-size:11px;"></i>
            </button>
          </div>
        </div>
        <div class="bp-sup-cats">
          <button class="bp-sup-cat-tab" [class.active]="activeCategory === 'all'" (click)="setCategory('all')">All</button>
          <button *ngFor="let cat of categories"
            class="bp-sup-cat-tab"
            [class.active]="activeCategory === cat.id"
            (click)="setCategory(cat.id)">
            {{ cat.name }}
          </button>
        </div>
        <div class="bp-sup-list">
          <div *ngFor="let s of filtered" class="bp-sup-card-wrap">
            <div class="bp-sup-card">
              <div class="bp-sup-card-nav" (click)="goToSupplier(s, null)">
                <div class="bp-sup-card-img"
                  [style.background-image]="s.cover_image_url ? 'url(' + s.cover_image_url + ')' : null"
                  [class.bp-sup-card-img-default]="!s.cover_image_url">
                </div>
                <div class="bp-sup-card-body">
                  <div class="bp-sup-card-name">{{ s.name }}</div>
                  <div class="bp-sup-card-meta">{{ $any(s).city || 'London' }}</div>
                </div>
              </div>
              <button class="bp-heart-btn" [class.active]="isFav(s.id)" (click)="toggleFav($event, s.id)">
                <lucide-icon name="heart" [size]="16"></lucide-icon>
              </button>
              <button class="bp-sup-expand-btn" (click)="toggleExpand(s)">
                <lucide-icon [name]="s.expanded ? 'chevron-down' : 'chevron-right'" [size]="16"></lucide-icon>
              </button>
            </div>
            <div *ngIf="s.expanded" class="bp-sup-expanded">
              <div *ngIf="!s.catalogueLoaded" class="bp-sup-loading">
                <i class="pi pi-spin pi-spinner" style="font-size:13px;color:var(--theme-accent);"></i>
                Loading...
              </div>
              <div *ngIf="s.catalogueLoaded && filteredItems(s).length === 0" class="bp-sup-no-items">
                No items in this category.
              </div>
              <ng-container *ngIf="s.catalogueLoaded && filteredItems(s).length > 0">
                <div class="bp-sup-tag-groups">
                  <ng-container *ngFor="let group of groupedItems(s)">
                    <div class="bp-sup-tag-group-label">{{ group.categoryName }}</div>
                    <div class="bp-sup-tags">
                      <button *ngFor="let item of group.items"
                        class="bp-sup-tag"
                        (click)="goToSupplier(s, item)">
                        {{ item.name }}
                      </button>
                    </div>
                  </ng-container>
                </div>
                <button class="bp-sup-view-all" (click)="goToSupplier(s, null)">
                  View all {{ filteredItems(s).length }} items →
                </button>
              </ng-container>
            </div>
          </div>
        </div>
      </div>

    </ng-container>
    </div>
  `,
  styles: [`
    /* ── DESKTOP LAYOUT ── */
    .bp-sup-body { display: grid; grid-template-columns: 200px 1fr; min-height: calc(100vh - 200px); }
    .bp-sup-sidebar { border-right: 0.5px solid var(--color-border); padding: 20px 16px; }
    .bp-sup-main { padding: 20px 28px; }
    .bp-sup-mobile { display: none; }

    /* ── SIDEBAR ── */
    .bp-sidebar-search { display: flex; align-items: center; gap: 8px; border: 0.5px solid var(--color-border); border-radius: 8px; padding: 0 10px; height: 34px; margin-bottom: 20px; }
    .bp-sidebar-search-icon { color: var(--color-text-muted); flex-shrink: 0; }
    .bp-sidebar-search-input { flex: 1; border: none !important; background: transparent !important; box-shadow: none !important; padding: 0 !important; font-size: 12px !important; }
    .bp-sidebar-sublabel { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-text-muted); margin-bottom: 8px; }
    .bp-sidebar-item { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 7px 10px; font-size: 13px; font-weight: 500; color: var(--color-text-secondary); background: none; border: none; border-radius: 6px; cursor: pointer; font-family: var(--font-body); transition: all 0.15s; }
    .bp-sidebar-item:hover { background: var(--color-surface); color: var(--color-text-primary); }
    .bp-sidebar-item.active { background: var(--theme-bg); color: var(--theme-accent); font-weight: 600; }
    .bp-sidebar-count { font-size: 11px; color: var(--color-text-muted); background: var(--color-surface); border: 0.5px solid var(--color-border); border-radius: 20px; padding: 1px 7px; }
    .bp-sidebar-item.active .bp-sidebar-count { background: var(--theme-bg); border-color: var(--theme-border); color: var(--theme-accent); }

    /* ── SECTION HEADER ── */
    .bp-sup-section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .bp-sup-section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--theme-accent); }
    .bp-sup-section-count { font-size: 12px; color: var(--color-text-muted); flex: 1; }
    .bp-view-toggle { display: flex; gap: 4px; }
    .bp-view-btn { width: 30px; height: 30px; border-radius: 6px; border: 0.5px solid var(--color-border); background: var(--color-surface); color: var(--color-text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
    .bp-view-btn.active { background: var(--theme-bg); border-color: var(--theme-border); color: var(--theme-accent); }
    .bp-sup-empty { padding: 40px 16px; text-align: center; font-size: 13px; color: var(--color-text-muted); }

    /* ── LIST VIEW ── */
    .bp-member-row { display: flex; align-items: center; gap: 14px; padding: 10px 0; border-bottom: 0.5px solid var(--color-border); }
    .bp-member-row-clickable { cursor: pointer; transition: background 0.15s; }
    .bp-member-row-clickable:hover { background: var(--color-surface); margin: 0 -12px; padding: 10px 12px; border-radius: 8px; border-bottom-color: transparent; }
    .bp-member-img { width: 44px; height: 44px; border-radius: 10px; flex-shrink: 0; background-size: cover; background-position: center; }
    .bp-member-img-default { background: linear-gradient(160deg, #1a1a2e, #16213e); }
    .bp-member-body { flex: 1; min-width: 0; }
    .bp-member-name { font-size: 14px; font-weight: 500; color: var(--color-text-primary); }
    .bp-member-meta { font-size: 12px; color: var(--color-text-muted); }
    .bp-member-chev { color: var(--color-text-muted); flex-shrink: 0; }

    /* ── GRID VIEW ── */
    .bp-sup-grid-view { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
    .bp-sup-grid-card { border-radius: 10px; overflow: hidden; border: 0.5px solid var(--color-border); cursor: pointer; transition: border-color 0.15s; background: var(--color-surface); }
    .bp-sup-grid-card:hover { border-color: var(--theme-accent); }
    .bp-sup-grid-img { width: 100%; height: 140px; background-size: cover; background-position: center; position: relative; }
    .bp-sup-grid-img-default { background: linear-gradient(160deg, #1a1a2e, #16213e); }
    .bp-sup-grid-body { padding: 10px 12px; }
    .bp-sup-grid-name { font-size: 13px; font-weight: 600; color: var(--color-text-primary); }
    .bp-sup-grid-meta { font-size: 11px; color: var(--color-text-muted); margin-top: 2px; }
    .bp-grid-heart { position: absolute; top: 8px; right: 8px; width: 28px; height: 28px; border-radius: 50%; background: rgba(255,255,255,0.9); border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--color-text-muted); transition: color 0.15s; }
    .bp-grid-heart:hover { color: #E11D48; }
    .bp-grid-heart.active { color: #E11D48; }

    /* ── HEART ── */
    .bp-heart-btn { background: none; border: none; cursor: pointer; color: var(--color-text-muted); padding: 4px; display: flex; align-items: center; transition: color 0.15s; flex-shrink: 0; }
    .bp-heart-btn:hover { color: #E11D48; }
    .bp-heart-btn.active { color: #E11D48; }
    .bp-heart-btn.active lucide-icon { fill: #E11D48; }

    /* ── MOBILE ── */
    .bp-sup-search-bar   { padding: 12px 16px; background: var(--color-surface); border-bottom: 0.5px solid var(--color-border); }
    .bp-sup-search-wrap  { display: flex; align-items: center; gap: 8px; background: var(--color-surface); border: 0.5px solid var(--color-border); border-radius: 8px; padding: 0 12px; height: 38px; }
    .bp-sup-search-icon  { color: var(--color-text-muted); flex-shrink: 0; }
    .bp-sup-search-input { flex: 1; border: none !important; background: transparent !important; box-shadow: none !important; padding: 0 !important; font-size: 13px !important; }
    .bp-sup-search-clear { background: none; border: none; cursor: pointer; color: var(--color-text-muted); padding: 0; display: flex; align-items: center; }
    .bp-sup-cats { display: flex; overflow-x: auto; border-bottom: 0.5px solid var(--color-border); background: var(--color-surface); -webkit-overflow-scrolling: touch; scrollbar-width: none; padding: 0 8px; }
    .bp-sup-cats::-webkit-scrollbar { display: none; }
    .bp-sup-cat-tab { padding: 10px 12px; font-size: 13px; font-weight: 500; color: var(--color-text-muted); white-space: nowrap; background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; font-family: var(--font-body); transition: color 0.15s; flex-shrink: 0; }
    .bp-sup-cat-tab.active { color: var(--theme-accent); border-bottom-color: var(--theme-accent); font-weight: 600; }
    .bp-sup-list { background: var(--color-bg); }
    .bp-sup-card-wrap { border-bottom: 0.5px solid var(--color-border); }
    .bp-sup-card { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: var(--color-surface); }
    .bp-sup-card-nav { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; cursor: pointer; }
    .bp-sup-card-nav:active { opacity: 0.7; }
    .bp-sup-expand-btn { background: none; border: none; cursor: pointer; color: var(--color-text-muted); padding: 4px; display: flex; align-items: center; flex-shrink: 0; }
    .bp-sup-card-img { width: 48px; height: 48px; border-radius: 10px; flex-shrink: 0; background-size: cover; background-position: center; }
    .bp-sup-card-img-default { background: linear-gradient(160deg, #1a1a2e, #16213e); }
    .bp-sup-card-body { flex: 1; min-width: 0; }
    .bp-sup-card-name { font-size: 14px; font-weight: 500; color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bp-sup-card-meta { font-size: 12px; color: var(--color-text-muted); }
    .bp-sup-expanded { background: var(--color-surface); border-top: 0.5px solid var(--color-border); padding: 12px 16px 14px; }
    .bp-sup-loading  { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--color-text-muted); }
    .bp-sup-no-items { font-size: 12px; color: var(--color-text-muted); }
    .bp-sup-tag-groups { margin-bottom: 10px; }
    .bp-sup-tag-group-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--theme-accent); margin-bottom: 6px; margin-top: 10px; }
    .bp-sup-tag-group-label:first-child { margin-top: 0; }
    .bp-sup-tags { display: flex; flex-wrap: wrap; gap: 6px; }
    .bp-sup-tag { font-size: 12px; font-weight: 500; padding: 5px 12px; border-radius: 20px; border: 0.5px solid var(--color-border); background: var(--color-surface); color: var(--color-text-primary); cursor: pointer; font-family: var(--font-body); transition: all 0.15s; }
    .bp-sup-tag:hover { border-color: var(--theme-accent); color: var(--theme-accent); background: var(--theme-bg); }
    .bp-sup-view-all { font-size: 12px; font-weight: 500; color: var(--theme-accent); background: none; border: none; cursor: pointer; font-family: var(--font-body); padding: 4px 0; }

    /* ── RESPONSIVE ── */
    @media (max-width: 768px) {
      .bp-sup-body { display: none; }
      .bp-sup-mobile { display: block; }
    }
    @media (min-width: 769px) {
      .bp-sup-mobile { display: none; }
    }
  `]
})
export class SupplierListComponent implements OnInit, OnDestroy {
  suppliers: SupplierWithState[] = [];
  filtered: SupplierWithState[] = [];
  categories: any[] = [];
  loading = true;
  searchTerm = '';
  activeCategory = 'all';
  viewMode: 'list' | 'grid' = 'list';

  constructor(
    private supplierSvc: SupplierService,
    private categorySvc: CategoryService,
    private favSvc: FavouriteService,
    private orgSvc: OrgService,
    private projectSvc: ProjectService,
    private shellCtx: ShellContextService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.orgSvc.getCurrentOrg().subscribe(org => {
      const projectId = this.route.snapshot.queryParams['projectId'];
      if (projectId) {
        this.projectSvc.getById(projectId).subscribe(p => {
          this.shellCtx.set({ heroTitle: p?.event_name || p?.name || 'Suppliers', heroSub: 'Suppliers', pills: [], tabs: [] });
          this.cdr.detectChanges();
        });
      } else {
        this.shellCtx.set({ heroTitle: org?.name || 'Suppliers', heroSub: 'Suppliers', pills: [], tabs: [] });
        this.cdr.detectChanges();
      }
    });

    this.categorySvc.getAll().subscribe({
      next: cats => { this.categories = (cats || []).filter((c: any) => c.enabled !== false); this.cdr.detectChanges(); },
      error: () => {}
    });

    this.supplierSvc.getAll().subscribe({
      next: (suppliers: Org[]) => {
        this.suppliers = (suppliers || []).map(s => ({ ...s, expanded: false, catalogueItems: [], catalogueLoaded: false }));
        this.applyFilters();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });

    this.favSvc.supplierFavIds$.subscribe(() => this.cdr.detectChanges());
  }

  ngOnDestroy() { this.shellCtx.reset(); }

  setCategory(catId: string) { this.activeCategory = catId; this.applyFilters(); }

  applyFilters() {
    let result = this.suppliers;
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(s => s.name.toLowerCase().includes(term) || ((s as any).city || '').toLowerCase().includes(term));
    }
    if (this.activeCategory !== 'all') {
      result = result.filter(s => !s.catalogueLoaded || s.catalogueItems.some((i: any) => i.category_id === this.activeCategory));
    }
    this.filtered = result;
    this.cdr.detectChanges();
  }

  countByCategory(catId: string): number {
    return this.suppliers.filter(s => !s.catalogueLoaded || s.catalogueItems.some((i: any) => i.category_id === catId)).length;
  }

  toggleExpand(s: SupplierWithState) {
    s.expanded = !s.expanded;
    if (s.expanded && !s.catalogueLoaded) {
      this.supplierSvc.getCatalogue(s.id).subscribe({
        next: (items: any[]) => { s.catalogueItems = items || []; s.catalogueLoaded = true; this.applyFilters(); this.cdr.detectChanges(); },
        error: () => { s.catalogueItems = []; s.catalogueLoaded = true; this.cdr.detectChanges(); }
      });
    }
    this.cdr.detectChanges();
  }

  filteredItems(s: SupplierWithState): any[] {
    if (this.activeCategory === 'all') return s.catalogueItems;
    return s.catalogueItems.filter((i: any) => i.category_id === this.activeCategory);
  }

  groupedItems(s: SupplierWithState): { categoryName: string; items: any[] }[] {
    const map: Record<string, any[]> = {};
    for (const item of this.filteredItems(s)) {
      const key = item.category_name || 'Other';
      if (!map[key]) map[key] = [];
      map[key].push(item);
    }
    return Object.entries(map).map(([categoryName, items]) => ({ categoryName, items }));
  }

  isFav(supplierId: string): boolean { return this.favSvc.isSupplierFavourited(supplierId); }

  toggleFav(event: MouseEvent, supplierId: string) {
    event.stopPropagation();
    this.favSvc.toggleSupplier(supplierId).subscribe(() => this.cdr.detectChanges());
  }

  goToSupplier(s: SupplierWithState, item: any | null) {
    const params: any = {};
    if (item) params['item'] = item.id;
    if (this.activeCategory !== 'all') params['cat'] = this.activeCategory;
    this.router.navigate(['/suppliers', s.id], { queryParams: params });
  }
}
