import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { InboxService, InboxSummaryRow, InboxSummarySupplier, InboxWaitingCounts, SupplierInboxProject, SupplierInboxLineItem } from '../../core/inbox/inbox.service';
import { PageHeroComponent } from '../../shell/page-hero/page-hero.component';
import { StatusPillComponent } from '../../shared/status-pill/status-pill.component';
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
  imports: [RouterLink, LucideAngularModule, PageHeroComponent, StatusPillComponent],
  // Flowing page (standard): whole page scrolls at the window edge under the fixed
  // nav; the hero scrolls with the content (Liam 2026-10-30).
  host: { class: 'block' },
  template: `
    <app-page-hero
      align="block"
      eyebrow="Inbox"
      title="Your conversations"
      subtitle="Latest producer enquiries"
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
          <!-- Group-by filter (agent): one row per project (default) or per supplier. -->
          <div class="mx-auto mb-4 flex w-full max-w-[var(--workspace-max)] items-center justify-end gap-2">
            <span class="bp-meta">Group by</span>
            <div class="inline-flex rounded-full border border-hairline bg-fill p-0.5 text-sm">
              <button type="button" class="rounded-full px-3 py-1 transition-colors"
                      [class.bg-surface]="agentView() === 'project'" [class.font-semibold]="agentView() === 'project'"
                      [class.text-text]="agentView() === 'project'" [class.text-secondary]="agentView() !== 'project'"
                      (click)="agentView.set('project')">Project</button>
              <button type="button" class="rounded-full px-3 py-1 transition-colors"
                      [class.bg-surface]="agentView() === 'supplier'" [class.font-semibold]="agentView() === 'supplier'"
                      [class.text-text]="agentView() === 'supplier'" [class.text-secondary]="agentView() !== 'supplier'"
                      (click)="agentView.set('supplier')">Supplier</button>
            </div>
          </div>

          <!-- Full-width rows — the SAME card as the supplier side (Liam 2026-11-02):
               date circle + action indicator · name over sub-line · cost + rollup status. -->
          <div class="mx-auto flex w-full max-w-[var(--workspace-max)] flex-col gap-3">
            @if (agentView() === 'project') {
              @for (row of rows.value(); track row.id) {
                <a [routerLink]="['/projects', row.id]" [queryParams]="{ tab: 'inbox' }" class="bp-card bp-card--lifted block no-underline text-text" [attr.aria-label]="row.name">
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
                      <div class="bp-card-title truncate">{{ row.name }}</div>
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
              <!-- One row per supplier (flattened across projects). -->
              @for (r of supplierRows(); track r.key) {
                <a [routerLink]="['/projects', r.projectId]" [queryParams]="{ tab: 'inbox' }" class="bp-card bp-card--lifted block no-underline text-text" [attr.aria-label]="r.supplier.name">
                  <div class="flex items-center gap-3 p-5">
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
                      <!-- Grouped by supplier → project is the headline; sub-line is
                           'supplier · item · item' (that supplier's items) — Liam 2026-11-02. -->
                      <div class="bp-card-title truncate">{{ r.projectName }}</div>
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
    const out: { key: string; projectId: string; projectName: string; clientName: string | null; supplier: InboxSummarySupplier }[] = [];
    for (const row of this.rows.value() ?? []) {
      for (const s of row.suppliers) {
        out.push({ key: `${row.id}|${s.name}`, projectId: row.id, projectName: row.name, clientName: row.clientName, supplier: s });
      }
    }
    return out;
  });

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
