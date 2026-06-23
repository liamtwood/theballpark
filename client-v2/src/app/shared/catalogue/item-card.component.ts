import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { TooltipModule } from 'primeng/tooltip';
import { CatalogueItem, sizedImage } from './catalogue.types';
import { StatusPillComponent } from '../status-pill/status-pill.component';

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
    '(click)': 'clicked.emit(item().id)',
    tabindex: '0',
    role: 'button',
    '(keydown.enter)': 'clicked.emit(item().id)',
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
        <!-- pV2-STORE-01 — owner edits their own item straight from the card. -->
        <a
          [routerLink]="['/store/items', item().id]"
          class="bp-btn-outline mt-3 flex w-full items-center justify-center gap-1.5"
          (click)="onEditClick($event)"
        >
          <lucide-icon name="square-pen" [size]="14" /> Edit
        </a>
      }
    </div>
  `,
})
export class ItemCardComponent {
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

  /** The card host selects on click; the Edit link must not also select. */
  protected onEditClick(e: Event): void {
    e.stopPropagation();
  }
}
