import { Component, Input, Output, EventEmitter, ChangeDetectorRef, OnChanges, OnInit, SimpleChanges, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { forkJoin } from 'rxjs';
import {
  LucideAngularModule, Search, Heart, List, Layers,
  ChevronRight, ChevronLeft, MapPin, SquarePen,
  Plus, Eye
} from 'lucide-angular';
import { GbpPipe } from '../../pipes/gbp.pipe';
import { CatalogueEntity, CategoryInfo, ProjectCategory, ProjectContext, ProjectItem } from '../../../models';
import { ConfigStripComponent } from '../config-strip/config-strip.component';
import {
  CategoryContextPanelComponent, CategoryContextMode
} from '../category-context-panel/category-context-panel.component';
import { CodelistService } from '../../../core/services/codelist.service';

export type CircleSize = 'sm' | 'md' | 'lg';
export type DetailSize = 'sm' | 'md' | 'lg';
export type DetailMode = 'inline' | 'drawer';

@Component({
  selector: 'app-catalogue-grid',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    InputTextModule, InputTextareaModule, ButtonModule, CheckboxModule,
    LucideAngularModule, GbpPipe, ConfigStripComponent,
    CategoryContextPanelComponent
  ],
  template: `
    <!-- CONFIG STRIP — toggled from cog in top-nav. Page projects its own
         control widgets via [config-content]. -->
    <app-config-strip>
      <ng-content select="[config-content]"></ng-content>
    </app-config-strip>

    <!-- HERO — page-driven via pageLabel/pageTitle/pageSubtitle inputs.
         Hidden when no title set (preserves orgs/categories/etc). -->
    <div class="bp-page-hero" *ngIf="pageTitle">
      <div class="bp-page-hero-eyebrow" *ngIf="pageLabel">{{ pageLabel }}</div>
      <h1 class="bp-page-hero-title">{{ pageTitle }}</h1>
      <div class="bp-page-hero-sub" *ngIf="pageSubtitle">{{ pageSubtitle }}</div>
    </div>

    <!-- BACK BUTTON -->
    <div class="bp-grid-back-wrap" *ngIf="showBack">
      <button class="bp-grid-back-btn" (click)="onBack()">
        <lucide-icon name="chevron-left" [size]="14"></lucide-icon>
        {{ backLabel }}
      </button>
    </div>

    <!-- BREADCRUMB (when drilled into a category).
         Hidden in project mode — the strip stays on top-level
         categories there (no drill navigation to summarise),
         so the crumb would read as noise. -->
    <div class="bp-breadcrumb" *ngIf="drilledCategory && !projectContext">
      <button class="bp-breadcrumb-link" (click)="drillOut()">All Categories</button>
      <lucide-icon name="chevron-right" [size]="12" class="bp-breadcrumb-sep"></lucide-icon>
      <span class="bp-breadcrumb-current">{{ drilledCategory.name }}</span>
    </div>

    <!-- CATEGORY CIRCLES (single row — level-0 or level-1 depending on drill state) -->
    <div class="bp-cat-circles-wrap" *ngIf="categories.length && showCategoryCircles" [attr.data-circle-size]="circleSize">
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
            <lucide-icon name="layers" [size]="circleIconSize"></lucide-icon>
          </div>
          <span class="bp-cat-circle-label">All</span>
        </button>
        <!-- Category circles. In project (Build) mode, categories not in
             projectContext.projectCategories render greyed; clicking one
             emits categoryScopeChange so the parent scopes it in. -->
        <button *ngFor="let cat of displayedCircles"
          class="bp-cat-circle-btn"
          [class.active]="!drilledCategory ? activeCategory === cat.id : activeChildCategory === cat.id"
          [class.bp-cat-circle-btn--unscoped]="!!projectContext && !isCategoryScoped(cat.id)"
          (click)="onCircleClick(cat)">
          <div class="bp-cat-circle"
            [style.background-image]="cat.cover_image_url ? 'url(' + cat.cover_image_url + ')' : null"
            [style.background-color]="!cat.cover_image_url && !cat.logo_url && cat.icon_name && cat.icon_color ? cat.icon_color : null"
            [class.bp-cat-circle--no-image]="!cat.cover_image_url && !cat.logo_url && !cat.icon_name"
            [class.bp-cat-circle--logo]="!!cat.logo_url && !cat.cover_image_url">
            <img *ngIf="cat.logo_url && !cat.cover_image_url" [src]="cat.logo_url" [alt]="cat.name" class="bp-cat-circle-logo-img"/>
            <lucide-icon *ngIf="!cat.cover_image_url && !cat.logo_url && cat.icon_name" [name]="cat.icon_name" [size]="circleIconSize" class="bp-cat-circle-lucide"></lucide-icon>
            <lucide-icon *ngIf="!cat.cover_image_url && !cat.logo_url && !cat.icon_name && cat.icon" [name]="cat.icon" [size]="circleIconSize" class="bp-cat-circle-icon"></lucide-icon>
            <span *ngIf="!cat.cover_image_url && !cat.logo_url && !cat.icon_name && !cat.icon" class="bp-cat-circle-initials">{{ cat.name.charAt(0) }}</span>
            <button *ngIf="showEdit && !projectContext" class="bp-cat-circle-edit" (click)="onCategoryEdit($event, cat)" title="Edit image">
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
      <!-- Project-mode strip toggle — flips the circle strip between
           in-scope-only (default) and all top-level categories
           (unscoped ones render greyed via .bp-cat-circle-btn--unscoped).
           The sidebar parent-list stays scoped-only regardless. -->
      <button *ngIf="projectContext" class="bp-circles-toggle"
        (click)="toggleShowAllCategories()">
        {{ showAllCategories ? 'Show scoped only' : 'Show all categories' }}
      </button>
    </div>

    <!-- BEFORE-BODY SLOT — pages project content that should sit between
         the hero/circles and the 3-col body (e.g. feedback area circles,
         filter bar, bulk-action bar). -->
    <ng-content select="[catalogue-before-body]"></ng-content>

    <!-- THREE-COLUMN BODY -->
    <div class="bp-cat-body bp-cat-body--detail"
      [attr.data-detail-size]="detailSize"
      [class.bp-cat-body--no-inline-detail]="hideInlineDetail">

      <!-- ── SIDEBAR ── -->
      <div class="bp-cat-sidebar">
        <div class="bp-sidebar-search">
          <lucide-icon name="search" [size]="14" class="bp-sidebar-search-icon"></lucide-icon>
          <input pInputText [(ngModel)]="searchQuery" (ngModelChange)="applySearch()"
            placeholder="Search..." class="bp-sidebar-search-input"/>
        </div>

        <!-- Not drilled in: show category list -->
        <ng-container *ngIf="!drilledCategory">
          <div class="bp-sidebar-sublabel">{{ sidebarCategoryLabel }}</div>
          <button class="bp-sidebar-item" [class.active]="activeCategory === 'all'" (click)="setCategory('all')">
            <span>All</span>
            <span class="bp-sidebar-count" *ngIf="totalCount">{{ totalCount }}</span>
          </button>
          <!-- sidebarParentCategories filters to in-scope only in
               project mode; identical to parentCategories otherwise. -->
          <button *ngFor="let cat of sidebarParentCategories"
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

          <!-- FORMAT section (model=A subcategories). All / None links
               only render when there are children to act on; the empty
               state ("No subcategories") sits in their place so the
               drilled-in sidebar still reads as a coherent unit. -->
          <div class="bp-sidebar-section-header mt-4">
            <span class="bp-sidebar-sublabel">Format</span>
            <div class="bp-sidebar-check-actions" *ngIf="childCategories.length">
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
          <div *ngIf="!childCategories.length" class="bp-sidebar-empty">
            No subcategories
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

        <!-- BREADCRUMB — always visible. Parent segments are clickable
             when drilled and reset to top via onBreadcrumbBack(). -->
        <!-- Main-column breadcrumb — hidden in project mode for the same
             reason as the top one (no drill nav, so the crumb is noise). -->
        <nav class="bp-main-crumbs" *ngIf="resolvedBreadcrumbRoot && !projectContext">
          <ng-container *ngIf="!isCrumbDrilled; else crumbsDrilled">
            <span class="bp-crumb-root">{{ resolvedBreadcrumbRoot }}</span>
            <span class="bp-crumb-sep">›</span>
            <span class="bp-crumb-active">{{ resolvedBreadcrumbAll }}</span>
          </ng-container>
          <ng-template #crumbsDrilled>
            <button class="bp-crumb-link" (click)="onBreadcrumbBack()">{{ resolvedBreadcrumbRoot }}</button>
            <span class="bp-crumb-sep">›</span>
            <button class="bp-crumb-link" (click)="onBreadcrumbBack()">{{ resolvedBreadcrumbAll }}</button>
            <span class="bp-crumb-sep">›</span>
            <span class="bp-crumb-active">{{ resolvedBreadcrumbActive }}</span>
          </ng-template>
        </nav>

        <div class="bp-cat-section-header">
          <span class="bp-cat-section-title">{{ sectionTitle }}</span>
          <span class="bp-cat-section-count">{{ filteredEntities.length }} {{ entityLabel }}{{ filteredEntities.length !== 1 ? 's' : '' }}</span>
          <ng-content select="[catalogue-toggles]"></ng-content>
          <div class="bp-view-toggle" *ngIf="showLayoutToggle">
            <button class="bp-view-btn" [class.active]="layout === 'list'" (click)="layout = 'list'">
              <lucide-icon name="list" [size]="14"></lucide-icon>
            </button>
            <button class="bp-view-btn" [class.active]="layout === 'card'" (click)="layout = 'card'">
              <lucide-icon name="layers" [size]="14"></lucide-icon>
            </button>
            <button class="bp-view-btn" [class.active]="layout === 'table'" (click)="layout = 'table'">
              <lucide-icon name="table" [size]="14"></lucide-icon>
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
              <div class="bp-list-unit" *ngIf="e.unit">{{ unitDisplay(e.unit) }}</div>
            </div>

            <!-- v1.20: in-row + / ♡ project-cart actions. Same gates as
                 the detail-panel cluster (agency + item + projectId).
                 stopPropagation so clicking the icon doesn't also
                 select the row. -->
            <ng-container *ngIf="showCartActions">
              <button type="button"
                      class="bp-cart-btn"
                      [class.bp-cart-btn--selected]="getSelectionType(e.id) === 'selected'"
                      (click)="onCartAddClick($event, e)"
                      [title]="getSelectionType(e.id) === 'selected' ? 'Remove from project' : 'Add to project'">
                <lucide-icon name="plus" [size]="14"></lucide-icon>
              </button>
              <button type="button"
                      class="bp-cart-btn"
                      [class.bp-cart-btn--liked]="getSelectionType(e.id) === 'liked'"
                      (click)="onCartLikeClick($event, e)"
                      [title]="getSelectionType(e.id) === 'liked' ? 'Remove from project' : 'Like for project'">
                <lucide-icon name="heart" [size]="14"></lucide-icon>
              </button>
            </ng-container>

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
                  <!-- v1.20: + / ♡ project-cart on the card image
                       (agency + item + projectId). Active state fills
                       amber for selected, red for liked — same
                       semantics as the Estimate-tab count chips. -->
                  <button *ngIf="showCartActions" type="button"
                          class="bp-grid-action-btn"
                          [class.bp-cart-btn--selected]="getSelectionType(e.id) === 'selected'"
                          (click)="onCartAddClick($event, e)"
                          [title]="getSelectionType(e.id) === 'selected' ? 'Remove from project' : 'Add to project'">
                    <lucide-icon name="plus" [size]="14"></lucide-icon>
                  </button>
                  <button *ngIf="showCartActions" type="button"
                          class="bp-grid-action-btn"
                          [class.bp-cart-btn--liked]="getSelectionType(e.id) === 'liked'"
                          (click)="onCartLikeClick($event, e)"
                          [title]="getSelectionType(e.id) === 'liked' ? 'Remove from project' : 'Like for project'">
                    <lucide-icon name="heart" [size]="14"></lucide-icon>
                  </button>
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
                  <span class="bp-item-card-unit" *ngIf="e.unit">{{ unitDisplay(e.unit) }}</span>
                </div>
                <div class="bp-item-card-supplier" *ngIf="e.subtitle && !e.price">{{ e.subtitle }}</div>
                <div class="bp-item-card-supplier" *ngIf="e.subtitle && e.price">{{ e.subtitle }}</div>
              </div>
            </div>
          </div>
        </ng-container>

        <!-- TABLE VIEW — projected when useCustomMain, otherwise a basic
             auto-table generated from entities[]. -->
        <ng-container *ngIf="layout === 'table'">
          <ng-content *ngIf="useCustomMain" select="[catalogue-main]"></ng-content>
          <div *ngIf="!useCustomMain && filteredEntities.length" class="bp-table-wrap">
            <table class="bp-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th *ngIf="anyEntityHasSubtitle">Subtitle</th>
                  <th *ngIf="anyEntityHasCategoryLabel">Category</th>
                  <th *ngIf="anyEntityHasPrice">Price</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let e of filteredEntities"
                    [class.bp-row-selected]="selectedEntity?.id === e.id"
                    (click)="select(e)">
                  <td class="bp-cell-name">{{ e.name }}</td>
                  <td *ngIf="anyEntityHasSubtitle" class="bp-cell-muted">{{ e.subtitle || '—' }}</td>
                  <td *ngIf="anyEntityHasCategoryLabel" class="bp-cell-muted">{{ e.categoryLabel || '—' }}</td>
                  <td *ngIf="anyEntityHasPrice">
                    <ng-container *ngIf="e.priceRange">
                      {{ e.priceRange.min | gbp }} – {{ e.priceRange.max | gbp }}
                    </ng-container>
                    <ng-container *ngIf="!e.priceRange && e.price">{{ e.price | gbp }}</ng-container>
                    <span *ngIf="!e.priceRange && !e.price" class="bp-cell-muted">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </ng-container>
      </div>

      <!-- ── RIGHT DETAIL PANEL ── -->
      <!-- Parent components (e.g. Feedback) project a custom panel via the
           [catalogue-detail] slot. When useCustomDetail is true we show the
           projected content and skip the built-in entity preview below.
           Hidden entirely in table+drawer mode — the page's own drawer
           handles detail there. -->
      <div *ngIf="!hideInlineDetail" class="bp-cat-detail" [class.bp-cat-detail--wide]="useCustomDetail">
        <ng-container *ngIf="useCustomDetail">
          <ng-content select="[catalogue-detail]"></ng-content>
        </ng-container>
        <ng-container *ngIf="!useCustomDetail && selectedEntity">
          <!-- Hero image -->
          <div class="bp-detail-hero"
            [style.background-image]="getImageUrl(selectedEntity) && selectedEntity.image_display !== 'contain' ? 'url(' + getImageUrl(selectedEntity) + ')' : null"
            [class.bp-detail-hero-default]="!getImageUrl(selectedEntity)"
            [class.bp-detail-hero-logo]="!!getImageUrl(selectedEntity) && selectedEntity.image_display === 'contain'">
            <img *ngIf="getImageUrl(selectedEntity) && selectedEntity.image_display === 'contain'"
                 [src]="getImageUrl(selectedEntity)!" [alt]="selectedEntity.name" class="bp-detail-hero-logo-img"/>
            <span *ngIf="!getImageUrl(selectedEntity)"
                  class="bp-detail-hero-initials">{{ selectedEntity.name.charAt(0) }}</span>

            <!-- ── v1.17 Action cluster ───────────────────────────────
                 Four circular icon buttons in the hero's top-right.
                   + (add to project)   — agency only, toggles selected
                   ♡ (like for project) — agency only, toggles liked
                   ✎ (edit)             — own org items only, opens drawer
                                          in edit mode
                   👁 (view)             — always visible, opens drawer in
                                          view mode
                 Add and like toggle the same project_items row through
                 ProjectItemService.upsert — the cart pattern from v1.13. -->
            <div *ngIf="entityType === 'item'" class="bp-detail-actions">
              <!-- Add to project (agency only). Active state fills the
                   button amber (via .bp-detail-action.active); the icon
                   itself stays the same plus glyph. -->
              <button *ngIf="isAgency"
                      type="button"
                      class="bp-detail-action"
                      [class.active]="getSelectionType(selectedEntity.id) === 'selected'"
                      (click)="onAddToProject(selectedEntity)"
                      [title]="getSelectionType(selectedEntity.id) === 'selected'
                               ? 'Remove from project'
                               : 'Add to project'">
                <lucide-icon name="plus" [size]="14"></lucide-icon>
              </button>
              <!-- Like for project (agency only). Active state fills the
                   button amber — no separate solid variant needed
                   (Lucide doesn't ship one and the button background
                   already reads as "on"). -->
              <button *ngIf="isAgency"
                      type="button"
                      class="bp-detail-action"
                      [class.active]="getSelectionType(selectedEntity.id) === 'liked'"
                      (click)="onLikeForProject(selectedEntity)"
                      [title]="getSelectionType(selectedEntity.id) === 'liked'
                               ? 'Remove from project'
                               : 'Like for project'">
                <lucide-icon name="heart" [size]="14"></lucide-icon>
              </button>
              <!-- Edit — visible for all users until auth + roles ship.
                   Future gate: own-org items OR platform admin role.
                   See canEdit() for the relaxed-now / strict-later logic.
                   Uses the standard square-pen edit glyph per WORKING_STANDARDS. -->
              <button *ngIf="canEdit(selectedEntity)"
                      type="button"
                      class="bp-detail-action"
                      (click)="onEditItem(selectedEntity)"
                      title="Edit item">
                <lucide-icon name="square-pen" [size]="14"></lucide-icon>
              </button>
              <!-- View (always) -->
              <button type="button"
                      class="bp-detail-action"
                      (click)="onViewItem(selectedEntity)"
                      title="View details">
                <lucide-icon name="eye" [size]="14"></lucide-icon>
              </button>
            </div>

            <!-- Legacy item-edit pencil. Kept for parents that still set
                 [showItemEdit] without the new project-context inputs.
                 Suppressed when the new action cluster is in play
                 (entityType==='item') to avoid two pencils. -->
            <button *ngIf="showItemEdit && entityType !== 'item'"
                    class="bp-detail-edit-btn"
                    (click)="onItemEditClick($event)"
                    title="Edit item">
              <lucide-icon name="square-pen" [size]="14"></lucide-icon>
            </button>
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
              <span class="bp-detail-price-unit" *ngIf="selectedEntity.unit">{{ unitDisplay(selectedEntity.unit) }}</span>
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

        <!-- ── PROJECT BRIEF / CATEGORY BRIEF (Build tab) ── -->
        <!-- When projectContext is set and no item is selected, show the
             relevant brief in place of the empty state. -->
        <ng-container *ngIf="!useCustomDetail && !selectedEntity && projectContext">
          <!-- "All" view → project brief card -->
          <div *ngIf="activeCategory === 'all'" class="bp-brief-card">
            <div class="bp-brief-card-h">
              <span class="bp-brief-card-eyebrow">PROJECT BRIEF</span>
              <button *ngIf="!editingProjectBrief" class="bp-icon-btn"
                (click)="startEditProjectBrief()" title="Edit project brief">
                <lucide-icon name="square-pen" [size]="12"></lucide-icon>
              </button>
              <ng-container *ngIf="editingProjectBrief">
                <button class="bp-icon-btn bp-icon-save"
                  (click)="saveProjectBrief()" title="Save">
                  <i class="pi pi-check"></i>
                </button>
                <button class="bp-icon-btn bp-icon-cancel"
                  (click)="cancelEditProjectBrief()" title="Cancel">
                  <i class="pi pi-times"></i>
                </button>
              </ng-container>
            </div>
            <ng-container *ngIf="!editingProjectBrief">
              <p *ngIf="projectContext.projectBrief" class="bp-brief-card-text bp-brief-card-text--project">
                {{ projectContext.projectBrief }}
              </p>
              <p *ngIf="!projectContext.projectBrief" class="bp-brief-card-empty">
                No project brief yet — click the pencil to add one.
              </p>
            </ng-container>
            <textarea *ngIf="editingProjectBrief" pInputTextarea
              class="bp-brief-card-edit"
              [(ngModel)]="projectBriefDraft"
              [rows]="6"
              placeholder="Describe the project at a high level…">
            </textarea>
          </div>

          <!-- v1.19: per-category branch handed off to
               <app-category-context-panel> below so all three contexts
               (project / marketplace / supplier) render through a
               single component. The old inline-pencil brief edit lived
               here in v1.18 — now the brief is edited on Brief and
               Estimate tabs, so the right-panel is a read-only context
               view. -->
        </ng-container>

        <!-- ── v1.19 CATEGORY CONTEXT PANEL ──────────────────────────
             Renders whenever a specific category is active and no item
             is selected — in all three contexts. Replaces both the
             previous per-category brief card (project mode) and the
             marketplace category description card.
             v1.22: passes projectTotal (computed across ALL categories)
             plus the briefUpdated and openEstimate events through. -->
        <ng-container *ngIf="!useCustomDetail && !selectedEntity && currentCategoryInfo as cat">
          <app-category-context-panel
            [category]="cat"
            [briefText]="ctxBriefText"
            [briefDetail]="ctxBriefDetail"
            [budgetPrice]="ctxBudget"
            [selectedItems]="getCategorySelectedItems()"
            [likedItems]="getCategoryLikedItems()"
            [context]="panelContext"
            [categoryTotal]="getCategoryTotal()"
            [projectTotal]="getProjectTotal()"
            (itemClicked)="onContextItemClicked($event)"
            (itemRemoved)="onContextItemRemoved($event)"
            (itemMoved)="onContextItemMoved($event)"
            (browseClicked)="onContextBrowseClicked()"
            (briefUpdated)="onContextBriefUpdated($event)"
            (openEstimate)="onContextOpenEstimate()">
          </app-category-context-panel>
        </ng-container>

        <!-- Empty state — no category active and no projectContext.
             (Project-context "All" view still renders the project
             brief card above.) -->
        <div *ngIf="!useCustomDetail && !selectedEntity && !currentCategoryInfo && !projectContext" class="bp-detail-empty">
          <p>Select {{ entityLabel === 'item' ? 'an' : 'a' }} {{ entityLabel }} to preview</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    /* ── PAGE HERO ── (rendered when pageTitle is set) */
    .bp-page-hero {
      background: var(--theme-bg);
      padding: 36px 40px;
      text-align: center;
      border-bottom: 0.5px solid var(--theme-border);
    }
    .bp-page-hero-eyebrow {
      font-size: 11px; font-weight: 600;
      color: var(--theme-text);
      text-transform: uppercase; letter-spacing: 0.1em;
      margin-bottom: 10px;
      font-family: var(--font-body);
    }
    .bp-page-hero-title {
      font-family: var(--font-display);
      font-size: 36px; font-weight: 400; letter-spacing: -0.02em;
      margin: 0 0 6px; line-height: 1.1;
      color: var(--color-text-primary);
    }
    .bp-page-hero-sub {
      font-size: 13px; color: var(--theme-text);
      font-family: var(--font-body);
    }

    .bp-grid-back-wrap { padding: 12px 28px 0; }
    .bp-grid-back-btn { display: flex; align-items: center; gap: 4px; background: none; border: none; cursor: pointer; font-family: var(--font-body); font-size: 12px; font-weight: 500; color: var(--theme-accent); padding: 4px 0; }
    .bp-grid-back-btn:hover { opacity: 0.75; }

    /* ── BREADCRUMB ── */
    .bp-breadcrumb { display: flex; align-items: center; gap: 6px; padding: 12px 28px 0; font-family: var(--font-body); font-size: 12px; }
    .bp-breadcrumb-link { background: none; border: none; cursor: pointer; font-family: var(--font-body); font-size: 12px; font-weight: 500; color: var(--theme-accent); padding: 0; }
    .bp-breadcrumb-link:hover { opacity: 0.75; }
    .bp-breadcrumb-sep { color: var(--color-text-muted); }
    .bp-breadcrumb-current { font-weight: 500; color: var(--color-text-primary); }

    .bp-cat-circles-wrap {
      padding: 20px 28px 0; border-bottom: 0.5px solid var(--color-border);
      position: relative; display: flex; align-items: flex-start;
      min-width: 0; overflow: clip visible; overflow-x: clip; overflow-y: visible;
      --bp-circle-w: 96px;
    }
    .bp-cat-circles-wrap[data-circle-size="sm"] { --bp-circle-w: 56px; }
    .bp-cat-circles-wrap[data-circle-size="md"] { --bp-circle-w: 72px; }
    .bp-cat-circles-wrap[data-circle-size="lg"] { --bp-circle-w: 96px; }
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
    /* Build mode — scoped/all toggle, sits to the right of the strip. */
    .bp-circles-toggle {
      flex-shrink: 0;
      margin: 32px 0 0 12px;
      background: none; border: none; padding: 4px 0; cursor: pointer;
      font-family: var(--font-body); font-size: 12px; font-weight: 500;
      color: var(--theme-accent); white-space: nowrap;
    }
    .bp-circles-toggle:hover { opacity: 0.75; }
    .bp-cat-circles::-webkit-scrollbar { display: none; }
    .bp-cat-circle-btn { display: flex; flex-direction: column; align-items: center; gap: 8px; background: none; border: none; cursor: pointer; flex-shrink: 0; padding: 0; }
    .bp-cat-circle { width: var(--bp-circle-w, 96px); height: var(--bp-circle-w, 96px); border-radius: 50%; background-size: cover; background-position: center; border: 2.5px solid transparent; transition: border-color 0.15s, width 0.18s, height 0.18s; display: flex; align-items: center; justify-content: center; background-color: var(--color-surface); box-shadow: 0 0 0 0.5px var(--color-border); color: var(--color-text-muted); position: relative; }
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

    /* Build mode — categories not in project_categories render greyed.
       Click still works (parent emits scope-in via categoryScopeChange). */
    .bp-cat-circle-btn--unscoped .bp-cat-circle { filter: grayscale(0.85); opacity: 0.45; }
    .bp-cat-circle-btn--unscoped .bp-cat-circle-label { color: var(--color-text-muted); font-weight: 500; }
    .bp-cat-circle-btn--unscoped:hover .bp-cat-circle { filter: grayscale(0.4); opacity: 0.75; }
    .bp-cat-circle-btn--unscoped:hover .bp-cat-circle-label { color: var(--color-text-secondary); }

    .bp-cat-body { display: grid; grid-template-columns: 260px 1fr; height: calc(100vh - var(--nav-height) - 160px); }
    .bp-cat-body--detail { grid-template-columns: 260px 1fr 260px; }
    /* Detail panel width — driven by [data-detail-size]. sm/md/lg = 260/320/420.
       Default (no attribute) keeps the historical 260px so existing pages are
       unaffected. */
    .bp-cat-body--detail[data-detail-size="sm"] { grid-template-columns: 260px 1fr 260px; }
    .bp-cat-body--detail[data-detail-size="md"] { grid-template-columns: 260px 1fr 320px; }
    .bp-cat-body--detail[data-detail-size="lg"] { grid-template-columns: 260px 1fr 420px; }
    /* Wider detail panel when the parent projects a custom one (e.g. the
       feedback notes preview). Matches the drawer minimum (520px). */
    .bp-cat-body--detail:has(.bp-cat-detail--wide) { grid-template-columns: 240px 1fr 380px; }
    /* Detail-mode = drawer in table view: suppress the third column so
       the main fills the width and the page's own drawer slides in. */
    .bp-cat-body--detail.bp-cat-body--no-inline-detail,
    .bp-cat-body--detail.bp-cat-body--no-inline-detail[data-detail-size="sm"],
    .bp-cat-body--detail.bp-cat-body--no-inline-detail[data-detail-size="md"],
    .bp-cat-body--detail.bp-cat-body--no-inline-detail[data-detail-size="lg"] {
      grid-template-columns: 260px 1fr;
    }
    .bp-cat-sidebar { border-right: 0.5px solid var(--color-border); padding: 20px 16px; overflow-y: auto; }
    .bp-cat-main { padding: 20px 28px; overflow-y: auto; min-width: 0; }
    .bp-cat-detail { border-left: 0.5px solid var(--color-border); overflow-y: auto; }

    .bp-sidebar-search { display: flex; align-items: center; gap: 8px; border: 0.5px solid var(--color-border); border-radius: 8px; padding: 0 10px; height: 34px; margin-bottom: 20px; }
    .bp-sidebar-search-icon { color: var(--color-text-muted); flex-shrink: 0; }
    .bp-sidebar-search-input { flex: 1; border: none !important; background: transparent !important; box-shadow: none !important; padding: 0 !important; font-size: 12px !important; }
    .bp-sidebar-sublabel { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-text-muted); margin-bottom: 8px; }
    .bp-sidebar-item { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 7px 10px; font-size: 13px; font-weight: 500; color: var(--color-text-secondary); background: none; border: none; border-radius: var(--border-radius-md, 6px); cursor: pointer; font-family: var(--font-body); transition: all 0.15s; }
    .bp-sidebar-item:hover { background: var(--color-surface); color: var(--color-text-primary); }
    .bp-sidebar-item.active { background: var(--theme-bg); color: var(--theme-accent); font-weight: 500; }
    .bp-sidebar-count {
      font-size: 11px;
      color: var(--color-text-secondary);
      background: var(--color-background-secondary, var(--color-surface));
      border: 0.5px solid var(--color-border);
      border-radius: 20px;
      padding: 1px 7px;
    }
    .bp-sidebar-back { display: flex; align-items: center; gap: 5px; background: none; border: none; cursor: pointer; font-family: var(--font-body); font-size: 12px; font-weight: 500; color: var(--theme-accent); padding: 4px 0; }
    .bp-sidebar-back:hover { opacity: 0.75; }
    /* Empty-state row inside the sidebar (e.g. drilled into a category
       with no subcategories). Matches the muted, italic copy used
       elsewhere for "nothing here yet" placeholders. */
    .bp-sidebar-empty {
      font-size: 12px;
      color: var(--color-text-muted);
      font-style: italic;
      padding: 4px 0 6px;
    }

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

    /* Breadcrumb at the top of the main column. Always visible; parent
       segments become clickable when drilled. */
    .bp-main-crumbs {
      display: flex; align-items: center; flex-wrap: wrap;
      gap: 6px; margin-bottom: 12px;
      font-family: var(--font-body); font-size: 11px;
    }
    .bp-crumb-root, .bp-crumb-sep, .bp-crumb-link {
      color: var(--color-text-muted);
    }
    .bp-crumb-link {
      background: none; border: none; padding: 0; cursor: pointer;
      font-family: inherit; font-size: inherit;
    }
    .bp-crumb-link:hover { color: var(--theme-accent); }
    .bp-crumb-active { color: var(--color-text-primary); font-weight: 500; }

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

    /* (Auto-fallback table renders via the global .bp-table-wrap /
       .bp-table standard in styles.css — same look as the projected
       <p-table> on feedback.) */

    /* CARD GRID */
    .bp-item-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 16px; }
    .bp-item-card { border-radius: 10px; overflow: hidden; border: 0.5px solid var(--color-border); cursor: pointer; transition: border-color 0.15s; background: var(--color-surface); }
    .bp-item-card:hover { border-color: var(--theme-accent); }
    .bp-item-card-selected { border-color: var(--theme-accent) !important; box-shadow: 0 0 0 1px var(--theme-accent); }
    /* v1.22: defensive overflow:hidden so a logo image with extreme
       aspect (e.g. the DAR Hire wide-script logo) can't escape the
       card's rounded edge. Inner img already has max-width via
       .bp-card-logo-img, but the parent now clips too. */
    .bp-item-card-img { width: 100%; height: 140px; background-size: cover; background-position: center; position: relative; overflow: hidden; }
    .bp-item-card-img img { max-width: 100%; object-fit: contain; }
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

    /* v1.20: in-list project-cart buttons (+ / ♡). Sit between price
       and chevron in the list-row layout. Card-image variant reuses
       .bp-grid-action-btn for sizing; only the active-state modifiers
       below are shared between both views. */
    .bp-cart-btn {
      width: 26px; height: 26px;
      border-radius: 50%;
      border: 0.5px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text-muted);
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      transition: color 0.15s, border-color 0.15s, background 0.15s;
    }
    .bp-cart-btn:hover {
      border-color: var(--theme-accent);
      color: var(--theme-accent);
    }
    /* Active modifiers shared across list-row (.bp-cart-btn) and
       card-image (.bp-grid-action-btn) buttons. Both states read as
       "this item is in the project" — same amber fill on +
       (selected) and ♡ (liked), matching the detail-panel cluster
       so the language is consistent everywhere. */
    .bp-cart-btn--selected,
    .bp-cart-btn--liked,
    .bp-grid-action-btn.bp-cart-btn--selected,
    .bp-grid-action-btn.bp-cart-btn--liked {
      background: var(--theme-accent);
      border-color: var(--theme-accent);
      color: var(--color-surface);
    }
    .bp-cart-btn--selected:hover,
    .bp-cart-btn--liked:hover,
    .bp-grid-action-btn.bp-cart-btn--selected:hover,
    .bp-grid-action-btn.bp-cart-btn--liked:hover {
      background: var(--theme-accent);
      color: var(--color-surface);
    }

    /* DETAIL PANEL */
    .bp-detail-empty { display: flex; align-items: center; justify-content: center; height: 100%; font-size: 13px; color: var(--color-text-muted); padding: 40px 20px; text-align: center; }

    /* Brief / category cards in the detail panel — shown when no item is
       selected. Build mode renders the project / category brief; the
       marketplace renders a category-description card. */
    .bp-brief-card {
      padding: 16px 20px;
      border-bottom: 0.5px solid var(--color-border);
      font-family: var(--font-body);
    }
    .bp-brief-card-h {
      display: flex; align-items: center; gap: 8px;
      margin-bottom: 8px;
    }
    .bp-brief-card-eyebrow {
      flex: 1;
      font-size: 10px; font-weight: 700;
      letter-spacing: 0.08em; text-transform: uppercase;
      color: var(--theme-accent);
    }
    .bp-brief-card-text {
      font-family: var(--font-body);
      font-size: 12px;
      line-height: 1.6;
      color: var(--color-text-primary);
      max-height: 220px;
      overflow-y: auto;
      margin: 0;
    }
    /* Per-spec — requirement_brief renders with an amber left border and
       reads as "your" content within the card stack. */
    .bp-brief-card-text--req {
      padding-left: 10px;
      border-left: 2px solid var(--theme-accent);
    }
    .bp-brief-card-text--project {
      color: var(--color-text-secondary);
    }
    .bp-brief-card-empty {
      font-size: 12px; font-style: italic;
      color: var(--color-text-muted);
      margin: 0;
    }
    .bp-brief-card-edit {
      width: 100%;
      font-size: 12px; line-height: 1.6;
      font-family: var(--font-body);
    }
    .bp-brief-card--cat-desc { background: var(--theme-bg); }
    .bp-brief-card--cat-desc .bp-brief-card-text { color: var(--color-text-primary); }
    .bp-brief-card-counts {
      display: flex; align-items: center; gap: 4px;
      font-size: 11px; color: var(--color-text-muted);
      margin-top: 10px;
    }

    /* Build mode — category header above the requirement_brief.
       Mirrors the strip's circle visual (image / icon / initial) so
       the user has a clear anchor for whose brief they're editing. */
    .bp-brief-cat-header {
      display: flex; flex-direction: column; align-items: center;
      gap: 10px;
      padding: 20px 16px 12px;
    }
    .bp-brief-cat-circle {
      width: 64px; height: 64px; border-radius: 50%;
      background-size: cover; background-position: center;
      background-color: var(--color-surface);
      box-shadow: 0 0 0 0.5px var(--color-border);
      border: 2.5px solid var(--theme-accent);
      display: flex; align-items: center; justify-content: center;
      color: var(--color-text-muted); position: relative;
      flex-shrink: 0;
    }
    .bp-brief-cat-circle--no-image { background-color: var(--theme-bg); }
    .bp-brief-cat-circle--logo { background: var(--theme-bg); }
    .bp-brief-cat-circle-logo-img { width: 60%; height: 60%; object-fit: contain; }
    .bp-brief-cat-circle-icon { color: var(--theme-accent); }
    .bp-brief-cat-circle-lucide { color: var(--color-text-muted); }
    .bp-brief-cat-circle-initials {
      font-size: 22px; font-weight: 600;
      color: var(--theme-accent); font-family: var(--font-display);
    }
    .bp-brief-cat-name {
      font-family: var(--font-display);
      font-size: 16px; font-weight: 400;
      color: var(--color-text-primary);
      text-align: center;
    }
    .bp-detail-hero { width: 100%; height: 160px; background-size: cover; background-position: center; position: relative; }
    .bp-detail-edit-btn {
      position: absolute; top: 10px; right: 10px;
      width: 30px; height: 30px;
      display: flex; align-items: center; justify-content: center;
      background: var(--color-surface); border: 0.5px solid var(--theme-border);
      border-radius: 50%; cursor: pointer; color: var(--theme-accent);
      transition: background 0.15s, color 0.15s, border-color 0.15s;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .bp-detail-edit-btn:hover { background: var(--theme-accent); border-color: var(--theme-accent); color: var(--color-surface); }

    /* ── v1.17 Detail action cluster ────────────────────────────────
       Four circular icon buttons in the hero's top-right (+ / ♡ / ✎ / 👁).
       The hero container is already position:relative so absolute
       positioning anchors correctly. Active state fills amber to signal
       project membership / liked state. Hover lifts to amber accent. */
    .bp-detail-actions {
      display: flex; gap: 6px;
      position: absolute;
      top: 10px; right: 10px;
      z-index: 2;
    }
    .bp-detail-action {
      width: 32px; height: 32px;
      border-radius: 50%;
      border: 0.5px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text-secondary);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      font-size: 13px;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .bp-detail-action:hover {
      border-color: var(--theme-accent);
      color: var(--theme-accent);
    }
    .bp-detail-action.active {
      background: var(--theme-accent);
      border-color: var(--theme-accent);
      color: var(--color-surface);
    }
    .bp-detail-action.active:hover {
      background: var(--theme-accent);
      color: var(--color-surface);
    }
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
export class CatalogueGridComponent implements OnInit, OnChanges, AfterViewInit {
  @Input() entities: CatalogueEntity[] = [];
  @Input() categories: CategoryInfo[] = [];
  /** When false, suppresses the top horizontal category-circle row.
      Sidebar category list is unaffected. Default true (existing usages). */
  @Input() showCategoryCircles: boolean = true;
  /** Header text for the sidebar category section. Default "Category". */
  @Input() sidebarCategoryLabel: string = 'Category';
  /** Hero block — eyebrow, h1 title, subtitle. Hero only renders when
      pageTitle is set; pages that don't want a hero leave it blank. */
  @Input() pageLabel: string = '';
  @Input() pageTitle: string = '';
  @Input() pageSubtitle: string = '';
  /** Circle strip size — sm/md/lg map to 56/72/96px circles. */
  @Input() circleSize: CircleSize = 'lg';
  /** Inline detail panel width — sm/md/lg map to 260/320/420px. */
  @Input() detailSize: DetailSize = 'md';
  /** Detail rendering mode. When 'drawer' AND layout is 'table', the
      inline right column is hidden so the page's own drawer (e.g.
      app-feedback-drawer) is the only detail surface. In 'inline' mode
      or any non-table layout the inline column is always shown. */
  @Input() detailMode: DetailMode = 'inline';
  /** Always-visible breadcrumb row at the top of the main column.
      Default: derives root from sidebarCategoryLabel and "All …" segment
      from a naive plural; the active segment falls back to the internal
      drilledCategory state.
      Pages whose drill state lives outside catalogue-grid (e.g. feedback's
      area circles) override these via inputs and listen to
      (breadcrumbBackClicked) to reset their own state. */
  @Input() breadcrumbRoot: string = '';
  @Input() breadcrumbAll: string = '';
  @Input() breadcrumbActive: string = '';
  @Input() tags: string[] = [];
  @Input() entityType: 'item' | 'supplier' | 'feedback' = 'item';
  @Input() entityLabel: string = 'item';
  @Input() sectionTitle: string = 'CATALOGUE';
  @Input() actionLabel: string = 'View';
  @Input() favouriteIds: Set<string> = new Set();
  @Input() showEdit = true;
  /** Show an "edit item" pencil overlay on the inline detail panel's hero
      image. Opt-in: defaults false so categories / orgs / feedback grids
      don't get a stray pencil. Only renders when entityType === 'item'. */
  @Input() showItemEdit = false;
  @Input() showFavourite = true;
  @Input() showBack = false;
  @Input() backLabel = 'Back to catalogue';
  @Input() totalCount = 0;

  /** Build tab — when set, the inline detail panel shows the project / per-
      category brief in place of the empty state, the circle strip greys
      categories not currently scoped to the project, and clicking a
      greyed circle emits categoryScopeChange so the parent can persist
      it via project-category.service.setScope(). Null = standard
      marketplace behaviour. */
  @Input() projectContext: ProjectContext | null = null;

  /** v1.17 — project-cart context for the inline detail panel's action
      cluster (+ / ♡ / ✎ / 👁). Optional: when not set, only the View
      button renders (no project selection, no ownership-gated edit).
      - projectId       → required to wire +/♡ to ProjectItemService.
      - projectItems    → snapshot of project_items for membership/state.
      - currentOrgId    → drives ownership (isOwner) for the edit pencil.
      - currentOrgType  → 'agency' shows +/♡; 'supplier' hides them. */
  @Input() projectId: string | null = null;
  @Input() projectItems: ProjectItem[] = [];
  @Input() currentOrgId: string | null = null;
  @Input() currentOrgType: string | null = null;

  /** v1.19 — context-panel mode. Drives:
        - Empty-state copy in the context panel
        - Whether the "Browse marketplace" link renders
      In 'project' mode the panel also reads briefText/budget from
      projectContext.projectCategories; in 'marketplace' / 'supplier'
      mode the panel falls back to the category description. */
  @Input() panelContext: CategoryContextMode = 'marketplace';

  @Output() entitySelected = new EventEmitter<CatalogueEntity>();
  @Output() backClicked = new EventEmitter<void>();
  @Output() favouriteToggled = new EventEmitter<string>();
  @Output() imageEditRequested = new EventEmitter<CatalogueEntity>();
  /** Fires when the inline detail panel's edit pencil is clicked. Only
      emits when [showItemEdit]=true; carries the currently selected entity. */
  @Output() itemEditRequested = new EventEmitter<CatalogueEntity>();
  @Output() actionClicked = new EventEmitter<CatalogueEntity>();
  @Output() parentClicked = new EventEmitter<CatalogueEntity>();
  @Output() categoryChanged = new EventEmitter<string>();
  @Output() drillChanged = new EventEmitter<string | null>();
  /** Build tab — fires when the user clicks an unscoped circle (active=true)
      or removes scope via the future ✕ affordance (active=false). The
      parent persists via projectSvc.setCategoryScope(). */
  @Output() categoryScopeChange = new EventEmitter<{ categoryId: string; active: boolean }>();
  /** Build tab — pencil-edit save on the project brief card. */
  @Output() projectBriefChange = new EventEmitter<string>();
  /** Build tab — pencil-edit save on a per-category requirement_brief. */
  @Output() categoryBriefChange = new EventEmitter<{ categoryId: string; brief: string }>();
  /** Fires when the user clicks a parent segment in the main-column
      breadcrumb (root or "All …"). Pages that own drill state externally
      should reset that state in response. */
  @Output() breadcrumbBackClicked = new EventEmitter<void>();
  @Output() tagChanged = new EventEmitter<string>();
  @Output() searchChanged = new EventEmitter<string>();
  @Output() categoryImageEditRequested = new EventEmitter<CategoryInfo>();

  /** v1.17 — project-cart actions on the inline detail panel.
      addToProject       → user clicked + or ♡ on an item not yet in the
                            project. Emits the entity + the selection
                            type the parent should upsert.
      removeFromProject  → user clicked + or ♡ on an item already in the
                            project with the same type (toggle off).
      viewRequested      → user clicked the eye icon — parent should open
                            its item drawer in view mode. */
  @Output() addToProject = new EventEmitter<{ entity: CatalogueEntity; type: 'selected' | 'liked' }>();
  @Output() removeFromProject = new EventEmitter<{ entity: CatalogueEntity }>();
  @Output() viewRequested = new EventEmitter<CatalogueEntity>();

  /** v1.22 — context panel events.
        briefUpdated → parent persists the new requirement_brief via
                       ProjectService.upsertCategory().
        openEstimate → parent navigates to the Build/Estimate tab.
      Both are simple pass-throughs from the category-context-panel. */
  @Output() briefUpdated = new EventEmitter<{ categoryId: string; brief: string }>();
  @Output() openEstimate = new EventEmitter<void>();

  selectedEntity: CatalogueEntity | null = null;
  activeCategory = 'all';
  activeChildCategory: string | null = null;
  activeTag = '';
  searchQuery = '';

  // ── Build tab — inline brief edit state ─────────────────────────────
  // The catalogue-grid owns the editing UX (textarea + tick/cross) and
  // emits the value out on save. Persistence lives in the parent (Build
  // component → project.service).
  editingProjectBrief = false;
  projectBriefDraft = '';
  /** Empty when not editing; otherwise the category_id whose brief is
      currently being edited (only one editor open at a time). */
  editingCategoryBriefId = '';
  categoryBriefDraft = '';
  /** Build tab — when projectContext is set, default to scoped-only
      categories in the strip. Toggle to reveal all platform categories
      so the user can scope new ones in. Marketplace mode ignores this. */
  showAllCategories = false;
  // Default starting layout. Parent components that own a 3-way Grid/List/
  // Table toggle (e.g. Feedback) hide the inner toggle and pass the value
  // through this input. 'table' is feedback-only — when set, the parent
  // projects its own <p-table> via the [catalogue-main] content slot.
  @Input() layout: 'list' | 'card' | 'table' = 'card';
  // When the parent owns the layout toggle externally, hide the inner one.
  @Input() showLayoutToggle = true;
  // When the parent projects a custom right detail panel via the
  // [catalogue-detail] slot, set this so we hide the built-in detail
  // template (otherwise both render and stack).
  @Input() useCustomDetail = false;
  // When the parent projects a custom table via the [catalogue-main]
  // slot (e.g. feedback's <p-table>), set this so the fallback table
  // generated from entities[] is suppressed.
  @Input() useCustomMain = false;
  filteredEntities: CatalogueEntity[] = [];

  // Drill-down state
  drilledCategory: CategoryInfo | null = null;
  checkedChildIds: Set<string> = new Set();
  checkedTags: Set<string> = new Set();

  get parentCategories(): CategoryInfo[] {
    return this.categories.filter(c => !c.parent_id);
  }

  /** Lucide icon size for the circle strip — scales with circleSize input. */
  get circleIconSize(): number {
    if (this.circleSize === 'sm') return 20;
    if (this.circleSize === 'md') return 26;
    return 34;
  }

  /** True when the inline detail panel should be suppressed — only
      happens in table view + drawer mode. The page's own drawer takes
      over from there. */
  get hideInlineDetail(): boolean {
    return this.layout === 'table' && this.detailMode === 'drawer';
  }

  /** Build tab — id set of categories currently scoped to the project. */
  get scopedCategoryIds(): Set<string> {
    if (!this.projectContext) return new Set();
    return new Set(this.projectContext.projectCategories.map(pc => pc.category_id));
  }

  isCategoryScoped(catId: string): boolean {
    return this.scopedCategoryIds.has(catId);
  }

  /** Resolves the active circle id (or active child) to the category
      object so the brief / marketplace card can show its name + description. */
  get currentCategoryInfo(): CategoryInfo | null {
    const id = this.activeChildCategory || (this.activeCategory !== 'all' ? this.activeCategory : '');
    if (!id) return null;
    return this.categories.find(c => c.id === id) || null;
  }

  /** Current per-project requirement brief for the active category, if scoped. */
  getRequirementBrief(catId: string): string {
    if (!this.projectContext) return '';
    const pc = this.projectContext.projectCategories.find(p => p.category_id === catId);
    return pc?.requirement_brief || '';
  }

  isEditingCategoryBrief(catId: string): boolean {
    return this.editingCategoryBriefId === catId;
  }

  /** Marketplace card — count of distinct supplier ids represented in the
      currently filtered items. Zero if entityType is not 'item'. */
  get supplierCount(): number {
    if (this.entityType !== 'item') return 0;
    const ids = new Set<string>();
    for (const e of this.filteredEntities) {
      const sid = e.parentEntity?.id || e._raw?.org_id;
      if (sid) ids.add(sid);
    }
    return ids.size;
  }

  // ── Brief edit handlers ─────────────────────────────────────────────
  startEditProjectBrief() {
    this.projectBriefDraft = this.projectContext?.projectBrief || '';
    this.editingProjectBrief = true;
    this.cdr.detectChanges();
  }
  saveProjectBrief() {
    const value = (this.projectBriefDraft || '').trim();
    this.projectBriefChange.emit(value);
    this.editingProjectBrief = false;
    this.cdr.detectChanges();
  }
  cancelEditProjectBrief() {
    this.editingProjectBrief = false;
    this.projectBriefDraft = '';
    this.cdr.detectChanges();
  }

  startEditCategoryBrief(catId: string) {
    this.categoryBriefDraft = this.getRequirementBrief(catId);
    this.editingCategoryBriefId = catId;
    this.cdr.detectChanges();
  }
  saveCategoryBrief(catId: string) {
    const brief = (this.categoryBriefDraft || '').trim();
    this.categoryBriefChange.emit({ categoryId: catId, brief });
    this.editingCategoryBriefId = '';
    this.cdr.detectChanges();
  }
  cancelEditCategoryBrief() {
    this.editingCategoryBriefId = '';
    this.categoryBriefDraft = '';
    this.cdr.detectChanges();
  }

  toggleShowAllCategories() {
    this.showAllCategories = !this.showAllCategories;
    // If we just hid the unscoped cats and the active one became
    // invisible, bounce back to "All" so the strip + preview stay
    // coherent.
    if (this.projectContext && !this.showAllCategories) {
      if (this.activeCategory !== 'all' && !this.scopedCategoryIds.has(this.activeCategory)) {
        this.drillOut();
      }
    }
    setTimeout(() => this.checkScrollArrows(), 0);
    this.cdr.detectChanges();
  }

  /** Column visibility hints for the fallback auto-table. */
  get anyEntityHasSubtitle(): boolean { return this.filteredEntities.some(e => !!e.subtitle); }
  get anyEntityHasCategoryLabel(): boolean { return this.filteredEntities.some(e => !!e.categoryLabel); }
  get anyEntityHasPrice(): boolean { return this.filteredEntities.some(e => !!e.price || !!e.priceRange); }

  /** Resolved root segment for the main-column breadcrumb (uppercase). */
  get resolvedBreadcrumbRoot(): string {
    return (this.breadcrumbRoot || this.sidebarCategoryLabel || '').toUpperCase();
  }

  /** Resolved "All …" segment. Naive plural if not overridden. */
  get resolvedBreadcrumbAll(): string {
    if (this.breadcrumbAll) return this.breadcrumbAll;
    const root = this.breadcrumbRoot || this.sidebarCategoryLabel || '';
    if (!root) return '';
    // y → ies after a consonant (Category → Categories), else +s.
    const plural = /[^aeiou]y$/i.test(root) ? root.slice(0, -1) + 'ies' : root + 's';
    return 'All ' + plural;
  }

  /** Resolved active segment — explicit override wins, otherwise the
      internal drilled category (or its child) name. */
  get resolvedBreadcrumbActive(): string {
    if (this.breadcrumbActive) return this.breadcrumbActive;
    if (this.activeChildCategory) {
      const child = this.categories.find(c => c.id === this.activeChildCategory);
      if (child) return child.name;
    }
    return this.drilledCategory?.name || '';
  }

  /** Whether the breadcrumb has a third (drilled) segment to render. */
  get isCrumbDrilled(): boolean {
    return !!this.resolvedBreadcrumbActive;
  }

  /** Click handler for the parent breadcrumb segments. Resets the
      internal drill state if catalogue-grid owns it, then emits so
      external owners can reset their own state. */
  onBreadcrumbBack() {
    if (!this.breadcrumbActive && this.drilledCategory) {
      this.drillOut();
    }
    this.breadcrumbBackClicked.emit();
  }

  get childCategories(): CategoryInfo[] {
    if (!this.drilledCategory) return [];
    // Only show model='A' children as FORMAT subcategories — the only model
    // items are actually assigned to today. B/C/D children are legacy POC rows.
    return this.categories.filter(c =>
      c.parent_id === this.drilledCategory!.id && (c.model || 'A') === 'A'
    );
  }

  /** Top-level categories whose tree contains at least one
      project_categories row (handles sub-cat scoping by walking up to
      the parent). Used by both the circle strip and the sidebar
      parent-list in project mode. */
  private inScopeParentCategories(): CategoryInfo[] {
    if (!this.projectContext) return this.parentCategories;
    const topInScope = new Set<string>();
    for (const pc of this.projectContext.projectCategories) {
      const topId = this.topLevelId(pc.category_id);
      if (topId) topInScope.add(topId);
    }
    return this.parentCategories.filter(c => topInScope.has(c.id));
  }

  get displayedCircles(): CategoryInfo[] {
    // Project mode:
    //   - default       → top-level in-scope only (never sub-cats; those
    //                      live in the sidebar FORMAT section).
    //   - showAllCategories=true → every top-level category, with
    //                      unscoped ones greyed via the existing
    //                      .bp-cat-circle-btn--unscoped class. Clicking
    //                      a greyed circle still scopes it in via the
    //                      onCircleClick handler.
    if (this.projectContext) {
      return this.showAllCategories
        ? this.parentCategories
        : this.inScopeParentCategories();
    }

    // Marketplace / supplier default — drill behaviour unchanged.
    return this.drilledCategory ? this.childCategories : this.parentCategories;
  }

  /** Categories shown in the sidebar's parent-list (visible when not
      drilled). In project mode the list is always in-scope only,
      regardless of the circle-strip toggle — the sidebar's job is to
      summarise what's actually part of the project, never to surface
      the full catalogue. */
  get sidebarParentCategories(): CategoryInfo[] {
    if (!this.projectContext) return this.parentCategories;
    return this.inScopeParentCategories();
  }

  /** Walk up the parent chain to find a category's top-level ancestor.
      Returns the id, or null if the category isn't in our category list
      at all. Guarded against accidental cycles. */
  private topLevelId(catId: string | null | undefined): string | null {
    if (!catId) return null;
    let current = this.categories.find(c => c.id === catId);
    let guard = 6;
    while (current && current.parent_id && guard-- > 0) {
      current = this.categories.find(c => c.id === current!.parent_id);
    }
    return current?.id || null;
  }

  @ViewChild('circlesRow') circlesRowRef!: ElementRef<HTMLDivElement>;
  canScrollLeft = false;
  canScrollRight = false;

  constructor(
    private cdr: ChangeDetectorRef,
    private codelistSvc: CodelistService
  ) {}

  ngOnInit() {
    forkJoin({
      units: this.codelistSvc.getByName('item_unit'),
      timeUnits: this.codelistSvc.getByName('item_time_unit')
    }).subscribe(() => this.cdr.detectChanges());
  }

  unitDisplay(code?: string | null): string {
    return code ? this.codelistSvc.getDisplay(code) : '';
  }

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
    // Build tab — clicking a greyed (unscoped) circle scopes it in.
    // Parent persists; we still set it active so the brief card renders.
    if (this.projectContext && !this.isCategoryScoped(cat.id)) {
      this.categoryScopeChange.emit({ categoryId: cat.id, active: true });
    }

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

    // v1.21b: every non-'all' selection drills in. Previously a
    // category without children fell through a separate "simple
    // filter" branch that didn't reset prior drill state — so
    // switching from a cat-with-subcats to a cat-without left the
    // sidebar's FORMAT checkboxes stale. drillIn() resets cleanly.
    // The FORMAT section's empty state renders "No subcategories"
    // when childCategories is empty.
    const cat = this.categories.find(c => c.id === catId);
    if (cat) this.drillIn(cat);
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

  /** Inline-detail item edit pencil click. Stops propagation so the hero
      click handler (if any) doesn't fire, then emits the entity for the
      parent's drawer to open. */
  onItemEditClick(event: MouseEvent) {
    event.stopPropagation();
    if (this.selectedEntity) this.itemEditRequested.emit(this.selectedEntity);
  }

  // ── v1.17 detail-panel action cluster ────────────────────────────────

  /** Agencies see add/like (+/♡); suppliers don't (they own the items). */
  get isAgency(): boolean {
    return this.currentOrgType === 'agency';
  }

  /** True when the current org owns this item — the eventual gate for
      the edit pencil (alongside platform-admin role). */
  isOwner(entity: CatalogueEntity): boolean {
    if (!this.currentOrgId) return false;
    const orgId = (entity as any).org_id || entity._raw?.org_id;
    return !!orgId && orgId === this.currentOrgId;
  }

  /** Permission gate for the edit pencil. Future shape:
        isOwner(entity) || isPlatformAdmin
      Today (pre-auth) we return true for every user so editing is
      unblocked during development. Swap to the strict expression once
      Google SSO + role middleware ship (v2.0). */
  canEdit(_entity: CatalogueEntity): boolean {
    // TODO(v2.0 auth): return this.isOwner(_entity) || this.isPlatformAdmin;
    return true;
  }

  /** Selection state for an item in the current project, or null. Drives
      the active state on the + / ♡ buttons. */
  getSelectionType(itemId: string): 'selected' | 'liked' | null {
    const pi = this.projectItems.find(p => p.item_id === itemId);
    return pi ? pi.selection_type : null;
  }

  // ── v1.19 category-context panel data ────────────────────────────────

  /** Project_category row for the currently active category, if any.
      The context panel reads brief / detail / budget off this. */
  private get currentProjectCategory(): ProjectCategory | null {
    if (!this.projectContext || !this.currentCategoryInfo) return null;
    return this.projectContext.projectCategories
      .find(c => c.category_id === this.currentCategoryInfo!.id) || null;
  }

  /** Brief text for the active category (project mode only). Falls
      back to null so the panel renders the platform category
      description in non-project modes. */
  get ctxBriefText(): string | null {
    if (this.panelContext !== 'project') return null;
    return this.currentProjectCategory?.requirement_brief?.trim() || null;
  }

  get ctxBriefDetail(): string | null {
    if (this.panelContext !== 'project') return null;
    return this.currentProjectCategory?.requirement_detail?.trim() || null;
  }

  get ctxBudget(): number | null {
    if (this.panelContext !== 'project') return null;
    const v = this.currentProjectCategory?.ballpark_budget;
    return v != null ? Number(v) : null;
  }

  /** Items in this category that the project has selected. Matches by
      item_category_id directly, or by walking up the parent chain so
      sub-category items show under the parent's panel too. Liked /
      selected share the same matcher and only differ in selection_type. */
  getCategorySelectedItems(): ProjectItem[] {
    const id = this.currentCategoryInfo?.id;
    if (!id) return [];
    return this.projectItems.filter(pi =>
      pi.selection_type === 'selected' && this.itemMatchesCategory(pi, id)
    );
  }

  getCategoryLikedItems(): ProjectItem[] {
    const id = this.currentCategoryInfo?.id;
    if (!id) return [];
    return this.projectItems.filter(pi =>
      pi.selection_type === 'liked' && this.itemMatchesCategory(pi, id)
    );
  }

  getCategoryTotal(): number {
    return this.getCategorySelectedItems()
      .reduce((s, pi) => s + (Number(pi.base_price) || 0), 0);
  }

  /** v1.22: sum of selected items' base_price across ALL categories
      in the project. Different from getCategoryTotal() which scopes
      to the current category. The redesigned panel shows this in the
      pinned footer ("Project total £X"). */
  getProjectTotal(): number {
    return this.projectItems
      .filter(pi => pi.selection_type === 'selected')
      .reduce((s, pi) => s + (Number(pi.base_price) || 0), 0);
  }

  private itemMatchesCategory(pi: ProjectItem, catId: string): boolean {
    if (pi.item_category_id === catId) return true;
    // Walk up the parent chain — items in subcategories of `catId`
    // should also appear under the parent's context panel.
    let current = this.categories.find(c => c.id === pi.item_category_id);
    let guard = 6;
    while (current && current.parent_id && guard-- > 0) {
      if (current.parent_id === catId) return true;
      current = this.categories.find(c => c.id === current!.parent_id);
    }
    return false;
  }

  // ── v1.19 context panel event handlers ───────────────────────────────

  /** A user clicked a project_item row in the context panel — resolve
      it back to the matching CatalogueEntity (so the existing
      selectedEntity flow takes over) and switch the right panel to
      item detail. */
  onContextItemClicked(item: any) {
    const id = item?.item_id || item?.id;
    if (!id) return;
    const match = this.entities.find(e => e.id === id);
    if (match) this.select(match);
  }

  /** × on a context-panel row. Reuses the existing removeFromProject
      emitter so parents don't need new wiring. */
  onContextItemRemoved(item: any) {
    const id = item?.item_id || item?.id;
    if (!id) return;
    const match = this.entities.find(e => e.id === id);
    if (match) this.removeFromProject.emit({ entity: match });
  }

  /** Move-up / move-to-liked. Reuses the addToProject emitter — its
      upsert semantics (unique index on project_id + item_id) mean
      flipping types mutates the existing row rather than creating
      duplicates. */
  onContextItemMoved(event: { item: any; toType: 'selected' | 'liked' }) {
    const id = event.item?.item_id || event.item?.id;
    if (!id) return;
    const match = this.entities.find(e => e.id === id);
    if (match) this.addToProject.emit({ entity: match, type: event.toType });
  }

  /** "Browse marketplace" link → clear the active category so the user
      sees the full catalogue again. Self-contained; no parent wiring
      needed. */
  onContextBrowseClicked() {
    this.drillOut();
  }

  /** v1.22 — inline brief edit on the context panel. The parent
      (marketplace.component.ts) persists via upsertCategory(); we
      include the active category_id in the emitted payload so the
      parent doesn't need to track it separately. */
  onContextBriefUpdated(brief: string) {
    const catId = this.currentCategoryInfo?.id;
    if (!catId) return;
    this.briefUpdated.emit({ categoryId: catId, brief });
  }

  /** v1.22 — "Open estimate →" link click. Bubble to the parent which
      handles routing (the Build/Estimate tab path can vary per page). */
  onContextOpenEstimate() {
    this.openEstimate.emit();
  }

  /** v1.20: convenience getter — show the in-grid + / ♡ project-cart
      buttons when (a) we're rendering items, (b) the current org is an
      agency (suppliers don't add to projects), and (c) a projectId is
      bound. Same gating as the detail-panel cluster but expressed once
      here so both the list rows and card images can reuse it. */
  get showCartActions(): boolean {
    return this.entityType === 'item'
      && this.isAgency
      && !!this.projectId;
  }

  /** + click on a list row or card — stop the row/card click from
      firing (which would select the entity) and delegate to the
      existing toggle. */
  onCartAddClick(event: MouseEvent, entity: CatalogueEntity) {
    event.stopPropagation();
    this.onAddToProject(entity);
  }

  onCartLikeClick(event: MouseEvent, entity: CatalogueEntity) {
    event.stopPropagation();
    this.onLikeForProject(entity);
  }

  /** + button — adds the item to the project as 'selected', or removes
      it if it's already there with the same type. Parent persists. */
  onAddToProject(entity: CatalogueEntity) {
    const current = this.getSelectionType(entity.id);
    if (current === 'selected') {
      this.removeFromProject.emit({ entity });
    } else {
      this.addToProject.emit({ entity, type: 'selected' });
    }
  }

  /** ♡ button — toggles the 'liked' selection. Same upsert path: clicking
      ♡ on a 'selected' item flips it to 'liked' (one row per item via
      the unique index on project_items). */
  onLikeForProject(entity: CatalogueEntity) {
    const current = this.getSelectionType(entity.id);
    if (current === 'liked') {
      this.removeFromProject.emit({ entity });
    } else {
      this.addToProject.emit({ entity, type: 'liked' });
    }
  }

  /** 👁 button — open the item drawer in view (read-only) mode. */
  onViewItem(entity: CatalogueEntity) {
    this.viewRequested.emit(entity);
  }

  /** ✎ button — open the item drawer in edit mode. Re-uses the existing
      itemEditRequested emitter so parents that already listen for the
      pencil don't need to wire a second handler. */
  onEditItem(entity: CatalogueEntity) {
    this.itemEditRequested.emit(entity);
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
