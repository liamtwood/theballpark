import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom, Observable } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { TooltipModule } from 'primeng/tooltip';
import { CatalogueItem, sizedImage } from './catalogue.types';
import { StatusPillComponent } from '../status-pill/status-pill.component';
import { StoreItemService } from '../../core/store/store-item.service';

/** pV2-CARDS-01 — the catalog item card per CARDS.md image 2 (Converted
 *  Railway Arch): image top, name, category `.bp-tag-chip`, prominent
 *  `.bp-price-large` ("From £2,000"), pin + city row, full-width bottom
 *  CTA with the Add ↔ Added two-state. Chrome comes from `.bp-card
 *  .bp-card--zoom` (one-definition; RP-07 guard enforces). Dumb:
 *  selection in, clicks out. The CTA wires to FAVOURITES for now —
 *  the quote CTA replaces it in pV2-06f. */
@Component({
  selector: 'app-item-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, RouterLink, LucideAngularModule, TooltipModule, StatusPillComponent],
  host: {
    class: 'bp-card bp-card--zoom cursor-pointer',
    '[class.bp-card--selected]': 'selected()',
    '(click)': 'open()',
    tabindex: '0',
    role: 'button',
    '(keydown.enter)': 'open()',
  },
  template: `
    @if (item().coverUrl) {
      <!-- First row eager (LCP); the rest lazy. NOTE: hidden tabs defer
           lazy images entirely (Chrome) — looks broken in headless
           previews, fine in real browsers. -->
      <img
        class="bp-item-card__img"
        [src]="cardSrc()"
        [alt]="item().name"
        [attr.loading]="eager() ? 'eager' : 'lazy'"
        decoding="async"
      />
    } @else {
      <div class="bp-item-card__img bp-item-card__img--empty">
        <lucide-icon name="store" [size]="22" [strokeWidth]="1.5" />
      </div>
    }
    @if (!item().isActive) {
      <!-- pV2-STORE-01 — inactive items (owner/admin view) carry their status. -->
      <span class="absolute left-2.5 top-2.5 z-10">
        <app-status-pill list="item_approval_status" [code]="item().approvalStatus" />
      </span>
    }
    <button
      type="button"
      class="bp-fav-btn"
      [class.bp-fav-btn--on]="favourited()"
      [attr.aria-label]="favourited() ? 'Remove from Wishlist' : 'Add to Wishlist'"
      [pTooltip]="favourited() ? 'Remove from Wishlist' : 'Add to Wishlist'"
      tooltipStyleClass="bp-tooltip"
      tooltipPosition="top"
      (click)="onFavClick($event)"
    >
      <lucide-icon name="heart" [size]="15" />
    </button>
    <!-- The customer-proposed "+" (v1 lineage) — replaced the gradient
         foot CTA (v2.20q). OWN state, independent of the heart (QC: one
         click was lighting both). TRANSITIONAL: session-local draft mark
         until pV2-06f lands the real quote flow. -->
    <button
      type="button"
      class="bp-fav-btn bp-fav-btn--second"
      [class.bp-fav-btn--on]="quoted()"
      [attr.aria-label]="quoted() ? 'Added to Quote' : 'Add to Quote'"
      [pTooltip]="quoted() ? 'Added to Quote' : 'Add to Quote'"
      tooltipStyleClass="bp-tooltip"
      tooltipPosition="top"
      (click)="onQuoteClick($event)"
    >
      <!-- Always a plus (QC: the check read as a Nike swoosh at 15px) —
           the gradient circle alone carries the added state. -->
      <lucide-icon name="plus" [size]="15" />
    </button>

    <div class="min-w-0 px-3.5 pb-3.5 pt-3">
      <div class="truncate text-md font-semibold text-text">{{ item().name }}</div>
      @if (item().subcategoryName || item().categoryName; as chip) {
        <span class="bp-tag-chip mt-1.5">{{ chip }}</span>
      }
      <!-- No unit suffix on the card (v1 parity) — it lives in the
           preview rail + detail view. -->
      <div class="mt-2 flex items-baseline gap-1.5">
        @if (item().basePrice !== null) {
          <span class="bp-price-large">From {{ item().basePrice | currency: 'GBP' : 'symbol' : '1.0-0' }}</span>
        } @else {
          <span class="bp-caption">Price on request</span>
        }
      </div>
      <div class="mt-1.5 flex items-center gap-1 text-secondary">
        <lucide-icon name="map-pin" [size]="13" [strokeWidth]="1.75" />
        <span class="bp-caption truncate">{{ item().supplierCity || item().supplierName }}</span>
      </div>
      @if (item().ownedByActiveOrg) {
        <!-- pV2-STORE-01 — owner manages their own item from the card:
             Edit, Duplicate, Show/Hide (is_active), Trash (soft delete). -->
        <div class="mt-3 flex items-center gap-2">
          <a
            [routerLink]="['/store/items', item().id]"
            class="bp-btn-outline flex flex-1 items-center justify-center gap-1.5"
            (click)="onEditClick($event)"
          >
            <lucide-icon name="square-pen" [size]="14" /> Edit
          </a>
          <button type="button" class="bp-item-card__act" [disabled]="busy()" title="Duplicate" aria-label="Duplicate" (click)="onDuplicate($event)">
            <lucide-icon name="copy" [size]="15" />
          </button>
          <button
            type="button"
            class="bp-item-card__act"
            [disabled]="busy()"
            [title]="item().isActive ? 'Hide (mark inactive)' : 'Show (mark active)'"
            [attr.aria-label]="item().isActive ? 'Mark inactive' : 'Mark active'"
            (click)="onToggleActive($event)"
          >
            <lucide-icon [name]="item().isActive ? 'eye' : 'eye-off'" [size]="15" />
          </button>
          <button type="button" class="bp-item-card__act bp-item-card__act--danger" [disabled]="busy()" title="Move to trash" aria-label="Move to trash" (click)="onTrash($event)">
            <lucide-icon name="trash-2" [size]="15" />
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .bp-item-card__act {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      flex: none;
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-input, 8px);
      background: var(--color-surface);
      color: var(--color-text-secondary, var(--color-text));
      cursor: pointer;
    }
    .bp-item-card__act:hover { background: var(--color-fill); }
    .bp-item-card__act:disabled { opacity: 0.5; cursor: default; }
    .bp-item-card__act--danger:hover {
      background: var(--color-danger-soft, var(--color-fill));
      color: var(--color-danger, var(--color-text));
      border-color: var(--color-danger, var(--color-border-hairline));
    }
  `,
})
export class ItemCardComponent {
  private readonly router = inject(Router);
  private readonly store = inject(StoreItemService);

