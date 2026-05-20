import {
  Component, Input, Output, EventEmitter,
  ChangeDetectionStrategy, ChangeDetectorRef,
  OnChanges, OnInit, SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DropdownModule } from 'primeng/dropdown';
import { SidebarModule } from 'primeng/sidebar';
import { ChipsModule } from 'primeng/chips';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LucideAngularModule, GitBranch, X, Plus, Image } from 'lucide-angular';
import { forkJoin, Observable } from 'rxjs';

import { Item, Codelist, Category, Org } from '../../../models';
import { CodelistService } from '../../../core/services/codelist.service';
import { CategoryService } from '../../../core/services/category.service';
import { ItemService } from '../../../core/services/item.service';
import { OrgService } from '../../../core/services/org.service';
import { GbpPipe } from '../../pipes/gbp.pipe';
import { MarkdownEditorComponent } from '../markdown-editor/markdown-editor.component';
import { ImageUploadPanelComponent } from '../image-upload-panel/image-upload-panel.component';

type LeadTimeUnit = 'days' | 'weeks';
type TierValue = 'basic' | 'mid' | 'premium' | null;
export type ItemDrawerMode = 'add' | 'edit' | 'view';

interface TierOption { value: 'basic' | 'mid' | 'premium'; label: string; }

interface ItemImage {
  url: string;
  sort_order: number;
  is_hero: boolean;
}

interface ItemForm {
  name: string;
  description: string;
  category_id: string | null;       // top-level category id (parent)
  subcategory_id: string | null;    // child category id (or null)
  tier: TierValue;
  lead_time_value: number | null;
  lead_time_unit: LeadTimeUnit;
  unit: string | null;
  time_unit: string | null;
  base_price: number | null;
  min_price: number | null;
  max_price: number | null;
  derived_from_id: string | null;
  parent_item_id: string | null;
  image_url: string | null;
  image_display: 'cover' | 'contain';
  tags: string[];
  external_url: string | null;
  /** v1.17: ordered gallery (8 slots). Maintained client-side; on save we
      send the whole array and the server keeps image_url in sync with
      whichever entry is is_hero (or images[0]) for backward compat. */
  images: ItemImage[];
}

const TIER_OPTIONS: TierOption[] = [
  { value: 'basic',   label: 'Core' },
  { value: 'mid',     label: 'Signature' },
  { value: 'premium', label: 'Premium' }
];

const IMAGE_SLOT_COUNT = 8;
type DrawerTab = 'details' | 'index' | 'images';

