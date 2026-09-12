import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { MarketplaceControlsComponent } from './marketplace-controls.component';
import { ScrollPeekComponent } from '../../shared/scroll-peek/scroll-peek.component';

/** The shared marketplace WORKSPACE chrome — one rounded white container holding
 *  the search + 3-icon cluster (fixed top) and the two rails: a gray category
 *  card that peeks (no scrollbar) + the scrolling grid area. Mounted by BOTH the
 *  global marketplace page and the in-project Marketplace tab so the UI is one
 *  definition. The consumer projects the category strip into `[strip]` and the
 *  grid/items area into the default slot (each wires its own store data +
 *  actions; the store is provided by the consuming page and reaches the controls
 *  via DI). */
@Component({
  selector: 'app-marketplace-workspace',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MarketplaceControlsComponent, ScrollPeekComponent],
  host: { class: 'flex min-h-0 flex-1 flex-col' },
  template: `
    <!-- Row: the centred workspace container + (project only) the quote cart in
         the RIGHT screen gutter — so the cart uses the empty space beside the
         workspace rather than squeezing the grid. -->
    <div class="flex min-h-0 flex-1">
      <!-- Rounded white container, centred + gutter-reserved so its edges line up
           with the header. Search fixed at the top; only the grid scrolls. -->
      <div class="min-h-0 min-w-0 flex-1 bp-gutter px-6 pt-1">
        <div class="mx-auto flex h-full min-h-0 w-full max-w-[var(--workspace-max)] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-hairline bg-surface shadow-[var(--shadow-md)]">
          <div class="shrink-0 p-4 pb-3">
            <app-marketplace-controls
              class="block"
              [showCart]="showCart()"
              [cartCount]="cartCount()"
              [cartOpen]="cartOpen()"
              (cartToggled)="cartOpen.set(!cartOpen())"
            />
          </div>
          <!-- Rails: cats fixed (no scrollbar — down-arrow peek) + grid scrolls. -->
          <div class="flex min-h-0 flex-1 gap-6 px-4 pb-4">
            <div class="hidden w-[210px] shrink-0 min-h-0 xl:block">
              <!-- Gray card for the categories. Plain card, not the bp-card class
                   (its display:block would beat the flex column). -->
              <div class="flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-fill p-2">
                <app-scroll-peek class="min-h-0 flex-1">
                  <ng-content select="[strip]" />
                </app-scroll-peek>
              </div>
            </div>

            <div class="min-h-0 min-w-0 flex-1 overflow-y-auto">
              <ng-content />
            </div>
          </div>
        </div>
      </div>

      <!-- Quote cart in the right gutter (project only, when toggled open). -->
      @if (showCart() && cartOpen()) {
        <aside class="w-[320px] shrink-0 min-h-0 overflow-y-auto pr-6 pt-1">
          <ng-content select="[cart]" />
        </aside>
      }
    </div>
  `,
})
export class MarketplaceWorkspaceComponent {
  /** Project-only quote cart: shows the toggle in the controls + the right-side
   *  `[cart]` slot. Off by default so the global marketplace is unchanged. */
  readonly showCart = input(false);
  readonly cartCount = input(0);

  /** Whether the right-side cart rail is open (toggled from the controls). */
  protected readonly cartOpen = signal(false);
}
