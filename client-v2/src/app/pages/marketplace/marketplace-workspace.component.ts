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
  host: { class: 'flex min-h-0 flex-1 flex-col', '[class.ws-bare]': '!framed()' },
  template: `
    <!-- Row (relative anchor): the centred workspace container + (project only)
         the quote cart as a RIGHT-edge flyover overlay — Amazon-style, it sits
         on top of the right gutter and does NOT reflow the workspace. -->
    <div class="ws-root relative flex min-h-0 flex-1">
      <!-- Rounded white container, centred + gutter-reserved so its edges line up
           with the header. FRAMED (global marketplace): search fixed at the top,
           only the grid scrolls. BARE (project tab, ws-bare): the card FLOWS and
           the whole tab scrolls in the page's bp-gutter → scrollbar at the window
           edge like the other project tabs; the category rail stays sticky. -->
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
            <div class="ws-rail-col hidden w-[210px] shrink-0 min-h-0 xl:block">
              <!-- Gray card for the categories. Plain card, not the bp-card class
                   (its display:block would beat the flex column). -->
              <div class="flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-fill p-2">
                <app-scroll-peek class="min-h-0 flex-1">
                  <ng-content select="[strip]" />
                </app-scroll-peek>
              </div>
            </div>

            <!-- NO top padding so the first row of cards lines up with the category
                 container's top (Liam 2026-10-28); horizontal + bottom padding keep
                 the cards' (bigger) shadow/halo off this scroll container's edges. -->
            <div class="ws-scroll min-h-0 min-w-0 flex-1 overflow-y-auto px-4 pb-4">
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
    /* BARE variant (project Marketplace tab): FLOW like the other project tabs
       (Running budget / Inbox / Details) instead of a fixed-viewport card with
       an inner grid scroll — the whole tab grows and scrolls in the page's
       bp-gutter region, so the scrollbar lands at the window edge. The white
       middle-column card is KEPT; the category rail goes sticky so it stays
       visible while the grid flows. The global Marketplace page is untouched. */
    :host(.ws-bare) { display: block; flex: none; min-height: 0; }
    :host(.ws-bare) .ws-root { display: block; }
    :host(.ws-bare) .ws-frame { overflow: visible; padding-top: 0; }
    :host(.ws-bare) .ws-card { height: auto; min-height: 0; overflow: visible; }
    /* One shared top gap on the rails row + no extra top inset on the grid, so
       the left rail (cat container) and the first row of item cards line up
       vertically (the grid's p-4 top is only needed to stop shadow clipping in
       the framed scroll container, which the bare variant doesn't have). */
    :host(.ws-bare) .ws-rails { min-height: 0; padding-top: 8px; }
    :host(.ws-bare) .ws-rail-col {
      min-height: 0;
      position: sticky;
      top: 8px;
      align-self: flex-start;
      max-height: calc(100vh - 11rem);
    }
    :host(.ws-bare) .ws-scroll { overflow: visible; min-height: 0; padding-top: 0; }
  `],
})
export class MarketplaceWorkspaceComponent {
  /** Framed (default) = the bordered white workspace card with its own inner
   *  grid scroll (global Marketplace page). false = 'bare' — the card flows and
   *  the tab scrolls in the page's bp-gutter so the scrollbar matches the other
   *  project tabs (used by the in-project Marketplace tab). */
  readonly framed = input(true);

  /** Project-only quote cart: shows the toggle in the controls + the right-side
   *  `[cart]` slot. Off by default so the global marketplace is unchanged. */
  readonly showCart = input(false);
  readonly cartCount = input(0);

  /** Whether the right-side cart rail is open. Two-way so the projected cart can
   *  close itself (its X) while the controls toggle also drives it. */
  readonly cartOpen = model(false);
}
