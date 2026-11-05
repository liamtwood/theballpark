import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { InboxService, InboxSummaryRow, InboxSummarySupplier, InboxWaitingCounts, SupplierInboxProject, SupplierInboxLineItem } from '../../core/inbox/inbox.service';
import { PageHeroComponent } from '../../shell/page-hero/page-hero.component';
import { PageConfigService } from '../../core/config/page-config.service';
import { StatusPillComponent } from '../../shared/status-pill/status-pill.component';
import { CatalogueSearchComponent } from '../../shared/catalogue/catalogue-search.component';
import { TabBandComponent, TabBandTab } from '../../shared/tab-band/tab-band.component';
import { supplierSummaryCode, lineDisplayCode, needsYou } from '../../core/status/line-display-status';
import { lastActivity } from './inbox-status';

/** pV2-INBOX (Messages landing) — /inbox. Persona-aware:
 *  - AGENCY: one card per active project it's negotiating, each listing its
 *    suppliers + a SINGLE project status pill (Action Required / Awaiting /
 *    All confirmed); hovering the pill breaks down the waiting counts.
 *  - SUPPLIER: the quote-request projects an agency has reached out about
 *    (the SAME shared ProjectCard the supplier Projects hub uses), each
 *    drilling into that project's conversation (/inbox/:projectId).
 *  The agency /summary endpoint returns [] to suppliers by design, so the
 *  supplier branch loads the gated supplier feed instead.
 *  Layout follows the Past projects standard (bp-vpfit + centred 2-wide grid). */
