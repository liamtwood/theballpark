import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarModule } from 'primeng/sidebar';
import { LucideAngularModule } from 'lucide-angular';
import { Subscription } from 'rxjs';

import { CartDrawerService, CartDrawerOptions } from '../../../core/services/cart-drawer.service';
import { ProjectItemService } from '../../../core/services/project-item.service';
import { ProjectItem } from '../../../models';
import { GbpPipe } from '../../pipes/gbp.pipe';

/**
 * v1.65ab — single shared "Project Items" cart drawer. Mounted once in
 * app-shell; opened from the project marketplace cart icon (and any
 * future surface) via CartDrawerService.open(projectId).
 *
 * Renders project_items in two sections:
 *   SELECTED  — items the project has ticked (selection_type = 'selected')
 *   WISHLIST  — items the project has hearted (selection_type = 'liked')
 *
 * Row hover (SELECTED): description tooltip slides in below the row;
 * a remove ✕ surfaces on the right.
 * Row hover (WISHLIST):  a green tick (promote → selected) + remove ✕.
 * Footer: BALLPARK label + sum of SELECTED items' base_price.
 */
@Component({
  selector: 'app-cart-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, SidebarModule, LucideAngularModule, GbpPipe],
  template: `
    <p-sidebar [(visible)]="visible"
               (visibleChange)="onVisibleChange($event)"
               position="right"
               [style]="{ width: '420px' }"
               styleClass="bp-drawer bp-cart-drawer"
               [showCloseIcon]="false">
      <ng-template pTemplate="header">
        <div class="bp-drawer-header-row">
          <div class="bp-drawer-header">
            <span class="bp-drawer-label">{{ contextLabel }}</span>
            <div class="bp-drawer-title">{{ contextTitle }}</div>
          </div>
          <div class="bp-cd-head-right">
            <span class="bp-cd-count">{{ totalCount }} item{{ totalCount === 1 ? '' : 's' }}</span>
            <button type="button" class="bp-icon-btn" title="Close" (click)="close()">
              <lucide-icon name="x" [size]="16"></lucide-icon>
            </button>
          </div>
        </div>
      </ng-template>

      <div class="bp-cd-body">
        <!-- SELECTED ----------------------------------------------- -->
        <div class="bp-field-label bp-cd-eyebrow">SELECTED</div>
        <ng-container *ngIf="selected.length; else noSel">
          <div *ngFor="let pi of selected" class="bp-cd-row bp-cd-row--selected">
            <div class="bp-cd-img"
                 [style.background-image]="imageStyle(pi)"
                 [style.background-color]="imageBgColor(pi)">
              <span *ngIf="!imageStyle(pi)" class="bp-cd-img-letter">{{ initial(pi) }}</span>
            </div>
            <div class="bp-cd-text">
              <div class="bp-cd-name" [title]="pi.name">{{ pi.name }}</div>
              <div class="bp-cd-sub">{{ pi.supplier_name || '—' }}</div>
            </div>
            <div class="bp-cd-price">{{ (pi.base_price || 0) | gbp }}</div>
            <button type="button"
                    class="bp-cd-action bp-cd-action--remove"
                    title="Remove from project"
                    (click)="remove(pi)">
              <lucide-icon name="x" [size]="13"></lucide-icon>
            </button>
            <!-- v1.65ab — hover-only description tooltip. Truncated to
                 ~120 chars so the panel doesn't balloon. -->
            <div class="bp-cd-tip" *ngIf="pi.description">{{ truncate(pi.description) }}</div>
          </div>
        </ng-container>
        <ng-template #noSel>
          <div class="bp-cd-empty">No items selected yet</div>
        </ng-template>

        <!-- WISHLIST ----------------------------------------------- -->
        <div class="bp-field-label bp-cd-eyebrow">WISHLIST</div>
        <ng-container *ngIf="wishlist.length; else noWl">
          <div *ngFor="let pi of wishlist" class="bp-cd-row bp-cd-row--wishlist">
            <div class="bp-cd-img"
                 [style.background-image]="imageStyle(pi)"
                 [style.background-color]="imageBgColor(pi)">
              <span *ngIf="!imageStyle(pi)" class="bp-cd-img-letter">{{ initial(pi) }}</span>
            </div>
            <div class="bp-cd-text">
              <div class="bp-cd-name" [title]="pi.name">{{ pi.name }}</div>
              <div class="bp-cd-sub">{{ pi.supplier_name || '—' }}</div>
            </div>
            <div class="bp-cd-price">{{ (pi.base_price || 0) | gbp }}</div>
            <button type="button"
                    class="bp-cd-action bp-cd-action--promote"
                    title="Move to selected"
                    (click)="promote(pi)">
              <lucide-icon name="check" [size]="13"></lucide-icon>
            </button>
            <button type="button"
                    class="bp-cd-action bp-cd-action--remove"
                    title="Remove from wishlist"
                    (click)="remove(pi)">
              <lucide-icon name="x" [size]="13"></lucide-icon>
            </button>
          </div>
        </ng-container>
        <ng-template #noWl>
          <div class="bp-cd-empty">No items yet — heart an item to save it here.</div>
        </ng-template>
      </div>

      <ng-template pTemplate="footer">
        <div class="bp-cd-foot">
          <span class="bp-cd-foot-label">BALLPARK</span>
          <span class="bp-cd-foot-total">{{ ballparkTotal | gbp }}</span>
        </div>
      </ng-template>
    </p-sidebar>
  `,
  styles: [`
    /* Standard bp-drawer header chrome already in styles.css.
       Local rules below cover only the cart-drawer-specific pieces. */
    :host ::ng-deep .bp-cart-drawer .p-sidebar-content { padding: 0; }
    :host ::ng-deep .bp-cart-drawer .p-sidebar-footer {
      padding: 14px 20px !important;
      justify-content: stretch !important;
    }

    .bp-cd-head-right {
      display: inline-flex; align-items: center; gap: 8px;
    }
    .bp-cd-count {
      font-size: 13px;
      color: var(--color-text-secondary);
      font-family: var(--font-body);
    }

    .bp-cd-body { padding: 20px 20px 24px; }
    .bp-cd-eyebrow {
      color: var(--theme-accent) !important;
      margin-top: 4px;
      margin-bottom: 10px;
    }
    .bp-cd-eyebrow + .bp-cd-eyebrow,
    .bp-cd-row + .bp-cd-eyebrow,
    .bp-cd-empty + .bp-cd-eyebrow { margin-top: 22px; }

    .bp-cd-empty {
      font-style: italic;
      font-size: 13px;
      color: var(--color-text-muted);
      padding: 8px 2px 12px;
    }

    /* Row container — relative so the hover tooltip can absolute-position. */
    .bp-cd-row {
      position: relative;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      margin-bottom: 6px;
      border: 0.5px solid var(--color-border);
      border-radius: 6px;
      background: var(--color-surface);
      transition: background 0.12s;
    }
    .bp-cd-row:hover {
      background: var(--color-background-secondary, var(--theme-bg));
    }

    .bp-cd-img {
      flex-shrink: 0;
      width: 44px; height: 44px;
      border-radius: 6px;
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      display: flex; align-items: center; justify-content: center;
      color: #fff;
    }
    .bp-cd-img-letter {
      font-family: var(--font-display);
      font-size: 18px;
      font-weight: 400;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.92);
    }

    .bp-cd-text { flex: 1; min-width: 0; }
    .bp-cd-name {
      font-size: 13px;
      font-weight: 500;
      color: var(--color-text-primary);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .bp-cd-sub {
      font-size: 11px;
      color: var(--color-text-secondary);
      margin-top: 2px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .bp-cd-price {
      flex-shrink: 0;
      font-size: 13px;
      font-weight: 500;
      color: var(--color-text-primary);
      font-variant-numeric: tabular-nums;
    }

    /* Hover-only action buttons. Reserve their column space so the row
       doesn't shift when they appear. */
    .bp-cd-action {
      flex-shrink: 0;
      width: 22px; height: 22px;
      display: inline-flex; align-items: center; justify-content: center;
      border: none; background: transparent;
      color: var(--color-text-muted);
      cursor: pointer;
      opacity: 0;
      border-radius: 4px;
      transition: opacity 0.12s, background 0.12s, color 0.12s;
    }
    .bp-cd-row:hover .bp-cd-action { opacity: 1; }
    .bp-cd-action--remove:hover {
      color: var(--color-danger);
      background: rgba(225, 29, 72, 0.08);
    }
    .bp-cd-action--promote {
      color: #16a34a; /* green-600 */
    }
    .bp-cd-action--promote:hover {
      background: rgba(22, 163, 74, 0.10);
    }

    /* Hover tooltip — only on SELECTED rows, only when description exists.
       Sits below the row; row's :hover reveals it. */
    .bp-cd-tip {
      position: absolute;
      top: calc(100% + 4px);
      left: 0; right: 0;
      padding: 8px 10px;
      border: 0.5px solid var(--color-border);
      border-radius: 6px;
      background: var(--color-surface);
      box-shadow: var(--shadow-md);
      font-size: 12px;
      line-height: 1.45;
      color: var(--color-text-secondary);
      opacity: 0;
      pointer-events: none;
      transform: translateY(-2px);
      transition: opacity 0.15s, transform 0.15s;
      z-index: 10;
    }
    .bp-cd-row--selected:hover .bp-cd-tip {
      opacity: 1;
      transform: translateY(0);
      pointer-events: auto;
    }

    /* Footer — BALLPARK label + total. */
    .bp-cd-foot {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      width: 100%;
    }
    .bp-cd-foot-label {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--color-text-secondary);
    }
    .bp-cd-foot-total {
      font-size: 20px;
      font-weight: 500;
      color: var(--color-text-primary);
      font-variant-numeric: tabular-nums;
    }
  `]
})
export class CartDrawerComponent implements OnInit, OnDestroy {
  visible = false;
  projectId = '';