@Component({
  selector: 'app-item-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule,
    SidebarModule, ButtonModule, InputTextModule, InputNumberModule,
    DropdownModule, ChipsModule, ToastModule,
    LucideAngularModule,
    GbpPipe, MarkdownEditorComponent, ImageUploadPanelComponent
  ],
  providers: [MessageService],
  template: `
    <p-sidebar [(visible)]="visible"
               (visibleChange)="onVisibleChange($event)"
               position="right"
               styleClass="bp-drawer"
               [style]="{width:'520px'}"
               [showCloseIcon]="false"
               (onHide)="onCancel()">

      <ng-template pTemplate="header">
        <div class="bp-drawer-header-row">
          <div class="bp-drawer-header">
            <span class="bp-drawer-label">CATALOGUE</span>
            <div class="bp-drawer-title">{{ headerTitle }}</div>
          </div>
          <button class="bp-icon-btn" (click)="onCancel()" title="Close">
            <i class="pi pi-times"></i>
          </button>
        </div>
      </ng-template>

      <!-- ── TAB BAR ──────────────────────────────────────────────────
           Underline-style tabs matching the project / supplier hero tab
           pattern (see .bp-hero-tabs in styles.css). Scoped locally so
           the in-drawer strip doesn't fight the page-level hero tabs. -->
      <div class="bp-drawer-tabs">
        <button class="bp-drawer-tab"
                [class.active]="activeTab === 'details'"
                (click)="activeTab = 'details'"
                type="button">
          Details
        </button>
        <button class="bp-drawer-tab"
                [class.active]="activeTab === 'index'"
                (click)="activeTab = 'index'"
                type="button">
          Index
        </button>
        <button class="bp-drawer-tab"
                [class.active]="activeTab === 'images'"
                (click)="activeTab = 'images'"
                type="button">
          Images
        </button>
      </div>

      <div class="bp-drawer-body">

        <!-- ═══════════════ TAB 1: DETAILS ═══════════════ -->
        <ng-container *ngIf="activeTab === 'details'">

          <div class="bp-field">
            <label class="bp-field-label">Item name <span *ngIf="!isView">*</span></label>
            <input *ngIf="!isView" pInputText
                   [(ngModel)]="form.name"
                   class="w-full bp-input-edit"
                   placeholder='e.g. 55&quot; LED TV Screen'/>
            <div *ngIf="isView" class="bp-readonly-value">{{ form.name || '—' }}</div>
          </div>

          <div class="bp-field">
            <label class="bp-field-label">Description</label>
            <app-markdown-editor *ngIf="!isView"
              [(value)]="form.description"
              [showLabel]="false"
              [rows]="6"
              placeholder="Describe what's included...">
            </app-markdown-editor>
            <div *ngIf="isView" class="bp-readonly-value bp-readonly-value--multiline">
              {{ form.description || '—' }}
            </div>
          </div>

          <div class="bp-grid-2">
            <div class="bp-field">
              <label class="bp-field-label">Category <span *ngIf="!isView">*</span></label>
              <p-dropdown *ngIf="!isView" [(ngModel)]="form.category_id"
                          [options]="topCategories"
                          optionLabel="name"
                          optionValue="id"
                          (onChange)="onCategoryChange()"
                          styleClass="w-full bp-input-edit"
                          placeholder="Select category">
              </p-dropdown>
              <div *ngIf="isView" class="bp-readonly-value">{{ categoryLabel(form.category_id) || '—' }}</div>
            </div>
            <div class="bp-field">
              <label class="bp-field-label">Subcategory</label>
              <p-dropdown *ngIf="!isView" [(ngModel)]="form.subcategory_id"
                          [options]="subcategories"
                          optionLabel="name"
                          optionValue="id"
                          [disabled]="!form.category_id || subcategories.length === 0"
                          [showClear]="true"
                          styleClass="w-full bp-input-edit"
                          placeholder="None">
              </p-dropdown>
              <div *ngIf="isView" class="bp-readonly-value">{{ categoryLabel(form.subcategory_id) || '—' }}</div>
            </div>
          </div>

          <div class="bp-field">
            <label class="bp-field-label">Lead time</label>
            <div class="bp-grid-2" *ngIf="!isView">
              <p-inputNumber [(ngModel)]="form.lead_time_value"
                             [min]="0"
                             [showButtons]="false"
                             inputStyleClass="w-full bp-input-edit">
              </p-inputNumber>
              <p-dropdown [(ngModel)]="form.lead_time_unit"
                          [options]="leadTimeUnits"
                          optionLabel="label"
                          optionValue="value"
                          styleClass="w-full bp-input-edit">
              </p-dropdown>
            </div>
            <div *ngIf="isView" class="bp-readonly-value">
              <ng-container *ngIf="form.lead_time_value != null">
                {{ form.lead_time_value }} {{ form.lead_time_unit }}
              </ng-container>
              <ng-container *ngIf="form.lead_time_value == null">—</ng-container>
            </div>
          </div>

          <div class="bp-grid-2">
            <div class="bp-field">
              <label class="bp-field-label">Unit <span *ngIf="!isView">*</span></label>
              <p-dropdown *ngIf="!isView" [(ngModel)]="form.unit"
                          [options]="units"
                          optionLabel="label"
                          optionValue="code"
                          styleClass="w-full bp-input-edit"
                          placeholder="Select unit">
              </p-dropdown>
              <div *ngIf="isView" class="bp-readonly-value">{{ unitLabel(form.unit) || '—' }}</div>
            </div>
            <div class="bp-field">
              <label class="bp-field-label">Time unit</label>
              <p-dropdown *ngIf="!isView" [(ngModel)]="form.time_unit"
                          [options]="timeUnits"
                          optionLabel="label"
                          optionValue="code"
                          [showClear]="true"
                          styleClass="w-full bp-input-edit"
                          placeholder="None">
              </p-dropdown>
              <div *ngIf="isView" class="bp-readonly-value">{{ unitLabel(form.time_unit) || '—' }}</div>
            </div>
          </div>

          <div class="bp-grid-3">
            <div class="bp-field">
              <label class="bp-field-label">Min price</label>
              <div *ngIf="!isView" class="bp-money-input">
                <span class="bp-money-prefix">£</span>
                <input pInputText
                       type="number"
                       min="0"
                       [(ngModel)]="form.min_price"
                       class="w-full bp-input-edit bp-input-money"
                       placeholder="0"/>
              </div>
              <div *ngIf="isView" class="bp-readonly-value">
                {{ form.min_price != null ? (form.min_price | gbp) : '—' }}
              </div>
            </div>
            <div class="bp-field">
              <label class="bp-field-label">Ballpark <span *ngIf="!isView">*</span></label>
              <div *ngIf="!isView" class="bp-money-input bp-money-input--accent">
                <span class="bp-money-prefix">£</span>
                <input pInputText
                       type="number"
                       min="0"
                       [(ngModel)]="form.base_price"
                       class="w-full bp-input-edit bp-input-money bp-input-money--accent"
                       placeholder="0"/>
              </div>
              <div *ngIf="isView" class="bp-readonly-value bp-readonly-value--accent">
                {{ form.base_price != null ? (form.base_price | gbp) : '—' }}
              </div>
            </div>
            <div class="bp-field">
              <label class="bp-field-label">Max price</label>
              <div *ngIf="!isView" class="bp-money-input">
                <span class="bp-money-prefix">£</span>
                <input pInputText
                       type="number"
                       min="0"
                       [(ngModel)]="form.max_price"
                       class="w-full bp-input-edit bp-input-money"
                       placeholder="0"/>
              </div>
              <div *ngIf="isView" class="bp-readonly-value">
                {{ form.max_price != null ? (form.max_price | gbp) : '—' }}
              </div>
            </div>
          </div>

          <div class="bp-helper-text" *ngIf="!isView && form.base_price && form.unit">
            Agencies see <strong>{{ form.base_price | gbp }} per {{ unitLabel(form.unit) }}</strong> in the marketplace.
            <span *ngIf="form.min_price && form.max_price">
              Range: {{ form.min_price | gbp }} – {{ form.max_price | gbp }}.
            </span>
          </div>

          <!-- Summary card (always shown when there's something to summarise) -->
          <div class="bp-summary-card" *ngIf="form.base_price && form.unit">
            <div class="bp-summary-row">
              <span class="bp-summary-label">Marketplace price</span>
              <span class="bp-summary-value bp-summary-value--big">{{ form.base_price | gbp }}</span>
            </div>
            <div class="bp-summary-row">
              <span class="bp-summary-label">Per</span>
              <span class="bp-summary-value">{{ unitLabel(form.unit) }}</span>
            </div>
            <div class="bp-summary-row" *ngIf="form.min_price && form.max_price">
              <span class="bp-summary-label">Price range</span>
              <span class="bp-summary-value">{{ form.min_price | gbp }} – {{ form.max_price | gbp }}</span>
            </div>
            <div class="bp-summary-row" *ngIf="form.time_unit">
              <span class="bp-summary-label">Billed</span>
              <span class="bp-summary-value">{{ unitLabel(form.time_unit) }}</span>
            </div>
          </div>

        </ng-container>

        <!-- ═══════════════ TAB 2: INDEX ═══════════════ -->
        <ng-container *ngIf="activeTab === 'index'">

          <!-- Derived-from info bar sits at top of Index — the lineage tab. -->
          <div *ngIf="form.derived_from_id as dfId" class="bp-derived-bar">
            <lucide-icon name="git-branch" [size]="14"></lucide-icon>
            <span class="bp-derived-text">
              Derived from
              <span class="bp-derived-name">{{ derivedFromName(dfId) }}</span>
            </span>
          </div>

          <div class="bp-field">
            <label class="bp-field-label">Tier</label>
            <div *ngIf="!isView" class="bp-tier-pills">
              <button *ngFor="let t of tierOptions"
                      type="button"
                      class="bp-tier-pill"
                      [class.bp-tier-pill--active]="form.tier === t.value"
                      (click)="toggleTier(t.value)">
                {{ t.label }}
              </button>
            </div>
            <div *ngIf="isView" class="bp-readonly-value">
              <span *ngIf="form.tier" class="bp-tier-badge">{{ tierLabel(form.tier) }}</span>
              <span *ngIf="!form.tier">—</span>
            </div>
          </div>

          <div class="bp-grid-2">
            <div class="bp-field">
              <label class="bp-field-label">Derived from</label>
              <p-dropdown *ngIf="!isView" [(ngModel)]="form.derived_from_id"
                          [options]="lineageOptions"
                          optionLabel="name"
                          optionValue="id"
                          [showClear]="true"
                          [filter]="true"
                          filterBy="name"
                          styleClass="w-full bp-input-edit"
                          placeholder="None">
              </p-dropdown>
              <div *ngIf="isView" class="bp-readonly-value">
                {{ form.derived_from_id ? derivedFromName(form.derived_from_id) : '—' }}
              </div>
            </div>
            <div class="bp-field">
              <label class="bp-field-label">Parent item</label>
              <p-dropdown *ngIf="!isView" [(ngModel)]="form.parent_item_id"
                          [options]="lineageOptions"
                          optionLabel="name"
                          optionValue="id"
                          [showClear]="true"
                          [filter]="true"
                          filterBy="name"
                          styleClass="w-full bp-input-edit"
                          placeholder="None (standalone)">
              </p-dropdown>
              <div *ngIf="isView" class="bp-readonly-value">
                {{ form.parent_item_id ? derivedFromName(form.parent_item_id) : '—' }}
              </div>
            </div>
          </div>

          <div class="bp-helper-text" *ngIf="!isView">
            Derived = born from another item. Parent = variant of a product family.
          </div>

          <div class="bp-field">
            <label class="bp-field-label">
              Tags
              <span *ngIf="!isView" class="bp-field-hint-inline">— press Enter to add</span>
            </label>
            <p-chips *ngIf="!isView" [(ngModel)]="form.tags"
                     styleClass="w-full bp-input-edit"
                     [allowDuplicate]="false"
                     [addOnBlur]="true"
                     placeholder="e.g. led, screen, rental...">
            </p-chips>
            <div *ngIf="isView" class="bp-readonly-chips">
              <span *ngFor="let tag of form.tags" class="bp-readonly-chip">{{ tag }}</span>
              <span *ngIf="!form.tags.length" class="bp-readonly-value">—</span>
            </div>
          </div>

          <div class="bp-field">
            <label class="bp-field-label">External URL</label>
            <input *ngIf="!isView" pInputText
                   [(ngModel)]="form.external_url"
                   class="w-full bp-input-edit"
                   placeholder="https://..."/>
            <div *ngIf="isView" class="bp-readonly-value">
              <a *ngIf="form.external_url" [href]="form.external_url"
                 target="_blank" rel="noopener" class="bp-readonly-link">
                {{ form.external_url }}
              </a>
              <span *ngIf="!form.external_url">—</span>
            </div>
          </div>

        </ng-container>

        <!-- ═══════════════ TAB 3: IMAGES ═══════════════ -->
        <ng-container *ngIf="activeTab === 'images'">

          <!-- Add mode — items must be saved first so the upload panel has
               an entityId for the storage path. Keep this scoped to add
               mode; edit + view always render the grid. -->
          <div *ngIf="mode === 'add'" class="bp-images-empty-state">
            <lucide-icon name="image" [size]="22" class="bp-images-empty-icon"></lucide-icon>
            <div class="bp-images-empty-title">Save the item first</div>
            <div class="bp-images-empty-sub">
              Image uploads are stored against the item ID. Save your item, then re-open
              it from the catalogue to manage its image gallery.
            </div>
          </div>

          <ng-container *ngIf="mode !== 'add'">
            <div class="bp-images-helper">
              First image is the <strong>Hero</strong> — shown on cards and the detail panel.
              Up to {{ imageSlotCount }} images per item.
            </div>

            <div class="bp-images-grid">
              <ng-container *ngFor="let slot of imageSlots; let i = index">
                <!-- Empty slot — clickable add zone (suppressed in view). -->
                <button *ngIf="!form.images[i] && !isView"
                        type="button"
                        class="bp-img-slot bp-img-slot--empty"
                        (click)="openImageUpload(i)">
                  <lucide-icon name="plus" [size]="18"></lucide-icon>
                  <span class="bp-img-slot-label">{{ i === 0 ? 'Add hero' : 'Add image' }}</span>
                </button>

                <!-- View-mode empty slot — non-clickable placeholder. -->
                <div *ngIf="!form.images[i] && isView"
                     class="bp-img-slot bp-img-slot--empty bp-img-slot--readonly">
                  <lucide-icon name="image" [size]="16"></lucide-icon>
                </div>

                <!-- Filled slot — thumbnail + remove × (suppressed in view). -->
                <div *ngIf="form.images[i] as img"
                     class="bp-img-slot bp-img-slot--filled"
                     [class.bp-img-slot--hero]="i === 0"
                     [class.bp-img-slot--readonly]="isView"
                     (click)="!isView && openImageUpload(i)"
                     [attr.title]="isView ? null : 'Click to replace'">
                  <img [src]="img.url" [alt]="form.name || 'item image'"/>
                  <span *ngIf="i === 0" class="bp-img-slot-hero-tag">HERO</span>
                  <button *ngIf="!isView"
                          type="button"
                          class="bp-img-slot-remove"
                          (click)="removeImage($event, i)"
                          title="Remove image">
                    <i class="pi pi-times"></i>
                  </button>
                </div>
              </ng-container>
            </div>
          </ng-container>

        </ng-container>

      </div>

      <ng-template pTemplate="footer">
        <div class="bp-drawer-footer-row">
          <ng-container *ngIf="!isView">
            <p-button label="Cancel"
                      styleClass="bp-btn-cancel"
                      (onClick)="onCancel()">
            </p-button>
            <p-button [label]="saveLabel"
                      styleClass="bp-btn-save"
                      [disabled]="!isValid() || saving"
                      [loading]="saving"
                      (onClick)="onSave()">
            </p-button>
          </ng-container>
          <ng-container *ngIf="isView">
            <p-button label="Close"
                      styleClass="bp-btn-save"
                      (onClick)="onCancel()">
            </p-button>
          </ng-container>
        </div>
      </ng-template>
    </p-sidebar>

    <!-- Image upload modal — mounted only when a slot is being filled. The
         panel is itself a <p-dialog> (via app-modal), so we just toggle the
         *ngIf. type='item' + entityId=this.item.id targets the items bucket
         and PATCHes image_url on save (we capture the URL into our local
         images[] array on the way past).
         v1.34b: multi=true so the user can pick several Unsplash images in
         one search; the drawer fills the next N empty slots on emit. -->
    <app-image-upload-panel
      *ngIf="imageUploadOpen && item"
      [entityId]="item.id"
      type="item"
      [multi]="true"
      [existingCoverUrl]="existingSlotUrl()"
      [existingImageDisplay]="form.image_display"
      (imagesUpdated)="onImageUploaded($event)"
      (closed)="closeImageUpload()">
    </app-image-upload-panel>

    <p-toast></p-toast>
  `,
  styles: [`
    :host { display: contents; }

    /* ── DRAWER TABS ─────────────────────────────────────────────────
       Underline tabs matching the project / supplier hero tab pattern.
       Live in the drawer body's container, not on the parchment header.
       Tab bar is sticky-ish — it stays put while the body scrolls. */
    .bp-drawer-tabs {
      display: flex; gap: 0;
      padding: 0 24px;
      border-bottom: 0.5px solid var(--color-border);
      background: var(--color-surface);
    }
    .bp-drawer-tab {
      padding: 12px 16px;
      font-size: 13px;
      font-weight: 500;
      color: var(--color-text-muted);
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      font-family: var(--font-body);
      transition: color 0.15s, border-color 0.15s;
      margin-bottom: -0.5px;
    }
    .bp-drawer-tab:hover { color: var(--color-text-primary); }
    .bp-drawer-tab.active {
      color: var(--theme-accent);
      border-bottom-color: var(--theme-accent);
    }

    /* Section headers — uppercase 10px with bottom rule (kept for legacy
       in-section dividers; v1.17 the tabs replace top-level sections). */
    .bp-section-h {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.1em;
      color: var(--color-text-muted);
      text-transform: uppercase;
      padding: 14px 0 6px;
      margin: 6px 0 10px;
      border-bottom: 0.5px solid var(--color-border);
      font-family: var(--font-body);
    }

    .bp-field { margin-bottom: 14px; }
    .bp-field-label {
      display: block;
      font-size: 11px;
      font-weight: 500;
      color: var(--color-text-secondary);
      margin-bottom: 4px;
      font-family: var(--font-body);
    }
    .bp-field-hint {
      font-size: 11px;
      color: var(--color-text-muted);
      margin-top: 4px;
      line-height: 1.4;
    }
    .bp-field-hint-inline {
      font-weight: 400;
      color: var(--color-text-muted);
    }

    .bp-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .bp-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }

    /* ── READ-ONLY DISPLAY ──────────────────────────────────────────
       View mode replaces inputs with text. We keep the visual rhythm
       (height, spacing) so the layout doesn't jitter when toggling. */
    .bp-readonly-value {
      font-size: 13px;
      color: var(--color-text-primary);
      padding: 7px 0;
      line-height: 1.5;
      font-family: var(--font-body);
      min-height: 32px;
    }
    .bp-readonly-value--multiline {
      white-space: pre-wrap;
      padding: 8px 0;
    }
    .bp-readonly-value--accent {
      color: var(--theme-accent);
      font-weight: 600;
    }
    .bp-readonly-link {
      color: var(--theme-accent);
      text-decoration: none;
      word-break: break-all;
    }
    .bp-readonly-link:hover { text-decoration: underline; }
    .bp-readonly-chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 0; }
    .bp-readonly-chip {
      display: inline-flex; align-items: center;
      padding: 3px 10px;
      font-size: 11px;
      font-weight: 500;
      color: var(--theme-accent);
      background: var(--theme-bg);
      border: 0.5px solid var(--theme-border);
      border-radius: 20px;
      font-family: var(--font-body);
    }
    .bp-tier-badge {
      display: inline-flex; align-items: center;
      padding: 4px 12px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--color-surface);
      background: var(--theme-accent);
      border-radius: 20px;
      font-family: var(--font-body);
    }

    /* Tier pills */
    .bp-tier-pills { display: flex; gap: 6px; }
    .bp-tier-pill {
      flex: 1;
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 500;
      border-radius: 20px;
      border: 0.5px solid var(--color-border);
      background: transparent;
      color: var(--color-text-secondary);
      cursor: pointer;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
      font-family: var(--font-body);
    }
    .bp-tier-pill:hover { border-color: var(--theme-accent); color: var(--theme-accent); }
    .bp-tier-pill--active {
      background: var(--theme-accent);
      color: var(--color-surface);
      border-color: var(--theme-accent);
    }
    .bp-tier-pill--active:hover {
      background: var(--theme-accent);
      color: var(--color-surface);
    }

    /* Money inputs */
    .bp-money-input { position: relative; display: flex; align-items: center; }
    .bp-money-prefix {
      position: absolute;
      left: 10px;
      font-size: 13px;
      color: var(--color-text-muted);
      pointer-events: none;
    }
    .bp-input-money { padding-left: 22px !important; }
    .bp-money-input--accent .bp-money-prefix { color: var(--theme-accent); font-weight: 600; }
    :host ::ng-deep .bp-input-money--accent { border-color: var(--theme-accent) !important; }

    /* Helper text below pricing */
    .bp-helper-text {
      font-size: 12px;
      color: var(--color-text-secondary);
      line-height: 1.5;
      margin: 6px 0 12px;
    }
    .bp-helper-text strong { color: var(--color-text-primary); font-weight: 600; }

    /* Summary card */
    .bp-summary-card {
      background: var(--theme-bg);
      border: 0.5px solid var(--theme-border);
      border-radius: 10px;
      padding: 12px 14px;
      margin-bottom: 6px;
    }
    .bp-summary-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 4px 0;
      font-size: 12px;
    }
    .bp-summary-row + .bp-summary-row {
      border-top: 0.5px solid var(--theme-border);
      padding-top: 8px;
      margin-top: 4px;
    }
    .bp-summary-label { color: var(--color-text-muted); }
    .bp-summary-value { color: var(--color-text-primary); font-weight: 500; }
    .bp-summary-value--big {
      font-family: var(--font-display);
      font-size: 18px;
      font-weight: 400;
    }

    /* Derived-from info bar */
    .bp-derived-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--theme-bg);
      border: 0.5px solid var(--theme-border);
      border-radius: 8px;
      padding: 8px 12px;
      margin-bottom: 14px;
      font-size: 12px;
      color: var(--color-text-secondary);
    }
    .bp-derived-name { color: var(--theme-accent); font-weight: 600; }

    /* ── IMAGES TAB ─────────────────────────────────────────────────
       4-column × 2-row grid of square slots. Empty slots show a dashed
       border + plus icon; filled slots show a thumbnail with a remove ×.
       The first slot wears a HERO tag — its image is the one written
       back to image_url on save. */
    .bp-images-helper {
      font-size: 12px;
      color: var(--color-text-secondary);
      line-height: 1.5;
      margin-bottom: 14px;
    }
    .bp-images-helper strong { color: var(--theme-accent); font-weight: 600; }

    .bp-images-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      grid-template-rows: repeat(2, 1fr);
      gap: 10px;
    }
    .bp-img-slot {
      aspect-ratio: 1 / 1;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 4px;
      position: relative;
      overflow: hidden;
      background: var(--color-surface);
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
      font-family: var(--font-body);
      padding: 0;
    }
    .bp-img-slot--empty {
      border: 1.5px dashed var(--color-border);
      color: var(--color-text-muted);
    }
    .bp-img-slot--empty:hover {
      border-color: var(--theme-accent);
      color: var(--theme-accent);
      background: var(--theme-bg);
    }
    .bp-img-slot--readonly { cursor: default; }
    .bp-img-slot--readonly:hover {
      border-color: var(--color-border);
      color: var(--color-text-muted);
      background: var(--color-surface);
    }
    .bp-img-slot-label {
      font-size: 10px;
      font-weight: 500;
      letter-spacing: 0.04em;
    }
    .bp-img-slot--filled {
      border: 0.5px solid var(--color-border);
    }
    .bp-img-slot--filled img {
      width: 100%; height: 100%;
      object-fit: cover;
      display: block;
    }
    .bp-img-slot--hero { border-color: var(--theme-accent); }
    .bp-img-slot-hero-tag {
      position: absolute;
      bottom: 6px; left: 6px;
      font-size: 9px; font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--color-surface);
      background: var(--theme-accent);
      padding: 2px 6px;
      border-radius: 3px;
    }
    .bp-img-slot-remove {
      position: absolute;
      top: 4px; right: 4px;
      width: 22px; height: 22px;
      border-radius: 50%;
      background: var(--color-surface);
      border: 0.5px solid var(--color-border);
      color: var(--color-text-secondary);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      font-size: 10px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.12);
      transition: color 0.15s, border-color 0.15s;
    }
    .bp-img-slot-remove:hover {
      color: var(--color-danger);
      border-color: var(--color-danger);
    }

    /* Add-mode notice for the Images tab */
    .bp-images-empty-state {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      text-align: center;
      padding: 40px 20px;
      gap: 10px;
    }
    .bp-images-empty-icon { color: var(--color-text-muted); }
    .bp-images-empty-title {
      font-family: var(--font-display);
      font-size: 16px;
      color: var(--color-text-primary);
    }
    .bp-images-empty-sub {
      font-size: 12px;
      color: var(--color-text-muted);
      line-height: 1.55;
      max-width: 320px;
    }

    /* Footer row */
    .bp-drawer-footer-row {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  `]
})
export class ItemDrawerComponent implements OnInit, OnChanges {
  /** v1.17: explicit mode replaces the older item-is-null sentinel.
      - 'add'  → empty form, save → POST /items
      - 'edit' → pre-populated, save → PUT /items/:id
      - 'view' → pre-populated, all inputs disabled, Close button only.
      The legacy behaviour (mode='add' when item is null, 'edit' otherwise)
      is still respected if parents haven't yet been updated — see
      ngOnChanges. */
  @Input() mode: ItemDrawerMode = 'add';