@Component({
  selector: 'app-inbox-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideAngularModule, PageHeroComponent, StatusPillComponent, CatalogueSearchComponent, TabBandComponent],
  // Flowing page (standard): whole page scrolls at the window edge under the fixed
  // nav; the hero scrolls with the content (Liam 2026-10-30).
  host: { class: 'block' },
  template: `
    <app-page-hero
      align="block"
      [eyebrow]="hero().eyebrow"
      [title]="hero().title"
      [subtitle]="hero().subtitle"
    />

    <div class="bp-page-body">
      <div class="min-h-0 overflow-y-auto md:flex-1">
        @if (isSupplier()) {
          @if (supplierSummary.isLoading()) {
            <p class="bp-body-small text-secondary">Loading…</p>
          } @else if (supplierSummary.error()) {
            <p class="bp-body-small text-warn">Couldn't load your conversations.</p>
          } @else if ((supplierSummary.value() ?? []).length === 0) {
            <p class="bp-body-small text-secondary">No conversations yet — an agency will reach out here.</p>
          } @else {
            <!-- Supplier landing: same card shape as the agent, but ITEMS (name /
                 status / cost) instead of suppliers; the project pill is the
                 supplier-perspective rollup (Liam 2026-10-30). -->
            <!-- Full-width rows: each card fills the container (the row-style card
                 reads better stretched than 2-up) — Liam 2026-10-31. -->
            <div class="mx-auto flex w-full max-w-[var(--workspace-max)] flex-col gap-3">
              @for (proj of supplierSummary.value(); track proj.projectId) {
                <!-- Whole card → the project inbox (all items in detail). No expand;
                     the top line carries "name · N items" (Liam 2026-10-31). -->
                <a [routerLink]="['/inbox', proj.projectId]" class="bp-card bp-card--lifted block no-underline text-text" [attr.aria-label]="proj.projectName">
                  <!-- Date circle (left, centred vertically) · project name + supplier
                       name with its item names (·-joined) · cost + status (Liam 2026-10-31). -->
                  <div class="flex items-center gap-3 p-5">
                    <!-- Unactioned (your move) → dark-pink filled circle; otherwise the
                         hairline circle with a corner tick = your side is handled (Liam 2026-10-31). -->
                    <div class="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-hairline bg-fill px-1 text-center"
                         [style.background]="isUnactioned(proj) ? 'var(--theme-accent)' : null"
                         [style.border-color]="isUnactioned(proj) ? 'transparent' : null">
                      <span class="bp-meta leading-tight" [style.color]="isUnactioned(proj) ? 'var(--bp-text-on-gradient)' : null">{{ lastActivity(proj.lastMessageAt) }}</span>
                      @if (!isUnactioned(proj)) {
                        <span class="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-hairline bg-surface text-[var(--color-state-emerald)]">
                          <lucide-icon name="check" [size]="12" [strokeWidth]="3" />
                        </span>
                      }
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="bp-card-title truncate">{{ proj.projectName }}</div>
                      <!-- Supplier (semi-bold) then item names (·-joined), a touch bigger.
                           Hover reveals the per-item mini table (Liam 2026-10-31). -->
                      <div class="truncate text-sm text-secondary"
                           (mouseenter)="showItems($event, proj)" (mouseleave)="hideItems()">
                        @if (proj.agencyName) {
                          <span class="font-semibold text-text">{{ proj.agencyName }}</span>
                        }
                        @if (proj.items.length) {
                          <span>{{ (proj.agencyName ? ' · ' : '') + itemsJoined(proj) }}</span>
                        }
                      </div>
                    </div>
                    <span class="flex shrink-0 items-center gap-2">
                      <span class="text-base font-semibold leading-none text-text">{{ money(proj.confirmedWork) }}</span>
                      <app-status-pill list="supplier_self_status" [code]="proj.status" />
                    </span>
                  </div>
                </a>
              }
            </div>
          }
        } @else {
        @if (rows.isLoading()) {
          <p class="bp-body-small text-secondary">Loading…</p>
        } @else if (rows.error()) {
          <p class="bp-body-small text-warn">Couldn't load your messages.</p>
        } @else if ((rows.value() ?? []).length === 0) {
          <p class="bp-body-small text-secondary">No active conversations yet. Send a project out for quotes to start one.</p>
        } @else {
          <!-- Controls (marketplace pattern, Liam 2026-11-04): a prominent search +
               a funnel icon. Group by and the full-thread-dialog demo toggle live
               behind the funnel, off the always-on bar. -->
          <div class="mx-auto mb-3 flex w-full max-w-[var(--workspace-max)] items-center gap-3">
            <div class="min-w-0 flex-1">
              <app-catalogue-search [large]="true" [value]="search()" [count]="filteredCount()" (valueChange)="search.set($event)" />
            </div>
            <div class="inline-flex items-center rounded-[var(--radius-pill)] border border-hairline bg-surface p-1">
              <button type="button" class="bp-viewtoggle" [class.bp-viewtoggle--active]="filtersOpen()"
                      aria-label="Filter options" aria-controls="inbox-filters"
                      [attr.aria-expanded]="filtersOpen()" (click)="filtersOpen.set(!filtersOpen())">
                <lucide-icon name="funnel-plus" [size]="15" aria-hidden="true" />
              </button>
            </div>
          </div>
          @if (filtersOpen()) {
            <div id="inbox-filters" class="mx-auto mb-4 flex w-full max-w-[var(--workspace-max)] flex-wrap items-end gap-x-10 gap-y-3">
              <div>
                <span class="bp-field-label mb-1.5 block font-bold text-text">Group by</span>
                <app-tab-band [tabs]="groupTabs" [active]="agentView()" [compact]="true" (activeChange)="agentView.set($event === 'supplier' ? 'supplier' : 'project')" />
              </div>
              <!-- Mirror the Group by column (invisible label spacer + a 38px control
                   box = the compact tab-band height) so the checkbox centres against
                   the Project/Supplier band, not the taller label+band block. -->
              <div class="flex flex-col">
                <span class="bp-field-label invisible mb-1.5 block" aria-hidden="true">Group by</span>
                <label class="flex h-[38px] cursor-pointer items-center gap-2 bp-body-small text-text">
                  <input type="checkbox" class="h-4 w-4 cursor-pointer accent-[var(--theme-accent)]"
                         [checked]="unreadOnly()" (change)="onUnreadChange($event)" />
                  Unread
                </label>
              </div>
            </div>
          }

          <!-- Full-width rows — the SAME card as the supplier side (Liam 2026-11-02):
               date circle + action indicator · name over sub-line · cost + rollup status. -->
          <div class="mx-auto flex w-full max-w-[var(--workspace-max)] flex-col gap-3">
            @if (agentView() === 'project') {
              @if (filteredRows().length === 0) {
                <p class="bp-body-small text-secondary">No projects match "{{ search() }}".</p>
              }
              @for (row of filteredRows(); track row.id) {
                <a [routerLink]="['/inbox', row.ref ?? row.id]" class="bp-card bp-card--lifted block no-underline text-text" [attr.aria-label]="row.name">
                  <div class="flex items-center gap-3 p-5">
                    <div class="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-hairline bg-fill px-1 text-center"
                         [style.background]="row.actionRequired ? 'var(--theme-accent)' : null"
                         [style.border-color]="row.actionRequired ? 'transparent' : null">
                      <span class="bp-meta leading-tight" [style.color]="row.actionRequired ? 'var(--bp-text-on-gradient)' : null">{{ lastActivity(agentLastMessage(row)) }}</span>
                      @if (!row.actionRequired) {
                        <span class="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-hairline bg-surface text-[var(--color-state-emerald)]">
                          <lucide-icon name="check" [size]="12" [strokeWidth]="3" />
                        </span>
                      }
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="bp-card-title truncate">{{ row.name }}<span class="font-normal text-secondary"> · {{ row.itemNames.length }} item{{ row.itemNames.length === 1 ? '' : 's' }}</span></div>
                      <!-- Summary count 'X items for Y suppliers'; the suppliers live in
                           the hover mini-table (Liam 2026-11-02). -->
                      <div class="truncate text-sm text-secondary"
                           (mouseenter)="showSuppliers($event, row)" (mouseleave)="hideSuppliers()">
                        @if (row.suppliers.length) {
                          {{ projectSummaryLine(row) }}
                        } @else {
                          No suppliers yet
                        }
                      </div>
                    </div>
                    <span class="flex shrink-0 items-center gap-2" [title]="hoverText(row)">
                      <span class="text-base font-semibold leading-none text-text">{{ money(row.confirmedWork) }}</span>
                      <app-status-pill list="supplier_summary_status" [code]="summaryCode(row)" />
                    </span>
                  </div>
                </a>
              }
            } @else {
              <!-- Grouped by supplier: a collapsible banner per supplier (+ toggle)
                   with its project cards grouped underneath (Liam 2026-11-04). -->
              @if (supplierGroups().length === 0) {
                <p class="bp-body-small text-secondary">No suppliers match "{{ search() }}".</p>
              }
              @for (g of supplierGroups(); track g.orgId) {
                <div class="overflow-hidden rounded-[var(--radius-card)] bp-card bp-card--lifted px-4">
                <button type="button" class="flex w-full items-center gap-3 py-4 text-left"
                        [attr.aria-expanded]="isSupplierOpen(g.orgId)" [attr.aria-label]="'Toggle ' + g.name"
                        (click)="toggleSupplier(g.orgId)">
                  <!-- Supplier's aggregate date circle: newest activity across their
                       projects + tick / action-pink, same chrome as the cards. -->
                  <div class="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-hairline bg-fill px-1 text-center"
                       [style.background]="g.actionRequired ? 'var(--theme-accent)' : null"
                       [style.border-color]="g.actionRequired ? 'transparent' : null">
                    <span class="bp-meta leading-tight" [style.color]="g.actionRequired ? 'var(--bp-text-on-gradient)' : null">{{ lastActivity(g.lastMessageAt) }}</span>
                    @if (!g.actionRequired) {
                      <span class="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-hairline bg-surface text-[var(--color-state-emerald)]">
                        <lucide-icon name="check" [size]="12" [strokeWidth]="3" />
                      </span>
                    }
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="bp-list-title truncate" style="font-size: var(--text-xl)">{{ g.name }}<span class="font-normal text-secondary"> · {{ g.rows.length }} project{{ g.rows.length === 1 ? '' : 's' }}</span></div>
                    <div class="truncate text-sm text-secondary">{{ projectNames(g) }}</div>
                  </div>
                  <span class="flex shrink-0 items-center gap-2" [title]="hoverText(g)">
                    <span class="text-base font-semibold leading-none text-text">{{ money(g.confirmedWork) }}</span>
                    <app-status-pill list="supplier_summary_status" [code]="summaryCode(g)" />
                  </span>
                  <lucide-icon [name]="isSupplierOpen(g.orgId) ? 'chevron-down' : 'chevron-right'" [size]="18" class="shrink-0 text-muted" aria-hidden="true" />
                </button>
                  @if (isSupplierOpen(g.orgId)) {
                    @for (r of g.rows; track r.key) {
                      <!-- Nested project row (indented) inside the supplier card —
                           Running budget surround (Liam 2026-11-04). -->
                      <a [routerLink]="['/inbox', r.projectRef ?? r.projectId]" [queryParams]="{ supplier: r.supplier.orgId }" class="block border-t border-hairline no-underline text-text transition-colors hover:bg-fill" [attr.aria-label]="r.supplier.name">
                        <div class="flex items-center gap-3 py-3 pl-4">
                          <div class="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-hairline bg-fill px-1 text-center"
                               [style.background]="r.supplier.actionRequired ? 'var(--theme-accent)' : null"
                               [style.border-color]="r.supplier.actionRequired ? 'transparent' : null">
                            <span class="bp-meta leading-tight" [style.color]="r.supplier.actionRequired ? 'var(--bp-text-on-gradient)' : null">{{ lastActivity(r.supplier.lastMessageAt) }}</span>
                            @if (!r.supplier.actionRequired) {
                              <span class="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-hairline bg-surface text-[var(--color-state-emerald)]">
                                <lucide-icon name="check" [size]="12" [strokeWidth]="3" />
                              </span>
                            }
                          </div>
                          <div class="min-w-0 flex-1">
                            <!-- Project headline + this supplier's item count; sub-line
                                 is 'supplier · item · item' (Liam 2026-11-04). -->
                            <div class="bp-list-title truncate">{{ r.projectName }}<span class="font-normal text-secondary"> · {{ r.supplier.itemNames.length }} item{{ r.supplier.itemNames.length === 1 ? '' : 's' }}</span></div>
                            <div class="truncate text-sm text-secondary">
                              <span class="font-semibold text-text">{{ r.supplier.name }}</span>
                              @if (r.supplier.itemNames.length) {
                                <span>{{ ' · ' + r.supplier.itemNames.join(' · ') }}</span>
                              }
                            </div>
                          </div>
                          <span class="flex shrink-0 items-center gap-2" [title]="hoverText(r.supplier)">
                            <span class="text-base font-semibold leading-none text-text">{{ money(r.supplier.confirmedWork) }}</span>
                            <app-status-pill list="supplier_summary_status" [code]="summaryCode(r.supplier)" />
                          </span>
                        </div>
                      </a>
                    }
                  }
                </div>
              }
            }
          </div>
        }
        }
      </div>
    </div>

    <!-- Agent card hover: the per-supplier mini table (name · status · items · date). -->
    @if (suppliersBubble(); as sb) {
      <div class="fixed z-50 w-[460px] max-w-[92vw] rounded-2xl border border-hairline bg-surface p-3 shadow-lg"
           [style.left.px]="sb.x" [style.top.px]="sb.y">
        <div class="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-x-4 gap-y-2">
          @for (s of sb.suppliers; track s.name) {
            <span class="min-w-0 truncate bp-body-small text-text">{{ s.name }}</span>
            <span [title]="hoverText(s)"><app-status-pill list="supplier_summary_status" [code]="summaryCode(s)" /></span>
            <span class="bp-body-small text-right text-secondary">{{ s.itemCount }} item{{ s.itemCount === 1 ? '' : 's' }}</span>
            <span class="bp-meta text-right">{{ lastActivity(s.lastMessageAt) }}</span>
            <span class="w-4 text-right text-[var(--color-state-emerald)]">
              @if (!s.actionRequired) {
                <lucide-icon name="check" [size]="13" [strokeWidth]="3" />
              }
            </span>
          }
        </div>
      </div>
    }

    <!-- Supplier card hover: the per-item mini table (name · status · cost · date).
         Fixed so the card's overflow can't clip it (Liam 2026-10-31). -->
    @if (itemsBubble(); as ib) {
      <div class="fixed z-50 w-[460px] max-w-[92vw] rounded-2xl border border-hairline bg-surface p-3 shadow-lg"
           [style.left.px]="ib.x" [style.top.px]="ib.y">
        <div class="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-x-4 gap-y-2">
          @for (it of ib.items; track it.itemId) {
            <span class="min-w-0 truncate bp-body-small text-text">{{ it.name }}</span>
            <!-- No [strong] here: the tick column carries the turn signal, so the
                 pills stay uniform with the summary pill's weight (Liam 2026-10-31). -->
            <app-status-pill list="line_display_status" [code]="itemPill(it)" />
            <span class="bp-body-small text-right text-secondary">{{ it.price != null ? money(it.price) : '—' }}</span>
            <span class="bp-meta text-right">{{ lastActivity(it.lastMessageAt) }}</span>
            <!-- Tick when the item is actioned (not the supplier's turn) — Liam 2026-10-31. -->
            <span class="w-4 text-right text-[var(--color-state-emerald)]">
              @if (!itemNeedsYou(it)) {
                <lucide-icon name="check" [size]="13" [strokeWidth]="3" />
              }
            </span>
          }
        </div>
      </div>
    }
  `,
})
export class InboxLandingComponent {
  private readonly inbox = inject(InboxService);
  private readonly auth = inject(AuthService);
  private readonly pageConfig = inject(PageConfigService);

