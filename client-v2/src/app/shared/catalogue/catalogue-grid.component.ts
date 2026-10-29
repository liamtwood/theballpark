import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { ItemCardComponent } from './item-card.component';
import { CatalogueItem, ViewMode, sizedImage, CARD_GRID_LOOSE, CARD_GRID_DENSE } from './catalogue.types';

/** pV2-06a — the PURE middle grid: entities in, selection events out,
 *  zero fetching. `@switch` on the view mode — card grid / list rows /
 *  dense table (the v1 toggle, decomposed). */
@Component({
  selector: 'app-catalogue-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, ItemCardComponent],
  host: { class: 'block' },
  template: `
    @switch (viewMode()) {
      @case ('card') {
        <!-- Loose (default, full-width surfaces): 2xl goes 4-up. Dense: for a
             constrained column (project Marketplace in the workspace column) —
             caps at 3-up so cards land ~25% smaller and never cram to 4 in the
             narrow column. -->
        <div [class]="'grid gap-4 ' + (dense() ? denseCols : looseCols)">
          @for (item of items(); track item.id; let i = $index) {
            <div class="relative">
              @if (selectable()) {
                <!-- Overlay select checkbox (top-left) — stops the card's navigate/QV. -->
                <label class="bp-bulk-check bp-bulk-check--card" (click)="$event.stopPropagation()">
                  <input type="checkbox" [checked]="isSel(item.id)" (change)="bulkToggle.emit(item.id)" />
                </label>
              }
              <app-item-card
                [item]="item"
                [selected]="item.id === selectedId()"
                [eager]="i < 6"
                [favourited]="favouriteIds().has(item.id)"
                [quoted]="quoteDraftIds().has(item.id)"
                [showQuickView]="showQuickView()"
                [adminEditOrgId]="adminEditOrgId()"
                [quickViewOnly]="quickViewOnly()"
                (clicked)="entitySelected.emit($event)"
                (favouriteToggled)="favouriteToggled.emit($event)"
                (quoteToggled)="quoteToggled.emit($event)"
                (quickView)="quickView.emit($event)"
                (changed)="changed.emit()"
                (build)="build.emit($event)"
                (reclassify)="reclassify.emit($event)"
              />
            </div>
          }
        </div>
      }
      @case ('list') {
        <div class="overflow-hidden rounded-xl border border-hairline bg-surface">
          @for (item of items(); track item.id) {
            <div class="flex items-center border-b border-hairline last:border-b-0 hover:bg-fill"
              [class.bg-fill]="item.id === selectedId() || isSel(item.id)">
              @if (selectable()) {
                <label class="bp-bulk-check pl-3" (click)="$event.stopPropagation()">
                  <input type="checkbox" [checked]="isSel(item.id)" (change)="bulkToggle.emit(item.id)" />
                </label>
              }
              <button
                type="button"
                class="grid min-w-0 flex-1 cursor-pointer grid-cols-[44px_1fr_auto] items-center gap-3 px-3 py-2 text-left"
                (click)="entitySelected.emit(item.id)"
              >
                @if (item.coverUrl) {
                  <img class="h-9 w-11 rounded-md object-cover" [src]="thumb(item.coverUrl)" alt="" loading="lazy" decoding="async" />
                } @else {
                  <div class="h-9 w-11 rounded-md bg-fill"></div>
                }
                <span class="min-w-0">
                  <span class="block truncate text-md font-medium text-text">{{ item.name }}</span>
                  <span class="bp-caption block truncate">{{ item.supplierName }}</span>
                </span>
                <span class="text-md font-medium text-text">
                  {{ item.basePrice | currency: 'GBP' : 'symbol' : '1.0-0' }}
                </span>
              </button>
            </div>
          }
        </div>
      }
      @case ('table') {
        <div class="overflow-hidden rounded-xl border border-hairline bg-surface">
          <div class="flex items-center border-b border-hairline bg-fill">
            @if (selectable()) {
              <!-- Select-all (table header): checks every row shown; indeterminate when
                   only some are selected. Management grids only (Approvals / My Shop). -->
              <label class="bp-bulk-check pl-4" (click)="$event.stopPropagation()">
                <input type="checkbox" aria-label="Select all"
                  [checked]="allOnPage()"
                  [indeterminate]="someOnPage() && !allOnPage()"
                  (change)="bulkToggleAll.emit(!allOnPage())" />
              </label>
            }
            <div class="grid min-w-0 flex-1 grid-cols-[1.6fr_1fr_90px_110px] gap-x-4 px-4 py-2">
              <span class="bp-table-column-header">Item</span>
              <span class="bp-table-column-header">Supplier</span>
              <span class="bp-table-column-header">Unit</span>
              <span class="bp-table-column-header text-right">Price</span>
            </div>
          </div>
          @for (item of items(); track item.id) {
            <div class="flex items-center border-b border-hairline last:border-b-0 hover:bg-fill"
              [class.bg-fill]="item.id === selectedId() || isSel(item.id)">
              @if (selectable()) {
                <label class="bp-bulk-check pl-4" (click)="$event.stopPropagation()">
                  <input type="checkbox" [checked]="isSel(item.id)" (change)="bulkToggle.emit(item.id)" />
                </label>
              }
              <button
                type="button"
                class="grid min-w-0 flex-1 cursor-pointer grid-cols-[1.6fr_1fr_90px_110px] gap-x-4 px-4 py-2 text-left"
                (click)="entitySelected.emit(item.id)"
              >
                <span class="truncate text-base text-text">{{ item.name }}</span>
                <span class="bp-body-small truncate text-secondary">{{ item.supplierName }}</span>
                <span class="bp-body-small text-secondary">{{ item.unit ?? '—' }}</span>
                <span class="text-right text-base text-text">
                  {{ item.basePrice | currency: 'GBP' : 'symbol' : '1.0-0' }}
                </span>
              </button>
            </div>
          }
        </div>
      }
    }
  `,
  styles: `
    .bp-bulk-check {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: none;
    }
    /* Ballpark-themed multi-select checkbox: a soft rounded SQUARE (never a circle —
       that reads as a radio / single-select), accent-pink fill + a white tick when
       checked, hairline border when not. appearance:none for the custom box; accent-color
       stays as the fallback. Shared by the card + list + table bulk checkboxes. */
    .bp-bulk-check input {
      appearance: none;
      -webkit-appearance: none;
      width: 18px;
      height: 18px;
      margin: 0;
      position: relative;
      flex: none;
      cursor: pointer;
      border: 1px solid var(--color-border-hairline);
      border-radius: 5px;
      background: var(--color-surface);
      accent-color: var(--theme-accent);
      transition: background 0.12s ease, border-color 0.12s ease;
    }
    .bp-bulk-check input:hover { border-color: var(--theme-accent); }
    .bp-bulk-check input:focus-visible { outline: 2px solid var(--theme-accent); outline-offset: 1px; }
    .bp-bulk-check input:checked {
      background: var(--theme-accent);
      border-color: var(--theme-accent);
    }
    .bp-bulk-check input:checked::after {
      content: '';
      position: absolute;
      left: 5px;
      top: 2px;
      width: 4px;
      height: 8px;
      border: solid var(--theme-accent-contrast);
      border-width: 0 2px 2px 0;
      transform: rotate(45deg);
    }
    /* Card overlay checkbox — the BARE checkbox, no container/box (Liam QC 2026-10-28).
       RIGHT side: the status pill owns the top-left, and the favourite/quote buttons
       (top-right) are agent-only, so management views have the right corner free. */
    .bp-bulk-check--card {
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 20;
    }
  `,
})
export class CatalogueGridComponent {
  readonly items = input.required<readonly CatalogueItem[]>();
  readonly viewMode = input<ViewMode>('card');
  /** Denser card grid for a constrained column (project Marketplace). */
  readonly dense = input<boolean>(false);
  // FLUID columns — auto-fill packs as many cards as fit at ANY width (no
  // breakpoint cliffs), so the grid fills the space on a laptop (Liam 2026-10-29).
  // A floor of ~200px keeps cards from going too narrow on a phone.
  // Shared card-grid columns (one definition in catalogue.types — the supplier
  // grid uses the same so both card types are the same size). Dense = the
  // capped project column, 4-up stretch (cards stay ~small, row fills, no gutter).
  protected readonly looseCols = CARD_GRID_LOOSE;
  protected readonly denseCols = CARD_GRID_DENSE;
  readonly selectedId = input<string | null>(null);
  /** Favourited item ids (org-scoped) — hearts on the card view. */
  readonly favouriteIds = input<ReadonlySet<string>>(new Set<string>());
  /** Draft-quote item ids (session-local until 06f) — the "+" marks. */
  readonly quoteDraftIds = input<ReadonlySet<string>>(new Set<string>());
  readonly showQuickView = input<boolean>(false);
  /** pV2-ADMIN-ORG-ITEM-CREATE-01 — passthrough: platform admin editing a
   *  supplier's items → card click opens the admin editor for that org. */
  readonly adminEditOrgId = input<string | null>(null);
  /** Browse-only surface (shopfront): a body click always opens the Quick View. */
  readonly quickViewOnly = input<boolean>(false);
  /** pV2-ITEM-BULK-ACTIONS-01 — management multi-select: render a checkbox per row/
   *  card and emit bulkToggle. Off everywhere except the owner/admin management grid. */
  readonly selectable = input<boolean>(false);
  readonly selectedForBulk = input<ReadonlySet<string>>(new Set<string>());
  readonly bulkToggle = output<string>();
  /** Select-all toggle (table header checkbox): true = select every item currently
   *  shown, false = clear. The host maps it onto the selection store. */
  readonly bulkToggleAll = output<boolean>();
  readonly entitySelected = output<string>();
  readonly favouriteToggled = output<string>();
  readonly quoteToggled = output<string>();
  readonly quickView = output<string>();
  /** An owner item-card mutated (duplicate/active/trash) — host should refresh. */
  readonly changed = output<void>();
  /** Owner clicked "Build from components" on a card — host opens the buildup. */
  readonly build = output<string>();
  /** Owner clicked Reclassify on a card — host opens the shared reclassify picker. */
  readonly reclassify = output<string>();

  protected thumb(url: string | null): string | null {
    return sizedImage(url, 160);
  }

  protected isSel(id: string): boolean {
    return this.selectedForBulk().has(id);
  }

  /** Select-all state for the table header checkbox: all shown items selected
   *  (checked), some (indeterminate), or none (unchecked). */
  protected readonly allOnPage = computed(() => {
    const items = this.items();
    if (!items.length) return false;
    const sel = this.selectedForBulk();
    return items.every((i) => sel.has(i.id));
  });
  protected readonly someOnPage = computed(() => {
    const sel = this.selectedForBulk();
    return this.items().some((i) => sel.has(i.id));
  });
}
