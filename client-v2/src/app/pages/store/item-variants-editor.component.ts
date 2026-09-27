import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { VariantMatrix, VariantMode, normalizeVariants } from '../../shared/catalogue/variants.util';
import { DrawerComponent } from '../../shared/drawer/drawer.component';
import { ImagePickerComponent } from '../../shared/image-picker/image-picker.component';
import { PickerResult, PickerTab } from '../../core/media/media.types';

interface ValState { value: string; mode: VariantMode; amount: string; imageUrl: string | null; }
interface DimState { name: string; values: ValState[]; }

/** pV2-STORE-VARIANTS-UPCHARGE-01 / IMAGE-VARIANTS-01 — edit an item's variants.
 *  Each dimension is a named set of values; each value has a PRICE MODE (No cost /
 *  Upcharge +£ / Cost £) AND an optional IMAGE (Liam: "add an image per option") that
 *  becomes the hero when a buyer picks that value. Final unit price = base, then per
 *  dimension in order (absolute sets, upcharge adds). Emits the whole matrix on change. */
@Component({
  selector: 'app-item-variants-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, DrawerComponent, ImagePickerComponent],
  template: `
    <div class="flex flex-col gap-3">
      @for (d of dims(); track $index; let di = $index) {
        <div class="bp-qv-spec">
          <div class="flex items-center gap-2">
            <input class="bp-input-field flex-1" [value]="d.name" placeholder="Dimension (e.g. Size)"
                   (input)="renameDim(di, $any($event.target).value)" />
            <button type="button" class="shrink-0 text-muted hover:text-text" (click)="removeDim(di)" aria-label="Remove dimension"><lucide-icon name="trash-2" [size]="15" /></button>
          </div>
          <div class="mt-2 grid grid-cols-[1fr_7.5rem_6rem_44px_28px] items-center gap-2">
            <span class="bp-caption text-muted">Value</span>
            <span class="bp-caption text-muted">Pricing</span>
            <span class="bp-caption text-muted">Amount £</span>
            <span class="bp-caption text-muted">Image</span><span></span>
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
              <button type="button" class="bp-variant-img" (click)="openPicker(di, vi)"
                      [title]="v.imageUrl ? 'Change image' : 'Add an image for this option'" aria-label="Variant image">
                @if (v.imageUrl) { <img [src]="v.imageUrl" alt="" /> } @else { <lucide-icon name="image" [size]="16" /> }
              </button>
              <button type="button" class="text-muted hover:text-text" (click)="removeValue(di, vi)" aria-label="Remove value"><lucide-icon name="x" [size]="15" /></button>
            }
          </div>
          <button type="button" class="bp-btn-outline bp-body-small mt-2" (click)="addValue(di)"><lucide-icon name="plus" [size]="14" /> Add value</button>
        </div>
      }
      <button type="button" class="bp-btn-outline bp-body-small self-start" (click)="addDim()">
        <lucide-icon name="plus" [size]="14" /> Add dimension
      </button>
      <p class="bp-caption text-secondary">No cost = free choice (e.g. colour). Upcharge adds to the price; Cost sets it. Add an image per value and it becomes the main photo when a buyer picks it.</p>
    </div>

    <app-drawer [(open)]="drawerOpen" title="Variant image">
      <app-image-picker
        entityType="item"
        [enabledTabs]="imageTabs"
        [focalStep]="false"
        [searchSeed]="pickSeed()"
        [currentImageUrl]="pickCurrentUrl()"
        previewAspect="4/3"
        (chosen)="onPickImage($event)"
        (removed)="onRemoveImage()"
        (cancelled)="drawerOpen.set(false)"
      />
    </app-drawer>
  `,
  styles: [
    `
      .bp-variant-img {
        width: 40px; height: 40px;
        display: flex; align-items: center; justify-content: center;
        border: 1px solid var(--color-border-hairline);
        border-radius: 8px;
        background: var(--color-surface);
        color: var(--color-text-secondary);
        overflow: hidden;
        cursor: pointer;
      }
      .bp-variant-img:hover { border-color: var(--theme-accent); color: var(--theme-accent); }
      .bp-variant-img img { width: 100%; height: 100%; object-fit: cover; }
    `,
  ],
})
export class ItemVariantsEditorComponent {
  readonly variants = input<VariantMatrix | null | undefined>(null);
  readonly variantsChange = output<VariantMatrix | null>();