  /** Admin-configurable hero (Settings ▸ Pages ▸ Inbox) — workspace eyebrow,
   *  "Inbox" title, per-org-type subtitle (Liam 2026-11-02). */
  protected readonly hero = computed(() => this.pageConfig.pageHero('inbox'));

  /** Suppliers get their quote-request conversations (the gated supplier feed +
   *  the shared ProjectCard), not the agency /summary rollup. */
  protected readonly isSupplier = computed(() => this.auth.user()?.activeOrgType === 'supplier');


  /** Supplier Messages landing — one card per engaged project with its line items
   *  (agent landing shape, items instead of suppliers). Suppliers only. */
  protected readonly supplierSummary = resource<SupplierInboxProject[], boolean>({
    params: () => this.isSupplier(),
    loader: ({ params: supplier }) =>
      supplier ? firstValueFrom(this.inbox.supplierInboxSummary()) : Promise.resolve([]),
  });

  /** Card "last activity" stamp (today → time, this week → day, older → dd-MMM). */
  protected readonly lastActivity = lastActivity;

  /** The supplier's own turn on this project — the card's "unactioned" state
   *  (dark-pink date circle). Otherwise the move is with the agency / all confirmed
   *  (hairline circle + tick). */
  protected isUnactioned(proj: SupplierInboxProject): boolean {
    return proj.status === 'action_required';
  }

