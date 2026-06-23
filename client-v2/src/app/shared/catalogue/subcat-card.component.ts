import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { SupplierSubcategory, sizedImage } from './catalogue.types';

/** pV2-CARDS-01 (QC #5) — the storefront cell per CARDS.md image 7 (Bar
 *  Service): a denser card — cover image (the supplier's first item in
 *  the subcat), name, item count. Chrome from `.bp-card .bp-card--zoom`;
 *  click drills the Store tab to this subcategory (the shell owns the
 *  navigation — this card just emits). */
@Component({
  selector: 'app-subcat-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: {
    class: 'bp-card bp-card--zoom cursor-pointer',
    '(click)': 'clicked.emit(subcat())',
    tabindex: '0',
    role: 'button',
    '(keydown.enter)': 'clicked.emit(subcat())',
  },
  template: `
    @if (subcat().coverUrl) {
      <img class="bp-item-card__img" [src]="coverSrc()" [alt]="''" loading="lazy" decoding="async" />
    } @else {
      <div class="bp-item-card__img bp-item-card__img--empty">
        <lucide-icon name="store" [size]="20" [strokeWidth]="1.5" />
      </div>
    }
    <div class="min-w-0 px-3 pb-3 pt-2.5">
      <div class="truncate text-base font-medium text-text">{{ subcat().name }}</div>
      <div class="bp-caption">{{ subcat().count }} item{{ subcat().count === 1 ? '' : 's' }}</div>
    </div>
  `,
})
export class SubcatCardComponent {
  readonly subcat = input.required<SupplierSubcategory>();
  readonly clicked = output<SupplierSubcategory>();

  protected coverSrc(): string | null {
    return sizedImage(this.subcat().coverUrl, 320);
  }
}
