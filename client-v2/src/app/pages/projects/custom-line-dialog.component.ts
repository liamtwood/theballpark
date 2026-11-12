import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ModalComponent } from '../../shared/modal/modal.component';
import { CatalogueService } from '../../core/marketplace/catalogue.service';
import { CatalogueItem, sizedImage } from '../../shared/catalogue/catalogue.types';
import { ShuttleComponent, ShuttleItem, ShuttlePick } from '../../shared/shuttle/shuttle.component';
import { CoachmarkComponent } from '../../shared/coachmark/coachmark.component';

/** A supplier available to tag a line to. */
export interface LineSupplier { id: string; name: string | null; }

/** A line the dialog emits. pV2-BUILDUP-01 (UI1): either a new agent-owned
 *  custom line (itemId null) or a referenced catalogue item (itemId set). */
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
  supplierOrgId: string | null;
  itemId: string | null;
  /** The project_items row id when this line already exists in the quote
   *  (explore reconcile); null for a freshly-added pick. */
  lineId: string | null;
}

/** An existing quote line for this supplier+category — pre-loaded into the
 *  explore dialog's picks so you see (and can edit) what's already there. */
export interface ExistingPick {
  lineId: string;
  itemId: string | null;
  name: string;
  cost: number | null;
  quantity: number;
  categoryName: string | null;
  subcategoryName: string | null;
}

interface GridRow {
  id: number;
  description: string;
  cost: number | null;
  qty: number;
  unit: string | null;
  itemId: string | null;
  /** project_items row id when this pick is already in the quote (else null). */
  lineId: string | null;
  /** Item's category + subcategory — the picks group category → subcategory
   *  (readies the supplier's components: Staffing→Crew, Materials→Sheet …). */
  categoryName: string | null;
  subcategoryName: string | null;
}
let ROW_UID = 0;
const blankRow = (): GridRow => ({ id: ROW_UID++, description: '', cost: null, qty: 1, unit: null, itemId: null, lineId: null, categoryName: null, subcategoryName: null });

/** pV2-BUILDUP-01 (UI1) — the add-lines modal, two variants:
 *  • 'new'     — create agent-owned custom lines (Form/Grid, type them in).
 *  • 'explore' — "More From <supplier>": browse that supplier's catalogue
 *                (LEFT, scoped to the category) and shuttle picks into the
 *                grouped "added items" list (RIGHT). The same shape will power
 *                the supplier's "Estimate Item" (components → cost buildup). */