  /** The project's item names joined by " · " (the supplier line's tail, after the
   *  agency name). Truncated to one line in the template. */
  protected itemsJoined(proj: SupplierInboxProject): string {
    return proj.items.map((i) => i.name).join(' · ');
  }

  // ── Supplier card hover: per-item mini table (name · status · cost · date) ──
  protected readonly itemsBubble = signal<{ items: SupplierInboxLineItem[]; x: number; y: number } | null>(null);
  protected showItems(ev: MouseEvent, proj: SupplierInboxProject): void {
    if (!proj.items.length) return;
    const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.max(8, Math.min(r.left, window.innerWidth - 468));
    this.itemsBubble.set({ items: proj.items, x, y: r.bottom + 6 });
  }
  protected hideItems(): void {
    this.itemsBubble.set(null);
  }
  /** Per-item line_display_status code + bold turn, from the supplier's side. */
  protected itemPill(it: SupplierInboxLineItem): string {
    return lineDisplayCode(this.itemStatusInput(it), 'seller');
  }
  protected itemNeedsYou(it: SupplierInboxLineItem): boolean {
    return needsYou(this.itemStatusInput(it), 'seller');
  }
  private itemStatusInput(it: SupplierInboxLineItem) {
    return {
      status: it.status,
      buyerAccepted: it.buyerAccepted,
      sellerAccepted: it.sellerAccepted,
      lastMessageBy: it.lastMessageBy,
      lastEventIsMessage: it.lastEventIsMessage,
      supplierEngaged: it.supplierEngaged,
    };
  }

