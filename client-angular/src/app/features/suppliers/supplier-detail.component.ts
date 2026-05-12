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
import { FavouriteService } from '../../core/services/favourite.service';
import { OrgService } from '../../core/services/org.service';
import { CategoryService } from '../../core/services/category.service';
import { ConfigService } from '../../core/services/config.service';
import { ShellContextService } from '../../core/services/shell-context.service';
import { Category } from '../../models';
import { GbpPipe } from '../../shared/pipes/gbp.pipe';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { ImageUploadPanelComponent } from '../../shared/components/image-upload-panel/image-upload-panel.component';
import { CatalogueGridComponent } from '../../shared/components/catalogue-grid/catalogue-grid.component';
import { ItemDrawerComponent } from '../../shared/components/item-drawer/item-drawer.component';
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
           Approved design: full-width cover banner with rounded bottom +
           edit pencil overlay, logo as <img> circle overlapping cover,
           name + tagline, description, 2×2 contact icon grid.
           TODO: gate the edit pencil on ownership once auth lands. -->
      <ng-container *ngIf="activeTab === 'home'">

        <!-- Cover banner — full width, rounded bottom corners, edit
             pencil top-right. -->
        <div class="bp-supplier-cover"
             [style.background-image]="supplier.cover_image_url ? 'url(' + supplier.cover_image_url + ')' : null"
             [class.bp-supplier-cover--empty]="!supplier.cover_image_url">
          <button class="bp-supplier-cover-edit"
                  (click)="openSupplierEditDrawer()"
                  title="Edit supplier details">
            <lucide-icon name="square-pen" [size]="14"></lucide-icon>
          </button>
        </div>

        <div class="bp-supplier-home">
          <!-- Profile bar: logo circle overlapping cover bottom, name + tagline below -->
          <div class="bp-supplier-profile">
            <div class="bp-supplier-logo">
              <img *ngIf="supplier.logo_url"
                   [src]="supplier.logo_url"
                   [alt]="supplier.name + ' logo'"
                   class="bp-supplier-logo-img"/>
              <span *ngIf="!supplier.logo_url" class="bp-supplier-logo-initial">
                {{ supplier.name.charAt(0) }}
              </span>
            </div>
            <h1 class="bp-supplier-name">{{ supplier.name }}</h1>
            <div class="bp-supplier-tagline" *ngIf="supplierTagline()">
              {{ supplierTagline() }}
            </div>
          </div>

          <!-- Description (plain text for now — markdown renderer adds later) -->
          <p class="bp-supplier-desc" *ngIf="supplier.description">{{ supplier.description }}</p>
          <p class="bp-supplier-desc bp-supplier-desc--muted" *ngIf="!supplier.description">
            No description yet.
          </p>

          <!-- Contact 2×2 icon grid — each tile only renders when its
               value is present. Address rolls in city + country so we
               keep the grid at four tiles max. -->
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

          <!-- VAT as a small line below the grid — not prominent enough
               to deserve its own contact tile. -->
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
           Two-level: category cards landing → catalogue grid drill-in.
           A real shopfront browse: pick a department first, then browse
           that department's items. -->
      <ng-container *ngIf="activeTab === 'store'">

        <!-- ── LEVEL 1: category cards ───────────────────────────────── -->
        <ng-container *ngIf="!drilledCategory">
          <div class="bp-store-empty" *ngIf="!supplierCategories.length">
            This supplier hasn't published any items yet.
          </div>
          <div class="bp-store-cards-grid" *ngIf="supplierCategories.length">
            <button type="button" class="bp-store-cat-card"
                    *ngFor="let cat of supplierCategories"
                    (click)="drillIntoCategory(cat)">
              <div class="bp-store-cat-card-img"
                   [style.background-image]="cat.cover_image_url ? 'url(' + cat.cover_image_url + ')' : null"
                   [class.bp-store-cat-card-img--fallback]="!cat.cover_image_url">
                <span *ngIf="!cat.cover_image_url" class="bp-store-cat-card-initial">
                  {{ cat.name.charAt(0) }}
                </span>
              </div>
              <div class="bp-store-cat-card-body">
                <div class="bp-store-cat-card-name">{{ cat.name }}</div>
                <div class="bp-store-cat-card-count">
                  {{ cat.count }} {{ cat.count === 1 ? 'item' : 'items' }}
                </div>
                <div class="bp-store-cat-card-desc" *ngIf="cat.description">
                  {{ cat.description.length > 120 ? (cat.description | slice:0:120) + '…' : cat.description }}
                </div>
              </div>
            </button>
          </div>
        </ng-container>

        <!-- ── LEVEL 2: drilled catalogue grid ───────────────────────── -->
        <ng-container *ngIf="drilledCategory">
          <div class="bp-store-drilled">
            <button type="button" class="bp-store-back" (click)="drillOut()">
              <i class="pi pi-arrow-left"></i>
              <span>Back to categories</span>
            </button>
            <div class="bp-store-drilled-header">
              <div class="bp-store-drilled-title">{{ drilledCategory.name }}</div>
              <div class="bp-store-drilled-count">
                {{ drilledItems.length }} {{ drilledItems.length === 1 ? 'item' : 'items' }}
              </div>
            </div>
          </div>

          <app-catalogue-grid
            [entities]="drilledItems"
            [categories]="drilledSubcategories"
            entityType="item"
            entityLabel="item"
            [actionLabel]="'View →'"
            [favouriteIds]="itemFavIds"
            [showEdit]="true"
            [showItemEdit]="true"
            [showFavourite]="true"
            [showBack]="false"
            [totalCount]="drilledItems.length"
            sectionTitle="CATALOGUE"
            (entitySelected)="onEntitySelected($event)"
            (favouriteToggled)="onFavToggled($event)"
            (imageEditRequested)="onImageEdit($event)"
            (itemEditRequested)="onItemEditRequested($event)"
            (actionClicked)="onAction($event)">
            <div catalogue-toggles class="bp-cat-actions">
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
        </ng-container>

        <!-- Item drawer + image upload panel are mounted once and stay
             reachable from both levels (the pencil only fires from drilled
             grid today, but the drawer should survive a drillOut()). -->
        <app-item-drawer
          [(visible)]="showItemDrawer"
          [item]="editingItem"
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
            No active projects. <a routerLink="/projects/new" style="color:var(--theme-accent);">Create one first →</a>
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

    /* ── Home/Store tab bar ───────────────────────────────────────────
       Reuses .bp-hero-tabs / .bp-hero-tab from styles.css. We just
       center the bar within the page and put a little vertical padding
       so the tabs sit naturally below the shell hero. */
    .bp-supplier-tabs {
      justify-content: center;
      padding: 0 28px;
    }

    /* ── HOME TAB ───────────────────────────────────────────────────── */

    /* Full-width cover banner with rounded bottom corners. Edit pencil
       sits absolute top-right of the cover (not the page). */
    .bp-supplier-cover {
      position: relative;
      width: 100%;
      height: 200px;
      border-radius: 0 0 16px 16px;
      background-size: cover;
      background-position: center;
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
      padding: 0 28px 32px;
    }

    /* Profile bar — logo circle overlaps the cover bottom by ~half its
       height; name + tagline sit below. */
    .bp-supplier-profile {
      margin-top: -40px;
      margin-bottom: 20px;
      text-align: center;
    }
    .bp-supplier-logo {
      width: 80px; height: 80px;
      border-radius: 50%;
      background: var(--color-surface);
      border: 3px solid var(--color-surface);
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      margin-bottom: 12px;
    }
    .bp-supplier-logo-img {
      width: 100%; height: 100%;
      object-fit: contain;
      padding: 8px;
      background: var(--color-surface);
      box-sizing: border-box;
    }
    .bp-supplier-logo-initial {
      color: var(--theme-accent);
      font-family: var(--font-display);
      font-size: 32px;
      font-weight: 400;
      background: var(--theme-bg);
      width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
    }
    .bp-supplier-name {
      font-family: var(--font-display);
      font-size: 28px;
      font-weight: 400;
      color: var(--color-text-primary);
      margin: 0 0 4px;
      line-height: 1.2;
    }
    .bp-supplier-tagline {
      font-size: 13px;
      color: var(--color-text-muted);
      letter-spacing: 0.02em;
    }

    /* Description */
    .bp-supplier-desc {
      font-size: 14px;
      line-height: 1.6;
      color: var(--color-text-primary);
      margin: 16px 0 24px;
      white-space: pre-wrap;
      text-align: left;
    }
    .bp-supplier-desc--muted { color: var(--color-text-muted); font-style: italic; }

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
      .bp-supplier-name { font-size: 24px; }
    }

    /* ── STORE TAB ─ Level 1 (category cards) ───────────────────────── */
    .bp-store-cards-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      padding: 24px 28px;
      max-width: 880px;
      margin: 0 auto;
    }
    .bp-store-empty {
      text-align: center;
      color: var(--color-text-muted);
      padding: 60px 24px;
      font-size: 13px;
    }
    .bp-store-cat-card {
      display: block;
      width: 100%;
      text-align: left;
      background: var(--color-surface);
      border-radius: 12px;
      border: 0.5px solid var(--color-border);
      overflow: hidden;
      cursor: pointer;
      padding: 0;
      transition: box-shadow 0.15s, transform 0.15s, border-color 0.15s;
      font-family: inherit;
    }
    .bp-store-cat-card:hover {
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
      transform: translateY(-2px);
      border-color: var(--theme-border);
    }
    .bp-store-cat-card-img {
      width: 100%;
      height: 160px;
      background-size: cover;
      background-position: center;
      background-color: var(--theme-bg);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .bp-store-cat-card-img--fallback {
      background: linear-gradient(135deg, var(--theme-bg) 0%, var(--theme-border) 100%);
    }
    .bp-store-cat-card-initial {
      font-family: var(--font-display);
      font-size: 48px;
      color: var(--theme-accent);
      opacity: 0.6;
    }
    .bp-store-cat-card-body { padding: 14px 16px 16px; }
    .bp-store-cat-card-name {
      font-family: var(--font-display);
      font-size: 17px;
      font-weight: 400;
      color: var(--color-text-primary);
      margin-bottom: 2px;
    }
    .bp-store-cat-card-count {
      font-size: 12px;
      color: var(--color-text-secondary);
      margin-bottom: 6px;
    }
    .bp-store-cat-card-desc {
      font-size: 12.5px;
      color: var(--color-text-secondary);
      line-height: 1.5;
    }

    /* ── STORE TAB ─ Level 2 (drilled) ──────────────────────────────── */
    .bp-store-drilled {
      max-width: 1180px;
      margin: 0 auto;
      padding: 16px 28px 0;
    }
    .bp-store-back {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 0;
      font-size: 13px;
      color: var(--theme-accent);
      background: none;
      border: none;
      cursor: pointer;
      font-weight: 500;
      font-family: var(--font-body);
    }
    .bp-store-back:hover { text-decoration: underline; }
    .bp-store-drilled-header {
      display: flex;
      align-items: baseline;
      gap: 12px;
      margin: 8px 0 16px;
    }
    .bp-store-drilled-title {
      font-family: var(--font-display);
      font-size: 22px;
      font-weight: 400;
      color: var(--color-text-primary);
    }
    .bp-store-drilled-count {
      font-size: 13px;
      color: var(--color-text-secondary);
    }

    @media (max-width: 720px) {
      .bp-store-cards-grid { grid-template-columns: 1fr; padding: 16px; }
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

  // Item add/edit drawer — only used when current org owns the catalogue
  ownsCatalogue = false;
  showItemDrawer = false;
  editingItem: Item | null = null;

  // Home / Store tabs — default 'home'. Page-local state, not routed.
  activeTab: 'home' | 'store' = 'home';

  // Supplier edit drawer state.
  showSupplierDrawer = false;

  // ── Store tab two-level state ─────────────────────────────────────────
  /** Full catalogue categories from CategoryService (joined with items
      to enrich each Store card with cover image, description, etc.). */
  allCatalogueCategories: Category[] = [];
  /** Top-level categories present in this supplier's catalogue, enriched
      with cover_image_url / description / item count rolled up across
      their subcategories. Rendered as the Store landing cards. */
  supplierCategories: CategoryInfo[] = [];
  /** When set, Store tab shows the catalogue-grid filtered to this
      category's branch (it + its subcategories). null → landing cards. */
  drilledCategory: CategoryInfo | null = null;
  /** Pre-filtered item entities for the drilled category — passed to
      catalogue-grid as [entities]. */
  drilledItems: CatalogueEntity[] = [];
  /** Subcategories of the drilled category — passed to catalogue-grid
      as [categories] so the circle strip + sidebar filter further. */
  drilledSubcategories: CategoryInfo[] = [];
  /** Seed values passed to the drawer in add mode. Computed from the
      catalogue-grid's current category filter on each Add click so the
      drawer lands pre-populated with the user's contextual view. */
  addPrefill: { category_id?: string; subcategory_id?: string } | null = null;

  @ViewChild(CatalogueGridComponent) private catGrid?: CatalogueGridComponent;

  constructor(
    private route: ActivatedRoute,
    private supplierSvc: SupplierService,
    private projectSvc: ProjectService,
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
        this.cdr.detectChanges();
      }
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
          this.shellCtx.set({ heroTitle: this.supplier.name, heroSub: this.supplier.city || 'London', pills: [], tabs: [] });
        }
        this.cdr.detectChanges();
      }
    });

    this.supplierSvc.getCatalogue(this.sid).subscribe({
      next: (items: any[]) => {
        this.catalogueItems = items || [];
        this.mapItems();
        this.buildCategories();
        this.buildSupplierCategoryCards();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });

    // Load the full catalogue category hierarchy so the Store landing
    // cards can show real cover images / descriptions / tagline (the
    // existing item-level join only carries category_name + id).
    this.categorySvc.getAll('catalogue').subscribe({
      next: (cats: Category[]) => {
        this.allCatalogueCategories = cats || [];
        // Re-build cards once both data sources are in.
        this.buildSupplierCategoryCards();
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
    const map: Record<string, { id: string; name: string; count: number }> = {};
    for (const item of this.catalogueItems) {
      const key = item.category_id || 'other';
      if (!map[key]) map[key] = { id: key, name: item.category_name || 'Other', count: 0 };
      map[key].count++;
    }
    this.categories = Object.values(map);
  }

  // ── Store landing cards ──────────────────────────────────────────────

  /** Build supplierCategories: one card per category that the supplier
      has items in, using items.category_id directly (no roll-up).
      Subcategories are the meaningful unit — items live on leaves like
      "Sit-Down Dining", "Bowl Food & Sharing", etc. The full category
      record (cover image, description, tagline) is merged in from
      allCatalogueCategories so cards can show rich content; if the
      catalogue list hasn't loaded yet, we still build minimal cards
      from item.category_name so the page isn't empty. */
  buildSupplierCategoryCards() {
    if (!this.catalogueItems.length) {
      this.supplierCategories = [];
      return;
    }
    const counts: Record<string, { count: number; name: string }> = {};
    for (const item of this.catalogueItems) {
      const id = item.category_id;
      if (!id) continue;
      if (!counts[id]) counts[id] = { count: 0, name: item.category_name || '' };
      counts[id].count++;
    }
    const cards: CategoryInfo[] = [];
    for (const [id, { count, name: fallbackName }] of Object.entries(counts)) {
      const cat = this.allCatalogueCategories.find(c => c.id === id);
      cards.push({
        id,
        // Prefer the full record's name (canonical capitalisation), fall
        // back to the items-join name while categories are still loading.
        name: cat?.name || fallbackName || 'Other',
        cover_image_url: cat?.cover_image_url,
        icon_name: cat?.icon_name,
        icon_color: cat?.icon_color,
        tagline: cat?.tagline,
        description: cat?.description,
        parent_id: cat?.parent_id,
        count
      });
    }
    cards.sort((a, b) => a.name.localeCompare(b.name));
    this.supplierCategories = cards;
  }

  // ── Drill-in / drill-out ─────────────────────────────────────────────

  drillIntoCategory(cat: CategoryInfo) {
    this.drilledCategory = cat;
    this.computeDrilledViews();
    this.cdr.detectChanges();
  }

  drillOut() {
    this.drilledCategory = null;
    this.drilledItems = [];
    this.drilledSubcategories = [];
    this.cdr.detectChanges();
  }

  /** Recompute drilledItems + drilledSubcategories based on the current
      drilledCategory. Called on every drill-in (and could be called again
      after a save if items are re-fetched). */
  private computeDrilledViews() {
    if (!this.drilledCategory) {
      this.drilledItems = [];
      this.drilledSubcategories = [];
      return;
    }
    const rootId = this.drilledCategory.id;
    const subIds = new Set(
      this.allCatalogueCategories
        .filter(c => c.parent_id === rootId)
        .map(c => c.id)
    );
    const includeIds = new Set([rootId, ...subIds]);
    this.drilledItems = this.itemEntities.filter(e => e.category_id && includeIds.has(e.category_id));
    this.drilledSubcategories = this.allCatalogueCategories
      .filter(c => c.parent_id === rootId)
      .map(c => ({
        id: c.id,
        name: c.name,
        cover_image_url: c.cover_image_url,
        icon_name: c.icon_name,
        icon_color: c.icon_color,
        parent_id: c.parent_id,
        tagline: c.tagline,
        description: c.description,
        count: this.itemEntities.filter(e => e.category_id === c.id).length
      }));
  }

  // ── Event handlers ────────────────────────────────────────────────────

  goBack() {
    this.router.navigate(['/suppliers']);
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
    this.editingItem = null;
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
    let category_id: string | undefined;
    let subcategory_id: string | undefined;

    // Inner state — when the user has clicked a subcategory circle inside
    // the drilled catalogue-grid, prefer that as the most-specific hint.
    const grid = this.catGrid;
    if (grid?.drilledCategory) {
      category_id = grid.drilledCategory.id;
      if (grid.activeChildCategory) subcategory_id = grid.activeChildCategory;
    } else if (grid?.activeCategory && grid.activeCategory !== 'all') {
      category_id = grid.activeCategory;
    }

    // Outer state — Store landing → drilled category card. When the inner
    // grid has nothing selected, fall back to the page-level drilled
    // category. The drawer resolves a child id back to (parent, child),
    // so passing either a top-level or subcategory id is safe.
    if (!category_id && !subcategory_id && this.drilledCategory) {
      category_id = this.drilledCategory.id;
    }

    if (!category_id && !subcategory_id) return null;
    return { category_id, subcategory_id };
  }

  openEditItemDrawer(item: Item) {
    this.editingItem = item;
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

  onItemSaved(_item: Item) {
    // Refresh the catalogue so both the landing cards and the drilled
    // grid reflect the new/updated row.
    this.supplierSvc.getCatalogue(this.sid).subscribe({
      next: (items: any[]) => {
        this.catalogueItems = items || [];
        this.mapItems();
        this.buildCategories();
        this.buildSupplierCategoryCards();
        // If we're currently drilled, recompute the filtered slice too.
        if (this.drilledCategory) this.computeDrilledViews();
        this.cdr.detectChanges();
      }
    });
    this.editingItem = null;
  }

  onItemDrawerCancelled() {
    this.editingItem = null;
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
      tabs: []
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
