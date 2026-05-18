import {
  Component, Input, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Check } from 'lucide-angular';
import { GbpPipe } from '../../pipes/gbp.pipe';
import { StatusBadgeComponent } from '../status-badge/status-badge.component';

/**
 * Shared category card header. Used by:
 *   - the Marketplace right-rail context panel (top section)
 *   - the Build/Estimate tab's expanded category card (top row)
 *
 * Layout: themed icon circle · name + counts · cost · status pill.
 * Status falls back to a "Draft" pill when no status_name is set.
 */
@Component({
  selector: 'app-category-card-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, LucideAngularModule, GbpPipe, StatusBadgeComponent],
  template: `
    <div class="bp-cch">
      <!-- Themed icon circle. Falls back to the first letter of the
           name when the category has no icon_name. -->
      <div class="bp-cch-icon">
        <lucide-icon *ngIf="iconName"
                     [name]="iconName"
                     [size]="20"></lucide-icon>
        <span *ngIf="!iconName" class="bp-cch-icon-letter">
          {{ (name || '?').charAt(0) }}
        </span>
      </div>

      <!-- Identity column: name + counts. Counts always lead with the
           selected total; the wishlist piece appears only when there's
           at least one to show. -->
      <div class="bp-cch-id">
        <div class="bp-cch-name">{{ name || '—' }}</div>
        <div class="bp-cch-counts" *ngIf="hasAnyCount">
          <span class="bp-cch-count" *ngIf="selectedCount > 0">
            <lucide-icon name="check" [size]="11"></lucide-icon>
            {{ selectedCount }} selected
          </span>
          <span *ngIf="selectedCount > 0 && wishlistCount > 0"
                class="bp-cch-count-sep">·</span>
          <span class="bp-cch-count bp-cch-count--wish" *ngIf="wishlistCount > 0">
            <lucide-icon name="heart" [size]="11"></lucide-icon>
            {{ wishlistCount }} wishlist
          </span>
        </div>
      </div>

      <!-- Right column: serif cost (only when > 0) + status pill. -->
      <div class="bp-cch-right">
        <span class="bp-cch-cost" *ngIf="cost > 0">{{ cost | gbp }}</span>
        <span class="bp-cch-cost bp-cch-cost--muted" *ngIf="!cost">—</span>
        <app-status-badge *ngIf="status"
                          [statusName]="status"></app-status-badge>
        <span *ngIf="!status" class="bp-cch-draft">Draft</span>
      </div>
    </div>
  `,
  styles: [`
    /* v1.24m: font-family also on :host (in addition to .bp-cch) so
       the component is bullet-proof against ancestor styles that
       might set font-family on the panel/column it sits in. */
    :host {
      display: block;
      font-family: var(--font-body);
    }

    .bp-cch {
      display: flex;
      align-items: center;
      gap: 12px;
      font-family: var(--font-body);
    }

    /* Icon circle — soft themed background, accent-tinted glyph. */
    .bp-cch-icon {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--theme-bg);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--theme-accent);
      flex-shrink: 0;
    }
    .bp-cch-icon-letter {
      font-family: var(--font-display);
      font-size: 18px;
      font-weight: 500;
      color: var(--theme-accent);
    }

    /* Identity column */
    .bp-cch-id { flex: 1; min-width: 0; }
    .bp-cch-name {
      font-family: var(--font-display);
      font-size: 17px;
      font-weight: 400;
      color: var(--color-text-primary);
      line-height: 1.25;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .bp-cch-counts {
      font-size: 11px;
      color: var(--color-text-muted);
      margin-top: 2px;
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .bp-cch-count {
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }
    .bp-cch-count--wish { color: var(--theme-accent); }
    .bp-cch-count-sep { color: var(--color-text-muted); }

    /* Right column — vertical stack on narrow widths, inline-friendly
       gap on wider. flex-shrink:0 so the name truncates first. */
    .bp-cch-right {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }
    .bp-cch-cost {
      font-family: var(--font-display);
      font-size: 18px;
      font-weight: 400;
      color: var(--color-text-primary);
      font-variant-numeric: tabular-nums;
    }
    .bp-cch-cost--muted { color: var(--color-text-muted); }

    /* Draft fallback pill — same shape as app-status-badge but muted
       (no semantic status colour). */
    .bp-cch-draft {
      display: inline-flex;
      align-items: center;
      padding: 3px 10px;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--theme-text);
      background: var(--theme-bg);
      border: 0.5px solid var(--theme-border);
      border-radius: 20px;
      font-family: var(--font-body);
    }
  `]
})
export class CategoryCardHeaderComponent {
  /** Display fields. Kept as primitives (not a Category object) so
      callers from different shapes — CategoryInfo, the joined
      project_categories row — can drive the same header. */
  @Input() name: string | null | undefined = '';
  @Input() iconName: string | null | undefined = '';
  @Input() selectedCount = 0;
  @Input() wishlistCount = 0;
  @Input() cost = 0;
  /** statuses.name (already humanised) or null → "Draft" pill. */
  @Input() status: string | null | undefined = null;

  get hasAnyCount(): boolean {
    return (this.selectedCount > 0) || (this.wishlistCount > 0);
  }
}