  readonly item = input.required<CatalogueItem>();
  readonly selected = input<boolean>(false);
  /** Above-the-fold cards load eagerly (LCP); the grid sets this. */
  readonly eager = input<boolean>(false);
  readonly favourited = input<boolean>(false);
  /** Draft-quote mark (session-local until 06f) — independent of the heart. */
  readonly quoted = input<boolean>(false);
  readonly clicked = output<string>();
  readonly favouriteToggled = output<string>();
  readonly quoteToggled = output<string>();

  protected cardSrc(): string | null {
    return sizedImage(this.item().coverUrl, 480);
  }

  protected onFavClick(e: Event): void {
    e.stopPropagation(); // the host click selects the card
    this.favouriteToggled.emit(this.item().id);
  }

  protected onQuoteClick(e: Event): void {
    e.stopPropagation();
    this.quoteToggled.emit(this.item().id);
  }

  /** Clicking the card opens the item page (pV2-STORE-01). Owners land on the
   *  editor (works for their own drafts); everyone else opens the read-only
   *  view (`?view=1`) — which the page resolves to moderate for ballpark admins
   *  and view for agents. The Edit button below is the owner's explicit edit. */
  protected open(): void {
    const owned = this.item().ownedByActiveOrg;
    void this.router.navigate(
      ['/store/items', this.item().id],
      owned ? {} : { queryParams: { view: 1 } }
    );
  }

  /** The Edit link navigates itself — don't also trigger the card open. */
  protected onEditClick(e: Event): void {
    e.stopPropagation();
  }

  // ── Owner item management (pV2-STORE-01) ──────────────────────────────────
  /** Emitted after a mutation so the host grid can refresh its list. */
  readonly changed = output<void>();
  /** Guards against double-submits while a mutation is in flight. */
  protected readonly busy = signal(false);

  protected onDuplicate(e: Event): void {
    e.stopPropagation();
    this.run(this.store.duplicate(this.item().id));
  }
  protected onToggleActive(e: Event): void {
    e.stopPropagation();
    this.run(this.store.setActive(this.item().id, !this.item().isActive));
  }
  protected onTrash(e: Event): void {
    e.stopPropagation();
    // Interim confirm (soft delete is recoverable in the DB). A styled
    // dialog + a Trash view land later.
    if (!confirm(`Move "${this.item().name}" to trash?`)) return;
    this.run(this.store.remove(this.item().id));
  }

  private run(op: Observable<unknown>): void {
    if (this.busy()) return;
    this.busy.set(true);
    firstValueFrom(op)
      .then(() => this.changed.emit())
      .catch(() => { /* host keeps the row; a toast lands with the dialog work */ })
      .finally(() => this.busy.set(false));
  }
}
