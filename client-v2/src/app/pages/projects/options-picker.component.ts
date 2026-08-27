import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { ProjectService, ComponentRow } from '../../core/projects/project.service';

interface OptRow { name: string; cost: number | null; unit: string | null; categoryId: string | null; checked: boolean; qty: number; }

/** pV2-BUILDUP-03 — the Final Quote "Options" picker: a simple checklist of the
 *  item's options (its child items). Each selected option is added to the quote
 *  as its own line (addCustomItem) — so it counts + shows on the PDF. */
@Component({
  selector: 'app-options-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, FormsModule, LucideAngularModule],
  host: { class: 'contents' },
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" (click)="cancel.emit()">
      <div class="bp-card w-full max-w-lg p-6" (click)="$event.stopPropagation()">
        <div class="mb-3 flex items-start justify-between">
          <h3 class="bp-card-title text-lg">Options <span class="text-secondary">— {{ itemName() }}</span></h3>
          <button type="button" class="text-muted hover:text-text" aria-label="Close" (click)="cancel.emit()"><lucide-icon name="x" [size]="18" /></button>
        </div>
        @if (rows().length) {
          <div class="overflow-hidden rounded-[var(--radius-card)] border border-hairline">
            <div class="grid grid-cols-[24px_1fr_92px_64px] items-center gap-2 border-b border-hairline bg-fill px-3 py-2 bp-field-label">
              <span></span><span>Option</span><span class="text-right">Cost</span><span class="text-center">Qty</span>
            </div>
            @for (r of rows(); track r.name) {
              <label class="grid cursor-pointer grid-cols-[24px_1fr_92px_64px] items-center gap-2 border-b border-hairline px-3 py-2 last:border-b-0 hover:bg-fill">
                <input type="checkbox" [ngModel]="r.checked" (ngModelChange)="r.checked = $event" />
                <span class="min-w-0 truncate text-md font-medium text-text">{{ r.name }}</span>
                <span class="bp-meta text-right tabular-nums">{{ r.cost === null ? '—' : ('£' + (r.cost | number: '1.0-0')) }}{{ r.unit ? ' / ' + r.unit : '' }}</span>
                <input type="number" min="1" class="bp-input-field text-center tabular-nums" [ngModel]="r.qty" (ngModelChange)="r.qty = $event" (click)="$event.stopPropagation()" />
              </label>
            }
          </div>
        } @else {
          <p class="bp-caption px-3 py-8 text-center">No options for this item.</p>
        }
        <div class="mt-4 flex items-center gap-2">
          <button type="button" class="bp-btn-outline flex-1" (click)="cancel.emit()">Cancel</button>
          <button type="button" class="bp-btn-grad flex-1" [disabled]="saving() || !anyChecked()" (click)="apply()">{{ saving() ? 'Adding…' : 'Add selected' }}</button>
        </div>
      </div>
    </div>
  `,
})
export class OptionsPickerComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly projects = inject(ProjectService);

  readonly projectId = input.required<string>();
  readonly itemId = input.required<string>();
  /** The parent quote line these options belong to — picked options link to it
   *  (option_of_line_id) so the Final Quote nests them under it. */
  readonly lineId = input.required<string>();
  readonly itemName = input<string>('');
  readonly categoryId = input<string | null>(null);
  readonly supplierId = input<string | null>(null);
  readonly added = output<void>();
  readonly cancel = output<void>();

  protected readonly rows = signal<OptRow[]>([]);
  protected readonly saving = signal(false);
  protected anyChecked(): boolean { return this.rows().some((r) => r.checked); }

  ngOnInit(): void {
    this.api.get<ComponentRow[]>(`/api/marketplace/items/${this.itemId()}/options`).subscribe({
      next: (comps) => this.rows.set(comps.map((c) => ({
        name: c.name, cost: c.base_price == null ? null : Number(c.base_price), unit: c.unit,
        categoryId: c.category_id, checked: false, qty: 1,
      }))),
      error: () => this.rows.set([]),
    });
  }

  protected async apply(): Promise<void> {
    if (this.saving()) return;
    const picks = this.rows().filter((r) => r.checked);
    if (!picks.length) { this.cancel.emit(); return; }
    this.saving.set(true);
    try {
      for (const p of picks) {
        await firstValueFrom(this.projects.addCustomItem(this.projectId(), {
          // Nest under the PARENT line's category so the option groups with the
          // item it belongs to, not the option item's own catalogue category.
          categoryId: this.categoryId() ?? p.categoryId,
          name: p.name, cost: p.cost, unit: p.unit,
          quantity: Math.max(1, Number(p.qty) || 1),
          supplierOrgId: this.supplierId(),
          optionOfLineId: this.lineId(),
        }));
      }
      this.added.emit();
    } finally {
      this.saving.set(false);
    }
  }
}
