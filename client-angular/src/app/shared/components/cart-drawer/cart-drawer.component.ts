import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidebarModule } from 'primeng/sidebar';
import { LucideAngularModule } from 'lucide-angular';
import { Subscription } from 'rxjs';

import { CartDrawerService, CartDrawerOptions, CartDrawerRow, CartDrawerRowAction } from '../../../core/services/cart-drawer.service';
import { ProjectItemService } from '../../../core/services/project-item.service';
import { ProjectService } from '../../../core/services/project.service';
import { ProjectCategoryService } from '../../../core/services/project-category.service';
import { OutreachService } from '../../../core/services/outreach.service';
import { ProjectItem } from '../../../models';
import { GbpPipe } from '../../pipes/gbp.pipe';
import { ImageUploadPanelComponent } from '../image-upload-panel/image-upload-panel.component';

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
  imports: [CommonModule, FormsModule, SidebarModule, LucideAngularModule, GbpPipe, ImageUploadPanelComponent],
  template: `
    <p-sidebar [(visible)]="visible"
               (visibleChange)="onVisibleChange($event)"
               position="right"
               [style]="{ width: 'min(880px, 92vw)' }"
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

      <!-- v1.65f9 — 2-column drawer body. Items list (selected,
           wishlist, ad-hoc) lives in col 1; the summary block
           (totals, budget headroom, textarea, Send CTA) lives in
           col 2 so the user can see what they're buying and what it
           costs at the same time. Drawer width doubled to
           min(880px, 92vw) to make room. Footer template removed —
           the Send action now lives in col 2's summary stack. -->
      <div class="bp-cd-grid">
      <div class="bp-cd-body bp-cd-grid-items">
        <!-- SELECTED ----------------------------------------------- -->
        <div class="bp-field-label bp-cd-eyebrow">SELECTED</div>
        <ng-container *ngIf="selected.length; else noSel">
          <ng-container *ngFor="let pi of selected">
          <div class="bp-list-row bp-cd-row bp-cd-row--selected"
               [class.bp-cd-row--accepted]="rowStatus(pi) === 'accepted'"
               [class.bp-cd-row--declined]="isDeclined(pi)">
            <div class="bp-cd-img"
                 [style.background-image]="imageStyle(pi)"
                 [style.background-color]="imageBgColor(pi)">
              <span *ngIf="!imageStyle(pi)" class="bp-cd-img-letter">{{ initial(pi) }}</span>
            </div>
            <div class="bp-cd-text">
              <div class="bp-cd-name" [title]="pi.name">{{ pi.name }}</div>
              <div class="bp-cd-sub">{{ pi.supplier_name || '—' }}</div>
              <!-- v1.65et → v1.65f8 — status badge no longer gated
                   on isSupplier. Both viewers see "Quoted" /
                   "Accepted" / "Declined" / "Booked" when a row has
                   a status. The agent reviewing a supplier's reply
                   needs the same visibility the supplier does. -->
              <div *ngIf="rowStatus(pi)"
                   class="bp-cd-row-status"
                   [class.bp-cd-row-status--ok]="rowStatus(pi) === 'accepted' || rowStatus(pi) === 'quoted' || rowStatus(pi) === 'adjusted_by_supplier'"
                   [class.bp-cd-row-status--bad]="isDeclined(pi)">
                {{ rowStatusLabel(pi) }}
              </div>
              <!-- v1.65f4 → v1.65f8 — breakdown line shown for both
                   viewers ("£85 / head × 250 guests"). Replaces the
                   old supplier-only bare-rate cell so the card reads
                   the same regardless of who's looking. -->
              <div class="bp-cd-price-line">
                {{ rateLine(pi) }}
              </div>
            </div>
            <!-- v1.65f3 → v1.65f8 — unified row layout. Both modes
                 share the same grid: text block (col 2), line total
                 (col 3 spanning rows 1-2), and an action band on row
                 2. The action band's contents differ by role —
                 stepper + remove × for the agent, 4-action cluster
                 for the supplier — but the layout/typography/spacing
                 are identical. -->

            <!-- v1.65f4 — stepper hoisted out of .bp-cd-price into its
                 own grid cell on row 2 so it sits cleanly on its own
                 line every time (no wrap-when-breakdown-is-long). -->
            <div class="bp-cd-qty" *ngIf="!isSupplier && pi.item_id"
                 (click)="$event.stopPropagation()">
              <button type="button" class="bp-cd-qty-btn"
                      [disabled]="qtyOf(pi) <= 1 || qtySaving[pi.id]"
                      (click)="onQtyMinus(pi)"
                      title="Decrease">−</button>
              <span class="bp-cd-qty-n">{{ stepperValue(pi) | number }}</span>
              <button type="button" class="bp-cd-qty-btn"
                      [disabled]="qtySaving[pi.id]"
                      (click)="onQtyPlus(pi)"
                      title="Increase">+</button>
            </div>
            <!-- v1.65f3 → v1.65f8 — line total visible to both
                 viewers. Big serif number in col 3 so the row reads
                 "this line costs £21,250" at a glance for either
                 role. -->
            <div class="bp-cd-row-total">
              {{ lineTotal(pi) | gbp }}
            </div>
            <!-- v1.65et → v1.65eu — supplier mode action cluster.
                 Circular icon buttons (consistent with the rest of
                 the app's selector pattern: outline at rest, bold
                 theme-accent fill when active). Four actions:
                 Accept, Adjust, Image, Decline. -->
            <ng-container *ngIf="isSupplier; else agentActions">
              <div class="bp-cd-row-actions">
                <button type="button"
                        class="bp-cd-row-act bp-cd-row-act--accept"
                        [class.bp-cd-row-act--active]="rowStatus(pi) === 'accepted'"
                        title="Accept"
                        (click)="onRowAccept(pi)">
                  <lucide-icon name="check" [size]="13"></lucide-icon>
                </button>
                <button type="button"
                        class="bp-cd-row-act bp-cd-row-act--adjust"
                        [class.bp-cd-row-act--active]="adjustOpenId === pi.id || rowStatus(pi) === 'adjusted_by_supplier' || rowStatus(pi) === 'quoted'"
                        title="Adjust — set price / details"
                        (click)="toggleAdjust(pi)">
                  <lucide-icon name="square-pen" [size]="13"></lucide-icon>
                </button>
                <button type="button"
                        class="bp-cd-row-act bp-cd-row-act--image"
                        [class.bp-cd-row-act--active]="!!pi.image_url || imageOpenId === pi.id"
                        title="Photo — upload, search, or paste"
                        (click)="toggleImage(pi)">
                  <lucide-icon name="image" [size]="13"></lucide-icon>
                </button>
                <button type="button"
                        class="bp-cd-row-act bp-cd-row-act--decline"
                        [class.bp-cd-row-act--active]="isDeclined(pi)"
                        title="Decline"
                        (click)="onRowDecline(pi)">
                  <lucide-icon name="x" [size]="13"></lucide-icon>
                </button>
              </div>
            </ng-container>
            <ng-template #agentActions>
              <button type="button"
                      class="bp-cd-action bp-cd-action--remove"
                      title="Remove from project"
                      (click)="remove(pi)">
                <lucide-icon name="x" [size]="13"></lucide-icon>
              </button>
            </ng-template>
            <!-- v1.65ab — hover-only description tooltip. Truncated to
                 ~120 chars so the panel doesn't balloon. -->
            <div class="bp-cd-tip" *ngIf="pi.description">{{ truncate(pi.description) }}</div>
          </div>

          <!-- v1.65et — inline Adjust editor. Renders BELOW the row
               when the supplier clicks the pencil. Sets price per
               head + photo URL + optional name/description override.
               Save → emits cartDrawerSvc.rowAction$ which the inbox
               catches and routes through onItemAction (the existing
               reply pipeline). When the underlying item is an
               agency-pending placeholder, the server forks a
               supplier-owned catalogue items row in the same
               transaction (transitionItem.maybeForkCatalogueItem). -->
          <div *ngIf="isSupplier && adjustOpenId === pi.id"
               class="bp-cd-adjust">
            <div class="bp-cd-adjust-hd">Quote &amp; add to catalogue</div>
            <div class="bp-cd-adjust-row">
              <label class="bp-cd-adjust-lbl">Name</label>
              <input type="text" class="bp-cd-adjust-input"
                     [(ngModel)]="adjustForm.name"
                     [placeholder]="pi.name"/>
            </div>
            <!-- v1.65eu — Price + unit selector (was a text input).
                 Supplier picks how they want to bill: per cover, per
                 head, each, package, table, day, event. Per-cover
                 / per-head trigger the × guest_count multiplier in
                 the cart totals; the others stay flat. -->
            <div class="bp-cd-adjust-row">
              <label class="bp-cd-adjust-lbl">Price</label>
              <input type="number" class="bp-cd-adjust-input bp-cd-adjust-price"
                     [(ngModel)]="adjustForm.price"
                     min="0" step="1" placeholder="0"/>
              <select class="bp-cd-adjust-input bp-cd-adjust-unit-sel"
                      [(ngModel)]="adjustForm.unit">
                <option *ngFor="let u of unitOptions" [value]="u.code">
                  per {{ u.label }}
                </option>
              </select>
            </div>
            <div class="bp-cd-adjust-row">
              <label class="bp-cd-adjust-lbl">Description</label>
              <textarea class="bp-cd-adjust-input bp-cd-adjust-textarea" rows="2"
                        [(ngModel)]="adjustForm.description"
                        placeholder="Short description for the catalogue"></textarea>
            </div>
            <div class="bp-cd-adjust-foot">
              <span class="bp-cd-adjust-note">
                <lucide-icon name="sparkles" [size]="11"></lucide-icon>
                Adds to your catalogue
              </span>
              <button type="button" class="bp-cd-adjust-cancel"
                      (click)="cancelAdjust()">Cancel</button>
              <button type="button" class="bp-cd-adjust-save"
                      [disabled]="!canSaveAdjust"
                      (click)="onRowAdjust(pi)">
                <lucide-icon name="check" [size]="13"></lucide-icon> Save
              </button>
            </div>
          </div>

          <!-- v1.65eu — Image upload panel. Mounts inline below the
               row when the supplier clicks the Image button. Reuses
               the shared ImageUploadPanel (same one item-drawer +
               supplier-detail use). On save, the cover URL flows
               into adjustForm.imageUrl and the row's image_url is
               optimistically updated; the supplier still needs to
               press Adjust → Save to commit the catalogue write. -->
          <!-- v1.65ew — entityId is the catalogue items row id (not
               the message_items row), so the storage upload targets
               a real items record. For Unsplash search the entityId
               is just used for the storage path; for File Upload the
               server keys the file by entityId so it has to exist.
               Falls back to message_items.id when item_id is null
               (rare — happens only if the row hasn't been forked
               yet). -->
          <app-image-upload-panel
            *ngIf="isSupplier && imageOpenId === pi.id"
            [entityId]="pi.item_id || pi.id"
            type="item"
            [existingCoverUrl]="adjustForm.imageUrl || pi.image_url || ''"
            [existingImageDisplay]="'cover'"
            [searchTerm]="adjustForm.name || pi.name || ''"
            (imagesUpdated)="onImagePicked(pi, $event)"
            (closed)="closeImage()">
          </app-image-upload-panel>
          </ng-container>
        </ng-container>
        <ng-template #noSel>
          <div class="bp-cd-empty">No items selected yet</div>
        </ng-template>

        <!-- WISHLIST ----------------------------------------------- -->
        <!-- v1.65es — agent-only section. Suppliers don't need the
             wishlist concept; they're reviewing a delivered brief. -->
        <ng-container *ngIf="!isSupplier">
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
        </ng-container>

        <!-- v1.65ep — ADDITIONAL ASKS: title-only "create" rows the
             agent adds in-cart. They aren't project_items yet — the
             outreach send promotes them into items rows (pending) +
             links them as message_items per the existing Create path
             in taxonomy.requestQuotes.
             v1.65es — agent-only. Suppliers see ad-hoc asks already
             materialised as SELECTED rows (one per message_item). -->
        <ng-container *ngIf="!isSupplier">
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
        </ng-container>
      </div><!-- /.bp-cd-grid-items -->

      <!-- v1.65f9 — summary column on the right of the 2-col grid.
           Sticky vertical stack that holds the cost breakdown,
           budget headroom, optional textarea (supplier), and the
           Send CTA. Same content the old pTemplate="footer" carried,
           now living inside the body so it can sit next to the
           items list instead of below it. -->
      <aside class="bp-cd-grid-summary">
        <!-- v1.65es → v1.65ew — supplier-side footer. Totals on top,
             then auto-summary chip, then wrap-up textarea, then the
             Send reply CTA. The whole block lives in one *ngIf so
             the supplier always sees the action affordances even
             before they queue anything (sending just a message is
             also valid). -->
        <div class="bp-cd-foot bp-cd-foot--supplier" *ngIf="isSupplier">
          <ng-container *ngIf="selected.length">
            <div class="bp-cd-foot-row bp-cd-foot-row--cost">
              <span class="bp-cd-foot-label">Cost per head</span>
              <span class="bp-cd-foot-value">{{ perHeadTotal | gbp }}</span>
            </div>
            <div class="bp-cd-foot-row bp-cd-foot-row--meta" *ngIf="guestCountValue > 0">
              <span class="bp-cd-foot-meta-label">× {{ guestCountValue }} guests</span>
              <span class="bp-cd-foot-meta-value">{{ yourCost | gbp }}</span>
            </div>
            <div class="bp-cd-foot-row bp-cd-foot-row--meta" *ngIf="vatPct > 0">
              <span class="bp-cd-foot-meta-label">VAT ({{ vatPct }}%)</span>
              <span class="bp-cd-foot-meta-value">{{ vatOnCost | gbp }}</span>
            </div>
            <div class="bp-cd-foot-client">
              <span class="bp-cd-foot-client-label">CLIENT TOTAL</span>
              <span class="bp-cd-foot-client-value">{{ supplierClientTotal | gbp }}</span>
            </div>
          </ng-container>

          <!-- v1.65ex — textarea now carries the auto-summary directly
               (pre-filled, kept in sync as Ryan queues actions, until
               he edits it manually). No separate chip needed. -->
          <textarea class="bp-cd-send-textarea"
                    [(ngModel)]="supplierMessage"
                    rows="3"
                    [disabled]="sending"
                    placeholder="Add a message — anything the agent should know about your quote."></textarea>
          <button type="button"
                  class="bp-cd-send-cta"
                  [disabled]="!canSend"
                  (click)="onSend()">
            <lucide-icon name="send" [size]="14"></lucide-icon>
            <span>{{ sending ? 'Sending…' : 'Send reply' }}</span>
            <span *ngIf="pendingCount > 0" class="bp-cd-send-cta-count">
              {{ pendingCount }}
            </span>
          </button>
        </div>

        <!-- v1.65eg — estimate-style summary. Matches the layout on
             the project Estimate tab: Your cost / Margin / VAT /
             CLIENT TOTAL (highlighted in theme-soft). Skips the
             contingency line that the full estimate carries — the
             cart drawer is a quick "what's this going to cost"
             glance, not the full breakdown. -->
        <div class="bp-cd-foot bp-cd-foot--summary" *ngIf="!isSupplier && selected.length">
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
               Only renders when project.budget is set (>0).
               v1.65es — agency-only; suppliers don't see the
               agency's budget. -->
          <div class="bp-cd-budget-card"
               *ngIf="!isSupplier && budget > 0"
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
               pre-populated from the cart's items + supplier set.
               v1.65es — agency-only. Suppliers get a "Review &
               respond" CTA wired in Phase 2. -->
          <button *ngIf="!isSupplier"
                  type="button"
                  class="bp-cd-send-cta"
                  [disabled]="!canSendBrief"
                  (click)="sendBrief()">
            <lucide-icon name="send" [size]="14"></lucide-icon>
            <span>Send brief to suppliers</span>
            <lucide-icon name="arrow-right" [size]="14" class="bp-cd-send-cta-chev"></lucide-icon>
          </button>

          <!-- v1.65ev → v1.65ew — supplier wrap-up moved up into the
               supplier footer block (above). This was misnested
               inside the agency *ngIf="!isSupplier" gate so it
               never rendered. -->

        </div>
        <!-- Empty state — keep the band so the drawer chrome stays
             stable even when SELECTED is empty. -->
        <div class="bp-cd-foot" *ngIf="!selected.length">
          <span class="bp-cd-foot-label">CLIENT TOTAL</span>
          <span class="bp-cd-foot-total">£0</span>
        </div>
      </aside><!-- /.bp-cd-grid-summary -->
      </div><!-- /.bp-cd-grid -->
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

    /* v1.65f9 — 2-column drawer body. Items list (existing
       .bp-cd-body) sits in col 1; the summary aside sits in col 2.
       Heights stretch to fill the sidebar content area so the
       items column scrolls independently of the summary panel. */
    .bp-cd-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
      gap: 0;
      height: 100%;
      min-height: 0;
    }
    .bp-cd-grid-items {
      overflow-y: auto;
      min-height: 0;
    }
    .bp-cd-grid-summary {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 20px 20px 24px;
      background: var(--theme-bg);
      border-left: 0.5px solid var(--color-border);
      overflow-y: auto;
      min-height: 0;
    }
    /* Footer rows / send CTA inside the summary aside drop their
       previous "footer band" margins — they're now stacked
       vertically inside a column, not pinned to the drawer bottom. */
    .bp-cd-grid-summary .bp-cd-foot {
      width: 100%;
      flex-direction: column;
      align-items: stretch;
      gap: 4px;
    }
    .bp-cd-grid-summary .bp-cd-foot--supplier,
    .bp-cd-grid-summary .bp-cd-foot--summary {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    /* Narrow viewport fallback — stack the two columns vertically so
       the drawer doesn't break on mobile / very narrow tablets. */
    @media (max-width: 720px) {
      .bp-cd-grid {
        grid-template-columns: 1fr;
        grid-template-rows: 1fr auto;
        height: 100%;
      }
      .bp-cd-grid-summary {
        border-left: none;
        border-top: 0.5px solid var(--color-border);
      }
    }

    /* p-sidebar content area must allow the grid to fill it. */
    :host ::ng-deep .bp-cart-drawer .p-sidebar-content {
      height: 100%;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
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

    /* v1.65ew → v1.65f4 — row layout. Three-column / three-row grid
       in agent mode. The breakdown line sits stacked with the name
       and supplier (row 1, col 2); the stepper ALWAYS gets its own
       row (row 2, col 2) so the visual rhythm is consistent
       regardless of breakdown length. Line total spans rows 1-2 in
       col 3 (vertically centred), remove × drops to row 2 col 3.
       Supplier mode keeps two columns (no total, action cluster
       stays in col 2 row 2).
         ┌──────┬──────────────────────────┬──────────┐
         │  IMG │ Name                     │          │
         │      │ Supplier                 │  TOTAL   │
         │      │ £rate / unit × N         │          │
         │      ├──────────────────────────┼──────────┤
         │      │ [− 250 +]                │    ×     │
         └──────┴──────────────────────────┴──────────┘ */
    .bp-cd-row--selected {
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr) auto;
      grid-template-rows: auto auto;
      column-gap: 12px;
      row-gap: 8px;
      align-items: start;
      padding: 12px 14px;
    }
    .bp-cd-row--selected .bp-cd-img { grid-row: 1 / span 2; align-self: start; }
    .bp-cd-row--selected .bp-cd-text {
      grid-column: 2; grid-row: 1;
      min-width: 0;
      display: flex; flex-direction: column;
      gap: 2px;
    }
    .bp-cd-row--selected .bp-cd-name {
      font-size: 14px;
      font-weight: 500;
      color: var(--color-text-primary);
      white-space: normal;
      overflow: visible;
      text-overflow: clip;
      line-height: 1.3;
    }
    /* v1.65f4 → v1.65f8 — .bp-cd-price is no longer rendered inside
       a selected row. The breakdown line lives inside .bp-cd-text
       (both modes) and the line total is its own col-3 cell. Rule
       kept here only so wishlist + ad-hoc rows (which still emit
       .bp-cd-price as a price cell) inherit alignment if they're
       ever wrapped in --selected. */
    .bp-cd-row--selected .bp-cd-price {
      grid-column: 2; grid-row: 2;
      justify-self: start;
      text-align: left;
      align-self: center;
    }
    /* v1.65f4 — stepper on its own row, left-justified in col 2 row 2. */
    .bp-cd-row--selected .bp-cd-qty {
      grid-column: 2; grid-row: 2;
      justify-self: start;
      align-self: center;
    }
    /* v1.65f3 → v1.65f4 — line total in col 3 spans both rows so it
       sits vertically centred next to the row body. */
    .bp-cd-row--selected .bp-cd-row-total {
      grid-column: 3; grid-row: 1 / span 2;
      align-self: center;
      justify-self: end;
      font-family: var(--font-display);
      font-size: 19px;
      font-weight: 500;
      color: var(--color-text-primary);
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.01em;
      white-space: nowrap;
      padding-left: 8px;
    }
    /* Supplier mode (no line-total cell) — action cluster sits in
       col 2 row 2 (the cell now occupied by the agent-mode stepper). */
    .bp-cd-row--selected .bp-cd-row-actions {
      grid-column: 2; grid-row: 2;
      justify-self: end;
      align-self: end;
    }
    /* Agent mode remove × pinned to col 3 row 2, lined up under the
       line total. */
    .bp-cd-row--selected .bp-cd-action--remove {
      grid-column: 3; grid-row: 2;
      justify-self: end;
      align-self: end;
    }
    /* Price rate — supplier mode only (read-only big number, no
       multiplier breakdown). */
    .bp-cd-price-rate {
      font-size: 17px;
      font-weight: 600;
      color: var(--color-text-primary);
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.01em;
      line-height: 1.1;
    }
    /* v1.65f3 → v1.65f4 — agent-mode breakdown line. Now lives inside
       .bp-cd-text so it stacks below the supplier line via that
       block's flex column. Calm secondary text since the
       eye-catcher is the line total over on the right; this is the
       "show your working" for the user
         (£85 / head × 250 guests × 2). */
    .bp-cd-price-line {
      font-size: 12px;
      font-weight: 400;
      color: var(--color-text-secondary);
      font-variant-numeric: tabular-nums;
      line-height: 1.3;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
      margin-top: 4px;
    }

    /* v1.65f2 — buy-quantity stepper under the row price (agent mode).
       Compact pill: − N + with hairline border, theme-bg fill. Sits
       directly under the rate so the user reads "£140 × 3" naturally.
       Disabled state on the − button when qty=1 prevents going below
       the floor; deletion is the × button's job. */
    .bp-cd-qty {
      /* v1.65f3 — was margin-top:6px (stepper stacked under the rate);
         now sits inline next to the breakdown text via the parent
         flex layout. No top margin needed; the parent row-gap handles
         spacing on wrap. */
      display: inline-flex; align-items: center;
      height: 22px;
      padding: 0 2px;
      background: var(--color-surface);
      border: 0.5px solid var(--color-border);
      border-radius: 999px;
      font-family: var(--font-body);
      font-variant-numeric: tabular-nums;
    }
    .bp-cd-qty-btn {
      width: 20px; height: 20px;
      border: none; background: transparent;
      color: var(--color-text-secondary);
      font-size: 14px; font-weight: 600;
      cursor: pointer;
      border-radius: 50%;
      display: inline-flex; align-items: center; justify-content: center;
      line-height: 1;
      transition: background 0.12s, color 0.12s;
    }
    .bp-cd-qty-btn:hover:not(:disabled) {
      background: var(--theme-bg);
      color: var(--theme-accent);
    }
    .bp-cd-qty-btn:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }
    .bp-cd-qty-n {
      min-width: 18px;
      text-align: center;
      font-size: 12px;
      font-weight: 600;
      color: var(--color-text-primary);
      padding: 0 4px;
    }
    .bp-cd-price-unit-line {
      font-size: 10.5px;
      font-weight: 500;
      color: var(--color-text-muted);
      letter-spacing: 0.02em;
      margin-top: 1px;
    }

    /* v1.65et → v1.65eu — supplier-side row action cluster. Four
       CIRCULAR icon buttons (Accept / Adjust / Image / Decline)
       matching the rest of the app's selector pattern: hairline
       circle at rest, theme-accent SOLID fill when active. */
    .bp-cd-row-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }
    .bp-cd-row-act {
      width: 28px; height: 28px;
      display: flex; align-items: center; justify-content: center;
      border: 0.5px solid var(--color-border);
      border-radius: 50%;
      background: var(--color-surface);
      cursor: pointer;
      color: var(--color-text-muted);
      transition: background 0.15s, border-color 0.15s, color 0.15s;
      padding: 0;
    }
    .bp-cd-row-act:hover {
      border-color: var(--theme-accent);
      color: var(--theme-accent);
    }
    .bp-cd-row-act lucide-icon { color: inherit; }
    /* Active = bold theme fill (matches the selector pattern used by
       category circles, view toggles, status pills). */
    .bp-cd-row-act--active {
      background: var(--theme-accent) !important;
      border-color: var(--theme-accent) !important;
      color: var(--color-surface) !important;
    }
    .bp-cd-row-act--active:hover {
      background: var(--theme-accent) !important;
      border-color: var(--theme-accent) !important;
      color: var(--color-surface) !important;
      opacity: 0.9;
    }

    /* Per-unit suffix on the row price ("/ cover"). Muted so the
       headline figure still owns the eye. */
    .bp-cd-price-unit {
      font-size: 11px;
      font-weight: 400;
      color: var(--color-text-muted);
      margin-left: 4px;
    }

    /* v1.65ev — supplier wrap-up block (auto-summary chip + textarea
       + Send CTA count badge). Lives in the footer; the
       .bp-cd-send-cta class above carries the button chrome already. */
    .bp-cd-send-summary {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      padding: 8px 12px;
      margin-top: 10px;
      margin-bottom: 8px;
      background: var(--theme-soft);
      border-radius: var(--radius-button);
      font-size: 12px;
      color: var(--theme-accent);
      font-weight: 500;
      line-height: 1.35;
    }
    .bp-cd-send-summary lucide-icon {
      color: inherit;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .bp-cd-send-textarea {
      width: 100%;
      margin-top: 6px;
      margin-bottom: 10px;
      padding: 10px 12px;
      font-family: var(--font-body);
      font-size: 13px;
      color: var(--color-text-primary);
      background: var(--color-surface);
      border: 0.5px solid var(--color-border);
      border-radius: var(--radius-button);
      outline: none;
      resize: vertical;
      line-height: 1.4;
    }
    .bp-cd-send-textarea:focus {
      border-color: var(--theme-accent);
    }
    .bp-cd-send-textarea:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .bp-cd-send-cta-count {
      margin-left: 4px;
      padding: 0 7px;
      height: 18px;
      min-width: 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.25);
      color: var(--color-surface);
      border-radius: var(--radius-pill);
      font-size: 11px;
      font-weight: 700;
    }

    /* Status badge under the supplier_name on a row */
    .bp-cd-row-status {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      margin-top: 2px;
    }
    .bp-cd-row-status--ok  { color: var(--color-booked, #059669); }
    .bp-cd-row-status--bad { color: var(--color-action, #DC2626); }

    /* Row tinting based on action state — subtle, non-destructive. */
    .bp-cd-row--accepted { background: var(--color-booked-soft, rgba(5,150,105,0.06)); }
    .bp-cd-row--declined { opacity: 0.55; }

    /* Inline Adjust editor — expands below the row when Ryan
       clicks the pencil. Sits inside the SELECTED list, not in a
       modal, so the supplier can scan the cart while editing. */
    .bp-cd-adjust {
      padding: 14px 16px;
      background: var(--theme-soft);
      border-radius: var(--radius-card);
      margin: -2px 10px 10px 60px;
      display: flex; flex-direction: column;
      gap: 8px;
    }
    .bp-cd-adjust-hd {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--theme-accent);
      margin-bottom: 4px;
    }
    .bp-cd-adjust-row {
      display: flex; align-items: center; gap: 8px;
    }
    .bp-cd-adjust-lbl {
      width: 88px; flex-shrink: 0;
      font-size: 11px;
      color: var(--color-text-muted);
      font-weight: 500;
    }
    .bp-cd-adjust-input {
      flex: 1;
      padding: 6px 9px;
      font-family: var(--font-body);
      font-size: 12px;
      color: var(--color-text-primary);
      background: var(--color-surface);
      border: 0.5px solid var(--color-border);
      border-radius: 6px;
      outline: none;
    }
    .bp-cd-adjust-input:focus { border-color: var(--theme-accent); }
    .bp-cd-adjust-textarea { resize: vertical; line-height: 1.4; }
    .bp-cd-adjust-unit { max-width: 80px; flex: 0 0 auto; }
    /* v1.65eu — price input + unit selector pair. Price input grows;
       select chooses the rate basis. */
    .bp-cd-adjust-price { max-width: 120px; flex: 0 0 auto; }
    .bp-cd-adjust-unit-sel {
      max-width: 130px;
      flex: 0 0 auto;
      background: var(--color-surface);
      font-family: var(--font-body);
      cursor: pointer;
    }
    .bp-cd-adjust-foot {
      display: flex; align-items: center; gap: 8px;
      margin-top: 4px;
    }
    .bp-cd-adjust-note {
      display: inline-flex; align-items: center; gap: 4px;
      flex: 1;
      font-size: 10.5px;
      color: var(--theme-accent);
      font-weight: 500;
    }
    .bp-cd-adjust-note lucide-icon { color: inherit; }
    .bp-cd-adjust-cancel,
    .bp-cd-adjust-save {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 6px 12px;
      font-family: var(--font-body);
      font-size: 12px;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      border: 0.5px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text-secondary);
      transition: background 0.15s, opacity 0.15s;
    }
    .bp-cd-adjust-cancel:hover { background: var(--theme-bg); }
    .bp-cd-adjust-save {
      background: var(--theme-accent);
      color: var(--color-surface);
      border-color: var(--theme-accent);
    }
    .bp-cd-adjust-save:disabled { opacity: 0.4; cursor: not-allowed; }
    .bp-cd-adjust-save:hover:not(:disabled) { opacity: 0.85; }

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
       like the same number presented at different fidelity.
       v1.65es — same shape for the supplier variant (--supplier).
       Difference is the row contents, not the chrome. */
    .bp-cd-foot--summary,
    .bp-cd-foot--supplier {
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

  /** v1.65er — pre-supplied rows from the inbox "Cart" chip. When
      set, load() skips the project_items fetch and renders these
      directly. */
  private preRows: CartDrawerRow[] | null = null;
  /** v1.65es — viewer side. 'agent' = full agency chrome; 'supplier'
      strips WISHLIST + ADDITIONAL ASKS, hides margin in the summary,
      swaps the Send Brief CTA for the supplier action train trigger. */
  viewer: 'agent' | 'supplier' = 'agent';
  get isSupplier(): boolean { return this.viewer === 'supplier'; }

  /** v1.65et — when the supplier clicks Adjust on a row, this holds
      the row id and the editor expands below it. One adjust open at a
      time. */
  adjustOpenId: string | null = null;
  /** v1.65eu — when the supplier clicks the Image button, this holds
      the row id and the inline ImageUploadPanel renders below. */
  imageOpenId: string | null = null;
  adjustForm: {
    name: string;
    price: number | null;
    unit: string;
    imageUrl: string;
    description: string;
  } = { name: '', price: null, unit: 'cover', imageUrl: '', description: '' };

  /** v1.65eu — unit dropdown options for the adjust form. The two
      per-attendee units (cover, head) trigger the × guest_count
      multiplier in the line math; others stay flat. */
  readonly unitOptions: { code: string; label: string }[] = [
    { code: 'cover',   label: 'cover'   },
    { code: 'head',    label: 'head'    },
    { code: 'each',    label: 'item'    },
    { code: 'package', label: 'package' },
    { code: 'table',   label: 'table'   },
    { code: 'day',     label: 'day'     },
    { code: 'event',   label: 'event'   },
  ];

  /** v1.65eu — short label shown as the price suffix ("/ cover"). */
  unitShort(code: string): string {
    const u = this.unitOptions.find(o => o.code === (code || '').toLowerCase());
    return u ? u.label : code;
  }

  /** v1.65ev — queue of supplier row actions, keyed by rowId so a
      second click on the same row overwrites (last action wins).
      Flushed in one batch on Send. */
  pendingActions: Map<string, CartDrawerRowAction> = new Map();
  /** v1.65ex — wrap-up message. Auto-syncs to the current
      pendingSummary as Ryan queues actions, UNTIL he edits the
      textarea manually. Once edited, his text wins and the auto-
      sync stops. */
  supplierMessage = '';
  /** Last value the auto-sync wrote — used to detect whether the
      textarea is still pristine (Ryan hasn't typed) or custom. */
  private lastAutoMessage = '';
  /** True while the consolidated reply is in flight (Send → server
      reply → drawer close). */
  sending = false;

  /** v1.65ex — push the live summary into the textarea if Ryan hasn't
      manually edited it. Called after every queue mutation. */
  private syncAutoMessage(): void {
    const cur = (this.supplierMessage || '').trim();
    const isPristine = !cur || cur === this.lastAutoMessage.trim();
    if (!isPristine) return;
    const next = this.pendingSummary;
    this.supplierMessage = next;
    this.lastAutoMessage = next;
  }

  get pendingCount(): number { return this.pendingActions.size; }
  /** v1.65ev — auto-summary of queued actions. Used as the default
      body line when the supplier doesn't type their own message,
      and prepended when they do. Natural English + plurals. */
  get pendingSummary(): string {
    if (!this.pendingActions.size) return '';
    let accepted = 0, adjusted = 0, declined = 0, thinking = 0;
    for (const a of this.pendingActions.values()) {
      if (a.action === 'accept')   accepted++;
      else if (a.action === 'adjust')   adjusted++;
      else if (a.action === 'decline')  declined++;
      else if (a.action === 'think')    thinking++;
    }
    const bits: string[] = [];
    if (accepted) bits.push(`accepted ${accepted} ${accepted === 1 ? 'item' : 'items'}`);
    if (adjusted) bits.push(`edited ${adjusted} ${adjusted === 1 ? 'item' : 'items'} please review`);
    if (declined) bits.push(`declined ${declined} ${declined === 1 ? 'item' : 'items'}`);
    if (thinking) bits.push(`marked ${thinking} as needing more time`);
    if (!bits.length) return '';
    // "accepted 2 items and edited 2 items please review"
    const joined = bits.length === 1
      ? bits[0]
      : bits.slice(0, -1).join(', ') + ' and ' + bits[bits.length - 1];
    return `I've ${joined}.`;
  }
  get canSend(): boolean {
    return !this.sending && (this.pendingActions.size > 0 || !!this.supplierMessage.trim());
  }
  get canSaveAdjust(): boolean {
    // At least a price OR a photo OR a name override; otherwise
    // pressing Save would be a no-op.
    return this.adjustForm.price != null
        || !!this.adjustForm.imageUrl.trim()
        || !!this.adjustForm.name.trim()
        || !!this.adjustForm.description.trim();
  }

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
      // v1.65er — pre-supplied rows path. Inbox passes its
      // threadItems directly so we render every message_item
      // (catalogue + ad-hoc), not just the project_items
      // intersection. When set, load() short-circuits the
      // project_items fetch.
      this.preRows = opts.rows || null;
      // v1.65es — viewer side. Defaults to 'agent' so any existing
      // caller that doesn't set it keeps the full agency chrome.
      this.viewer = opts.viewer || 'agent';
      // v1.65ev — fresh supplier-batch state per open.
      this.pendingActions = new Map();
      this.supplierMessage = '';
      this.lastAutoMessage = '';
      this.sending = false;
      this.adjustOpenId = null;
      this.imageOpenId = null;
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

  // ── v1.65et — supplier-side row actions ────────────────────────────
  // Each fires CartDrawerService.rowAction$ which the inbox catches
  // and routes through its existing onItemAction reply pipeline.
  // The inbox knows the message_id; the cart drawer just has rowId
  // (= message_items.id), action verb, and adjust payload.

  /** v1.65et — read the row's underlying status (came in via the
      pre-supplied rows path). Drives the row's status badge + the
      disabled/enabled state of the action buttons. */
  rowStatus(pi: ProjectItem): string {
    const raw = (pi as any)._raw_status as string | undefined;
    return raw || '';
  }
  rowStatusLabel(pi: ProjectItem): string {
    switch (this.rowStatus(pi)) {
      case 'accepted':              return 'Accepted';
      case 'declined_by_supplier':  return 'Declined';
      case 'declined_by_agent':     return 'Declined';
      case 'adjusted_by_supplier':  return 'Quoted';
      case 'adjusted_by_agent':     return 'Adjusted';
      case 'quoted':                return 'Quoted';
      case 'holding':               return 'Holding';
      case 'booked':                return 'Booked';
      default:                      return '';
    }
  }
  isDeclined(pi: ProjectItem): boolean {
    const s = this.rowStatus(pi);
    return s === 'declined_by_supplier' || s === 'declined_by_agent';
  }

  // v1.65ev — row actions now QUEUE instead of firing immediately.
  // The supplier batches their decisions, optionally types a wrap-up
  // message, and clicks Send → one consolidated reply rather than a
  // per-row barrage in the conversation.
  onRowAccept(pi: ProjectItem): void {
    this.pendingActions.set(pi.id, { rowId: pi.id, action: 'accept' });
    (pi as any)._raw_status = 'accepted';
    this.syncAutoMessage();
    this.cdr.markForCheck();
  }
  onRowDecline(pi: ProjectItem): void {
    this.pendingActions.set(pi.id, { rowId: pi.id, action: 'decline' });
    (pi as any)._raw_status = 'declined_by_supplier';
    this.syncAutoMessage();
    this.cdr.markForCheck();
  }
  toggleAdjust(pi: ProjectItem): void {
    if (this.adjustOpenId === pi.id) { this.cancelAdjust(); return; }
    this.adjustOpenId = pi.id;
    this.adjustForm = {
      name: pi.name || '',
      price: Number(pi.base_price) || null,
      unit: pi.unit || 'cover',
      imageUrl: pi.image_url || '',
      description: pi.description || '',
    };
    this.cdr.markForCheck();
  }
  cancelAdjust(): void {
    this.adjustOpenId = null;
    this.cdr.markForCheck();
  }

  /** v1.65eu — open / close the inline ImageUploadPanel for a row.
      Mutually exclusive with the adjust editor so the drawer doesn't
      balloon out — clicking Image while adjust is open closes adjust
      first (the supplier can re-open it; the image they picked is
      already remembered in adjustForm.imageUrl). */
  toggleImage(pi: ProjectItem): void {
    if (this.imageOpenId === pi.id) { this.closeImage(); return; }
    // Make sure adjustForm is seeded (in case the supplier opens
    // Image first, then Adjust).
    if (this.adjustOpenId !== pi.id) {
      this.adjustForm = {
        name: pi.name || '',
        price: Number(pi.base_price) || null,
        unit: pi.unit || 'cover',
        imageUrl: pi.image_url || '',
        description: pi.description || '',
      };
    }
    this.imageOpenId = pi.id;
    this.adjustOpenId = null;
    this.cdr.markForCheck();
  }
  closeImage(): void {
    this.imageOpenId = null;
    this.cdr.markForCheck();
  }
  /** v1.65eu — picked an image. Stage it on the adjustForm + the row's
      visible image (optimistic) AND fire an immediate adjust action
      so the catalogue fork picks it up. The supplier can still open
      Adjust afterwards to set price/name/description. */
  onImagePicked(pi: ProjectItem, evt: { coverUrl: string }): void {
    const url = (evt?.coverUrl || '').trim();
    if (!url) return;
    this.adjustForm.imageUrl = url;
    (pi as any).image_url = url;
    // v1.65ev — queue an adjust action carrying just the image (or
    // merge with an existing queued adjust so we don't blow away
    // price/name set earlier). Flushed on Send.
    const prev = this.pendingActions.get(pi.id);
    this.pendingActions.set(pi.id, {
      rowId: pi.id,
      action: 'adjust',
      name: prev?.name,
      description: prev?.description,
      price: prev?.price,
      unit: prev?.unit,
      image_url: url,
    });
    (pi as any)._raw_status = 'adjusted_by_supplier';
    this.syncAutoMessage();
    this.closeImage();
  }

  /** v1.65ev — flush all queued actions + the wrap-up message in one
      consolidated reply. Builds the body from the supplier's typed
      message (if any) + the auto-summary, then emits batchAction$.
      The inbox catches and posts a single reply to the server.

      v1.65f7 — dedupe fix. syncAutoMessage() pre-fills the textarea
      with the live summary, so when Ryan clicks Send WITHOUT typing
      anything, both `typed` and `summary` equal the auto-summary —
      the old `typed + '\n\n' + summary` concat then sent the same
      line twice. Compare `typed` against the last auto-written
      value: if equal, the textarea is still the auto fill, so send
      it once. Only prefix-and-append when Ryan has genuinely added
      his own copy on top. */
  onSend(): void {
    if (!this.canSend) return;
    this.sending = true;
    const actions = Array.from(this.pendingActions.values());
    const typed = (this.supplierMessage || '').trim();
    const summary = this.pendingSummary;
    const lastAuto = (this.lastAutoMessage || '').trim();
    const isAutoOnly = !!typed && typed === lastAuto;
    let body = '';
    if (typed && summary && !isAutoOnly) {
      body = typed + '\n\n' + summary;
    } else {
      body = typed || summary;
    }
    this.svc.emitBatchAction({ actions, body });
    // Reset local state + close the drawer. The inbox refreshes
    // thread items after the server confirms.
    this.pendingActions.clear();
    this.supplierMessage = '';
    setTimeout(() => {
      this.sending = false;
      this.close();
      this.cdr.markForCheck();
    }, 250);
    this.cdr.markForCheck();
  }
  onRowAdjust(pi: ProjectItem): void {
    const f = this.adjustForm;
    // v1.65ev — queue, don't fire. If an earlier Image pick already
    // queued an adjust for this row, merge so we don't lose the
    // image URL when the supplier fills in price/name later.
    const prev = this.pendingActions.get(pi.id);
    this.pendingActions.set(pi.id, {
      rowId: pi.id,
      action: 'adjust',
      name: f.name.trim() || prev?.name,
      description: f.description.trim() || prev?.description,
      price: f.price != null ? Number(f.price) : prev?.price,
      unit: f.unit.trim() || prev?.unit,
      image_url: f.imageUrl.trim() || prev?.image_url,
    });
    // Optimistic local update so the row reflects the new price /
    // image / name immediately. Server will confirm via the inbox
    // refresh after Send.
    if (f.price != null) (pi as any).base_price = Number(f.price);
    if (f.imageUrl.trim()) (pi as any).image_url = f.imageUrl.trim();
    if (f.name.trim()) (pi as any).name = f.name.trim();
    if (f.description.trim()) (pi as any).description = f.description.trim();
    if (f.unit.trim()) (pi as any).unit = f.unit.trim();
    (pi as any)._raw_status = 'adjusted_by_supplier';
    this.syncAutoMessage();
    this.cancelAdjust();
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  onVisibleChange(open: boolean): void { if (!open) this.close(); }
  close(): void { this.svc.close(); }

  get totalCount(): number { return this.selected.length + this.wishlist.length; }

  /** v1.65ef — extended line price. Per-cover/per-head items multiply
      base_price by project.guest_count; everything else is flat.
      Falls back to flat when guest_count is missing/0.
      v1.65f2 — also multiplies by the row's buy quantity (default 1).
      So a per-head platter at £6.25, qty 10, 250 guests → £15,625. */
  lineTotal(pi: ProjectItem): number {
    const base = Number(pi.base_price) || 0;
    const qty = this.qtyOf(pi);
    const unit = (pi.unit || '').toLowerCase();
    if (this.guestCount > 0 && PER_ATTENDEE_UNITS.has(unit)) {
      return base * qty * this.guestCount;
    }
    return base * qty;
  }

  /** v1.65f2 — current buy quantity for a row. Defaults to 1 when the
      row was created before the column existed or was never set. */
  qtyOf(pi: ProjectItem): number {
    const q = Number((pi as any).quantity);
    return Number.isFinite(q) && q > 0 ? q : 1;
  }

  /** v1.65f3 — formatted multiplier breakdown shown under the row name.
      Three shapes, depending on the item's unit + qty:
        per-head, qty=1   →  "£85 / head × 250 guests"
        per-head, qty=3   →  "£85 / head × 250 guests × 3"
        flat,     qty=1   →  "£95 / platter"
        flat,     qty=3   →  "£95 / platter × 3"
      The line total (right column) is the result of the math; this
      string is the show-your-working for the user. */
  rateLine(pi: ProjectItem): string {
    const rate = Number(pi.base_price) || 0;
    const unitCode = (pi.unit || '').toLowerCase();
    const unitLabel = this.unitShort(unitCode) || 'item';
    const qty = this.qtyOf(pi);
    const perHead = PER_ATTENDEE_UNITS.has(unitCode) && this.guestCount > 0;

    const rateStr = `£${rate.toLocaleString('en-GB')}`;
    let line = `${rateStr} / ${unitLabel}`;
    if (perHead) {
      line += ` × ${this.guestCount.toLocaleString('en-GB')} guests`;
      if (qty > 1) line += ` × ${qty}`;
    } else if (qty > 1) {
      line += ` × ${qty}`;
    }
    return line;
  }

  /** v1.65f2 — per-row in-flight flag so the +/− buttons disable while
      a PATCH is in transit. Keyed by project_items.id rather than
      item_id so multiple rows can be edited concurrently. */
  qtySaving: { [piId: string]: boolean } = {};

  /** v1.65f4 — number displayed inside the stepper pill. For per-head
      / per-cover items it shows qty × guest_count (e.g. "250" not
      "1" for the canonical case of one round at full attendance, or
      "500" for two rounds); for flat-unit items it stays as the raw
      qty. This matches the breakdown text above, so the stepper
      reads as "the head count this row is feeding" instead of "the
      buy multiplier" which only makes sense once you've internalised
      the schema. */
  stepperValue(pi: ProjectItem): number {
    const qty = this.qtyOf(pi);
    const unit = (pi.unit || '').toLowerCase();
    if (this.guestCount > 0 && PER_ATTENDEE_UNITS.has(unit)) {
      return qty * this.guestCount;
    }
    return qty;
  }

  /** v1.65f2 → v1.65f4 — bump the row's quantity by 1. The DB column
      still stores raw qty (1, 2, 3) regardless of unit; we just
      display the effective head-count derived value. */
  onQtyPlus(pi: ProjectItem): void {
    this.changeQty(pi, this.qtyOf(pi) + 1);
  }
  /** v1.65f2 → v1.65f4 — decrement qty by 1, floored at 1. The
      stepper display jumps by step size, but the underlying qty
      column moves by 1 every click. */
  onQtyMinus(pi: ProjectItem): void {
    const next = Math.max(1, this.qtyOf(pi) - 1);
    if (next === this.qtyOf(pi)) return;
    this.changeQty(pi, next);
  }
  private changeQty(pi: ProjectItem, next: number): void {
    if (!pi.project_id || !pi.item_id) return;
    const prev = this.qtyOf(pi);
    (pi as any).quantity = next;          // optimistic
    this.qtySaving[pi.id] = true;
    this.cdr.markForCheck();
    this.projectItemSvc.setQuantity(pi.project_id, pi.item_id, next).subscribe({
      next: row => {
        (pi as any).quantity = Number((row as any).quantity) || next;
        this.qtySaving[pi.id] = false;
        this.cdr.markForCheck();
      },
      error: () => {
        (pi as any).quantity = prev;       // rollback
        this.qtySaving[pi.id] = false;
        this.cdr.markForCheck();
      }
    });
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

  // ── v1.65es — supplier-side derived totals ────────────────────────
  // Margin is excluded from the supplier view (it's agency
  // bookkeeping). The supplier sees their own cost, multiplied by
  // guests for per-attendee units, then VAT, then client total.
  /** Sum of base_prices across all rows — the per-head rate, NOT
      multiplied by guest count. For the demo: £28 + £85 + £0 + £0
      = £113. */
  get perHeadTotal(): number {
    return this.selected.reduce((s, pi) => s + (Number(pi.base_price) || 0), 0);
  }
  get vatOnCost(): number {
    return this.yourCost * (this.vatPct / 100);
  }
  get supplierClientTotal(): number {
    return this.yourCost + this.vatOnCost;
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

  /** v1.65er — adapt a CartDrawerRow (from the inbox) into a
      ProjectItem-shaped row so the existing template renders it
      unchanged. Ad-hoc / zero-price rows surface a sparkles
      thumbnail via the supplier_cover_url fallback chain (handled
      by imageStyle/imageBgColor below). */
  private rowToProjectItem(r: CartDrawerRow): ProjectItem {
    const pi = {
      id: r.id,
      project_id: this.projectId,
      item_id: r.item_id || '',
      selection_type: 'selected',
      created_at: new Date().toISOString(),
      name: r.name,
      description: r.description || undefined,
      base_price: Number(r.base_price) || 0,
      unit: r.unit || undefined,
      image_url: r.image_url || undefined,
      supplier_name: r.supplier_name || undefined,
      supplier_cover_url: r.supplier_cover_url || undefined,
      category_icon_color: r.category_icon_color || undefined,
    } as ProjectItem;
    // v1.65et — stash the message_item status on the synthesised
    // row so rowStatus() / isDeclined() can read it without
    // touching the ProjectItem model.
    (pi as any)._raw_status = r.status || '';
    return pi;
  }

  // ── data ────────────────────────────────────────────────────────────
  private load(): void {
    if (!this.projectId) return;
    // v1.65er — pre-supplied rows path (inbox "Cart" chip). Render
    // directly without touching project_items. Still loads the
    // project for guest_count + margin + VAT so the line math +
    // summary footer work.
    if (this.preRows) {
      this.selected = this.preRows.map(r => this.rowToProjectItem(r));
      this.wishlist = [];
    }
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
    // v1.65er — skip project_items fetch when rendering pre-supplied
    // rows (inbox "Cart" chip path).
    if (this.preRows) return;
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
