import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import {
  LucideAngularModule, Search, Heart, List, Layers,
  ChevronRight, ChevronLeft, MapPin, SquarePen, Building2
} from 'lucide-angular';
import { SupplierService } from '../../core/services/supplier.service';
import { CategoryService } from '../../core/services/category.service';
import { FavouriteService } from '../../core/services/favourite.service';
import { OrgService } from '../../core/services/org.service';
import { ProjectService } from '../../core/services/project.service';
import { ShellContextService } from '../../core/services/shell-context.service';
import { ConfigService } from '../../core/services/config.service';
import { GbpPipe } from '../../shared/pipes/gbp.pipe';
import { Org } from '../../models';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { ImageUploadPanelComponent } from '../../shared/components/image-upload-panel/image-upload-panel.component';

interface SupplierWithState extends Org {
  expanded: boolean;
  catalogueItems: any[];
  catalogueLoaded: boolean;
  cover_image_url?: string;
  category_ids?: string[];
  item_count?: number;
}

@Component({
  selector: 'app-supplier-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    InputTextModule, ButtonModule,
    LucideAngularModule,
    LoadingSpinnerComponent, ImageUploadPanelComponent, GbpPipe
  ],
  template: `
    <div class="bp-page">
    <app-loading *ngIf="loading"></app-loading>
    <ng-container *ngIf="!loading">

      <!-- CATEGORY CIRCLES -->
      <div class="bp-cat-circles-wrap">
        <div class="bp-cat-circles">
          <button class="bp-cat-circle-btn" [class.active]="activeCategory === 'all'" (click)="setCategory('all')">
            <div class="bp-cat-circle bp-cat-circle--all">
              <lucide-icon name="layers" [size]="22"></lucide-icon>
            </div>
            <span class="bp-cat-circle-label">All</span>
          </button>
          <button *ngFor="let cat of categories"
            class="bp-cat-circle-btn"
            [class.active]="activeCategory === cat.id"
            (click)="setCategory(cat.id)">
            <div class="bp-cat-circle"
              [style.background-image]="cat.cover_image_url ? 'url(' + cat.cover_image_url + ')' : null"
              [class.bp-cat-circle--no-image]="!cat.cover_image_url">
              <span *ngIf="!cat.cover_image_url" class="bp-cat-circle-initials">{{ cat.name.charAt(0) }}</span>
            </div>
            <span class="bp-cat-circle-label">{{ cat.name }}</span>
          </button>
        </div>
      </div>

      <!-- THREE-COLUMN BODY -->
      <div class="bp-cat-body" [class.bp-cat-body--detail]="hasDetailPanel()">

        <!-- ── SIDEBAR ── -->
        <div class="bp-cat-sidebar">
          <div class="bp-sidebar-search">
            <lucide-icon name="search" [size]="14" class="bp-sidebar-search-icon"></lucide-icon>
            <input pInputText [(ngModel)]="searchTerm" (ngModelChange)="onSearchChange()"
              placeholder="Search..." class="bp-sidebar-search-input"/>
          </div>

          <ng-container *ngIf="activeCategory === 'all'">
            <div class="bp-sidebar-sublabel">Category</div>
            <button class="bp-sidebar-item active" (click)="setCategory('all')">
              <span>All</span>
              <span class="bp-sidebar-count">{{ totalItemCount() }} items</span>
            </button>
            <button *ngFor="let cat of categories"
              class="bp-sidebar-item"
              (click)="setCategory(cat.id)">
              <span>{{ cat.name }}</span>
            </button>
          </ng-container>

          <ng-container *ngIf="activeCategory !== 'all'">
            <button class="bp-sidebar-back" (click)="setCategory('all')">
              <lucide-icon name="chevron-left" [size]="13"></lucide-icon>
              All categories
            </button>
            <div class="bp-sidebar-sublabel mt-4">Filter by type</div>
            <div *ngIf="tagsLoading" class="bp-sidebar-tags-loading">
              <i class="pi pi-spin pi-spinner" style="font-size:12px;color:var(--theme-accent);"></i>
            </div>
            <ng-container *ngIf="!tagsLoading">
              <button *ngIf="!availableTags.length" class="bp-sidebar-item"
                style="color:var(--color-text-muted);font-style:italic;cursor:default;">No tags yet</button>
              <button *ngFor="let tag of availableTags"
                class="bp-sidebar-item"
                [class.active]="activeTag === tag"
                (click)="setTag(tag)">
                <span>{{ tag }}</span>
              </button>
            </ng-container>
          </ng-container>
        </div>

        <!-- ── MAIN ── -->
        <div class="bp-cat-main">
          <div class="bp-cat-section-header">
            <span class="bp-cat-section-title">CATALOGUE</span>
            <span class="bp-cat-section-count">
              {{ viewMode === 'suppliers'
                  ? (filtered.length + ' supplier' + (filtered.length !== 1 ? 's' : ''))
                  : (filteredItems.length + ' item' + (filteredItems.length !== 1 ? 's' : '')) }}
            </span>
            <div class="bp-cat-toggle-wrap">
              <button class="bp-toggle-btn" [class.active]="viewMode === 'items'"
                (click)="viewMode = 'items'; onViewModeChange()">Items</button>
              <button class="bp-toggle-btn" [class.active]="viewMode === 'suppliers'"
                (click)="viewMode = 'suppliers'; onViewModeChange()">Suppliers</button>
            </div>
            <div class="bp-view-toggle">
              <button class="bp-view-btn" [class.active]="itemLayout === 'list'" (click)="itemLayout = 'list'">
                <lucide-icon name="list" [size]="14"></lucide-icon>
              </button>
              <button class="bp-view-btn" [class.active]="itemLayout === 'card'" (click)="itemLayout = 'card'">
                <lucide-icon name="layers" [size]="14"></lucide-icon>
              </button>
            </div>
          </div>

          <!-- SUPPLIERS VIEW -->
          <ng-container *ngIf="viewMode === 'suppliers'">
            <div *ngIf="!filtered.length" class="bp-cat-empty">No suppliers found.</div>

            <!-- list -->
            <ng-container *ngIf="itemLayout === 'list'">
              <div *ngFor="let s of filtered"
                class="bp-member-row bp-member-row-clickable"
                [class.bp-member-row-selected]="selectedSupplier?.id === s.id"
                (click)="selectSupplier(s)">
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
                <lucide-icon name="chevron-right" [size]="16" class="bp-row-chev"></lucide-icon>
              </div>
            </ng-container>

            <!-- grid -->
            <ng-container *ngIf="itemLayout === 'card'">
              <div class="bp-item-grid">
                <div *ngFor="let s of filtered"
                  class="bp-item-card"
                  [class.bp-item-card-selected]="selectedSupplier?.id === s.id"
                  (click)="selectSupplier(s)">
                  <div class="bp-item-card-img"
                    [style.background-image]="s.cover_image_url ? 'url(' + s.cover_image_url + ')' : null"
                    [class.bp-item-card-img-default]="!s.cover_image_url">
                    <div class="bp-grid-actions">
                      <button class="bp-grid-action-btn" [class.bp-grid-heart-active]="isFav(s.id)"
                        (click)="toggleFav($event, s.id)">
                        <lucide-icon name="heart" [size]="14"></lucide-icon>
                      </button>
                    </div>
                  </div>
                  <div class="bp-item-card-body">
                    <div class="bp-item-card-name">{{ s.name }}</div>
                    <div class="bp-item-card-supplier">{{ $any(s).city || 'London' }}</div>
                  </div>
                </div>
              </div>
            </ng-container>
          </ng-container>

          <!-- ITEMS VIEW -->
          <ng-container *ngIf="viewMode === 'items'">
            <div *ngIf="itemsLoading" class="bp-cat-empty">
              <i class="pi pi-spin pi-spinner" style="font-size:14px;color:var(--theme-accent);"></i>
            </div>
            <div *ngIf="!itemsLoading && !filteredItems.length" class="bp-cat-empty">No items found.</div>

            <!-- list -->
            <ng-container *ngIf="itemLayout === 'list' && !itemsLoading">
              <div *ngFor="let item of filteredItems"
                class="bp-sup-item bp-sup-item-clickable"
                [class.bp-sup-item-selected]="selectedItem?.id === item.id"
                (click)="selectItem(item)">
                <div class="bp-sup-item-body">
                  <div class="bp-sup-item-name">{{ item.name }}</div>
                  <div class="bp-sup-item-sub" *ngIf="item.supplier_name">
                    {{ item.supplier_name }}<span *ngIf="item.supplier_city"> · {{ item.supplier_city }}</span>
                  </div>
                </div>
                <div class="bp-sup-item-right">
                  <div class="bp-sup-item-price-range" *ngIf="item.min_price && item.max_price">
                    {{ item.min_price | gbp }} – {{ item.max_price | gbp }}
                  </div>
                  <div class="bp-sup-item-price-range" *ngIf="item.base_price && !(item.min_price && item.max_price)">
                    {{ item.base_price | gbp }}
                  </div>
                  <div class="bp-sup-item-unit" *ngIf="item.unit">{{ item.unit }}</div>
                </div>
              </div>
            </ng-container>

            <!-- grid -->
            <ng-container *ngIf="itemLayout === 'card' && !itemsLoading">
              <div class="bp-item-grid">
                <div *ngFor="let item of filteredItems"
                  class="bp-item-card"
                  [class.bp-item-card-selected]="selectedItem?.id === item.id"
                  (click)="selectItem(item)">
                  <div class="bp-item-card-img"
                    [style.background-image]="item.image_url ? 'url(' + item.image_url + ')' : (item.supplier_cover_url ? 'url(' + item.supplier_cover_url + ')' : null)"
                    [class.bp-item-card-img-default]="!item.image_url && !item.supplier_cover_url">
                    <div class="bp-grid-actions">
                      <button class="bp-grid-action-btn" (click)="openItemImageUpload($event, item)">
                        <lucide-icon name="square-pen" [size]="14"></lucide-icon>
                      </button>
                      <button class="bp-grid-action-btn" [class.bp-grid-heart-active]="isItemFav(item.id)"
                        (click)="toggleItemFav($event, item.id)">
                        <lucide-icon name="heart" [size]="14"></lucide-icon>
                      </button>
                    </div>
                  </div>
                  <div class="bp-item-card-body">
                    <div class="bp-item-card-name">{{ item.name }}</div>
                    <div class="bp-item-card-price" *ngIf="item.base_price">
                      {{ item.base_price | gbp }}
                      <span class="bp-item-card-unit" *ngIf="item.unit">{{ item.unit }}</span>
                    </div>
                    <div class="bp-item-card-supplier" *ngIf="item.supplier_name">{{ item.supplier_name }}</div>
                  </div>
                </div>
              </div>
            </ng-container>
          </ng-container>
        </div>

        <!-- ── RIGHT DETAIL PANEL ── -->
        <div class="bp-cat-detail" *ngIf="hasDetailPanel()">

          <!-- Supplier detail -->
          <ng-container *ngIf="viewMode === 'suppliers' && selectedSupplier">
            <div class="bp-item-hero-img"
              [style.background-image]="selectedSupplier.cover_image_url ? 'url(' + selectedSupplier.cover_image_url + ')' : null"
              [class.bp-item-hero-img-default]="!selectedSupplier.cover_image_url">
            </div>
            <div class="bp-item-detail-body">
              <div class="bp-item-detail-name">{{ selectedSupplier.name }}</div>
              <div class="bp-item-sup-city mb-2" *ngIf="$any(selectedSupplier).city">
                <lucide-icon name="map-pin" [size]="12"></lucide-icon>
                {{ $any(selectedSupplier).city }}
              </div>
              <p class="bp-item-desc" *ngIf="selectedSupplier.description">{{ selectedSupplier.description }}</p>
              <div class="bp-item-specs" *ngIf="$any(selectedSupplier).item_count">
                <div class="bp-item-spec">
                  <span class="bp-item-spec-label">Catalogue items</span>
                  <span class="bp-item-spec-value">{{ $any(selectedSupplier).item_count }}</span>
                </div>
              </div>
              <div class="flex gap-2">
                <p-button label="View supplier" styleClass="flex-1"
                  (onClick)="goToSupplier(selectedSupplier, null)"></p-button>
                <p-button icon="pi pi-heart" styleClass="p-button-outlined"
                  [class.p-button-danger]="isFav(selectedSupplier.id)"
                  (onClick)="toggleFav($event, selectedSupplier.id)"></p-button>
              </div>
            </div>
          </ng-container>

          <!-- Item detail -->
          <ng-container *ngIf="viewMode === 'items' && selectedItem">
            <div class="bp-item-hero-img"
              [style.background-image]="selectedItem.image_url ? 'url(' + selectedItem.image_url + ')' : (selectedItem.supplier_cover_url ? 'url(' + selectedItem.supplier_cover_url + ')' : null)"
              [class.bp-item-hero-img-default]="!selectedItem.image_url && !selectedItem.supplier_cover_url">
            </div>
            <div class="bp-item-detail-body">
              <div class="bp-item-category-label" *ngIf="selectedItem.category_name">{{ selectedItem.category_name | uppercase }}</div>
              <div class="bp-item-detail-name">{{ selectedItem.name }}</div>
              <div class="bp-item-price-row" *ngIf="selectedItem.base_price || (selectedItem.min_price && selectedItem.max_price)">
                <ng-container *ngIf="selectedItem.min_price && selectedItem.max_price">
                  <span class="bp-item-price">{{ selectedItem.min_price | gbp }}</span>
                  <span class="bp-item-price-sep">–</span>
                  <span class="bp-item-price">{{ selectedItem.max_price | gbp }}</span>
                </ng-container>
                <span class="bp-item-price" *ngIf="!(selectedItem.min_price && selectedItem.max_price)">{{ selectedItem.base_price | gbp }}</span>
                <span class="bp-item-price-label" *ngIf="selectedItem.unit">{{ selectedItem.unit }}</span>
              </div>
              <p class="bp-item-desc" *ngIf="selectedItem.description">{{ selectedItem.description }}</p>
              <div class="bp-item-specs" *ngIf="selectedItem.lead_time_days">
                <div class="bp-item-spec">
                  <span class="bp-item-spec-label">Lead time</span>
                  <span class="bp-item-spec-value">{{ selectedItem.lead_time_days }} working days</span>
                </div>
              </div>
              <div class="bp-item-supplier" *ngIf="selectedItem.supplier_name" (click)="goToSupplierById(selectedItem.org_id)">
                <div class="bp-item-sup-img"
                  [style.background-image]="selectedItem.supplier_cover_url ? 'url(' + selectedItem.supplier_cover_url + ')' : null"
                  [class.bp-item-sup-img-default]="!selectedItem.supplier_cover_url">
                </div>
                <div class="bp-item-sup-body">
                  <div class="bp-item-sup-name">{{ selectedItem.supplier_name }}</div>
                  <div class="bp-item-sup-city" *ngIf="selectedItem.supplier_city">
                    <lucide-icon name="map-pin" [size]="10"></lucide-icon>
                    {{ selectedItem.supplier_city }}
                  </div>
                </div>
                <lucide-icon name="chevron-right" [size]="14" class="bp-row-chev"></lucide-icon>
              </div>
              <p-button label="+ Add to Project" styleClass="w-full" (onClick)="addToProject(selectedItem)"></p-button>
            </div>
          </ng-container>

          <!-- Empty state -->
          <div *ngIf="(viewMode === 'suppliers' && !selectedSupplier) || (viewMode === 'items' && !selectedItem)"
            class="bp-cat-detail-empty">
            <p>Select {{ viewMode === 'suppliers' ? 'a supplier' : 'an item' }} to preview</p>
          </div>
        </div>

      </div>

      <app-image-upload-panel
        *ngIf="uploadItemId"
        [entityId]="uploadItemId"
        type="item"
        [existingCoverUrl]="uploadItemExistingUrl"
        (imagesUpdated)="onItemImageUpdated($event)"
        (closed)="uploadItemId = ''">
      </app-image-upload-panel>

    </ng-container>
    </div>
  `,
  styles: [`
    .bp-cat-body { display: grid; grid-template-columns: 260px 1fr; height: calc(100vh - var(--nav-height) - 160px); }
    .bp-cat-body--detail { grid-template-columns: 260px 1fr 260px; }
    .bp-cat-sidebar { border-right: 0.5px solid var(--color-border); padding: 20px 16px; overflow-y: auto; }
    .bp-cat-main { padding: 20px 28px; overflow-y: auto; min-width: 0; }
    .bp-cat-detail { border-left: 0.5px solid var(--color-border); overflow-y: auto; }

    .bp-cat-circles-wrap { padding: 20px 28px 0; border-bottom: 0.5px solid var(--color-border); }
    .bp-cat-circles { display: flex; gap: 20px; overflow-x: auto; padding-bottom: 20px; scrollbar-width: none; justify-content: center; }
    .bp-cat-circles::-webkit-scrollbar { display: none; }
    .bp-cat-circle-btn { display: flex; flex-direction: column; align-items: center; gap: 8px; background: none; border: none; cursor: pointer; flex-shrink: 0; padding: 0; }
    .bp-cat-circle { width: 96px; height: 96px; border-radius: 50%; background-size: cover; background-position: center; border: 2.5px solid transparent; transition: border-color 0.15s; display: flex; align-items: center; justify-content: center; background-color: var(--color-surface); box-shadow: 0 0 0 0.5px var(--color-border); color: var(--color-text-muted); }
    .bp-cat-circle--all { background-color: var(--color-surface); }
    .bp-cat-circle--no-image { background-color: var(--theme-bg); }
    .bp-cat-circle-initials { font-size: 28px; font-weight: 600; color: var(--theme-accent); font-family: var(--font-display); }
    .bp-cat-circle-btn.active .bp-cat-circle { border-color: var(--theme-accent); box-shadow: 0 0 0 2px var(--theme-accent); }
    .bp-cat-circle-label { font-size: 11px; font-weight: 500; color: var(--color-text-secondary); text-align: center; max-width: 96px; line-height: 1.3; font-family: var(--font-body); }
    .bp-cat-circle-btn.active .bp-cat-circle-label { color: var(--theme-accent); font-weight: 600; }

    .bp-sidebar-search { display: flex; align-items: center; gap: 8px; border: 0.5px solid var(--color-border); border-radius: 8px; padding: 0 10px; height: 34px; margin-bottom: 20px; }
    .bp-sidebar-search-icon { color: var(--color-text-muted); flex-shrink: 0; }
    .bp-sidebar-search-input { flex: 1; border: none !important; background: transparent !important; box-shadow: none !important; padding: 0 !important; font-size: 12px !important; }
    .bp-sidebar-sublabel { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-text-muted); margin-bottom: 8px; }
    .bp-sidebar-item { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 7px 10px; font-size: 13px; font-weight: 500; color: var(--color-text-secondary); background: none; border: none; border-radius: 6px; cursor: pointer; font-family: var(--font-body); transition: all 0.15s; }
    .bp-sidebar-item:hover { background: var(--color-surface); color: var(--color-text-primary); }
    .bp-sidebar-item.active { background: var(--theme-bg); color: var(--theme-accent); font-weight: 600; }
    .bp-sidebar-count { font-size: 11px; color: var(--color-text-muted); background: var(--color-surface); border: 0.5px solid var(--color-border); border-radius: 20px; padding: 1px 7px; }
    .bp-sidebar-item.active .bp-sidebar-count { background: var(--theme-bg); border-color: var(--theme-border); color: var(--theme-accent); }
    .bp-sidebar-back { display: flex; align-items: center; gap: 5px; background: none; border: none; cursor: pointer; font-family: var(--font-body); font-size: 12px; font-weight: 500; color: var(--theme-accent); padding: 4px 0; }
    .bp-sidebar-back:hover { opacity: 0.75; }
    .bp-sidebar-tags-loading { padding: 12px 10px; display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--color-text-muted); }

    .bp-cat-section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
    .bp-cat-section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--theme-accent); }
    .bp-cat-section-count { font-size: 12px; color: var(--color-text-muted); flex: 1; }
    .bp-cat-toggle-wrap { display: flex; gap: 0; flex-shrink: 0; border: 0.5px solid var(--color-border); border-radius: 6px; overflow: hidden; }
    .bp-toggle-btn { padding: 5px 14px; font-size: 12px; font-weight: 500; font-family: var(--font-body); border: none; background: var(--color-surface); color: var(--color-text-muted); cursor: pointer; transition: all 0.15s; }
    .bp-toggle-btn.active { background: var(--theme-bg); color: var(--theme-accent); font-weight: 600; }
    .bp-view-toggle { display: flex; gap: 4px; }
    .bp-view-btn { width: 30px; height: 30px; border-radius: 6px; border: 0.5px solid var(--color-border); background: var(--color-surface); color: var(--color-text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
    .bp-view-btn.active { background: var(--theme-bg); border-color: var(--theme-border); color: var(--theme-accent); }
    .bp-cat-empty { padding: 40px 16px; text-align: center; font-size: 13px; color: var(--color-text-muted); }

    .bp-member-row { display: flex; align-items: center; gap: 14px; padding: 10px 0; border-bottom: 0.5px solid var(--color-border); }
    .bp-member-row-clickable { cursor: pointer; transition: background 0.15s; }
    .bp-member-row-clickable:hover { background: var(--color-surface); margin: 0 -12px; padding: 10px 12px; border-radius: 8px; border-bottom-color: transparent; }
    .bp-member-row-selected { background: var(--theme-bg) !important; margin: 0 -12px !important; padding: 10px 12px !important; border-radius: 8px !important; border-bottom-color: transparent !important; border-left: 3px solid var(--theme-accent); }
    .bp-member-img { width: 44px; height: 44px; border-radius: 10px; flex-shrink: 0; background-size: cover; background-position: center; }
    .bp-member-img-default { background: linear-gradient(160deg, #2a2a2a, #444); }
    .bp-member-body { flex: 1; min-width: 0; }
    .bp-member-name { font-size: 14px; font-weight: 500; color: var(--color-text-primary); }
    .bp-member-meta { font-size: 12px; color: var(--color-text-muted); }
    .bp-row-chev { color: var(--color-text-muted); flex-shrink: 0; }

    .bp-sup-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 0; border-bottom: 0.5px solid var(--color-border); transition: background 0.15s; }
    .bp-sup-item-clickable { cursor: pointer; }
    .bp-sup-item-clickable:hover { background: var(--color-surface); margin: 0 -12px; padding: 12px 12px; border-radius: 8px; border-bottom-color: transparent; }
    .bp-sup-item-selected { background: var(--theme-bg) !important; margin: 0 -12px !important; padding: 12px 12px !important; border-radius: 8px !important; border-bottom-color: transparent !important; border-left: 3px solid var(--theme-accent); }
    .bp-sup-item-body { flex: 1; min-width: 0; }
    .bp-sup-item-name { font-size: 14px; font-weight: 500; color: var(--color-text-primary); margin-bottom: 2px; }
    .bp-sup-item-sub { font-size: 12px; color: var(--color-text-muted); }
    .bp-sup-item-right { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; }
    .bp-sup-item-price-range { font-size: 13px; font-weight: 600; color: var(--color-text-primary); }
    .bp-sup-item-unit { font-size: 10px; color: var(--color-text-muted); }

    .bp-item-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 16px; }
    .bp-item-card { border-radius: 10px; overflow: hidden; border: 0.5px solid var(--color-border); cursor: pointer; transition: border-color 0.15s; background: var(--color-surface); }
    .bp-item-card:hover { border-color: var(--theme-accent); }
    .bp-item-card-selected { border-color: var(--theme-accent) !important; box-shadow: 0 0 0 1px var(--theme-accent); }
    .bp-item-card-img { width: 100%; height: 140px; background-size: cover; background-position: center; position: relative; }
    .bp-item-card-img-default { background: linear-gradient(160deg, #2a2a2a, #444); }
    .bp-item-card-body { padding: 10px 12px; }
    .bp-item-card-name { font-size: 13px; font-weight: 600; color: var(--color-text-primary); margin-bottom: 4px; line-height: 1.3; }
    .bp-item-card-price { font-size: 14px; font-weight: 700; color: var(--color-text-primary); margin-bottom: 2px; }
    .bp-item-card-unit { font-size: 11px; font-weight: 400; color: var(--color-text-muted); }
    .bp-item-card-supplier { font-size: 11px; color: var(--color-text-muted); }
    .bp-grid-actions { position: absolute; top: 8px; right: 8px; display: flex; gap: 6px; }
    .bp-grid-action-btn { width: 28px; height: 28px; border-radius: 50%; background: var(--color-surface); border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--color-text-muted); transition: color 0.15s; opacity: 0.92; }
    .bp-grid-action-btn:hover { color: var(--theme-accent); }
    .bp-grid-heart-active { color: #E11D48 !important; }

    .bp-heart-btn { background: none; border: none; cursor: pointer; color: var(--color-text-muted); padding: 2px; display: flex; align-items: center; transition: color 0.15s; }
    .bp-heart-btn:hover { color: #E11D48; }
    .bp-heart-btn.active { color: #E11D48; }

    .bp-cat-detail-empty { display: flex; align-items: center; justify-content: center; height: 100%; font-size: 13px; color: var(--color-text-muted); padding: 40px 20px; text-align: center; }
    .bp-item-hero-img { width: 100%; height: 160px; background-size: cover; background-position: center; }
    .bp-item-hero-img-default { background: linear-gradient(160deg, #2a2a2a, #444); }
    .bp-item-detail-body { padding: 16px 20px; }
    .bp-item-category-label { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; color: var(--theme-accent); margin-bottom: 4px; }
    .bp-item-detail-name { font-family: var(--font-display); font-size: 18px; font-weight: 400; color: var(--color-text-primary); margin-bottom: 8px; line-height: 1.3; }
    .bp-item-price-row { display: flex; align-items: baseline; gap: 4px; flex-wrap: wrap; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 0.5px solid var(--color-border); }
    .bp-item-price { font-size: 22px; font-weight: 700; color: var(--color-text-primary); }
    .bp-item-price-sep { font-size: 16px; color: var(--color-text-muted); }
    .bp-item-price-label { font-size: 12px; color: var(--color-text-muted); margin-left: 4px; }
    .bp-item-desc { font-size: 12px; color: var(--color-text-secondary); line-height: 1.6; margin-bottom: 14px; }
    .bp-item-specs { border: 0.5px solid var(--color-border); border-radius: 10px; overflow: hidden; margin-bottom: 14px; }
    .bp-item-spec { display: flex; justify-content: space-between; padding: 9px 12px; border-bottom: 0.5px solid var(--color-border); font-size: 12px; }
    .bp-item-spec:last-child { border-bottom: none; }
    .bp-item-spec-label { color: var(--color-text-muted); }
    .bp-item-spec-value { font-weight: 500; color: var(--color-text-primary); }
    .bp-item-supplier { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 0.5px solid var(--color-border); border-radius: 10px; margin-bottom: 16px; cursor: pointer; transition: border-color 0.15s; }
    .bp-item-supplier:hover { border-color: var(--theme-accent); }
    .bp-item-sup-img { width: 32px; height: 32px; border-radius: 7px; flex-shrink: 0; background-size: cover; background-position: center; }
    .bp-item-sup-img-default { background: linear-gradient(160deg, #2a2a2a, #444); }
    .bp-item-sup-body { flex: 1; min-width: 0; }
    .bp-item-sup-name { font-size: 12px; font-weight: 500; color: var(--color-text-primary); }
    .bp-item-sup-city { display: flex; align-items: center; gap: 3px; font-size: 10px; color: var(--color-text-muted); margin-top: 1px; }

    @media (max-width: 768px) {
      .bp-cat-circles-wrap { display: none; }
      .bp-cat-body, .bp-cat-body--detail { display: none; }
    }
  `]
})
export class SupplierListComponent implements OnInit, OnDestroy {
  suppliers: SupplierWithState[] = [];
  filtered: SupplierWithState[] = [];
  categories: any[] = [];
  filteredItems: any[] = [];
  availableTags: string[] = [];
  selectedItem: any = null;
  selectedSupplier: SupplierWithState | null = null;
  loading = true;
  tagsLoading = false;
  itemsLoading = false;
  searchTerm = '';
  activeCategory = 'all';
  activeTag = '';
  viewMode: 'suppliers' | 'items' = 'items';
  itemLayout: 'list' | 'card' = 'card';
  uploadItemId = '';
  uploadItemExistingUrl = '';

