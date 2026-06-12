import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MarketplaceStore } from '../../pages/marketplace/marketplace-store';

/** Strip width bounds (px) — clamped while dragging. */
const STRIP_MIN = 160;
const STRIP_MAX = 400;
const STRIP_DEFAULT = 210;
const STRIP_STORE_KEY = 'bp-strip-width';

/** pV2-06d (v2.15b) — the three-region catalogue layout shell, ONE
 *  definition (was duplicated between marketplace-page and the supplier
 *  Store tab — chat audit). Slots: [strip] left rail, default middle,
 *  [rail] right rail.
 *
 *  Viewport-fit + independent column scroll (pV2-CARDS-01 QC laptop
 *  pass): inside a `.bp-vpfit` page each region scrolls WITHIN itself —
 *  the page never scrolls. Responsive: mobile (<md) = single column, no
 *  rails, natural page scroll; laptop (xl) = 260px right rail; wide
 *  (2xl) = 300px.
 *
 *  Card view drops the right rail entirely (Liam, 2026-06-12): the
 *  preview only adds value over list/table rows — in card view the cards
 *  ARE the preview, and the middle grid takes the freed width. (Future:
 *  card-click opens the detail view instead — 06f-era wiring.)
 *
 *  The left strip is USER-RESIZABLE (Liam, 2026-06-12): drag the handle
 *  on its right edge (160–400px, double-click resets, width persisted
 *  per browser). Both consumers inherit. */
@Component({
  selector: 'app-catalogue-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'hostClasses()',
    '[style.--bp-strip-w]': 'stripWidth() + "px"',
  },
  template: `
    <div class="relative hidden min-h-0 md:block md:overflow-y-auto">
      <ng-content select="[strip]" />
      <!-- Resize handle — sits on the strip's right edge. -->
      <div
        class="absolute inset-y-0 right-0 w-1.5 cursor-col-resize hover:bg-fill active:bg-fill"
        title="Drag to resize — double-click to reset"
        (pointerdown)="startResize($event)"
        (dblclick)="resetWidth()"
      ></div>
    </div>
    <!-- pr-1 keeps cards just off the column scrollbar; beyond the bar
         the outer whitespace then matches the left gutter (48/48 —
         QC 2026-06-12). -->
    <div class="min-h-0 min-w-0 md:overflow-y-auto md:pr-1">
      <ng-content />
    </div>
    @if (railVisible()) {
      <div class="hidden min-h-0 xl:block xl:overflow-y-auto">
        <ng-content select="[rail]" />
      </div>
    }
  `,
})
export class CatalogueLayoutComponent {
  private readonly store = inject(MarketplaceStore);

  /** The rail shows for list + table views only — never in card view. */
  protected readonly railVisible = computed(() => this.store.viewMode() !== 'card');

  protected readonly stripWidth = signal(readStoredWidth());

  /* Literal Tailwind class strings (the scanner needs them verbatim):
     'md:grid-cols-[var(--bp-strip-w)_1fr]'
     'xl:grid-cols-[var(--bp-strip-w)_1fr_260px]'
     '2xl:grid-cols-[var(--bp-strip-w)_1fr_300px]' */
  protected readonly hostClasses = computed(
    () =>
      'grid min-h-0 flex-1 grid-cols-1 gap-6 md:grid-cols-[var(--bp-strip-w)_1fr]' +
      (this.railVisible()
        ? ' xl:grid-cols-[var(--bp-strip-w)_1fr_260px] 2xl:grid-cols-[var(--bp-strip-w)_1fr_300px]'
        : '')
  );

  protected startResize(start: PointerEvent): void {
    start.preventDefault();
    const startX = start.clientX;
    const startW = this.stripWidth();
    const move = (e: PointerEvent) => {
      this.stripWidth.set(Math.min(STRIP_MAX, Math.max(STRIP_MIN, startW + e.clientX - startX)));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      try {
        localStorage.setItem(STRIP_STORE_KEY, String(this.stripWidth()));
      } catch {
        // storage may be unavailable (private mode) — width stays session-local
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  protected resetWidth(): void {
    this.stripWidth.set(STRIP_DEFAULT);
    try {
      localStorage.removeItem(STRIP_STORE_KEY);
    } catch {
      // ignore — see startResize
    }
  }
}

function readStoredWidth(): number {
  try {
    const stored = Number(localStorage.getItem(STRIP_STORE_KEY));
    if (Number.isFinite(stored) && stored >= STRIP_MIN && stored <= STRIP_MAX) return stored;
  } catch {
    // storage unavailable — default
  }
  return STRIP_DEFAULT;
}
