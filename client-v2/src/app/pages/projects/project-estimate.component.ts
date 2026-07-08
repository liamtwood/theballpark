import { ChangeDetectionStrategy, Component, computed, inject, input, output, resource, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { MessageService } from 'primeng/api';
import { firstValueFrom } from 'rxjs';
import { ProjectService } from '../../core/projects/project.service';
import { EstimateBreakdown, ProjectDetail, QuoteLine, QuoteLineStatus, groupByCategory } from '../../core/projects/project.types';
import { errorDetail } from '../../core/http-error';
import { QtyInputComponent } from './qty-input.component';
import { ItemPreviewComponent } from '../marketplace/rail/item-preview.component';
import { CatalogueItem } from '../../shared/catalogue/catalogue.types';
import { InboxService, OutreachRosterEntry } from '../../core/inbox/inbox.service';
import { MessageSuppliersDialogComponent, MsgSupplierCategory } from './message-suppliers-dialog.component';

interface SupplierGroup {
  supplierId: string;
  supplierName: string | null;
  supplierCity: string | null;
  items: QuoteLine[];
}
/** Sub-group a category's items by supplier, in first-appearance order — each
 *  becomes a thin "<Supplier> · <City>" band over its items. */
function bySupplier(items: QuoteLine[]): SupplierGroup[] {
  const out: SupplierGroup[] = [];
  const idx = new Map<string, SupplierGroup>();
  for (const l of items) {
    const key = l.supplierId ?? '';
    let g = idx.get(key);
    if (!g) {
      g = { supplierId: key, supplierName: l.supplierName ?? null, supplierCity: l.supplierCity ?? null, items: [] };
      idx.set(key, g);
      out.push(g);
    }
    g.items.push(l);
  }
  return out;
}

/** Per-item send-state badge (Final view). */
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

/** A custom (ad-hoc) line the agent adds on the Final view — in-session only
 *  (persisting needs a project_items column; flagged). */
interface CustomLine {
  id: string;
  /** The category the line was added under (its dashed button) — groups it
   *  into that category's list. */
  categoryId: string | null;
  category: string;
  description: string;
  cost: number;
  quantity: number;
  install: boolean;
  notes: string;
}

/** pV2-PROJECTS-02 slice 3 — the Estimate tab. Ports the v1 estimate
 *  breakdown (Subtotal → Contingency → Your cost → Margin → VAT → Client
 *  total + budget bar) computed from the project's quote items + its
 *  financial defaults — exactly v1's recalc() math (which itself sums the
 *  cart when category costs are stale, our case). INDICATIVE: the
 *  server-side priced rollup + checkout land in 06f. */
@Component({
  selector: 'app-project-estimate',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, FormsModule, LucideAngularModule, QtyInputComponent, ItemPreviewComponent, MessageSuppliersDialogComponent],
  host: { class: 'block' },
  styles: [
    `
      /* Per-item send-state badge (Final view). */
      .bp-pill {
        display: inline-flex;
        align-items: center;
        padding: 1px 9px;
        border-radius: var(--radius-pill);
        font-size: var(--text-2xs);
        font-weight: 500;
        line-height: 1.5;
      }
      .bp-pill--muted { background: var(--color-fill); color: var(--color-text-secondary); }
      .bp-pill--warn { background: var(--color-warn-soft); color: var(--color-warn); }
      .bp-pill--success { background: var(--color-success-soft); color: var(--color-success); }
      .bp-pill--danger { background: var(--color-danger-soft); color: var(--color-danger); }
      /* Add-custom modal fields. */
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
      .bp-input-field:focus { border-color: var(--theme-accent); }
      select.bp-input-field { appearance: auto; }
      /* Custom checkbox — accent tick, no browser-default (blue) fill. */
      .bp-check {
        appearance: none;
        -webkit-appearance: none;
        width: 1rem;
        height: 1rem;
        margin: 0;
        border: 1.5px solid var(--color-border-hairline);
        border-radius: 4px;
        background: var(--color-surface);
        cursor: pointer;
        display: inline-grid;
        place-content: center;
      }
      .bp-check::before {
        content: '';
        width: 0.6rem;
        height: 0.6rem;
        transform: scale(0);
        transition: transform 0.1s ease;
        background: var(--theme-accent);
        clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0, 43% 62%);
      }
      .bp-check:checked {
        border-color: var(--theme-accent);
      }
      .bp-check:checked::before {
        transform: scale(1);
      }
      .bp-check:disabled {
        cursor: not-allowed;
      }
    `,
  ],
  template: `
    <div>
      <h2 class="bp-page-title pt-2 text-center">{{ isFinal() ? 'Final Project Quote' : 'Project Cart' }}</h2>

      <!-- Summary tiles span the full page width as one row (Liam 2026-06-14):
           5 cards — Date / Location / Duration / Guest count / Budget. The rest
           of the quote keeps the narrower max-w-2xl column below. flex sits on
           an INNER div — .bp-card is display:block and beats a flex utility. -->
      <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        <div class="bp-card p-3.5">
          <div class="flex items-start gap-3">
            <span class="bp-icon-block h-10 w-10 shrink-0"><lucide-icon name="calendar" [size]="18" [strokeWidth]="1.75" /></span>
            <span class="min-w-0">
              <span class="bp-field-label block">Date</span>
              <span class="bp-body-small block truncate text-text">{{ project().eventDate || '—' }}</span>
            </span>
          </div>
        </div>
        <div class="bp-card p-3.5">
          <div class="flex items-start gap-3">
            <span class="bp-icon-block h-10 w-10 shrink-0"><lucide-icon name="map-pin" [size]="18" [strokeWidth]="1.75" /></span>
            <span class="min-w-0">
              <span class="bp-field-label block">Location</span>
              <span class="bp-body-small block truncate text-text">{{ project().venueCity || project().venueName || '—' }}</span>
            </span>
          </div>
        </div>
        <div class="bp-card p-3.5">
          <div class="flex items-start gap-3">
            <span class="bp-icon-block h-10 w-10 shrink-0"><lucide-icon name="clock" [size]="18" [strokeWidth]="1.75" /></span>
            <span class="min-w-0">
              <span class="bp-field-label block">Duration</span>
              <span class="bp-body-small block truncate text-text">{{ project().durationDays ? project().durationDays + (project().durationDays === 1 ? ' day' : ' days') : '—' }}</span>
            </span>
          </div>
        </div>
        <div class="bp-card p-3.5">
          <div class="flex items-start gap-3">
            <span class="bp-icon-block h-10 w-10 shrink-0"><lucide-icon name="users" [size]="18" [strokeWidth]="1.75" /></span>
            <span class="min-w-0">
              <span class="bp-field-label block">Guest count</span>
              <span class="bp-body-small block truncate text-text">{{ project().guestCount ?? '—' }}</span>
            </span>
          </div>
        </div>
        <div class="bp-card p-3.5">
          <div class="flex items-start gap-3">
            <span class="bp-icon-block h-10 w-10 shrink-0"><lucide-icon name="wallet" [size]="18" [strokeWidth]="1.75" /></span>
            <span class="min-w-0">
              <span class="bp-field-label block">Budget</span>
              <span class="bp-body-small block truncate text-text">{{ project().projectBudget ? (project().projectBudget | currency: cur() : 'symbol' : '1.0-0') : '—' }}</span>
            </span>
          </div>
        </div>
      </div>

      <!-- Reading column stays page-centered; the preview rail floats
           absolutely — top aligned with the banner, right aligned with the
           budget tile / content edge (Liam 2026-07-07). -->
      <div class="relative">
      <div class="mx-auto max-w-2xl">

      <!-- Estimated Ballpark Cost banner (the headline = client total). -->
      <div class="bp-quote-banner mt-5 px-6 py-7 text-center">
        <div class="bp-body-small">Estimated Ballpark {{ isFinal() ? 'Total' : 'Cost' }}</div>
        <div class="bp-amount-hero mt-1">{{ bannerTotal() | currency: cur() : 'symbol' : '1.0-0' }}</div>
      </div>

      <div class="mt-5"></div>

      @if (lines.isLoading()) {
        <p class="bp-body-small text-secondary">Loading…</p>
      } @else if (lines.error()) {
        <p class="bp-body-small text-warn">Couldn't load the quote — please refresh.</p>
      } @else if (!isFinal() && cartRows().length === 0) {
        <p class="bp-body-small text-secondary">
          @if (rows().length === 0) { Nothing in the cart yet — add items from the marketplace. }
          @else { Everything's out for quote — nothing left to send. }
        </p>
      } @else {
        <p class="bp-field-label uppercase tracking-wide">Categories</p>
        <div class="mt-2 flex flex-col gap-2.5">
          @for (g of groups(); track g.id) {
            <!-- Category card — bare icon (no block around it) + name, cat
                 total right, a chevron that expands the items underneath. -->
            <div class="bp-card overflow-hidden">
              <button type="button" class="flex w-full items-center gap-3.5 p-3 text-left" (click)="toggle(g.id)">
                <lucide-icon [name]="g.iconName || 'folder-open'" [size]="30" [strokeWidth]="1.5" class="shrink-0 text-[var(--theme-accent)]" />
                <span class="min-w-0 flex-1">
                  <span class="bp-list-title block truncate text-[length:var(--text-2xl)]">{{ g.name }}</span>
                </span>
                <span class="bp-amount shrink-0 text-text">{{ g.total | currency: cur() : 'symbol' : '1.0-0' }}</span>
                <lucide-icon [name]="expanded().has(g.id) ? 'chevron-down' : 'chevron-right'" [size]="18" class="shrink-0 text-muted" />
              </button>

              @if (expanded().has(g.id)) {
                <div class="border-t border-hairline">
                  @for (sg of g.supplierGroups; track sg.supplierId) {
                    <!-- Thin supplier band grouping this category's items. -->
                    <div class="flex items-center gap-2 border-b border-hairline bg-fill px-3 py-2">
                      <lucide-icon name="store" [size]="13" class="shrink-0 text-muted" />
                      <span class="bp-meta truncate font-medium text-text">{{ sg.supplierName || 'Supplier' }}@if (sg.supplierCity) { · {{ sg.supplierCity }} }</span>
                    </div>
                    @for (l of sg.items; track l.id) {
                    <!-- Item row — the marketplace list-view shape (thumb + name + price). -->
                    <div class="flex cursor-pointer items-center gap-3 border-b border-hairline px-3 py-3"
                         [class.bg-fill]="selectedItemId() === l.itemId" (click)="selectLine(l)">
                      @if (l.imageUrl) {
                        <img [src]="l.imageUrl" alt="" class="h-16 w-16 shrink-0 rounded-[var(--radius-card)] object-cover" />
                      } @else {
                        <span class="bp-icon-block h-16 w-16 shrink-0"><lucide-icon name="store" [size]="22" /></span>
                      }
                      <!-- Name, then Installed? + Quantity as label→control rows.
                           Install is assumed on when the line has an install price;
                           greyed + disabled when it doesn't. -->
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2">
                          <span class="bp-list-title truncate">{{ l.name }}</span>
                          @if (l.unit) {
                            <span class="bp-meta shrink-0">/ {{ unitLabel(l.unit) }}</span>
                          }
                          @if (isFinal()) {
                            <span [class]="statusPill(l)">{{ statusLabel(l) }}</span>
                          }
                        </div>
                        <!-- Installed?: assumed on when the line has an install price;
                             greyed + disabled when it doesn't. -->
                        <label class="mt-1.5 flex w-fit items-center gap-2.5" [class.opacity-40]="!hasInstall(l) || !editable(l)"
                               [title]="hasInstall(l) ? 'Include installation' : 'No install price'">
                          <span class="bp-meta">Installed?</span>
                          <input type="checkbox" class="bp-check" [checked]="isInstalled(l)" [disabled]="!hasInstall(l) || !editable(l)" (change)="toggleInstall(l)" />
                        </label>
                      </div>
                      @if (editable(l)) {
                        <app-qty-input class="shrink-0" [value]="l.quantity" [label]="l.name" (qtyCommit)="onQtyChange(l.itemId, $event)" />
                      } @else {
                        <span class="bp-body-small shrink-0 text-center text-secondary" title="Out for quote — change it in the inbox">× {{ l.quantity }}</span>
                      }
                      <span class="bp-body-small w-20 shrink-0 text-right text-secondary">{{ lineCost(l) | currency: cur() : 'symbol' : '1.0-0' }}</span>
                      @if (editable(l)) {
                        <button type="button" class="shrink-0 rounded-md p-1 text-muted transition-colors hover:text-danger"
                                (click)="removeLine(l)" [attr.aria-label]="'Remove ' + l.name" title="Remove item">
                          <lucide-icon name="trash-2" [size]="15" />
                        </button>
                      } @else {
                        <span class="shrink-0 p-1 text-muted" title="Out for quote — locked"><lucide-icon name="lock" [size]="14" /></span>
                      }
                    </div>
                    }
                  }

                  @if (isFinal()) {
                    <!-- Custom (ad-hoc) lines added under this category. -->
                    @for (cl of customLinesFor(g.id); track cl.id) {
                      <div class="flex items-center gap-3 border-b border-hairline px-3 py-3">
                        <span class="bp-icon-block h-16 w-16 shrink-0"><lucide-icon name="plus" [size]="22" /></span>
                        <div class="min-w-0 flex-1">
                          <div class="bp-list-title truncate">{{ cl.description }}</div>
                          <div class="bp-meta">Custom · {{ cl.install ? 'Install' : 'Deliverable' }}{{ cl.notes ? ' · ' + cl.notes : '' }}</div>
                        </div>
                        <span class="bp-body-small w-16 shrink-0 text-center text-secondary">× {{ cl.quantity }}</span>
                        <span class="bp-body-small w-20 shrink-0 text-right text-secondary">{{ cl.cost * cl.quantity | currency: cur() : 'symbol' : '1.0-0' }}</span>
                        <button type="button" class="shrink-0 rounded-md p-1 text-muted transition-colors hover:text-danger"
                                (click)="removeCustom(cl.id)" [attr.aria-label]="'Remove ' + cl.description" title="Remove line">
                          <lucide-icon name="trash-2" [size]="15" />
                        </button>
                      </div>
                    }
                    <!-- Dashed add card at the bottom of the category's items. -->
                    <div class="p-3">
                      <button type="button" class="flex w-full items-center justify-center gap-2 rounded-[var(--radius-card)] border border-dashed border-hairline px-3 py-3 text-secondary transition-colors hover:bg-fill hover:text-text"
                              (click)="openAdd(g)">
                        <lucide-icon name="plus" [size]="15" /> Add Your Own Line Item
                      </button>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>

        <!-- Subtotal → contingency → your cost (v1 layout). -->
        <div class="mt-5 flex flex-col gap-1.5">
          <div class="flex justify-between bp-body-small text-secondary"><span>Subtotal</span><span>{{ bd().subtotal | currency: cur() : 'symbol' : '1.0-0' }}</span></div>
          @if (bd().contingencyPct > 0) {
            <div class="flex justify-between bp-body-small text-secondary"><span>Contingency ({{ bd().contingencyPct }}%)</span><span>{{ bd().contingency | currency: cur() : 'symbol' : '1.0-0' }}</span></div>
          }
        </div>
        <div class="mt-3 flex items-baseline justify-between border-t border-hairline pt-3">
          <span class="bp-field-label">Your cost</span>
          <span class="bp-amount text-text">{{ bd().ourCost | currency: cur() : 'symbol' : '1.0-0' }}</span>
        </div>

        <!-- Margin → VAT → client total. -->
        <div class="mt-3 flex flex-col gap-1.5">
          <div class="flex justify-between bp-body-small text-secondary"><span>Margin ({{ bd().marginPct }}%)</span><span>{{ bd().marginAmount | currency: cur() : 'symbol' : '1.0-0' }}</span></div>
          @if (bd().vatPct > 0) {
            <div class="flex justify-between bp-body-small text-secondary"><span>VAT ({{ bd().vatPct }}%)</span><span>{{ bd().vatAmount | currency: cur() : 'symbol' : '1.0-0' }}</span></div>
          }
        </div>
        <div class="mt-3 flex items-baseline justify-between border-t border-hairline pt-3">
          <span class="bp-list-title">Client total</span>
          <span class="bp-price-large">{{ bd().clientTotal | currency: cur() : 'symbol' : '1.0-0' }}</span>
        </div>

        @if (budget() > 0) {
          <div class="bp-card mt-5 p-4">
            <div class="flex items-center justify-between">
              <span class="bp-field-label">{{ bd().clientTotal <= budget() ? 'Within budget' : 'Over budget' }}</span>
              <span class="bp-amount" [class.text-success]="bd().clientTotal <= budget()" [class.text-danger]="bd().clientTotal > budget()">
                {{ budgetDiff() | currency: cur() : 'symbol' : '1.0-0' }}
              </span>
            </div>
            <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-fill">
              <div class="h-full rounded-full" [class.bg-success]="bd().clientTotal <= budget()" [class.bg-danger]="bd().clientTotal > budget()" [style.width.%]="barPct()"></div>
            </div>
            <div class="mt-1.5 flex justify-between"><span class="bp-meta">Client total {{ bd().clientTotal | currency: cur() : 'symbol' : '1.0-0' }}</span><span class="bp-meta">Budget {{ budget() | currency: cur() : 'symbol' : '1.0-0' }}</span></div>
          </div>
        }

        <p class="bp-caption mt-4">Indicative — based on marketplace base prices. Final supplier quotes and the priced rollup land with checkout.</p>

        <!-- Footer — cart: Edit in marketplace + Go with this Ballpark;
             final: Message Suppliers (spends a Ball). -->
        @if (isFinal()) {
          <button type="button" class="bp-btn-grad mt-5 w-full" [disabled]="sending()" (click)="messageSuppliers()">
            <lucide-icon name="send" [size]="16" />
            Message Suppliers
          </button>
          <p class="bp-caption mt-2 text-center">Spend a Ball, firm up cost and let's get this show on the road</p>
        } @else {
          <div class="mt-5 flex gap-2.5">
            <button type="button" class="bp-btn-grad flex-1" (click)="addItems.emit()">
              <lucide-icon name="store" [size]="16" />
              Edit in marketplace
            </button>
            <button type="button" class="bp-btn-outline flex-1" (click)="goToFinal.emit()">
              Go with this Ballpark
              <lucide-icon name="arrow-right" [size]="16" />
            </button>
          </div>
        }
      }
      </div>

      <!-- Right rail: the selected line's marketplace card. The eye hides it
           for ALL selections until clicked again (Liam 2026-07-07). -->
      @if (selectedLine()) {
        <!-- Rail spans the gap between the centered column's right edge
             (50% + half of max-w-2xl = 21rem) and the screen edge; the card is
             centered in it. Full-height so the inner sticky card stays put. -->
        <aside class="absolute inset-y-0 right-0 left-[calc(50%_+_21rem)] hidden items-start justify-center lg:flex">
          <div class="sticky top-32 w-80">
            @if (previewHidden()) {
              <!-- Hidden: just the eye, in the same top-right spot as the
                   preview card's eye (matches the card's p-4 inset). -->
              <div class="flex justify-end px-4 pt-4">
                <button type="button" class="bp-itemprev-close" (click)="previewHidden.set(false)"
                        title="Show item preview" aria-label="Show item preview">
                  <lucide-icon name="eye" [size]="14" />
                </button>
              </div>
            } @else {
              <div class="bp-card p-4">
                <app-item-preview [item]="previewItem()!" [categoryName]="selectedLine()!.categoryName"
                                  closeIcon="eye" closeLabel="Hide preview" (closed)="previewHidden.set(true)" />
              </div>
            }
          </div>
        </aside>
      }
      </div>
    </div>

    <!-- Add Custom Line Item modal (Final view). -->
    @if (adding()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" (click)="adding.set(false)">
        <div class="bp-card w-full max-w-md p-6" (click)="$event.stopPropagation()">
          <div class="flex items-start justify-between">
            <h3 class="bp-card-title text-lg">Add Your Own Line Item</h3>
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
              <input class="bp-input-field" placeholder="e.g. On-site security team" [(ngModel)]="form.description" />
            </label>
            <div class="grid grid-cols-2 gap-3">
              <label class="block">
                <span class="bp-field-label">Estimated Cost</span>
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
              <input class="bp-input-field" placeholder="Any additional details" [(ngModel)]="form.notes" />
            </label>
          </div>
          <button type="button" class="bp-btn-grad mt-5 w-full" [disabled]="!form.description.trim() || (form.cost || 0) <= 0" (click)="addCustom()">
            Add Line Item
          </button>
        </div>
      </div>
    }

    <!-- "Who quotes what" step (Final view Message Suppliers). -->
    @if (messagingOpen()) {
      <app-message-suppliers-dialog
        [categories]="messagingCategories()"
        (send)="onSendBriefs($event)"
        (cancel)="messagingOpen.set(false)" />
    }
  `,
})
export class ProjectEstimateComponent {
  private readonly projects = inject(ProjectService);
  private readonly toast = inject(MessageService);
  private readonly inbox = inject(InboxService);