  constructor(
    private supplierSvc: SupplierService,
    private categorySvc: CategoryService,
    private favSvc: FavouriteService,
    private orgSvc: OrgService,
    private projectSvc: ProjectService,
    private shellCtx: ShellContextService,
    private configSvc: ConfigService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    const label = this.configSvc.catalogueLabel.toUpperCase();
    const projectId = this.route.snapshot.queryParams['projectId'];
    if (projectId) {
      this.projectSvc.getById(projectId).subscribe(p => {
        this.shellCtx.set({
          heroTitle: this.configSvc.platformName,
          heroSub: label,
          pills: p ? [p.event_name || p.name || ''] : [],
          tabs: []
        });
        this.cdr.detectChanges();
      });
    } else {
      this.shellCtx.set({ heroTitle: this.configSvc.platformName, heroSub: label, pills: [], tabs: [] });
    }

    this.categorySvc.getAll().subscribe({
      next: cats => { this.categories = (cats || []).filter((c: any) => c.enabled !== false); this.cdr.detectChanges(); },
      error: () => {}
    });

    this.supplierSvc.getAll().subscribe({
      next: (suppliers: Org[]) => {
        this.suppliers = (suppliers || []).map(s => ({ ...s, expanded: false, catalogueItems: [], catalogueLoaded: false }));
        this.applyFilters();
        this.loading = false;
        if (this.viewMode === 'items') this.loadItems();
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });

    this.favSvc.supplierFavIds$.subscribe(() => this.cdr.detectChanges());
    this.favSvc.itemFavIds$.subscribe(() => this.cdr.detectChanges());
  }

  ngOnDestroy() { this.shellCtx.reset(); }

  hasDetailPanel(): boolean {
    return this.viewMode === 'items' || (this.viewMode === 'suppliers' && !!this.selectedSupplier);
  }

  setCategory(catId: string) {
    this.activeCategory = catId;
    this.activeTag = '';
    this.selectedItem = null;
    this.selectedSupplier = null;
    this.availableTags = [];
    this.applyFilters();
    if (catId !== 'all') {
      this.loadTags(catId);
      if (this.viewMode === 'items') this.loadItems();
    } else if (this.viewMode === 'items') {
      this.loadItems();
    }
    this.cdr.detectChanges();
  }

  setTag(tag: string) {
    this.activeTag = this.activeTag === tag ? '' : tag;
    this.selectedItem = null;
    if (this.viewMode === 'items') this.loadItems();
    this.cdr.detectChanges();
  }

  onSearchChange() {
    if (this.viewMode === 'items') {
      this.loadItems();
    } else {
      this.applyFilters();
    }
  }

  onViewModeChange() {
    this.selectedItem = null;
    this.selectedSupplier = null;
    if (this.viewMode === 'items') this.loadItems();
    this.cdr.detectChanges();
  }

  loadTags(categoryId: string) {
    this.tagsLoading = true;
    this.cdr.detectChanges();
    this.supplierSvc.getTagsByCategory(categoryId).subscribe({
      next: (tags: string[]) => { this.availableTags = (tags || []).sort(); this.tagsLoading = false; this.cdr.detectChanges(); },
      error: () => { this.tagsLoading = false; this.cdr.detectChanges(); }
    });
  }

  loadItems() {
    this.itemsLoading = true;
    this.selectedItem = null;
    this.cdr.detectChanges();
    const params: any = {};
    if (this.activeCategory !== 'all') params.category_id = this.activeCategory;
    if (this.activeTag) params.tag = this.activeTag;
    this.supplierSvc.getItems(params).subscribe({
      next: (items: any[]) => {
        let result = items || [];
        if (this.searchTerm.trim()) {
          const term = this.searchTerm.toLowerCase();
          result = result.filter(i =>
            i.name.toLowerCase().includes(term) ||
            (i.supplier_name || '').toLowerCase().includes(term)
          );
        }
        this.filteredItems = result;
        this.itemsLoading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.itemsLoading = false; this.cdr.detectChanges(); }
    });
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
      result = result.filter(s => {
        const catIds: string[] = (s as any).category_ids || [];
        return catIds.includes(this.activeCategory);
      });
    }
    this.filtered = result;
    this.cdr.detectChanges();
  }

