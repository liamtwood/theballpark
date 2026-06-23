import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/auth/auth.service';
import { CatalogueItem } from '../../../shared/catalogue/catalogue.types';

/** pV2-06b — the rail's ITEM mode: image, name, supplier, price + unit,
 *  category context, full description. Pure preview over the already-
 *  loaded row (selection never fetches). The "Add to Quote" CTA slot
 *  joins in 06f; ownership edit/delete affordances with the /store arc. */
@Component({
  selector: 'app-item-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, RouterLink, LucideAngularModule],
  host: { class: 'block' },
  template: `
    <div class="mb-3 flex items-start justify-between gap-2">
      <h3 class="text-md font-medium leading-snug text-text">{{ item().name }}</h3>
      <div class="flex items-center gap-2">
        @if (item().ownedByActiveOrg) {
          <!-- pV2-STORE-01 — owner edits their own item. -->
          <a [routerLink]="['/store/items', item().id]" class="bp-itemprev-close" title="Edit product" aria-label="Edit product">
            <lucide-icon name="square-pen" [size]="14" />
          </a>
        } @else if (canModerate()) {
          <!-- pV2-STORE-01 — ballpark admin reviews / approves the item. -->
          <a [routerLink]="['/store/items', item().id]" class="bp-itemprev-close" title="Review product" aria-label="Review product">
            <lucide-icon name="circle-check" [size]="14" />
          </a>
        }
        <button
          type="button"
          class="bp-itemprev-close"
          aria-label="Close preview"
          (click)="closed.emit()"
        >
          <lucide-icon name="x" [size]="14" />
        </button>
      </div>
    </div>

    @if (item().coverUrl) {
      <img class="bp-itemprev-img" [src]="item().coverUrl" [alt]="item().name" loading="eager" />
    } @else {
      <div class="bp-itemprev-img bp-itemprev-img--empty">
        <lucide-icon name="store" [size]="24" [strokeWidth]="1.5" />
      </div>
    }

    <!-- Mirrors the item card's price treatment (pV2-CARDS-01 QC #1). -->
    <div class="mt-3 flex items-baseline gap-1.5">
      @if (item().basePrice !== null) {
        <span class="bp-price-large">From {{ item().basePrice | currency: 'GBP' : 'symbol' : '1.0-0' }}</span>
        @if (item().unit) {
          <span class="bp-meta">/ {{ item().unit }}</span>
        }
      } @else {
        <span class="bp-caption">Price on request</span>
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
})
export class ItemPreviewComponent {
  private readonly auth = inject(AuthService);

  readonly item = input.required<CatalogueItem>();
  /** Resolved category name (the store has the rail list — no fetch). */
  readonly categoryName = input<string | null>(null);
  readonly closed = output<void>();

  /** Ballpark admins get a Review entry on items they don't own (moderation). */
  protected readonly canModerate = computed(() => this.auth.user()?.activeOrgType === 'ballpark');
}