  readonly projectId = input.required<string>();
  readonly project = input.required<ProjectDetail>();
  /** cart = editable "To Send" slice; final = everything + status badges +
   *  custom lines. Same layout, one switch. */
  readonly view = input<'cart' | 'final'>('cart');
  /** "Edit in marketplace" — the Marketplace tab in item-browse mode (cart). */
  readonly addItems = output<void>();
  /** "Go with this Ballpark" — jump to the Final Quote tab (cart). */
  readonly goToFinal = output<void>();

  protected readonly isFinal = computed(() => this.view() === 'final');

  // ── Right-rail item preview (marketplace card) ────────────────────────
  /** The line the user last clicked — its card shows in the right rail. */
  protected readonly selectedItemId = signal<string | null>(null);
  /** Eye toggle: when true the preview is suppressed for ALL selections until
   *  toggled back on (session-local). */
  protected readonly previewHidden = signal(false);

  protected readonly selectedLine = computed(
    () => this.rows().find((l) => l.itemId === this.selectedItemId()) ?? null
  );
  /** The selected line mapped to the marketplace preview's CatalogueItem
   *  shape (the quote line already carries everything the preview renders). */
  protected readonly previewItem = computed<CatalogueItem | null>(() => {
    const l = this.selectedLine();
    if (!l) return null;
    return {
      id: l.itemId,
      name: l.name ?? '',
      description: l.description,
      basePrice: l.basePrice,
      unit: l.unit,
      coverUrl: l.imageUrl,
      categoryId: l.categoryId ?? '',
      subcategoryId: null,
      supplierId: l.supplierId ?? '',
      supplierName: l.supplierName ?? '',
      supplierCity: null,
      categoryName: l.categoryName,
      subcategoryName: null,
      ownedByActiveOrg: false,
      approvalStatus: 'approved',
      isActive: true,
    };
  });
  protected selectLine(l: QuoteLine): void {
    this.selectedItemId.set(l.itemId);
  }

