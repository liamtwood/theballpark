import { Component, Input, Output, EventEmitter, ChangeDetectorRef, OnChanges, SimpleChanges, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import {
  LucideAngularModule, Search, Heart, List, Layers,
  ChevronRight, ChevronLeft, MapPin, SquarePen
} from 'lucide-angular';
import { GbpPipe } from '../../pipes/gbp.pipe';
import { CatalogueEntity, CategoryInfo } from '../../../models';

@Component({
  selector: 'app-catalogue-grid',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    InputTextModule, ButtonModule, CheckboxModule,
    LucideAngularModule, GbpPipe
  ],
  template: `
    <!-- BACK BUTTON -->
    <div class="bp-grid-back-wrap" *ngIf="showBack">
      <button class="bp-grid-back-btn" (click)="onBack()">
        <lucide-icon name="chevron-left" [size]="14"></lucide-icon>
        {{ backLabel }}
      </button>
    </div>

    <!-- BREADCRUMB (when drilled into a category) -->
    <div class="bp-breadcrumb" *ngIf="drilledCategory">
      <button class="bp-breadcrumb-link" (click)="drillOut()">All Categories</button>
      <lucide-icon name="chevron-right" [size]="12" class="bp-breadcrumb-sep"></lucide-icon>
      <span class="bp-breadcrumb-current">{{ drilledCategory.name }}</span>
    </div>

    <!-- CATEGORY CIRCLES (single row — level-0 or level-1 depending on drill state) -->
    <div class="bp-cat-circles-wrap" *ngIf="categories.length">
      <button class="bp-circles-arrow bp-circles-arrow--left" *ngIf="canScrollLeft"
        (click)="scrollCircles(-200)">
        <lucide-icon name="chevron-left" [size]="16"></lucide-icon>
      </button>
      <div class="bp-cat-circles" #circlesRow (scroll)="onCirclesScroll()">
        <!-- "All" circle -->
        <button class="bp-cat-circle-btn"
          [class.active]="!drilledCategory ? activeCategory === 'all' : !activeChildCategory"
          (click)="!drilledCategory ? setCategory('all') : setChildCategory(null)">
          <div class="bp-cat-circle bp-cat-circle--all">
            <lucide-icon name="layers" [size]="22"></lucide-icon>
          </div>
          <span class="bp-cat-circle-label">All</span>
        </button>
        <!-- Category circles -->
        <button *ngFor="let cat of displayedCircles"
          class="bp-cat-circle-btn"
          [class.active]="!drilledCategory ? activeCategory === cat.id : activeChildCategory === cat.id"
          (click)="onCircleClick(cat)">
          <div class="bp-cat-circle"
            [style.background-image]="cat.cover_image_url ? 'url(' + cat.cover_image_url + ')' : null"
            [style.background-color]="!cat.cover_image_url && !cat.logo_url && cat.icon_name && cat.icon_color ? cat.icon_color : null"
            [class.bp-cat-circle--no-image]="!cat.cover_image_url && !cat.logo_url && !cat.icon_name"
            [class.bp-cat-circle--logo]="!!cat.logo_url && !cat.cover_image_url">
            <img *ngIf="cat.logo_url && !cat.cover_image_url" [src]="cat.logo_url" [alt]="cat.name" class="bp-cat-circle-logo-img"/>
            <lucide-icon *ngIf="!cat.cover_image_url && !cat.logo_url && cat.icon_name" [name]="cat.icon_name" [size]="28" class="bp-cat-circle-lucide"></lucide-icon>
            <lucide-icon *ngIf="!cat.cover_image_url && !cat.logo_url && !cat.icon_name && cat.icon" [name]="cat.icon" [size]="22" class="bp-cat-circle-icon"></lucide-icon>
            <span *ngIf="!cat.cover_image_url && !cat.logo_url && !cat.icon_name && !cat.icon" class="bp-cat-circle-initials">{{ cat.name.charAt(0) }}</span>
            <button *ngIf="showEdit" class="bp-cat-circle-edit" (click)="onCategoryEdit($event, cat)" title="Edit image">
              <lucide-icon name="square-pen" [size]="12"></lucide-icon>
            </button>
          </div>
          <span class="bp-cat-circle-label">{{ cat.name }}</span>
        </button>
      </div>
      <button class="bp-circles-arrow bp-circles-arrow--right" *ngIf="canScrollRight"
        (click)="scrollCircles(200)">
        <lucide-icon name="chevron-right" [size]="16"></lucide-icon>
      </button>
    </div>

    <!-- THREE-COLUMN BODY -->
    <div class="bp-cat-body bp-cat-body--detail">

      <!-- ── SIDEBAR ── -->
      <div class="bp-cat-sidebar">
        <div class="bp-sidebar-search">
          <lucide-icon name="search" [size]="14" class="bp-sidebar-search-icon"></lucide-icon>
          <input pInputText [(ngModel)]="searchQuery" (ngModelChange)="applySearch()"
            placeholder="Search..." class="bp-sidebar-search-input"/>
        </div>

        <!-- Not drilled in: show category list -->
        <ng-container *ngIf="!drilledCategory">
          <div class="bp-sidebar-sublabel">Category</div>
          <button class="bp-sidebar-item" [class.active]="activeCategory === 'all'" (click)="setCategory('all')">
            <span>All</span>
            <span class="bp-sidebar-count" *ngIf="totalCount">{{ totalCount }}</span>
          </button>
          <button *ngFor="let cat of parentCategories"
            class="bp-sidebar-item"
            [class.active]="activeCategory === cat.id"
            (click)="setCategory(cat.id)">
            <span>{{ cat.name }}</span>
            <span class="bp-sidebar-count" *ngIf="cat.count">{{ cat.count }}</span>
          </button>
        </ng-container>

        <!-- Drilled in: FORMAT + TYPE sections -->
        <ng-container *ngIf="drilledCategory">
          <button class="bp-sidebar-back" (click)="drillOut()">
            <lucide-icon name="chevron-left" [size]="13"></lucide-icon>
            All categories
          </button>

          <!-- FORMAT section (model=A subcategories) -->
          <div class="bp-sidebar-section-header mt-4">
            <span class="bp-sidebar-sublabel">Format</span>
            <div class="bp-sidebar-check-actions">
              <button class="bp-sidebar-check-link" (click)="checkAll()">All</button>
              <span class="bp-sidebar-check-sep">·</span>
              <button class="bp-sidebar-check-link" (click)="uncheckAll()">None</button>
            </div>
          </div>
          <div *ngFor="let child of childCategories" class="bp-sidebar-check-item">
            <p-checkbox [binary]="true"
              [ngModel]="checkedChildIds.has(child.id)"
              (onChange)="toggleChild(child.id)"
              [label]="child.name">
            </p-checkbox>
          </div>

          <!-- TYPE section (tags aggregated from items in this category) -->
          <ng-container *ngIf="tags.length">
            <div class="bp-sidebar-section-header mt-4">
              <span class="bp-sidebar-sublabel">Type</span>
              <div class="bp-sidebar-check-actions">
                <button class="bp-sidebar-check-link" (click)="checkAllTags()">All</button>
                <span class="bp-sidebar-check-sep">·</span>
                <button class="bp-sidebar-check-link" (click)="uncheckAllTags()">None</button>
              </div>
            </div>
            <div *ngFor="let tag of tags" class="bp-sidebar-check-item">
              <p-checkbox [binary]="true"
                [ngModel]="checkedTags.has(tag)"
                (onChange)="toggleTag(tag)"
                [label]="tag">
              </p-checkbox>
            </div>
          </ng-container>
        </ng-container>
      </div>

      <!-- ── MAIN ── -->
      <div class="bp-cat-main">
        <div class="bp-cat-section-header">
          <span class="bp-cat-section-title">{{ sectionTitle }}</span>
          <span class="bp-cat-section-count">{{ filteredEntities.length }} {{ entityLabel }}{{ filteredEntities.length !== 1 ? 's' : '' }}</span>
          <ng-content select="[catalogue-toggles]"></ng-content>
          <div class="bp-view-toggle">
            <button class="bp-view-btn" [class.active]="layout === 'list'" (click)="layout = 'list'">
              <lucide-icon name="list" [size]="14"></lucide-icon>
            </button>
            <button class="bp-view-btn" [class.active]="layout === 'card'" (click)="layout = 'card'">
              <lucide-icon name="layers" [size]="14"></lucide-icon>
            </button>
          </div>
        </div>

        <div *ngIf="!filteredEntities.length" class="bp-cat-empty">No {{ entityLabel }}s found.</div>

        <!-- LIST VIEW -->
        <ng-container *ngIf="layout === 'list' && filteredEntities.length">
          <div *ngFor="let e of filteredEntities"
            class="bp-list-row"
            [class.bp-list-row-selected]="selectedEntity?.id === e.id"
            (click)="select(e)">
            <div class="bp-list-img"
              [style.background-image]="getImageUrl(e) && e.image_display !== 'contain' ? 'url(' + getImageUrl(e) + ')' : null"
              [class.bp-list-img-default]="!getImageUrl(e)"
              [class.bp-list-img-logo]="!!getImageUrl(e) && e.image_display === 'contain'">
              <img *ngIf="getImageUrl(e) && e.image_display === 'contain'" [src]="getImageUrl(e)!" [alt]="e.name"/>
              <lucide-icon *ngIf="!getImageUrl(e) && e.icon" [name]="e.icon" [size]="18" class="bp-list-icon"></lucide-icon>
              <span *ngIf="!getImageUrl(e) && !e.icon" class="bp-list-initials">{{ e.name.charAt(0) }}</span>
            </div>
            <div class="bp-list-body">
              <div class="bp-list-name">
                {{ e.name }}
                <span class="bp-version-pill" *ngIf="e.badge">{{ e.badge }}</span>
              </div>
              <div class="bp-list-sub" *ngIf="e.subtitle">{{ e.subtitle }}</div>
            </div>
            <div class="bp-list-right" *ngIf="e.price || e.priceRange">
              <div class="bp-list-price" *ngIf="e.priceRange">{{ e.priceRange.min | gbp }} – {{ e.priceRange.max | gbp }}</div>
              <div class="bp-list-price" *ngIf="e.price && !e.priceRange">{{ e.price | gbp }}</div>
              <div class="bp-list-unit" *ngIf="e.unit">{{ e.unit }}</div>
            </div>
            <button *ngIf="showFavourite" class="bp-heart-btn" [class.active]="favouriteIds.has(e.id)"
              (click)="onToggleFav($event, e)">
              <lucide-icon name="heart" [size]="16"></lucide-icon>
            </button>
            <lucide-icon name="chevron-right" [size]="16" class="bp-row-chev"></lucide-icon>
          </div>
        </ng-container>

        <!-- CARD GRID -->
        <ng-container *ngIf="layout === 'card' && filteredEntities.length">
          <div class="bp-item-grid">
            <div *ngFor="let e of filteredEntities"
              class="bp-item-card"
              [class.bp-item-card-selected]="selectedEntity?.id === e.id"
              (click)="select(e)">
              <div class="bp-item-card-img"
                [style.background-image]="getImageUrl(e) && e.image_display !== 'contain' ? 'url(' + getImageUrl(e) + ')' : null"
                [class.bp-item-card-img-default]="!getImageUrl(e)"
                [class.bp-item-card-img-logo]="!!getImageUrl(e) && e.image_display === 'contain'">
                <img *ngIf="getImageUrl(e) && e.image_display === 'contain'" [src]="getImageUrl(e)!" [alt]="e.name" class="bp-card-logo-img"/>
                <lucide-icon *ngIf="!getImageUrl(e) && e.icon" [name]="e.icon" [size]="32" class="bp-card-icon"></lucide-icon>
                <span *ngIf="!getImageUrl(e) && !e.icon" class="bp-card-initials">{{ e.name.charAt(0) }}</span>
                <div class="bp-grid-actions">
                  <button *ngIf="showEdit" class="bp-grid-action-btn" (click)="onEdit($event, e)">
                    <lucide-icon name="square-pen" [size]="14"></lucide-icon>
                  </button>
                  <button *ngIf="showFavourite" class="bp-grid-action-btn" [class.bp-grid-heart-active]="favouriteIds.has(e.id)"
                    (click)="onToggleFav($event, e)">
                    <lucide-icon name="heart" [size]="14"></lucide-icon>
                  </button>
                </div>
              </div>
              <div class="bp-item-card-body">
                <div class="bp-item-card-name">
                  {{ e.name }}
                  <span class="bp-version-pill" *ngIf="e.badge">{{ e.badge }}</span>
                </div>
                <div class="bp-item-card-price" *ngIf="e.price">
                  {{ e.price | gbp }}
                  <span class="bp-item-card-unit" *ngIf="e.unit">{{ e.unit }}</span>
                </div>
                <div class="bp-item-card-supplier" *ngIf="e.subtitle && !e.price">{{ e.subtitle }}</div>
                <div class="bp-item-card-supplier" *ngIf="e.subtitle && e.price">{{ e.subtitle }}</div>
              </div>
            </div>
          </div>
        </ng-container>
      </div>

      <!-- ── RIGHT DETAIL PANEL ── -->
      <div class="bp-cat-detail">
        <ng-container *ngIf="selectedEntity">
          <!-- Hero image -->
          <div class="bp-detail-hero"
            [style.background-image]="getImageUrl(selectedEntity) && selectedEntity.image_display !== 'contain' ? 'url(' + getImageUrl(selectedEntity) + ')' : null"
            [class.bp-detail-hero-default]="!getImageUrl(selectedEntity)"
            [class.bp-detail-hero-logo]="!!getImageUrl(selectedEntity) && selectedEntity.image_display === 'contain'">
            <img *ngIf="getImageUrl(selectedEntity) && selectedEntity.image_display === 'contain'"
                 [src]="getImageUrl(selectedEntity)!" [alt]="selectedEntity.name" class="bp-detail-hero-logo-img"/>
            <span *ngIf="!getImageUrl(selectedEntity)"
                  class="bp-detail-hero-initials">{{ selectedEntity.name.charAt(0) }}</span>
          </div>

          <div class="bp-detail-body">
            <!-- Category label -->
            <div class="bp-detail-cat-label" *ngIf="selectedEntity.categoryLabel">{{ selectedEntity.categoryLabel | uppercase }}</div>

            <!-- Name -->
            <div class="bp-detail-name">{{ selectedEntity.name }}</div>

            <!-- Subtitle (city or supplier name) -->
            <div class="bp-detail-subtitle" *ngIf="selectedEntity.subtitle">
              <lucide-icon name="map-pin" [size]="12"></lucide-icon>
              {{ selectedEntity.subtitle }}
            </div>

            <!-- Price -->
            <div class="bp-detail-price-row" *ngIf="selectedEntity.price || selectedEntity.priceRange">
              <ng-container *ngIf="selectedEntity.priceRange">
                <span class="bp-detail-price">{{ selectedEntity.priceRange.min | gbp }}</span>
                <span class="bp-detail-price-sep">–</span>
                <span class="bp-detail-price">{{ selectedEntity.priceRange.max | gbp }}</span>
              </ng-container>
              <span class="bp-detail-price" *ngIf="!selectedEntity.priceRange">{{ selectedEntity.price | gbp }}</span>
              <span class="bp-detail-price-unit" *ngIf="selectedEntity.unit">{{ selectedEntity.unit }}</span>
            </div>

            <!-- Description -->
            <p class="bp-detail-desc" *ngIf="selectedEntity.description">{{ selectedEntity.description }}</p>

            <!-- Specs -->
            <div class="bp-detail-specs" *ngIf="selectedEntity.specs?.length">
              <div class="bp-detail-spec" *ngFor="let spec of selectedEntity.specs">
                <span class="bp-detail-spec-label">{{ spec.label }}</span>
                <span class="bp-detail-spec-value">{{ spec.value }}</span>
              </div>
            </div>

            <!-- Parent entity card (items show their supplier) -->
            <div class="bp-detail-parent" *ngIf="selectedEntity.parentEntity" (click)="onParentClick(selectedEntity)">
              <div class="bp-detail-parent-img"
                [style.background-image]="selectedEntity.parentEntity.image_url ? 'url(' + selectedEntity.parentEntity.image_url + ')' : null"
                [class.bp-detail-parent-img-default]="!selectedEntity.parentEntity.image_url">
              </div>
              <div class="bp-detail-parent-body">
                <div class="bp-detail-parent-name">{{ selectedEntity.parentEntity.name }}</div>
                <div class="bp-detail-parent-sub" *ngIf="selectedEntity.parentEntity.subtitle">
                  <lucide-icon name="map-pin" [size]="10"></lucide-icon>
                  {{ selectedEntity.parentEntity.subtitle }}
                </div>
              </div>
              <lucide-icon name="chevron-right" [size]="14" class="bp-row-chev"></lucide-icon>
            </div>

            <!-- Action buttons -->
            <div class="flex gap-2">
              <p-button [label]="actionLabel" styleClass="flex-1"
                (onClick)="onAction(selectedEntity)"></p-button>
              <p-button *ngIf="showFavourite" icon="pi pi-heart" styleClass="p-button-outlined"
                [class.p-button-danger]="favouriteIds.has(selectedEntity.id)"
                (onClick)="onToggleFav($event, selectedEntity)"></p-button>
            </div>
          </div>
        </ng-container>

        <!-- Empty state -->
        <div *ngIf="!selectedEntity" class="bp-detail-empty">
          <p>Select {{ entityLabel === 'item' ? 'an' : 'a' }} {{ entityLabel }} to preview</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .bp-grid-back-wrap { padding: 12px 28px 0; }
    .bp-grid-back-btn { display: flex; align-items: center; gap: 4px; background: none; border: none; cursor: pointer; font-family: var(--font-body); font-size: 12px; font-weight: 500; color: var(--theme-accent); padding: 4px 0; }
    .bp-grid-back-btn:hover { opacity: 0.75; }

    /* ── BREADCRUMB ── */
    .bp-breadcrumb { display: flex; align-items: center; gap: 6px; padding: 12px 28px 0; font-family: var(--font-body); font-size: 12px; }
    .bp-breadcrumb-link { background: none; border: none; cursor: pointer; font-family: var(--font-body); font-size: 12px; font-weight: 500; color: var(--theme-accent); padding: 0; }
    .bp-breadcrumb-link:hover { opacity: 0.75; }
    .bp-breadcrumb-sep { color: var(--color-text-muted); }
    .bp-breadcrumb-current { font-weight: 500; color: var(--color-text-primary); }

    .bp-cat-circles-wrap { padding: 20px 28px 0; border-bottom: 0.5px solid var(--color-border); position: relative; display: flex; align-items: flex-start; min-width: 0; overflow: clip visible; overflow-x: clip; overflow-y: visible; }
    .bp-cat-circles { display: flex; gap: 20px; overflow-x: auto; padding: 4px 4px 20px; margin: -4px -4px 0; scrollbar-width: none; flex: 1; min-width: 0; scroll-behavior: smooth; }
    .bp-circles-arrow {
      width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
      background: var(--color-surface); border: 0.5px solid var(--color-border);
      color: var(--theme-accent); cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      margin-top: 32px; transition: all 0.15s; z-index: 2;
    }
    .bp-circles-arrow:hover { border-color: var(--theme-accent); }
    .bp-circles-arrow--left { margin-right: 8px; }
    .bp-circles-arrow--right { margin-left: 8px; }
    .bp-cat-circles::-webkit-scrollbar { display: none; }
    .bp-cat-circle-btn { display: flex; flex-direction: column; align-items: center; gap: 8px; background: none; border: none; cursor: pointer; flex-shrink: 0; padding: 0; }
    .bp-cat-circle { width: 96px; height: 96px; border-radius: 50%; background-size: cover; background-position: center; border: 2.5px solid transparent; transition: border-color 0.15s; display: flex; align-items: center; justify-content: center; background-color: var(--color-surface); box-shadow: 0 0 0 0.5px var(--color-border); color: var(--color-text-muted); position: relative; }
    .bp-cat-circle--all { background-color: var(--color-surface); }
    .bp-cat-circle--no-image { background-color: var(--theme-bg); }
    .bp-cat-circle-initials { font-size: 28px; font-weight: 600; color: var(--theme-accent); font-family: var(--font-display); }
    .bp-cat-circle-icon { color: var(--theme-accent); }
    .bp-cat-circle-lucide { color: var(--color-text-muted); }
    .bp-cat-circle--logo { background: var(--theme-bg); }
    .bp-cat-circle-logo-img { width: 60%; height: 60%; object-fit: contain; border-radius: 0; }
    .bp-cat-circle-edit {
      position: absolute; bottom: 2px; right: 2px;
      width: 22px; height: 22px; border-radius: 50%;
      background: var(--color-surface); border: 1px solid var(--color-border);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: var(--color-text-muted); transition: all 0.15s;
      opacity: 0; pointer-events: none;
    }
    .bp-cat-circle:hover .bp-cat-circle-edit { opacity: 1; pointer-events: auto; }
    .bp-cat-circle-edit:hover { color: var(--theme-accent); border-color: var(--theme-accent); }

    .bp-cat-circle-btn.active .bp-cat-circle { border-color: var(--theme-accent); box-shadow: 0 0 0 2px var(--theme-accent); }
    .bp-cat-circle-label { font-size: 11px; font-weight: 500; color: var(--color-text-secondary); text-align: center; max-width: 96px; line-height: 1.3; font-family: var(--font-body); }
    .bp-cat-circle-btn.active .bp-cat-circle-label { color: var(--theme-accent); font-weight: 600; }

    .bp-cat-body { display: grid; grid-template-columns: 260px 1fr; height: calc(100vh - var(--nav-height) - 160px); }
    .bp-cat-body--detail { grid-template-columns: 260px 1fr 260px; }
    .bp-cat-sidebar { border-right: 0.5px solid var(--color-border); padding: 20px 16px; overflow-y: auto; }
    .bp-cat-main { padding: 20px 28px; overflow-y: auto; min-width: 0; }
    .bp-cat-detail { border-left: 0.5px solid var(--color-border); overflow-y: auto; }

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

    /* ── SIDEBAR CHECKBOXES ── */
    .bp-sidebar-check-actions { display: flex; align-items: center; gap: 6px; }
    .bp-sidebar-section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .bp-sidebar-section-header .bp-sidebar-sublabel { margin-bottom: 0; }
    .bp-sidebar-check-link { background: none; border: none; cursor: pointer; font-family: var(--font-body); font-size: 11px; font-weight: 500; color: var(--theme-accent); padding: 0; }
    .bp-sidebar-check-link:hover { opacity: 0.75; }
    .bp-sidebar-check-sep { color: var(--color-text-muted); font-size: 11px; }
    .bp-sidebar-check-item { padding: 4px 0; }
    :host ::ng-deep .bp-sidebar-check-item .p-checkbox-label { font-size: 12px !important; font-weight: 500 !important; color: var(--color-text-secondary) !important; cursor: pointer; }
    :host ::ng-deep .bp-sidebar-check-item .p-checkbox .p-checkbox-box { width: 16px !important; height: 16px !important; border-radius: 3px !important; }
    :host ::ng-deep .bp-sidebar-check-item .p-checkbox.p-checkbox-checked .p-checkbox-box { background: var(--theme-accent) !important; border-color: var(--theme-accent) !important; }

    .bp-cat-section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
    .bp-cat-section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--theme-accent); }
    .bp-cat-section-count { font-size: 12px; color: var(--color-text-muted); flex: 1; }
    .bp-view-toggle { display: flex; gap: 4px; }
    .bp-view-btn { width: 30px; height: 30px; border-radius: 6px; border: 0.5px solid var(--color-border); background: var(--color-surface); color: var(--color-text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
    .bp-view-btn.active { background: var(--theme-bg); border-color: var(--theme-border); color: var(--theme-accent); }
    .bp-cat-empty { padding: 40px 16px; text-align: center; font-size: 13px; color: var(--color-text-muted); }

    /* LIST VIEW */
    .bp-list-row { display: flex; align-items: center; gap: 14px; padding: 10px 0; border-bottom: 0.5px solid var(--color-border); cursor: pointer; transition: background 0.15s; }
    .bp-list-row:hover { background: var(--color-surface); margin: 0 -12px; padding: 10px 12px; border-radius: 8px; border-bottom-color: transparent; }
    .bp-list-row-selected { background: var(--theme-bg) !important; margin: 0 -12px !important; padding: 10px 12px !important; border-radius: 8px !important; border-bottom-color: transparent !important; border-left: 3px solid var(--theme-accent); }
    .bp-list-img { width: 44px; height: 44px; border-radius: 10px; flex-shrink: 0; background-size: cover; background-position: center; }
    .bp-list-img-default { background: var(--theme-bg); display: flex; align-items: center; justify-content: center; }
    .bp-list-img-logo { background: var(--theme-bg); display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 4px; }
    .bp-list-img-logo img { max-width: 36px; max-height: 36px; object-fit: contain; }
    .bp-list-initials { font-size: 16px; font-weight: 600; color: var(--theme-accent); font-family: var(--font-display); }
    .bp-list-icon { color: var(--theme-accent); }
    .bp-list-body { flex: 1; min-width: 0; }
    .bp-list-name { font-size: 14px; font-weight: 500; color: var(--color-text-primary); display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .bp-version-pill {
      display: inline-flex; align-items: center;
      font-size: 10px; font-weight: 600; letter-spacing: 0.02em;
      padding: 1px 7px; border-radius: 10px;
      background: var(--theme-bg); color: var(--theme-accent);
      font-family: var(--font-body);
    }
    .bp-list-sub { font-size: 12px; color: var(--color-text-muted); }
    .bp-list-right { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; }
    .bp-list-price { font-size: 13px; font-weight: 600; color: var(--color-text-primary); }
    .bp-list-unit { font-size: 10px; color: var(--color-text-muted); }
    .bp-row-chev { color: var(--color-text-muted); flex-shrink: 0; }

    /* CARD GRID */
    .bp-item-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 16px; }
    .bp-item-card { border-radius: 10px; overflow: hidden; border: 0.5px solid var(--color-border); cursor: pointer; transition: border-color 0.15s; background: var(--color-surface); }
    .bp-item-card:hover { border-color: var(--theme-accent); }
    .bp-item-card-selected { border-color: var(--theme-accent) !important; box-shadow: 0 0 0 1px var(--theme-accent); }
    .bp-item-card-img { width: 100%; height: 140px; background-size: cover; background-position: center; position: relative; }
    .bp-item-card-img-default { background: var(--theme-bg); display: flex; align-items: center; justify-content: center; }
    .bp-item-card-img-logo { background: var(--theme-bg); display: flex; align-items: center; justify-content: center; padding: 16px; overflow: hidden; }
    .bp-card-logo-img { max-height: 108px; max-width: calc(100% - 32px); object-fit: contain; }
    .bp-card-initials { font-size: 36px; font-weight: 600; color: var(--theme-accent); font-family: var(--font-display); }
    .bp-card-icon { color: var(--theme-accent); }
    .bp-item-card-body { padding: 10px 12px; }
    .bp-item-card-name { font-size: 13px; font-weight: 600; color: var(--color-text-primary); margin-bottom: 4px; line-height: 1.3; display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
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

    /* DETAIL PANEL */
    .bp-detail-empty { display: flex; align-items: center; justify-content: center; height: 100%; font-size: 13px; color: var(--color-text-muted); padding: 40px 20px; text-align: center; }
    .bp-detail-hero { width: 100%; height: 160px; background-size: cover; background-position: center; }
    .bp-detail-hero-default { background: var(--theme-bg); display: flex; align-items: center; justify-content: center; }
    .bp-detail-hero-logo { background: var(--theme-bg); display: flex; align-items: center; justify-content: center; padding: 16px; overflow: hidden; }
    .bp-detail-hero-logo-img { max-height: 128px; max-width: calc(100% - 32px); object-fit: contain; }
    .bp-detail-hero-initials { font-size: 48px; font-weight: 600; color: var(--theme-accent); font-family: var(--font-display); }
    .bp-detail-body { padding: 16px 20px; }
    .bp-detail-cat-label { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; color: var(--theme-accent); margin-bottom: 4px; }
    .bp-detail-name { font-family: var(--font-display); font-size: 18px; font-weight: 400; color: var(--color-text-primary); margin-bottom: 8px; line-height: 1.3; }
    .bp-detail-subtitle { display: flex; align-items: center; gap: 3px; font-size: 10px; color: var(--color-text-muted); margin-bottom: 10px; }
    .bp-detail-price-row { display: flex; align-items: baseline; gap: 4px; flex-wrap: wrap; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 0.5px solid var(--color-border); }
    .bp-detail-price { font-size: 22px; font-weight: 700; color: var(--color-text-primary); }
    .bp-detail-price-sep { font-size: 16px; color: var(--color-text-muted); }
    .bp-detail-price-unit { font-size: 12px; color: var(--color-text-muted); margin-left: 4px; }
    .bp-detail-desc { font-size: 12px; color: var(--color-text-secondary); line-height: 1.6; margin-bottom: 14px; }
    .bp-detail-specs { border: 0.5px solid var(--color-border); border-radius: 10px; overflow: hidden; margin-bottom: 14px; }
    .bp-detail-spec { display: flex; justify-content: space-between; padding: 9px 12px; border-bottom: 0.5px solid var(--color-border); font-size: 12px; }
    .bp-detail-spec:last-child { border-bottom: none; }
    .bp-detail-spec-label { color: var(--color-text-muted); }
    .bp-detail-spec-value { font-weight: 500; color: var(--color-text-primary); }
    .bp-detail-parent { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 0.5px solid var(--color-border); border-radius: 10px; margin-bottom: 16px; cursor: pointer; transition: border-color 0.15s; }
    .bp-detail-parent:hover { border-color: var(--theme-accent); }
    .bp-detail-parent-img { width: 32px; height: 32px; border-radius: 7px; flex-shrink: 0; background-size: cover; background-position: center; }
    .bp-detail-parent-img-default { background: var(--theme-bg); }
    .bp-detail-parent-body { flex: 1; min-width: 0; }
    .bp-detail-parent-name { font-size: 12px; font-weight: 500; color: var(--color-text-primary); }
    .bp-detail-parent-sub { display: flex; align-items: center; gap: 3px; font-size: 10px; color: var(--color-text-muted); margin-top: 1px; }

    @media (max-width: 768px) {
      .bp-cat-circles-wrap { display: none; }
      .bp-cat-body, .bp-cat-body--detail { display: none; }
    }
  `]
})
export class CatalogueGridComponent implements OnChanges, AfterViewInit {
  @Input() entities: CatalogueEntity[] = [];
  @Input() categories: CategoryInfo[] = [];
  @Input() tags: string[] = [];
  @Input() entityType: 'item' | 'supplier' | 'feedback' = 'item';
  @Input() entityLabel: string = 'item';
  @Input() sectionTitle: string = 'CATALOGUE';
  @Input() actionLabel: string = 'View';
  @Input() favouriteIds: Set<string> = new Set();
  @Input() showEdit = true;
  @Input() showFavourite = true;
  @Input() showBack = false;
  @Input() backLabel = 'Back to catalogue';
  @Input() totalCount = 0;

