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
      <!-- Plain base buttons (no overrides) → exactly the Sign Out height + font
           (--text-md); they stretch full width in the flex-col. Icon = nav size (16). -->
      <div class="mt-1 flex flex-col gap-2">
        <a routerLink="/store" class="bp-btn-grad">
          <lucide-icon name="shopping-bag" [size]="16" [strokeWidth]="1.75" />Open my shop
        </a>
        <a routerLink="/marketplace" class="bp-btn-outline">
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
