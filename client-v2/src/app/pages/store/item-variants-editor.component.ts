import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

/** The variant-matrix shape stored in `items.attributes.variants` (pV2-STORE-VARIANTS-01):
 *  a list of dimensions (each a named set of values) + the priced combinations. A
 *  dimension that drives price appears as a key in every combo; a "picker-only"
 *  dimension (e.g. Paper Type) is declared but never in a combo. */
export interface VariantMatrix {
  dimensions: { name: string; values: string[] }[];
  combos: { values: Record<string, string>; price: number }[];
}

interface DimState { name: string; values: string[]; pricing: boolean; valueInput: string; }

/** pV2-STORE-VARIANTS-EDIT-01 — edit an item's variant matrix (multi-dimension
 *  options). Was invisible in the editor (only the marketplace quick-view rendered
 *  variants), so extracted variable products couldn't be managed. Two blocks:
 *  DIMENSIONS (name + value chips + an "Affects price" toggle so a dimension can be
 *  picker-only) and COMBINATION PRICING (the cartesian of the pricing dimensions,
 *  one price per row; existing prices preserved by coordinate). Emits the whole
 *  matrix on any change — the host persists it via the item's normal save. */
@Component({
  selector: 'app-item-variants-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    <div class="flex flex-col gap-3">
      @for (d of dims(); track $index) {
        <div class="bp-qv-spec">
          <div class="flex items-center gap-2">
            <input class="bp-input-field flex-1" [value]="d.name" placeholder="Dimension (e.g. Size)"
                   (input)="renameDim($index, $any($event.target).value)" />
            <label class="bp-caption flex shrink-0 items-center gap-1 text-secondary" title="Picker-only dimensions (e.g. Paper Type) don't change the price">
              <input type="checkbox" [checked]="d.pricing" (change)="togglePricing($index)" /> Affects price
            </label>
            <button type="button" class="shrink-0 text-muted hover:text-text" (click)="removeDim($index)" aria-label="Remove dimension"><lucide-icon name="trash-2" [size]="15" /></button>
          </div>
          <div class="mt-2 flex flex-wrap items-center gap-1.5">
            @for (v of d.values; track v) {
              <span class="bp-tag-chip inline-flex items-center gap-1">{{ v }}
                <button type="button" class="text-muted hover:text-text" (click)="removeValue($index, v)" aria-label="Remove value"><lucide-icon name="x" [size]="12" /></button>
              </span>
            }
            <input class="bp-input-field" style="width: 11rem;" placeholder="Add value + Enter"
                   [value]="d.valueInput"
                   (input)="setValueInput($index, $any($event.target).value)"
                   (keydown.enter)="$event.preventDefault(); addValue($index)"
                   (blur)="addValue($index)" />
          </div>
        </div>
      }
      <button type="button" class="bp-btn-outline bp-body-small self-start" (click)="addDim()">
        <lucide-icon name="plus" [size]="14" /> Add dimension
      </button>

      @if (pricingDims().length && comboRows().length) {
        <div class="bp-qv-spec">
          <span class="bp-qv-spec__label"><lucide-icon name="tags" [size]="13" /> Combination pricing</span>
          <p class="bp-caption text-secondary mt-1">One price per combination of the price-affecting dimensions. Blank rows are ignored.</p>
          <div class="mt-2 overflow-x-auto">
            <table class="w-full border-collapse text-left">
              <thead>
                <tr class="border-b border-hairline">
                  @for (pd of pricingDims(); track pd.name) { <th class="bp-caption py-1 pr-3 text-muted">{{ pd.name }}</th> }
                  <th class="bp-caption py-1 text-muted">Price £</th>
                </tr>
              </thead>
              <tbody>
                @for (row of comboRows(); track row.key) {
                  <tr class="border-b border-hairline/60">
                    @for (pd of pricingDims(); track pd.name) { <td class="bp-body-small py-1 pr-3 text-secondary">{{ row.coord[pd.name] }}</td> }
                    <td class="py-1">
                      <input type="number" class="bp-input-field" style="width: 7rem;" placeholder="0.00"
                             [value]="row.price" (input)="setPrice(row.key, $any($event.target).value)" />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>
  `,
})
export class ItemVariantsEditorComponent {
  readonly variants = input<VariantMatrix | null | undefined>(null);
  readonly variantsChange = output<VariantMatrix | null>();

  protected readonly dims = signal<DimState[]>([]);
  /** Combo price by canonical coordinate key (pricing dims joined). */
  private readonly prices = signal<Record<string, number>>({});
  /** Guards the emit-on-change effect from firing during input hydration. */
  private hydrating = false;

  constructor() {
    // Hydrate local edit state from the incoming matrix (once per distinct input).
    effect(() => {
      const v = this.variants();
      this.hydrating = true;
      const combos = v?.combos ?? [];
      const pricingNames = new Set<string>();
      for (const c of combos) for (const k of Object.keys(c.values ?? {})) pricingNames.add(k);
      this.dims.set((v?.dimensions ?? []).map((d) => ({
        name: d.name,
        values: [...(d.values ?? [])],
        // A dimension is "pricing" if it keys the combos; a fresh matrix with no
        // combos yet treats every declared dimension as pricing.
        pricing: pricingNames.size ? pricingNames.has(d.name) : true,
        valueInput: '',
      })));
      const p: Record<string, number> = {};
      for (const c of combos) p[this.keyOf(c.values)] = c.price;
      this.prices.set(p);
      this.hydrating = false;
    });
  }

  protected readonly pricingDims = computed(() => this.dims().filter((d) => d.pricing && d.values.length));

  /** The cartesian product of the pricing dimensions' values — one editable row each. */
  protected readonly comboRows = computed(() => {
    const pd = this.pricingDims();
    if (!pd.length) return [] as { key: string; coord: Record<string, string>; price: string }[];
    let coords: Record<string, string>[] = [{}];
    for (const d of pd) {
      const next: Record<string, string>[] = [];
      for (const c of coords) for (const val of d.values) next.push({ ...c, [d.name]: val });
      coords = next;
      if (coords.length > 500) break; // safety cap — no runaway matrices in the UI
    }
    const prices = this.prices();
    return coords.map((coord) => {
      const key = this.keyOf(coord);
      const price = prices[key];
      return { key, coord, price: price == null ? '' : String(price) };
    });
  });

  // Canonical key: pricing dimension values in a stable order (sorted by dim name).
  private keyOf(values: Record<string, string>): string {
    return Object.keys(values).sort().map((k) => `${k}=${values[k]}`).join('|');
  }

  // ── dimension edits ──────────────────────────────────────────────────────
  protected addDim(): void {
    this.dims.update((ds) => [...ds, { name: '', values: [], pricing: true, valueInput: '' }]);
    this.emit();
  }
  protected removeDim(i: number): void {
    this.dims.update((ds) => ds.filter((_, x) => x !== i));
    this.emit();
  }
  protected renameDim(i: number, name: string): void {
    this.dims.update((ds) => ds.map((d, x) => (x === i ? { ...d, name } : d)));
    this.emit();
  }
  protected togglePricing(i: number): void {
    this.dims.update((ds) => ds.map((d, x) => (x === i ? { ...d, pricing: !d.pricing } : d)));
    this.emit();
  }
  protected setValueInput(i: number, val: string): void {
    this.dims.update((ds) => ds.map((d, x) => (x === i ? { ...d, valueInput: val } : d)));
  }
  protected addValue(i: number): void {
    const d = this.dims()[i];
    if (!d) return;
    const v = d.valueInput.trim();
    if (!v || d.values.some((x) => x.toLowerCase() === v.toLowerCase())) {
      if (d.valueInput) this.setValueInput(i, '');
      return;
    }
    this.dims.update((ds) => ds.map((x, idx) => (idx === i ? { ...x, values: [...x.values, v], valueInput: '' } : x)));
    this.emit();
  }
  protected removeValue(i: number, val: string): void {
    this.dims.update((ds) => ds.map((d, x) => (x === i ? { ...d, values: d.values.filter((v) => v !== val) } : d)));
    this.emit();
  }
  protected setPrice(key: string, val: string): void {
    const n = val.trim() === '' ? null : Number(val);
    this.prices.update((p) => {
      const next = { ...p };
      if (n == null || Number.isNaN(n)) delete next[key];
      else next[key] = n;
      return next;
    });
    this.emit();
  }

  /** Emit the assembled matrix (null when there are no dimensions, so the host can
   *  drop the key entirely for a non-variant item). */
  private emit(): void {
    if (this.hydrating) return;
    const dims = this.dims().filter((d) => d.name.trim());
    if (!dims.length) { this.variantsChange.emit(null); return; }
    const dimensions = dims.map((d) => ({ name: d.name.trim(), values: [...d.values] }));
    const combos = this.comboRows()
      .filter((r) => r.price !== '' && !Number.isNaN(Number(r.price)))
      .map((r) => ({ values: r.coord, price: Number(r.price) }));
    this.variantsChange.emit({ dimensions, combos });
  }
}