  /** null in add mode; populated Item in edit/view mode. */
  @Input() item: Item | null = null;
  @Input() visible = false;
  /** Optional seed values applied in ADD mode only. Used to pre-populate
      the category dropdown(s) from the parent's current view filter — e.g.
      the supplier catalogue page passes the user's active category so a
      new item lands in the right place without re-typing.
      Ignored when `item` is set (edit/view modes populate from the item). */
  @Input() prefill: { category_id?: string; subcategory_id?: string } | null = null;

  @Output() saved = new EventEmitter<Item>();
  @Output() cancelled = new EventEmitter<void>();
  @Output() visibleChange = new EventEmitter<boolean>();

  form: ItemForm = this.emptyForm();
  units: Codelist[] = [];
  timeUnits: Codelist[] = [];
  topCategories: Category[] = [];
  allCategories: Category[] = [];
  subcategories: Category[] = [];
  lineageOptions: { id: string; name: string }[] = [];
  currentOrg: Org | null = null;
  saving = false;

  /** Active tab inside the drawer — Details by default. Reset to Details
      whenever the drawer is re-opened with a new item so the user lands
      where they expect. */
  activeTab: DrawerTab = 'details';

  /** Image upload state — when a slot is clicked we open the panel and
      remember which slot the returned URL should fill. */
  imageUploadOpen = false;
  uploadSlotIndex = 0;

