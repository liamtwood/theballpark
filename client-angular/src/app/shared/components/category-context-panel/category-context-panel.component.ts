import {
  Component, Input, Output, EventEmitter,
  ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextareaModule } from 'primeng/inputtextarea';
import {
  LucideAngularModule, Check, Heart, X, ArrowUp, ArrowRight,
  Plus, SquarePen, Clock
} from 'lucide-angular';
import { GbpPipe } from '../../pipes/gbp.pipe';
import { CodelistService } from '../../../core/services/codelist.service';

export type CategoryContextMode = 'project' | 'marketplace' | 'supplier';

/**
 * Category context panel — the right-rail surface that takes over the
 * catalogue-grid right column whenever a specific category is active.
 *
 * v1.22 redesign: richer layout with subtotal block, item thumbnails,
 * a separate Wishlist section (display label for selection_type='liked'),
 * inline brief editor, and a pinned footer showing the project total
 * across all categories with an "Open estimate →" link.
 *
 * Three modes:
 *   - project    : briefText is the project_categories.requirement_brief
 *                  for the active category; items are project_items.
 *                  Brief is inline-editable.
 *   - marketplace: briefText is null; falls back to category.description;
 *                  items list typically empty (favourites integration
 *                  is deferred).
 *   - supplier   : same shape as marketplace but scoped to the supplier.
 *
 * Terminology — display "Wishlist" maps to data selection_type='liked';
 * display "Selected" maps to selection_type='selected'. Database columns
 * and service method names keep the original 'liked' / 'selected' values.
 */
