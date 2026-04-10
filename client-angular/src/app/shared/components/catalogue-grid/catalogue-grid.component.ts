import { Component, Input, Output, EventEmitter, ChangeDetectorRef, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
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
    InputTextModule, ButtonModule,
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

    <!-- CATEGORY CIRCLES -->
    <div class="bp-cat-circles-wrap" *ngIf="categories.length">
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

    <!-- CATEGORY HEADER PANEL -->
    <div class="bp-cat-header-panel" *ngIf="selectedCategory && activeCategory !== 'all'">
      <div class="bp-cat-header-inner">
        <div class="bp-cat-header-tagline" *ngIf="selectedCategory.tagline">{{ selectedCategory.tagline }}</div>
        <h2 class="bp-cat-header-name">{{ selectedCategory.name }}</h2>
        <p class="bp-cat-header-desc" *ngIf="selectedCategory.description">{{ selectedCategory.description }}</p>
        <div class="bp-cat-header-tags" *ngIf="selectedCategory.tags?.length">
          <span class="bp-cat-header-tag" *ngFor="let tag of selectedCategory.tags">{{ tag }}</span>
        </div>
      </div>
    </div>

    <!-- CHILD CATEGORY CIRCLES -->
    <div class="bp-child-circles-wrap" *ngIf="childCategories.length && activeCategory !== 'all'">
      <div class="bp-child-circles">
        <button class="bp-child-circle-btn" [class.active]="activeChildCategory === 'all'" (click)="setChildCategory('all')">
          <div class="bp-child-circle bp-child-circle--all">
            <lucide-icon name="layers" [size]="16"></lucide-icon>
          </div>
          <span class="bp-child-circle-label">All</span>
        </button>
        <button *ngFor="let child of childCategories"
          class="bp-child-circle-btn"
          [class.active]="activeChildCategory === child.id"
          (click)="setChildCategory(child.id)">
          <div class="bp-child-circle"
            [style.background-image]="child.cover_image_url ? 'url(' + child.cover_image_url + ')' : null"
            [class.bp-child-circle--no-image]="!child.cover_image_url">
            <span *ngIf="!child.cover_image_url" class="bp-child-circle-initials">{{ child.name.charAt(0) }}</span>
          </div>
          <span class="bp-child-circle-label">{{ child.name }}</span>
        </button>
      </div>
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

        <ng-container *ngIf="activeCategory === 'all'">
          <div class="bp-sidebar-sublabel">Category</div>
          <button class="bp-sidebar-item active" (click)="setCategory('all')">
            <span>All</span>
            <span class="bp-sidebar-count" *ngIf="totalCount">{{ totalCount }}</span>
          </button>
          <button *ngFor="let cat of categories"
            class="bp-sidebar-item"
            (click)="setCategory(cat.id)">
            <span>{{ cat.name }}</span>
            <span class="bp-sidebar-count" *ngIf="cat.count">{{ cat.count }}</span>
          </button>
        </ng-container>

        <ng-container *ngIf="activeCategory !== 'all'">
          <button class="bp-sidebar-back" (click)="setCategory('all')">
            <lucide-icon name="chevron-left" [size]="13"></lucide-icon>
            All categories
          </button>
          <div class="bp-sidebar-sublabel mt-4" *ngIf="tags.length">Filter by type</div>
          <button *ngFor="let tag of tags"
            class="bp-sidebar-item"
            [class.active]="activeTag === tag"
            (click)="setTag(tag)">
            <span>{{ tag }}</span>
          </button>
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
              <span *ngIf="!getImageUrl(e)" class="bp-list-initials">{{ e.name.charAt(0) }}</span>
            </div>
            <div class="bp-list-body">
              <div class="bp-list-name">{{ e.name }}</div>
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
                <span *ngIf="!getImageUrl(e)" class="bp-card-initials">{{ e.name.charAt(0) }}</span>
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
                <div class="bp-item-card-name">{{ e.name }}</div>
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

    /* CHILD CATEGORY CIRCLES */
    .bp-child-circles-wrap { padding: 16px 28px 0; border-bottom: 0.5px solid var(--color-border); }
    .bp-child-circles { display: flex; gap: 16px; overflow-x: auto; padding-bottom: 16px; scrollbar-width: none; justify-content: center; }
    .bp-child-circles::-webkit-scrollbar { display: none; }
    .bp-child-circle-btn { display: flex; flex-direction: column; align-items: center; gap: 6px; background: none; border: none; cursor: pointer; flex-shrink: 0; padding: 0; }
    .bp-child-circle { width: 64px; height: 64px; border-radius: 50%; background-size: cover; background-position: center; border: 2px solid transparent; transition: border-color 0.15s; display: flex; align-items: center; justify-content: center; background-color: var(--color-surface); box-shadow: 0 0 0 0.5px var(--color-border); color: var(--color-text-muted); }
    .bp-child-circle--all { background-color: var(--color-surface); }
    .bp-child-circle--no-image { background-color: var(--theme-bg); }
    .bp-child-circle-initials { font-size: 20px; font-weight: 600; color: var(--theme-accent); font-family: var(--font-display); }
    .bp-child-circle-btn.active .bp-child-circle { border-color: var(--theme-accent); box-shadow: 0 0 0 2px var(--theme-accent); }
    .bp-child-circle-label { font-size: 10px; font-weight: 500; color: var(--color-text-secondary); text-align: center; max-width: 72px; line-height: 1.3; font-family: var(--font-body); }
    .bp-child-circle-btn.active .bp-child-circle-label { color: var(--theme-accent); font-weight: 600; }

    /* CATEGORY HEADER PANEL */
    .bp-cat-header-panel { background: var(--color-surface); border-bottom: 0.5px solid var(--color-border); padding: 28px 28px 24px; }
    .bp-cat-header-inner { max-width: 680px; margin: 0 auto; text-align: center; }
    .bp-cat-header-tagline { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--theme-accent); margin-bottom: 6px; }
    .bp-cat-header-name { font-family: var(--font-display); font-size: 26px; font-weight: 400; color: var(--color-text-primary); margin: 0 0 10px; line-height: 1.3; }
    .bp-cat-header-desc { font-size: 13px; color: var(--color-text-secondary); line-height: 1.6; margin: 0 0 14px; }
    .bp-cat-header-tags { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
    .bp-cat-header-tag { font-size: 11px; font-weight: 500; color: var(--theme-accent); background: var(--theme-bg); border: 0.5px solid var(--theme-border); border-radius: 20px; padding: 3px 12px; }

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
    .bp-list-body { flex: 1; min-width: 0; }
    .bp-list-name { font-size: 14px; font-weight: 500; color: var(--color-text-primary); }
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
export class CatalogueGridComponent implements OnChanges {
  @Input() entities: CatalogueEntity[] = [];
  @Input() categories: CategoryInfo[] = [];
  @Input() tags: string[] = [];
  @Input() entityType: 'item' | 'supplier' = 'item';
  @Input() entityLabel: string = 'item';
  @Input() sectionTitle: string = 'CATALOGUE';
  @Input() actionLabel: string = 'View';
  @Input() favouriteIds: Set<string> = new Set();
  @Input() showEdit = true;
  @Input() showFavourite = true;
  @Input() showBack = false;
  @Input() backLabel = 'Back to catalogue';
  @Input() totalCount = 0;
  @Input() selectedCategory: CategoryInfo | null = null;
  @Input() childCategories: CategoryInfo[] = [];

  @Output() entitySelected = new EventEmitter<CatalogueEntity>();
  @Output() backClicked = new EventEmitter<void>();
  @Output() favouriteToggled = new EventEmitter<string>();
  @Output() imageEditRequested = new EventEmitter<CatalogueEntity>();
  @Output() actionClicked = new EventEmitter<CatalogueEntity>();
  @Output() parentClicked = new EventEmitter<CatalogueEntity>();
  @Output() categoryChanged = new EventEmitter<string>();
  @Output() tagChanged = new EventEmitter<string>();
  @Output() searchChanged = new EventEmitter<string>();

  selectedEntity: CatalogueEntity | null = null;
  activeCategory = 'all';
  activeChildCategory = 'all';
  activeTag = '';
  searchQuery = '';
  layout: 'list' | 'card' = 'card';
  filteredEntities: CatalogueEntity[] = [];

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['entities']) {
      this.applyFilter();
    }
  }

  getImageUrl(e: CatalogueEntity): string | null {
    return e.image_url || e.cover_image_url || e.external_url || null;
  }

  select(e: CatalogueEntity) {
    this.selectedEntity = e;
    this.entitySelected.emit(e);
    this.cdr.detectChanges();
  }

  setCategory(catId: string) {
    this.activeCategory = catId;
    this.activeChildCategory = 'all';
    this.activeTag = '';
    this.selectedEntity = null;
    this.selectedCategory = catId === 'all' ? null : this.categories.find(c => c.id === catId) || null;
    this.categoryChanged.emit(catId);
    this.applyFilter();
  }

  setChildCategory(childId: string) {
    this.activeChildCategory = childId;
    this.selectedEntity = null;
    this.applyFilter();
  }

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

  private applyFilter() {
    let result = this.entities;
    if (this.activeCategory !== 'all') {
      if (this.activeChildCategory !== 'all') {
        result = result.filter(e => e.category_id === this.activeChildCategory);
      } else if (this.childCategories.length) {
        const childIds = new Set(this.childCategories.map(c => c.id));
        childIds.add(this.activeCategory);
        result = result.filter(e => childIds.has(e.category_id || ''));
      } else {
        result = result.filter(e => e.category_id === this.activeCategory);
      }
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
