import { ChangeDetectionStrategy, Component, computed, inject, input, output, resource, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { MessageService } from 'primeng/api';
import { firstValueFrom } from 'rxjs';
import { ProjectService } from '../../core/projects/project.service';
import { ProjectDetail, QuoteLine, QuoteLineStatus } from '../../core/projects/project.types';
import { errorDetail } from '../../core/http-error';
import { ProjectOutreachStore } from './project-outreach.store';
import { QtyInputComponent } from './qty-input.component';

/** A custom (ad-hoc) line the agent adds on the Final Quote — client-side
 *  only for now (persisting these + the Install/Deliverable choice needs a
 *  project_items column; flagged for a fast-follow). */
interface CustomLine {
  id: string;
  category: string;
  description: string;
  cost: number;
  quantity: number;
  install: boolean;
  notes: string;
}

const STATUS_LABELS: Record<QuoteLineStatus, string> = {
  to_send: 'To send',
  out_for_quote: 'Out for quote',
  quoted: 'Quoted',
  booked: 'Booked',
  declined: 'Declined',
};
const STATUS_PILL: Record<QuoteLineStatus, string> = {
  to_send: 'bp-pill--muted',
  out_for_quote: 'bp-pill--warn',
  quoted: 'bp-pill--warn',
  booked: 'bp-pill--success',
  declined: 'bp-pill--danger',
};

/** pV2-FINAL-01 — the Final Project Quote. The supplier-facing review the
 *  agent checks before sending: a summary card + line items with a per-line
 *  Install / Deliverable toggle (Install adds the catalogue item's
 *  install_cost) + an Add Custom Line Item modal. Costs are RAW (what
 *  suppliers quote) — the client-facing margin/VAT cascade stays on the
 *  Estimate tab. Toggle + custom lines are in-session pending persistence. */
@Component({
  selector: 'app-project-final-quote',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, FormsModule, LucideAngularModule, QtyInputComponent],
  host: { class: 'block' },
  template: `
    <div class="mx-auto max-w-4xl pb-10">
      <h1 class="bp-page-title pt-2">Final Project Quote</h1>
      <p class="bp-body-small mt-1 text-secondary">
        Review your selected suppliers, quantities and project requirements before contacting suppliers
      </p>

      <!-- Summary card -->
      <div class="bp-card mt-4 p-5">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div class="flex items-start gap-2.5">
            <lucide-icon name="calendar" [size]="16" [strokeWidth]="1.75" class="mt-0.5 text-muted" />
            <span class="min-w-0">
              <span class="bp-field-label block">Project Date</span>
              <span class="bp-body-small block text-text">{{ project().eventDate || 'TBC' }}</span>
            </span>
          </div>
          <div class="flex items-start gap-2.5">
            <lucide-icon name="map-pin" [size]="16" [strokeWidth]="1.75" class="mt-0.5 text-muted" />
            <span class="min-w-0">
              <span class="bp-field-label block">Location</span>
              <span class="bp-body-small block text-text">{{ project().venueCity || project().venueName || '—' }}</span>
            </span>
          </div>
          <div class="flex items-start gap-2.5">
            <lucide-icon name="users" [size]="16" [strokeWidth]="1.75" class="mt-0.5 text-muted" />
            <span class="min-w-0">
              <span class="bp-field-label block">Suppliers</span>
              <span class="bp-body-small block text-text">{{ outreach.supplierCount() }} Selected</span>
            </span>
          </div>
        </div>
        <div class="mt-4 flex items-center justify-between border-t border-hairline pt-4">
          <span class="bp-list-title">Estimated Ballpark Total</span>
          <span class="bp-amount-hero">{{ total() | currency: cur() : 'symbol' : '1.0-0' }}</span>
        </div>
      </div>

      <!-- Line items -->
      <h2 class="bp-card-title mt-7 text-lg">Line Items</h2>

      @if (lines.isLoading()) {
        <p class="bp-body-small mt-2 text-secondary">Loading…</p>
      } @else {
        <div class="mt-3 flex flex-col gap-2.5">
          @for (l of rows(); track l.id) {
            <div class="bp-card p-4">
              <div class="flex flex-col gap-4 md:flex-row md:items-center">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="bp-field-label">{{ l.categoryName || 'Item' }}</span>
                    <span [class]="statusPill(l)">{{ statusLabel(l) }}</span>
                  </div>
                  <div class="bp-list-title truncate">{{ l.name }}</div>
                  @if (l.description) {
                    <div class="bp-body-small text-secondary">{{ l.description }}</div>
                  }
                  @if (isInstall(l.id) && l.installDescription) {
                    <div class="bp-caption mt-1 italic">{{ l.installDescription }}</div>
                  }
                </div>

                <div class="flex items-center gap-6">
                  <div class="text-center">
                    <span class="bp-field-label block text-center">Quantity</span>
                    <app-qty-input class="mt-1 inline-flex" [value]="l.quantity" [label]="l.name || 'item'" (qtyCommit)="onQty(l.itemId, $event)" />
                  </div>

                  @if (l.installCost) {
                    <div class="text-center">
                      <span class="bp-field-label block text-center">Option</span>
                      <div class="mt-1 inline-flex overflow-hidden rounded-[var(--radius-pill)] border border-hairline">
                        <button type="button" [class]="segClass(isInstall(l.id))" (click)="setInstall(l.id, true)">Install</button>
                        <button type="button" [class]="segClass(!isInstall(l.id))" (click)="setInstall(l.id, false)">Deliverable</button>
                      </div>
                    </div>
                  }

                  <div class="text-right">
                    <span class="bp-field-label block">Ballpark Cost</span>
                    <span class="bp-list-title">{{ lineCost(l) | currency: cur() : 'symbol' : '1.0-0' }}</span>
                  </div>
                </div>
              </div>
            </div>
          }

          <!-- Custom (ad-hoc) lines -->
          @for (cl of customLines(); track cl.id) {
            <div class="bp-card p-4">
              <div class="flex items-center gap-4">
                <div class="min-w-0 flex-1">
                  <span class="bp-field-label">{{ cl.category || 'Custom' }}</span>
                  <div class="bp-list-title truncate">{{ cl.description || 'Custom line item' }}</div>
                  <div class="bp-caption">{{ cl.install ? 'Install' : 'Deliverable' }}{{ cl.notes ? ' · ' + cl.notes : '' }}</div>
                </div>
                <span class="bp-body-small text-secondary">× {{ cl.quantity }}</span>
                <span class="bp-list-title w-24 text-right">{{ cl.cost * cl.quantity | currency: cur() : 'symbol' : '1.0-0' }}</span>
                <button type="button" class="text-muted hover:text-danger" [attr.aria-label]="'Remove ' + cl.description" (click)="removeCustom(cl.id)">
                  <lucide-icon name="x" [size]="16" />
                </button>
              </div>
            </div>
          }

        </div>

        <!-- Add Your Own Line Item + Add Suppliers, side by side. -->
        <div class="mt-5 flex gap-2.5">
          <button type="button" class="bp-btn-outline flex-1" (click)="openAdd()">
            <lucide-icon name="plus" [size]="16" />
            Add Your Own Line Item
          </button>
          <button type="button" class="bp-btn-grad flex-1" (click)="addSuppliers.emit()">
            Add Suppliers
            <lucide-icon name="arrow-right" [size]="16" />
          </button>
        </div>
      }
    </div>

    <!-- Add Custom Line Item modal -->
    @if (adding()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" (click)="adding.set(false)">
        <div class="bp-card w-full max-w-md p-6" (click)="$event.stopPropagation()">
          <div class="flex items-start justify-between">
            <h3 class="bp-card-title text-lg">Add Custom Line Item</h3>
            <button type="button" class="text-muted hover:text-text" aria-label="Close" (click)="adding.set(false)">
              <lucide-icon name="x" [size]="18" />
            </button>
          </div>

          <div class="mt-4 flex flex-col gap-3">
            <label class="block">
              <span class="bp-field-label">Category</span>
              <input class="bp-input-field" placeholder="e.g. Security Staff" [(ngModel)]="form.category" />
            </label>
            <label class="block">
              <span class="bp-field-label">Description</span>
              <textarea class="bp-store-textarea" rows="2" placeholder="e.g. On-site security team" [(ngModel)]="form.description"></textarea>
            </label>
            <div class="grid grid-cols-2 gap-3">
              <label class="block">
                <span class="bp-field-label">Estimated Cost (£)</span>
                <input type="number" class="bp-input-field" placeholder="2000" [(ngModel)]="form.cost" />
              </label>
              <label class="block">
                <span class="bp-field-label">Quantity</span>
                <input type="number" class="bp-input-field" placeholder="1" [(ngModel)]="form.quantity" />
              </label>
            </div>
            <label class="block">
              <span class="bp-field-label">Type</span>
              <select class="bp-input-field" [(ngModel)]="form.type">
                <option value="deliverable">Deliverable</option>
                <option value="install">Install</option>
              </select>
            </label>
            <label class="block">
              <span class="bp-field-label">Notes (optional)</span>
              <textarea class="bp-store-textarea" rows="2" placeholder="Any additional details" [(ngModel)]="form.notes"></textarea>
            </label>
          </div>

          <button type="button" class="bp-btn-grad mt-5 w-full" [disabled]="!form.description.trim() || (form.cost || 0) <= 0" (click)="addCustom()">
            Add Line Item
          </button>
        </div>
      </div>
    }
  `,
  styles: [
    `
      /* Install / Deliverable segmented toggle. */
      .bp-seg {
        padding: 6px 14px;
        font-size: var(--text-sm);
        font-weight: 500;
        background: var(--color-fill);
        color: var(--color-text-secondary);
        border: none;
        cursor: pointer;
      }
      .bp-seg--on {
        background: var(--bp-gradient);
        color: var(--bp-text-on-gradient);
      }
      /* Modal form fields. */
      .bp-input-field {
        height: 38px;
        width: 100%;
        border-radius: var(--radius-field);
        border: 1px solid var(--color-border-hairline);
        background: var(--color-fill);
        padding: 0 12px;
        font-size: var(--text-md);
        color: var(--color-text);
        outline: none;
      }
      .bp-input-field:focus {
        border-color: var(--theme-accent);
      }
      select.bp-input-field {
        appearance: auto;
      }
      /* Per-item send-state badge. */
      .bp-pill {
        display: inline-flex;
        align-items: center;
        padding: 1px 9px;
        border-radius: var(--radius-pill);
        font-size: var(--text-2xs);
        font-weight: 500;
        line-height: 1.5;
      }
      .bp-pill--muted {
        background: var(--color-fill);
        color: var(--color-text-secondary);
      }
      .bp-pill--warn {
        background: var(--color-warn-soft);
        color: var(--color-warn);
      }
      .bp-pill--success {
        background: var(--color-success-soft);
        color: var(--color-success);
      }
      .bp-pill--danger {
        background: var(--color-danger-soft);
        color: var(--color-danger);
      }
    `,
  ],
})
export class ProjectFinalQuoteComponent {
  private readonly projects = inject(ProjectService);
  private readonly toast = inject(MessageService);
  protected readonly outreach = inject(ProjectOutreachStore);

