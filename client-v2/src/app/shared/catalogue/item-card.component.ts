import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { CatalogueItem, sizedImage } from './catalogue.types';

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
  imports: [CurrencyPipe, LucideAngularModule],
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
    <button
      type="button"
      class="bp-fav-btn"
      [class.bp-fav-btn--on]="favourited()"
      [attr.aria-label]="favourited() ? 'Remove favourite' : 'Add favourite'"
      (click)="onFavClick($event)"
    >
      <lucide-icon name="heart" [size]="15" />
    </button>
    <!-- The customer-proposed "+" (v1 lineage) — replaced the gradient
         foot CTA (v2.20q: a grid of brand CTAs broke the BUTTONS.md
         scarcity rule). TRANSITIONAL: wired to favourites until pV2-06f
         lands the quote flow. -->
    <button
      type="button"
      class="bp-fav-btn bp-fav-btn--second"
      [class.bp-fav-btn--on]="favourited()"
      [attr.aria-label]="favourited() ? 'Added to quote' : 'Add to quote'"
      (click)="onFavClick($event)"
    >
      <lucide-icon [name]="favourited() ? 'check' : 'plus'" [size]="15" />
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
    </div>
  `,
})
export class ItemCardComponent {
  readonly item = input.required<CatalogueItem>();
  readonly selected = input<boolean>(false);
  /** Above-the-fold cards load eagerly (LCP); the grid sets this. */
  readonly eager = input<boolean>(false);
  readonly favourited = input<boolean>(false);
  readonly clicked = output<string>();
  readonly favouriteToggled = output<string>();

  protected cardSrc(): string | null {
    return sizedImage(this.item().coverUrl, 480);
  }

  protected onFavClick(e: Event): void {
    e.stopPropagation(); // the host click selects the card
    this.favouriteToggled.emit(this.item().id);
  }
}