  protected readonly dims = signal<DimState[]>([]);
  private hydrating = false;
  protected readonly imageTabs: PickerTab[] = ['upload', 'find'];
  protected readonly drawerOpen = signal(false);
  /** Which value's image is being picked. */
  private readonly picking = signal<{ di: number; vi: number } | null>(null);
  protected readonly pickSeed = computed(() => {
    const p = this.picking(); if (!p) return '';
    return this.dims()[p.di]?.values[p.vi]?.value ?? '';
  });
  protected readonly pickCurrentUrl = computed(() => {
    const p = this.picking(); if (!p) return null;
    return this.dims()[p.di]?.values[p.vi]?.imageUrl ?? null;
  });

  constructor() {
    effect(() => {
      const m = normalizeVariants(this.variants());
      this.hydrating = true;
      this.dims.set((m?.dimensions ?? []).map((d) => ({
        name: d.name,
        values: d.values.map((v) => ({ value: v.value, mode: v.mode, amount: v.amount ? String(v.amount) : '', imageUrl: v.imageUrl ?? null })),
      })));
      this.hydrating = false;
    });
  }

  protected addDim(): void {
    this.dims.update((ds) => [...ds, { name: '', values: [{ value: '', mode: 'none', amount: '', imageUrl: null }] }]);
    this.emit();
  }
  protected removeDim(i: number): void { this.dims.update((ds) => ds.filter((_, x) => x !== i)); this.emit(); }
  protected renameDim(i: number, name: string): void {
    this.dims.update((ds) => ds.map((d, x) => (x === i ? { ...d, name } : d)));
    this.emit();
  }
  protected addValue(i: number): void {
    this.dims.update((ds) => ds.map((d, x) => (x === i ? { ...d, values: [...d.values, { value: '', mode: 'none', amount: '', imageUrl: null }] } : d)));
    this.emit();
  }
  protected removeValue(i: number, vi: number): void {
    this.dims.update((ds) => ds.map((d, x) => (x === i ? { ...d, values: d.values.filter((_, y) => y !== vi) } : d)));
    this.emit();
  }
  protected setValue(i: number, vi: number, value: string): void { this.patchVal(i, vi, (v) => ({ ...v, value })); }
  protected setMode(i: number, vi: number, mode: string): void {
    const m = (mode === 'absolute' || mode === 'upcharge') ? mode : 'none';
    this.patchVal(i, vi, (v) => ({ ...v, mode: m as VariantMode }));
  }
  protected setAmount(i: number, vi: number, amount: string): void { this.patchVal(i, vi, (v) => ({ ...v, amount })); }

  // ── image per value ────────────────────────────────────────────────────────
  protected openPicker(di: number, vi: number): void { this.picking.set({ di, vi }); this.drawerOpen.set(true); }
  protected onPickImage(r: PickerResult): void {
    const p = this.picking();
    if (p && r.type === 'image') this.patchVal(p.di, p.vi, (v) => ({ ...v, imageUrl: r.url }));
    this.drawerOpen.set(false);
  }
  protected onRemoveImage(): void {
    const p = this.picking();
    if (p) this.patchVal(p.di, p.vi, (v) => ({ ...v, imageUrl: null }));
    this.drawerOpen.set(false);
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
            ...(v.imageUrl ? { imageUrl: v.imageUrl } : {}),
          })),
      }))
      .filter((d) => d.values.length);
    this.variantsChange.emit(dimensions.length ? { dimensions } : null);
  }
}
