import {
  Component, Input, Output, EventEmitter,
  ChangeDetectionStrategy, ChangeDetectorRef, OnChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import {
  LucideAngularModule, Heart, Clock, ArrowRight, Plus, SquarePen
} from 'lucide-angular';
import { GbpPipe } from '../../pipes/gbp.pipe';
import { CategoryCardHeaderComponent } from '../category-card-header/category-card-header.component';
import { ProjectItemRowComponent } from '../project-item-row/project-item-row.component';
import { ProjectItem } from '../../../models';

export type CategoryContextMode = 'project' | 'marketplace' | 'supplier';
type PanelTab = 'items' | 'wishlist' | 'brief';

/**
 * Category context panel — the right-rail surface in catalogue-grid
 * that takes over when a specific category is active.
 *
 * v1.21 design unification: shares <app-category-card-header> and
 * <app-project-item-row> with the Build/Estimate tab's expanded card.
 * Brief lives on its own tab (alongside Items and Wishlist) so the
 * panel and the Build card use the exact same three-tab structure.
 *
 * Layout (project mode):
 *   ┌─────────────────────┐ pinned
 *   │ header              │
 *   │ subtotal block      │
 *   │ Items / Wishlist /  │
 *   │   Brief tab bar     │
 *   ├─────────────────────┤ scrolls
 *   │ tab content         │
 *   ├─────────────────────┤ pinned
 *   │ footer: total + CTA │
 *   └─────────────────────┘
 */
@Component({
  selector: 'app-category-context-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule,
    InputTextareaModule, InputTextModule, ButtonModule,
    LucideAngularModule, GbpPipe,
    CategoryCardHeaderComponent, ProjectItemRowComponent
  ],
  template: `
    <div class="bp-ctx-panel">

      <!-- ── Pinned top: header + subtotal + tab bar ─────────────── -->
      <div class="bp-ctx-top">
        <app-category-card-header class="bp-ctx-head"
          [name]="category?.name"
          [iconName]="category?.icon_name"
          [selectedCount]="selectedItems.length"
          [wishlistCount]="likedItems.length"
          [cost]="subtotalAmount"
          [status]="null">
        </app-category-card-header>

        <!-- Subtotal block — project mode only. Big serif amount,
             wishlist impact, longest lead. -->
        <div class="bp-ctx-subtotal" *ngIf="context === 'project'">
          <div class="bp-ctx-sub-row">
            <span class="bp-ctx-sub-amount">{{ subtotalAmount | gbp }}</span>
            <span class="bp-ctx-sub-label">subtotal</span>
          </div>
          <div class="bp-ctx-sub-meta" *ngIf="wishlistAmount > 0 || longestLeadDays > 0">
            <span *ngIf="wishlistAmount > 0" class="bp-ctx-sub-meta-line">
              <lucide-icon name="heart" [size]="11"></lucide-icon>
              +{{ wishlistAmount | gbp }} if wishlist approved
            </span>
            <span *ngIf="longestLeadDays > 0" class="bp-ctx-sub-meta-line">
              <lucide-icon name="clock" [size]="11"></lucide-icon>
              {{ longestLeadDays }} day longest lead
            </span>
          </div>
        </div>

        <!-- Tab bar — same Items / Wishlist / Brief structure as the
             Build/Estimate expanded card. Underline accent on active. -->
        <div class="bp-ctx-tabs" *ngIf="context === 'project'">
          <button type="button"
                  class="bp-ctx-tab"
                  [class.active]="activeTab === 'items'"
                  (click)="setTab('items')">
            Items
            <span *ngIf="selectedItems.length" class="bp-ctx-tab-count">
              {{ selectedItems.length }}
            </span>
          </button>
          <button type="button"
                  class="bp-ctx-tab"
                  [class.active]="activeTab === 'wishlist'"
                  (click)="setTab('wishlist')">
            Wishlist
            <span *ngIf="likedItems.length" class="bp-ctx-tab-count">
              {{ likedItems.length }}
            </span>
          </button>
          <button type="button"
                  class="bp-ctx-tab"
                  [class.active]="activeTab === 'brief'"
                  (click)="setTab('brief')">
            Brief
          </button>
        </div>
      </div>

      <!-- ── Scrolling middle: tab content ────────────────────────── -->
      <div class="bp-ctx-body">

        <!-- ITEMS tab -->
        <ng-container *ngIf="context === 'project' && activeTab === 'items'">
          <ng-container *ngIf="selectedItems.length; else emptyItems">
            <app-project-item-row *ngFor="let item of selectedItems; trackBy: trackByItemKey"
              [item]="item"
              mode="selected"
              [compact]="true"
              (clicked)="itemClicked.emit($event)"
              (removed)="itemRemoved.emit($event)"
              (movedToWishlist)="itemMoved.emit({ item: $event, toType: 'liked' })">
            </app-project-item-row>
          </ng-container>
          <ng-template #emptyItems>
            <div class="bp-ctx-empty">
              No items added yet — use “+ Add more {{ catNameLower }}” below.
            </div>
          </ng-template>

          <!-- Item-tab footer: Add more / longest lead. -->
          <div class="bp-ctx-tab-foot">
            <button type="button"
                    class="bp-ctx-add-more"
                    (click)="browseClicked.emit()">
              <lucide-icon name="plus" [size]="13"></lucide-icon>
              Add more {{ catNameLower }}
            </button>
            <span *ngIf="longestLeadDays > 0" class="bp-ctx-lead-foot">
              <lucide-icon name="clock" [size]="11"></lucide-icon>
              Longest lead {{ longestLeadDays }} days
            </span>
          </div>
        </ng-container>

        <!-- WISHLIST tab — slightly tinted band per spec. -->
        <ng-container *ngIf="context === 'project' && activeTab === 'wishlist'">
          <div class="bp-ctx-wish-hint" *ngIf="likedItems.length">
            awaiting client approval
          </div>
          <ng-container *ngIf="likedItems.length; else emptyWish">
            <app-project-item-row *ngFor="let item of likedItems; trackBy: trackByItemKey"
              [item]="item"
              mode="wishlist"
              [compact]="true"
              (clicked)="itemClicked.emit($event)"
              (removed)="itemRemoved.emit($event)"
              (confirmed)="itemMoved.emit({ item: $event, toType: 'selected' })">
            </app-project-item-row>
          </ng-container>
          <ng-template #emptyWish>
            <div class="bp-ctx-empty">
              No wishlist items yet — heart an item to add it here.
            </div>
          </ng-template>
        </ng-container>

        <!-- BRIEF tab — inline edit, saves on blur. -->
        <ng-container *ngIf="context === 'project' && activeTab === 'brief'">
          <div class="bp-ctx-brief-field">
            <label class="bp-ctx-brief-label">BRIEF</label>
            <input pInputText
                   [(ngModel)]="briefDraft"
                   (blur)="saveBriefIfChanged()"
                   class="w-full bp-input-edit"
                   [placeholder]="'One-line requirement for ' + catNameLower + '…'"/>
          </div>
          <div class="bp-ctx-brief-empty" *ngIf="!briefDraft && !briefText">
            Add a brief for this category to share with suppliers.
          </div>
        </ng-container>

        <!-- Non-project fallback: show description + favourites copy. -->
        <ng-container *ngIf="context !== 'project'">
          <div class="bp-ctx-desc" *ngIf="!briefText && category?.description">
            {{ category.description }}
          </div>
          <ng-container *ngIf="selectedItems.length; else emptyFav">
            <app-project-item-row *ngFor="let item of selectedItems; trackBy: trackByItemKey"
              [item]="item"
              mode="selected"
              [compact]="true"
              (clicked)="itemClicked.emit($event)"
              (removed)="itemRemoved.emit($event)">
            </app-project-item-row>
          </ng-container>
          <ng-template #emptyFav>
            <div class="bp-ctx-empty">
              No favourites in this category yet.
            </div>
          </ng-template>
        </ng-container>

      </div>

      <!-- ── Pinned bottom: project total + open estimate ──────────
           Project mode only — marketplace / supplier still get the
           legacy "Browse marketplace" CTA below. -->
      <div class="bp-ctx-footer" *ngIf="context === 'project'">
        <span class="bp-ctx-footer-total">
          Project total {{ projectTotal | gbp }}
        </span>
        <button type="button"
                class="bp-ctx-footer-link"
                (click)="openEstimate.emit()">
          Open estimate
          <lucide-icon name="arrow-right" [size]="12"></lucide-icon>
        </button>
      </div>

      <div class="bp-ctx-browse"
           *ngIf="context !== 'project'"
           (click)="browseClicked.emit()">
        <lucide-icon name="plus" [size]="13"></lucide-icon>
        Browse marketplace
      </div>

    </div>
  `,
  styles: [`
    /* v1.24m: font-family pinned on :host so the panel reads in
       Libre Franklin regardless of what the catalogue-grid parent
       column inherits. Inner Playfair elements (.bp-ctx-sub-amount,
       prices in app-project-item-row, name in app-category-card-header)
       opt into --font-display explicitly. */
    :host {
      display: block;
      height: 100%;
      font-family: var(--font-body);
      color: var(--color-text-primary);
    }

    .bp-ctx-panel {
      height: 100%;
      display: flex;
      flex-direction: column;
      font-family: var(--font-body);
      background: var(--color-surface);
      border-radius: 12px;
      overflow: hidden;
    }

    /* ── Pinned top ── */
    .bp-ctx-top { flex-shrink: 0; }
    .bp-ctx-head { display: block; padding: 16px 16px 12px; }

    /* Subtotal block */
    .bp-ctx-subtotal { padding: 0 16px 14px; }
    .bp-ctx-sub-row { display: flex; align-items: baseline; gap: 8px; }
    .bp-ctx-sub-amount {
      font-family: var(--font-display);
      font-size: 28px;
      font-weight: 400;
      color: var(--color-text-primary);
      font-variant-numeric: tabular-nums;
      line-height: 1;
    }
    .bp-ctx-sub-label {
      font-size: 13px;
      color: var(--color-text-muted);
    }
    .bp-ctx-sub-meta {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px 12px;
      margin-top: 8px;
      font-size: 11.5px;
      color: var(--color-text-muted);
    }
    .bp-ctx-sub-meta-line {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    /* Tab bar — underline style, accent active. */
    .bp-ctx-tabs {
      display: flex;
      gap: 0;
      padding: 0 16px;
      border-bottom: 0.5px solid var(--color-border);
    }
    .bp-ctx-tab {
      padding: 8px 12px;
      font-size: 12.5px;
      font-weight: 500;
      color: var(--color-text-muted);
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      font-family: var(--font-body);
      margin-bottom: -0.5px;
      transition: color 0.15s, border-color 0.15s;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .bp-ctx-tab:hover { color: var(--color-text-primary); }
    .bp-ctx-tab.active {
      color: var(--theme-accent);
      border-bottom-color: var(--theme-accent);
    }
    .bp-ctx-tab-count {
      display: inline-flex;
      align-items: center;
      min-width: 18px;
      justify-content: center;
      padding: 1px 6px;
      font-size: 10px;
      font-weight: 600;
      color: var(--color-text-muted);
      background: var(--theme-bg);
      border-radius: 10px;
    }
    .bp-ctx-tab.active .bp-ctx-tab-count { color: var(--theme-accent); }

    /* ── Scrolling middle ── */
    .bp-ctx-body {
      flex: 1;
      overflow-y: auto;
      padding: 6px 16px 12px;
      min-height: 0;
    }
    .bp-ctx-empty {
      font-size: 12px;
      color: var(--color-text-muted);
      font-style: italic;
      padding: 16px 0;
      text-align: center;
    }
    .bp-ctx-desc {
      font-size: 12.5px;
      line-height: 1.55;
      color: var(--color-text-secondary);
      padding: 10px 12px;
      margin-bottom: 10px;
      background: var(--theme-bg);
      border: 0.5px solid var(--theme-border);
      border-radius: 8px;
    }

    /* Items tab footer */
    .bp-ctx-tab-foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 12px 0 4px;
      font-family: var(--font-body);
    }
    .bp-ctx-add-more {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 0;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      color: var(--theme-accent);
      font-family: var(--font-body);
    }
    .bp-ctx-add-more:hover { opacity: 0.75; }
    .bp-ctx-lead-foot {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      color: var(--color-text-muted);
    }

    /* Wishlist hint */
    .bp-ctx-wish-hint {
      font-size: 10.5px;
      font-style: italic;
      color: var(--color-text-muted);
      padding: 8px 0 6px;
      text-align: right;
    }

    /* Brief tab fields */
    .bp-ctx-brief-field { margin-bottom: 10px; }
    .bp-ctx-brief-label {
      display: block;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--theme-text);
      margin-bottom: 6px;
    }
    .bp-ctx-brief-empty {
      font-size: 11px;
      color: var(--color-text-muted);
      font-style: italic;
      margin-top: -4px;
    }

    /* ── Pinned footer ── */
    .bp-ctx-footer {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 16px;
      border-top: 0.5px solid var(--color-border);
      background: var(--color-surface);
    }
    .bp-ctx-footer-total {
      font-size: 12px;
      color: var(--color-text-muted);
      font-variant-numeric: tabular-nums;
    }
    .bp-ctx-footer-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 0;
      background: none;
      border: none;
      cursor: pointer;
      font-family: var(--font-body);
      font-size: 12px;
      font-weight: 500;
      color: var(--theme-accent);
    }
    .bp-ctx-footer-link:hover { opacity: 0.75; }

    /* Non-project Browse CTA (unchanged from v1.20). */
    .bp-ctx-browse {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      margin: 0 16px 14px;
      padding: 8px;
      color: var(--theme-accent);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      border: 0.5px dashed var(--color-border);
      border-radius: 6px;
      font-family: var(--font-body);
      transition: border-color 0.15s, background 0.15s;
    }
    .bp-ctx-browse:hover {
      border-color: var(--theme-accent);
      background: var(--theme-bg);
    }
  `]
})
export class CategoryContextPanelComponent implements OnChanges {
  @Input() category: any = null;
  @Input() briefText: string | null = null;
  @Input() briefDetail: string | null = null;
  @Input() budgetPrice: number | null = null;
  @Input() selectedItems: ProjectItem[] = [];
  @Input() likedItems: ProjectItem[] = [];
  @Input() context: CategoryContextMode = 'marketplace';
  /** Sum of selected items' base_price for this category. The parent
      computes this — keeps the panel a pure view. */
  @Input() categoryTotal = 0;
  /** Sum of selected items' base_price across ALL the project's
      categories (not just this one). Shown in the pinned footer. */
  @Input() projectTotal = 0;

