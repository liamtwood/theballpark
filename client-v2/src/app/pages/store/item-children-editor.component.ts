import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { EditFieldComponent, EditFieldOption } from '../../shared/edit-field/edit-field.component';
import { MdHelpComponent } from '../../shared/md-help.component';
import { GalleryImage } from '../../core/media/media.types';

/** One authored child-item row (a variant/package OR an add-on). The two are the same
 *  owned child item (`items`, `type='variant'|'addon'`) — this editor is their shared
 *  authoring surface (Liam 2026-11-25: "add-ons are exactly the same as variants, just a
 *  different type"). */
export interface ChildRow {
  id?: string;        // persisted child id (null until first save)
  name: string;
  description: string;
  cost: string;
  unit: string;
  serves: string;
  capacity: string;   // max capacity (guests) when unit = capacity
  timeUnit: string;   // the time granularity (hour/day/week) when unit = time
  size: string;       // the size label when unit = size
  images: GalleryImage[];
  color: string;      // chip button colour (--vc); '' = theme accent
}

/** pV2-STORE-VARIANT-CHILDREN-01 / pV2-ADDONS-01 — the shared chips + per-row form editor,
 *  mounted for variants (Pricing tab, full) and add-ons (Add Ons tab, simpler subset). Dumb:
 *  rows + selection in, events out; the host owns the state, persistence and image uploads
 *  (the per-row gallery is PROJECTED into the form via `[childImages]`, so upload logic stays
 *  in the host). Chips carry name + price + colour + drag-to-reorder. */
@Component({
  selector: 'app-item-children-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule, EditFieldComponent, MdHelpComponent],
  template: `
    <!-- Chips (one per row) + Add — the SAME chip the buyer sees. Click to edit below;
         drag to reorder (writes sort_order on save). -->
    <div class="mt-3 flex flex-wrap items-stretch gap-2">
      @for (r of rows(); track $index) {
        <button type="button" class="bp-variant-chip bp-variant-chip--draggable"
                [class.bp-variant-chip--on]="selectedIndex() === $index"
                [class.bp-variant-chip--dragging]="dragIndex() === $index"
                [class.bp-variant-chip--dragover]="dragOverIndex() === $index && dragIndex() !== $index"
                [style.--vc]="r.color || 'var(--theme-accent)'"
                draggable="true"
                (dragstart)="onDragStart($index, $event)"
                (dragover)="onDragOver($index, $event)"
                (dragleave)="onDragLeave($index)"
                (drop)="onDrop($index, $event)"
                (dragend)="onDragEnd()"
                (click)="selectRow.emit($index)">
          @if (selectedIndex() === $index) { <lucide-icon class="bp-variant-chip__tick" name="check" [size]="15" /> }
          <span class="bp-variant-chip__name">{{ r.name.trim() || 'Untitled' }}</span>
          @if (chipPrice(r.cost); as cp) { <span class="bp-variant-chip__price">{{ cp }}</span> }
        </button>
      }
      <button type="button" class="bp-variant-chip bp-variant-chip--add" (click)="add.emit()" [attr.aria-label]="'Add ' + label()">
        <lucide-icon name="plus" [size]="18" />
      </button>
    </div>

    <!-- Form for the selected row. -->
    @if (selectedRow(); as r) {
      <div class="mt-4 flex flex-col gap-4">
        <div class="flex items-end gap-3">
          <app-edit-field class="flex-1" label="Product name" density="page" [editing]="true" [value]="r.name" (valueChange)="patch('name', $event)" />
          @if (showColor()) {
            <div class="shrink-0">
              <label class="bp-field-label block">Colour</label>
              <span class="relative mt-2 inline-block">
                <span class="bp-swatch" [class.bp-swatch--empty]="!r.color" [style.--sw]="r.color || 'transparent'">
                  <input type="color" class="bp-swatch__input" [value]="r.color || '#cccccc'" (input)="patch('color', $any($event.target).value)" aria-label="Button colour" />
                </span>
                @if (r.color) {
                  <button type="button" class="bp-swatch__clear" (click)="patch('color', '')" aria-label="Clear colour"><lucide-icon name="x" [size]="10" /></button>
                }
              </span>
            </div>
          }
        </div>

        <!-- The row's own gallery — PROJECTED by the host (upload stays there). -->
        <div>
          <label class="bp-field-label">Images</label>
          <div class="mt-2 max-w-md">
            <ng-content select="[childImages]" />
          </div>
        </div>

        <div>
          <label class="bp-field-label">Description <app-md-help class="ml-1.5 align-middle" /></label>
          <textarea class="bp-store-textarea mt-1" rows="4" [ngModel]="r.description" (ngModelChange)="patch('description', $event)" placeholder="What's included…"></textarea>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
          @if (showCost()) {
            <app-edit-field [label]="'Cost' + currencySuffix()" type="number" density="page" [editing]="true" [value]="r.cost" (valueChange)="patch('cost', $event)" />
          }
          <app-edit-field label="Unit" type="select" density="page" [options]="unitOptions()" [editing]="true" [value]="r.unit" (valueChange)="patch('unit', $event)" />
          <!-- The unit-driven "specify" field — same as the item itself (Liam 2026-11-25):
               time → granularity (week), platter → serves, size → size, capacity → guests. -->
          @switch (r.unit) {
            @case ('time') {
              <app-edit-field label="Time unit" type="select" density="page" [options]="timeUnitOptions()" [editing]="true" [value]="r.timeUnit" (valueChange)="patch('timeUnit', $event)" />
            }
            @case ('platter') {
              <app-edit-field label="Serves (guests per unit)" type="number" density="page" [editing]="true" [value]="r.serves" (valueChange)="patch('serves', $event)" />
            }
            @case ('size') {
              <app-edit-field label="Size" type="select" density="page" [options]="sizeOptions()" [editing]="true" [value]="r.size" (valueChange)="patch('size', $event)" />
            }
            @case ('capacity') {
              <app-edit-field label="Max capacity (guests)" type="number" density="page" [editing]="true" [value]="r.capacity" (valueChange)="patch('capacity', $event)" />
            }
          }
        </div>

        <button type="button" class="bp-btn-outline bp-body-small self-start" (click)="remove.emit(selectedIndex())">
          <lucide-icon name="trash-2" [size]="14" /> Remove this {{ label() }}
        </button>
      </div>
    }
  `,
})
export class ItemChildrenEditorComponent {
  /** The authored rows + the selected index (host-owned state). */
  readonly rows = input<ChildRow[]>([]);
  readonly selectedIndex = input<number>(0);
  /** Noun for the Add / Remove affordances ("package" / "add-on"). */
  readonly label = input<string>('package');
  /** Per-surface field toggles — variants show the colour swatch; cost hides in Volume
   *  mode. The unit-driven "specify" field shows for ALL children (Liam 2026-11-25). */
  readonly showColor = input<boolean>(true);
  readonly showCost = input<boolean>(true);
  readonly currencySuffix = input<string>('');
  readonly unitOptions = input<EditFieldOption[]>([]);
  readonly timeUnitOptions = input<EditFieldOption[]>([]);
  readonly sizeOptions = input<EditFieldOption[]>([]);

