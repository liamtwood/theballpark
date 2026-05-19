import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { SidebarModule } from 'primeng/sidebar';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LucideAngularModule, MapPin, ChevronRight, Heart, SquarePen, Globe, Phone, Mail } from 'lucide-angular';
import { SupplierService } from '../../core/services/supplier.service';
import { ProjectService } from '../../core/services/project.service';
import { ProjectItemService } from '../../core/services/project-item.service';
import { FavouriteService } from '../../core/services/favourite.service';
import { OrgService } from '../../core/services/org.service';
import { CategoryService } from '../../core/services/category.service';
import { ConfigService } from '../../core/services/config.service';
import { ShellContextService } from '../../core/services/shell-context.service';
import { Category, ProjectItem } from '../../models';
import { GbpPipe } from '../../shared/pipes/gbp.pipe';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { ImageUploadPanelComponent } from '../../shared/components/image-upload-panel/image-upload-panel.component';
import { CatalogueGridComponent } from '../../shared/components/catalogue-grid/catalogue-grid.component';
import { ItemDrawerComponent, ItemDrawerMode } from '../../shared/components/item-drawer/item-drawer.component';
import { SupplierDrawerComponent } from '../../shared/components/supplier-drawer/supplier-drawer.component';
import { Project, CatalogueEntity, CategoryInfo, Item, Org } from '../../models';