  selected: ProjectItem[] = [];
  wishlist: ProjectItem[] = [];

  /** v1.65ae — defaults are the All-view labels; openers that scope to
      a single category override via CartDrawerOptions. */
  contextLabel = 'PROJECT ITEMS';
  contextTitle = 'Your selections';
  private itemFilter: Set<string> | null = null;

  private sub?: Subscription;

  constructor(
    private svc: CartDrawerService,
    private projectItemSvc: ProjectItemService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.sub = this.svc.request$.subscribe(req => {
      this.projectId = req?.projectId || '';
      this.visible = !!req;
      const opts: CartDrawerOptions = req?.options || {};
      this.contextLabel = opts.contextLabel || 'PROJECT ITEMS';
      this.contextTitle = opts.contextTitle || 'Your selections';
      this.itemFilter = opts.itemIds ? new Set(opts.itemIds) : null;
      if (req) this.load();
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  onVisibleChange(open: boolean): void { if (!open) this.close(); }
  close(): void { this.svc.close(); }

  get totalCount(): number { return this.selected.length + this.wishlist.length; }
  get ballparkTotal(): number {
    return this.selected.reduce((s, pi) => s + (Number(pi.base_price) || 0), 0);
  }

  /** Build the background-image url, walking the fallback chain:
      item.image_url → supplier cover. Returns null when only the colour
      swatch (initial letter) should render. */
  imageStyle(pi: ProjectItem): string | null {
    const url = pi.image_url || pi.supplier_cover_url;
    return url ? `url('${url}')` : null;
  }
  /** Third-tier fallback — the category's icon_color as a solid swatch.
      Always returned so the letter has a tinted backdrop even when an
      image is present (the image covers it). */
  imageBgColor(pi: ProjectItem): string {
    return pi.category_icon_color || 'var(--theme-accent)';
  }
  initial(pi: ProjectItem): string {
    return (pi.name || '?').charAt(0).toUpperCase();
  }
  truncate(text: string): string {
    if (!text) return '';
    const t = text.trim();
    return t.length > 120 ? t.slice(0, 117).trimEnd() + '…' : t;
  }

  // ── data ────────────────────────────────────────────────────────────
  private load(): void {
    if (!this.projectId) return;
    this.projectItemSvc.getByProject(this.projectId).subscribe(rows => {
      const list = (rows || []).filter(r =>
        this.itemFilter ? this.itemFilter.has(r.item_id) : true
      );
      this.selected = list.filter(r => r.selection_type === 'selected');
      this.wishlist = list.filter(r => r.selection_type === 'liked');
      this.cdr.markForCheck();
    });
  }

  remove(pi: ProjectItem): void {
    if (!this.projectId) return;
    this.projectItemSvc.remove(this.projectId, pi.item_id).subscribe({
      next: () => {
        this.svc.markChanged(this.projectId);
        this.load();
      }
    });
  }

  /** Promote a wishlist item to selected. Same endpoint as add() — the
      backend upserts on (project_id, item_id) so the row's selection_type
      flips from 'liked' → 'selected' in place. */
  promote(pi: ProjectItem): void {
    if (!this.projectId) return;
    this.projectItemSvc.add(
      this.projectId, pi.item_id, 'selected', pi.project_category_id
    ).subscribe({
      next: () => {
        this.svc.markChanged(this.projectId);
        this.load();
      }
    });
  }
}