  readonly selectRow = output<number>();
  readonly add = output<void>();
  readonly remove = output<number>();
  /** Edit a field of the SELECTED row — the host applies it at `selectedIndex`. */
  readonly patchRow = output<{ key: keyof ChildRow; value: string }>();
  /** Drag-to-reorder: move row `from` to index `to` (host does the array move + save). */
  readonly reorder = output<{ from: number; to: number }>();

  protected readonly selectedRow = computed<ChildRow | null>(() => this.rows()[this.selectedIndex()] ?? null);

  protected patch(key: keyof ChildRow, value: string): void {
    this.patchRow.emit({ key, value });
  }

  /** The chip's price label — house money format (thousands commas; whole £ when round,
   *  2 dp with pence). '' when the row has no cost. */
  protected chipPrice(cost: string): string {
    if (cost === '' || cost == null) return '';
    const n = Number(cost);
    if (!Number.isFinite(n)) return '';
    const digits = Number.isInteger(n) ? 0 : 2;
    return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: 2 });
  }

  // Drag-to-reorder (presentational; emits reorder on drop) ───────────────────────────
  protected readonly dragIndex = signal<number | null>(null);
  protected readonly dragOverIndex = signal<number | null>(null);
  protected onDragStart(i: number, e: DragEvent): void {
    this.dragIndex.set(i);
    if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); }
  }
  protected onDragOver(i: number, e: DragEvent): void {
    if (this.dragIndex() === null) return; // only react to a chip drag (not a file drag)
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    this.dragOverIndex.set(i);
  }
  protected onDragLeave(i: number): void {
    if (this.dragOverIndex() === i) this.dragOverIndex.set(null);
  }
  protected onDrop(i: number, e: DragEvent): void {
    const from = this.dragIndex();
    this.dragIndex.set(null);
    this.dragOverIndex.set(null);
    if (from === null) return;
    e.preventDefault();
    if (from === i) return;
    this.reorder.emit({ from, to: i });
  }
  protected onDragEnd(): void { this.dragIndex.set(null); this.dragOverIndex.set(null); }
}