@Component({
  selector: 'app-supplier-detail',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    ButtonModule, DropdownModule, InputTextareaModule, SidebarModule, ToastModule,
    LucideAngularModule,
    GbpPipe, LoadingSpinnerComponent, ImageUploadPanelComponent, CatalogueGridComponent,
    ItemDrawerComponent, SupplierDrawerComponent
  ],
  providers: [MessageService],
  template: `
    <div class="bp-page">
    <app-loading *ngIf="loading"></app-loading>
    <ng-container *ngIf="!loading && supplier">

      <!-- ═══ HOME / STORE TAB BAR ═══════════════════════════════════
           Reuses the global .bp-hero-tabs / .bp-hero-tab styles from
           styles.css (the same look the project detail tabs use).
           Tabs are page-local state, not routed. -->
      <div class="bp-hero-tabs bp-supplier-tabs">
        <button class="bp-hero-tab"
                [class.active]="activeTab === 'home'"
                (click)="activeTab = 'home'">Home</button>
        <button class="bp-hero-tab"
                [class.active]="activeTab === 'store'"
                (click)="activeTab = 'store'">Store</button>
      </div>

      <!-- ═══ HOME TAB ════════════════════════════════════════════════
           Layout (top → bottom):
             1. Cover banner (full-width, rounded bottom) + edit pencil
             2. Identity row — small initial-circle avatar + name + location
             3. Centered company logo (logo_url) — if set
             4. Description
             5. Subcategory cards grouped by parent category header
             6. Contact 2×2 icon grid + VAT footer
           TODO: gate the edit pencil on ownership once auth lands. -->
      <ng-container *ngIf="activeTab === 'home'">

        <div class="bp-supplier-home">

          <!-- Cover banner — lives in the same 720px column as the rest of
               the Home content. background-size: contain so the image is
               never zoomed/cropped (any aspect-ratio gap shows the theme
               background). -->
          <div class="bp-supplier-cover"
               [style.background-image]="supplier.cover_image_url ? 'url(' + supplier.cover_image_url + ')' : null"
               [class.bp-supplier-cover--empty]="!supplier.cover_image_url">
            <button class="bp-supplier-cover-edit"
                    (click)="openSupplierEditDrawer()"
                    title="Edit supplier details">
              <lucide-icon name="square-pen" [size]="14"></lucide-icon>
            </button>
          </div>

          <!-- Identity row — small initial avatar + name + location.
               Sits in the same centred column as the description below. -->
          <div class="bp-supplier-identity">
            <div class="bp-supplier-avatar">
              <span class="bp-supplier-avatar-initial">{{ supplier.name.charAt(0) }}</span>
            </div>
            <div class="bp-supplier-identity-body">
              <div class="bp-supplier-name">{{ supplier.name }}</div>
              <div class="bp-supplier-location" *ngIf="supplierTagline()">
                {{ supplierTagline() }}
              </div>
            </div>
          </div>

          <!-- Centred company logo — uses logo_url, displayed prominently
               above the description. Hidden when no logo_url is set. -->
          <div class="bp-supplier-logo-block" *ngIf="supplier.logo_url">
            <img [src]="supplier.logo_url"
                 [alt]="supplier.name + ' logo'"
                 class="bp-supplier-logo-img"/>
          </div>

          <!-- Description -->
          <p class="bp-supplier-desc" *ngIf="supplier.description">{{ supplier.description }}</p>
          <p class="bp-supplier-desc bp-supplier-desc--muted" *ngIf="!supplier.description">
            No description yet.
          </p>

          <!-- Subcategory card sections — one section per parent category
               the supplier has items under. Each section: parent name
               header + card grid of subcategories in use. -->
          <div class="bp-home-cats" *ngIf="homeCategoryGroups.length">
            <div class="bp-home-cat-group" *ngFor="let group of homeCategoryGroups">
              <div class="bp-home-cat-header">{{ group.parentName | uppercase }}</div>
              <div class="bp-home-cat-grid">
                <button type="button" class="bp-home-cat-card"
                        *ngFor="let sub of group.subcategories">
                  <div class="bp-home-cat-card-img"
                       [style.background-image]="sub.cover_image_url ? 'url(' + sub.cover_image_url + ')' : null"
                       [class.bp-home-cat-card-img--fallback]="!sub.cover_image_url">
                    <span *ngIf="!sub.cover_image_url" class="bp-home-cat-card-initial">
                      {{ sub.name.charAt(0) }}
                    </span>
                  </div>
                  <div class="bp-home-cat-card-body">
                    <div class="bp-home-cat-card-name">{{ sub.name }}</div>
                    <div class="bp-home-cat-card-count">
                      {{ sub.count }} {{ sub.count === 1 ? 'item' : 'items' }}
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <!-- Contact info heading — matches the parent-category header
               style used by the sub-catalogue sections above. -->
          <div class="bp-home-cat-header" *ngIf="hasAnyContact()">CONTACT INFO</div>

          <!-- Contact 2×2 icon grid -->
          <div class="bp-supplier-contact-grid" *ngIf="hasAnyContact()">
            <div class="bp-contact-tile" *ngIf="supplier.address || supplier.city || supplier.country">
              <div class="bp-contact-tile-icon">
                <lucide-icon name="map-pin" [size]="16"></lucide-icon>
              </div>
              <div class="bp-contact-tile-body">
                <div class="bp-contact-tile-label">Address</div>
                <div class="bp-contact-tile-value">
                  <span *ngIf="supplier.address">{{ supplier.address }}</span>
                  <span *ngIf="supplier.address && (supplier.city || supplier.country)"><br/></span>
                  <span *ngIf="supplier.city">{{ supplier.city }}</span><span *ngIf="supplier.city && supplier.country">, </span><span *ngIf="supplier.country">{{ supplier.country }}</span>
                </div>
              </div>
            </div>

            <a class="bp-contact-tile bp-contact-tile--link"
               *ngIf="supplier.phone"
               [href]="'tel:' + supplier.phone">
              <div class="bp-contact-tile-icon">
                <lucide-icon name="phone" [size]="16"></lucide-icon>
              </div>
              <div class="bp-contact-tile-body">
                <div class="bp-contact-tile-label">Phone</div>
                <div class="bp-contact-tile-value">{{ supplier.phone }}</div>
              </div>
            </a>

            <a class="bp-contact-tile bp-contact-tile--link"
               *ngIf="supplier.email"
               [href]="'mailto:' + supplier.email">
              <div class="bp-contact-tile-icon">
                <lucide-icon name="mail" [size]="16"></lucide-icon>
              </div>
              <div class="bp-contact-tile-body">
                <div class="bp-contact-tile-label">Email</div>
                <div class="bp-contact-tile-value">{{ supplier.email }}</div>
              </div>
            </a>

            <a class="bp-contact-tile bp-contact-tile--link"
               *ngIf="supplier.website"
               [href]="supplier.website" target="_blank" rel="noopener">
              <div class="bp-contact-tile-icon">
                <lucide-icon name="globe" [size]="16"></lucide-icon>
              </div>
              <div class="bp-contact-tile-body">
                <div class="bp-contact-tile-label">Website</div>
                <div class="bp-contact-tile-value">{{ supplier.website }}</div>
              </div>
            </a>
          </div>

          <div class="bp-supplier-vat"
               *ngIf="supplier.vat_registered || supplier.vat_number">
            VAT
            <ng-container *ngIf="supplier.vat_registered">
              Registered<span *ngIf="supplier.vat_number"> · {{ supplier.vat_number }}</span>
            </ng-container>
            <ng-container *ngIf="!supplier.vat_registered">Not registered</ng-container>
          </div>
        </div>

        <!-- Supplier edit drawer — mounted at page level (TODO: gate on
             ownership). Visible on Home tab where the pencil lives. -->
        <app-supplier-drawer
          [(visible)]="showSupplierDrawer"
          [supplier]="supplier"
          (saved)="onSupplierSaved($event)"
          (cancelled)="showSupplierDrawer = false">
        </app-supplier-drawer>
      </ng-container>

      <!-- ═══ STORE TAB ═══════════════════════════════════════════════
           The original catalogue-grid browse — circle strip, sidebar,
           item grid, inline detail panel. Add item + Upload buttons
           project through the [catalogue-toggles] slot. -->
      <ng-container *ngIf="activeTab === 'store'">
        <app-catalogue-grid
          [entities]="itemEntities"
          [categories]="displayStoreCategories"
          entityType="item"
          entityLabel="item"
          [actionLabel]="'View →'"
          [favouriteIds]="itemFavIds"
          [showEdit]="true"
          [showItemEdit]="false"
          [showFavourite]="false"
          [showBack]="false"
          [totalCount]="itemEntities.length"
          sectionTitle="CATALOGUE"
          [projectId]="selectedProjectId || null"
          [projectItems]="projectItems"
          [currentOrgId]="currentOrgId"
          [currentOrgType]="currentOrgType"
          panelContext="supplier"
          (entitySelected)="onEntitySelected($event)"
          (favouriteToggled)="onFavToggled($event)"
          (imageEditRequested)="onImageEdit($event)"
          (itemEditRequested)="onItemEditRequested($event)"
          (viewRequested)="onViewItem($event)"
          (addToProject)="onAddToProject($event)"
          (removeFromProject)="onRemoveFromProject($event)"
          (actionClicked)="onAction($event)">
          <div catalogue-toggles class="bp-cat-actions">
            <!-- Mirror the project Build tab's scoped/all toggle so suppliers
                 can opt to see categories they don't have items in (e.g. if
                 they're about to add into a new one via + Add item). -->
            <button type="button" class="bp-store-scope-toggle"
                    (click)="toggleShowAllStoreCategories()">
              {{ showAllStoreCategories ? 'Show scoped only' : 'Show all categories' }}
            </button>
            <p-button label="+ Add item"
              styleClass="p-button-outlined bp-section-add-btn"
              (onClick)="openAddItemDrawer()">
            </p-button>
            <p-button label="Upload" icon="pi pi-upload"
              styleClass="p-button-outlined bp-section-add-btn"
              (onClick)="fileInput.click()">
            </p-button>
            <input #fileInput type="file"
                   accept=".xls,.xlsx,.csv"
                   (change)="onCatalogueUploadSelected($event)"
                   style="display:none"/>
          </div>
        </app-catalogue-grid>

        <app-item-drawer
          [(visible)]="showItemDrawer"
          [mode]="drawerMode"
          [item]="drawerItem"
          [prefill]="addPrefill"
          (saved)="onItemSaved($event)"
          (cancelled)="onItemDrawerCancelled()">
        </app-item-drawer>

        <app-image-upload-panel
          *ngIf="uploadEntityId"
          [entityId]="uploadEntityId"
          type="item"
          [existingCoverUrl]="uploadCoverUrl"
          [existingImageDisplay]="uploadImageDisplay"
          (imagesUpdated)="onItemImageUpdated($event)"
          (closed)="uploadEntityId = ''">
        </app-image-upload-panel>
      </ng-container>

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
            No active projects. <a routerLink="/dashboard" style="color:var(--theme-accent);">Create one first →</a>
          </p>
        </div>
        <div class="mb-4">
          <label class="bp-field-label">Your requirements</label>
          <textarea pInputTextarea [(ngModel)]="quoteBrief" class="w-full bp-input-edit" [rows]="4"
            [placeholder]="selectedItem ? 'Tell ' + supplier?.name + ' what you need for ' + selectedItem.name + '...' : 'Describe what you need...'">
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
    .bp-review-ball-card { display: flex; align-items: center; justify-content: space-between; background: var(--theme-bg); border: 0.5px solid var(--theme-border); border-radius: 10px; padding: 12px 14px; margin-top: 8px; }
    .bp-review-ball-label { font-size: 13px; font-weight: 600; color: var(--theme-accent); margin-bottom: 2px; }
    .bp-review-ball-after { font-size: 11px; color: var(--color-text-muted); }
    .bp-review-ball-num { font-size: 22px; font-weight: 700; color: var(--color-text-primary); }
    :host ::ng-deep .bp-drawer-bottom { border-radius: 16px 16px 0 0; }

    /* Action group projected into catalogue-grid's [catalogue-toggles]
       slot. Sits inline in the section header, between the entity count
       and the list/card/table view-toggle. */
    .bp-cat-actions { display: flex; gap: 8px; align-items: center; }
    :host ::ng-deep .bp-section-add-btn .p-button {
      height: 30px; padding: 0 12px;
      font-size: 12px; font-weight: 500;
      font-family: var(--font-body);
    }
    /* Scoped/all categories toggle — matches the catalogue-grid's own
       .bp-circles-toggle look (text link, accent colour). */
    .bp-store-scope-toggle {
      background: none; border: none; padding: 4px 8px; cursor: pointer;
      font-family: var(--font-body); font-size: 12px; font-weight: 500;
      color: var(--theme-accent); white-space: nowrap;
    }
    .bp-store-scope-toggle:hover { opacity: 0.75; }

    /* ── Home/Store tab bar ───────────────────────────────────────────
       Reuses .bp-hero-tabs / .bp-hero-tab from styles.css. We just
       center the bar within the page and put a little vertical padding
       so the tabs sit naturally below the shell hero. */
    .bp-supplier-tabs {
      justify-content: center;
      padding: 0 28px;
    }

    /* ── HOME TAB ───────────────────────────────────────────────────── */

    /* Cover banner sits inside the 720px content column. background-size
       is contain so the image displays at its natural aspect ratio. No
       container fill — any letterboxing shows through to the page. Edit
       pencil overlays the top-right corner. */
    .bp-supplier-cover {
      position: relative;
      width: 100%;
      height: 200px;
      border-radius: 12px;
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
      margin-bottom: 20px;
    }
    .bp-supplier-cover--empty {
      background: linear-gradient(160deg, var(--theme-bg), var(--theme-border));
    }
    .bp-supplier-cover-edit {
      position: absolute; top: 14px; right: 14px;
      width: 34px; height: 34px;
      display: flex; align-items: center; justify-content: center;
      background: var(--color-surface);
      border: 0.5px solid var(--theme-border);
      border-radius: 50%;
      cursor: pointer;
      color: var(--theme-accent);
      transition: background 0.15s, color 0.15s, border-color 0.15s;
      box-shadow: 0 2px 6px rgba(0,0,0,0.12);
      z-index: 2;
    }
    .bp-supplier-cover-edit:hover {
      background: var(--theme-accent);
      border-color: var(--theme-accent);
      color: var(--color-surface);
    }

    .bp-supplier-home {
      max-width: 720px;
      margin: 0 auto;
      padding: 28px;
    }

    /* Identity row: small avatar circle + name + location.
       Sits at the top of the description column. */
    .bp-supplier-identity {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
    }
    .bp-supplier-avatar {
      width: 40px; height: 40px;
      border-radius: 50%;
      background: var(--theme-bg);
      border: 0.5px solid var(--theme-border);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .bp-supplier-avatar-initial {
      color: var(--theme-accent);
      font-family: var(--font-display);
      font-size: 18px;
      font-weight: 400;
    }
    .bp-supplier-identity-body { min-width: 0; }
    .bp-supplier-name {
      font-family: var(--font-display);
      font-size: 20px;
      font-weight: 400;
      color: var(--color-text-primary);
      line-height: 1.2;
    }
    .bp-supplier-location {
      font-size: 12px;
      color: var(--color-text-muted);
      margin-top: 2px;
      letter-spacing: 0.02em;
    }

    /* Centred company logo above the description. Only renders when
       supplier.logo_url is set. */
    .bp-supplier-logo-block {
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 8px 0 24px;
    }
    .bp-supplier-logo-img {
      max-height: 120px;
      max-width: 240px;
      object-fit: contain;
    }

    /* Description */
    .bp-supplier-desc {
      font-size: 14px;
      line-height: 1.6;
      color: var(--color-text-primary);
      margin: 0 0 28px;
      white-space: pre-wrap;
      text-align: left;
    }
    .bp-supplier-desc--muted { color: var(--color-text-muted); font-style: italic; }

    /* Sub-catalogue cards grouped by parent category. */
    .bp-home-cats { margin-bottom: 28px; }
    .bp-home-cat-group + .bp-home-cat-group { margin-top: 24px; }
    .bp-home-cat-header {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.1em;
      color: var(--theme-accent);
      padding-bottom: 8px;
      margin-bottom: 12px;
      border-bottom: 0.5px solid var(--theme-border);
      font-family: var(--font-body);
    }
    .bp-home-cat-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
    .bp-home-cat-card {
      display: flex;
      flex-direction: column;
      background: var(--color-surface);
      border: 0.5px solid var(--color-border);
      border-radius: 10px;
      overflow: hidden;
      padding: 0;
      text-align: left;
      cursor: pointer;
      transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
      font-family: inherit;
    }
    .bp-home-cat-card:hover {
      border-color: var(--theme-accent);
      box-shadow: 0 4px 12px rgba(0,0,0,0.06);
      transform: translateY(-1px);
    }
    .bp-home-cat-card-img {
      width: 100%;
      height: 96px;
      background-size: cover;
      background-position: center;
      background-color: var(--theme-bg);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .bp-home-cat-card-img--fallback {
      background: linear-gradient(135deg, var(--theme-bg) 0%, var(--theme-border) 100%);
    }
    .bp-home-cat-card-initial {
      font-family: var(--font-display);
      font-size: 32px;
      color: var(--theme-accent);
      opacity: 0.6;
    }
    .bp-home-cat-card-body { padding: 10px 12px 12px; }
    .bp-home-cat-card-name {
      font-family: var(--font-display);
      font-size: 14px;
      font-weight: 400;
      color: var(--color-text-primary);
      line-height: 1.25;
      margin-bottom: 3px;
    }
    .bp-home-cat-card-count {
      font-size: 11px;
      color: var(--color-text-muted);
    }

    /* Contact 2×2 icon grid */
    .bp-supplier-contact-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 12px;
    }
    .bp-contact-tile {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 16px;
      background: var(--theme-bg);
      border: 0.5px solid var(--theme-border);
      border-radius: 10px;
      text-decoration: none;
      color: inherit;
      transition: border-color 0.15s, background 0.15s;
    }
    .bp-contact-tile--link { cursor: pointer; }
    .bp-contact-tile--link:hover {
      border-color: var(--theme-accent);
      background: var(--color-surface);
    }
    .bp-contact-tile-icon {
      width: 32px; height: 32px;
      border-radius: 50%;
      background: var(--color-surface);
      border: 0.5px solid var(--theme-border);
      display: flex; align-items: center; justify-content: center;
      color: var(--theme-accent);
      flex-shrink: 0;
    }
    .bp-contact-tile-body { flex: 1; min-width: 0; }
    .bp-contact-tile-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-muted);
      margin-bottom: 4px;
    }
    .bp-contact-tile-value {
      font-size: 13px;
      color: var(--color-text-primary);
      word-break: break-word;
      line-height: 1.4;
    }

    .bp-supplier-vat {
      font-size: 11px;
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-top: 14px;
      text-align: center;
    }

    @media (max-width: 600px) {
      .bp-supplier-contact-grid { grid-template-columns: 1fr; }
      .bp-home-cat-grid { grid-template-columns: repeat(2, 1fr); }
      .bp-supplier-name { font-size: 18px; }
    }
    @media (max-width: 420px) {
      .bp-home-cat-grid { grid-template-columns: 1fr; }
    }

  `]
})
export class SupplierDetailComponent implements OnInit, OnDestroy {
  supplier: any = null;
  catalogueItems: any[] = [];
  projects: Project[] = [];
  loading = true;
  showQuoteDrawer = false;
  selectedItem: any = null;
  selectedProjectId = '';
  quoteBrief = '';
  ballsBalance = 0;
  creditLabel = 'Ball';
  projectPreSelected = false;
  private sid = '';