  readonly projectId = input.required<string>();
  readonly project = input.required<ProjectDetail>();
  /** "Add Suppliers" → the Marketplace tab in supplier mode. */
  readonly addSuppliers = output<void>();

  protected readonly cur = computed(() => this.project().currency || 'GBP');

  /** Per-item send-state badge (pV2-CART-01). */
  protected statusLabel(l: QuoteLine): string {
    return STATUS_LABELS[l.status] ?? '';
  }
  protected statusPill(l: QuoteLine): string {
    return `bp-pill ${STATUS_PILL[l.status] ?? 'bp-pill--muted'}`;
  }

  protected readonly rows = signal<QuoteLine[]>([]);
  protected readonly lines = resource<QuoteLine[], string>({
    params: () => this.projectId(),
    loader: async ({ params }) => {
      const ls = await firstValueFrom(this.projects.quoteItems(params));
      this.rows.set(ls);
      return ls;
    },
  });

  // Install / Deliverable per line (in-session). Default = Deliverable.
  private readonly installed = signal<ReadonlySet<string>>(new Set());
  protected isInstall(lineId: string): boolean {
    return this.installed().has(lineId);
  }
  protected setInstall(lineId: string, on: boolean): void {
    this.installed.update((s) => {
      const next = new Set(s);
      if (on) next.add(lineId);
      else next.delete(lineId);
      return next;
    });
  }