  @Output() itemClicked = new EventEmitter<any>();
  @Output() itemRemoved = new EventEmitter<any>();
  @Output() itemMoved = new EventEmitter<{ item: any; toType: 'selected' | 'liked' }>();
  @Output() browseClicked = new EventEmitter<void>();
  @Output() briefUpdated = new EventEmitter<string>();
  @Output() openEstimate = new EventEmitter<void>();

  /** Active tab. Items by default; if the user has only wishlist
      items, we still default to Items (clear empty state) — the user
      can flip to Wishlist explicitly. */
  activeTab: PanelTab = 'items';

  /** Local edit state for the inline brief editor. */
  briefDraft = '';

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnChanges() {
    // Keep the brief draft in sync when the parent passes new text
    // (different category active, server save round-trip, etc.).
    if (this.briefText !== this.briefDraft && document.activeElement?.tagName !== 'INPUT') {
      this.briefDraft = this.briefText || '';
    }
  }

  // ── Computed summaries ───────────────────────────────────────────────

  get subtotalAmount(): number {
    if (!this.selectedItems.length) return 0;
    return this.selectedItems.reduce(
      (s, pi) => s + (Number(pi.base_price) || 0), 0
    );
  }

  get wishlistAmount(): number {
    if (!this.likedItems.length) return 0;
    return this.likedItems.reduce(
      (s, pi) => s + (Number(pi.base_price) || 0), 0
    );
  }

  get longestLeadDays(): number {
    let max = 0;
    for (const pi of this.selectedItems) {
      const d = Number(pi.lead_time_days);
      if (!isNaN(d) && d > max) max = d;
    }
    return max;
  }

  /** Lowercase category name for the "Add more {name}" CTA. */
  get catNameLower(): string {
    return (this.category?.name || 'items').toLowerCase();
  }

  trackByItemKey = (_: number, item: any): string => {
    return item?.id || item?.item_id || '';
  };

  setTab(tab: PanelTab) {
    this.activeTab = tab;
    if (tab === 'brief') {
      this.briefDraft = this.briefText || '';
    }
  }

  saveBriefIfChanged() {
    const next = (this.briefDraft || '').trim();
    const current = (this.briefText || '').trim();
    if (next !== current) {
      this.briefUpdated.emit(next);
    }
  }
}