@Component({
  selector: 'app-custom-line-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, FormsModule, ModalComponent, LucideAngularModule, ShuttleComponent, CoachmarkComponent],
  host: { class: 'contents' },
  template: `
    <app-modal [title]="headerTitle()" [width]="dialogWidth()" (close)="cancel.emit()">
      @if (costedBySupplier()) {
        <!-- pV2-ADD-LINE-SUPPLIER-01: added in a supplier's context → the line is
             routed to that supplier, who costs it (no agent Cost field). -->
        <div class="flex items-center gap-1.5 bp-body-small text-secondary">
          <lucide-icon name="store" [size]="14" class="shrink-0" style="color: var(--theme-accent)" />
          <span class="truncate">For {{ forSupplier()!.name || 'this supplier' }} to cost</span>
        </div>
        <div class="mt-3 flex justify-center">
          <app-coachmark page="add-line-item" name="supplier-intro" tail="up"
                         [vars]="{ supplier: forSupplier()!.name || 'this supplier' }"
                         defaultText="Add an item you want {supplier} to provide that you can't find in their store. They'll price it for you. Description is shared with the supplier: add size, colour or spec." />
        </div>
      }

      @if (variant() === 'new') {
        <!-- ── NEW: type agent-owned lines (Form / Grid) ─────────────────── -->
        <div class="inline-flex overflow-hidden rounded-[var(--radius-field)] border border-hairline" [class.mt-4]="costedBySupplier()">
          <button type="button" class="px-3 py-1.5 text-md" [class.bg-text]="mode() === 'single'" [class.text-surface]="mode() === 'single'" (click)="mode.set('single')">Single</button>
          <button type="button" class="px-3 py-1.5 text-md" [class.bg-text]="mode() === 'grid'" [class.text-surface]="mode() === 'grid'" (click)="mode.set('grid')">Grid</button>
        </div>

        @if (mode() === 'single') {
          <div class="mt-4 flex flex-col gap-4">
            <label class="block">
              <span class="ed-label mb-1.5 block">Item</span>
              <input class="ed-input" placeholder="New item name" [(ngModel)]="form.description" autocomplete="off" />
            </label>
            <div class="grid gap-4" [class.grid-cols-2]="!costedBySupplier()">
              @if (!costedBySupplier()) {
                <label class="block">
                  <span class="ed-label mb-1.5 block">Cost £</span>
                  <input type="number" class="ed-input" placeholder="TBC" [(ngModel)]="form.cost" />
                </label>
              }
              <label class="block">
                <span class="ed-label mb-1.5 block">Qty</span>
                <input type="number" class="ed-input" placeholder="1" [(ngModel)]="form.quantity" />
              </label>
            </div>
            <label class="block">
              <span class="ed-label mb-1.5 block">Description</span>
              <input class="ed-input" placeholder="Size, colour, spec…" [(ngModel)]="form.notes" />
            </label>
          </div>
        } @else {
          <div class="mt-3 overflow-hidden rounded-[var(--radius-card)] border border-hairline">
            <div class="grid items-center gap-2 border-b border-hairline bg-fill px-3 py-2 bp-field-label"
                 [class]="costedBySupplier() ? 'grid-cols-[1fr_70px_32px]' : 'grid-cols-[1fr_100px_70px_32px]'">
              <span>Item</span>
              @if (!costedBySupplier()) { <span class="text-center">Cost £</span> }
              <span class="text-right">Qty</span><span></span>
            </div>
            @for (row of rows(); track row.id) {
              <div class="relative grid items-center gap-2 border-b border-hairline px-3 py-1.5 last:border-b-0"
                   [class]="costedBySupplier() ? 'grid-cols-[1fr_70px_32px]' : 'grid-cols-[1fr_100px_70px_32px]'">
                <input class="bp-input-field w-full" placeholder="New item" [ngModel]="row.description" (ngModelChange)="onRowName(row, $event)" autocomplete="off" />
                @if (!costedBySupplier()) {
                  <input type="number" class="bp-input-field text-right" placeholder="—" [ngModel]="row.cost" (ngModelChange)="row.cost = $event" />
                }
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
            <span class="bp-meta">{{ filledCount() }} item{{ filledCount() === 1 ? '' : 's' }}@if (!costedBySupplier()) { · £{{ gridTotal() | number: '1.0-0' }}}</span>
          </div>
        }
      } @else {
        <!-- ── EXPLORE: the shared shuttle (browse left → picks right) ── -->
        <app-shuttle class="block" [class.mt-4]="costedBySupplier()"
          [available]="railShuttle()"
          [picks]="pickShuttle()"
          [pickedIds]="pickedIds()"
          [showThumbs]="true"
          leftPlaceholder="Filter items…"
          rightTitle="Added items"
          [emptyLeft]="railItems().length ? 'No items match.' : 'No catalogue items in this category.'"
          emptyRight="Click items on the left to add them here."
          (add)="onShuttleAdd($event)"
          (remove)="removePick(+$event)"
          (qtyChange)="onShuttleQty($event)" />
      }

      <button modalFooter type="button" class="bp-btn--secondary" (click)="cancel.emit()">Cancel</button>
      @if (variant() === 'explore') {
        <button modalFooter type="button" class="bp-btn--primary" (click)="submitGrid()">Save</button>
      } @else if (mode() === 'single') {
        <button modalFooter type="button" class="bp-btn--primary" [disabled]="!form.description.trim()" (click)="submitSingle()">Add</button>
      } @else {
        <button modalFooter type="button" class="bp-btn--primary" [disabled]="!filledCount()" (click)="submitGrid()">Add {{ filledCount() }}</button>
      }
    </app-modal>
  `,
})
export class CustomLineDialogComponent implements OnInit {
  private readonly catalogue = inject(CatalogueService);

