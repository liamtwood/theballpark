import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { CatalogueItem } from '../../../shared/catalogue/catalogue.types';

/** pV2-06b — the rail's ITEM mode: image, name, supplier, price + unit,
 *  category context, full description. Pure preview over the already-
 *  loaded row (selection never fetches). The "Add to Quote" CTA slot
 *  joins in 06f; ownership edit/delete affordances with the /store arc. */
@Component({
  selector: 'app-item-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, LucideAngularModule],
  host: { class: 'block' },
  template: `
    <div class="mb-3 flex items-start justify-between gap-2">
      <h3 class="text-md font-medium leading-snug text-text">{{ item().name }}</h3>
      <button
        type="button"
        class="bp-itemprev-close"
        aria-label="Close preview"
        (click)="closed.emit()"
      >
        <lucide-icon name="x" [size]="14" />
      </button>
    </div>

    @if (item().coverUrl) {
      <img class="bp-itemprev-img" [src]="item().coverUrl" [alt]="item().name" loading="eager" />
    } @else {
      <div class="bp-itemprev-img bp-itemprev-img--empty">
        <lucide-icon name="store" [size]="24" [strokeWidth]="1.5" />
      </div>
    }

    <div class="mt-3 flex items-baseline gap-1.5">
      <span class="bp-card-title">{{ item().basePrice | currency: 'GBP' : 'symbol' : '1.0-0' }}</span>
      @if (item().unit) {
        <span class="bp-meta">/ {{ item().unit }}</span>
      }
    </div>

    <dl class="mt-3 flex flex-col gap-1.5">
      <div class="flex items-center justify-between gap-3">
        <dt class="bp-field-label">Supplier</dt>
        <dd class="bp-field-value truncate">{{ item().supplierName }}</dd>
      </div>
      @if (categoryName()) {
        <div class="flex items-center justify-between gap-3">
          <dt class="bp-field-label">Category</dt>
          <dd class="bp-field-value truncate">{{ categoryName() }}</dd>
        </div>
      }
    </dl>

    @if (item().description) {
      <p class="bp-body-small mt-3 whitespace-pre-line border-t border-hairline pt-3 text-secondary">
        {{ item().description }}
      </p>
    }
  `,
  styles: [
    `
      .bp-itemprev-img {
        display: block;
        width: 100%;
        height: 150px;
        object-fit: cover;
        border-radius: 12px;
        background: var(--color-fill);
      }
      .bp-itemprev-img--empty {
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--color-text-muted);
        background: var(--theme-soft);
      }
      .bp-itemprev-close {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        width: 24px;
        height: 24px;
        border: none;
        border-radius: var(--radius-pill);
        background: transparent;
        color: var(--color-text-secondary);
        cursor: pointer;
      }
      .bp-itemprev-close:hover {
        background: var(--color-fill);
        color: var(--color-text);
      }
    `,
  ],
})
export class ItemPreviewComponent {
  readonly item = input.required<CatalogueItem>();
  /** Resolved category name (the store has the rail list — no fetch). */
  readonly categoryName = input<string | null>(null);
  readonly closed = output<void>();
}
