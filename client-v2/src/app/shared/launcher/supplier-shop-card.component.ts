import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';

/** Supplier home "Your shop" card (Liam 2026-11-02) — a storefront summary + two
 *  actions, replacing the old Next-steps action list. Published + awaiting-review
 *  counts come from the home stats / store item counts. */
@Component({
  selector: 'app-supplier-shop-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideAngularModule],
  host: { class: 'bp-card bp-card--lifted' },
  template: `
    <div class="flex flex-col gap-3 p-6">
      <div>
        <h2 class="bp-card-title">Your shop</h2>
        <p class="mt-0.5 bp-body-small font-semibold text-text">Keep your storefront current</p>
      </div>
      <p class="bp-meta">
        You have {{ published() }} published listing{{ published() === 1 ? '' : 's' }} and
        {{ awaitingReview() }} awaiting review.
      </p>
      <!-- Equal-width buttons (grid), content centred; icons match the header nav
           (size 16); buttons share the Sign Out height. -->
      <div class="mt-1 grid grid-cols-2 gap-2">
        <a routerLink="/store" class="bp-btn-grad flex items-center justify-center gap-2">
          <lucide-icon name="shopping-bag" [size]="16" [strokeWidth]="1.75" />Open my shop
        </a>
        <a routerLink="/marketplace" class="bp-btn-outline flex items-center justify-center gap-2">
          <lucide-icon name="store" [size]="16" [strokeWidth]="1.75" />Browse marketplace
        </a>
      </div>
    </div>
  `,
})
export class SupplierShopCardComponent {
  readonly published = input(0);
  readonly awaitingReview = input(0);
}
