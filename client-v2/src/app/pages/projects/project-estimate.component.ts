import { ChangeDetectionStrategy, Component, computed, inject, input, output, resource, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { MessageService } from 'primeng/api';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ProjectService } from '../../core/projects/project.service';
import { EstimateBreakdown, ProjectDetail, QuoteLine, groupByCategory } from '../../core/projects/project.types';
import { errorDetail } from '../../core/http-error';
import { editable, hasInstall, isInstalled, lineCost } from './quote-line.util';
import { EstimateItemRowComponent } from './estimate-item-row.component';
import { InboxService, OutreachRosterEntry } from '../../core/inbox/inbox.service';
import { MessageSuppliersDialogComponent, MsgSupplierCategory } from './message-suppliers-dialog.component';
import { ProjectSummaryTilesComponent } from './project-summary-tiles.component';
import { EstimateBreakdownComponent } from './estimate-breakdown.component';
import { EstimatePreviewRailComponent } from './estimate-preview-rail.component';
import { CustomLineDialogComponent, CustomLine } from './custom-line-dialog.component';

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

/** pV2-PROJECTS-02 slice 3 — the Estimate tab. Ports the v1 estimate
 *  breakdown (Subtotal → Contingency → Your cost → Margin → VAT → Client
 *  total + budget bar) computed from the project's quote items + its
 *  financial defaults — exactly v1's recalc() math (which itself sums the
 *  cart when category costs are stale, our case). INDICATIVE: the
 *  server-side priced rollup + checkout land in 06f. */
@Component({
  selector: 'app-project-estimate',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe, LucideAngularModule, MessageSuppliersDialogComponent, EstimateItemRowComponent,
    ProjectSummaryTilesComponent, EstimateBreakdownComponent, EstimatePreviewRailComponent, CustomLineDialogComponent,
  ],
  host: { class: 'block' },
  template: `
    <div>
      <h2 class="bp-page-title pt-2 text-center">{{ isFinal() ? 'Final Project Quote' : 'Project Cart' }}</h2>

      <!-- Summary tiles: Date / Location / Duration / Guest count / Budget. -->
      <app-project-summary-tiles class="mt-4 block" [project]="project()" [currency]="cur()" />

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
                      <app-estimate-item-row
                        [line]="l" [isFinal]="isFinal()" [selected]="selectedItemId() === l.itemId" [cur]="cur()"
                        (select)="selectLine(l)"
                        (qtyChange)="onQtyChange(l.itemId, $event)"
                        (installToggle)="toggleInstall(l)"
                        (remove)="removeLine(l)" />
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

        <app-estimate-breakdown [bd]="bd()" [budget]="budget()" [cur]="cur()" />

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

      <!-- Right rail: the selected line's marketplace card (owns its own eye). -->
      <app-estimate-preview-rail [line]="selectedLine()" />
      </div>
    </div>

    <!-- Add Custom Line Item modal (Final view). -->
    @if (adding()) {
      <app-custom-line-dialog
        [categoryId]="pendingCategoryId()"
        [categoryName]="pendingCategoryName()"
        (add)="addCustom($event)"
        (cancel)="adding.set(false)" />
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
  private readonly router = inject(Router);

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

  // ── Right-rail item preview (the rail component owns the card + eye) ───
  /** The line the user last clicked — passed to the preview rail. */
  protected readonly selectedItemId = signal<string | null>(null);
  protected readonly selectedLine = computed(
    () => this.rows().find((l) => l.itemId === this.selectedItemId()) ?? null
  );
  protected selectLine(l: QuoteLine): void {
    this.selectedItemId.set(l.itemId);
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
    if (!editable(l)) return;
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
      total: g.items.reduce((s, l) => s + lineCost(l), 0),
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

  /** Persist the Install choice — optimistic on the row, revert + toast on
   *  failure, then reload the server cascade. */
  protected async toggleInstall(l: QuoteLine): Promise<void> {
    if (!hasInstall(l) || !editable(l)) return;
    const next = !isInstalled(l);
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

  protected readonly cur = computed(() => this.project().currency || 'GBP');
  protected readonly budget = computed(() => this.project().projectBudget ?? 0);

  /** The estimate cascade — SERVER-computed (services/estimate.js), consumed
   *  as-is so this tab and the project card can't drift. Reloaded after a qty
   *  edit (qtyCommit → onQtyChange). */
  protected readonly est = resource<EstimateBreakdown, { projectId: string; scope: 'all' | 'cart' }>({
    // scope is part of params (reactive) — never read from a signal inside the
    // loader (M4). Today `view` is fixed per mounted instance, but this keeps
    // the resource correct if that ever changes.
    params: () => ({ projectId: this.projectId(), scope: this.isFinal() ? 'all' : 'cart' }),
    loader: ({ params }) => firstValueFrom(this.projects.estimate(params.projectId, params.scope)),
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

  // ── Custom (ad-hoc) line items — Final view only, in-session ───────────
  protected readonly customLines = signal<CustomLine[]>([]);
  protected readonly adding = signal(false);
  /** The category whose dashed button was clicked — seeds the dialog. */
  protected readonly pendingCategoryId = signal<string | null>(null);
  protected readonly pendingCategoryName = signal<string>('');

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
   *  was clicked (the dialog owns the form). */
  protected openAdd(group?: { id: string; name: string }): void {
    this.pendingCategoryId.set(group?.id ?? null);
    this.pendingCategoryName.set(group?.name ?? '');
    this.adding.set(true);
  }
  /** The dialog emits the fully-built custom line. */
  protected addCustom(line: CustomLine): void {
    this.customLines.update((ls) => [...ls, line]);
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
      // Take the agent straight to the inbox to watch for replies (Liam QC).
      void this.router.navigate(['/inbox', this.projectId()]);
    } catch (err) {
      this.toast.add({ severity: 'error', summary: "Couldn't send the brief — please try again.", detail: errorDetail(err), life: 5000 });
    } finally {
      this.sending.set(false);
    }
  }
}
