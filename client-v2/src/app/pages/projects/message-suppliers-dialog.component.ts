import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { OutreachRosterEntry } from '../../core/inbox/inbox.service';

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
  imports: [LucideAngularModule],
  host: { class: 'block' },
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" (click)="cancel.emit()">
      <div class="bp-card flex max-h-[85vh] w-full max-w-lg flex-col p-6" (click)="$event.stopPropagation()">
        <div class="flex items-start justify-between">
          <h3 class="bp-card-title text-lg">Who should we ask to quote?</h3>
          <button type="button" class="text-muted hover:text-text" aria-label="Close" (click)="cancel.emit()">
            <lucide-icon name="x" [size]="18" />
          </button>
        </div>
        <p class="bp-body-small mt-1 text-secondary">
          One supplier per category keeps quotes comparable and gives you a single point of
          contact. Ask more than one only where it's worth it.
        </p>

        <div class="mt-4 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto">
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
                      <input type="radio" class="bp-radio" [name]="'primary-' + c.categoryId"
                             [checked]="primary()[c.categoryId] === s.supplierId"
                             (change)="setPrimary(c.categoryId, s.supplierId)" />
                      <span class="bp-body-small text-text">{{ s.supplierName }}@if (s.supplierCity) { · {{ s.supplierCity }} }</span>
                      <span class="bp-meta">{{ s.count }} item{{ s.count === 1 ? '' : 's' }}</span>
                    </label>
                  }
                </div>
                <label class="mt-2 flex cursor-pointer items-center gap-2 border-t border-hairline pt-2">
                  <input type="checkbox" class="bp-check" [checked]="!!competing()[c.categoryId]"
                         (change)="toggleCompeting(c.categoryId)" />
                  <span class="bp-meta">Also get competing quotes from the other {{ c.suppliers.length - 1 }} supplier{{ c.suppliers.length - 1 === 1 ? '' : 's' }}</span>
                </label>
              }
            </div>
          }
        </div>

        <div class="mt-4 border-t border-hairline pt-4">
          <button type="button" class="bp-btn-grad w-full" (click)="send.emit(buildRoster())">
            <lucide-icon name="send" [size]="16" />
            Send {{ threadCount() }} brief{{ threadCount() === 1 ? '' : 's' }}
          </button>
          <p class="bp-caption mt-2 text-center">This will spend 1 Ball.</p>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .bp-radio {
        width: 1rem;
        height: 1rem;
        accent-color: var(--theme-accent);
        cursor: pointer;
      }
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

  /** Primary per category, defaulting to the majority owner (suppliers arrive
   *  sorted by count desc, so [0] is the biggest). */
  protected readonly primary = linkedSignal<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const c of this.categories()) m[c.categoryId] = c.suppliers[0]?.supplierId ?? '';
    return m;
  });
  /** Categories the agent opted to also ask the other suppliers in. */
  protected readonly competing = signal<Record<string, boolean>>({});

  protected setPrimary(categoryId: string, supplierId: string): void {
    this.primary.update((m) => ({ ...m, [categoryId]: supplierId }));
  }
  protected toggleCompeting(categoryId: string): void {
    this.competing.update((m) => ({ ...m, [categoryId]: !m[categoryId] }));
  }

  /** Total supplier threads across all categories (the CTA count). */
  protected readonly threadCount = computed(() =>
    this.buildRoster().reduce((n, e) => n + e.supplierIds.length, 0)
  );

  /** One roster entry per category: the primary, or every supplier when the
   *  agent asked for competing quotes. */
  protected buildRoster(): OutreachRosterEntry[] {
    return this.categories()
      .map((c) => {
        const ids = this.competing()[c.categoryId]
          ? c.suppliers.map((s) => s.supplierId)
          : [this.primary()[c.categoryId] || c.suppliers[0]?.supplierId].filter(Boolean);
        return { categoryId: c.categoryId, supplierIds: [...new Set(ids)] };
      })
      .filter((e) => e.supplierIds.length);
  }
}