@Component({
  selector: 'app-category-context-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, InputTextareaModule,
    LucideAngularModule, GbpPipe
  ],
  template: `
    <div class="bp-ctx-panel">

      <!-- ── 1. Header ─────────────────────────────────────────────
           Themed icon + CATEGORY eyebrow + serif name + count chip.
           Chip reads "{N} selected · {M} wishlist" — only renders
           the parts that exist (e.g. "1 wishlist" alone, no leading
           dot). Pinned (flex-shrink: 0). -->
      <div class="bp-ctx-head">
        <div class="bp-ctx-head-icon">
          <lucide-icon *ngIf="category?.icon_name"
                       [name]="category.icon_name"
                       [size]="20"></lucide-icon>
          <span *ngIf="!category?.icon_name" class="bp-ctx-head-initial">
            {{ (category?.name || '?').charAt(0) }}
          </span>
        </div>
        <div class="bp-ctx-head-text">
          <div class="bp-ctx-head-eyebrow">CATEGORY</div>
          <div class="bp-ctx-head-name">{{ category?.name || '—' }}</div>
        </div>
        <div class="bp-ctx-head-chip" *ngIf="selectedItems.length || likedItems.length">
          <ng-container *ngIf="selectedItems.length">
            {{ selectedItems.length }} selected
          </ng-container>
          <span *ngIf="selectedItems.length && likedItems.length" class="bp-ctx-head-chip-sep">·</span>
          <ng-container *ngIf="likedItems.length">
            {{ likedItems.length }} wishlist
          </ng-container>
        </div>
      </div>

      <!-- ── 2. Subtotal block (project mode) ───────────────────────
           Big serif amount + summary lines: wishlist impact and
           longest lead time. Pinned. -->
      <div class="bp-ctx-subtotal" *ngIf="context === 'project'">
        <div class="bp-ctx-sub-row">
          <span class="bp-ctx-sub-amount">{{ subtotalAmount | gbp }}</span>
          <span class="bp-ctx-sub-label">subtotal</span>
        </div>
        <div class="bp-ctx-sub-meta">
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

      <!-- ── 3. Brief block ────────────────────────────────────────
           Soft themed-tint band with inline editing in project mode.
           Pinned. In non-project mode falls back to category.description
           (no eyebrow / pencil — read-only). -->
      <div class="bp-ctx-brief" *ngIf="context === 'project'">
        <div class="bp-ctx-brief-h">
          <span class="bp-ctx-brief-eyebrow">BRIEF</span>
          <button *ngIf="!editingBrief"
                  type="button"
                  class="bp-ctx-brief-edit"
                  (click)="startEditBrief()"
                  title="Edit brief">
            <lucide-icon name="square-pen" [size]="12"></lucide-icon>
          </button>
        </div>
        <ng-container *ngIf="!editingBrief">
          <p *ngIf="briefText" class="bp-ctx-brief-text">{{ briefText }}</p>
          <p *ngIf="!briefText" class="bp-ctx-brief-empty">
            Add a brief for this category...
          </p>
        </ng-container>
        <textarea *ngIf="editingBrief" pInputTextarea
                  class="bp-ctx-brief-edit-area"
                  [(ngModel)]="briefDraft"
                  (blur)="saveBriefIfChanged()"
                  [rows]="3"
                  [placeholder]="'What you need from ' + ((category?.name || 'this category')).toLowerCase() + ' suppliers — keep it short.'">
        </textarea>
      </div>

      <!-- Description fallback for marketplace / supplier modes. -->
      <div class="bp-ctx-desc"
           *ngIf="context !== 'project' && !briefText && category?.description">
        {{ category.description }}
      </div>

      <!-- ── 4 + 5. Items area (Selected + Wishlist) ───────────────
           Scrolls within the panel. Header / subtotal / brief above
           stay pinned; footer below stays pinned. -->
      <div class="bp-ctx-items">

        <!-- Selected -->
        <div class="bp-ctx-sec" *ngIf="selectedItems.length">
          <div class="bp-ctx-sec-label">Selected</div>
          <div *ngFor="let item of selectedItems; trackBy: trackByItemKey"
               class="bp-ctx-row"
               (click)="itemClicked.emit(item)">
            <div class="bp-ctx-row-thumb"
                 [style.background-image]="item.image_url ? 'url(' + item.image_url + ')' : null"
                 [class.bp-ctx-row-thumb--empty]="!item.image_url">
            </div>
            <div class="bp-ctx-row-body">
              <div class="bp-ctx-row-name">{{ item.name }}</div>
              <div class="bp-ctx-row-sub">{{ rowSubtitle(item) }}</div>
              <div class="bp-ctx-row-price">
                {{ item.base_price | gbp }}
                <span class="bp-ctx-row-unit" *ngIf="item.unit"> / {{ unitLabel(item.unit) }}</span>
              </div>
            </div>
            <div class="bp-ctx-row-actions">
              <button type="button"
                      class="bp-ctx-row-x"
                      title="Remove"
                      (click)="$event.stopPropagation(); itemRemoved.emit(item)">
                <lucide-icon name="x" [size]="11"></lucide-icon>
              </button>
            </div>
          </div>
        </div>

        <!-- Wishlist (display label for selection_type='liked') -->
        <div class="bp-ctx-sec bp-ctx-sec--wish" *ngIf="likedItems.length">
          <div class="bp-ctx-sec-label bp-ctx-sec-label--wish">
            <lucide-icon name="heart" [size]="11"></lucide-icon>
            Wishlist
            <span class="bp-ctx-wish-hint">awaiting client approval</span>
          </div>
          <div *ngFor="let item of likedItems; trackBy: trackByItemKey"
               class="bp-ctx-row bp-ctx-row--wish"
               (click)="itemClicked.emit(item)">
            <div class="bp-ctx-row-thumb"
                 [style.background-image]="item.image_url ? 'url(' + item.image_url + ')' : null"
                 [class.bp-ctx-row-thumb--empty]="!item.image_url">
            </div>
            <div class="bp-ctx-row-body">
              <div class="bp-ctx-row-name">{{ item.name }}</div>
              <div class="bp-ctx-row-sub">{{ rowSubtitle(item) }}</div>
              <div class="bp-ctx-row-price">
                {{ item.base_price | gbp }}
                <span class="bp-ctx-row-unit" *ngIf="item.unit"> / {{ unitLabel(item.unit) }}</span>
              </div>
            </div>
            <div class="bp-ctx-row-actions bp-ctx-row-actions--stack">
              <button type="button"
                      class="bp-ctx-confirm"
                      title="Confirm — move to Selected"
                      (click)="$event.stopPropagation(); itemMoved.emit({ item: item, toType: 'selected' })">
                Confirm
              </button>
              <button type="button"
                      class="bp-ctx-row-x"
                      title="Remove"
                      (click)="$event.stopPropagation(); itemRemoved.emit(item)">
                <lucide-icon name="x" [size]="11"></lucide-icon>
              </button>
            </div>
          </div>
        </div>

        <!-- Empty state — project mode and no items in either bucket. -->
        <div class="bp-ctx-empty"
             *ngIf="context === 'project' && !selectedItems.length && !likedItems.length">
          No items added yet — browse below to select.
        </div>
        <div class="bp-ctx-empty"
             *ngIf="context !== 'project' && !selectedItems.length && !likedItems.length">
          No favourites in this category yet.
        </div>

      </div>

      <!-- ── 6. Footer ─────────────────────────────────────────────
           Pinned. Project total (sum of ALL selected items across
           all categories — passed in from the parent) and a link
           to the Estimate tab (post-v1.18 the Build/Estimate page;
           parent decides where openEstimate routes). -->
      <div class="bp-ctx-footer" *ngIf="context === 'project'">
        <span class="bp-ctx-footer-total">Project total {{ projectTotal | gbp }}</span>
        <button type="button"
                class="bp-ctx-footer-link"
                (click)="openEstimate.emit()">
          Open estimate
          <lucide-icon name="arrow-right" [size]="12"></lucide-icon>
        </button>
      </div>

      <!-- Marketplace / supplier footer — keeps the "browse" gesture
           from v1.19. Project mode uses the richer footer above. -->
      <div class="bp-ctx-browse"
           *ngIf="context !== 'project'"
           (click)="browseClicked.emit()">
        <lucide-icon name="plus" [size]="13"></lucide-icon>
        Browse marketplace
      </div>

    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }

    /* ── Panel shell ────────────────────────────────────────────
       Flex column so the items area can grow + scroll while every
       other section stays pinned. */
    .bp-ctx-panel {
      height: 100%;
      display: flex;
      flex-direction: column;
      font-family: var(--font-body);
      background: var(--color-surface);
      border-radius: 12px;
      overflow: hidden;
    }

    /* ── 1. Header ── */
    .bp-ctx-head {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 16px 12px;
    }
    .bp-ctx-head-icon {
      width: 40px; height: 40px;
      border-radius: 50%;
      background: var(--theme-bg);
      display: flex; align-items: center; justify-content: center;
      color: var(--theme-accent);
      flex-shrink: 0;
    }
    .bp-ctx-head-initial {
      font-family: var(--font-display);
      font-size: 18px;
      font-weight: 500;
      color: var(--theme-accent);
    }
    .bp-ctx-head-text { flex: 1; min-width: 0; }
    .bp-ctx-head-eyebrow {
      font-size: 10px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--theme-text);
      margin-bottom: 1px;
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
    }
    .bp-ctx-head-chip {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 20px;
      border: 0.5px solid var(--color-border);
      background: var(--color-surface);
      font-size: 11px;
      font-weight: 500;
      color: var(--color-text-secondary);
      white-space: nowrap;
    }
    .bp-ctx-head-chip-sep { color: var(--color-text-muted); }

    /* ── 2. Subtotal block ── */
    .bp-ctx-subtotal {
      flex-shrink: 0;
      padding: 4px 16px 14px;
    }
    .bp-ctx-sub-row {
      display: flex;
      align-items: baseline;
      gap: 8px;
    }
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

    /* ── 3. Brief block ── */
    .bp-ctx-brief {
      flex-shrink: 0;
      margin: 0 16px 14px;
      padding: 12px 14px;
      border-radius: 10px;
      background: var(--theme-bg);
      border: 0.5px solid var(--theme-border);
    }
    .bp-ctx-brief-h {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .bp-ctx-brief-eyebrow {
      font-size: 10px;
      font-weight: 500;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--theme-text);
    }
    .bp-ctx-brief-edit {
      width: 22px; height: 22px;
      border-radius: 50%;
      border: 0.5px solid transparent;
      background: transparent;
      color: var(--theme-accent);
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.15s, border-color 0.15s;
    }
    .bp-ctx-brief-edit:hover {
      background: var(--color-surface);
      border-color: var(--theme-border);
    }
    .bp-ctx-brief-text {
      margin: 0;
      font-size: 12.5px;
      line-height: 1.5;
      color: var(--color-text-primary);
      white-space: pre-wrap;
    }
    .bp-ctx-brief-empty {
      margin: 0;
      font-size: 12.5px;
      font-style: italic;
      color: var(--color-text-muted);
    }
    .bp-ctx-brief-edit-area {
      width: 100%;
      font-size: 12.5px;
      line-height: 1.5;
      font-family: var(--font-body);
    }

    /* Marketplace / supplier description (no eyebrow). */
    .bp-ctx-desc {
      flex-shrink: 0;
      margin: 0 16px 14px;
      padding: 12px 14px;
      border-radius: 10px;
      background: var(--theme-bg);
      border: 0.5px solid var(--theme-border);
      font-size: 12.5px;
      line-height: 1.5;
      color: var(--color-text-secondary);
    }

    /* ── 4 + 5. Items area ── */
    .bp-ctx-items {
      flex: 1;
      overflow-y: auto;
      padding: 0 16px;
      min-height: 0;
    }
    .bp-ctx-sec { padding: 10px 0 4px; }
    .bp-ctx-sec--wish {
      margin: 6px -16px 0;
      padding: 12px 16px 4px;
      background: var(--theme-bg);
      border-top: 0.5px solid var(--theme-border);
    }
    .bp-ctx-sec-label {
      font-size: 12px;
      font-weight: 500;
      color: var(--color-text-secondary);
      margin-bottom: 6px;
    }
    .bp-ctx-sec-label--wish {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--theme-accent);
    }
    .bp-ctx-sec-label--wish lucide-icon { flex-shrink: 0; }
    .bp-ctx-wish-hint {
      margin-left: auto;
      font-size: 10.5px;
      font-style: italic;
      font-weight: 400;
      color: var(--color-text-muted);
    }

    .bp-ctx-row {
      display: grid;
      grid-template-columns: 46px 1fr auto;
      align-items: center;
      gap: 12px;
      padding: 10px 0;
      border-top: 0.5px solid var(--color-border);
      cursor: pointer;
      transition: opacity 0.15s;
    }
    .bp-ctx-row:first-of-type { border-top: none; }
    .bp-ctx-row:hover { opacity: 0.85; }
    .bp-ctx-row--wish { border-top-color: var(--theme-border); }

    .bp-ctx-row-thumb {
      width: 46px; height: 46px;
      border-radius: 8px;
      background-size: cover;
      background-position: center;
      background-color: var(--theme-bg);
      flex-shrink: 0;
    }
    .bp-ctx-row-thumb--empty { background-color: var(--theme-bg); }

    .bp-ctx-row-body { min-width: 0; }
    .bp-ctx-row-name {
      font-size: 13px;
      font-weight: 500;
      color: var(--color-text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      line-height: 1.3;
    }
    .bp-ctx-row-sub {
      font-size: 11px;
      color: var(--color-text-muted);
      margin-top: 1px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .bp-ctx-row-price {
      font-family: var(--font-display);
      font-size: 13px;
      font-weight: 500;
      color: var(--color-text-primary);
      margin-top: 3px;
      font-variant-numeric: tabular-nums;
    }
    .bp-ctx-row-unit {
      font-family: var(--font-body);
      font-size: 11px;
      font-weight: 400;
      color: var(--color-text-muted);
    }

    .bp-ctx-row-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }
    .bp-ctx-row-actions--stack {
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
    }
    .bp-ctx-row-x {
      width: 22px; height: 22px;
      border-radius: 50%;
      border: 0.5px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text-muted);
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: color 0.15s, border-color 0.15s;
    }
    .bp-ctx-row-x:hover {
      color: var(--color-danger);
      border-color: var(--color-danger);
    }
    .bp-ctx-confirm {
      padding: 4px 12px;
      font-size: 11px;
      font-weight: 500;
      border-radius: 16px;
      border: 0.5px solid var(--theme-accent);
      background: var(--color-surface);
      color: var(--theme-accent);
      cursor: pointer;
      font-family: var(--font-body);
      transition: background 0.15s, color 0.15s;
    }
    .bp-ctx-confirm:hover {
      background: var(--theme-accent);
      color: var(--color-surface);
    }

    .bp-ctx-empty {
      font-size: 12px;
      color: var(--color-text-muted);
      text-align: center;
      padding: 24px 0;
      font-style: italic;
    }

    /* ── 6. Footer ── */
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

    /* Marketplace / supplier "Browse marketplace" CTA. */
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
export class CategoryContextPanelComponent {
  @Input() category: any = null;
  @Input() briefText: string | null = null;
  @Input() briefDetail: string | null = null;
  @Input() budgetPrice: number | null = null;
  @Input() selectedItems: any[] = [];
  @Input() likedItems: any[] = [];
  @Input() context: CategoryContextMode = 'marketplace';
  /** Sum of selected items' base_price for this category. The parent
      computes this — keeps the panel a pure view. */
  @Input() categoryTotal = 0;
  /** v1.22: sum of selected items' base_price across ALL the project's
      categories (not just this one). Shown in the pinned footer. */
  @Input() projectTotal = 0;

  @Output() itemClicked = new EventEmitter<any>();
  @Output() itemRemoved = new EventEmitter<any>();
  @Output() itemMoved = new EventEmitter<{ item: any; toType: 'selected' | 'liked' }>();
  @Output() browseClicked = new EventEmitter<void>();
  /** v1.22: emitted when the inline brief editor saves on blur. Parent
      persists via ProjectCategoryService.upsert / ProjectService
      .upsertCategory. */
  @Output() briefUpdated = new EventEmitter<string>();
  /** v1.22: emitted when the footer "Open estimate →" link is clicked.
      Parent routes to the Build/Estimate tab. */
  @Output() openEstimate = new EventEmitter<void>();

  /** Local edit state for the inline brief editor. briefDraft is what
      the textarea binds to; we compare against briefText on blur and
      only emit if it changed (cuts noise on the upsert endpoint). */
  editingBrief = false;
  briefDraft = '';

  constructor(
    private codelistSvc: CodelistService,
    private cdr: ChangeDetectorRef
  ) {}

  // ── Computed summaries ───────────────────────────────────────────────

  /** Sum of selected items' base_price in this category. Falls back to
      the categoryTotal input when the parent prefers to provide it; we
      always compute defensively from selectedItems so the value stays in
      sync even if the parent forgot to pass it. */
  get subtotalAmount(): number {
    if (!this.selectedItems.length) return 0;
    return this.selectedItems.reduce(
      (s, pi) => s + (Number(pi.base_price) || 0), 0
    );
  }

  /** Sum of liked items' base_price — the "+£X if wishlist approved"
      line in the subtotal block. */
  get wishlistAmount(): number {
    if (!this.likedItems.length) return 0;
    return this.likedItems.reduce(
      (s, pi) => s + (Number(pi.base_price) || 0), 0
    );
  }

  /** Max lead_time_days across selected items. 0 (= hidden) when no
      items have a lead time set. */
  get longestLeadDays(): number {
    let max = 0;
    for (const pi of this.selectedItems) {
      const d = Number(pi.lead_time_days);
      if (!isNaN(d) && d > max) max = d;
    }
    return max;
  }

  // ── Row helpers ──────────────────────────────────────────────────────

  /** Sub-line under each item row — "{supplier} · {N} days lead".
      Falls back gracefully when one or the other is missing. */
  rowSubtitle(item: any): string {
    const sup = item?.supplier_name;
    const lead = item?.lead_time_days;
    const parts: string[] = [];
    if (sup) parts.push(sup);
    if (lead != null && Number(lead) > 0) {
      parts.push(`${lead} days lead`);
    }
    return parts.join(' · ');
  }

  unitLabel(code: string | null | undefined): string {
    return code ? this.codelistSvc.getDisplay(code) : '';
  }

  /** Stable key for *ngFor — prefer project_item.id, fall back to
      item_id, then item.id. Avoids re-renders on cart upserts where
      selection_type flips but the row is the same. */
  trackByItemKey = (_: number, item: any): string => {
    return item?.id || item?.item_id || '';
  };

  // ── Brief inline editor ──────────────────────────────────────────────

  startEditBrief() {
    this.briefDraft = this.briefText || '';
    this.editingBrief = true;
    this.cdr.markForCheck();
  }

  saveBriefIfChanged() {
    const next = (this.briefDraft || '').trim();
    const current = (this.briefText || '').trim();
    this.editingBrief = false;
    if (next !== current) {
      this.briefUpdated.emit(next);
    }
    this.cdr.markForCheck();
  }
}
