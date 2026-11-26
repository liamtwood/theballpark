import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { VariantMatrix, VariantValue, variantMatrixFor, normalizeVariants, computeUnitPrice, minUnitPrice, hasPricing, selectedImage, selectedDescriptions } from './variants.util';
import { WhatsIncludedComponent } from './whats-included.component';

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
  imports: [CurrencyPipe, LucideAngularModule, WhatsIncludedComponent],
  template: `
    @if (dimensions().length) {
      <div class="bp-variant-picker">
        @for (d of dimensions(); track d.name) {
          <div class="bp-variant-row">
            <span class="bp-variant-row__label">{{ d.name }}</span>
            @if (presentation() === 'picklist') {
              <!-- pV2-STORE-PACKAGES-01 — picklist presentation (packages_meta). -->
              <select class="bp-input-field bp-variant-select" (change)="choose(d.name, $any($event.target).value)">
                <!-- Placeholder first so the buyer sees the BASE item cover before picking (Liam). -->
                <option value="" [selected]="!selected()[d.name]">Select {{ d.name }}</option>
                @for (v of d.values; track v.value) {
                  <option [value]="v.value" [selected]="selected()[d.name] === v.value">{{ v.value }}@if (valuePrice(v); as vp) { — {{ vp }}@if (v.unitLabel) {&nbsp;{{ v.unitLabel }}}}</option>
                }
              </select>
            } @else {
              <div class="bp-variant-row__opts">
                @for (v of d.values; track v.value) {
                  <button
                    type="button"
                    class="bp-variant-chip"
                    [class.bp-variant-chip--on]="selected()[d.name] === v.value"
                    [style.--vc]="v.color || 'var(--theme-accent)'"
                    (click)="pick(d.name, v.value)"
                  >
                    @if (selected()[d.name] === v.value) {
                      <lucide-icon class="bp-variant-chip__tick" name="check" [size]="15" />
                    }
                    <span class="bp-variant-chip__name">{{ v.value }}</span>
                    @if (valuePrice(v); as vp) { <span class="bp-variant-chip__price">{{ vp }}@if (v.unitLabel) { <span class="bp-variant-chip__unit">&nbsp;{{ v.unitLabel }}</span>}</span> }
                  </button>
                }
              </div>
            }
          </div>
        }

        <!-- pV2-STORE-VARIANT-DESC-01 — supporting copy for the picked value(s), under
             the choice boxes. Reveals on pick (mirrors the hero-image swap); markdown
             via the safe md pipe. Multi-dimension items stack one note per picked value
             (tracked by value). -->
        <app-whats-included [descriptions]="descriptionTexts()" />

        <!-- Price line only when a choice can change the price (any non-zero upcharge),
             and only when the host hasn't taken over the price (Quick View shows it on
             the "Add to ballpark · £…" button instead, so showPrice is false there). -->
        @if (showPrice() && hasPricing()) {
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
      .bp-variant-row__opts { display: flex; flex-wrap: wrap; gap: 0.5rem; }
      /* .bp-variant-chip* now live in styles.css (shared with the item-edit Packages
         editor so authoring chips match buyer chips) — pV2-STORE-PACKAGES-01. */
      /* Custom chevron so the arrow has consistent breathing room (native select
         crowds it against the edge) — pV2-STORE-PACKAGES-01. */
      .bp-variant-select {
        max-width: 22rem;
        appearance: none;
        -webkit-appearance: none;
        padding-right: 2.5rem;
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>");
        background-repeat: no-repeat;
        background-position: right 0.85rem center;
        background-size: 1rem;
      }
      .bp-variant-price { display: flex; flex-direction: column; gap: 0.15rem; margin-top: 0.15rem; }
      /* pV2-STORE-VARIANT-DESC-01 — the picked value's supporting copy, under the rows. */
      /* "What's included" copy lives in the shared app-whats-included component. */
    `,
  ],
})
export class ItemVariantPickerComponent {
  /** The item's attributes bag (reads `.variants`). */
  readonly attributes = input<Record<string, unknown> | null>(null);
  /** pV2-STORE-VARIANT-CHILDREN-01 — the item's variant child rows (preferred source). */
  readonly variants = input<unknown[]>([]);
  /** Base unit price — the configured price builds on this (+ upcharges). */
  readonly basePrice = input<number | null>(null);
  /** Show the picker's own configured-price line. Off when the host surfaces the
   *  price elsewhere — e.g. Quick View's "Add to ballpark · £…" button (Liam 2026-11-23). */
  readonly showPrice = input<boolean>(true);
  /** The resolved selection (null until every dimension is chosen). */
  readonly selectionChange = output<VariantSelection | null>();
  /** pV2-STORE-IMAGE-VARIANTS-01 — the image for the current pick (the most specific
   *  selected value that has one), or null. Fires on every pick so the host can swap
   *  the hero/cover image live — even before all dimensions are chosen. */
  readonly imageChange = output<string | null>();

