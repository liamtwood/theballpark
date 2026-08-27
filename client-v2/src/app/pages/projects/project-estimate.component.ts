import { ChangeDetectionStrategy, Component, computed, inject, input, output, resource, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { MessageService } from 'primeng/api';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ProjectService } from '../../core/projects/project.service';
import { EstimateBreakdown, ProjectDetail, QuoteLine, groupByCategory } from '../../core/projects/project.types';
import { errorDetail } from '../../core/http-error';
import { editable, hasInstall, isDeclined, isInstalled, lineCost } from './quote-line.util';
import { EstimateItemRowComponent } from './estimate-item-row.component';
import { InboxService, OutreachRosterEntry } from '../../core/inbox/inbox.service';
import { MessageSuppliersDialogComponent, MsgSupplierCategory } from './message-suppliers-dialog.component';
import { ProjectSummaryTilesComponent } from './project-summary-tiles.component';
import { EstimateBreakdownComponent } from './estimate-breakdown.component';
import { EstimatePreviewRailComponent } from './estimate-preview-rail.component';
import { CustomLineDialogComponent, CustomLine, LineSupplier, ExistingPick } from './custom-line-dialog.component';
import { OptionsPickerComponent } from './options-picker.component';

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
    OptionsPickerComponent,
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
                <lucide-icon [name]="isOpen(g.id) ? 'chevron-down' : 'chevron-right'" [size]="18" class="shrink-0 text-muted" />
              </button>

              @if (isOpen(g.id)) {
                <div class="border-t border-hairline">
                  @for (sg of g.supplierGroups; track sg.supplierId) {
                    <!-- Thin supplier band grouping this category's items. -->
                    <div class="flex items-center gap-2 border-b border-hairline bg-fill px-3 py-2">
                      <lucide-icon name="store" [size]="13" class="shrink-0 text-muted" />
                      <span class="bp-meta truncate font-medium text-text">{{ sg.supplierName || 'Supplier' }}@if (sg.supplierCity) { · {{ sg.supplierCity }} }</span>
                    </div>
                    @for (l of sg.items; track l.id) {
                      <app-estimate-item-row
                        [line]="l" [isFinal]="isFinal()" [selected]="selectedItemId() === l.id" [cur]="cur()"
                        (select)="selectLine(l)"
                        (qtyChange)="onQtyChange(l.id, $event)"
                        (installToggle)="toggleInstall(l)"
                        (options)="optionsLine.set(l)"
                        (remove)="removeLine(l)" />
                      <!-- pV2-BUILDUP-03 — the line's picked options, nested. -->
                      @for (op of optionsFor(l.id); track op.id) {
                        <div class="flex items-center gap-2 border-b border-hairline bg-fill/40 py-2 pl-14 pr-3">
                          <lucide-icon name="corner-down-right" [size]="14" class="shrink-0 text-muted" />
                          <span class="min-w-0 flex-1 truncate bp-meta text-text">{{ op.name }}</span>
                          <span class="bp-meta shrink-0 tabular-nums text-secondary">{{ op.basePrice != null ? (op.basePrice | currency: cur() : 'symbol' : '1.0-0') : '' }}@if (op.unit) { / {{ op.unit }} } × {{ op.quantity }}</span>
                          <span class="w-20 shrink-0 text-right bp-body-small tabular-nums text-secondary">{{ optCost(op) | currency: cur() : 'symbol' : '1.0-0' }}</span>
                          <button type="button" class="shrink-0 rounded-md p-1 text-muted transition-colors hover:text-danger"
                                  (click)="removeLine(op)" [attr.aria-label]="'Remove ' + op.name" title="Remove option">
                            <lucide-icon name="trash-2" [size]="14" />
                          </button>
                        </div>
                      }
                    }
                  }

                  <!-- Dashed add card at the bottom of the category's items.
                       Available on BOTH the Cart and Final views (was Final-only)
                       so the entry point never vanishes when a round-trip lands
                       you on the Cart tab. Custom lines persist as real
                       project_items (pV2-CUSTOMS-01) and render above with a
                       "Custom" tag. -->
                  <div class="p-3">
                    <button type="button" class="flex w-full items-center justify-center gap-2 rounded-[var(--radius-card)] border border-dashed border-hairline px-3 py-3 text-secondary transition-colors hover:bg-fill hover:text-text"
                            (click)="openAdd(g)">
                      <lucide-icon name="plus" [size]="15" /> Add Your Own Line Item
                    </button>
                  </div>
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
      <app-estimate-preview-rail [line]="selectedLine()" [options]="selectedOptions()" [cur]="cur()"
                                 (exploreMore)="onExploreMore()" />
      </div>
    </div>

    <!-- Add Custom Line Item modal (Final view). -->
    @if (adding()) {
      <app-custom-line-dialog
        [variant]="dialogVariant()"
        [categoryId]="pendingCategoryId()"
        [categoryName]="pendingCategoryName()"
        [categoryIcon]="pendingCategoryIcon()"
        [suppliers]="pendingSuppliers()"
        [existingLines]="pendingExisting()"
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

    <!-- pV2-BUILDUP-03 — pick an item's options → they add as quote lines. -->
    @if (optionsLine(); as ol) {
      <app-options-picker
        [projectId]="projectId()"
        [itemId]="ol.itemId"
        [lineId]="ol.id"
        [itemName]="ol.name ?? ''"
        [categoryId]="ol.categoryId"
        [supplierId]="ol.supplierId"
        (added)="onOptionsAdded()"
        (cancel)="optionsLine.set(null)" />
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
  // The project_items ROW id — the only stable key across all lines
  // (custom lines have no catalogue itemId — pV2-CUSTOMS-01 / audit H-1).
  protected readonly selectedItemId = signal<string | null>(null);
  protected readonly selectedLine = computed(
    () => this.rows().find((l) => l.id === this.selectedItemId()) ?? null
  );
  /** The selected line's picked options — listed in the right-rail item card. */
  protected readonly selectedOptions = computed(() => {
    const id = this.selectedItemId();
    return id ? this.optionsFor(id) : [];
  });
  protected selectLine(l: QuoteLine): void {
    this.selectedItemId.set(l.id);
  }

  // ── pV2-BUILDUP-03 — the Options picker (an item's options → quote lines) ──
  protected readonly optionsLine = signal<QuoteLine | null>(null);
  protected onOptionsAdded(): void {
    this.optionsLine.set(null);
    this.lines.reload();
    this.est.reload();
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
  protected async onQtyChange(lineId: string, quantity: number): Promise<void> {
    const before = this.rows();
    this.rows.update((ls) => ls.map((l) => (l.id === lineId ? { ...l, quantity } : l)));
    try {
      await firstValueFrom(this.projects.setQuoteItemQuantity(this.projectId(), lineId, quantity));
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
    this.rows.update((ls) => ls.filter((x) => x.id !== l.id));
    try {
      await firstValueFrom(this.projects.removeQuoteItem(this.projectId(), l.id));
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

  // ── pV2-BUILDUP-03 — picked options nest UNDER their parent line ──────────
  // Option lines (option_of_line_id set) are real, counted, on-PDF lines, but
  // they render as indented sub-rows beneath their parent — never as their own
  // top-level row. Split them out here, indexed by parent line id.
  protected readonly optionsByParent = computed(() => {
    const m = new Map<string, QuoteLine[]>();
    for (const l of this.visibleRows()) {
      if (!l.optionOfLineId) continue;
      const arr = m.get(l.optionOfLineId);
      if (arr) arr.push(l);
      else m.set(l.optionOfLineId, [l]);
    }
    return m;
  });
  protected optionsFor(lineId: string): QuoteLine[] {
    return this.optionsByParent().get(lineId) ?? [];
  }
  /** Line total for a single line (qty-weighted) — template helper. */
  protected optCost(l: QuoteLine): number {
    return lineCost(l);
  }
  /** Top-level rows only (options are nested under their parent, not listed). */
  protected readonly topRows = computed(() => this.visibleRows().filter((l) => !l.optionOfLineId));

  protected readonly groups = computed(() =>
    groupByCategory(this.topRows()).map((g) => ({
      ...g,
      // Declined/cancelled lines still show in the list but are excluded from
      // the category total (matches the server subtotal — pV2-INBOX-05). Each
      // line's picked options roll into its category total too (they're counted
      // server-side, so the cards must sum to the banner).
      total: g.items.reduce(
        (s, l) => s + (isDeclined(l) ? 0 : lineCost(l))
          + this.optionsFor(l.id).reduce((s2, o) => s2 + (isDeclined(o) ? 0 : lineCost(o)), 0),
        0,
      ),
      iconName: g.items[0]?.categoryIconName ?? null,
      // Expanded list: items grouped under a thin supplier band.
      supplierGroups: bySupplier(g.items),
    }))
  );

  // Track COLLAPSED categories (not expanded) so the default — and every new
  // category, and the state after a navigate-away-and-back — is EXPANDED. This
  // keeps each category's "Add Your Own Line Item" button visible instead of
  // vanishing when the component re-creates collapsed.
  protected readonly collapsed = signal<ReadonlySet<string>>(new Set());
  protected isOpen(catId: string): boolean {
    return !this.collapsed().has(catId);
  }
  protected toggle(catId: string): void {
    this.collapsed.update((set) => {
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
    this.rows.update((ls) => ls.map((x) => (x.id === l.id ? { ...x, installed: next } : x)));
    try {
      await firstValueFrom(this.projects.setQuoteItemInstalled(this.projectId(), l.id, next));
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
  protected readonly adding = signal(false);
  protected readonly savingCustom = signal(false);
  /** The category whose dashed button was clicked — seeds the dialog. */
  protected readonly pendingCategoryId = signal<string | null>(null);
  protected readonly pendingCategoryName = signal<string>('');
  protected readonly pendingCategoryIcon = signal<string | null>(null);
  /** pV2-BUILDUP-01 (UI1): the pending category's suppliers — seed the dialog's
   *  supplier context (auto-selected when there's exactly one). */
  protected readonly pendingSuppliers = signal<LineSupplier[]>([]);
  /** Which dialog flow: 'new' (agent custom lines) or 'explore' (browse a
   *  supplier's catalogue from a selected line). */
  protected readonly dialogVariant = signal<'new' | 'explore'>('new');
  /** Explore: the supplier+category lines already in the quote (pre-loaded so
   *  the dialog reflects current state; reconciled on submit). */
  protected readonly pendingExisting = signal<ExistingPick[]>([]);

  /** Banner headline: the server client total. Custom lines are real
   *  project_items now (pV2-CUSTOMS-01), already in the cascade. */
  protected readonly bannerTotal = computed(() => this.bd().clientTotal);

  /** Open the add-custom modal, seeded with the category whose dashed button
   *  was clicked (the dialog owns the form). */
  /** "Add Your Own Line Item" → the NEW flow: agent-owned custom lines, no
   *  supplier, no browse rail (Form/Grid only). */
  protected openAdd(group?: { id: string; name: string; iconName?: string | null }): void {
    this.dialogVariant.set('new');
    this.pendingCategoryId.set(group?.id ?? null);
    this.pendingCategoryName.set(group?.name ?? '');
    this.pendingCategoryIcon.set(group?.iconName ?? null);
    this.pendingSuppliers.set([]);
    this.adding.set(true);
  }

  /** "Explore More" on a selected line's preview → the EXPLORE flow: browse
   *  that line's supplier's catalogue (grid-only + rail, supplier fixed). */
  protected onExploreMore(): void {
    const l = this.selectedLine();
    if (!l?.supplierId) return;
    this.dialogVariant.set('explore');
    this.pendingCategoryId.set(l.categoryId);
    this.pendingCategoryName.set(l.categoryName ?? '');
    this.pendingCategoryIcon.set(l.categoryIconName ?? null);
    this.pendingSuppliers.set([{ id: l.supplierId, name: l.supplierName ?? null }]);
    // Pre-load the picks with this supplier+category's existing catalogue lines
    // that are still EDITABLE (status = to_send). Sent/locked lines are managed
    // in the inbox — staging them would make the reconcile issue remove/qty on
    // locked rows (server 409) and partially apply (audit MED-2). `editable`
    // is the one-place predicate (RP-11).
    this.pendingExisting.set(
      this.rows()
        .filter((q) => q.supplierId === l.supplierId && q.categoryId === l.categoryId && !!q.itemId && editable(q))
        .map((q) => ({
          lineId: q.id, itemId: q.itemId, name: q.name ?? '', cost: q.basePrice,
          quantity: q.quantity, categoryName: q.categoryName, subcategoryName: null,
        }))
    );
    this.adding.set(true);
  }
  /** Persist the custom line (pV2-CUSTOMS-01) — it becomes a real cart line
   *  that rides along in the category's brief. Reload so it renders like any
   *  line (with a "Custom" tag; no supplier until one quotes it). */
  protected async addCustom(lines: CustomLine[]): Promise<void> {
    const explore = this.dialogVariant() === 'explore';
    if (this.savingCustom() || (!explore && !lines.length)) return;
    this.savingCustom.set(true);
    try {
      if (explore) {
        // Reconcile the supplier+category slice against the pre-loaded state:
        // add fresh picks, remove existing lines no longer present, update qty.
        const existing = this.pendingExisting();
        const kept = new Set(lines.filter((l) => l.lineId).map((l) => l.lineId));
        for (const e of existing) {
          if (!kept.has(e.lineId)) {
            await firstValueFrom(this.projects.removeQuoteItem(this.projectId(), e.lineId));
          }
        }
        const prevById = new Map(existing.map((e) => [e.lineId, e]));
        for (const l of lines) {
          if (l.lineId) {
            const prev = prevById.get(l.lineId);
            if (prev && prev.quantity !== l.quantity) {
              await firstValueFrom(this.projects.setQuoteItemQuantity(this.projectId(), l.lineId, l.quantity));
            }
          } else if (l.itemId) {
            await firstValueFrom(this.projects.addQuoteItem(this.projectId(), l.itemId));
          }
        }
      } else {
        // 'new' — additive: reference an item, else a custom agent-owned line.
        for (const line of lines) {
          if (line.itemId) {
            await firstValueFrom(this.projects.addQuoteItem(this.projectId(), line.itemId));
          } else {
            await firstValueFrom(this.projects.addCustomItem(this.projectId(), {
              categoryId: line.categoryId,
              name: line.description,
              description: line.notes || null,
              cost: line.cost,
              quantity: line.quantity,
              unit: line.unit,
              supplierOrgId: line.supplierOrgId,
            }));
          }
        }
      }
      this.adding.set(false);
      this.lines.reload();
      this.est.reload();
    } catch (err) {
      this.toast.add({ severity: 'error', summary: "Couldn't save the line(s) — please try again.", detail: errorDetail(err), life: 5000 });
    } finally {
      this.savingCustom.set(false);
    }
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