  // Catalogue grid data
  itemEntities: CatalogueEntity[] = [];
  categories: CategoryInfo[] = [];
  itemFavIds = new Set<string>();

  // Image upload
  uploadEntityId = '';
  uploadCoverUrl = '';
  uploadImageDisplay: 'cover' | 'contain' = 'cover';

  // Item drawer — v1.17: now driven by an explicit mode input so the
  // same component handles add / edit / view from a single mount.
  ownsCatalogue = false;
  showItemDrawer = false;
  drawerMode: ItemDrawerMode = 'add';
  /** Item passed to the drawer in edit + view modes. null for add. */
  drawerItem: Item | null = null;

  // ── v1.17 project-cart context for the detail action cluster ───────
  /** Project_items snapshot for the active project (if one is selected
      via ?projectId= query param). Drives the + / ♡ active state on the
      detail panel's action buttons. */
  projectItems: ProjectItem[] = [];
  /** Current user's org id (drives isOwner — gates the ✎ edit button). */
  currentOrgId: string | null = null;
  /** Current user's org type — 'agency' or 'supplier'. Agencies see the
      +/♡ buttons; suppliers don't. */
  currentOrgType: string | null = null;

  // Home / Store tabs — default 'home'. Page-local state, not routed.
  activeTab: 'home' | 'store' = 'home';