  readonly categoryId = input<string | null>(null);
  readonly categoryName = input<string>('');
  readonly categoryIcon = input<string | null>(null);
  readonly suppliers = input<LineSupplier[]>([]);
  readonly variant = input<'new' | 'explore'>('new');
  /** Existing quote lines for this supplier+category (explore) — pre-loaded. */
  readonly existingLines = input<ExistingPick[]>([]);
  /** pV2-ADD-LINE-SUPPLIER-01 — opened from a supplier's banner "+": the new
   *  lines are routed to this supplier to cost (Cost hidden). null = the agent's
   *  own lines (top "Add line" / Your own costs), unchanged. */
  readonly forSupplier = input<LineSupplier | null>(null);
  protected readonly costedBySupplier = computed(() => this.variant() === 'new' && !!this.forSupplier());
  readonly add = output<CustomLine[]>();
  readonly cancel = output<void>();

  /** Dialog title + width track the variant/mode (explore is the wide shuttle). */
  protected readonly headerTitle = computed(() =>
    this.variant() === 'explore'
      ? 'More From ' + (this.supplierName() || 'Supplier')
      : 'Add Line Item' + (this.mode() === 'grid' ? 's' : '')
  );
  protected readonly dialogWidth = computed(() =>
    this.variant() === 'explore' ? '880px' : this.mode() === 'grid' ? '680px' : '460px'
  );

  protected readonly mode = signal<'single' | 'grid'>('single');
  protected readonly supplierId = signal<string | null>(null);
  protected form = { description: '', cost: null as number | null, quantity: 1, notes: '' };
  protected readonly rows = signal<GridRow[]>([blankRow(), blankRow(), blankRow()]);

  // ── Browse rail (explore) ────────────────────────────────────────────────
  protected readonly railItems = signal<CatalogueItem[]>([]);
  /** Catalogue item ids already staged in the picks (drives the left ✓ state). */
  protected readonly picked = computed(() => new Set(this.rows().filter((r) => r.itemId).map((r) => r.itemId!)));

  // ── Shuttle adapters (catalogue ⇄ shuttle items, picks ⇄ rows) ──────────
  protected readonly railShuttle = computed<ShuttleItem[]>(() =>
    this.railItems().map((it) => ({
      id: it.id, name: it.name, price: it.basePrice,
      groupName: it.subcategoryName || 'Other', coverUrl: this.thumb(it.coverUrl),
    }))
  );
  /** Picks → shuttle picks, grouped by category on the right. */
  protected readonly pickShuttle = computed<ShuttlePick[]>(() =>
    this.rows().filter((r) => r.description.trim()).map((r) => ({
      id: String(r.id), name: r.description, cost: r.cost, qty: r.qty,
      groupName: r.categoryName || 'Other',
    }))
  );
  protected readonly pickedIds = computed<string[]>(() => [...this.picked()]);
  protected onShuttleAdd(si: ShuttleItem): void {
    const it = this.railItems().find((x) => x.id === si.id);
    if (it) this.addFromRail(it);
  }
  protected onShuttleQty(e: { id: string; qty: number }): void {
    const r = this.rows().find((x) => String(x.id) === e.id);
    if (r) { r.qty = e.qty; this.rows.set([...this.rows()]); }
  }

  protected thumb(url: string | null): string | null { return sizedImage(url, 96); }

  constructor() {
    // Load the supplier's items (explore only), scoped to the category.
    effect(() => {
      const supplier = this.supplierId();
      if (this.variant() !== 'explore' || !supplier) { this.railItems.set([]); return; }
      const cat = this.categoryId() ?? undefined;
      void this.catalogue.items({ supplier, cat }).then((res) => {
        if (this.supplierId() !== supplier) return;
        const sorted = res.items.slice().sort((a, b) => {
          const sa = (a.subcategoryName || '~').toLowerCase();
          const sb = (b.subcategoryName || '~').toLowerCase();
          if (sa !== sb) return sa < sb ? -1 : 1;
          return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        });
        this.railItems.set(sorted);
      }).catch(() => { /* rail stays empty — non-critical browse aid */ });
    });
  }

