import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidebarModule } from 'primeng/sidebar';
import { LucideAngularModule } from 'lucide-angular';
import { Subscription } from 'rxjs';

import { CartDrawerService, CartDrawerOptions } from '../../../core/services/cart-drawer.service';
import { ProjectItemService } from '../../../core/services/project-item.service';
import { ProjectService } from '../../../core/services/project.service';
import { ProjectCategoryService } from '../../../core/services/project-category.service';
import { OutreachService } from '../../../core/services/outreach.service';
import { ProjectItem } from '../../../models';
import { GbpPipe } from '../../pipes/gbp.pipe';

/** v1.65ef — units that bill per-attendee. Item.base_price for these
    is treated as a per-cover/per-head rate, so the cart-drawer total
    multiplies by project.guest_count for the extended line price.
    All other unit codes (each, platter, event, day, project, …) are
    treated as flat amounts. */
const PER_ATTENDEE_UNITS = new Set(['cover', 'head']);

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
  imports: [CommonModule, FormsModule, SidebarModule, LucideAngularModule, GbpPipe],
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
          <div *ngFor="let pi of selected" class="bp-list-row bp-cd-row bp-cd-row--selected">
            <div class="bp-cd-img"
                 [style.background-image]="imageStyle(pi)"
                 [style.background-color]="imageBgColor(pi)">
              <span *ngIf="!imageStyle(pi)" class="bp-cd-img-letter">{{ initial(pi) }}</span>
            </div>
            <div class="bp-cd-text">
              <div class="bp-cd-name" [title]="pi.name">{{ pi.name }}</div>
              <div class="bp-cd-sub">{{ pi.supplier_name || '—' }}</div>
            </div>
            <!-- v1.65ef — extended line price. For per-cover/per-head
                 items: shows the multiplied total (£X) with a small
                 sub-line "£base × N guests". Otherwise just the flat
                 base_price. -->
            <div class="bp-cd-price">
              {{ lineTotal(pi) | gbp }}
              <div *ngIf="isPerAttendee(pi)" class="bp-cd-price-sub">
                {{ (pi.base_price || 0) | gbp }} × {{ guestCountValue }}
              </div>
            </div>
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
          <div *ngFor="let pi of wishlist" class="bp-list-row bp-cd-row bp-cd-row--wishlist">
            <div class="bp-cd-img"
                 [style.background-image]="imageStyle(pi)"
                 [style.background-color]="imageBgColor(pi)">
              <span *ngIf="!imageStyle(pi)" class="bp-cd-img-letter">{{ initial(pi) }}</span>
            </div>
            <div class="bp-cd-text">
              <div class="bp-cd-name" [title]="pi.name">{{ pi.name }}</div>
              <div class="bp-cd-sub">{{ pi.supplier_name || '—' }}</div>
            </div>
            <div class="bp-cd-price">
              {{ lineTotal(pi) | gbp }}
              <div *ngIf="isPerAttendee(pi)" class="bp-cd-price-sub">
                {{ (pi.base_price || 0) | gbp }} × {{ guestCountValue }}
              </div>
            </div>
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

        <!-- v1.65ep — ADDITIONAL ASKS: title-only "create" rows the
             agent adds in-cart. They aren't project_items yet — the
             outreach send promotes them into items rows (pending) +
             links them as message_items per the existing Create path
             in taxonomy.requestQuotes. -->
        <div class="bp-field-label bp-cd-eyebrow">ADDITIONAL ASKS</div>
        <ng-container *ngIf="adhocAsks.length; else noAsks">
          <div *ngFor="let a of adhocAsks; let i = index"
               class="bp-list-row bp-cd-row bp-cd-row--adhoc">
            <div class="bp-cd-img bp-cd-img--adhoc">
              <lucide-icon name="sparkles" [size]="13"></lucide-icon>
            </div>
            <div class="bp-cd-text">
              <div class="bp-cd-name" [title]="a.name">{{ a.name }}</div>
              <div class="bp-cd-sub">Additional ask</div>
            </div>
            <div class="bp-cd-price">—</div>
            <button type="button"
                    class="bp-cd-action bp-cd-action--remove"
                    title="Remove"
                    (click)="removeAsk(i)">
              <lucide-icon name="x" [size]="13"></lucide-icon>
            </button>
          </div>
        </ng-container>
        <ng-template #noAsks>
          <div class="bp-cd-empty">
            Need something that's not in the catalogue? Add it below.
          </div>
        </ng-template>

        <!-- Title-only add input — Enter or + commits. -->
        <div class="bp-cd-addask">
          <input type="text"
                 class="bp-cd-addask-input"
                 [(ngModel)]="newAskName"
                 (keyup.enter)="addAsk()"
                 placeholder="Add an ask (e.g. open bar for cocktails)"/>
          <button type="button"
                  class="bp-cd-addask-btn"
                  [disabled]="!newAskName.trim()"
                  (click)="addAsk()">
            <lucide-icon name="plus" [size]="13"></lucide-icon>
            Add
          </button>
        </div>
      </div>

      <ng-template pTemplate="footer">
        <!-- v1.65eg — estimate-style summary. Matches the layout on
             the project Estimate tab: Your cost / Margin / VAT /
             CLIENT TOTAL (highlighted in theme-soft). Skips the
             contingency line that the full estimate carries — the
             cart drawer is a quick "what's this going to cost"
             glance, not the full breakdown. -->
        <div class="bp-cd-foot bp-cd-foot--summary" *ngIf="selected.length">
          <div class="bp-cd-foot-row bp-cd-foot-row--cost">
            <span class="bp-cd-foot-label">Your cost</span>
            <span class="bp-cd-foot-value">{{ yourCost | gbp }}</span>
          </div>
          <div class="bp-cd-foot-row bp-cd-foot-row--meta">
            <span class="bp-cd-foot-meta-label">Margin ({{ marginPct }}%)</span>
            <span class="bp-cd-foot-meta-value">{{ marginAmount | gbp }}</span>
          </div>
          <div class="bp-cd-foot-row bp-cd-foot-row--meta" *ngIf="vatPct > 0">
            <span class="bp-cd-foot-meta-label">VAT ({{ vatPct }}%)</span>
            <span class="bp-cd-foot-meta-value">{{ vatAmount | gbp }}</span>
          </div>
          <div class="bp-cd-foot-client">
            <span class="bp-cd-foot-client-label">CLIENT TOTAL</span>
            <span class="bp-cd-foot-client-value">{{ clientTotal | gbp }}</span>
          </div>

          <!-- v1.65eh — budget headroom card. Same shape + class
               naming as the Estimate page's bp-est-budget-card.
               Only renders when project.budget is set (>0). -->
          <div class="bp-cd-budget-card"
               *ngIf="budget > 0"
               [class.over]="isOverBudget">
            <div class="bp-cd-budget-header">
              <lucide-icon [name]="isOverBudget ? 'alert-triangle' : 'check-square'" [size]="16"></lucide-icon>
              <span class="bp-cd-budget-label">{{ isOverBudget ? 'Over budget' : 'Within budget' }}</span>
              <span class="bp-cd-budget-diff">{{ budgetDiff | gbp }}</span>
            </div>
            <div class="bp-cd-budget-bar-wrap">
              <div class="bp-cd-budget-bar" [style.width.%]="barPct"></div>
            </div>
            <div class="bp-cd-budget-footer">
              <span>Client total {{ clientTotal | gbp }}</span>
              <span>Budget {{ budget | gbp }}</span>
            </div>
            <div class="bp-cd-budget-sub">
              {{ barPct | number:'1.0-0' }}%
              {{ isOverBudget ? 'over budget' : 'under budget — you have headroom to add more' }}
            </div>
          </div>

          <!-- v1.65ek — Send brief CTA. Launches the 4-step outreach
               train (Suppliers → Requirements → Review → Send)
               pre-populated from the cart's items + supplier set. -->
          <button type="button"
                  class="bp-cd-send-cta"
                  [disabled]="!canSendBrief"
                  (click)="sendBrief()">
            <lucide-icon name="send" [size]="14"></lucide-icon>
            <span>Send brief to suppliers</span>
            <lucide-icon name="arrow-right" [size]="14" class="bp-cd-send-cta-chev"></lucide-icon>
          </button>
        </div>
        <!-- Empty state — keep the band so the drawer chrome stays
             stable even when SELECTED is empty. -->
        <div class="bp-cd-foot" *ngIf="!selected.length">
          <span class="bp-cd-foot-label">CLIENT TOTAL</span>
          <span class="bp-cd-foot-total">£0</span>
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

    /* v1.65aj (p0001) — row chrome (border / radius / padding / hover)
       now comes from the shared .bp-list-row primitive in styles.css.
       Only cart-specific additions live here: vertical rhythm between
       rows + the absolute-positioned hover tooltip. */
    .bp-cd-row { margin-bottom: 6px; }

    .bp-cd-img {
      flex-shrink: 0;
      width: 44px; height: 44px;
      border-radius: var(--radius-button);
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
      text-align: right;
    }
    /* v1.65ef — small "£rate × guests" line under the extended total
       for per-cover / per-head items. Muted so the eye lands on the
       extended figure first. */
    .bp-cd-price-sub {
      font-size: 10px;
      font-weight: 400;
      color: var(--color-text-muted);
      letter-spacing: 0.01em;
      margin-top: 1px;
    }

    /* v1.65ep — ad-hoc ask rows + add-input. Same row primitive as
       SELECTED / WISHLIST so the visual rhythm is unbroken; ad-hoc
       rows get a theme-accent sparkles glyph in place of the image
       to mark them as Create-path. */
    .bp-cd-row--adhoc { background: var(--theme-soft); }
    .bp-cd-img--adhoc {
      background: var(--theme-accent);
      color: var(--color-surface);
      display: flex; align-items: center; justify-content: center;
    }
    .bp-cd-img--adhoc lucide-icon { color: inherit; }
    .bp-cd-addask {
      display: flex;
      gap: 8px;
      margin-top: 10px;
    }
    .bp-cd-addask-input {
      flex: 1;
      padding: 8px 10px;
      font-family: var(--font-body);
      font-size: 12.5px;
      color: var(--color-text-primary);
      background: var(--theme-bg);
      border: 0.5px solid var(--color-border);
      border-radius: 7px;
      outline: none;
    }
    .bp-cd-addask-input:focus {
      border-color: var(--theme-accent);
      background: var(--color-surface);
    }
    .bp-cd-addask-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 7px 12px;
      background: var(--theme-accent);
      color: var(--color-surface);
      border: none;
      border-radius: 7px;
      font-family: var(--font-body);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s;
    }
    .bp-cd-addask-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .bp-cd-addask-btn:hover:not(:disabled) { opacity: 0.85; }

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
      border: var(--border-hairline);
      border-radius: var(--radius-button);
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

    /* Footer — BALLPARK label + total (legacy / empty-state shape). */
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

    /* v1.65eg — estimate-style summary footer. Stacks Your cost,
       Margin, VAT, then CLIENT TOTAL in a theme-soft pill. Mirrors
       the project Estimate page chrome so the two surfaces feel
       like the same number presented at different fidelity. */
    .bp-cd-foot--summary {
      flex-direction: column;
      align-items: stretch;
      gap: 0;
    }
    .bp-cd-foot-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      padding: 4px 0;
    }
    .bp-cd-foot-row--cost {
      padding-bottom: 10px;
      border-bottom: 0.5px solid var(--color-border);
      margin-bottom: 6px;
    }
    .bp-cd-foot-value {
      font-family: var(--font-display);
      font-size: 22px;
      font-weight: 500;
      color: var(--color-text-primary);
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.01em;
    }
    .bp-cd-foot-meta-label,
    .bp-cd-foot-meta-value {
      font-size: 12px;
      color: var(--color-text-muted);
      font-variant-numeric: tabular-nums;
    }
    .bp-cd-foot-client {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      padding: 12px 14px;
      margin-top: 10px;
      background: var(--theme-soft);
      border-radius: var(--radius-card);
    }
    .bp-cd-foot-client-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--theme-accent);
    }
    .bp-cd-foot-client-value {
      font-family: var(--font-display);
      font-size: 22px;
      font-weight: 500;
      color: var(--theme-accent);
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.01em;
    }

    /* v1.65eh — budget headroom card. Same chrome + state colours as
       the Estimate page's .bp-est-budget-card; class names scoped to
       the cart drawer so the two surfaces can evolve independently. */
    .bp-cd-budget-card {
      margin-top: 10px;
      padding: 12px 14px;
      background: var(--color-booked-soft, rgba(5,150,105,0.10));
      border: 0.5px solid var(--color-booked, #059669);
      border-radius: var(--radius-card);
    }
    .bp-cd-budget-card.over {
      background: var(--color-action-soft, rgba(236,31,109,0.10));
      border-color: var(--color-action, #DC2626);
    }
    .bp-cd-budget-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
    }
    .bp-cd-budget-header lucide-icon {
      color: var(--color-booked, #059669);
    }
    .bp-cd-budget-card.over .bp-cd-budget-header lucide-icon {
      color: var(--color-action, #DC2626);
    }
    .bp-cd-budget-label {
      flex: 1;
      font-size: 13px;
      font-weight: 600;
      color: var(--color-booked, #059669);
    }
    .bp-cd-budget-card.over .bp-cd-budget-label {
      color: var(--color-action, #DC2626);
    }
    .bp-cd-budget-diff {
      font-size: 13px;
      font-weight: 600;
      color: var(--color-booked, #059669);
      font-variant-numeric: tabular-nums;
    }
    .bp-cd-budget-card.over .bp-cd-budget-diff {
      color: var(--color-action, #DC2626);
    }
    .bp-cd-budget-bar-wrap {
      height: 6px;
      background: rgba(0,0,0,0.08);
      border-radius: var(--radius-pill);
      overflow: hidden;
      margin-bottom: 8px;
    }
    .bp-cd-budget-bar {
      height: 100%;
      background: var(--color-booked, #059669);
      border-radius: var(--radius-pill);
      transition: width 0.4s;
      max-width: 100%;
    }
    .bp-cd-budget-card.over .bp-cd-budget-bar {
      background: var(--color-action, #DC2626);
    }
    .bp-cd-budget-footer {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: var(--color-text-muted);
      margin-bottom: 4px;
    }
    .bp-cd-budget-sub {
      font-size: 11px;
      color: var(--color-text-muted);
    }

    /* v1.65ek — Send brief CTA. Sits below the budget card; theme-
       accent fill so it reads as the primary forward action on the
       drawer. Disabled state mutes to neutral when there's nothing
       to send. */
    .bp-cd-send-cta {
      margin-top: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      padding: 12px 16px;
      background: var(--theme-accent);
      color: var(--color-surface);
      border: none;
      border-radius: var(--radius-button);
      font-family: var(--font-body);
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.01em;
      cursor: pointer;
      transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
    }
    .bp-cd-send-cta:hover:not(:disabled) {
      box-shadow: var(--shadow-sm);
      transform: translateY(-1px);
    }
    .bp-cd-send-cta:active:not(:disabled) {
      transform: translateY(0);
    }
    .bp-cd-send-cta:disabled {
      background: var(--color-border);
      color: var(--color-text-muted);
      cursor: not-allowed;
    }
    .bp-cd-send-cta lucide-icon {
      color: inherit;
      flex-shrink: 0;
    }
    .bp-cd-send-cta-chev {
      margin-left: auto;
    }
  `]
})
export class CartDrawerComponent implements OnInit, OnDestroy {
  visible = false;
  projectId = '';

  selected: ProjectItem[] = [];
  wishlist: ProjectItem[] = [];

  /** v1.65ep — title-only "additional asks" the agent adds in-cart.
      These aren't project_items yet — they live as session state on
      the drawer until "Send brief" promotes them via the existing
      Create path in taxonomy.requestQuotes (server creates a pending
      items row + message_item per supplier). Ephemeral by design:
      they're brief-shaped, not project-shaped. */
  adhocAsks: { name: string }[] = [];
  newAskName = '';

  /** v1.65ae — defaults are the All-view labels; openers that scope to
      a single category override via CartDrawerOptions. */
  contextLabel = 'PROJECT ITEMS';
  contextTitle = 'Your selections';
  private itemFilter: Set<string> | null = null;
  /** v1.65ej — active category id when the drawer is opened scoped
      to one category (e.g. Catering). Drives the budget headroom
      card to read the per-category ballpark_budget instead of the
      project-wide project_budget. */
  private contextCategoryId: string | null = null;

  /** v1.65ef — project guest_count drives per-cover / per-head line
      math. Loaded alongside the project_items on every open(). 0
      means "unknown" and falls back to flat pricing so an item
      doesn't read as £0 for a fresh project that hasn't set guest
      count yet. */
  private guestCount = 0;

  /** v1.65eg — margin + VAT come from the project row's defaults
      (which inherit from the agency org). 20%/20% used as a sane
      fallback if the project hasn't overridden either yet. */
  marginPct = 20;
  vatPct = 20;

  /** v1.65eh — project.budget drives the headroom indicator below
      the CLIENT TOTAL. 0 means "no budget set" and the card hides
      entirely (same gate as the Estimate page). */
  budget = 0;

  private sub?: Subscription;

  constructor(
    private svc: CartDrawerService,
    private projectItemSvc: ProjectItemService,
    private projectSvc: ProjectService,
    private projectCategorySvc: ProjectCategoryService,
    private outreach: OutreachService,
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
      this.contextCategoryId = opts.contextCategoryId || null;
      // v1.65ep — reset ad-hoc asks every open so the drawer starts
      // fresh per project visit. (Persistence is a v2 — would need
      // a project_asks table or similar.)
      this.adhocAsks = [];
      this.newAskName = '';
      if (req) this.load();
      this.cdr.markForCheck();
    });
  }

  /** v1.65ep — commit a title-only ad-hoc ask into the cart. Trims
      and de-dupes (case-insensitive). */
  addAsk(): void {
    const name = (this.newAskName || '').trim();
    if (!name) return;
    const exists = this.adhocAsks.some(a => a.name.toLowerCase() === name.toLowerCase());
    if (!exists) this.adhocAsks.push({ name });
    this.newAskName = '';
    this.cdr.markForCheck();
  }
  removeAsk(idx: number): void {
    this.adhocAsks.splice(idx, 1);
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  onVisibleChange(open: boolean): void { if (!open) this.close(); }
  close(): void { this.svc.close(); }

  get totalCount(): number { return this.selected.length + this.wishlist.length; }

  /** v1.65ef — extended line price. Per-cover/per-head items multiply
      base_price by project.guest_count; everything else is flat.
      Falls back to flat when guest_count is missing/0. */
  lineTotal(pi: ProjectItem): number {
    const base = Number(pi.base_price) || 0;
    const unit = (pi.unit || '').toLowerCase();
    if (this.guestCount > 0 && PER_ATTENDEE_UNITS.has(unit)) {
      return base * this.guestCount;
    }
    return base;
  }

  /** Helper for the row template — true when this item bills per
      attendee AND we know the guest count, so we can show the small
      "× N" multiplier breakdown under the price. */
  isPerAttendee(pi: ProjectItem): boolean {
    const unit = (pi.unit || '').toLowerCase();
    return this.guestCount > 0 && PER_ATTENDEE_UNITS.has(unit);
  }

  get guestCountValue(): number { return this.guestCount; }

  get ballparkTotal(): number {
    return this.selected.reduce((s, pi) => s + this.lineTotal(pi), 0);
  }

  // ── v1.65eg — estimate-style breakdown for the footer ──────────────
  // Mirrors features/projects/.../estimate.component.ts recalc():
  //   yourCost   = sum of lineTotals (subtotal of SELECTED rows)
  //   margin     = yourCost × marginPct/100
  //   preVat     = yourCost + margin
  //   vat        = preVat × vatPct/100
  //   clientTotal= preVat + vat
  // Contingency is omitted here (the full Estimate page includes it;
  // the cart drawer is a quick at-a-glance summary).
  get yourCost():    number { return this.ballparkTotal; }
  get marginAmount(): number { return this.yourCost * (this.marginPct / 100); }
  get vatAmount():   number {
    return (this.yourCost + this.marginAmount) * (this.vatPct / 100);
  }
  get clientTotal(): number {
    return this.yourCost + this.marginAmount + this.vatAmount;
  }

  // ── v1.65eh — budget headroom (mirrors estimate.component recalc) ─
  /** £ difference vs budget. Positive when over, negative when under
      (we display the absolute via | gbp; the sign of the diff drives
      the prefix sign in the row). */
  get budgetDiff(): number {
    return this.budget > 0 ? this.clientTotal - this.budget : 0;
  }
  /** Width-percent for the progress bar — clamped to 100% so the
      fill never overruns its track even when way over budget. */
  get barPct(): number {
    if (this.budget <= 0) return 0;
    return Math.min((this.clientTotal / this.budget) * 100, 100);
  }
  get isOverBudget(): boolean {
    return this.budget > 0 && this.clientTotal > this.budget;
  }

  // ── v1.65ek — Send brief to suppliers ─────────────────────────────
  /** True when there's at least one selected item with a supplier,
      OR there's at least one ad-hoc ask (which always needs a
      supplier picked in step 1 of the outreach drawer regardless).
      Drives the CTA's disabled state.
      v1.65ep — ad-hoc asks alone now enable the CTA; the outreach
      drawer's step 1 lets the agent pick suppliers for ask-only
      briefs. */
  get canSendBrief(): boolean {
    const hasSelectedWithSupplier = this.selected.length > 0
        && this.selected.some(pi => !!(pi as any).supplier_org_id);
    return hasSelectedWithSupplier || this.adhocAsks.length > 0;
  }

  /** v1.65ek — open the existing 4-step outreach drawer (Suppliers →
      Requirements → Review → Send) pre-populated from the cart. The
      outreach flow expects ONE OutreachItem; we synthesise a "cart
      brief" item that bundles every selected row so the suppliers
      see the whole ask in one email. Cart drawer closes so the
      outreach drawer takes focus. */
  sendBrief(): void {
    if (!this.canSendBrief) return;

    // Collect unique supplier_org_ids from the cart selection — these
    // get pre-ticked in step 1 (Suppliers) of the outreach drawer.
    const supplierMap = new Map<string, string>();
    for (const pi of this.selected) {
      const sid = (pi as any).supplier_org_id as string | undefined;
      if (sid) supplierMap.set(sid, pi.supplier_name || '');
    }
    const suppliers = Array.from(supplierMap.entries())
      .map(([id, name]) => ({ supplier_id: id, supplier_name: name }));

    // Use the cart's dominant category (first item's category) as the
    // outreach category. Multi-category carts pick the first; the
    // user can adjust suppliers in step 1 if needed. v2 will split
    // by category automatically.
    const first: any = this.selected[0];
    const categoryId = first?.item_category_id || first?.project_category_id || '';

    // v1.65em — pass structured cart rows so the outreach drawer's
    // step 2 can render them as a row list (image + name + line
    // total) instead of a flat bullet string buried in the
    // "additional details" textarea. The drawer adds an "Add
    // additional ask" input on top so the agent can append ad-hoc
    // items (e.g. "open bar for cocktails") that don't have
    // catalogue rows.
    const cartItems = this.selected.map(pi => ({
      item_id: pi.item_id,
      name: pi.name || 'Item',
      description: pi.description || '',
      image_url: pi.image_url || pi.supplier_cover_url || null,
      base_price: Number(pi.base_price) || 0,
      unit: pi.unit || null,
      line_total: this.lineTotal(pi),
      supplier_org_id: (pi as any).supplier_org_id || null,
      supplier_name: pi.supplier_name || null,
    }));

    // v1.65ep — count includes ad-hoc asks. The outreach drawer's
    // "N-item brief" title now reflects the full picture.
    const totalAsks = this.selected.length + this.adhocAsks.length;

    this.outreach.open({
      // Synthesised single-item kept for back-compat with the
      // existing per-item outreach callers; the drawer prefers
      // cartItems when set.
      item: {
        name: totalAsks === 1
          ? (this.selected[0]?.name || this.adhocAsks[0]?.name || 'Cart item')
          : `${totalAsks}-item brief`,
        description: '',
        price: this.yourCost,
        isNew: true,
      },
      categoryId,
      projectId: this.projectId,
      suppliers,
      cartItems,
      adhocAsks: this.adhocAsks.map(a => a.name),
      guestCount: this.guestCount,
    });

    // Close the cart drawer so the outreach drawer is the only
    // active overlay; user can come back to the cart afterwards
    // via the marketplace cart icon.
    this.close();
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
    // v1.65ef — pull the project alongside the items so the
    // per-attendee line math (base_price × guest_count) has a number
    // to multiply by. Reset to 0 first so a missing project doesn't
    // surface stale guests from a prior open.
    this.guestCount = 0;
    this.projectSvc.getById(this.projectId).subscribe(p => {
      this.guestCount = Number((p as any)?.guest_count) || 0;
      // v1.65eg — pull margin + VAT defaults off the project row.
      // Falls back to 20/20 when null (matches the estimate
      // component's same defaults).
      this.marginPct = Number((p as any)?.default_margin_pct) || 20;
      this.vatPct    = Number((p as any)?.default_vat_pct)    || 20;
      // v1.65eh — project.project_budget (set on intake / in the
      // project summary) feeds the headroom card under CLIENT TOTAL.
      // Field name is project_budget (NOT budget); same field
      // estimate.component reads.
      // v1.65ej — category-scoped opens override this with the
      // per-category ballpark_budget (loaded below). The project-
      // wide value is the fallback when no contextCategoryId is set
      // OR when the category doesn't carry its own budget.
      this.budget    = Number((p as any)?.project_budget)     || 0;
      this.cdr.markForCheck();
    });

    // v1.65ej — when scoped to a single category, look up that
    // project_category and prefer its ballpark_budget over the
    // project-wide project_budget. Order doesn't matter relative to
    // the project load above — last one to land wins; with category
    // scope, the category budget should win.
    if (this.contextCategoryId) {
      this.projectCategorySvc.getByProject(this.projectId).subscribe(rows => {
        const cat = (rows || []).find(c =>
          (c as any).category_id === this.contextCategoryId
        );
        const catBudget = Number((cat as any)?.ballpark_budget) || 0;
        if (catBudget > 0) {
          this.budget = catBudget;
          this.cdr.markForCheck();
        }
      });
    }
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
