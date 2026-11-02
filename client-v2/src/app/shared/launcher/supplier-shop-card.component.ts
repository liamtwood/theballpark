import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Supplier home "Your shop" card (Liam 2026-11-02) — a storefront summary + two
 *  actions, replacing the old Next-steps action list. Published + awaiting-review
 *  counts come from the home stats / store item counts. */
@Component({
  selector: 'app-supplier-shop-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  host: { class: 'bp-card bp-card--lifted' },
  template: `
    <div class="flex flex-col gap-3 p-6">
      <h2 class="bp-card-title">Your shop</h2>
      <div>
        <div class="bp-body-small font-semibold text-text">Keep your storefront current</div>
        <p class="bp-body-small mt-1 text-secondary">
          You have {{ published() }} published listing{{ published() === 1 ? '' : 's' }} and
          {{ awaitingReview() }} awaiting review.
        </p>
      </div>
      <div class="mt-1 flex flex-wrap gap-2">
        <a routerLink="/store" class="bp-btn-grad">Open my shop</a>
        <a routerLink="/marketplace" class="bp-btn-outline">Browse marketplace</a>
      </div>
    </div>
  `,
})
export class SupplierShopCardComponent {
  readonly published = input(0);
  readonly awaitingReview = input(0);
}
