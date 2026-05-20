import {
  Component, Input, Output, EventEmitter,
  ChangeDetectionStrategy, HostBinding
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, X, Heart, ArrowUp } from 'lucide-angular';
import { GbpPipe } from '../../pipes/gbp.pipe';
import { CodelistService } from '../../../core/services/codelist.service';
import { ProjectItem } from '../../../models';

export type ProjectItemRowMode = 'selected' | 'wishlist';

/**
 * Shared item row used by both the Marketplace right-rail context panel
 * (compact mode) and the Build/Estimate tab's expanded category card
 * (full mode). Single source of truth for thumbnail + name + supplier
 * line + price math + remove / confirm / demote actions.
 *
 * The row emits intent — the parent (panel or build card) decides what
 * happens (route to detail, persist via ProjectItemService, etc.).
 */
@Component({
  selector: 'app-project-item-row',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, LucideAngularModule, GbpPipe],
  template: `
    <div class="bp-item-row"
         [class.bp-item-row--compact]="compact"
         [class.bp-item-row--wishlist]="mode === 'wishlist'"
         (click)="clicked.emit(item)">

      <!-- Thumbnail (themed soft tile when there's no image). -->
      <div class="bp-item-thumb"
           [style.background-image]="item?.image_url ? 'url(' + item.image_url + ')' : null"
           [class.bp-item-thumb--empty]="!item?.image_url">
        <span *ngIf="!item?.image_url" class="bp-item-thumb-letter">
          {{ (item?.name || '?').charAt(0) }}
        </span>
      </div>

      <!-- Info block: name + (optional, non-compact only) tier chip +
           supplier · price math. v1.24m: tier badge hidden in compact
           mode — it crowds the narrow row and the full tier label is
           visible on the item detail panel anyway. -->
      <div class="bp-item-info">
        <div class="bp-item-name-row">
          <span class="bp-item-name">{{ item?.name }}</span>
          <span *ngIf="tierLabel && !compact" class="bp-item-tier">{{ tierLabel }}</span>
        </div>
        <div class="bp-item-meta">{{ metaLine }}</div>
      </div>

      <!-- Total — serif, tabular nums. Shown when there's a price. -->
      <div class="bp-item-total" *ngIf="item?.base_price != null">
        {{ item.base_price | gbp }}
      </div>

      <!-- Actions cluster -->
      <div class="bp-item-actions"
           [class.bp-item-actions--stack]="mode === 'wishlist'">

        <!-- Wishlist mode: Confirm pill promotes liked → selected. -->
        <button *ngIf="mode === 'wishlist'"
                type="button"
                class="bp-item-confirm"
                title="Confirm — move to Selected"
                (click)="$event.stopPropagation(); confirmed.emit(item)">
          Confirm
        </button>

        <!-- Selected mode: hover-only "move to wishlist" demote
             affordance. Keeps the row calm; appears on row hover via
             CSS so a low-traffic action doesn't clutter the layout. -->
        <button *ngIf="mode === 'selected'"
                type="button"
                class="bp-item-demote"
                title="Move to wishlist"
                (click)="$event.stopPropagation(); movedToWishlist.emit(item)">
          <lucide-icon name="heart" [size]="11"></lucide-icon>
        </button>

        <button type="button"
                class="bp-item-remove"
                title="Remove"
                (click)="$event.stopPropagation(); removed.emit(item)">
          <lucide-icon name="x" [size]="12"></lucide-icon>
        </button>
      </div>
    </div>
  `,
  styles: [`
    /* v1.24m: font-family set on :host so the row always inherits
       Libre Franklin regardless of where it's mounted (catalogue-grid
       right rail, Build card, marketplace context panel, etc.). */
    :host {
      display: block;
      font-family: var(--font-body);
    }

    .bp-item-row {
      display: grid;
      grid-template-columns: 48px 1fr auto auto;
      /* v1.24m: switch from align-items: center → start so the row
         flexes vertically when the name wraps to two lines, keeping
         the thumb / price / × aligned to the top of the row. */
      align-items: start;
      gap: 12px;
      padding: 10px 0;
      border-top: 0.5px solid var(--color-border);
      cursor: pointer;
      font-family: var(--font-body);
      transition: opacity 0.15s;
    }
    /* The first row in a section gets its top border from the section
       header, not from itself — keeps the visual rhythm tight. */
    .bp-item-row:first-child { border-top: none; }
    .bp-item-row:hover { opacity: 0.92; }

    .bp-item-row--compact {
      grid-template-columns: 40px 1fr auto auto;
      gap: 10px;
      padding: 8px 0;
    }

    /* Thumbnail — soft themed background when there's no image. */
    .bp-item-thumb {
      width: 48px; height: 48px;
      border-radius: 8px;
      background-color: var(--theme-bg);
      background-size: cover;
      background-position: center;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .bp-item-row--compact .bp-item-thumb {
      width: 40px; height: 40px;
    }
    .bp-item-thumb--empty { background-color: var(--theme-bg); }
    .bp-item-thumb-letter {
      font-family: var(--font-display);
      font-size: 18px;
      font-weight: 500;
      color: var(--theme-accent);
      opacity: 0.5;
    }
    .bp-item-row--compact .bp-item-thumb-letter { font-size: 15px; }

    /* Info block */
    .bp-item-info { min-width: 0; }
    .bp-item-name-row {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }
    /* v1.24m: name wraps to a maximum of two lines instead of being
       hard-truncated with an ellipsis. Most names fit on one line at
       this width; the few longer ones get a second line rather than
       reading as "Suspen..." which is useless at a glance. The row's
       align-items:start handles the flex height. */
    .bp-item-name {
      font-size: 13px;
      font-weight: 500;
      color: var(--color-text-primary);
      line-height: 1.3;
      min-width: 0;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      white-space: normal;
      word-break: break-word;
    }
    .bp-item-row--compact .bp-item-name { font-size: 12px; }
    /* Tier chip — sits next to the name. Same height as the meta line
       so it doesn't push the layout around. */
    .bp-item-tier {
      display: inline-flex;
      align-items: center;
      flex-shrink: 0;
      padding: 1px 7px;
      font-size: 9.5px;
      font-weight: 500;
      letter-spacing: 0.02em;
      color: var(--theme-accent);
      background: var(--theme-bg);
      border: 0.5px solid var(--theme-border);
      border-radius: 10px;
      font-family: var(--font-body);
    }
    .bp-item-meta {
      font-size: 11px;
      color: var(--color-text-muted);
      margin-top: 2px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Serif total */
    .bp-item-total {
      font-family: var(--font-display);
      font-size: 16px;
      font-weight: 500;
      color: var(--color-text-primary);
      font-variant-numeric: tabular-nums;
      flex-shrink: 0;
    }
    .bp-item-row--compact .bp-item-total { font-size: 14px; }

    /* Actions cluster */
    .bp-item-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }
    .bp-item-actions--stack {
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
    }

    /* Confirm pill (wishlist mode) */
    .bp-item-confirm {
      padding: 4px 12px;
      font-size: 11px;
      font-weight: 500;
      font-family: var(--font-body);
      border: 0.5px solid var(--theme-accent);
      border-radius: 16px;
      background: var(--color-surface);
      color: var(--theme-accent);
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
      flex-shrink: 0;
    }
    .bp-item-confirm:hover {
      background: var(--theme-accent);
      color: var(--color-surface);
    }

    /* Remove × — always visible. */
    .bp-item-remove {
      width: 22px; height: 22px;
      border-radius: 50%;
      border: 0.5px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.15s, border-color 0.15s;
    }
    .bp-item-remove:hover {
      color: var(--color-danger);
      border-color: var(--color-danger);
    }

    /* Hover-only "move to wishlist" demote on Selected rows. Hidden by
       default — appears when the parent row is hovered. Keeps the
       resting state calm; the affordance shows up only when the user
       is reaching for an action. */
    .bp-item-demote {
      width: 22px; height: 22px;
      border-radius: 50%;
      border: 0.5px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 0.15s, color 0.15s, border-color 0.15s;
      opacity: 0;
      pointer-events: none;
    }
    .bp-item-row:hover .bp-item-demote {
      opacity: 1;
      pointer-events: auto;
    }
    .bp-item-demote:hover {
      color: var(--theme-accent);
      border-color: var(--theme-accent);
    }
  `]
})
export class ProjectItemRowComponent {
  /** Single project_item row. Reads name, base_price, unit,
      image_url, lead_time_days, supplier_name, tier from the joined
      ProjectItemService.getByProject() payload. */
  @Input() item!: ProjectItem;
  @Input() mode: ProjectItemRowMode = 'selected';
  /** Compact = narrow right-rail panel; full = wider Build card. */
  @Input() compact = false;