  protected statusLabel(l: QuoteLine): string {
    return STATUS_LABELS[l.status] ?? '';
  }
  protected statusPill(l: QuoteLine): string {
    return `bp-pill ${STATUS_PILL[l.status] ?? 'bp-pill--muted'}`;
  }

  /** Quote lines as writable state (seeded from the resource load) so qty
   *  edits can update optimistically + revert on failure. */
  protected readonly rows = signal<QuoteLine[]>([]);
  protected readonly lines = resource<QuoteLine[], string>({
    params: () => this.projectId(),
    loader: async ({ params }) => {
      const ls = await firstValueFrom(this.projects.quoteItems(params));
      this.rows.set(ls);
      return ls;
    },
  });

  /** Inline quantity edit on a quote line — optimistic, revert + toast on
   *  failure. The cascade (subtotal → … → client total) and the category
   *  totals are qty-weighted via lineCost(), so they recompute automatically. */
  protected async onQtyChange(itemId: string, quantity: number): Promise<void> {
    const before = this.rows();
    this.rows.update((ls) => ls.map((l) => (l.itemId === itemId ? { ...l, quantity } : l)));
    try {
      await firstValueFrom(this.projects.setQuoteItemQuantity(this.projectId(), itemId, quantity));
      // The cascade is server-authoritative — pull the fresh breakdown.
      this.est.reload();
    } catch (err) {
      this.rows.set(before);
      this.toast.add({ severity: 'error', summary: "Couldn't update the quantity — please try again.", detail: errorDetail(err), life: 4000 });
    }
  }

