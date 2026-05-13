import {
  Component, Input, Output, EventEmitter,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Check, Heart, X, ArrowUp, Plus } from 'lucide-angular';
import { GbpPipe } from '../../pipes/gbp.pipe';

export type CategoryContextMode = 'project' | 'marketplace' | 'supplier';

/**
 * Category context panel — shown in the catalogue-grid right column
 * when a specific category is active but no item is selected.
 *
 * Three modes:
 *   - project    : briefText is the project_categories.requirement_brief
 *                  for the active category; items are project_items.
 *   - marketplace: briefText is null; falls back to category.description;
 *                  items list typically empty (favourites integration
 *                  is deferred to a future prompt).
 *   - supplier   : same shape as marketplace but scoped to the supplier
 *                  the user is viewing.
 *
 * The panel is read-only: the brief is edited from the Brief or Estimate
 * tab, not here. Item rows are clickable (→ item detail) and carry
 * inline actions for remove / move-to-liked / move-to-selected.
 */
@Component({
  selector: 'app-category-context-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, LucideAngularModule, GbpPipe],
  template: `
    <div class="bp-ctx-panel">

      <!-- ── Category header ─────────────────────────────────────── -->
      <div class="bp-ctx-header">
        <div class="bp-ctx-icon">
          <lucide-icon *ngIf="category?.icon_name"
                       [name]="category.icon_name"
                       [size]="20"></lucide-icon>
          <span *ngIf="!category?.icon_name" class="bp-ctx-initial">
            {{ (category?.name || '?').charAt(0) }}
          </span>
        </div>
        <div class="bp-ctx-title">{{ category?.name }}</div>
      </div>

      <!-- ── Brief block (project mode) ───────────────────────────
           Renders when briefText is set. briefDetail + budgetPrice are
           project-only additions; the surrounding block only shows
           when there's a brief to anchor them to. -->
      <div class="bp-ctx-brief" *ngIf="briefText">
        <div class="bp-ctx-brief-label">BRIEF</div>
        <div class="bp-ctx-brief-text">{{ briefText }}</div>
        <div class="bp-ctx-brief-detail" *ngIf="briefDetail">
          {{ briefDetail }}
        </div>
        <div class="bp-ctx-brief-budget" *ngIf="budgetPrice != null">
          Budget: {{ budgetPrice | gbp }}
        </div>
      </div>

      <!-- Marketplace / supplier fallback — category description (read
           from the platform categories table). Silent when neither
           brief nor description is set. -->
      <div class="bp-ctx-desc" *ngIf="!briefText && category?.description">
        {{ category.description }}
      </div>

      <!-- ── Selected items ──────────────────────────────────────── -->
      <div class="bp-ctx-section" *ngIf="selectedItems.length > 0">
        <div class="bp-ctx-section-label">
          <lucide-icon name="check" [size]="12"></lucide-icon>
          SELECTED
          <span class="bp-ctx-count">{{ selectedItems.length }}</span>
        </div>
        <div *ngFor="let item of selectedItems; trackBy: trackByItemKey"
             class="bp-ctx-item"
             (click)="itemClicked.emit(item)">
          <div class="bp-ctx-item-name">{{ item.name }}</div>
          <div class="bp-ctx-item-right">
            <span class="bp-ctx-item-price" *ngIf="item.base_price">
              {{ item.base_price | gbp }}
            </span>
            <button class="bp-ctx-item-action"
                    title="Move to liked"
                    (click)="$event.stopPropagation(); itemMoved.emit({ item: item, toType: 'liked' })">
              <lucide-icon name="heart" [size]="11"></lucide-icon>
            </button>
            <button class="bp-ctx-item-action"
                    title="Remove"
                    (click)="$event.stopPropagation(); itemRemoved.emit(item)">
              <lucide-icon name="x" [size]="11"></lucide-icon>
            </button>
          </div>
        </div>
      </div>

      <!-- ── Liked items ─────────────────────────────────────────── -->
      <div class="bp-ctx-section" *ngIf="likedItems.length > 0">
        <div class="bp-ctx-section-label bp-ctx-liked-label">
          <lucide-icon name="heart" [size]="12"></lucide-icon>
          LIKED
          <span class="bp-ctx-count">{{ likedItems.length }}</span>
        </div>
        <div *ngFor="let item of likedItems; trackBy: trackByItemKey"
             class="bp-ctx-item bp-ctx-item-liked"
             (click)="itemClicked.emit(item)">
          <div class="bp-ctx-item-name">{{ item.name }}</div>
          <div class="bp-ctx-item-right">
            <span class="bp-ctx-item-price" *ngIf="item.base_price">
              {{ item.base_price | gbp }}
            </span>
            <button class="bp-ctx-item-action"
                    title="Move to selected"
                    (click)="$event.stopPropagation(); itemMoved.emit({ item: item, toType: 'selected' })">
              <lucide-icon name="arrow-up" [size]="11"></lucide-icon>
            </button>
            <button class="bp-ctx-item-action"
                    title="Remove"
                    (click)="$event.stopPropagation(); itemRemoved.emit(item)">
              <lucide-icon name="x" [size]="11"></lucide-icon>
            </button>
          </div>
        </div>
      </div>

      <!-- Empty state — context-aware copy. -->
      <div class="bp-ctx-empty"
           *ngIf="selectedItems.length === 0 && likedItems.length === 0">
        <span *ngIf="context === 'project'">
          No items added yet — browse below to select.
        </span>
        <span *ngIf="context !== 'project'">
          No favourites in this category yet.
        </span>
      </div>

      <!-- Category total — only shows when there's a non-zero total. -->
      <div class="bp-ctx-total" *ngIf="categoryTotal > 0">
        <span class="bp-ctx-total-label">Category total</span>
        <span class="bp-ctx-total-value">{{ categoryTotal | gbp }}</span>
      </div>

      <!-- Browse marketplace link (project context only).
           Parent decides what this does — typically clears the active
           category so the user sees the full catalogue again. -->
      <div class="bp-ctx-browse"
           *ngIf="context === 'project'"
           (click)="browseClicked.emit()">
        <lucide-icon name="plus" [size]="13"></lucide-icon>
        Browse marketplace
      </div>

    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }

    .bp-ctx-panel {
      padding: 16px;
      height: 100%;
      display: flex;
      flex-direction: column;
      font-family: var(--font-body);
    }

    /* ── Header ── */
    .bp-ctx-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
    }
    .bp-ctx-icon {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      background: var(--theme-bg);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--theme-accent);
      flex-shrink: 0;
    }
    .bp-ctx-initial {
      font-family: var(--font-display);
      font-size: 16px;
      font-weight: 600;
      color: var(--theme-accent);
    }
    .bp-ctx-title {
      font-family: var(--font-display);
      font-size: 17px;
      font-weight: 400;
      color: var(--color-text-primary);
      line-height: 1.25;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* ── Brief block ── */
    .bp-ctx-brief {
      padding: 10px 12px;
      background: var(--theme-bg);
      border-radius: 8px;
      border: 0.5px solid var(--theme-border);
      margin-bottom: 14px;
    }
    .bp-ctx-brief-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--theme-accent);
      margin-bottom: 4px;
    }
    .bp-ctx-brief-text {
      font-size: 13px;
      line-height: 1.5;
      color: var(--color-text-primary);
    }
    .bp-ctx-brief-detail {
      font-size: 12px;
      color: var(--color-text-secondary);
      margin-top: 6px;
      line-height: 1.5;
    }
    .bp-ctx-brief-budget {
      font-size: 12px;
      font-weight: 500;
      color: var(--color-text-primary);
      margin-top: 8px;
      padding-top: 8px;
      border-top: 0.5px solid var(--theme-border);
    }

    /* ── Marketplace description ── */
    .bp-ctx-desc {
      font-size: 13px;
      line-height: 1.5;
      color: var(--color-text-secondary);
      margin-bottom: 14px;
    }

    /* ── Item sections ── */
    .bp-ctx-section { margin-bottom: 12px; }
    .bp-ctx-section-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-muted);
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .bp-ctx-liked-label { color: var(--color-danger); }
    .bp-ctx-count {
      font-weight: 400;
      color: var(--color-text-muted);
      margin-left: 2px;
    }

    .bp-ctx-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 8px;
      margin-bottom: 4px;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.1s;
    }
    .bp-ctx-item:hover { background: var(--theme-bg); }
    .bp-ctx-item-liked {
      opacity: 0.78;
      border-left: 2px dashed var(--color-danger);
      padding-left: 10px;
    }
    .bp-ctx-item-name {
      font-size: 12px;
      font-weight: 500;
      color: var(--color-text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
      min-width: 0;
    }
    .bp-ctx-item-right {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }
    .bp-ctx-item-price {
      font-size: 12px;
      color: var(--color-text-muted);
      margin-right: 4px;
      font-variant-numeric: tabular-nums;
    }
    .bp-ctx-item-action {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 0.5px solid var(--color-border);
      background: var(--color-surface);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-text-muted);
      transition: color 0.1s, border-color 0.1s;
    }
    .bp-ctx-item-action:hover {
      border-color: var(--theme-accent);
      color: var(--theme-accent);
    }

    /* ── Empty + total + browse ── */
    .bp-ctx-empty {
      font-size: 12px;
      color: var(--color-text-muted);
      text-align: center;
      padding: 20px 0;
      font-style: italic;
    }
    .bp-ctx-total {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 10px 0;
      margin-top: auto;
      border-top: 0.5px solid var(--color-border);
    }
    .bp-ctx-total-label {
      font-size: 12px;
      color: var(--color-text-muted);
    }
    .bp-ctx-total-value {
      font-family: var(--font-display);
      font-size: 16px;
      color: var(--color-text-primary);
      font-variant-numeric: tabular-nums;
    }

    .bp-ctx-browse {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      padding: 8px;
      margin-top: 8px;
      color: var(--theme-accent);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      border: 0.5px dashed var(--color-border);
      border-radius: 6px;
      transition: border-color 0.15s, background 0.15s;
      font-family: var(--font-body);
    }
    .bp-ctx-browse:hover {
      border-color: var(--theme-accent);
      background: var(--theme-bg);
    }
  `]
})
export class CategoryContextPanelComponent {
  /** The active category — typically a CategoryInfo, but kept loose
      so different callers (project, supplier, marketplace) can pass
      whatever shape they have, as long as it carries name + icon_name
      + description. */
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

  @Output() itemClicked = new EventEmitter<any>();
  @Output() itemRemoved = new EventEmitter<any>();
  @Output() itemMoved = new EventEmitter<{ item: any; toType: 'selected' | 'liked' }>();
  @Output() browseClicked = new EventEmitter<void>();

  /** Stable key for the *ngFor — prefer the project_item.id when set,
      else item_id, else item.id. Avoids re-renders during cart upserts
      where the row's selection_type flips but the row is the same. */
  trackByItemKey = (_: number, item: any): string => {
    return item?.id || item?.item_id || '';
  };
}
