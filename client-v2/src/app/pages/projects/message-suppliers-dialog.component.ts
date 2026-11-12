import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { OutreachRosterEntry } from '../../core/inbox/inbox.service';
import { ModalComponent } from '../../shared/modal/modal.component';

/** One supplier's stake in a category (item count decides the default primary). */
export interface MsgSupplierOption {
  supplierId: string;
  supplierName: string;
  supplierCity: string | null;
  count: number;
}
/** A category + the suppliers whose items are in it (sorted by count desc). */
export interface MsgSupplierCategory {
  categoryId: string;
  categoryName: string;
  suppliers: MsgSupplierOption[];
}

/** pV2-CART-01 — the "who quotes what" step before sending. One supplier per
 *  category is the recommended default (majority owner); multi-supplier
 *  categories nudge a primary pick, with an opt-in to also get competing
 *  quotes. Emits the outreach roster; the parent does the send. */
@Component({
  selector: 'app-message-suppliers-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, ModalComponent],
  host: { class: 'block' },
  template: `
    <app-modal
      title="Who should we ask to quote?"
      subtitle="Check the suppliers you want to quote each category. One keeps quotes comparable; add more to compare."
      width="512px"
      (close)="cancel.emit()"
    >
      <div class="flex flex-col gap-2.5" style="max-height: 60vh; overflow-y: auto">
        @for (c of categories(); track c.categoryId) {
          <div class="bp-card p-3.5">
            <div class="flex items-center justify-between gap-2">
              <span class="bp-list-title truncate">{{ c.categoryName }}</span>
              @if (c.suppliers.length === 1) {
                <span class="bp-pill bp-pill--success"><lucide-icon name="check" [size]="12" /> 1 supplier</span>
              } @else {
                <span class="bp-pill bp-pill--warn">{{ c.suppliers.length }} suppliers</span>
              }
            </div>

            @if (c.suppliers.length === 1) {
              <div class="bp-meta mt-1">
                {{ c.suppliers[0].supplierName }}@if (c.suppliers[0].supplierCity) { · {{ c.suppliers[0].supplierCity }} }
                · {{ c.suppliers[0].count }} item{{ c.suppliers[0].count === 1 ? '' : 's' }}
              </div>
            } @else {
              <div class="mt-2 flex flex-col gap-1.5">
                @for (s of c.suppliers; track s.supplierId) {
                  <label class="flex cursor-pointer items-center gap-2.5">
                    <input type="checkbox" class="bp-check"
                           [checked]="isSelected(c.categoryId, s.supplierId)"
                           (change)="toggleSupplier(c.categoryId, s.supplierId)" />
                    <span class="bp-body-small text-text">{{ s.supplierName }}@if (s.supplierCity) { · {{ s.supplierCity }} }</span>
                    <span class="bp-meta">{{ s.count }} item{{ s.count === 1 ? '' : 's' }}</span>
                  </label>
                }
              </div>
            }
          </div>
        }
      </div>

      <span modalFooter class="bp-caption mr-auto">This will spend 1 Ball.</span>
      <button modalFooter type="button" class="bp-btn--secondary" (click)="cancel.emit()">Cancel</button>
      <button modalFooter type="button" class="bp-btn--primary" (click)="send.emit(buildRoster())">
        <lucide-icon name="send" [size]="16" />
        Send {{ threadCount() }} brief{{ threadCount() === 1 ? '' : 's' }}
      </button>
    </app-modal>
  `,
  styles: [
    `
      .bp-check {
        width: 1rem;
        height: 1rem;
        accent-color: var(--theme-accent);
        cursor: pointer;
      }
      .bp-pill {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        padding: 1px 9px;
        border-radius: var(--radius-pill);
        font-size: var(--text-2xs);
        font-weight: 500;
        line-height: 1.5;
        white-space: nowrap;
      }
      .bp-pill--warn { background: var(--color-warn-soft); color: var(--color-warn); }
      .bp-pill--success { background: var(--color-success-soft); color: var(--color-success); }
    `,
  ],
})
export class MessageSuppliersDialogComponent {
  readonly categories = input.required<MsgSupplierCategory[]>();
  readonly send = output<OutreachRosterEntry[]>();
  readonly cancel = output<void>();

  /** Selected suppliers per category (multi-select). Defaults to the majority
   *  owner (suppliers arrive sorted by count desc, so [0] is the biggest);
   *  single-supplier categories default to their one supplier. */
  protected readonly selected = linkedSignal<Record<string, string[]>>(() => {
    const m: Record<string, string[]> = {};
    for (const c of this.categories()) {
      const first = c.suppliers[0]?.supplierId;
      m[c.categoryId] = first ? [first] : [];
    }
    return m;
  });

  protected isSelected(categoryId: string, supplierId: string): boolean {
    return (this.selected()[categoryId] ?? []).includes(supplierId);
  }
  protected toggleSupplier(categoryId: string, supplierId: string): void {
    this.selected.update((m) => {
      const cur = m[categoryId] ?? [];
      const next = cur.includes(supplierId)
        ? cur.filter((id) => id !== supplierId)
        : [...cur, supplierId];
      return { ...m, [categoryId]: next };
    });
  }

  /** Total supplier threads across all categories (the CTA count). */
  protected readonly threadCount = computed(() =>
    this.buildRoster().reduce((n, e) => n + e.supplierIds.length, 0)
  );

  /** One roster entry per category → its checked suppliers. */
  protected buildRoster(): OutreachRosterEntry[] {
    return this.categories()
      .map((c) => ({ categoryId: c.categoryId, supplierIds: [...new Set(this.selected()[c.categoryId] ?? [])] }))
      .filter((e) => e.supplierIds.length);
  }
}
