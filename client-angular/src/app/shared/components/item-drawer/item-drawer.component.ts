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
import { LucideAngularModule, GitBranch, X } from 'lucide-angular';
import { forkJoin, Observable } from 'rxjs';

import { Item, Codelist, Category, Org } from '../../../models';
import { CodelistService } from '../../../core/services/codelist.service';
import { CategoryService } from '../../../core/services/category.service';
import { ItemService } from '../../../core/services/item.service';
import { OrgService } from '../../../core/services/org.service';
import { GbpPipe } from '../../pipes/gbp.pipe';
import { MarkdownEditorComponent } from '../markdown-editor/markdown-editor.component';

type LeadTimeUnit = 'days' | 'weeks';
type TierValue = 'basic' | 'mid' | 'premium' | null;

interface TierOption { value: 'basic' | 'mid' | 'premium'; label: string; }

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
}

const TIER_OPTIONS: TierOption[] = [
  { value: 'basic',   label: 'Core' },
  { value: 'mid',     label: 'Signature' },
  { value: 'premium', label: 'Premium' }
];

@Component({
  selector: 'app-item-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule,
    SidebarModule, ButtonModule, InputTextModule, InputNumberModule,
    DropdownModule, ChipsModule, ToastModule,
    LucideAngularModule,
    GbpPipe, MarkdownEditorComponent
  ],
  providers: [MessageService],
  template: `
    <p-sidebar [(visible)]="visible"
               (visibleChange)="onVisibleChange($event)"
               position="right"
               styleClass="bp-drawer"
               [style]="{width:'480px'}"
               [showCloseIcon]="false"
               (onHide)="onCancel()">

      <ng-template pTemplate="header">
        <div class="bp-drawer-header-row">
          <div class="bp-drawer-header">
            <span class="bp-drawer-label">CATALOGUE</span>
            <div class="bp-drawer-title">{{ item ? 'Edit item' : 'Add item' }}</div>
          </div>
          <button class="bp-icon-btn" (click)="onCancel()" title="Close">
            <i class="pi pi-times"></i>
          </button>
        </div>
      </ng-template>

      <div class="bp-drawer-body">

        <!-- Derived-from info bar -->
        <div *ngIf="form.derived_from_id as dfId" class="bp-derived-bar">
          <lucide-icon name="git-branch" [size]="14"></lucide-icon>
          <span class="bp-derived-text">
            Derived from
            <span class="bp-derived-name">{{ derivedFromName(dfId) }}</span>
          </span>
        </div>

        <!-- ═══ DETAILS ═══ -->
        <div class="bp-section-h">DETAILS</div>

        <div class="bp-field">
          <label class="bp-field-label">Item name *</label>
          <input pInputText
                 [(ngModel)]="form.name"
                 class="w-full bp-input-edit"
                 placeholder='e.g. 55" LED TV Screen'/>
        </div>

        <div class="bp-field">
          <label class="bp-field-label">Description</label>
          <app-markdown-editor
            [(value)]="form.description"
            [showLabel]="false"
            [rows]="6"
            placeholder="Describe what's included...">
          </app-markdown-editor>
        </div>

        <div class="bp-grid-2">
          <div class="bp-field">
            <label class="bp-field-label">Category *</label>
            <p-dropdown [(ngModel)]="form.category_id"
                        [options]="topCategories"
                        optionLabel="name"
                        optionValue="id"
                        (onChange)="onCategoryChange()"
                        styleClass="w-full bp-input-edit"
                        placeholder="Select category">
            </p-dropdown>
          </div>
          <div class="bp-field">
            <label class="bp-field-label">Subcategory</label>
            <p-dropdown [(ngModel)]="form.subcategory_id"
                        [options]="subcategories"
                        optionLabel="name"
                        optionValue="id"
                        [disabled]="!form.category_id || subcategories.length === 0"
                        [showClear]="true"
                        styleClass="w-full bp-input-edit"
                        placeholder="None">
            </p-dropdown>
          </div>
        </div>

        <div class="bp-field">
          <label class="bp-field-label">Tier</label>
          <div class="bp-tier-pills">
            <button *ngFor="let t of tierOptions"
                    type="button"
                    class="bp-tier-pill"
                    [class.bp-tier-pill--active]="form.tier === t.value"
                    (click)="toggleTier(t.value)">
              {{ t.label }}
            </button>
          </div>
        </div>

        <div class="bp-field">
          <label class="bp-field-label">Lead time</label>
          <div class="bp-grid-2">
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
        </div>

        <!-- ═══ PRICING ═══ -->
        <div class="bp-section-h">PRICING</div>

        <div class="bp-grid-2">
          <div class="bp-field">
            <label class="bp-field-label">Unit *</label>
            <p-dropdown [(ngModel)]="form.unit"
                        [options]="units"
                        optionLabel="label"
                        optionValue="code"
                        styleClass="w-full bp-input-edit"
                        placeholder="Select unit">
            </p-dropdown>
          </div>
          <div class="bp-field">
            <label class="bp-field-label">Time unit</label>
            <p-dropdown [(ngModel)]="form.time_unit"
                        [options]="timeUnits"
                        optionLabel="label"
                        optionValue="code"
                        [showClear]="true"
                        styleClass="w-full bp-input-edit"
                        placeholder="None">
            </p-dropdown>
          </div>
        </div>

        <div class="bp-grid-3">
          <div class="bp-field">
            <label class="bp-field-label">Min price</label>
            <div class="bp-money-input">
              <span class="bp-money-prefix">£</span>
              <input pInputText
                     type="number"
                     min="0"
                     [(ngModel)]="form.min_price"
                     class="w-full bp-input-edit bp-input-money"
                     placeholder="0"/>
            </div>
          </div>
          <div class="bp-field">
            <label class="bp-field-label">Ballpark *</label>
            <div class="bp-money-input bp-money-input--accent">
              <span class="bp-money-prefix">£</span>
              <input pInputText
                     type="number"
                     min="0"
                     [(ngModel)]="form.base_price"
                     class="w-full bp-input-edit bp-input-money bp-input-money--accent"
                     placeholder="0"/>
            </div>
          </div>
          <div class="bp-field">
            <label class="bp-field-label">Max price</label>
            <div class="bp-money-input">
              <span class="bp-money-prefix">£</span>
              <input pInputText
                     type="number"
                     min="0"
                     [(ngModel)]="form.max_price"
                     class="w-full bp-input-edit bp-input-money"
                     placeholder="0"/>
            </div>
          </div>
        </div>

        <div class="bp-helper-text" *ngIf="form.base_price && form.unit">
          Agencies see <strong>{{ form.base_price | gbp }} per {{ unitLabel(form.unit) }}</strong> in the marketplace.
          <span *ngIf="form.min_price && form.max_price">
            Range: {{ form.min_price | gbp }} – {{ form.max_price | gbp }}.
          </span>
        </div>

        <!-- Summary card -->
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

        <!-- ═══ LINEAGE ═══ -->
        <div class="bp-section-h">LINEAGE</div>

        <div class="bp-grid-2">
          <div class="bp-field">
            <label class="bp-field-label">Derived from</label>
            <p-dropdown [(ngModel)]="form.derived_from_id"
                        [options]="lineageOptions"
                        optionLabel="name"
                        optionValue="id"
                        [showClear]="true"
                        [filter]="true"
                        filterBy="name"
                        styleClass="w-full bp-input-edit"
                        placeholder="None">
            </p-dropdown>
          </div>
          <div class="bp-field">
            <label class="bp-field-label">Parent item</label>
            <p-dropdown [(ngModel)]="form.parent_item_id"
                        [options]="lineageOptions"
                        optionLabel="name"
                        optionValue="id"
                        [showClear]="true"
                        [filter]="true"
                        filterBy="name"
                        styleClass="w-full bp-input-edit"
                        placeholder="None (standalone)">
            </p-dropdown>
          </div>
        </div>

        <div class="bp-helper-text">
          Derived = born from another item. Parent = variant of a product family.
        </div>

        <!-- ═══ MEDIA & TAGS ═══ -->
        <div class="bp-section-h">MEDIA &amp; TAGS</div>

        <div class="bp-field">
          <label class="bp-field-label">Image URL</label>
          <input pInputText
                 [(ngModel)]="form.image_url"
                 class="w-full bp-input-edit"
                 placeholder="https://..."/>
          <div class="bp-image-preview" *ngIf="form.image_url">
            <img [src]="form.image_url" [alt]="form.name || 'preview'"
                 class="bp-image-thumb"
                 [class.bp-image-thumb--contain]="form.image_display === 'contain'"/>
          </div>
          <div class="bp-field-hint">
            Full image upload (Unsplash / drag-drop) comes next — for now paste a direct URL.
          </div>
        </div>

        <div class="bp-field">
          <label class="bp-field-label">Tags <span class="bp-field-hint-inline">— press Enter to add</span></label>
          <p-chips [(ngModel)]="form.tags"
                   styleClass="w-full bp-input-edit"
                   [allowDuplicate]="false"
                   [addOnBlur]="true"
                   placeholder="e.g. led, screen, rental...">
          </p-chips>
        </div>

        <div class="bp-field">
          <label class="bp-field-label">External URL</label>
          <input pInputText
                 [(ngModel)]="form.external_url"
                 class="w-full bp-input-edit"
                 placeholder="https://..."/>
        </div>

      </div>

      <ng-template pTemplate="footer">
        <div class="bp-drawer-footer-row">
          <p-button label="Cancel"
                    styleClass="bp-btn-cancel"
                    (onClick)="onCancel()">
          </p-button>
          <p-button [label]="item ? 'Save changes' : 'Save item'"
                    styleClass="bp-btn-save"
                    [disabled]="!isValid() || saving"
                    [loading]="saving"
                    (onClick)="onSave()">
          </p-button>
        </div>
      </ng-template>
    </p-sidebar>

    <p-toast></p-toast>
  `,
  styles: [`
    :host { display: contents; }

    /* Section headers — uppercase 10px with bottom rule, matching other drawers. */
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
    .bp-section-h:first-child { padding-top: 0; }

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

    /* Image preview */
    .bp-image-preview { margin-top: 8px; }
    .bp-image-thumb {
      width: 100%;
      max-height: 120px;
      border-radius: 8px;
      object-fit: cover;
      border: 0.5px solid var(--color-border);
    }
    .bp-image-thumb--contain { object-fit: contain; background: var(--theme-bg); }

    /* Footer row */
    .bp-drawer-footer-row {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  `]
})
export class ItemDrawerComponent implements OnInit, OnChanges {
  /** null = add mode; populated Item = edit mode. */
  @Input() item: Item | null = null;
  @Input() visible = false;
  /** Optional seed values applied in ADD mode only. Used to pre-populate
      the category dropdown(s) from the parent's current view filter — e.g.
      the supplier catalogue page passes the user's active category so a
      new item lands in the right place without re-typing.
      Ignored when `item` is set (edit mode populates from the item itself). */
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

