import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { CatalogueSupplier, sizedImage } from './catalogue.types';

/** pV2-CARDS-01 — the catalog supplier card per CARDS.md image 3 (Rocket
 *  Food): brand hero image, name, pin + city row, full-width gradient
 *  "View supplier" CTA, heart top-right. Chrome from `.bp-card
 *  .bp-card--zoom`. The whole card IS the link; the CTA is the visual
 *  affordance inside it (one tab stop, v1 parity). */
@Component({
  selector: 'app-supplier-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideAngularModule],
  host: { class: 'bp-card bp-card--zoom' },
  template: `
    <a [routerLink]="['/suppliers', supplier().id]" class="bp-supplier-card__link" [attr.aria-label]="supplier().name">
      @if (supplier().coverUrl) {
        <img class="bp-item-card__img" [src]="coverSrc()" [alt]="''" loading="lazy" decoding="async" />
      } @else {
        <div class="bp-item-card__img bp-item-card__img--empty">
          <lucide-icon name="store" [size]="22" [strokeWidth]="1.5" />
        </div>
      }
      <div class="min-w-0 px-3.5 pb-3.5 pt-3">
        <div class="truncate text-md font-semibold text-text">{{ supplier().name }}</div>
        <div class="mt-1 flex items-center gap-1 text-secondary">
          <lucide-icon name="map-pin" [size]="13" [strokeWidth]="1.75" />
          <span class="bp-caption min-w-0 truncate">{{ supplier().city ?? '—' }}</span>
          <span class="bp-meta ml-auto shrink-0">{{ supplier().count }} item{{ supplier().count === 1 ? '' : 's' }}</span>
        </div>
        <!-- Visual CTA only — the wrapping <a> carries the navigation. -->
        <span class="bp-btn-grad mt-3 w-full">
          <lucide-icon name="arrow-right" [size]="16" />
          View supplier
        </span>
      </div>
    </a>
    <button
      type="button"
      class="bp-fav-btn"
      [class.bp-fav-btn--on]="favourited()"
      [attr.aria-label]="favourited() ? 'Remove from Wishlist' : 'Add to Wishlist'"
      [attr.title]="favourited() ? 'Remove from Wishlist' : 'Add to Wishlist'"
      (click)="favouriteToggled.emit(supplier().id)"
    >
      <lucide-icon name="heart" [size]="15" />
    </button>
  `,
})
export class SupplierCardComponent {
  readonly supplier = input.required<CatalogueSupplier>();
  readonly favourited = input<boolean>(false);
  readonly favouriteToggled = output<string>();

  protected coverSrc(): string | null {
    return sizedImage(this.supplier().coverUrl, 480);
  }
}