  protected lineCost(l: QuoteLine): number {
    const install = this.isInstall(l.id) ? l.installCost ?? 0 : 0;
    return ((l.basePrice ?? 0) + install) * (l.quantity ?? 1);
  }

  protected readonly total = computed(() => {
    const lines = this.rows().reduce((s, l) => s + this.lineCost(l), 0);
    const custom = this.customLines().reduce((s, c) => s + c.cost * c.quantity, 0);
    return lines + custom;
  });

  protected segClass(active: boolean): string {
    return active ? 'bp-seg bp-seg--on' : 'bp-seg';
  }

  /** Quantity edits persist (real project_items field), optimistic + revert. */
  protected async onQty(itemId: string, quantity: number): Promise<void> {
    const before = this.rows();
    this.rows.update((ls) => ls.map((l) => (l.itemId === itemId ? { ...l, quantity } : l)));
    try {
      await firstValueFrom(this.projects.setQuoteItemQuantity(this.projectId(), itemId, quantity));
    } catch (err) {
      this.rows.set(before);
      this.toast.add({ severity: 'error', summary: "Couldn't update the quantity.", detail: errorDetail(err), life: 4000 });
    }
  }

  // ── Add custom line item (in-session) ─────────────────────────────────
  protected readonly customLines = signal<CustomLine[]>([]);
  protected readonly adding = signal(false);
  protected form = { category: '', description: '', cost: 0, quantity: 1, type: 'deliverable', notes: '' };

  protected openAdd(): void {
    this.form = { category: '', description: '', cost: 0, quantity: 1, type: 'deliverable', notes: '' };
    this.adding.set(true);
  }

  protected addCustom(): void {
    const f = this.form;
    if (!f.description.trim() || (f.cost || 0) <= 0) return;
    this.customLines.update((ls) => [
      ...ls,
      {
        id: `c${ls.length}-${f.description.slice(0, 6)}`,
        category: f.category.trim(),
        description: f.description.trim(),
        cost: Number(f.cost) || 0,
        quantity: Math.max(1, Number(f.quantity) || 1),
        install: f.type === 'install',
        notes: f.notes.trim(),
      },
    ]);
    this.adding.set(false);
  }

  protected removeCustom(id: string): void {
    this.customLines.update((ls) => ls.filter((c) => c.id !== id));
  }
}
