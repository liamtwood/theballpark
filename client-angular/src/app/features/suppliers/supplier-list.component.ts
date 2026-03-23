import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { LucideAngularModule, ChevronRight, ChevronDown, Search } from 'lucide-angular';
import { SupplierService } from '../../core/services/supplier.service';
import { CategoryService } from '../../core/services/category.service';
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

      <!-- SEARCH -->
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

      <!-- CATEGORY TABS -->
      <div class="bp-sup-cats">
        <button class="bp-sup-cat-tab" [class.active]="activeCategory === 'all'" (click)="setCategory('all')">All</button>
        <button *ngFor="let cat of categories"
          class="bp-sup-cat-tab"
          [class.active]="activeCategory === cat.id"
          (click)="setCategory(cat.id)">
          {{ cat.name }}
        </button>
      </div>

      <!-- RESULTS -->
      <div class="bp-sup-results-bar">{{ filtered.length }} supplier{{ filtered.length !== 1 ? 's' : '' }}</div>

      <div *ngIf="filtered.length === 0" class="bp-sup-empty">
        No suppliers found{{ searchTerm ? ' matching "' + searchTerm + '"' : '' }}.
      </div>

      <div class="bp-sup-list">
        <div *ngFor="let s of filtered" class="bp-sup-card-wrap">

          <!-- ROW — tap expands -->
          <div class="bp-sup-card" (click)="toggleSupplier(s)">
            <div class="bp-sup-card-img"
              [style.background-image]="s.cover_image_url ? 'url(' + s.cover_image_url + ')' : null"
              [class.bp-sup-card-img-default]="!s.cover_image_url">
            </div>
            <div class="bp-sup-card-body">
              <div class="bp-sup-card-name">{{ s.name }}</div>
              <div class="bp-sup-card-meta">{{ $any(s).city || 'London' }}</div>
            </div>
            <lucide-icon [name]="s.expanded ? 'chevron-down' : 'chevron-right'" [size]="16" class="bp-sup-card-chev"></lucide-icon>
          </div>

          <!-- EXPANDED — tag pills, tap to go to supplier detail -->
          <div *ngIf="s.expanded" class="bp-sup-expanded">

            <div *ngIf="!s.catalogueLoaded" class="bp-sup-loading">
              <i class="pi pi-spin pi-spinner" style="font-size:13px;color:var(--theme-accent);"></i>
              Loading...
            </div>

            <div *ngIf="s.catalogueLoaded && filteredItems(s).length === 0" class="bp-sup-no-items">
              No items in this category.
            </div>

            <ng-container *ngIf="s.catalogueLoaded && filteredItems(s).length > 0">
              <!-- Group by category, show as tappable tags -->
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

    </ng-container>
    </div>
  `,
  styles: [`
    .bp-sup-search-bar   { padding: 12px 16px; background: #fff; border-bottom: 0.5px solid var(--color-border); }
    .bp-sup-search-wrap  { display: flex; align-items: center; gap: 8px; background: var(--color-surface); border: 0.5px solid var(--color-border); border-radius: 8px; padding: 0 12px; height: 38px; }
    .bp-sup-search-icon  { color: var(--color-text-muted); flex-shrink: 0; }
    .bp-sup-search-input { flex: 1; border: none !important; background: transparent !important; box-shadow: none !important; padding: 0 !important; font-size: 13px !important; }
    .bp-sup-search-clear { background: none; border: none; cursor: pointer; color: var(--color-text-muted); padding: 0; display: flex; align-items: center; }

    .bp-sup-cats { display: flex; gap: 0; overflow-x: auto; border-bottom: 0.5px solid var(--color-border); background: #fff; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding: 0 8px; }
    .bp-sup-cats::-webkit-scrollbar { display: none; }
    .bp-sup-cat-tab { padding: 10px 12px; font-size: 13px; font-weight: 500; color: var(--color-text-muted); white-space: nowrap; background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; font-family: var(--font-body); transition: color 0.15s; flex-shrink: 0; }
    .bp-sup-cat-tab:hover { color: var(--color-text-secondary); }
    .bp-sup-cat-tab.active { color: var(--theme-accent); border-bottom-color: var(--theme-accent); font-weight: 600; }

    .bp-sup-results-bar { padding: 8px 16px; font-size: 12px; color: var(--color-text-muted); background: var(--color-surface); border-bottom: 0.5px solid var(--color-border); }
    .bp-sup-empty { padding: 40px 16px; text-align: center; font-size: 13px; color: var(--color-text-muted); }

    .bp-sup-list { background: var(--color-bg); }
    .bp-sup-card-wrap { border-bottom: 0.5px solid var(--color-border); }

    .bp-sup-card { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: #fff; cursor: pointer; transition: background 0.15s; }
    .bp-sup-card:active { background: var(--color-surface); }
    .bp-sup-card-img { width: 48px; height: 48px; border-radius: 10px; flex-shrink: 0; background-size: cover; background-position: center; }
    .bp-sup-card-img-default { background: linear-gradient(160deg, #1a1a2e, #16213e); }
    .bp-sup-card-body { flex: 1; min-width: 0; }
    .bp-sup-card-name { font-size: 14px; font-weight: 500; color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bp-sup-card-meta { font-size: 12px; color: var(--color-text-muted); }
    .bp-sup-card-chev { color: var(--color-text-muted); flex-shrink: 0; }

    .bp-sup-expanded { background: var(--color-surface); border-top: 0.5px solid var(--color-border); padding: 12px 16px 14px; }
    .bp-sup-loading  { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--color-text-muted); }
    .bp-sup-no-items { font-size: 12px; color: var(--color-text-muted); }

    .bp-sup-tag-groups { margin-bottom: 10px; }
    .bp-sup-tag-group-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--theme-accent); margin-bottom: 6px; margin-top: 10px; }
    .bp-sup-tag-group-label:first-child { margin-top: 0; }
    .bp-sup-tags { display: flex; flex-wrap: wrap; gap: 6px; }
    .bp-sup-tag { font-size: 12px; font-weight: 500; padding: 5px 12px; border-radius: 20px; border: 0.5px solid var(--color-border); background: #fff; color: var(--color-text-primary); cursor: pointer; font-family: var(--font-body); transition: border-color 0.15s, color 0.15s, background 0.15s; }
    .bp-sup-tag:hover { border-color: var(--theme-accent); color: var(--theme-accent); background: var(--theme-bg); }
    .bp-sup-view-all { font-size: 12px; font-weight: 500; color: var(--theme-accent); background: none; border: none; cursor: pointer; font-family: var(--font-body); padding: 4px 0; }
  `]
})
export class SupplierListComponent implements OnInit, OnDestroy {
  suppliers: SupplierWithState[] = [];
  filtered: SupplierWithState[] = [];
  categories: any[] = [];
  loading = true;
  searchTerm = '';
  activeCategory = 'all';

  constructor(
    private supplierSvc: SupplierService,
    private categorySvc: CategoryService,
    private shellCtx: ShellContextService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.shellCtx.set({ heroTitle: 'Suppliers', heroSub: '', pills: [], tabs: [] });

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
  }

  ngOnDestroy() { this.shellCtx.reset(); }

  setCategory(catId: string) {
    this.activeCategory = catId;
    this.applyFilters();
  }

  applyFilters() {
    let result = this.suppliers;
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(term) ||
        ((s as any).city || '').toLowerCase().includes(term)
      );
    }
    if (this.activeCategory !== 'all') {
      result = result.filter(s =>
        !s.catalogueLoaded || s.catalogueItems.some((i: any) => i.category_id === this.activeCategory)
      );
    }
    this.filtered = result;
    this.cdr.detectChanges();
  }

  toggleSupplier(s: SupplierWithState) {
    s.expanded = !s.expanded;
    if (s.expanded && !s.catalogueLoaded) {
      this.supplierSvc.getCatalogue(s.id).subscribe({
        next: (items: any[]) => {
          s.catalogueItems = items || [];
          s.catalogueLoaded = true;
          this.applyFilters();
          this.cdr.detectChanges();
        },
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
    const items = this.filteredItems(s);
    const map: Record<string, any[]> = {};
    for (const item of items) {
      const key = item.category_name || 'Other';
      if (!map[key]) map[key] = [];
      map[key].push(item);
    }
    return Object.entries(map).map(([categoryName, items]) => ({ categoryName, items }));
  }

  goToSupplier(s: SupplierWithState, item: any | null) {
    const params: any = {};
    if (item) params['item'] = item.id;
    if (this.activeCategory !== 'all') params['cat'] = this.activeCategory;
    this.router.navigate(['/suppliers', s.id], { queryParams: params });
  }
}
