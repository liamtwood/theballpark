import {
  Component, Input, Output, EventEmitter,
  ChangeDetectionStrategy, ChangeDetectorRef, OnChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import {
  LucideAngularModule, Heart, Clock, ArrowRight, Plus, SquarePen, Mail
} from 'lucide-angular';
import { GbpPipe } from '../../pipes/gbp.pipe';
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
    InputTextareaModule, InputTextModule, ButtonModule, ToastModule,
    LucideAngularModule, GbpPipe,
    ProjectItemRowComponent
  ],
  providers: [MessageService],
  template: `
    <div class="bp-ctx-panel">

      <!-- ── Pinned top: header + subtotal + tab bar ─────────────── -->
      <div class="bp-ctx-top">
        <!-- v1.25: simplified header — icon circle + serif name only.
             Count chip / cost / status pill removed (cost lives in
             the subtotal block; counts are surfaced on the tab
             chips). Matches approved mockup. -->
        <div class="bp-ctx-head">
          <div class="bp-ctx-head-icon">
            <lucide-icon *ngIf="category?.icon_name"
                         [name]="category.icon_name"
                         [size]="18"></lucide-icon>
            <span *ngIf="!category?.icon_name" class="bp-ctx-head-letter">
              {{ (category?.name || '?').charAt(0) }}
            </span>
          </div>
          <div class="bp-ctx-head-name">{{ category?.name || '—' }}</div>
        </div>

        <!-- Subtotal block — project mode only. v1.25: wishlist
             impact + longest lead are now separate vertical lines
             (was a wrap-flex row with " · " separator). -->
        <div class="bp-ctx-subtotal" *ngIf="context === 'project'">
          <div class="bp-ctx-sub-row">
            <span class="bp-ctx-sub-amount">{{ subtotalAmount | gbp }}</span>
            <span class="bp-ctx-sub-label">subtotal</span>
          </div>
          <div *ngIf="wishlistAmount > 0" class="bp-ctx-sub-line">
            <lucide-icon name="heart" [size]="11"></lucide-icon>
            +{{ wishlistAmount | gbp }} if wishlist approved
          </div>
          <div *ngIf="longestLeadDays > 0" class="bp-ctx-sub-line">
            <lucide-icon name="clock" [size]="11"></lucide-icon>
            {{ longestLeadDays }} day longest lead
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
              No items added yet.
            </div>
          </ng-template>
          <!-- v1.25: "Add more {category}" link + "Longest lead Xd"
               line removed. Longest lead now lives in the subtotal
               block above; browsing happens via the catalogue grid
               on the left. -->
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

      <!-- ── Pinned footer (v1.25): Contact supplier CTA. Only
           shown when there's at least one selected item — empty
           and wishlist-only states hide the footer entirely. -->
      <div class="bp-ctx-footer"
           *ngIf="context === 'project' && selectedItems.length > 0">
        <button type="button"
                class="bp-ctx-contact"
                (click)="onContactSupplier($event)">
          <lucide-icon name="mail" [size]="14"></lucide-icon>
          Contact supplier →
        </button>
      </div>

    </div>
    <p-toast></p-toast>
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

    /* v1.25: simplified header — 36px themed icon circle + Playfair
       category name. Hairline separator handled by the subtotal
       block below (border-top there) so the row sits clean. */
    .bp-ctx-head {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 16px;
      border-bottom: 0.5px solid var(--color-border);
    }
    .bp-ctx-head-icon {
      width: 36px;
      height: 36px;
      flex-shrink: 0;
      border-radius: 50%;
      background: var(--theme-bg);
      color: var(--theme-accent);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .bp-ctx-head-letter {
      font-family: var(--font-display);
      font-size: 16px;
      font-weight: 500;
    }
    .bp-ctx-head-name {
      font-family: var(--font-display);
      font-size: 17px;
      font-weight: 400;
      color: var(--color-text-primary);
      line-height: 1.2;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
    }

    /* Subtotal block — v1.25 layout: amount row, then each meta
       line (wishlist impact / longest lead) on its own row, left-
       aligned with the heart / clock glyph leading. */
    .bp-ctx-subtotal {
      padding: 12px 16px;
      border-bottom: 0.5px solid var(--color-border);
    }
    .bp-ctx-sub-row {
      display: flex;
      align-items: baseline;
      gap: 6px;
      margin-bottom: 6px;
    }
    .bp-ctx-sub-amount {
      font-family: var(--font-display);
      font-size: 24px;
      font-weight: 400;
      color: var(--color-text-primary);
      font-variant-numeric: tabular-nums;
      line-height: 1;
    }
    .bp-ctx-sub-label {
      font-size: 12px;
      color: var(--color-text-muted);
    }
    .bp-ctx-sub-line {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      color: var(--color-text-muted);
      margin-bottom: 2px;
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

    /* v1.25: legacy Items-tab footer + Browse marketplace CTA
       removed. The Add-more affordance / longest-lead recap lived
       there and are no longer surfaced (browsing happens via the
       catalogue grid; longest lead is in the subtotal block). */

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

    /* ── Pinned footer (v1.25): full-width Contact supplier CTA.
         Hidden when the panel has no selected items so empty /
         wishlist-only states show no footer at all. */
    .bp-ctx-footer {
      flex-shrink: 0;
      padding: 12px 16px;
      border-top: 0.5px solid var(--color-border);
      background: var(--color-surface);
    }
    .bp-ctx-contact {
      width: 100%;
      padding: 10px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-family: var(--font-body);
      font-size: 12px;
      font-weight: 500;
      color: var(--color-surface);
      background: var(--theme-accent);
      border: none;
      border-radius: var(--radius-button);
      cursor: pointer;
      transition: opacity 0.15s, filter 0.15s;
    }
    .bp-ctx-contact:hover { filter: brightness(1.05); }
    .bp-ctx-contact:active { transform: scale(0.99); }
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

  constructor(
    private cdr: ChangeDetectorRef,
    private msg: MessageService,
  ) {}

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

  /** v1.25: pinned-footer CTA. Stubbed until the supplier outreach
      flow lands — surfaces a "Coming soon" toast so the affordance
      is honest about its state. event.stopPropagation isn't needed
      (the button is the only interactive element in the footer)
      but kept for symmetry with the rest of the panel. */
  onContactSupplier(event: MouseEvent) {
    event.stopPropagation();
    this.msg.add({
      severity: 'info',
      summary: 'Coming soon',
      detail: 'Supplier outreach flow not yet built',
      life: 2500,
    });
  }
}
