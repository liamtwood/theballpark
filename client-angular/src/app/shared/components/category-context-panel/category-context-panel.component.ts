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
import { Router } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { CodelistService } from '../../../core/services/codelist.service';
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
          <!-- v1.65f — category status pill on the pink header. -->
          <span class="bp-ctx-head-status" *ngIf="context === 'project' && categoryStatuses.length">
            <span class="bp-ctx-head-status-dot" [style.background]="statusColor() || null"></span>
            {{ statusLabel() }}
          </span>
        </div>

        <!-- v1.65f — badge row: Budget / Estimate pills + Items /
             Wishlist count circles. Replaces the subtotal block. -->
        <div class="bp-ctx-badges" *ngIf="context === 'project'">
          <span class="bp-ctx-badge">
            <span class="bp-ctx-badge-l">Budget</span>
            <span class="bp-ctx-badge-v">{{ (budgetPrice || 0) | gbp }}</span>
          </span>
          <span class="bp-ctx-badge">
            <span class="bp-ctx-badge-l">Estimate</span>
            <span class="bp-ctx-badge-v">{{ subtotalAmount | gbp }}</span>
          </span>
          <span class="bp-ctx-countpill" title="Items selected">
            <lucide-icon name="check" [size]="11"></lucide-icon>
            {{ selectedItems.length }}
          </span>
          <span class="bp-ctx-countpill" title="Wishlist items">
            <lucide-icon name="heart" [size]="11"></lucide-icon>
            {{ likedItems.length }}
          </span>
        </div>

        <!-- v1.49 — marketplace / supplier stat block, mirrors the
             project subtotal slot. -->
        <div class="bp-ctx-subtotal" *ngIf="context !== 'project'">
          <div class="bp-ctx-sub-row">
            <span class="bp-ctx-sub-amount">{{ cardItemCount }}</span>
            <span class="bp-ctx-sub-label">item{{ cardItemCount === 1 ? '' : 's' }}</span>
          </div>
          <div class="bp-ctx-sub-line" *ngIf="cardSupplierCount">
            from {{ cardSupplierCount }} supplier{{ cardSupplierCount === 1 ? '' : 's' }}
          </div>
        </div>

        <!-- v1.65f — tabs removed. Items/Wishlist counts surfaced as
             count pills in the badge row above. The panel shows only
             the brief in project mode now. -->
      </div>

      <!-- ── Scrolling middle: brief (project mode) + marketplace
           card sections (other modes) ──────────────────────────────── -->
      <div class="bp-ctx-body">

        <!-- BRIEF — read-only formatted text. Editing happens on the
             Plan tab; this panel is now a summary view. -->
        <ng-container *ngIf="context === 'project'">
          <div class="bp-ctx-brief-section">
            <div class="bp-drawer-label">Brief</div>
            <div class="bp-ctx-brief-text" *ngIf="(briefText || briefDraft); else emptyBrief">
              {{ briefText || briefDraft }}
            </div>
            <ng-template #emptyBrief>
              <div class="bp-ctx-brief-empty">
                No brief yet — add one on the Plan tab to share with suppliers.
              </div>
            </ng-template>
          </div>
        </ng-container>

        <!-- v1.49 — marketplace / supplier category card: About,
             Suppliers, Favourites. -->
        <ng-container *ngIf="context !== 'project'">

          <div class="bp-ctx-cardsec" *ngIf="category?.description">
            <div class="bp-ctx-cardsec-h">About</div>
            <div class="bp-ctx-cardabout">{{ category.description }}</div>
          </div>

          <div class="bp-ctx-cardsec" *ngIf="cardSupplierCount">
            <div class="bp-ctx-cardsec-h">Suppliers · {{ cardSupplierCount }}</div>
            <button type="button" class="bp-ctx-sup"
                    *ngFor="let s of categorySuppliers"
                    (click)="openSupplier(s.supplier_id)">
              <span class="bp-ctx-sup-ic">{{ (s.supplier_name || '?').charAt(0) }}</span>
              <span class="bp-ctx-sup-mid">
                <span class="bp-ctx-sup-name">{{ s.supplier_name }}</span>
                <span class="bp-ctx-sup-sub" *ngIf="s.city">{{ s.city }}</span>
              </span>
              <span class="bp-ctx-sup-count">{{ s.item_count }} item{{ s.item_count === 1 ? '' : 's' }}</span>
              <span class="bp-ctx-sup-chev">›</span>
            </button>
          </div>

          <div class="bp-ctx-cardsec">
            <div class="bp-ctx-cardsec-h">Favourites · {{ selectedItems.length }}</div>
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
              <div class="bp-ctx-empty">Heart an item to save it here.</div>
            </ng-template>
          </div>

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
      overflow: hidden;
    }

    /* ── Pinned top ── */
    .bp-ctx-top { flex-shrink: 0; }

    /* v1.25: simplified header — 36px themed icon circle + Playfair
       category name. Hairline separator handled by the subtotal
       block below (border-top there) so the row sits clean. */
    /* v1.49 — themed header: fills with the standard theme accent
       (same colour a selected subcategory chip uses). */
    .bp-ctx-head {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 16px;
      background: var(--theme-accent);
    }
    .bp-ctx-head-icon {
      width: 36px;
      height: 36px;
      flex-shrink: 0;
      border-radius: 50%;
      background: #fff;
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
      flex: 1;
      font-family: var(--font-display);
      font-size: 17px;
      font-weight: 400;
      letter-spacing: 0.015em;
      color: #fff;
      line-height: 1.2;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
    }
    /* v1.65f — status pill on the pink header */
    .bp-ctx-head-status {
      display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0;
      background: rgba(255,255,255,0.18); color: #fff;
      font-size: var(--text-xs); font-weight: 600;
      padding: 3px 9px; border-radius: var(--radius-pill);
    }
    .bp-ctx-head-status-dot {
      width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0;
      background: #fff;
    }

    /* v1.65f — badge row: Budget / Estimate pills + count circles */
    .bp-ctx-badges {
      display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
      padding: 12px 16px; border-bottom: 0.5px solid var(--color-border);
    }
    .bp-ctx-badge {
      display: inline-flex; align-items: center; gap: 6px;
      background: var(--theme-bg); border-radius: var(--radius-pill);
      padding: 4px 10px;
    }
    .bp-ctx-badge-l {
      font-size: var(--text-xs); color: var(--color-text-muted);
      text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600;
    }
    .bp-ctx-badge-v {
      font-size: var(--text-sm); font-weight: 600;
      color: var(--color-text-primary); font-variant-numeric: tabular-nums;
    }
    .bp-ctx-countpill {
      display: inline-flex; align-items: center; gap: 4px;
      background: var(--theme-accent); color: var(--color-surface);
      border-radius: var(--radius-pill); padding: 3px 9px;
      font-size: var(--text-xs); font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .bp-ctx-countpill lucide-icon { display: inline-flex; }

    /* v1.65f — brief section: plain text, no border */
    .bp-ctx-brief-section { padding: 14px 16px; }
    .bp-ctx-brief-section .bp-drawer-label { margin-bottom: 6px; }
    .bp-ctx-brief-text {
      font-family: var(--font-body); font-size: var(--text-base);
      line-height: 1.55; color: var(--color-text-primary);
      white-space: pre-wrap;
    }
    .bp-ctx-brief-empty {
      font-size: var(--text-sm); color: var(--color-text-muted);
      line-height: 1.55; font-style: italic;
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

    /* ── v1.49 — marketplace / supplier category-card sections ── */
    .bp-ctx-cardsec {
      padding: 12px 0;
      border-bottom: 0.5px solid var(--color-border);
    }
    .bp-ctx-cardsec:last-child { border-bottom: none; }
    .bp-ctx-cardsec-h {
      font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
      text-transform: uppercase; color: var(--color-text-secondary);
      margin-bottom: 8px;
    }
    .bp-ctx-cardabout {
      font-size: 12.5px; line-height: 1.6; color: var(--color-text-secondary);
    }
    .bp-ctx-sup {
      display: flex; align-items: center; gap: 10px; width: 100%;
      background: var(--color-surface);
      border: 0.5px solid var(--color-border);
      border-radius: 8px; padding: 8px 10px;
      cursor: pointer; font-family: var(--font-body);
      transition: border-color 0.12s, background 0.12s;
    }
    .bp-ctx-sup + .bp-ctx-sup { margin-top: 6px; }
    .bp-ctx-sup:hover { border-color: var(--theme-accent); background: var(--theme-bg); }
    .bp-ctx-sup-ic {
      width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
      background: var(--theme-bg); color: var(--theme-accent);
      display: flex; align-items: center; justify-content: center;
      font-family: var(--font-display); font-size: 12px; font-weight: 600;
    }
    .bp-ctx-sup-mid { flex: 1; min-width: 0; text-align: left; }
    .bp-ctx-sup-name {
      display: block; font-size: 12.5px; font-weight: 600;
      color: var(--color-text-primary);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .bp-ctx-sup-sub { display: block; font-size: 10px; color: var(--color-text-muted); }
    .bp-ctx-sup-count {
      font-size: 10px; font-weight: 600; flex-shrink: 0;
      color: var(--theme-accent); background: var(--theme-bg);
      border-radius: 10px; padding: 2px 7px;
    }
    .bp-ctx-sup-chev { color: var(--color-text-muted); font-size: 13px; flex-shrink: 0; }
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
  /** v1.65f — category status code (from project_categories.status_code).
      Rendered as a pill in the pink header when in project mode. */
  @Input() statusCode: string | null = null;
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
      can flip to Wishlist explicitly.
      v1.65a — default flipped to Brief: when a category is selected on
      the marketplace, the brief is the primary context. */
  activeTab: PanelTab = 'brief';

  /** Local edit state for the inline brief editor. */
  briefDraft = '';

  /** v1.49 — suppliers with items in this category (marketplace /
      supplier card). Loaded from /taxonomy/category-suppliers. */
  categorySuppliers: Array<{
    supplier_id: string; supplier_name: string;
    description?: string; city?: string; item_count: number;
  }> = [];
  private suppliersForCat: string | null = null;

  /** v1.65f — category_status codelist for the header status pill. */
  categoryStatuses: any[] = [];

  constructor(
    private cdr: ChangeDetectorRef,
    private msg: MessageService,
    private api: ApiService,
    private codelistSvc: CodelistService,
    private router: Router,
  ) {
    // Cache-aware — fires immediately if already loaded.
    this.codelistSvc.getByName('category_status').subscribe({
      next: rows => { this.categoryStatuses = rows || []; this.cdr.markForCheck(); },
      error: () => {}
    });
  }

  /** v1.65f — codelist label / colour for the active category status. */
  statusLabel(): string {
    const code = this.statusCode || 'draft';
    return this.categoryStatuses.find(s => s.code === code)?.label
      || (code.charAt(0).toUpperCase() + code.slice(1).replace(/_/g, ' '));
  }
  statusColor(): string {
    const code = this.statusCode || 'draft';
    return this.categoryStatuses.find(s => s.code === code)?.meta?.color || '';
  }

  ngOnChanges() {
    // Keep the brief draft in sync when the parent passes new text
    // (different category active, server save round-trip, etc.).
    if (this.briefText !== this.briefDraft && document.activeElement?.tagName !== 'INPUT') {
      this.briefDraft = this.briefText || '';
    }
    // v1.49 — marketplace / supplier card: load the category's suppliers
    // when the active category changes.
    const catId = this.category?.id || null;
    if (this.context !== 'project' && catId && catId !== this.suppliersForCat) {
      this.suppliersForCat = catId;
      this.loadCategorySuppliers(catId);
    }
  }

  private loadCategorySuppliers(catId: string): void {
    this.categorySuppliers = [];
    this.api.get<any[]>(`/taxonomy/category-suppliers?category_id=${catId}`).subscribe({
      next: rows => { this.categorySuppliers = rows || []; this.cdr.markForCheck(); },
      error: () => { this.categorySuppliers = []; this.cdr.markForCheck(); }
    });
  }

  /** Total catalogue items in this category — summed from its suppliers. */
  get cardItemCount(): number {
    return this.categorySuppliers.reduce((s, x) => s + (Number(x.item_count) || 0), 0);
  }
  get cardSupplierCount(): number { return this.categorySuppliers.length; }

  /** Open a supplier's store front. */
  openSupplier(id: string): void {
    if (id) this.router.navigate(['/suppliers', id]);
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
