import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { VariantMatrix, VariantMode, normalizeVariants } from '../../shared/catalogue/variants.util';

interface ValState { value: string; mode: VariantMode; amount: string; }
interface DimState { name: string; values: ValState[]; }

/** pV2-STORE-VARIANTS-UPCHARGE-01 — edit an item's variants. Each dimension is a
 *  named set of values; each value has a PRICE MODE (Liam): No cost (free pick),
 *  Cost (absolute — sets the price) or Upcharge (+£ delta). Final unit price = base,
 *  then per dimension in order (absolute sets, upcharge adds). Volume pricing is a
 *  separate mechanism, not combined here. Emits the whole matrix on change; null when
 *  there are no named dimensions. */
@Component({
  selector: 'app-item-variants-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    <div class="flex flex-col gap-3">
      @for (d of dims(); track $index; let di = $index) {
        <div class="bp-qv-spec">
          <div class="flex items-center gap-2">
            <input class="bp-input-field flex-1" [value]="d.name" placeholder="Dimension (e.g. Size)"
                   (input)="renameDim(di, $any($event.target).value)" />
            <button type="button" class="shrink-0 text-muted hover:text-text" (click)="removeDim(di)" aria-label="Remove dimension"><lucide-icon name="trash-2" [size]="15" /></button>
          </div>
          <div class="mt-2 grid grid-cols-[1fr_8.5rem_7rem_28px] items-center gap-2">
            <span class="bp-caption text-muted">Value</span>
            <span class="bp-caption text-muted">Pricing</span>
            <span class="bp-caption text-muted">Amount £</span><span></span>
            @for (v of d.values; track $index; let vi = $index) {
              <input class="bp-input-field" placeholder="e.g. A4" [value]="v.value" (input)="setValue(di, vi, $any($event.target).value)" />
              <select class="bp-input-field" [value]="v.mode" (change)="setMode(di, vi, $any($event.target).value)">
                <option value="none">No cost</option>
                <option value="upcharge">Upcharge (+£)</option>
                <option value="absolute">Cost (£)</option>
              </select>
              <input type="number" class="bp-input-field" [placeholder]="v.mode === 'none' ? 'Free' : '0.00'"
                     [disabled]="v.mode === 'none'" [value]="v.amount"
                     (input)="setAmount(di, vi, $any($event.target).value)" />
              <button type="button" class="text-muted hover:text-text" (click)="removeValue(di, vi)" aria-label="Remove value"><lucide-icon name="x" [size]="15" /></button>
            }
          </div>
          <button type="button" class="bp-btn-outline bp-body-small mt-2" (click)="addValue(di)"><lucide-icon name="plus" [size]="14" /> Add value</button>
        </div>
      }
      <button type="button" class="bp-btn-outline bp-body-small self-start" (click)="addDim()">
        <lucide-icon name="plus" [size]="14" /> Add dimension
      </button>
      <p class="bp-caption text-secondary">No cost = free choice (e.g. colour). Upcharge adds to the price; Cost sets it. Across dimensions, applied in order — cost sets, upcharges add.</p>
    </div>
  `,
})
export class ItemVariantsEditorComponent {
  readonly variants = input<VariantMatrix | null | undefined>(null);
  readonly variantsChange = output<VariantMatrix | null>();

  protected readonly dims = signal<DimState[]>([]);
  private hydrating = false;

  constructor() {
    effect(() => {
      const m = normalizeVariants(this.variants());
      this.hydrating = true;
      this.dims.set((m?.dimensions ?? []).map((d) => ({
        name: d.name,
        values: d.values.map((v) => ({ value: v.value, mode: v.mode, amount: v.amount ? String(v.amount) : '' })),
      })));
      this.hydrating = false;
    });
  }

  protected addDim(): void {
    this.dims.update((ds) => [...ds, { name: '', values: [{ value: '', mode: 'none', amount: '' }] }]);
    this.emit();
  }
  protected removeDim(i: number): void { this.dims.update((ds) => ds.filter((_, x) => x !== i)); this.emit(); }
  protected renameDim(i: number, name: string): void {
    this.dims.update((ds) => ds.map((d, x) => (x === i ? { ...d, name } : d)));
    this.emit();
  }
  protected addValue(i: number): void {
    this.dims.update((ds) => ds.map((d, x) => (x === i ? { ...d, values: [...d.values, { value: '', mode: 'none', amount: '' }] } : d)));
    this.emit();
  }
  protected removeValue(i: number, vi: number): void {
    this.dims.update((ds) => ds.map((d, x) => (x === i ? { ...d, values: d.values.filter((_, y) => y !== vi) } : d)));
    this.emit();
  }
  protected setValue(i: number, vi: number, value: string): void {
    this.patchVal(i, vi, (v) => ({ ...v, value }));
  }
  protected setMode(i: number, vi: number, mode: string): void {
    const m = (mode === 'absolute' || mode === 'upcharge') ? mode : 'none';
    this.patchVal(i, vi, (v) => ({ ...v, mode: m as VariantMode }));
  }
  protected setAmount(i: number, vi: number, amount: string): void {
    this.patchVal(i, vi, (v) => ({ ...v, amount }));
  }
  private patchVal(i: number, vi: number, fn: (v: ValState) => ValState): void {
    this.dims.update((ds) => ds.map((d, x) => (x === i ? { ...d, values: d.values.map((v, y) => (y === vi ? fn(v) : v)) } : d)));
    this.emit();
  }

  private emit(): void {
    if (this.hydrating) return;
    const dimensions = this.dims()
      .filter((d) => d.name.trim())
      .map((d) => ({
        name: d.name.trim(),
        values: d.values
          .filter((v) => v.value.trim())
          .map((v) => ({
            value: v.value.trim(),
            mode: v.mode,
            amount: v.mode === 'none' || v.amount.trim() === '' ? 0 : Number(v.amount) || 0,
          })),
      }))
      .filter((d) => d.values.length);
    this.variantsChange.emit(dimensions.length ? { dimensions } : null);
  }
}
