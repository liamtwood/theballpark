import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { CatalogueSupplier, sizedImage } from './catalogue.types';

/** pV2-06d — one supplier card (suppliers mode): cover (or soft block),
 *  logo-letter + name + city, item count, favourite heart. The card IS a
 *  routerLink to /suppliers/:id (v1's "View supplier"). */
@Component({
  selector: 'app-supplier-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideAngularModule],
  host: { class: 'bp-supplier-card' },
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
        <div class="flex items-center gap-2">
          <span class="bp-supplier-card__logo">{{ initial() }}</span>
          <span class="min-w-0">
            <span class="block truncate text-md font-medium text-text">{{ supplier().name }}</span>
            <span class="bp-caption block truncate">{{ supplier().city ?? '' }}</span>
          </span>
        </div>
        <div class="mt-2 flex items-center justify-between">
          <span class="bp-meta">{{ supplier().count }} item{{ supplier().count === 1 ? '' : 's' }}</span>
        </div>
      </div>
    </a>
    <button
      type="button"
      class="bp-fav-btn"
      [class.bp-fav-btn--on]="favourited()"
      [attr.aria-label]="favourited() ? 'Remove favourite' : 'Add favourite'"
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

  protected initial(): string {
    return (this.supplier().name || '?').charAt(0).toUpperCase();
  }
}