  readonly tierOptions = TIER_OPTIONS;
  readonly leadTimeUnits = [
    { value: 'days' as LeadTimeUnit,  label: 'Days' },
    { value: 'weeks' as LeadTimeUnit, label: 'Weeks' }
  ];
  readonly imageSlotCount = IMAGE_SLOT_COUNT;
  /** Static array used as ngFor iterator — gives us 8 indices to lay out
      the grid regardless of how many images the item has. */
  readonly imageSlots = Array.from({ length: IMAGE_SLOT_COUNT });

  constructor(
    private codelistSvc: CodelistService,
    private categorySvc: CategoryService,
    private itemSvc: ItemService,
    private orgSvc: OrgService,
    private msg: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    forkJoin({
      units: this.codelistSvc.getByName('item_unit'),
      timeUnits: this.codelistSvc.getByName('item_time_unit'),
      categories: this.categorySvc.getAll('catalogue'),
      org: this.orgSvc.getCurrentOrg()
    }).subscribe(({ units, timeUnits, categories, org }) => {
      this.units = units || [];
      this.timeUnits = timeUnits || [];
      this.allCategories = categories || [];
      this.topCategories = this.allCategories.filter(c => !c.parent_id);
      this.currentOrg = org || null;
      if (this.currentOrg) this.loadLineageOptions(this.currentOrg.id);
      this.populateForm();
      this.cdr.markForCheck();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    // When `item` swaps without re-mounting (parent reuses the same drawer
    // instance for add then edit), repopulate from the new value once the
    // dropdown sources have loaded.
    if (changes['item'] && !changes['item'].firstChange) {
      this.populateForm();
      if (this.currentOrg) this.loadLineageOptions(this.currentOrg.id);
    }
    // When `prefill` changes while in add mode (item still null), re-seed
    // the form. This catches the supplier-detail flow where the parent
    // recomputes prefill from the current grid filter before each Add.
    if (changes['prefill'] && !changes['prefill'].firstChange && this.mode === 'add') {
      this.populateForm();
    }
    // When `mode` changes (parent toggles view↔edit on the same item),
    // reset the active tab so the user lands on Details.
    if (changes['mode'] && !changes['mode'].firstChange) {
      this.activeTab = 'details';
    }
    // When the drawer opens, default to the Details tab regardless of
    // previous state.
    if (changes['visible'] && changes['visible'].currentValue
        && !changes['visible'].previousValue) {
      this.activeTab = 'details';
    }
  }

  // ── Mode helpers ─────────────────────────────────────────────────────

  /** True when the drawer should render every field as read-only text. */
  get isView(): boolean { return this.mode === 'view'; }

  /** Title rendered in the parchment header. */
  get headerTitle(): string {
    if (this.mode === 'view') return 'Item details';
    if (this.mode === 'edit') return 'Edit item';
    return 'Add item';
  }

  /** Footer button label for save (edit vs add). */
  get saveLabel(): string {
    return this.mode === 'edit' ? 'Save changes' : 'Save item';
  }

  // ── Form lifecycle ───────────────────────────────────────────────────

  private emptyForm(): ItemForm {
    return {
      name: '',
      description: '',
      category_id: null,
      subcategory_id: null,
      tier: null,
      lead_time_value: null,
      lead_time_unit: 'days',
      unit: null,
      time_unit: null,
      base_price: null,
      min_price: null,
      max_price: null,
      derived_from_id: null,
      parent_item_id: null,
      image_url: null,
      image_display: 'cover',
      tags: [],
      external_url: null,
      images: []
    };
  }

  /** Build the local form.images[] from the item we're editing/viewing.
      Prefers the new `images` JSONB array; falls back to `image_url`
      (single-image legacy) so older items still render an image in the
      drawer's hero slot. */
  private imagesFromItem(item: Item): ItemImage[] {
    const raw = (item as any).images;
    if (Array.isArray(raw) && raw.length) {
      return raw
        .filter((r: any) => r && r.url)
        .map((r: any, i: number) => ({
          url: r.url,
          sort_order: typeof r.sort_order === 'number' ? r.sort_order : i,
          is_hero: !!r.is_hero || i === 0
        }))
        .sort((a, b) => a.sort_order - b.sort_order)
        .slice(0, IMAGE_SLOT_COUNT);
    }
    if (item.image_url) {
      return [{ url: item.image_url, sort_order: 0, is_hero: true }];
    }
    return [];
  }

  private populateForm(): void {
    if (this.mode === 'add') {
      this.form = this.emptyForm();
      this.subcategories = [];
      // Apply any add-mode prefill. The caller may pass either a top-level
      // category id or a subcategory id (e.g. supplier-detail's grid uses
      // a flat list and stores the most-specific id in activeCategory).
      // We resolve to the drawer's split shape using allCategories — same
      // logic the edit-mode branch below uses.
      if (this.prefill) {
        // Local const so the narrowing survives across closures (the
        // `c => c.id === ...` arrow body re-widens this.prefill in TS).
        const pre = this.prefill;
        let category_id: string | null = null;
        let subcategory_id: string | null = null;

        if (pre.subcategory_id) {
          subcategory_id = pre.subcategory_id;
          const sub = this.allCategories.find(c => c.id === subcategory_id);
          category_id = sub?.parent_id || pre.category_id || null;
        } else if (pre.category_id) {
          const cat = this.allCategories.find(c => c.id === pre.category_id);
          if (cat?.parent_id) {
            // Caller passed a subcategory id in category_id — split it.
            category_id = cat.parent_id;
            subcategory_id = cat.id;
          } else {
            // Top-level (or unresolved — fall back to as-is).
            category_id = pre.category_id;
          }
        }

        if (category_id) {
          this.form.category_id = category_id;
          this.refreshSubcategories(category_id);
        }
        if (subcategory_id) {
          this.form.subcategory_id = subcategory_id;
        }
      }
      return;
    }

    // edit / view modes — populate from this.item.
    if (!this.item) {
      // Defensive: parent set mode=edit/view but no item yet. Leave the
      // form empty until the item arrives.
      this.form = this.emptyForm();
      this.subcategories = [];
      return;
    }

    // Split DB category_id back into category/subcategory.
    const itemCat = this.allCategories.find(c => c.id === this.item!.category_id);
    let category_id: string | null = null;
    let subcategory_id: string | null = null;
    if (itemCat) {
      if (itemCat.parent_id) {
        // Item is on a child category → store parent as category, child as subcategory.
        category_id = itemCat.parent_id;
        subcategory_id = itemCat.id;
      } else {
        category_id = itemCat.id;
      }
    }

    // Lead time — display in days unless evenly divisible by 7 and > 7.
    let leadValue: number | null = this.item.lead_time_days ?? null;
    let leadUnit: LeadTimeUnit = 'days';
    if (leadValue != null && leadValue > 7 && leadValue % 7 === 0) {
      leadValue = leadValue / 7;
      leadUnit = 'weeks';
    }

    this.form = {
      name: this.item.name || '',
      description: this.item.description || '',
      category_id,
      subcategory_id,
      tier: (this.item.tier as TierValue) ?? null,
      lead_time_value: leadValue,
      lead_time_unit: leadUnit,
      unit: this.item.unit ?? null,
      time_unit: this.item.time_unit ?? null,
      base_price: this.item.base_price ?? null,
      min_price: this.item.min_price ?? null,
      max_price: this.item.max_price ?? null,
      derived_from_id: this.item.derived_from_id ?? null,
      parent_item_id: this.item.parent_item_id ?? null,
      image_url: this.item.image_url ?? null,
      image_display: (this.item.image_display === 'contain') ? 'contain' : 'cover',
      tags: Array.isArray(this.item.tags) ? [...this.item.tags] : [],
      external_url: this.item.external_url ?? null,
      images: this.imagesFromItem(this.item)
    };
    if (category_id) this.refreshSubcategories(category_id);
  }

  private loadLineageOptions(orgId: string): void {
    this.itemSvc.getByOrg(orgId).subscribe(rows => {
      const editingId = this.item?.id;
      this.lineageOptions = (rows || [])
        .filter(r => r.id !== editingId)
        .map(r => ({ id: r.id, name: r.name }));
      this.cdr.markForCheck();
    });
  }

  // ── Field interactions ───────────────────────────────────────────────

  onCategoryChange(): void {
    this.form.subcategory_id = null;
    if (this.form.category_id) this.refreshSubcategories(this.form.category_id);
    else this.subcategories = [];
  }

  private refreshSubcategories(parentId: string): void {
    this.subcategories = this.allCategories.filter(c => c.parent_id === parentId);
  }

  toggleTier(value: 'basic' | 'mid' | 'premium'): void {
    if (this.isView) return;
    this.form.tier = this.form.tier === value ? null : value;
  }

  unitLabel(code: string | null): string {
    return code ? this.codelistSvc.getDisplay(code) : '';
  }

  tierLabel(tier: TierValue): string {
    return this.tierOptions.find(t => t.value === tier)?.label || '';
  }

  /** Resolve a category id back to its display name. Used by view mode
      where we don't render the dropdown but still need the human label. */
  categoryLabel(id: string | null): string {
    if (!id) return '';
    return this.allCategories.find(c => c.id === id)?.name || '';
  }

  derivedFromName(id: string): string {
    return this.lineageOptions.find(o => o.id === id)?.name || '…';
  }

  // ── Images tab ───────────────────────────────────────────────────────

  /** Click handler for an image slot (empty or filled). Opens the upload
      panel and remembers which slot the returned URL should fill. */
  openImageUpload(slotIndex: number): void {
    if (this.isView || this.mode === 'add') return;
    this.uploadSlotIndex = slotIndex;
    this.imageUploadOpen = true;
    this.cdr.markForCheck();
  }

  closeImageUpload(): void {
    this.imageUploadOpen = false;
    this.cdr.markForCheck();
  }

  /** Resolve the URL already in the slot being filled — passed to the
      ImageUploadPanel as `existingCoverUrl` so the user sees their current
      image and can choose to replace it. */
  existingSlotUrl(): string {
    const slot = this.form.images[this.uploadSlotIndex];
    return slot && slot.url ? slot.url : '';
  }

  /** Capture the URL(s) ImageUploadPanel emits and write to form.images[].
      v1.34b: in multi mode the panel emits `coverUrls[]` — fill the slot
      we opened plus the next empty slots in order. The drawer's own save
      flow PATCHes the full images[] array, so no per-image server hit. */
  onImageUploaded(event: { coverUrl: string; coverUrls?: string[]; imageDisplay?: 'cover' | 'contain' }): void {
    if (!event.coverUrl && !(event.coverUrls && event.coverUrls.length)) {
      // No URL returned (e.g. user removed the existing image). Treat as
      // a remove on the slot we opened.
      this.removeImageAt(this.uploadSlotIndex);
      this.closeImageUpload();
      return;
    }
    const urls = (event.coverUrls && event.coverUrls.length) ? event.coverUrls : [event.coverUrl];
    const updated: ItemImage[] = [...this.form.images];
    let cursor = this.uploadSlotIndex;
    for (const url of urls) {
      // Find the next empty slot starting at cursor (the slot we opened).
      // If the targeted slot already has content, overwrite it with the
      // first URL and continue placing subsequent URLs in empty slots.
      while (cursor < this.imageSlotCount && updated[cursor] && url !== urls[0]) cursor++;
      if (cursor >= this.imageSlotCount) break;
      updated[cursor] = { url, sort_order: cursor, is_hero: cursor === 0 };
      cursor++;
    }
    this.form.images = this.normaliseImages(updated);
    if (event.imageDisplay) this.form.image_display = event.imageDisplay;
    this.closeImageUpload();
  }

  /** Remove an image from a specific slot. Subsequent images keep their
      slot — we don't shift up so the user's mental model of "this is the
      hero" stays stable until they explicitly reorder. */
  removeImage(event: MouseEvent, slotIndex: number): void {
    event.stopPropagation();
    this.removeImageAt(slotIndex);
  }
  private removeImageAt(slotIndex: number): void {
    const updated: ItemImage[] = [...this.form.images];
    updated[slotIndex] = undefined as any;
    this.form.images = this.normaliseImages(updated);
    this.cdr.markForCheck();
  }

  /** Compact a sparse images[] array down to a dense ordered list,
      re-stamp sort_order, and set is_hero on the first entry. */
  private normaliseImages(input: (ItemImage | undefined)[]): ItemImage[] {
    const filtered = input.filter((i): i is ItemImage => !!i && !!i.url);
    return filtered.map((img, i) => ({
      url: img.url,
      sort_order: i,
      is_hero: i === 0
    }));
  }

  // ── Validation ───────────────────────────────────────────────────────

  isValid(): boolean {
    if (this.isView) return false; // view mode never saves
    return !!(
      this.form.name && this.form.name.trim().length > 0 &&
      this.form.category_id &&
      this.form.unit &&
      this.form.base_price != null && this.form.base_price > 0
    );
  }

  // ── Save / cancel ────────────────────────────────────────────────────

  onSave(): void {
    if (this.isView || !this.isValid()) return;
    this.saving = true;
    this.cdr.markForCheck();

    // The item's stored category_id is the most specific one — subcategory
    // if set, else the top-level category.
    const categoryId = this.form.subcategory_id || this.form.category_id;

    // Lead time: persist in days, multiplying by 7 when user picked Weeks.
    let leadTimeDays: number | null = this.form.lead_time_value;
    if (leadTimeDays != null && this.form.lead_time_unit === 'weeks') {
      leadTimeDays = leadTimeDays * 7;
    }

    // Compute the legacy image_url from the new images[] so the server
    // doesn't need to figure it out — first is_hero, else images[0].
    // (Server also computes this defensively; we send it explicitly so
    // the response back to the parent reflects the right value without
    // a re-fetch.)
    const heroUrl = this.form.images.find(i => i.is_hero)?.url
                  ?? this.form.images[0]?.url
                  ?? null;

    const payload: Partial<Item> & {
      derived_from_id?: string | null;
      parent_item_id?: string | null;
      external_url?: string | null;
      images?: ItemImage[];
    } = {
      name: this.form.name.trim(),
      description: this.form.description || '',
      category_id: categoryId || undefined,
      unit: this.form.unit || undefined,
      time_unit: this.form.time_unit,
      tier: this.form.tier,
      lead_time_days: leadTimeDays ?? undefined,
      base_price: this.form.base_price as number,
      min_price: this.form.min_price ?? undefined,
      max_price: this.form.max_price ?? undefined,
      derived_from_id: this.form.derived_from_id,
      parent_item_id: this.form.parent_item_id,
      image_url: heroUrl,
      image_display: this.form.image_display,
      tags: this.form.tags,
      external_url: this.form.external_url,
      images: this.form.images
    };

    let op$: Observable<Item>;
    if (this.mode === 'edit' && this.item) {
      op$ = this.itemSvc.update(this.item.id, payload);
    } else {
      // add mode
      if (!this.currentOrg) {
        this.saving = false;
        this.msg.add({
          severity: 'error',
          summary: 'No current org',
          detail: 'Cannot save item without an org context.'
        });
        this.cdr.markForCheck();
        return;
      }
      (payload as any).org_id = this.currentOrg.id;
      op$ = this.itemSvc.create(payload);
    }

    op$.subscribe({
      next: (result: Item) => {
        this.saving = false;
        this.msg.add({
          severity: 'success',
          summary: this.mode === 'edit' ? 'Item updated' : 'Item created',
          detail: result.name,
          life: 3000
        });
        this.saved.emit(result);
        this.close();
        this.cdr.markForCheck();
      },
      error: () => {
        this.saving = false;
        this.msg.add({
          severity: 'error',
          summary: this.mode === 'edit' ? 'Failed to update item' : 'Failed to create item',
          life: 4000
        });
        this.cdr.markForCheck();
      }
    });
  }

  onCancel(): void {
    this.cancelled.emit();
    this.close();
  }

  onVisibleChange(v: boolean): void {
    this.visible = v;
    this.visibleChange.emit(v);
  }

  private close(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }
}