  /** Remove a line from the quote — optimistic, revert + toast on failure.
   *  Reloads the server cascade so the Ballpark drops with it. */
  protected async removeLine(l: QuoteLine): Promise<void> {
    if (!this.editable(l)) return;
    const before = this.rows();
    this.rows.update((ls) => ls.filter((x) => x.itemId !== l.itemId));
    try {
      await firstValueFrom(this.projects.removeQuoteItem(this.projectId(), l.itemId));
      this.est.reload();
    } catch (err) {
      this.rows.set(before);
      this.toast.add({ severity: 'error', summary: "Couldn't remove the item — please try again.", detail: errorDetail(err), life: 4000 });
    }
  }

  /** Quote lines grouped by category — one card per category, with its
   *  summed total + the first item's image as the cover. */
  /** The cart = only the still-to-send items (pV2-CART-01). Sent items live
   *  on the Final Quote view with their status badge; the cart is the editable
   *  pre-send slice. */
  protected readonly cartRows = computed(() => this.rows().filter((l) => l.status === 'to_send'));
  /** Final shows everything; cart shows only the To Send slice. */
  protected readonly visibleRows = computed(() => (this.isFinal() ? this.rows() : this.cartRows()));

  protected readonly groups = computed(() =>
    groupByCategory(this.visibleRows()).map((g) => ({
      ...g,
      total: g.items.reduce((s, l) => s + this.lineCost(l), 0),
      iconName: g.items[0]?.categoryIconName ?? null,
      // Expanded list: items grouped under a thin supplier band.
      supplierGroups: bySupplier(g.items),
    }))
  );