  // Supplier edit drawer state.
  showSupplierDrawer = false;

  /** Store tab — when false (default) only show categories the supplier
      has items in (plus their ancestors so drill works). When true, show
      the full catalogue tree like the marketplace browse. Mirrors the
      "Show all categories" / "Show scoped only" pattern from the project
      Build tab. */
  showAllStoreCategories = false;

  // Home tab — subcategory cards grouped by parent. Built from items'
  // category_ids merged with the full catalogue category hierarchy so
  // each section can show its parent name as a header.
  homeCategoryGroups: Array<{
    parentName: string;
    subcategories: CategoryInfo[];
  }> = [];
  /** Full catalogue category hierarchy from CategoryService — only used
      on the Home tab to resolve parent_id chains for the grouped cards. */
  private allCatalogueCategories: Category[] = [];
  /** Seed values passed to the drawer in add mode. Computed from the
      catalogue-grid's current category filter on each Add click so the
      drawer lands pre-populated with the user's contextual view. */
  addPrefill: { category_id?: string; subcategory_id?: string } | null = null;

  @ViewChild(CatalogueGridComponent) private catGrid?: CatalogueGridComponent;

  constructor(
    private route: ActivatedRoute,
    private supplierSvc: SupplierService,
    private projectSvc: ProjectService,
    private projectItemSvc: ProjectItemService,
    private favSvc: FavouriteService,
    private orgSvc: OrgService,
    private categorySvc: CategoryService,
    private configService: ConfigService,
    private shellCtx: ShellContextService,
    private msg: MessageService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.sid = this.route.snapshot.paramMap.get('id') || '';
    this.creditLabel = this.configService.current?.creditLabel || 'Ball';

    const qp = this.route.snapshot.queryParams;
    if (qp['projectId']) { this.selectedProjectId = qp['projectId']; this.projectPreSelected = true; }

    this.orgSvc.getCurrentOrg().subscribe(org => {
      if (org) {
        this.ballsBalance = org.balls_balance || 0;
        this.ownsCatalogue = org.id === this.sid;
        this.currentOrgId = org.id;
        this.currentOrgType = org.type || null;
        this.cdr.detectChanges();
      }
    });

    // If a project is in context (via ?projectId=…), load its cart so the
    // detail-panel + / ♡ buttons reflect existing selections immediately.
    if (this.selectedProjectId) {
      this.loadProjectItems(this.selectedProjectId);
    }

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
          this.shellCtx.set({
            heroTitle: this.supplier.name,
            heroSub: this.supplier.city || 'London',
            pills: [],
            tabs: [],
            back: { label: 'Back to catalogue', onBack: () => this.goBack() }
          });
        }
        this.cdr.detectChanges();
      }
    });

    this.supplierSvc.getCatalogue(this.sid).subscribe({
      next: (items: any[]) => {
        this.catalogueItems = items || [];
        this.mapItems();
        this.buildCategories();
        this.buildHomeCategoryGroups();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });

    // Full catalogue category hierarchy — only needed by the Home tab to
    // resolve parent_id chains for grouped subcategory cards.
    this.categorySvc.getAll('catalogue').subscribe({
      next: (cats: Category[]) => {
        this.allCatalogueCategories = cats || [];
        // Re-run buildCategories so the Store circle strip picks up the
        // cover_image_url / logo_url / icon_name from the full records.
        // (The items API only carries id + name, so the first call from
        // the items subscribe builds bare entries.)
        this.buildCategories();
        this.buildHomeCategoryGroups();
        this.cdr.detectChanges();
      }
    });

    this.favSvc.itemFavIds$.subscribe(ids => {
      this.itemFavIds = new Set(ids);
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy() { this.shellCtx.reset(); }

  mapItems() {
    this.itemEntities = this.catalogueItems.map((i: any) => ({
      id: i.id,
      name: i.name,
      description: i.description,
      image_url: i.image_url,
      external_url: i.external_url,
      cover_image_url: this.supplier?.cover_image_url,
      image_display: i.image_url ? (i.image_display || 'cover') : (this.supplier?.image_display || 'cover'),
      category_id: i.category_id,
      subtitle: i.category_name,
      price: i.base_price ? Number(i.base_price) : undefined,
      priceRange: i.min_price && i.max_price ? { min: Number(i.min_price), max: Number(i.max_price) } : undefined,
      unit: i.unit,
      categoryLabel: i.category_name,
      specs: i.lead_time_days ? [{ label: 'Lead time', value: `${i.lead_time_days} working days` }] : [],
      _raw: i
    }));
  }

  buildCategories() {
    // Mirror the marketplace's supplier-list pattern: pass the full
    // catalogue category tree (top-level + subcategories) so the grid
    // can render top-level circles and drill into children on click.
    // Counts are scoped to THIS supplier — for each item, walk up the
    // parent_id chain and increment every ancestor (so a top-level
    // "Catering" card reflects all 5 sub-category items beneath it).
    if (!this.allCatalogueCategories.length) {
      // Categories haven't loaded yet — keep the current value to avoid
      // flicker; buildCategories() is re-run from the categories
      // subscribe once data arrives.
      return;
    }

    const counts: Record<string, number> = {};
    for (const item of this.catalogueItems) {
      let current = this.allCatalogueCategories.find(c => c.id === item.category_id);
      let guard = 6;
      while (current && guard-- > 0) {
        counts[current.id] = (counts[current.id] || 0) + 1;
        if (!current.parent_id) break;
        const parentId: string = current.parent_id;
        current = this.allCatalogueCategories.find(c => c.id === parentId);
      }
    }

    this.categories = this.allCatalogueCategories
      .filter(c => (c as any).enabled !== false)
      .map(c => ({
        id: c.id,
        name: c.name,
        cover_image_url: c.cover_image_url,
        logo_url: c.logo_url,
        icon_name: c.icon_name,
        icon_color: c.icon_color,
        parent_id: c.parent_id || undefined,
        tagline: c.tagline,
        description: c.description,
        model: c.model || 'A',
        count: counts[c.id] || 0
      }));
  }

  /** Categories actually passed to <app-catalogue-grid>. Scoped view
      (default) keeps only entries with count > 0 — since counts walk up
      the ancestor chain in buildCategories(), this naturally includes
      both leaf categories the supplier has items in AND their parents
      (so the drill path works). Show-all reveals the full enabled tree
      to match the marketplace browse. */
  get displayStoreCategories(): CategoryInfo[] {
    if (this.showAllStoreCategories) return this.categories;
    return this.categories.filter(c => (c.count || 0) > 0);
  }

  toggleShowAllStoreCategories() {
    this.showAllStoreCategories = !this.showAllStoreCategories;
    this.cdr.detectChanges();
  }

  /** Build the Home tab's grouped subcategory cards.
      For each item's category_id, resolve to its parent (or use itself if
      top-level). Then group subcategories by parent name. Each group
      renders as: parent header + a card per subcategory.
      Skipped silently until BOTH items and the full category hierarchy
      have loaded — buildHomeCategoryGroups() is called from both subscribe
      blocks so it runs whichever arrives last. */
  buildHomeCategoryGroups() {
    if (!this.catalogueItems.length || !this.allCatalogueCategories.length) {
      this.homeCategoryGroups = [];
      return;
    }

    // First: per item.category_id → enriched subcategory CategoryInfo
    // (with the full record's cover/description and a rolled-up count).
    const subMap: Record<string, CategoryInfo> = {};
    for (const item of this.catalogueItems) {
      const id = item.category_id;
      if (!id) continue;
      if (!subMap[id]) {
        const cat = this.allCatalogueCategories.find(c => c.id === id);
        subMap[id] = {
          id,
          name: cat?.name || item.category_name || 'Other',
          cover_image_url: cat?.cover_image_url,
          icon_name: cat?.icon_name,
          icon_color: cat?.icon_color,
          tagline: cat?.tagline,
          description: cat?.description,
          parent_id: cat?.parent_id,
          count: 0
        };
      }
      subMap[id].count = (subMap[id].count || 0) + 1;
    }

    // Group by parent — items on a top-level category get themselves as
    // both the parent header and the only card (rare but possible).
    const groupMap: Record<string, { parentName: string; subcategories: CategoryInfo[] }> = {};
    for (const sub of Object.values(subMap)) {
      let parentId = sub.parent_id || sub.id;
      let parentName = sub.name;
      if (sub.parent_id) {
        const parent = this.allCatalogueCategories.find(c => c.id === sub.parent_id);
        if (parent) parentName = parent.name;
      }
      if (!groupMap[parentId]) {
        groupMap[parentId] = { parentName, subcategories: [] };
      }
      groupMap[parentId].subcategories.push(sub);
    }

    // Sort: groups alphabetic by parent name; cards alphabetic by sub name.
    const groups = Object.values(groupMap);
    for (const g of groups) {
      g.subcategories.sort((a, b) => a.name.localeCompare(b.name));
    }
    groups.sort((a, b) => a.parentName.localeCompare(b.parentName));
    this.homeCategoryGroups = groups;
  }


  // ── Event handlers ────────────────────────────────────────────────────

  goBack() {
    // v1.32: history.back() so the user lands wherever they came
    // from — dashboard, /suppliers?favourites=true, a project page,
    // etc. — instead of always being dumped on /suppliers. If there's
    // no history entry (deep-link / fresh tab) we fall back to the
    // catalogue.
    if (history.length > 1) history.back();
    else this.router.navigate(['/suppliers']);
  }

  onEntitySelected(_entity: CatalogueEntity) {}

  onFavToggled(entityId: string) {
    this.favSvc.toggleItem(entityId).subscribe(() => this.cdr.detectChanges());
  }

  onImageEdit(entity: CatalogueEntity) {
    this.uploadEntityId = entity.id;
    this.uploadCoverUrl = entity.image_url || '';
    this.uploadImageDisplay = entity.image_display || 'cover';
    this.cdr.detectChanges();
  }

  onAction(entity: CatalogueEntity) {
    // Own-supplier view: tapping the row CTA opens the edit drawer pre-populated.
    // Edit-pencil-on-shared-item-detail is the eventual trigger (deferred until
    // the shared item-detail component lands); for now we re-use actionClicked.
    if (this.ownsCatalogue) {
      const raw = this.catalogueItems.find(i => i.id === entity.id);
      if (raw) this.openEditItemDrawer(raw as Item);
      return;
    }
    const params: any = {};
    if (this.selectedProjectId) params['projectId'] = this.selectedProjectId;
    this.router.navigate(['/suppliers', this.sid, 'items', entity.id], { queryParams: params });
  }

  // ── Item drawer wiring ────────────────────────────────────────────────

  openAddItemDrawer() {
    this.drawerItem = null;
    this.drawerMode = 'add';
    this.addPrefill = this.computeAddPrefill();
    this.showItemDrawer = true;
    this.cdr.detectChanges();
  }

  /** Read the catalogue-grid's current filter state and translate it into
      the drawer's prefill shape. activeCategory is always a top-level id
      (or 'all'); when drilled, drilledCategory carries the parent and
      activeChildCategory may hold the selected subcategory.
      Returns null when there's nothing useful to pre-populate. */
  private computeAddPrefill(): { category_id?: string; subcategory_id?: string } | null {
    const grid = this.catGrid;
    if (!grid) return null;
    let category_id: string | undefined;
    let subcategory_id: string | undefined;
    if (grid.drilledCategory) {
      category_id = grid.drilledCategory.id;
      if (grid.activeChildCategory) subcategory_id = grid.activeChildCategory;
    } else if (grid.activeCategory && grid.activeCategory !== 'all') {
      category_id = grid.activeCategory;
    }
    if (!category_id && !subcategory_id) return null;
    return { category_id, subcategory_id };
  }

  openEditItemDrawer(item: Item) {
    this.drawerItem = item;
    this.drawerMode = 'edit';
    this.showItemDrawer = true;
    this.cdr.detectChanges();
  }

  /** v1.17 — open the drawer in read-only view mode. Triggered by the
      eye icon in catalogue-grid's detail panel. */
  openViewItemDrawer(item: Item) {
    this.drawerItem = item;
    this.drawerMode = 'view';
    this.showItemDrawer = true;
    this.cdr.detectChanges();
  }

  /** Fired from catalogue-grid's inline-detail edit pencil. The grid
      surfaces a CatalogueEntity (display projection); we need the raw
      item row for the drawer's pre-population so we look it up in
      catalogueItems and delegate to openEditItemDrawer. */
  onItemEditRequested(entity: CatalogueEntity) {
    const raw = this.catalogueItems.find(i => i.id === entity.id);
    if (raw) this.openEditItemDrawer(raw as Item);
  }

  /** v1.17 — fired from the eye icon on the detail panel. */
  onViewItem(entity: CatalogueEntity) {
    const raw = this.catalogueItems.find(i => i.id === entity.id);
    if (raw) this.openViewItemDrawer(raw as Item);
  }

  onItemSaved(_item: Item) {
    // Refresh the catalogue so the grid AND the Home subcategory cards
    // reflect the new/updated row.
    this.supplierSvc.getCatalogue(this.sid).subscribe({
      next: (items: any[]) => {
        this.catalogueItems = items || [];
        this.mapItems();
        this.buildCategories();
        this.buildHomeCategoryGroups();
        this.cdr.detectChanges();
      }
    });
    this.drawerItem = null;
  }

  onItemDrawerCancelled() {
    this.drawerItem = null;
  }

  // ── v1.17 project-cart wiring ─────────────────────────────────────────

  private loadProjectItems(projectId: string) {
    this.projectItemSvc.getByProject(projectId).subscribe({
      next: rows => {
        this.projectItems = rows || [];
        this.cdr.detectChanges();
      }
    });
  }

  /** + / ♡ upsert handler. The service uses ON CONFLICT on the unique
      (project_id, item_id) index so flipping types mutates the same row
      rather than creating duplicates. */
  onAddToProject(event: { entity: CatalogueEntity; type: 'selected' | 'liked' }) {
    if (!this.selectedProjectId) {
      this.msg.add({
        severity: 'warn',
        summary: 'No project selected',
        detail: 'Open this supplier with ?projectId=… to add items to a project.',
        life: 4000
      });
      return;
    }
    this.projectItemSvc.add(this.selectedProjectId, event.entity.id, event.type).subscribe({
      next: () => {
        // Refresh the snapshot — the service cache has already been
        // upserted but we want the bound array reference to change so
        // OnPush downstream re-renders the +/♡ active state.
        this.loadProjectItems(this.selectedProjectId);
        this.msg.add({
          severity: 'success',
          summary: event.type === 'liked' ? 'Liked for project' : 'Added to project',
          life: 2000
        });
      },
      error: () => {
        this.msg.add({ severity: 'error', summary: 'Save failed', life: 3000 });
      }
    });
  }

  /** Toggle-off — clicking + on a selected (or ♡ on a liked) item removes
      it from the project entirely. */
  onRemoveFromProject(event: { entity: CatalogueEntity }) {
    if (!this.selectedProjectId) return;
    this.projectItemSvc.remove(this.selectedProjectId, event.entity.id).subscribe({
      next: () => {
        this.loadProjectItems(this.selectedProjectId);
        this.msg.add({ severity: 'success', summary: 'Removed from project', life: 2000 });
      },
      error: () => {
        this.msg.add({ severity: 'error', summary: 'Remove failed', life: 3000 });
      }
    });
  }

  // ── Home tab + supplier edit drawer ──────────────────────────────────

  /** Does the supplier have at least one tile to render in the contact
      grid? VAT lives on its own line below now, so it doesn't gate this. */
  hasAnyContact(): boolean {
    const s = this.supplier;
    if (!s) return false;
    return !!(s.address || s.city || s.country || s.phone || s.email || s.website);
  }

  /** Tagline shown under the supplier name in the profile bar. Currently
      derives from city + country since `Org.tagline` doesn't exist yet —
      can swap to a real field when one's added to the org model. */
  supplierTagline(): string {
    const s = this.supplier;
    if (!s) return '';
    if (s.city && s.country) return `${s.city}, ${s.country}`;
    return s.city || s.country || '';
  }

  openSupplierEditDrawer() {
    this.showSupplierDrawer = true;
    this.cdr.detectChanges();
  }

  onSupplierSaved(updated: Org) {
    // Replace the rendered supplier with the saved row; shell hero name
    // also updates since it reads supplier.name in onInit. We keep the
    // existing supplier reference's identity by mutation-then-detect to
    // avoid downstream child re-renders if not needed.
    this.supplier = { ...this.supplier, ...updated };
    this.showSupplierDrawer = false;
    // Update the shell hero label so the page header reflects any name change.
    this.shellCtx.set({
      heroTitle: this.supplier.name,
      heroSub: this.supplier.city || 'London',
      pills: [],
      tabs: [],
      back: { label: 'Back to catalogue', onBack: () => this.goBack() }
    });
    this.cdr.detectChanges();
  }

  /** Catalogue xls upload — stub for now. We capture the chosen file and
      acknowledge it so the user knows the picker fires; real parsing
      (xlsx → bulk item create) wires later. Resets the input so the same
      file can be re-picked next time. */
  onCatalogueUploadSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) return;
    this.msg.add({
      severity: 'info',
      summary: 'File selected',
      detail: `${file.name} — upload wiring coming next.`,
      life: 4000
    });
    // Reset so picking the same file again still fires change.
    input.value = '';
    this.cdr.detectChanges();
  }

  onItemImageUpdated(event: { coverUrl: string; imageDisplay?: 'cover' | 'contain' }) {
    const raw = this.catalogueItems.find(i => i.id === this.uploadEntityId);
    if (raw) {
      raw.image_url = event.coverUrl;
      if (event.imageDisplay) raw.image_display = event.imageDisplay;
    }
    this.mapItems();
    this.uploadEntityId = '';
    this.cdr.detectChanges();
  }

  sendQuote() {
    this.showQuoteDrawer = false;
    this.msg.add({ severity: 'success', summary: 'Quote requested!', detail: `${this.supplier?.name} will be in touch.`, life: 3000 });
    this.ballsBalance = Math.max(0, this.ballsBalance - 1);
    this.cdr.detectChanges();
  }
}
