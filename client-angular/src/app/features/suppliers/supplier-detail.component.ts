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
import { PersonaService } from '../../core/services/persona.service';
import { Category, ProjectItem } from '../../models';
import { GbpPipe } from '../../shared/pipes/gbp.pipe';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { ImageUploadPanelComponent } from '../../shared/components/image-upload-panel/image-upload-panel.component';
import { CatalogueGridComponent } from '../../shared/components/catalogue-grid/catalogue-grid.component';
import { ItemDrawerComponent, ItemDrawerMode } from '../../shared/components/item-drawer/item-drawer.component';
import { SupplierDrawerComponent } from '../../shared/components/supplier-drawer/supplier-drawer.component';
import { MessagesInboxComponent } from '../../shared/components/messages-inbox/messages-inbox.component';
import { Project, CatalogueEntity, CategoryInfo, Item, Org } from '../../models';

@Component({
  selector: 'app-supplier-detail',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    ButtonModule, DropdownModule, InputTextareaModule, SidebarModule, ToastModule,
    LucideAngularModule,
    GbpPipe, LoadingSpinnerComponent, ImageUploadPanelComponent, CatalogueGridComponent,
    ItemDrawerComponent, SupplierDrawerComponent, MessagesInboxComponent
  ],
  providers: [MessageService],
  template: `
    <div class="bp-page">
    <app-loading *ngIf="loading"></app-loading>
    <ng-container *ngIf="!loading && supplier">

      <!-- v1.65dm — Home/Store tabs moved INTO the shell hero. The local
           tab bar that used to sit below the hero was duplicating the
           hero-tabs band and breaking the back-button rail. Now we push
           the tabs through ShellContextService with an onTabClick
           callback + activeTabPath, matching the dashboard's
           page-local-state pattern. -->

      <!-- ═══ HOME TAB ════════════════════════════════════════════════
           Layout (top → bottom):
             1. Cover banner (full-width, rounded bottom) + edit pencil
             2. Identity row — small initial-circle avatar + name + location
             3. Centered company logo (logo_url) — if set
             4. Description
             5. Subcategory cards grouped by parent category header
             6. Contact 2×2 icon grid + VAT footer
           TODO: gate the edit pencil on ownership once auth lands. -->
      <!-- ═══ HOME TAB (v1.65e1 / p0015) ═══════════════════════════
           Rendered only when the supplier persona is viewing their
           own page (ownsCatalogue). Mirrors the agency dashboard
           pattern: parchment ground + elevated .bp-dash-card panels.
           Placeholder welcome card for now; the real supplier
           dashboard (recent threads, action queue, store summary)
           lands in a follow-up. -->
      <ng-container *ngIf="activeTab === 'home' && ownsCatalogue">
        <div class="bp-supplier-home-ground">
          <div class="bp-supplier-home">
            <div class="bp-dash-card">
              <div class="bp-section-header">
                <lucide-icon name="house" [size]="13" class="bp-section-icon"></lucide-icon>
                <span class="bp-section-title">Welcome back</span>
              </div>
              <p style="margin: 0; font-size: 16px; line-height: 1.5; color: var(--color-text-primary);">
                {{ supplier.name }} home page. Quick stats, recent
                replies, and pending actions will live here.
              </p>
            </div>
          </div>
        </div>
      </ng-container>

      <ng-container *ngIf="activeTab === 'front'">

        <!-- v1.65dm — Home tab now mirrors the dashboard:
             parchment ground (--theme-bg) with shadow-only .bp-dash-card
             panels floating on it. Three cards in the column:
               1. Profile — cover (rounded-top of the card) + identity
                  row + logo + description.
               2. Category groups — one card per parent the supplier
                  has items under, with a left-justified section header
                  and the subcategory grid below.
               3. Contact — 2×2 icon-tile grid + optional VAT footer. -->
        <div class="bp-supplier-home-ground">
          <div class="bp-supplier-home">

            <!-- ─── PROFILE BLOCK (open) ─────────────────────────────
                 v1.65dq — no card chrome on this top block. Cover +
                 identity + logo + description sit directly on the
                 parchment ground (no fill, no border, no shadow) so
                 the supplier's brand image is the visual anchor and
                 the elevated cards start at Categories below. -->
            <div class="bp-supplier-profile-card">
              <!-- Cover banner — sits on the parchment ground with
                   rounded corners on its own. Edit pencil overlays
                   top-right (ownership gating TODO). -->
              <div class="bp-supplier-cover"
                   [style.background-image]="supplier.cover_image_url ? 'url(' + supplier.cover_image_url + ')' : null"
                   [class.bp-supplier-cover--empty]="!supplier.cover_image_url">
                <button class="bp-supplier-cover-edit"
                        (click)="openSupplierEditDrawer()"
                        title="Edit supplier details">
                  <lucide-icon name="square-pen" [size]="14"></lucide-icon>
                </button>
              </div>

              <div class="bp-supplier-profile-body">
                <!-- Identity row — small avatar + name + location. -->
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

                <!-- Centred logo — hidden when no logo_url is set. -->
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
              </div>
            </div>

            <!-- ─── CATEGORY GROUP CARDS (one per parent) ────────── -->
            <div class="bp-dash-card"
                 *ngFor="let group of homeCategoryGroups">
              <div class="bp-section-header">
                <lucide-icon name="folder" [size]="13" class="bp-section-icon"></lucide-icon>
                <span class="bp-section-title">{{ group.parentName }}</span>
                <span class="bp-section-trail bp-section-count">
                  {{ group.subcategories.length }}
                  {{ group.subcategories.length === 1 ? 'category' : 'categories' }}
                </span>
              </div>
              <div class="bp-home-cat-grid">
                <button type="button" class="bp-home-cat-card bp-card-hover"
                        *ngFor="let sub of group.subcategories">
                  <div class="bp-home-cat-card-img"
                       [class.bp-home-cat-card-img--fallback]="!sub.cover_image_url">
                    <!-- Cover on its own layer so it zooms on hover (only the
                         photo; the card lifts via .bp-card-hover). -->
                    <div *ngIf="sub.cover_image_url" class="bp-card-zoom-img"
                         [style.background-image]="'url(' + sub.cover_image_url + ')'"></div>
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

            <!-- ─── CONTACT CARD ─────────────────────────────────── -->
            <div class="bp-dash-card" *ngIf="hasAnyContact()">
              <div class="bp-section-header">
                <lucide-icon name="contact-round" [size]="13" class="bp-section-icon"></lucide-icon>
                <span class="bp-section-title">Contact info</span>
              </div>

              <div class="bp-supplier-contact-grid">
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
          viewControlsKey="supplier-store"
          entityType="item"
          entityLabel="item"
          [actionLabel]="''"
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
          [subcategories]="availableSubcategories"
          [activeSubcategoryId]="activeSubcategoryId"
          (categoryChanged)="onCategoryChanged($event)"
          (subcategoryChanged)="onSubcategoryChanged($event)"
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
          (cancelled)="onItemDrawerCancelled()"
          (deleted)="onItemDeleted($event)">
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

      <!-- ═══ INBOX TAB (v1.65e1 / p0015) ════════════════════════════
           Mounts the shared MessagesInboxComponent with viewer='supplier'
           so the supplier-side of the conversation renders inline. Only
           rendered when ownsCatalogue (a supplier viewing their own
           page); agencies browsing this supplier never see this tab. -->
      <ng-container *ngIf="activeTab === 'inbox' && ownsCatalogue">
        <app-messages-inbox viewer="supplier"></app-messages-inbox>
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

    /* v1.65dm — local .bp-supplier-tabs block retired; Home/Store
       tabs now live in the shell hero via ShellContextService. */

    /* ── HOME TAB ─────────────────────────────────────────────────────
       v1.65dm — parchment ground wraps the 720px column; each section
       lifts into its own .bp-dash-card so the layout mirrors the new
       dashboard. The ground bleeds edge-to-edge so the cards float on
       a continuous parchment surface. */

    .bp-supplier-home-ground {
      background: var(--theme-bg);
      padding: 24px 20px;
      min-height: calc(100vh - var(--nav-height) - 64px);
    }

    .bp-supplier-home {
      max-width: 720px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* ── Profile block ───────────────────────────────────────────────
       v1.65dq — no card chrome on this top block. No fill, no border,
       no shadow — content sits directly on the parchment ground.
       Cover keeps its own rounded corners; the body just owns its
       vertical rhythm. */
    .bp-supplier-profile-card {
      background: transparent;
      box-shadow: none;
      border: none;
      padding: 0;
    }
    .bp-supplier-profile-body {
      padding: 18px 4px 4px;
    }

    /* Cover banner — image only, no chrome. v1.65dr drops the white
       --color-surface fill that boxed the logo against the parchment;
       now the image sits on the parchment directly with any letterbox
       area showing the page ground through. No border, no fill, no
       shadow. Edit pencil overlays top-right.

       background-size: contain keeps the image at its natural aspect;
       the container reserves vertical space (220px) but is otherwise
       invisible when the image doesn't fill it. */
    .bp-supplier-cover {
      position: relative;
      width: 100%;
      height: 220px;
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
      background-color: transparent;
    }
    /* v1.65dr — empty cover (no cover_image_url) used to fill with a
       parchment→border gradient. Stripped now so the open-block rule
       applies uniformly: the edit pencil floats in the top-right of an
       invisible reserved area, ready to wire a cover image. */
    .bp-supplier-cover--empty { background: transparent; }
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

    /* Section-header count trail (e.g. "5 categories") — sits at the
       right end of the header strip via .bp-section-trail (the global
       rule margin-left:auto's it). v1.65dq — 12px to track the wider
       typography on this page. */
    .bp-section-count {
      font-size: 12px;
      font-weight: 500;
      color: var(--color-text-muted);
      letter-spacing: 0.02em;
    }

    /* v1.65dq — section title on the Home tab reads a hair larger
       than the global .bp-section-title (11px). Card headers act as
       row eyebrows here, so a bump to 12px keeps them legible against
       the heavier surrounding copy without becoming chrome. Scoped to
       .bp-supplier-home so it doesn't leak elsewhere. */
    .bp-supplier-home .bp-section-title {
      font-size: 12px;
    }

    /* Identity row: small avatar circle + name + location. First child
       of the profile card body; spacing handled by sibling margins
       below, not bottom margin here. */
    .bp-supplier-identity {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 18px;
    }
    .bp-supplier-avatar {
      width: 48px; height: 48px;
      border-radius: 50%;
      background: var(--color-surface);
      border: 0.5px solid var(--theme-border);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .bp-supplier-avatar-initial {
      color: var(--theme-accent);
      font-family: var(--font-display);
      font-size: 22px;
      font-weight: 400;
    }
    .bp-supplier-identity-body { min-width: 0; }
    /* v1.65dq — bumped typography on the Home tab so it reads as a
       proper profile page, not catalogue boilerplate. */
    .bp-supplier-name {
      font-family: var(--font-display);
      font-size: 26px;
      font-weight: 400;
      color: var(--color-text-primary);
      line-height: 1.2;
    }
    .bp-supplier-location {
      font-size: 14px;
      color: var(--color-text-muted);
      margin-top: 3px;
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

    /* Description — last child of the profile body, so no trailing
       margin. v1.65dq — 16px / 1.65 reads as proper body copy on the
       parchment ground (was 14px when it lived inside a card). */
    .bp-supplier-desc {
      font-size: 16px;
      line-height: 1.65;
      color: var(--color-text-primary);
      margin: 0;
      white-space: pre-wrap;
      text-align: left;
    }
    .bp-supplier-desc--muted { color: var(--color-text-muted); font-style: italic; }

    /* v1.65dm — category-group cards now use the shared .bp-section-header
       pattern (Lucide icon + .bp-section-title + trailing count), so the
       legacy .bp-home-cat-header / .bp-home-cats / .bp-home-cat-group
       rules are retired. .bp-home-cat-grid below carries the card layout
       inside each group card. */
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
      transition: var(--card-hover-transition);   /* card hover standard */
      font-family: inherit;
    }
    /* Hover via the global .bp-card-hover class on the element (see template). */
    .bp-home-cat-card-img {
      width: 100%;
      height: 96px;
      background-color: var(--theme-bg);
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;   /* hosts the .bp-card-zoom-img cover layer */
      overflow: hidden;     /* clips the zoom to the 96px image area */
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
    .bp-home-cat-card-body { padding: 12px 14px 14px; }
    /* v1.65dq — typography bump across the Home tab. Was 14/11; now
       16/12 so subcat cards read at body-copy scale, not metadata. */
    .bp-home-cat-card-name {
      font-family: var(--font-display);
      font-size: 16px;
      font-weight: 400;
      color: var(--color-text-primary);
      line-height: 1.25;
      margin-bottom: 4px;
    }
    .bp-home-cat-card-count {
      font-size: 12px;
      color: var(--color-text-muted);
    }

    /* Contact 2×2 icon grid — sits inside the .bp-dash-card contact
       block; the card owns the outer padding so no margin needed here. */
    .bp-supplier-contact-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
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
    /* v1.65dq — label + value bumped one step (was 10/13, now 11/15). */
    .bp-contact-tile-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-muted);
      margin-bottom: 4px;
    }
    .bp-contact-tile-value {
      font-size: 15px;
      color: var(--color-text-primary);
      word-break: break-word;
      line-height: 1.45;
    }

    .bp-supplier-vat {
      font-size: 11px;
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-top: 16px;
      padding-top: 12px;
      border-top: var(--border-hairline);
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

  // v1.65dz (p0015) — "Home" tab renamed to "Front" (the supplier's
  // public shopfront).
  // v1.65e1 — supplier-detail expanded to FOUR tabs when viewing your
  // own org (ownsCatalogue): Home / Front / Store / Inbox. Agencies
  // browsing a supplier see only Front + Store (the public surface).
  // Page-local state, not routed; ?tab= query-param overrides the
  // default on first paint.
  activeTab: 'home' | 'front' | 'store' | 'inbox' = 'front';

  // Supplier edit drawer state.
  showSupplierDrawer = false;

  /** Store tab — when false (default) only show categories the supplier
      has items in (plus their ancestors so drill works). When true, show
      the full catalogue tree like the marketplace browse. Mirrors the
      "Show all categories" / "Show scoped only" pattern from the project
      Build tab. */
  showAllStoreCategories = false;

  // v1.41a — supplier store now mirrors the marketplaces:
  // category circle → subcat pill row → filtered items.
  // availableSubcategories repopulates whenever a parent circle is
  // clicked; activeSubcategoryId is the FK passed to the grid.
  availableSubcategories: Array<{ id: string; name: string }> = [];
  activeSubcategoryId = '';

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
  addPrefill: { category_id?: string; subcategory_id?: string; org_id?: string } | null = null;

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
    public  personaSvc: PersonaService,
    private msg: MessageService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.sid = this.route.snapshot.paramMap.get('id') || '';
    this.creditLabel = this.configService.current?.creditLabel || 'Ball';

    const qp = this.route.snapshot.queryParams;
    if (qp['projectId']) { this.selectedProjectId = qp['projectId']; this.projectPreSelected = true; }
    // v1.65dz (p0015) → v1.65e1 — ?tab= deep-links into any of the 4
    // supplier-detail tabs. Defaults to 'front' (the public shopfront)
    // when no param is set OR when an agency is browsing someone
    // else's supplier page (Home + Inbox only render when ownsCatalogue
    // is true, so picking them on a foreign page just sticks to front).
    const tabParam = qp['tab'];
    if (tabParam === 'home' || tabParam === 'front' ||
        tabParam === 'store' || tabParam === 'inbox') {
      this.activeTab = tabParam;
    }

    this.orgSvc.getCurrentOrg().subscribe(org => {
      if (org) {
        this.ballsBalance = org.balls_balance || 0;
        this.currentOrgId = org.id;
        this.currentOrgType = org.type || null;
        // v1.65e1 (p0015) — when a supplier persona is active (dev/admin
        // switcher), treat the persona's supplierOrgId as the "current
        // supplier" for the owns-this-page check. Production users hit
        // the org-based branch.
        const personaSupplierId = this.personaSvc.isSupplier()
          ? this.personaSvc.active.supplierOrgId
          : null;
        this.ownsCatalogue = personaSupplierId
          ? personaSupplierId === this.sid
          : org.id === this.sid;
        // Re-push the tab set in case ownsCatalogue flipped (4-tab vs
        // 2-tab band). Safe to call even before .supplier loads —
        // applyShellHero short-circuits when this.supplier is null.
        this.applyShellHero();
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
        if (this.supplier) this.applyShellHero();
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
      // v1.41a — surface subcategory FK so the catalogue-grid's
      // internal pill filter matches on pre-loaded entities.
      subcategory_id: i.subcategory_id,
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
    // v1.41a — re-evaluate the chip strip whenever the "Show all
    // categories" toggle flips so scoped/all rules stay aligned with
    // the parent circle strip. activeChip set is captured via the
    // grid's last (categoryChanged) emission — derived here from the
    // active parent on the grid via activeSubcategoryId membership.
    if (this.availableSubcategories.length) {
      const activeParent = this.availableSubcategories[0]
        ? this.allCatalogueCategories.find(c =>
            c.id === this.availableSubcategories[0].id)?.parent_id || null
        : null;
      if (activeParent) this.onCategoryChanged(activeParent);
    }
    this.cdr.detectChanges();
  }

  // v1.41a — subcategory chip strip on the supplier store. Same UX
  // as the main + project marketplaces. Scoped to children the
  // supplier actually has items in unless "Show all categories" is
  // active, in which case we show every child of the parent.
  onCategoryChanged(catId: string) {
    this.activeSubcategoryId = '';
    if (catId === 'all') {
      this.availableSubcategories = [];
    } else {
      // Build the chip list from the same allCatalogueCategories tree
      // used elsewhere on this page. Filter to children of the active
      // parent; in scoped mode also drop children with no items.
      const supplierChildIds = new Set(
        this.catalogueItems
          .map(i => i.subcategory_id)
          .filter(id => !!id)
      );
      this.availableSubcategories = (this.allCatalogueCategories || [])
        .filter(c => c.parent_id === catId)
        .filter(c => this.showAllStoreCategories || supplierChildIds.has(c.id))
        .sort((a, b) => ((a as any).sort_order || 0) - ((b as any).sort_order || 0))
        .map(c => ({ id: c.id, name: c.name }));
    }
    this.cdr.detectChanges();
  }

  /** Track the chip click — internal filter inside catalogue-grid
      does the actual entity-narrowing on pre-loaded items. */
  onSubcategoryChanged(id: string) {
    this.activeSubcategoryId = id || '';
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

    // v1.65dm — items carry BOTH category_id (top-level parent) and
    // subcategory_id (leaf). The Home tab wants leaf cards grouped under
    // their parent, so prefer subcategory_id and fall back to category_id
    // only when the item is pinned directly to a top-level parent
    // (rare — most items have a leaf). The previous version only looked
    // at category_id which is why a supplier with five Catering subcats
    // surfaced as a single "Catering" card.
    //
    // v1.65do — subcategory card image now uses the first item's
    // image_url (from THIS supplier's catalogue), not the category's
    // own cover. Reasoning: catalogue covers are generic stock; an
    // item photo shows the supplier's actual work in that subcat.
    // Order matters — catalogueItems is the API's natural sort, so
    // the "first item" is whichever the supplier service surfaced
    // first. Fallback chain: item.image_url → category.cover_image_url
    // → initial-letter tile (handled in the template).
    const subMap: Record<string, CategoryInfo> = {};
    for (const item of this.catalogueItems) {
      const id = item.subcategory_id || item.category_id;
      if (!id) continue;
      if (!subMap[id]) {
        const cat = this.allCatalogueCategories.find(c => c.id === id);
        subMap[id] = {
          id,
          name: cat?.name || item.category_name || 'Other',
          // Prefer the first item's image; fall back to the category cover.
          cover_image_url: item.image_url || cat?.cover_image_url,
          icon_name: cat?.icon_name,
          icon_color: cat?.icon_color,
          tagline: cat?.tagline,
          description: cat?.description,
          parent_id: cat?.parent_id,
          count: 0
        };
      } else if (!subMap[id].cover_image_url && item.image_url) {
        // First item didn't have an image but a later item does —
        // adopt it so the card isn't stuck on the initial-letter
        // fallback when an image exists somewhere in the subcat.
        subMap[id].cover_image_url = item.image_url;
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

  /** v1.65dm — single source of truth for the shell hero state on this
      page.
      v1.65e1 (p0015) — tabs are now persona-aware: when ownsCatalogue
      is true (the supplier persona viewing their own org), all four
      tabs render — Home / Front / Store / Inbox. Otherwise (an agency
      browsing this supplier from the catalogue) only the public-
      surface tabs render — Front + Store. */
  private applyShellHero() {
    if (!this.supplier) return;
    const tabs = this.ownsCatalogue
      ? [
          { label: 'Home',  path: 'home'  },
          { label: 'Front', path: 'front' },
          { label: 'Store', path: 'store' },
          { label: 'Inbox', path: 'inbox' },
        ]
      : [
          { label: 'Front', path: 'front' },
          { label: 'Store', path: 'store' },
        ];
    this.shellCtx.set({
      heroTitle: this.supplier.name,
      heroSub: this.supplier.city || 'London',
      pills: [],
      tabs,
      activeTabPath: this.activeTab,
      onTabClick: (t) => this.setActiveTab(t.path as 'home' | 'front' | 'store' | 'inbox'),
      back: { label: 'Back', onBack: () => this.goBack() }
    });
  }

  /** v1.65dm — flip the page-local tab AND re-push the shell context so
      the active state on the hero tab band stays in sync. */
  setActiveTab(tab: 'home' | 'front' | 'store' | 'inbox') {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.applyShellHero();
    this.cdr.detectChanges();
  }

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
    // v1.43a — the new item belongs to the SUPPLIER whose page this is
    // (this.sid), not the logged-in org. Without this, an agency adding
    // an item from a supplier's catalogue filed it under the agency.
    this.addPrefill = { ...(this.computeAddPrefill() ?? {}), org_id: this.sid };
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
  /** v1.34a: "View item" navigates to /items/:id.
      v1.36: context=supplier&supplierId=<sid> tells the item page to
      render this shop front's hero (supplier name + city) and tabs/
      back behaviour matches the supplier context. */
  onViewItem(entity: CatalogueEntity) {
    const params: any = { context: 'supplier', supplierId: this.sid };
    if (this.selectedProjectId) params['projectId'] = this.selectedProjectId;
    this.router.navigate(['/items', entity.id], { queryParams: params });
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

  /** v1.65ey — drawer fires `deleted` after a successful soft-delete.
      Same refresh path as save: re-pull the supplier's catalogue so
      the deleted row drops out of the grid + the Home subcategory
      counts update. */
  onItemDeleted(_e: { id: string }) {
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
    this.applyShellHero();
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
