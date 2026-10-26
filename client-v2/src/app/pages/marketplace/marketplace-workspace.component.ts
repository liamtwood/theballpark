import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
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
    <!-- Row (relative anchor): the centred workspace container + (project only)
         the quote cart as a RIGHT-edge flyover overlay — Amazon-style, it sits
         on top of the right gutter and does NOT reflow the workspace. -->
    <div class="relative flex min-h-0 flex-1" [class.ws-bare]="!framed()">
      <!-- Rounded white container, centred + gutter-reserved so its edges line up
           with the header. Search fixed at the top; only the grid scrolls. The
           'ws-bare' variant (project tab) drops the card so the grid's scrollbar
           reaches the window edge like the other project tabs. -->
      <div class="ws-frame min-h-0 min-w-0 flex-1 bp-gutter px-6 pt-1">
        <div class="ws-card mx-auto flex h-full min-h-0 w-full max-w-[var(--workspace-max)] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-hairline bg-surface shadow-[var(--shadow-md)]">
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
          <div class="ws-rails flex min-h-0 flex-1 gap-6 px-4 pb-4">
            <div class="hidden w-[210px] shrink-0 min-h-0 xl:block">
              <!-- Gray card for the categories. Plain card, not the bp-card class
                   (its display:block would beat the flex column). -->
              <div class="flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-fill p-2">
                <app-scroll-peek class="min-h-0 flex-1">
                  <ng-content select="[strip]" />
                </app-scroll-peek>
              </div>
            </div>

            <!-- p-4 breathing room so the cards' (bigger) shadow/halo isn't
                 clipped into a hard rectangle by this scroll container's edges. -->
            <div class="ws-scroll min-h-0 min-w-0 flex-1 overflow-y-auto p-4">
              <ng-content />
            </div>
          </div>
        </div>
      </div>

      <!-- Quote cart — a right-edge flyover overlay (project only, when toggled).
           Absolute + flush to the right edge so it floats over the gutter
           without reflowing the grid; its own X (in the card header) closes it. -->
      @if (showCart() && cartOpen()) {
        <aside class="absolute right-0 top-0 bottom-0 z-20 w-[320px] overflow-y-auto pr-3 pt-1">
          <ng-content select="[cart]" />
        </aside>
      }
    </div>
  `,
  styles: [`
    /* 'ws-bare' (project Marketplace tab): drop the bordered card so the grid
       scrolls at the WINDOW EDGE like the other project tabs (Running budget /
       Inbox / Details) — the global Marketplace page keeps the framed card. The
       controls + category rail stay fixed; only the grid scrolls. */
    .ws-bare .ws-frame { padding-inline: 0; }
    .ws-bare .ws-card {
      max-width: none;
      border: 0;
      background: transparent;
      box-shadow: none;
      border-radius: 0;
    }
    .ws-bare .ws-rails { padding-right: 0; }
    .ws-bare .ws-scroll { scrollbar-gutter: stable; }
  `],
})
export class MarketplaceWorkspaceComponent {
  /** Framed (default) = the bordered white workspace card (global Marketplace).
   *  false = 'bare' — no card; the grid scrolls at the window edge to match the
   *  other project tabs (used by the in-project Marketplace tab). */
  readonly framed = input(true);

  /** Project-only quote cart: shows the toggle in the controls + the right-side
   *  `[cart]` slot. Off by default so the global marketplace is unchanged. */
  readonly showCart = input(false);
  readonly cartCount = input(0);

  /** Whether the right-side cart rail is open. Two-way so the projected cart can
   *  close itself (its X) while the controls toggle also drives it. */
  readonly cartOpen = model(false);
}
