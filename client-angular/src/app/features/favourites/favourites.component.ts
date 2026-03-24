import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LucideAngularModule, Heart, Building2, Package, ChevronRight, Search } from 'lucide-angular';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { FavouriteService, Favourite } from '../../core/services/favourite.service';
import { OrgService } from '../../core/services/org.service';
import { ShellContextService } from '../../core/services/shell-context.service';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { GbpPipe } from '../../shared/pipes/gbp.pipe';

type FavTab = 'suppliers' | 'items';

@Component({
  selector: 'app-favourites',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    InputTextModule,
    LucideAngularModule,
    LoadingSpinnerComponent, GbpPipe
  ],
  template: `
    <div class="bp-page">
    <app-loading *ngIf="loading"></app-loading>
    <ng-container *ngIf="!loading">

      <!-- SUB-TAB BAR -->
      <div class="bp-fav-subtabs">
        <button class="bp-fav-subtab" [class.active]="activeTab === 'suppliers'" (click)="setTab('suppliers')">
          Suppliers
          <span class="bp-fav-count">{{ favSuppliers.length }}</span>
        </button>
        <button class="bp-fav-subtab" [class.active]="activeTab === 'items'" (click)="setTab('items')">
          Items
          <span class="bp-fav-count">{{ favItems.length }}</span>
        </button>
      </div>

      <!-- SEARCH -->
      <div class="bp-sup-search-bar">
        <div class="bp-sup-search-wrap">
          <lucide-icon name="search" [size]="14" class="bp-sup-search-icon"></lucide-icon>
          <input pInputText [(ngModel)]="searchTerm" (ngModelChange)="applyFilter()"
            [placeholder]="activeTab === 'suppliers' ? 'Search suppliers...' : 'Search items...'"
            class="bp-sup-search-input"/>
          <button *ngIf="searchTerm" class="bp-sup-search-clear" (click)="searchTerm=''; applyFilter()">
            <i class="pi pi-times" style="font-size:11px;"></i>
          </button>
        </div>
      </div>

      <!-- RESULTS COUNT -->
      <div class="bp-sup-results-bar">{{ filtered.length }} {{ activeTab === 'suppliers' ? 'supplier' : 'item' }}{{ filtered.length !== 1 ? 's' : '' }}</div>

      <!-- SUPPLIERS TAB -->
      <ng-container *ngIf="activeTab === 'suppliers'">
        <div *ngIf="filtered.length === 0" class="bp-fav-empty">
          <lucide-icon name="heart" [size]="32" style="color:var(--color-text-muted);margin-bottom:12px;"></lucide-icon>
          <p>No favourite suppliers yet.</p>
          <a routerLink="/suppliers" class="bp-fav-browse">Browse suppliers →</a>
        </div>
        <div class="bp-sup-list">
          <a *ngFor="let f of filtered" class="bp-row-card" [routerLink]="['/suppliers', f.ref_id]">
            <div class="bp-row-img"
              [style.background-image]="f.ref_image_url ? 'url(' + f.ref_image_url + ')' : null"
              [class.bp-row-img-default]="!f.ref_image_url">
            </div>
            <div class="bp-row-body">
              <div class="bp-row-name">{{ f.ref_name }}</div>
              <div class="bp-row-meta" *ngIf="f.ref_category">{{ f.ref_category }}</div>
            </div>
            <lucide-icon name="heart" [size]="14" style="color:#E11D48;flex-shrink:0;"
              [style.fill]="'#E11D48'"></lucide-icon>
            <lucide-icon name="chevron-right" [size]="16" class="bp-row-chev"></lucide-icon>
          </a>
        </div>
        <div class="bp-fav-browse-row" *ngIf="filtered.length > 0">
          <a routerLink="/suppliers" class="bp-fav-browse">Browse more suppliers →</a>
        </div>
      </ng-container>

      <!-- ITEMS TAB -->
      <ng-container *ngIf="activeTab === 'items'">
        <div *ngIf="filtered.length === 0" class="bp-fav-empty">
          <lucide-icon name="heart" [size]="32" style="color:var(--color-text-muted);margin-bottom:12px;"></lucide-icon>
          <p>No favourite items yet.</p>
          <a routerLink="/suppliers" class="bp-fav-browse">Browse supplier catalogues →</a>
        </div>
        <div class="bp-sup-list">
          <a *ngFor="let f of filtered" class="bp-row-card"
            [routerLink]="['/suppliers', f.supplier_org_id, 'items', f.ref_id]">
            <div class="bp-row-icon-wrap">
              <lucide-icon name="package" [size]="18" style="color:var(--theme-accent);"></lucide-icon>
            </div>
            <div class="bp-row-body">
              <div class="bp-row-name">{{ f.ref_name }}</div>
              <div class="bp-row-meta">
                {{ f.supplier_name }}
                <span *ngIf="f.ref_category"> · {{ f.ref_category }}</span>
                <span *ngIf="f.ref_price"> · {{ f.ref_price | gbp }}</span>
              </div>
            </div>
            <lucide-icon name="heart" [size]="14" style="color:#E11D48;flex-shrink:0;"
              [style.fill]="'#E11D48'"></lucide-icon>
            <lucide-icon name="chevron-right" [size]="16" class="bp-row-chev"></lucide-icon>
          </a>
        </div>
      </ng-container>

    </ng-container>
    </div>
  `,
  styles: [`
    /* SUB-TABS */
    .bp-fav-subtabs { display: flex; border-bottom: 0.5px solid var(--color-border); background: var(--color-surface); }
    .bp-fav-subtab  { flex: 1; padding: 12px; font-size: 13px; font-weight: 500; color: var(--color-text-muted); background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; font-family: var(--font-body); display: flex; align-items: center; justify-content: center; gap: 6px; transition: color 0.15s; }
    .bp-fav-subtab.active { color: var(--theme-accent); border-bottom-color: var(--theme-accent); font-weight: 600; }
    .bp-fav-count { font-size: 11px; background: var(--color-surface); border: 0.5px solid var(--color-border); border-radius: 20px; padding: 1px 7px; color: var(--color-text-muted); }
    .bp-fav-subtab.active .bp-fav-count { background: var(--theme-bg); border-color: var(--theme-border); color: var(--theme-accent); }

    /* SEARCH */
    .bp-sup-search-bar  { padding: 12px 16px; background: var(--color-surface); border-bottom: 0.5px solid var(--color-border); }
    .bp-sup-search-wrap { display: flex; align-items: center; gap: 8px; background: var(--color-surface); border: 0.5px solid var(--color-border); border-radius: 8px; padding: 0 12px; height: 38px; }
    .bp-sup-search-icon  { color: var(--color-text-muted); flex-shrink: 0; }
    .bp-sup-search-input { flex: 1; border: none !important; background: transparent !important; box-shadow: none !important; padding: 0 !important; font-size: 13px !important; }
    .bp-sup-search-clear { background: none; border: none; cursor: pointer; color: var(--color-text-muted); padding: 0; display: flex; align-items: center; }
    .bp-sup-results-bar { padding: 8px 16px; font-size: 12px; color: var(--color-text-muted); background: var(--color-surface); border-bottom: 0.5px solid var(--color-border); }

    /* EMPTY STATE */
    .bp-fav-empty { display: flex; flex-direction: column; align-items: center; padding: 48px 24px; text-align: center; }
    .bp-fav-empty p { font-size: 13px; color: var(--color-text-muted); margin-bottom: 12px; }
    .bp-fav-browse { font-size: 13px; font-weight: 500; color: var(--theme-accent); text-decoration: none; }
    .bp-fav-browse-row { padding: 16px; text-align: center; border-top: 0.5px solid var(--color-border); }

    /* ROW CARDS */
    .bp-sup-list { background: var(--color-bg); }
    .bp-row-card { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 0.5px solid var(--color-border); background: var(--color-surface); cursor: pointer; text-decoration: none; transition: background 0.15s; }
    .bp-row-card:active { background: var(--color-surface); }
    .bp-row-img { width: 44px; height: 44px; border-radius: 10px; flex-shrink: 0; background-size: cover; background-position: center; }
    .bp-row-img-default { background: linear-gradient(160deg, #1a1a2e, #16213e); }
    .bp-row-icon-wrap { width: 44px; height: 44px; border-radius: 10px; flex-shrink: 0; background: var(--theme-bg); display: flex; align-items: center; justify-content: center; }
    .bp-row-body { flex: 1; min-width: 0; }
    .bp-row-name { font-size: 14px; font-weight: 500; color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bp-row-meta { font-size: 12px; color: var(--color-text-muted); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bp-row-chev { color: var(--color-border); flex-shrink: 0; }
  `]
})
export class FavouritesComponent implements OnInit, OnDestroy {
  loading = true;
  activeTab: FavTab = 'suppliers';
  searchTerm = '';
  favSuppliers: Favourite[] = [];
  favItems: Favourite[] = [];
  filtered: Favourite[] = [];