  @Output() clicked = new EventEmitter<ProjectItem>();
  @Output() removed = new EventEmitter<ProjectItem>();
  @Output() confirmed = new EventEmitter<ProjectItem>();
  @Output() movedToWishlist = new EventEmitter<ProjectItem>();

  constructor(private codelistSvc: CodelistService) {}

  /** Meta line under the name: "{supplier} · 1 × £{price} / {unit}".
      Each piece is dropped gracefully when missing — never renders a
      stray dot or trailing "/". */
  get metaLine(): string {
    if (!this.item) return '';
    const parts: string[] = [];
    if (this.item.supplier_name) parts.push(this.item.supplier_name);
    if (this.item.base_price != null) {
      const unit = this.item.unit
        ? ' / ' + this.codelistSvc.getDisplay(this.item.unit)
        : '';
      parts.push(`1 × £${Number(this.item.base_price).toLocaleString('en-GB')}${unit}`);
    }
    return parts.join(' · ');
  }

  /** Tier badge label, or null when the item has no tier set. Mapped
      to the marketing tiers used elsewhere in the app. */
  get tierLabel(): string | null {
    switch (this.item?.tier) {
      case 'basic':   return 'Core';
      case 'mid':     return 'Signature';
      case 'premium': return 'Premium';
      default:        return null;
    }
  }
}