  protected readonly expanded = signal<ReadonlySet<string>>(new Set());
  protected toggle(catId: string): void {
    this.expanded.update((set) => {
      const next = new Set(set);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }

  /** Whether this line has an install price to offer (else the checkbox is
   *  greyed + disabled). */
  protected hasInstall(l: QuoteLine): boolean {
    return (l.installCost ?? 0) > 0;
  }
  /** Installed = has an install price AND not explicitly opted out (persisted
   *  `installed`; null/true = on, false = off). */
  protected isInstalled(l: QuoteLine): boolean {
    return this.hasInstall(l) && l.installed !== false;
  }
  /** Persist the Install choice — optimistic on the row, revert + toast on
   *  failure, then reload the server cascade. */
  protected async toggleInstall(l: QuoteLine): Promise<void> {
    if (!this.hasInstall(l) || !this.editable(l)) return;
    const next = !this.isInstalled(l);
    const before = this.rows();
    this.rows.update((ls) => ls.map((x) => (x.itemId === l.itemId ? { ...x, installed: next } : x)));
    try {
      await firstValueFrom(this.projects.setQuoteItemInstalled(this.projectId(), l.itemId, next));
      this.est.reload();
    } catch (err) {
      this.rows.set(before);
      this.toast.add({ severity: 'error', summary: "Couldn't save the install option — please try again.", detail: errorDetail(err), life: 4000 });
    }
  }

  protected lineCost(l: QuoteLine): number {
    const inst = this.isInstalled(l) ? (l.installCost ?? 0) : 0;
    return ((l.basePrice ?? 0) + inst) * (l.quantity ?? 1);
  }
  /** Quote rows are read-only once the item is out for quote — edits happen
   *  in the inbox thread (Liam 2026-07-08). */
  protected editable(l: QuoteLine): boolean {
    return l.status === 'to_send';
  }
  /** The unit code ('head', 'linear_m') as a readable label. */
  protected unitLabel(unit: string | null): string {
    if (!unit) return '';
    const t = unit.replace(/_/g, ' ');
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  protected readonly cur = computed(() => this.project().currency || 'GBP');
  protected readonly budget = computed(() => this.project().projectBudget ?? 0);

  /** The estimate cascade — SERVER-computed (services/estimate.js), consumed
   *  as-is so this tab and the project card can't drift. Reloaded after a qty
   *  edit (qtyCommit → onQtyChange). */
  protected readonly est = resource<EstimateBreakdown, string>({
    params: () => this.projectId(),
    loader: ({ params }) => firstValueFrom(this.projects.estimate(params, this.isFinal() ? 'all' : 'cart')),
  });

  /** The breakdown the template renders: the server value once loaded, else a
   *  zeroed placeholder seeded with the project's rates so the "%" labels don't
   *  flash before the first load. */
  protected readonly bd = computed<EstimateBreakdown>(() => {
    const v = this.est.value();
    if (v) return v;
    return {
      subtotal: 0,
      contingencyPct: this.project().defaultContingencyPct ?? 10,
      marginPct: this.project().defaultMarginPct ?? 20,
      vatPct: this.project().defaultVatPct ?? 20,
      contingency: 0,
      ourCost: 0,
      marginAmount: 0,
      vatAmount: 0,
      clientTotal: 0,
    };
  });

  protected readonly budgetDiff = computed(() => (this.budget() > 0 ? this.bd().clientTotal - this.budget() : 0));
  protected readonly barPct = computed(() =>
    this.budget() > 0 ? Math.min((this.bd().clientTotal / this.budget()) * 100, 100) : 0
  );

  // ── Custom (ad-hoc) line items — Final view only, in-session ───────────
  protected readonly customLines = signal<CustomLine[]>([]);
  protected readonly adding = signal(false);
  /** The category the pending add belongs to (its dashed button). */
  private addingCategoryId: string | null = null;
  protected form = { category: '', description: '', cost: 0, quantity: 1, type: 'deliverable', notes: '' };

  /** Custom lines added under a given category (its dashed add button). */
  protected customLinesFor(categoryId: string | null): CustomLine[] {
    return this.customLines().filter((c) => c.categoryId === categoryId);
  }

  /** Custom lines are raw (unpersisted) — added to the headline on top of the
   *  server-cascaded item total. */
  protected readonly customTotal = computed(() =>
    this.customLines().reduce((s, c) => s + c.cost * c.quantity, 0)
  );
  /** Banner headline: the server client total, plus raw custom lines on Final. */
  protected readonly bannerTotal = computed(
    () => this.bd().clientTotal + (this.isFinal() ? this.customTotal() : 0)
  );

  /** Open the add-custom modal, seeded with the category whose dashed button
   *  was clicked. */
  protected openAdd(group?: { id: string; name: string }): void {
    this.addingCategoryId = group?.id ?? null;
    this.form = { category: group?.name ?? '', description: '', cost: 0, quantity: 1, type: 'deliverable', notes: '' };
    this.adding.set(true);
  }
  protected addCustom(): void {
    const f = this.form;
    if (!f.description.trim() || (f.cost || 0) <= 0) return;
    this.customLines.update((ls) => [
      ...ls,
      {
        id: `c${ls.length}-${f.description.slice(0, 6)}`,
        categoryId: this.addingCategoryId,
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

  // ── Message suppliers (Final view) ────────────────────────────────────
  protected readonly sending = signal(false);
  protected readonly messagingOpen = signal(false);

  /** The still-to-send lines grouped by category → suppliers (with item
   *  counts, majority first) — feeds the "who quotes what" dialog. */
  protected readonly messagingCategories = computed<MsgSupplierCategory[]>(() => {
    const byCat = new Map<string, MsgSupplierCategory>();
    for (const l of this.rows()) {
      if (l.status !== 'to_send' || !l.categoryId || !l.supplierId) continue;
      let c = byCat.get(l.categoryId);
      if (!c) {
        c = { categoryId: l.categoryId, categoryName: l.categoryName ?? 'Category', suppliers: [] };
        byCat.set(l.categoryId, c);
      }
      let s = c.suppliers.find((x) => x.supplierId === l.supplierId);
      if (!s) {
        s = { supplierId: l.supplierId, supplierName: l.supplierName ?? 'Supplier', supplierCity: l.supplierCity ?? null, count: 0 };
        c.suppliers.push(s);
      }
      s.count++;
    }
    for (const c of byCat.values()) c.suppliers.sort((a, b) => b.count - a.count);
    return [...byCat.values()];
  });

  /** Open the "who quotes what" dialog (nothing to send → toast instead). */
  protected messageSuppliers(): void {
    if (this.sending()) return;
    if (!this.messagingCategories().length) {
      this.toast.add({ severity: 'warn', summary: 'Nothing to send — no unsent items with a supplier.', life: 4000 });
      return;
    }
    this.messagingOpen.set(true);
  }

  /** Dialog confirmed with the chosen roster → send the briefs. On success the
   *  lines flip to out_for_quote (server-derived) — reload. */
  protected async onSendBriefs(roster: OutreachRosterEntry[]): Promise<void> {
    this.messagingOpen.set(false);
    if (!roster.length || this.sending()) return;
    this.sending.set(true);
    try {
      const res = await firstValueFrom(this.inbox.send(this.projectId(), roster));
      this.toast.add({
        severity: 'success',
        summary: `Brief sent — ${res.threads} supplier ${res.threads === 1 ? 'thread' : 'threads'} across ${res.categories} ${res.categories === 1 ? 'category' : 'categories'}.`,
        life: 5000,
      });
      this.lines.reload();
      this.est.reload();
    } catch (err) {
      this.toast.add({ severity: 'error', summary: "Couldn't send the brief — please try again.", detail: errorDetail(err), life: 5000 });
    } finally {
      this.sending.set(false);
    }
  }
}
