import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';

/** One picker axis + its selectable values. */
interface VariantDimension { name: string; values: string[]; }
/** One purchasable combination: the chosen value per dimension + its price. */
interface VariantCombo { values: Record<string, string>; price: number; }
/** The resolved selection emitted to the host (for add-to-quote wiring). */
export interface VariantSelection { values: Record<string, string>; price: number; }

/** pV2-STORE-VARIANTS-01 (Stage 2) — the configurator for a variable product.
 *  Reads `attributes.variants` { dimensions, combos } (see docs/ITEMS.md), renders one
 *  selector row per dimension, and resolves the chosen combination's exact price. Shows
 *  "From £X" until every dimension is chosen, then the exact price. Emits the resolved
 *  combo so the host can capture it into a quote line via the flat_total SSOT (Stage 3).
 *  Renders nothing when the item has no variant matrix. */
@Component({
  selector: 'app-item-variant-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe],
  template: `
    @if (dimensions().length) {
      <div class="bp-variant-picker">
        @for (d of dimensions(); track d.name) {
          <div class="bp-variant-row">
            <span class="bp-variant-row__label">{{ d.name }}</span>
            <div class="bp-variant-row__opts">
              @for (v of d.values; track v) {
                <button
                  type="button"
                  class="bp-variant-chip"
                  [class.bp-variant-chip--on]="selected()[d.name] === v"
                  [class.bp-variant-chip--off]="!isAvailable(d.name, v)"
                  (click)="pick(d.name, v)"
                >{{ v }}</button>
              }
            </div>
          </div>
        }

        <div class="bp-variant-price">
          @if (chosen(); as c) {
            <span class="bp-price-large">{{ c.price | currency: 'GBP' : 'symbol' : priceDigits(c.price) }}</span>
          } @else if (allChosen()) {
            <span class="bp-body-small text-warn">That combination isn't available — try another.</span>
          } @else {
            <span class="bp-price-large">From {{ minPrice() | currency: 'GBP' : 'symbol' : priceDigits(minPrice()) }}</span>
            <span class="bp-caption text-secondary">Choose all options for the exact price</span>
          }
        </div>
      </div>
    }
  `,
  styles: [
    `
      .bp-variant-picker { display: flex; flex-direction: column; gap: 0.85rem; }
      .bp-variant-row { display: flex; flex-direction: column; gap: 0.4rem; }
      .bp-variant-row__label {
        font-size: var(--text-xs);
        font-weight: 600;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--color-text-secondary);
      }
      .bp-variant-row__opts { display: flex; flex-wrap: wrap; gap: 0.4rem; }
      .bp-variant-chip {
        padding: 0.3rem 0.75rem;
        border: 1px solid var(--color-border-hairline);
        border-radius: var(--radius-pill);
        background: var(--color-surface);
        color: var(--color-text);
        font-size: var(--text-sm);
        cursor: pointer;
        transition: border-color 0.12s ease, background 0.12s ease, color 0.12s ease;
      }
      .bp-variant-chip:hover { border-color: var(--theme-accent); }
      .bp-variant-chip--on {
        background: var(--theme-accent);
        border-color: var(--theme-accent);
        color: var(--theme-accent-contrast, #fff);
      }
      /* Value that leads to no available combination given the current picks. */
      .bp-variant-chip--off { opacity: 0.45; }
      .bp-variant-price { display: flex; flex-direction: column; gap: 0.15rem; margin-top: 0.15rem; }
    `,
  ],
})
export class ItemVariantPickerComponent {
  /** The item's attributes bag (reads `.variants`). */
  readonly attributes = input<Record<string, unknown> | null>(null);
  /** Fallback base/"From" price when no combo is fully chosen. */
  readonly basePrice = input<number | null>(null);
  /** The resolved combination (null until a valid full combo is chosen). */
  readonly selectionChange = output<VariantSelection | null>();

  private readonly variants = computed(() => {
    const a = this.attributes();
    const v = a && typeof a === 'object' ? (a as Record<string, unknown>)['variants'] : null;
    if (!v || typeof v !== 'object') return null;
    const block = v as { dimensions?: unknown; combos?: unknown };
    const dimensions = Array.isArray(block.dimensions) ? (block.dimensions as VariantDimension[]) : [];
    const combos = Array.isArray(block.combos) ? (block.combos as VariantCombo[]) : [];
    return dimensions.length && combos.length ? { dimensions, combos } : null;
  });

  protected readonly dimensions = computed(() => this.variants()?.dimensions ?? []);
  private readonly combos = computed(() => this.variants()?.combos ?? []);

  /** The chosen value per dimension (empty until the visitor picks). */
  protected readonly selected = signal<Record<string, string>>({});

  protected readonly minPrice = computed(() => {
    const prices = this.combos().map((c) => c.price).filter((p) => typeof p === 'number');
    return prices.length ? Math.min(...prices) : this.basePrice();
  });

  protected readonly allChosen = computed(() => {
    const sel = this.selected();
    return this.dimensions().length > 0 && this.dimensions().every((d) => sel[d.name] != null);
  });

  /** The combo matching the full current selection (null until complete + valid). */
  protected readonly chosen = computed<VariantCombo | null>(() => {
    if (!this.allChosen()) return null;
    const sel = this.selected();
    return this.combos().find((c) => this.dimensions().every((d) => c.values[d.name] === sel[d.name])) ?? null;
  });

  constructor() {
    // Reset the picks whenever the item changes, and surface the resolved combo.
    effect(() => { this.variants(); this.selected.set({}); });
    effect(() => this.selectionChange.emit(this.chosen()));
  }

  protected pick(dim: string, value: string): void {
    this.selected.update((s) => {
      const next = { ...s };
      if (next[dim] === value) delete next[dim]; // click again to clear
      else next[dim] = value;
      return next;
    });
  }

  /** Is `value` for `dim` reachable given the OTHER current picks? (soft-dims impossible
   *  combos without hard-locking the axis being changed). */
  protected isAvailable(dim: string, value: string): boolean {
    const sel = this.selected();
    return this.combos().some((c) => {
      if (c.values[dim] !== value) return false;
      return Object.entries(sel).every(([k, v]) => k === dim || c.values[k] === v);
    });
  }

  protected priceDigits(p: number | null): string {
    return p != null && p < 100 ? '1.2-2' : '1.0-0';
  }
}
