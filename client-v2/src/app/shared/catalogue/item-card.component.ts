import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { CatalogueItem, sizedImage } from './catalogue.types';

/** pV2-06a — one item card (card view). Image (or soft placeholder),
 *  name, supplier, price + unit. Dumb: selection in, click out. Quote CTA
 *  + ownership affordances join in later arcs. */
@Component({
  selector: 'app-item-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, LucideAngularModule],
  host: {
    class: 'bp-item-card',
    '[class.bp-item-card--selected]': 'selected()',
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
    <div class="min-w-0 px-3.5 pb-3.5 pt-3">
      <div class="truncate text-md font-medium text-text">{{ item().name }}</div>
      <div class="bp-caption truncate">{{ item().supplierName }}</div>
      <div class="mt-1.5 flex items-baseline gap-1">
        <span class="text-md font-medium text-text">
          {{ item().basePrice | currency: 'GBP' : 'symbol' : '1.0-0' }}
        </span>
        @if (item().unit) {
          <span class="bp-meta">/ {{ item().unit }}</span>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        position: relative;
        display: block;
        overflow: hidden;
        background: var(--color-surface);
        border: 1px solid var(--color-border-hairline);
        border-radius: var(--radius-card);
        box-shadow: var(--shadow-xs);
        cursor: pointer;
        transition: transform 0.12s ease, box-shadow 0.12s ease;
      }
      :host(:hover) {
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
      }
      :host(:focus-visible) {
        outline: 2px solid var(--theme-accent);
        outline-offset: 2px;
      }
      :host(.bp-item-card--selected) {
        border-color: var(--theme-accent);
        box-shadow: var(--shadow-md);
      }
    `,
  ],
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