  countByCategory(catId: string): number {
    return this.suppliers.reduce((sum, s) => {
      if (((s as any).category_ids || []).includes(catId)) {
        return sum + (parseInt((s as any).item_count, 10) || 0);
      }
      return sum;
    }, 0);
  }

  totalItemCount(): number {
    return this.suppliers.reduce((sum, s) => sum + (parseInt((s as any).item_count, 10) || 0), 0);
  }

  selectItem(item: any) { this.selectedItem = item; this.cdr.detectChanges(); }
  selectSupplier(s: SupplierWithState) { this.selectedSupplier = s; this.cdr.detectChanges(); }

  isFav(supplierId: string): boolean { return this.favSvc.isSupplierFavourited(supplierId); }
  isItemFav(itemId: string): boolean { return this.favSvc.isItemFavourited(itemId); }

  toggleFav(event: MouseEvent, supplierId: string) {
    event.stopPropagation();
    this.favSvc.toggleSupplier(supplierId).subscribe(() => this.cdr.detectChanges());
  }

  toggleItemFav(event: MouseEvent, itemId: string) {
    event.stopPropagation();
    this.favSvc.toggleItem(itemId).subscribe(() => this.cdr.detectChanges());
  }

  goToSupplier(s: SupplierWithState, item: any | null) {
    const params: any = {};
    if (item) params['item'] = item.id;
    if (this.activeCategory !== 'all') params['cat'] = this.activeCategory;
    this.router.navigate(['/suppliers', s.id], { queryParams: params });
  }

  goToSupplierById(orgId: string) { this.router.navigate(['/suppliers', orgId]); }

  addToProject(item: any) {
    const projectId = this.route.snapshot.queryParams['projectId'];
    if (projectId) {
      this.router.navigate(['/projects', projectId], { queryParams: { addItem: item.id } });
    }
  }

  openItemImageUpload(event: MouseEvent, item: any) {
    event.stopPropagation();
    this.uploadItemId = item.id;
    this.uploadItemExistingUrl = item.image_url || '';
    this.cdr.detectChanges();
  }

  onItemImageUpdated(event: { coverUrl: string }) {
    const item = this.filteredItems.find((i: any) => i.id === this.uploadItemId);
    if (item) item.image_url = event.coverUrl;
    this.uploadItemId = '';
    this.cdr.detectChanges();
  }
}