  @Output() entitySelected = new EventEmitter<CatalogueEntity>();
  @Output() backClicked = new EventEmitter<void>();
  @Output() favouriteToggled = new EventEmitter<string>();
  @Output() imageEditRequested = new EventEmitter<CatalogueEntity>();
  @Output() actionClicked = new EventEmitter<CatalogueEntity>();
  @Output() parentClicked = new EventEmitter<CatalogueEntity>();
  @Output() categoryChanged = new EventEmitter<string>();
  @Output() drillChanged = new EventEmitter<string | null>();
  @Output() tagChanged = new EventEmitter<string>();
  @Output() searchChanged = new EventEmitter<string>();
  @Output() categoryImageEditRequested = new EventEmitter<CategoryInfo>();

  selectedEntity: CatalogueEntity | null = null;
  activeCategory = 'all';
  activeChildCategory: string | null = null;
  activeTag = '';
  searchQuery = '';
  layout: 'list' | 'card' = 'card';
  filteredEntities: CatalogueEntity[] = [];

  // Drill-down state
  drilledCategory: CategoryInfo | null = null;
  checkedChildIds: Set<string> = new Set();
  checkedTags: Set<string> = new Set();

  get parentCategories(): CategoryInfo[] {
    return this.categories.filter(c => !c.parent_id);
  }