  constructor(
    private favSvc: FavouriteService,
    private orgSvc: OrgService,
    private shellCtx: ShellContextService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.orgSvc.getCurrentOrg().subscribe(org => {
      this.shellCtx.set({ heroTitle: 'Favourites', heroSub: org?.name || '', pills: [], tabs: [] });
      this.cdr.detectChanges();
    });
    this.load();
  }

  ngOnDestroy() { this.shellCtx.reset(); }

  load() {
    this.loading = true;
    this.favSvc.getAll().subscribe({
      next: favs => {
        this.favSuppliers = (favs || []).filter(f => f.type === 'supplier');
        this.favItems     = (favs || []).filter(f => f.type === 'item');
        this.applyFilter();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  setTab(tab: FavTab) {
    this.activeTab = tab;
    this.searchTerm = '';
    this.applyFilter();
  }

  applyFilter() {
    const source = this.activeTab === 'suppliers' ? this.favSuppliers : this.favItems;
    if (!this.searchTerm.trim()) {
      this.filtered = source;
    } else {
      const term = this.searchTerm.toLowerCase();
      this.filtered = source.filter(f =>
        (f.ref_name || '').toLowerCase().includes(term) ||
        (f.ref_category || '').toLowerCase().includes(term) ||
        (f.supplier_name || '').toLowerCase().includes(term)
      );
    }
    this.cdr.detectChanges();
  }
}
