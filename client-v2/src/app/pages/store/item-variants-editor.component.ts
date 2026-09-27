import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { VariantMatrix, normalizeVariants } from '../../shared/catalogue/variants.util';

interface ValState { value: string; upcharge: string; }
interface DimState { name: string; values: ValState[]; valueInput: string; }

/** pV2-STORE-VARIANTS-UPCHARGE-01 — edit an item's variants as UPCHARGE dimensions
 *  (Liam): each dimension is a named set of values, and each value carries a +£ delta
 *  (0 = free pick). The configured unit price = base + Σ(selected upcharges); volume
 *  pricing (a separate % mechanism) is not combined here. Supersedes the absolute
 *  combo-matrix editor. Emits the whole matrix on change (host persists it); null when
 *  there are no named dimensions (so a non-variant item keeps a clean attributes bag). */
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
            <button type="button" class="shrink-0 text-muted hover:text-text" (click)="removeDim($index)" aria-label="Remove dimension"><lucide-icon name="trash-2" [size]="15" /></button>
          </div>
          <div class="mt-2 grid grid-cols-[1fr_7rem_28px] items-center gap-2">
            <span class="bp-caption text-muted">Value</span>
            <span class="bp-caption text-muted">+ £ upcharge</span><span></span>
            @for (v of d.values; track $index; let vi = $index) {
              <input class="bp-input-field" placeholder="e.g. A4" [value]="v.value" (input)="setValue($index, vi, $any($event.target).value)" />
              <input type="number" class="bp-input-field" placeholder="0.00" [value]="v.upcharge" (input)="setUpcharge($index, vi, $any($event.target).value)" />
              <button type="button" class="text-muted hover:text-text" (click)="removeValue($index, vi)" aria-label="Remove value"><lucide-icon name="x" [size]="15" /></button>
            }
          </div>
          <button type="button" class="bp-btn-outline bp-body-small mt-2" (click)="addValue($index)"><lucide-icon name="plus" [size]="14" /> Add value</button>
        </div>
      }
      <button type="button" class="bp-btn-outline bp-body-small self-start" (click)="addDim()">
        <lucide-icon name="plus" [size]="14" /> Add dimension
      </button>
      <p class="bp-caption text-secondary">Each value's upcharge is added to the base price. Leave 0 for a free choice (e.g. colour). For absolute per-value pricing, set the item's base to 0 and enter the full price here.</p>
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
        values: d.values.map((v) => ({ value: v.value, upcharge: v.upcharge ? String(v.upcharge) : '' })),
        valueInput: '',
      })));
      this.hydrating = false;
    });
  }

  protected addDim(): void {
    this.dims.update((ds) => [...ds, { name: '', values: [{ value: '', upcharge: '' }], valueInput: '' }]);
    this.emit();
  }
  protected removeDim(i: number): void { this.dims.update((ds) => ds.filter((_, x) => x !== i)); this.emit(); }
  protected renameDim(i: number, name: string): void {
    this.dims.update((ds) => ds.map((d, x) => (x === i ? { ...d, name } : d)));
    this.emit();
  }
  protected addValue(i: number): void {
    this.dims.update((ds) => ds.map((d, x) => (x === i ? { ...d, values: [...d.values, { value: '', upcharge: '' }] } : d)));
    this.emit();
  }
  protected removeValue(i: number, vi: number): void {
    this.dims.update((ds) => ds.map((d, x) => (x === i ? { ...d, values: d.values.filter((_, y) => y !== vi) } : d)));
    this.emit();
  }
  protected setValue(i: number, vi: number, value: string): void {
    this.dims.update((ds) => ds.map((d, x) => (x === i ? { ...d, values: d.values.map((v, y) => (y === vi ? { ...v, value } : v)) } : d)));
    this.emit();
  }
  protected setUpcharge(i: number, vi: number, upcharge: string): void {
    this.dims.update((ds) => ds.map((d, x) => (x === i ? { ...d, values: d.values.map((v, y) => (y === vi ? { ...v, upcharge } : v)) } : d)));
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
          .map((v) => ({ value: v.value.trim(), upcharge: v.upcharge.trim() === '' ? 0 : Number(v.upcharge) || 0 })),
      }))
      .filter((d) => d.values.length);
    this.variantsChange.emit(dimensions.length ? { dimensions } : null);
  }
}
