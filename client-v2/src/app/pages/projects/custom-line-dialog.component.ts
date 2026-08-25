import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { CatalogueService } from '../../core/marketplace/catalogue.service';
import { CatalogueItem } from '../../shared/catalogue/catalogue.types';

/** A supplier available to tag a line to (the category's suppliers). */
export interface LineSupplier { id: string; name: string | null; }

/** A custom (ad-hoc) line the agent adds on the Final view. pV2-BUILDUP-01 (UI1):
 *  now added in the context of a supplier (tags the line) with a type-ahead
 *  lookup that pre-fills from that supplier's catalogue. */
export interface CustomLine {
  id: string;
  categoryId: string | null;
  category: string;
  description: string;
  cost: number;
  quantity: number;
  unit: string | null;
  install: boolean;
  notes: string;
  /** The supplier this line is added for (null = "to source"). */
  supplierOrgId: string | null;
  /** Set when a lookup suggestion was picked — reference the real catalogue
   *  item (add as a normal quote line) instead of a new custom line. */
  itemId: string | null;
}

interface GridRow {
  id: number;
  description: string;
  cost: number | null;
  qty: number;
  unit: string | null;
  /** Catalogue item id when a suggestion was picked (else null → "New"). */
  itemId: string | null;
  /** Set once a lookup suggestion is picked (else the row reads as "New"). */
  matched: boolean;
}
let ROW_UID = 0;
const blankRow = (): GridRow => ({ id: ROW_UID++, description: '', cost: null, qty: 1, unit: null, itemId: null, matched: false });

/** pV2-CART-01 / pV2-BUILDUP-01 (UI1) — the Add-Your-Own-Line-Item modal.
 *  Category is fixed (the band you came from). Supplier is chosen once (auto
 *  when there's only one). Two modes: a single form, or a Grid for fast
 *  multi-add. Each name field is a type-ahead against the chosen supplier's
 *  catalogue — pick to reference (pre-fills cost/unit), or type a "New" line.
 *  Emits CustomLine[], each tagged to the supplier. */