  ngOnInit(): void {
    if (this.variant() === 'explore') {
      this.mode.set('grid');
      // Pre-load the picks with what's already in the quote for this
      // supplier+category, so you see (and can edit) the current state.
      this.rows.set(this.existingLines().map((e) => ({
        id: ROW_UID++, description: e.name, cost: e.cost, qty: e.quantity,
        unit: null, itemId: e.itemId, lineId: e.lineId,
        categoryName: e.categoryName, subcategoryName: e.subcategoryName,
      })));
      if (this.suppliers().length) this.supplierId.set(this.suppliers()[0].id);
    }
  }

  protected supplierName(): string | null {
    const id = this.supplierId();
    return this.suppliers().find((s) => s.id === id)?.name ?? null;
  }

  // ── New: single form ─────────────────────────────────────────────────────
  protected submitSingle(): void {
    const f = this.form;
    if (!f.description.trim()) return;
    this.add.emit([{
      id: `c-${f.description.slice(0, 6)}-${f.quantity}`,
      categoryId: this.categoryId(),
      category: this.categoryName().trim(),
      description: f.description.trim(),
      cost: this.costedBySupplier() ? 0 : Number(f.cost) || 0,
      quantity: Math.max(1, Number(f.quantity) || 1),
      unit: null, install: false, notes: f.notes.trim(),
      supplierOrgId: this.forSupplier()?.id ?? null, itemId: null, lineId: null,
    }]);
  }

  // ── New: grid ────────────────────────────────────────────────────────────
  protected onRowName(row: GridRow, value: string): void {
    row.description = value;
    const list = this.rows();
    if (row === list[list.length - 1] && value.trim()) this.rows.set([...list, blankRow()]);
  }
  protected addRow(): void { this.rows.set([...this.rows(), blankRow()]); }
  protected removeRow(id: number): void {
    const next = this.rows().filter((r) => r.id !== id);
    this.rows.set(next.length ? next : [blankRow()]);
  }
  protected filledCount(): number { return this.rows().filter((r) => r.description.trim()).length; }
  protected gridTotal(): number {
    return this.rows().reduce((s, r) => s + (r.description.trim() ? (Number(r.cost) || 0) * Math.max(1, Number(r.qty) || 1) : 0), 0);
  }
  protected submitGrid(): void {
    const cat = this.categoryName().trim();
    const supplierOrgId = this.forSupplier()?.id ?? this.supplierId();
    const lines: CustomLine[] = this.rows()
      .filter((r) => r.description.trim())
      .map((r) => ({
        id: `c-${r.description.slice(0, 6)}-${r.id}`,
        categoryId: this.categoryId(),
        category: cat,
        description: r.description.trim(),
        cost: this.costedBySupplier() ? 0 : Number(r.cost) || 0,
        quantity: Math.max(1, Number(r.qty) || 1),
        unit: r.unit, install: false, notes: '',
        supplierOrgId, itemId: r.itemId, lineId: r.lineId,
      }));
    // Explore emits the full desired state (incl. existing) so the host can
    // reconcile add/remove/qty; new emits only the lines to add.
    if (this.variant() === 'explore' || lines.length) this.add.emit(lines);
  }

  // ── Explore: shuttle ─────────────────────────────────────────────────────
  protected addFromRail(item: CatalogueItem): void {
    if (this.picked().has(item.id)) return; // already staged (add-once)
    const row: GridRow = {
      id: ROW_UID++, description: item.name, cost: item.basePrice, qty: 1,
      unit: item.unit, itemId: item.id, lineId: null,
      categoryName: item.categoryName ?? null, subcategoryName: item.subcategoryName ?? null,
    };
    this.rows.set([...this.rows().filter((r) => r.description.trim()), row]);
  }
  protected removePick(id: number): void {
    this.rows.set(this.rows().filter((r) => r.id !== id));
  }
}
