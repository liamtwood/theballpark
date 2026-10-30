import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { InboxService, InboxSummaryRow, InboxSummarySupplier, InboxWaitingCounts, SupplierInboxProject, SupplierInboxLineItem } from '../../core/inbox/inbox.service';
import { PageHeroComponent } from '../../shell/page-hero/page-hero.component';
import { StatusPillComponent } from '../../shared/status-pill/status-pill.component';
import { supplierSummaryCode, lineDisplayCode } from '../../core/status/line-display-status';
import { InboxLandingStateService } from './inbox-landing-state.service';

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
      eyebrow="Messages"
      title="Your conversations"
      [subtitle]="heroSubtitle()"
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
            <div class="mx-auto grid w-full max-w-[var(--workspace-max)] grid-cols-1 items-start gap-6 sm:grid-cols-2">
              @for (proj of supplierSummary.value(); track proj.projectId) {
                <div class="bp-card bp-card--lifted">
                  <div class="flex flex-col gap-3 p-5">
                    <div class="flex items-start justify-between gap-3">
                      <a [routerLink]="['/inbox', proj.projectId]" class="min-w-0 no-underline text-text">
                        <div class="bp-card-title truncate">{{ proj.projectName }}</div>
                        @if (proj.agencyName) {
                          <div class="bp-meta truncate">{{ proj.agencyName }}</div>
                        }
                      </a>
                      <span class="shrink-0">
                        <app-status-pill list="supplier_self_status" [code]="proj.status" />
                      </span>
                    </div>

                    @if (proj.items.length) {
                      <div>
                        <button type="button" class="inline-flex items-center gap-1 bp-body-small text-secondary transition-colors hover:text-text"
                                (click)="toggle(proj.projectId, $event)">
                          <lucide-icon [name]="isOpen(proj.projectId) ? 'chevron-down' : 'chevron-right'" [size]="15" />
                          {{ isOpen(proj.projectId) ? 'Hide items' : 'Show items' }} ({{ proj.items.length }})
                        </button>
                        @if (isOpen(proj.projectId)) {
                          <div class="mt-1.5 flex flex-col gap-1.5 pl-5">
                            @for (it of proj.items; track it.itemId) {
                              <a [routerLink]="['/inbox', proj.projectId]" [queryParams]="{ item: it.itemId }"
                                 class="flex items-center justify-between gap-3 no-underline text-text hover:text-text">
                                <span class="min-w-0 truncate bp-body-small text-secondary">{{ it.name }}</span>
                                <span class="flex shrink-0 items-center gap-2">
                                  <app-status-pill list="line_display_status" [code]="itemPill(it)" />
                                  @if (it.price != null) { <span class="bp-caption">{{ money(it.price) }}</span> }
                                </span>
                              </a>
                            }
                          </div>
                        }
                      </div>
                    }
                  </div>
                </div>
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
          <div class="mx-auto grid w-full max-w-[var(--workspace-max)] grid-cols-1 items-start gap-6 sm:grid-cols-2">
            @for (row of rows.value(); track row.id) {
              <a [routerLink]="['/projects', row.id]" [queryParams]="{ tab: 'inbox', full: 1 }" class="bp-card bp-card--lifted block no-underline text-text" [attr.aria-label]="row.name">
                <div class="flex flex-col gap-3 p-5">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <div class="bp-card-title truncate">{{ row.name }}</div>
                      @if (row.clientName) {
                        <div class="bp-meta truncate">{{ row.clientName }}</div>
                      }
                    </div>
                    <span class="shrink-0" [title]="hoverText(row)">
                      <app-status-pill list="supplier_summary_status" [code]="summaryCode(row)" />
                    </span>
                  </div>

                  <!-- Suppliers on the project — collapsed behind a toggle. -->
                  @if (row.suppliers.length) {
                    <div>
                      <button type="button" class="inline-flex items-center gap-1 bp-body-small text-secondary transition-colors hover:text-text"
                              (click)="toggle(row.id, $event)">
                        <lucide-icon [name]="isOpen(row.id) ? 'chevron-down' : 'chevron-right'" [size]="15" />
                        {{ isOpen(row.id) ? 'Hide suppliers' : 'Show suppliers' }} ({{ row.suppliers.length }})
                      </button>
                      @if (isOpen(row.id)) {
                        <div class="mt-1.5 flex flex-col gap-1.5 pl-5">
                          @for (s of row.suppliers; track s.name) {
                            <div class="flex items-center justify-between gap-3">
                              <span class="min-w-0 truncate bp-body-small text-secondary">{{ s.name }}</span>
                              <span class="flex shrink-0 items-center gap-1.5">
                                @if (s.actionRequired && s.lastMessage) {
                                  <button type="button" class="text-[var(--theme-accent)] transition-opacity hover:opacity-70"
                                          aria-label="Open the item that needs your action"
                                          (click)="openItem($event, row.id, s)"
                                          (mouseenter)="showBubble($event, s)" (mouseleave)="hideBubble()">
                                    <lucide-icon name="mail" [size]="15" />
                                  </button>
                                }
                                <span [title]="hoverText(s)">
                                  <app-status-pill list="supplier_summary_status" [code]="summaryCode(s)" />
                                </span>
                              </span>
                            </div>
                          }
                        </div>
                      }
                    </div>
                  } @else {
                    <span class="bp-caption">No suppliers yet</span>
                  }
                </div>
              </a>
            }
          </div>
        }
        }
      </div>
    </div>

    <!-- Floating message bubble (position: fixed so the card's overflow can't
         clip it), shown while hovering a supplier's envelope: name · message ·
         time. -->
    @if (bubble(); as b) {
      <div class="fixed z-50 w-[320px] max-w-[90vw] rounded-2xl border border-hairline bg-fill px-3 py-3 shadow-lg"
           [style.left.px]="b.x" [style.top.px]="b.y">
        <div class="bp-caption mb-1.5 px-1 text-secondary">{{ b.name }}</div>
        <!-- The message in an inbox-style bubble (white on the tinted panel). -->
        <div class="bp-bubble" style="max-width: 100%">
          <span class="bp-bubble__body">{{ b.text }}</span>
        </div>
        @if (b.time) {
          <div class="bp-caption mt-1.5 px-1 text-muted">{{ b.time }}</div>
        }
      </div>
    }
  `,
})
export class InboxLandingComponent {
  private readonly inbox = inject(InboxService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  /** Suppliers get their quote-request conversations (the gated supplier feed +
   *  the shared ProjectCard), not the agency /summary rollup. */
  protected readonly isSupplier = computed(() => this.auth.user()?.activeOrgType === 'supplier');

  protected readonly heroSubtitle = computed(() =>
    this.isSupplier()
      ? 'Projects an agency has asked you to quote.'
      : "Projects you're negotiating with suppliers.",
  );

  /** Supplier Messages landing — one card per engaged project with its line items
   *  (agent landing shape, items instead of suppliers). Suppliers only. */
  protected readonly supplierSummary = resource<SupplierInboxProject[], boolean>({
    params: () => this.isSupplier(),
    loader: ({ params: supplier }) =>
      supplier ? firstValueFrom(this.inbox.supplierInboxSummary()) : Promise.resolve([]),
  });

  /** The per-item line_display_status pill code, from the supplier's side. */
  protected itemPill(it: SupplierInboxLineItem): string {
    return lineDisplayCode(
      { status: it.status, buyerAccepted: it.buyerAccepted, sellerAccepted: it.sellerAccepted },
      'seller',
    );
  }

  protected money(value: number): string {
    try {
      return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value);
    } catch {
      return `£${value}`;
    }
  }

  /** Envelope click → the project's Inbox tab, opening the picked conversation in
   *  full-thread mode (?full=1) so you land straight in the message, no rail
   *  (Liam 2026-10-29). "All messages" there goes back here. */
  protected openItem(ev: Event, projectId: string, s: InboxSummarySupplier): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.hideBubble();
    void this.router.navigate(['/projects', projectId], {
      queryParams: { tab: 'inbox', item: s.actionItemId, full: 1 },
    });
  }

  /** Agency Messages rollup — only hits the network for the agency (the
   *  /summary endpoint returns [] to suppliers anyway; skip the call). */
  protected readonly rows = resource<InboxSummaryRow[], boolean>({
    params: () => !this.isSupplier(),
    loader: ({ params: agency }) =>
      agency ? firstValueFrom(this.inbox.summary()) : Promise.resolve([]),
  });

  /** Which project cards have their supplier list expanded — held in a root
   *  service so it survives opening a conversation and coming back (Liam 2026-10-30). */
  private readonly expanded = inject(InboxLandingStateService).expanded;
  protected isOpen(id: string): boolean {
    return this.expanded().has(id);
  }
  /** Toggle a card's supplier list without following the card's link. */
  protected toggle(id: string, ev: Event): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.expanded.update((set) => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
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

  /** The floating message bubble shown when hovering a supplier's envelope:
   *  counterparty name + the last message + its time. */
  protected readonly bubble = signal<{ name: string; text: string; time: string; x: number; y: number } | null>(null);
  protected showBubble(ev: MouseEvent, s: InboxSummarySupplier): void {
    if (!s.lastMessage) return;
    const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    // Anchor below the envelope; keep it on-screen (bubble ~ 320px wide).
    const x = Math.max(8, Math.min(r.left, window.innerWidth - 332));
    this.bubble.set({ name: s.name, text: s.lastMessage, time: this.fmtTime(s.lastMessageAt), x, y: r.bottom + 8 });
  }
  protected hideBubble(): void {
    this.bubble.set(null);
  }

  /** Short time (today → "10:54 AM"; older → "5 Sep, 10:54 AM"). */
  private fmtTime(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const time = d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' });
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    return sameDay ? time : `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${time}`;
  }
}