  protected money(value: number): string {
    try {
      return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value);
    } catch {
      return `£${value}`;
    }
  }

  /** Agency Messages rollup — only hits the network for the agency (the
   *  /summary endpoint returns [] to suppliers anyway; skip the call). */
  protected readonly rows = resource<InboxSummaryRow[], boolean>({
    params: () => !this.isSupplier(),
    loader: ({ params: agency }) =>
      agency ? firstValueFrom(this.inbox.summary()) : Promise.resolve([]),
  });

  /** Agent landing grouping: one card per project (default) or per supplier. */
  protected readonly agentView = signal<'project' | 'supplier'>('project');
  /** The project rows flattened to one entry per (project × supplier) for the
   *  "by supplier" view. */
  protected readonly supplierRows = computed(() => {
    const out: { key: string; projectId: string; projectRef: string | null; projectName: string; clientName: string | null; supplier: InboxSummarySupplier }[] = [];
    for (const row of this.rows.value() ?? []) {
      for (const s of row.suppliers) {
        out.push({ key: `${row.id}|${s.name}`, projectId: row.id, projectRef: row.ref, projectName: row.name, clientName: row.clientName, supplier: s });
      }
    }
    return out;
  });

  // ── Controls: search + funnel filter (Group by) ──
  /** Live text filter over the cards (project / client / supplier / item names). */
  protected readonly search = signal('');
  /** The funnel panel (Group by) open state. */
  protected readonly filtersOpen = signal(false);
  /** "Unread" filter — no true read-state exists yet (read receipts are parked),
   *  so this means "needs your action" (actionRequired), the same signal the nav
   *  "Inbox (N)" badge counts. */
  protected readonly unreadOnly = signal(false);
  protected onUnreadChange(e: Event): void {
    this.unreadOnly.set((e.target as HTMLInputElement).checked);
  }
  private readonly q = computed(() => this.search().trim().toLowerCase());

  protected readonly groupTabs: TabBandTab[] = [
    { key: 'project', label: 'Project' },
    { key: 'supplier', label: 'Supplier' },
  ];

  /** Project cards filtered by the search text + the Unread (needs-you) filter. */
  protected readonly filteredRows = computed(() => {
    const q = this.q();
    const unread = this.unreadOnly();
    let rows = this.rows.value() ?? [];
    if (unread) rows = rows.filter((r) => r.actionRequired);
    if (!q) return rows;
    return rows.filter((r) =>
      (r.name?.toLowerCase().includes(q) ?? false)
      || (r.clientName?.toLowerCase().includes(q) ?? false)
      || r.suppliers.some((s) => s.name.toLowerCase().includes(q))
      || r.itemNames.some((n) => n.toLowerCase().includes(q))
    );
  });
  /** Supplier cards filtered by the search text + the Unread (needs-you) filter. */
  protected readonly filteredSupplierRows = computed(() => {
    const q = this.q();
    const unread = this.unreadOnly();
    let all = this.supplierRows();
    if (unread) all = all.filter((x) => x.supplier.actionRequired);
    if (!q) return all;
    return all.filter((x) =>
      x.projectName.toLowerCase().includes(q)
      || (x.clientName?.toLowerCase().includes(q) ?? false)
      || x.supplier.name.toLowerCase().includes(q)
      || x.supplier.itemNames.some((n) => n.toLowerCase().includes(q))
    );
  });
  /** The count shown in the search box — the current view's visible card count
   *  (supplier view shows one card per supplier GROUP, not per project×supplier). */
  protected readonly filteredCount = computed(() =>
    this.agentView() === 'project' ? this.filteredRows().length : this.supplierGroups().length
  );

  /** Supplier view, grouped: one collapsible section per supplier (consolidated
   *  across projects by org id), each holding that supplier's project cards. */
  protected readonly supplierGroups = computed(() => {
    const flat = this.filteredSupplierRows();
    // The group carries the same InboxWaitingCounts shape as a supplier row
    // (summed across its projects) so summaryCode/hoverText work on it directly.
    const groups: { orgId: string; name: string; rows: typeof flat; lastMessageAt: string | null;
                    itemCount: number; waitingAgent: number; waitingSupplier: number; actionRequired: boolean;
                    confirmedWork: number }[] = [];
    const index = new Map<string, number>();
    for (const r of flat) {
      let i = index.get(r.supplier.orgId);
      if (i === undefined) {
        i = groups.length;
        index.set(r.supplier.orgId, i);
        groups.push({ orgId: r.supplier.orgId, name: r.supplier.name, rows: [], lastMessageAt: null,
                      itemCount: 0, waitingAgent: 0, waitingSupplier: 0, actionRequired: false, confirmedWork: 0 });
      }
      const g = groups[i];
      g.rows.push(r);
      g.itemCount += r.supplier.itemCount;
      g.waitingAgent += r.supplier.waitingAgent;
      g.waitingSupplier += r.supplier.waitingSupplier;
      g.confirmedWork += r.supplier.confirmedWork;
      if (r.supplier.actionRequired) g.actionRequired = true;
      // Banner date circle: the supplier's newest activity across their projects.
      if (r.supplier.lastMessageAt && (!g.lastMessageAt || r.supplier.lastMessageAt > g.lastMessageAt)) {
        g.lastMessageAt = r.supplier.lastMessageAt;
      }
    }
    return groups;
  });
  /** Which supplier groups are expanded (collapsed by default — click the + to
   *  reveal that supplier's cards). */
  private readonly expandedSuppliers = signal<ReadonlySet<string>>(new Set());
  protected isSupplierOpen(orgId: string): boolean {
    return this.expandedSuppliers().has(orgId);
  }
  protected toggleSupplier(orgId: string): void {
    this.expandedSuppliers.update((s) => {
      const n = new Set(s);
      if (n.has(orgId)) n.delete(orgId); else n.add(orgId);
      return n;
    });
  }
  /** Supplier group sub-line: the project names joined by " · " (truncated in the
   *  template), mirroring the card's item sub-line. */
  protected projectNames(g: { rows: { projectName: string }[] }): string {
    return g.rows.map((r) => r.projectName).join(' · ');
  }

  // ── Agent card: date circle + per-supplier hover mini table ──
  /** The project's latest activity = the newest message across its suppliers —
   *  the date circle's stamp. */
  protected agentLastMessage(row: InboxSummaryRow): string | null {
    let max: string | null = null;
    for (const s of row.suppliers) {
      if (s.lastMessageAt && (!max || s.lastMessageAt > max)) max = s.lastMessageAt;
    }
    return max;
  }
  /** Project-view sub-line: "X items for Y suppliers". */
  protected projectSummaryLine(row: InboxSummaryRow): string {
    const items = row.itemNames.length;
    const sup = row.suppliers.length;
    return `${items} item${items === 1 ? '' : 's'} for ${sup} supplier${sup === 1 ? '' : 's'}`;
  }
  protected readonly suppliersBubble = signal<{ suppliers: InboxSummarySupplier[]; x: number; y: number } | null>(null);
  protected showSuppliers(ev: MouseEvent, row: InboxSummaryRow): void {
    if (!row.suppliers.length) return;
    const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.max(8, Math.min(r.left, window.innerWidth - 468));
    this.suppliersBubble.set({ suppliers: row.suppliers, x, y: r.bottom + 6 });
  }
  protected hideSuppliers(): void {
    this.suppliersBubble.set(null);
  }

  /** The per-supplier rollup code (Action Required wins; else awaiting; else all
   *  confirmed) — codelist-driven via supplier_summary_status, same as the Running
   *  budget supplier cards. */
  protected summaryCode(c: InboxWaitingCounts): string {
    return supplierSummaryCode(!!c.actionRequired, c.waitingSupplier > 0);
  }

  /** The count breakdown, shown as the pill's tooltip. */
  protected hoverText(c: InboxWaitingCounts): string {
    const items = `${c.itemCount} item${c.itemCount === 1 ? '' : 's'}`;
    return `${items} · ${c.waitingAgent} waiting on you, ${c.waitingSupplier} waiting on the supplier`;
  }

}
