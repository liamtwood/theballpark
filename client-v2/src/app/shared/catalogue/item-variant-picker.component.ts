import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { TooltipModule } from 'primeng/tooltip';
import { VariantMatrix, VariantValue, normalizeVariants, computeUnitPrice, minUnitPrice, hasPricing, selectedImage } from './variants.util';

/** The resolved selection emitted to the host (for add-to-quote wiring). */
export interface VariantSelection { values: Record<string, string>; price: number; }

/** pV2-STORE-VARIANTS-UPCHARGE-01 — the configurator for a variant product. Reads
 *  `attributes.variants` (upcharge shape via normalizeVariants — legacy combos still
 *  read), renders one selector row per dimension, and computes the configured unit
 *  price = base + Σ(selected upcharges). Volume pricing (a qty-based % discount) is a
 *  SEPARATE mechanism applied at the quote line, so it never collides here. Each chip
 *  shows its "+£" on hover. Emits the resolved selection + configured price. Renders
 *  nothing when the item has no dimensions. */
@Component({
  selector: 'app-item-variant-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, TooltipModule],
  template: `
    @if (dimensions().length) {
      <div class="bp-variant-picker">
        @for (d of dimensions(); track d.name) {
          <div class="bp-variant-row">
            <span class="bp-variant-row__label">{{ d.name }}</span>
            <div class="bp-variant-row__opts">
              @for (v of d.values; track v.value) {
                <button
                  type="button"
                  class="bp-variant-chip"
                  [class.bp-variant-chip--on]="selected()[d.name] === v.value"
                  [pTooltip]="priceHint(v) ?? ''"
                  tooltipStyleClass="bp-tooltip"
                  tooltipPosition="top"
                  (click)="pick(d.name, v.value)"
                >{{ v.value }}</button>
              }
            </div>
          </div>
        }

        <!-- Price line only when a choice can change the price (any non-zero upcharge). -->
        @if (hasPricing()) {
          <div class="bp-variant-price">
            @if (allChosen()) {
              <span class="bp-price-large">{{ unitPrice() | currency: 'GBP' : 'symbol' : priceDigits(unitPrice()) }}</span>
            } @else {
              <span class="bp-price-large">From {{ minPrice() | currency: 'GBP' : 'symbol' : priceDigits(minPrice()) }}</span>
              <span class="bp-caption text-secondary">Choose all options for the exact price</span>
            }
          </div>
        }
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
      .bp-variant-price { display: flex; flex-direction: column; gap: 0.15rem; margin-top: 0.15rem; }
    `,
  ],
})
export class ItemVariantPickerComponent {
  /** The item's attributes bag (reads `.variants`). */
  readonly attributes = input<Record<string, unknown> | null>(null);
  /** Base unit price — the configured price builds on this (+ upcharges). */
  readonly basePrice = input<number | null>(null);
  /** The resolved selection (null until every dimension is chosen). */
  readonly selectionChange = output<VariantSelection | null>();
  /** pV2-STORE-IMAGE-VARIANTS-01 — the image for the current pick (the most specific
   *  selected value that has one), or null. Fires on every pick so the host can swap
   *  the hero/cover image live — even before all dimensions are chosen. */
  readonly imageChange = output<string | null>();

  private readonly matrix = computed<VariantMatrix | null>(() => normalizeVariants(
    (this.attributes() as Record<string, unknown> | null)?.['variants']
  ));
  protected readonly dimensions = computed(() => this.matrix()?.dimensions ?? []);
  /** Any value affects the price → show the price line. */
  protected readonly hasPricing = computed(() => hasPricing(this.matrix()));

  /** The chosen value per dimension (empty until the visitor picks). */
  protected readonly selected = signal<Record<string, string>>({});

  protected readonly allChosen = computed(() => {
    const sel = this.selected();
    return this.dimensions().length > 0 && this.dimensions().every((d) => sel[d.name] != null);
  });

  /** Configured unit price = base, then per dimension (absolute sets, upcharge adds). */
  protected readonly unitPrice = computed(() => computeUnitPrice(this.basePrice(), this.matrix(), this.selected()));

  /** Cheapest achievable configured price — the honest "From". */
  protected readonly minPrice = computed(() => minUnitPrice(this.basePrice(), this.matrix()));

  constructor() {
    // Reset picks whenever the item changes.
    effect(() => { this.matrix(); this.selected.set({}); });
    // Emit the full selection + configured price once every dimension is chosen.
    effect(() => {
      if (!this.allChosen()) { this.selectionChange.emit(null); return; }
      this.selectionChange.emit({ values: { ...this.selected() }, price: this.unitPrice() });
    });
    // Swap the hero image live as values are picked (the selected value's image).
    effect(() => { this.imageChange.emit(selectedImage(this.matrix(), this.selected())); });
  }

  protected pick(dim: string, value: string): void {
    this.selected.update((s) => {
      const next = { ...s };
      if (next[dim] === value) delete next[dim]; // click again to clear
      else next[dim] = value;
      return next;
    });
  }

  /** Hover label for a chip — absolute "£68", upcharge "+£5"/"−£2", null for free. */
  protected priceHint(v: VariantValue): string | null {
    if (v.mode === 'none' || !v.amount) return null;
    const abs = Math.abs(v.amount);
    const money = '£' + (abs < 100 ? abs.toFixed(2) : String(Math.round(abs)));
    if (v.mode === 'absolute') return money;
    return (v.amount > 0 ? '+' : '−') + money;
  }

  protected priceDigits(p: number | null): string {
    return p != null && p < 100 ? '1.2-2' : '1.0-0';
  }
}