  readonly tierOptions = TIER_OPTIONS;
  readonly leadTimeUnits = [
    { value: 'days' as LeadTimeUnit,  label: 'Days' },
    { value: 'weeks' as LeadTimeUnit, label: 'Weeks' }
  ];

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
    if (changes['prefill'] && !changes['prefill'].firstChange && !this.item) {
      this.populateForm();
    }
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
      external_url: null
    };
  }

  private populateForm(): void {
    if (!this.item) {
      this.form = this.emptyForm();
      this.subcategories = [];
      // Apply any add-mode prefill — typically the parent's active
      // category filter. category_id seeds the parent dropdown and
      // primes the subcategory list; subcategory_id (optional) seeds
      // the child dropdown afterwards.
      if (this.prefill) {
        if (this.prefill.category_id) {
          this.form.category_id = this.prefill.category_id;
          this.refreshSubcategories(this.prefill.category_id);
        }
        if (this.prefill.subcategory_id) {
          this.form.subcategory_id = this.prefill.subcategory_id;
        }
      }
      return;
    }
    // Edit mode — split DB category_id back into category/subcategory.
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
      external_url: this.item.external_url ?? null
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
    this.form.tier = this.form.tier === value ? null : value;
  }

  unitLabel(code: string | null): string {
    return code ? this.codelistSvc.getDisplay(code) : '';
  }

  derivedFromName(id: string): string {
    return this.lineageOptions.find(o => o.id === id)?.name || '…';
  }

  // ── Validation ───────────────────────────────────────────────────────

  isValid(): boolean {
    return !!(
      this.form.name && this.form.name.trim().length > 0 &&
      this.form.category_id &&
      this.form.unit &&
      this.form.base_price != null && this.form.base_price > 0
    );
  }

  // ── Save / cancel ────────────────────────────────────────────────────

  onSave(): void {
    if (!this.isValid()) return;
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

    const payload: Partial<Item> & {
      derived_from_id?: string | null;
      parent_item_id?: string | null;
      external_url?: string | null;
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
      image_url: this.form.image_url,
      image_display: this.form.image_display,
      tags: this.form.tags,
      external_url: this.form.external_url
    };

    let op$: Observable<Item>;
    if (this.item) {
      op$ = this.itemSvc.update(this.item.id, payload);
    } else {
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
          summary: this.item ? 'Item updated' : 'Item created',
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
          summary: this.item ? 'Failed to update item' : 'Failed to create item',
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