  get childCategories(): CategoryInfo[] {
    if (!this.drilledCategory) return [];
    // Only show model='A' children as FORMAT subcategories — the only model
    // items are actually assigned to today. B/C/D children are legacy POC rows.
    return this.categories.filter(c =>
      c.parent_id === this.drilledCategory!.id && (c.model || 'A') === 'A'
    );
  }

  get displayedCircles(): CategoryInfo[] {
    return this.drilledCategory ? this.childCategories : this.parentCategories;
  }

  @ViewChild('circlesRow') circlesRowRef!: ElementRef<HTMLDivElement>;
  canScrollLeft = false;
  canScrollRight = false;

  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit() { this.checkScrollArrows(); }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['entities']) {
      this.applyFilter();
    }
    if (changes['categories']) {
      setTimeout(() => this.checkScrollArrows(), 0);
    }
    if (changes['tags']) {
      // All tags checked by default whenever the tag list changes
      this.checkedTags = new Set(this.tags || []);
      this.applyFilter();
    }
  }

  scrollCircles(delta: number) {
    const el = this.circlesRowRef?.nativeElement;
    if (el) {
      el.scrollBy({ left: delta, behavior: 'smooth' });
      setTimeout(() => this.checkScrollArrows(), 350);
    }
  }

  onCirclesScroll() { this.checkScrollArrows(); }

  private checkScrollArrows() {
    const el = this.circlesRowRef?.nativeElement;
    if (!el) return;
    this.canScrollLeft = el.scrollLeft > 0;
    this.canScrollRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    this.cdr.detectChanges();
  }

  getImageUrl(e: CatalogueEntity): string | null {
    return e.image_url || e.cover_image_url || e.external_url || null;
  }

  select(e: CatalogueEntity) {
    this.selectedEntity = e;
    this.entitySelected.emit(e);
    this.cdr.detectChanges();
  }

  // ── Circle click handler ──────────────────────────────────────────────

  onCircleClick(cat: CategoryInfo) {
    if (this.drilledCategory) {
      // We're in drill-down mode — clicking a child circle
      this.setChildCategory(cat.id);
    } else {
      // Top-level — click a level-0 circle
      this.setCategory(cat.id);
    }
  }

  setCategory(catId: string) {
    if (catId === 'all') {
      this.drillOut();
      return;
    }

    // Check if this category has children → drill in
    const hasChildren = this.categories.some(c => c.parent_id === catId);
    if (hasChildren) {
      const cat = this.categories.find(c => c.id === catId);
      if (cat) this.drillIn(cat);
    } else {
      // Simple category (no children) — just filter (orgs/admin pattern)
      this.activeCategory = catId;
      this.activeChildCategory = null;
      this.activeTag = '';
      this.selectedEntity = null;
      this.categoryChanged.emit(catId);
      this.applyFilter();
    }
  }

  // ── Drill-down ────────────────────────────────────────────────────────

  drillIn(cat: CategoryInfo) {
    this.drilledCategory = cat;
    this.activeCategory = cat.id;
    this.activeChildCategory = null;
    this.activeTag = '';
    this.selectedEntity = null;

    // Check all children by default
    this.checkedChildIds = new Set(
      this.categories.filter(c => c.parent_id === cat.id).map(c => c.id)
    );

    this.categoryChanged.emit(cat.id);
    this.drillChanged.emit(cat.id);
    this.applyFilter();
    setTimeout(() => this.checkScrollArrows(), 0);
    this.cdr.detectChanges();
  }

  drillOut() {
    this.drilledCategory = null;
    this.activeCategory = 'all';
    this.activeChildCategory = null;
    this.activeTag = '';
    this.selectedEntity = null;
    this.checkedChildIds.clear();
    this.checkedTags.clear();

    this.categoryChanged.emit('all');
    this.drillChanged.emit(null);
    this.applyFilter();
    setTimeout(() => this.checkScrollArrows(), 0);
    this.cdr.detectChanges();
  }

  setChildCategory(childId: string | null) {
    this.activeChildCategory = childId;
    this.activeTag = '';
    this.selectedEntity = null;
    this.categoryChanged.emit(childId || this.activeCategory);
    this.applyFilter();
  }

  // ── Checkbox controls ─────────────────────────────────────────────────

  toggleChild(childId: string) {
    if (this.checkedChildIds.has(childId)) {
      this.checkedChildIds.delete(childId);
    } else {
      this.checkedChildIds.add(childId);
    }
    this.checkedChildIds = new Set(this.checkedChildIds); // trigger change detection
    this.applyFilter();
  }

  checkAll() {
    this.checkedChildIds = new Set(this.childCategories.map(c => c.id));
    this.applyFilter();
  }

  uncheckAll() {
    this.checkedChildIds.clear();
    this.checkedChildIds = new Set(); // trigger change detection
    this.applyFilter();
  }

  toggleTag(tag: string) {
    if (this.checkedTags.has(tag)) {
      this.checkedTags.delete(tag);
    } else {
      this.checkedTags.add(tag);
    }
    this.checkedTags = new Set(this.checkedTags); // trigger change detection
    this.applyFilter();
  }

  checkAllTags() {
    this.checkedTags = new Set(this.tags || []);
    this.applyFilter();
  }

  uncheckAllTags() {
    this.checkedTags = new Set();
    this.applyFilter();
  }

  // ── Other handlers ────────────────────────────────────────────────────

  onBack() {
    this.backClicked.emit();
  }

  setTag(tag: string) {
    this.activeTag = this.activeTag === tag ? '' : tag;
    this.selectedEntity = null;
    this.tagChanged.emit(this.activeTag);
  }

  applySearch() {
    this.searchChanged.emit(this.searchQuery);
    this.applyFilter();
  }

  onEdit(event: MouseEvent, e: CatalogueEntity) {
    event.stopPropagation();
    this.imageEditRequested.emit(e);
  }

  onCategoryEdit(event: MouseEvent, cat: CategoryInfo) {
    event.stopPropagation();
    this.categoryImageEditRequested.emit(cat);
  }

  onToggleFav(event: any, e: CatalogueEntity) {
    if (event.stopPropagation) event.stopPropagation();
    this.favouriteToggled.emit(e.id);
  }

  onAction(e: CatalogueEntity) {
    this.actionClicked.emit(e);
  }

  onParentClick(e: CatalogueEntity) {
    this.parentClicked.emit(e);
  }

  // ── Filtering ─────────────────────────────────────────────────────────

  private applyFilter() {
    let result = this.entities;

    if (this.drilledCategory) {
      // FORMAT filter — restrict by checked subcategory IDs.
      // Items assigned directly to the parent category also pass.
      const validIds = new Set(this.checkedChildIds);
      validIds.add(this.drilledCategory.id);

      if (this.activeChildCategory) {
        result = result.filter(e => e.category_id === this.activeChildCategory);
      } else {
        result = result.filter(e => e.category_id && validIds.has(e.category_id));
      }

      // TYPE filter — only applied if the user has unchecked at least one tag.
      // Default (all tags checked) passes everything, including items with no tags.
      // Once filtered, items must have >=1 tag in the checked set (items with
      // empty tags are excluded, which is the honest behaviour).
      if (this.tags.length && this.checkedTags.size < this.tags.length) {
        result = result.filter(e => {
          const itemTags: string[] = e._raw?.tags || [];
          return itemTags.some(t => this.checkedTags.has(t));
        });
      }
    } else if (this.activeCategory !== 'all') {
      // Simple filter (no drill — used by orgs/admin grids)
      result = result.filter(e => e.category_id === this.activeCategory);
    }

    if (this.searchQuery.trim()) {
      const term = this.searchQuery.toLowerCase();
      result = result.filter(e =>
        e.name.toLowerCase().includes(term) ||
        (e.subtitle || '').toLowerCase().includes(term)
      );
    }
    this.filteredEntities = result;
    this.selectedEntity = null;
    this.cdr.detectChanges();
  }
}