@Component({
  selector: 'app-custom-line-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, FormsModule, LucideAngularModule],
  host: { class: 'contents' },
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" (click)="cancel.emit()">
      <div class="bp-card w-full p-6" [class.max-w-md]="mode() === 'single'" [class.max-w-2xl]="mode() === 'grid'" (click)="$event.stopPropagation()">
        <div class="flex items-start justify-between">
          <h3 class="bp-card-title text-lg">Add Line Item{{ mode() === 'grid' ? 's' : '' }}</h3>
          <button type="button" class="text-muted hover:text-text" aria-label="Close" (click)="cancel.emit()">
            <lucide-icon name="x" [size]="18" />
          </button>
        </div>

        <!-- Context: category (locked) + supplier (auto / pick). -->
        <div class="mt-4 grid grid-cols-2 gap-3">
          <div class="block">
            <span class="bp-field-label">Category</span>
            <div class="bp-input-field flex items-center bg-fill text-secondary">{{ categoryName() || '—' }}</div>
          </div>
          <label class="block">
            <span class="bp-field-label">Supplier</span>
            @if (suppliers().length <= 1) {
              <div class="bp-input-field flex items-center" [class.text-muted]="!supplierId()">
                {{ supplierName() || 'To source' }}
              </div>
            } @else {
              <select class="bp-input-field" [ngModel]="supplierId()" (ngModelChange)="supplierId.set($event || null)">
                <option [ngValue]="null">To source…</option>
                @for (s of suppliers(); track s.id) {
                  <option [ngValue]="s.id">{{ s.name || 'Supplier' }}</option>
                }
              </select>
            }
          </label>
        </div>

        <!-- Mode toggle. -->
        <div class="mt-4 inline-flex overflow-hidden rounded-[var(--radius-field)] border border-hairline">
          <button type="button" class="px-3 py-1.5 text-md" [class.bg-text]="mode() === 'single'" [class.text-surface]="mode() === 'single'" (click)="mode.set('single')">Single</button>
          <button type="button" class="px-3 py-1.5 text-md" [class.bg-text]="mode() === 'grid'" [class.text-surface]="mode() === 'grid'" (click)="mode.set('grid')">Grid</button>
        </div>

        @if (mode() === 'single') {
          <div class="mt-4 flex flex-col gap-3">
            <label class="relative block">
              <span class="bp-field-label">Item
                @if (singleIsNew()) { <span class="bp-tag-chip ml-1 bg-warn-soft text-warn">New</span> }
              </span>
              <input class="bp-input-field" placeholder="Search {{ supplierName() || 'catalogue' }} or type a new item"
                     [ngModel]="form.description" (ngModelChange)="onSingleName($event)" (focus)="activeRow.set('single')" autocomplete="off" />
              @if (activeRow() === 'single' && suggestions().length) {
                <ul class="bp-lookup">
                  @for (s of suggestions(); track s.id) {
                    <li class="bp-lookup__row" (click)="pickSingle(s)">
                      <span class="truncate">{{ s.name }}</span>
                      <span class="bp-meta shrink-0">{{ s.basePrice === null ? 'POA' : ('£' + (s.basePrice | number: '1.0-0')) }}{{ s.unit ? ' / ' + s.unit : '' }}</span>
                    </li>
                  }
                </ul>
              }
            </label>
            <div class="grid grid-cols-2 gap-3">
              <label class="block">
                <span class="bp-field-label">Cost £ <span class="text-muted">(optional)</span></span>
                <input type="number" class="bp-input-field" placeholder="TBC" [(ngModel)]="form.cost" />
              </label>
              <label class="block">
                <span class="bp-field-label">Qty</span>
                <input type="number" class="bp-input-field" placeholder="1" [(ngModel)]="form.quantity" />
              </label>
            </div>
            <label class="block">
              <span class="bp-field-label">Notes (optional)</span>
              <input class="bp-input-field" placeholder="Any additional details" [(ngModel)]="form.notes" />
            </label>
          </div>
          <button type="button" class="bp-btn-grad mt-5 w-full" [disabled]="!form.description.trim()" (click)="submitSingle()">
            Add Line Item
          </button>
        } @else {
          <div class="mt-3 overflow-visible rounded-[var(--radius-card)] border border-hairline">
            <div class="grid grid-cols-[1fr_110px_80px_36px] items-center gap-2 border-b border-hairline bg-fill px-3 py-2 bp-field-label">
              <span>Item</span><span class="text-right">Cost £</span><span class="text-right">Qty</span><span></span>
            </div>
            @for (row of rows(); track row.id) {
              <div class="relative grid grid-cols-[1fr_110px_80px_36px] items-center gap-2 border-b border-hairline px-3 py-1.5 last:border-b-0">
                <div class="relative min-w-0">
                  <input class="bp-input-field w-full" placeholder="Search or new item"
                         [ngModel]="row.description" (ngModelChange)="onRowName(row, $event)" (focus)="activeRow.set(row.id)" autocomplete="off" />
                  @if (row.description.trim() && !row.matched) { <span class="bp-tag-chip absolute right-1.5 top-1/2 -translate-y-1/2 bg-warn-soft text-warn">New</span> }
                  @if (activeRow() === row.id && suggestions().length) {
                    <ul class="bp-lookup">
                      @for (s of suggestions(); track s.id) {
                        <li class="bp-lookup__row" (click)="pickRow(row, s)">
                          <span class="truncate">{{ s.name }}</span>
                          <span class="bp-meta shrink-0">{{ s.basePrice === null ? 'POA' : ('£' + (s.basePrice | number: '1.0-0')) }}{{ s.unit ? ' / ' + s.unit : '' }}</span>
                        </li>
                      }
                    </ul>
                  }
                </div>
                <input type="number" class="bp-input-field text-right" placeholder="—" [ngModel]="row.cost" (ngModelChange)="row.cost = $event" />
                <input type="number" class="bp-input-field text-right" [ngModel]="row.qty" (ngModelChange)="row.qty = $event" />
                <button type="button" class="rounded-md p-1 text-muted hover:text-danger" aria-label="Remove row" (click)="removeRow(row.id)">
                  <lucide-icon name="trash-2" [size]="15" />
                </button>
              </div>
            }
          </div>
          <div class="mt-2 flex items-center justify-between">
            <button type="button" class="bp-body-small inline-flex items-center gap-1 text-secondary hover:text-text" (click)="addRow()">
              <lucide-icon name="plus" [size]="14" /> Add row
            </button>
            <span class="bp-meta">{{ filledCount() }} item{{ filledCount() === 1 ? '' : 's' }} · £{{ gridTotal() | number: '1.0-0' }}</span>
          </div>
          <button type="button" class="bp-btn-grad mt-4 w-full" [disabled]="!filledCount()" (click)="submitGrid()">
            Add {{ filledCount() }} Line Item{{ filledCount() === 1 ? '' : 's' }}
          </button>
        }
      </div>
    </div>
  `,
  styles: `
    .bp-lookup {
      position: absolute; left: 0; right: 0; top: calc(100% + 2px); z-index: 60;
      max-height: 220px; overflow-y: auto;
      background: var(--color-surface); border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-input, 8px); box-shadow: 0 8px 24px rgba(0,0,0,0.12);
    }
    .bp-lookup__row {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      padding: 7px 10px; cursor: pointer; font-size: 0.9rem;
    }
    .bp-lookup__row:hover { background: var(--color-fill); }
  `,
})
export class CustomLineDialogComponent implements OnInit {
  private readonly catalogue = inject(CatalogueService);

  readonly categoryId = input<string | null>(null);
  readonly categoryName = input<string>('');
  /** The category's suppliers — preselect when there's exactly one. */
  readonly suppliers = input<LineSupplier[]>([]);
  readonly add = output<CustomLine[]>();
  readonly cancel = output<void>();

  protected readonly mode = signal<'single' | 'grid'>('single');
  protected readonly supplierId = signal<string | null>(null);
  protected form = { description: '', cost: null as number | null, quantity: 1, notes: '' };
  protected singleMatched = signal(false);
  protected readonly rows = signal<GridRow[]>([blankRow(), blankRow(), blankRow()]);

  // ── Lookup (type-ahead against the chosen supplier's catalogue) ──────────
  protected readonly activeRow = signal<number | 'single' | null>(null);
  protected readonly suggestions = signal<CatalogueItem[]>([]);
  private lookupTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    if (this.suppliers().length === 1) this.supplierId.set(this.suppliers()[0].id);
  }

  protected supplierName(): string | null {
    const id = this.supplierId();
    return this.suppliers().find((s) => s.id === id)?.name ?? null;
  }

  protected singleIsNew(): boolean {
    return this.form.description.trim().length > 0 && !this.singleMatched();
  }

  private search(query: string): void {
    const supplier = this.supplierId();
    if (this.lookupTimer) clearTimeout(this.lookupTimer);
    const q = query.trim();
    if (!supplier || q.length < 1) { this.suggestions.set([]); return; }
    this.lookupTimer = setTimeout(() => {
      void this.catalogue.items({ supplier, q }).then((res) => {
        // The server matches name OR description (right for browse, too loose
        // for a name picker) — keep only NAME matches so the list reads clean.
        const ql = q.toLowerCase();
        this.suggestions.set(res.items.filter((i) => i.name.toLowerCase().includes(ql)).slice(0, 8));
      }).catch(() => this.suggestions.set([]));
    }, 180);
  }

  // ── Single form ────────────────────────────────────────────────────────
  protected onSingleName(value: string): void {
    this.form.description = value;
    this.singleMatched.set(false);
    this.pickedItemId = null; // editing the name breaks the reference
    this.activeRow.set('single');
    this.search(value);
  }
  protected pickSingle(item: CatalogueItem): void {
    this.form.description = item.name;
    this.form.cost = item.basePrice;
    this.singleMatched.set(true);
    this.pickedUnit = item.unit;
    this.pickedItemId = item.id;
    this.suggestions.set([]);
    this.activeRow.set(null);
  }
  private pickedUnit: string | null = null;
  private pickedItemId: string | null = null;

  protected submitSingle(): void {
    const f = this.form;
    if (!f.description.trim()) return;
    this.add.emit([{
      id: `c-${f.description.slice(0, 6)}-${f.quantity}`,
      categoryId: this.categoryId(),
      category: this.categoryName().trim(),
      description: f.description.trim(),
      cost: Number(f.cost) || 0,
      quantity: Math.max(1, Number(f.quantity) || 1),
      unit: this.pickedUnit,
      install: false,
      notes: f.notes.trim(),
      supplierOrgId: this.supplierId(),
      itemId: this.pickedItemId,
    }]);
  }

  // ── Grid (multi-add) ───────────────────────────────────────────────────
  protected onRowName(row: GridRow, value: string): void {
    row.description = value;
    row.matched = false;
    row.itemId = null; // editing the name breaks the reference
    this.activeRow.set(row.id);
    this.search(value);
    // Typing into the last row spawns a fresh blank row (sheet feel).
    const list = this.rows();
    if (row === list[list.length - 1] && value.trim()) {
      this.rows.set([...list, blankRow()]);
    }
  }
  protected pickRow(row: GridRow, item: CatalogueItem): void {
    row.description = item.name;
    row.cost = item.basePrice;
    row.unit = item.unit;
    row.itemId = item.id;
    row.matched = true;
    this.suggestions.set([]);
    this.activeRow.set(null);
  }
  protected addRow(): void {
    this.rows.set([...this.rows(), blankRow()]);
  }
  protected removeRow(id: number): void {
    const next = this.rows().filter((r) => r.id !== id);
    this.rows.set(next.length ? next : [blankRow()]);
  }
  protected filledCount(): number {
    return this.rows().filter((r) => r.description.trim()).length;
  }
  protected gridTotal(): number {
    return this.rows().reduce((s, r) => s + (r.description.trim() ? (Number(r.cost) || 0) * Math.max(1, Number(r.qty) || 1) : 0), 0);
  }
  protected submitGrid(): void {
    const cat = this.categoryName().trim();
    const supplierOrgId = this.supplierId();
    const lines: CustomLine[] = this.rows()
      .filter((r) => r.description.trim())
      .map((r) => ({
        id: `c-${r.description.slice(0, 6)}-${r.id}`,
        categoryId: this.categoryId(),
        category: cat,
        description: r.description.trim(),
        cost: Number(r.cost) || 0,
        quantity: Math.max(1, Number(r.qty) || 1),
        unit: r.unit,
        install: false,
        notes: '',
        supplierOrgId,
        itemId: r.itemId,
      }));
    if (lines.length) this.add.emit(lines);
  }
}