  // pV2-STORE-PACKAGES-01 — real variants, else packages as a single "Package"
  // dimension, so a package item renders through the same picker.
  private readonly matrix = computed<VariantMatrix | null>(() => variantMatrixFor(this.attributes(), this.variants()));
  protected readonly dimensions = computed(() => this.matrix()?.dimensions ?? []);
  /** pV2-STORE-PACKAGES-01 — buyer picks via chips (buttons) or a dropdown (picklist),
   *  per attributes.packages_meta.presentation. Real variants always render as chips. */
  protected readonly presentation = computed<'buttons' | 'picklist'>(() => {
    const attrs = this.attributes() as Record<string, unknown> | null;
    // Option Levels (the multi-dimension configurator held in attributes.variants) reads
    // better as dropdowns than rows of chips — render it as picklists (Liam 2026-11-25).
    if (normalizeVariants(attrs?.['variants'])) return 'picklist';
    const m = attrs?.['packages_meta'] as { presentation?: unknown } | undefined;
    return m?.presentation === 'picklist' ? 'picklist' : 'buttons';
  });
  /** Any value affects the price → show the price line. */
  protected readonly hasPricing = computed(() => hasPricing(this.matrix()));
  /** pV2-STORE-VARIANT-DESC-01 — descriptions of the currently selected value(s). */
  protected readonly descriptions = computed(() => selectedDescriptions(this.matrix(), this.selected()));
  /** The picked value(s)' description text for the shared "What's included" block. */
  protected readonly descriptionTexts = computed<string[]>(() => this.descriptions().map((d) => d.description));

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
    // BUTTONS: auto-select the first value per dimension (Liam 2026-11-11) so Quick View
    // opens pre-configured. PICKLIST: start EMPTY on a "Select {group}" placeholder so the
    // buyer sees the base item cover before picking (Liam 2026-11-25).
    effect(() => {
      const def: Record<string, string> = {};
      if (this.presentation() !== 'picklist') {
        for (const d of (this.matrix()?.dimensions ?? [])) {
          if (d.values?.length) def[d.name] = d.values[0].value;
        }
      }
      this.selected.set(def);
    });
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

  /** Picklist (dropdown) selection — the empty placeholder clears the pick. */
  protected choose(dim: string, value: string): void {
    this.selected.update((s) => {
      const next = { ...s };
      if (value === '') delete next[dim]; else next[dim] = value;
      return next;
    });
  }

  /** The price shown UNDER a value's name — whole £ when round, 2 dps when there
   *  are pence (it's money): absolute "£1,200" / "£1,353.10", upcharge
   *  "+£5" / "+£5.50"/"−£2.50", null for a free pick (just the name). */
  protected valuePrice(v: VariantValue): string | null {
    if (v.mode === 'none' || !v.amount) return null;
    // Whole pounds only — no pence anywhere in the catalogue (Liam 2026-11-25).
    const money = (n: number) => '£' + Math.round(Math.abs(n)).toLocaleString('en-GB', { maximumFractionDigits: 0 });
    if (v.mode === 'absolute') return money(v.amount);
    return (v.amount > 0 ? '+' : '−') + money(v.amount);
  }

  protected priceDigits(_p: number | null): string {
    return '1.0-0'; // whole pounds only — no pence (Liam 2026-11-25)
  }
}
