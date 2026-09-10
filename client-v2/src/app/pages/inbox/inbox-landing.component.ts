import { ChangeDetectionStrategy, Component, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { InboxService, InboxSummaryRow, InboxSummarySupplier, InboxWaitingCounts } from '../../core/inbox/inbox.service';
import { PageHeroComponent } from '../../shell/page-hero/page-hero.component';

/** pV2-INBOX (Messages landing) — /inbox for the agency: one card per active
 *  project it's negotiating, each listing its suppliers and a SINGLE project
 *  status pill. "Action Required" when the agent has ≥1 item to respond to;
 *  hovering the pill breaks down the waiting counts. Click → the project inbox.
 *  Layout follows the Past projects standard (bp-vpfit + centred 2-wide grid). */
@Component({
  selector: 'app-inbox-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideAngularModule, PageHeroComponent],
  host: { class: 'block bp-vpfit' },
  template: `
    <app-page-hero
      align="block"
      eyebrow="Messages"
      title="Your conversations"
      subtitle="Projects you're negotiating with suppliers."
    />

    <div class="bp-page-body">
      <div class="min-h-0 overflow-y-auto md:flex-1">
        @if (rows.isLoading()) {
          <p class="bp-body-small text-secondary">Loading…</p>
        } @else if (rows.error()) {
          <p class="bp-body-small text-warn">Couldn't load your messages.</p>
        } @else if ((rows.value() ?? []).length === 0) {
          <p class="bp-body-small text-secondary">No active conversations yet. Send a project out for quotes to start one.</p>
        } @else {
          <div class="mx-auto grid w-full max-w-[var(--workspace-max)] grid-cols-1 items-start gap-6 sm:grid-cols-2">
            @for (row of rows.value(); track row.id) {
              <a [routerLink]="['/projects', row.id]" [queryParams]="{ tab: 'inbox' }" class="bp-card bp-card--lifted block no-underline text-text" [attr.aria-label]="row.name">
                <div class="flex flex-col gap-3 p-5">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <div class="bp-card-title truncate">{{ row.name }}</div>
                      @if (row.clientName) {
                        <div class="bp-meta truncate">{{ row.clientName }}</div>
                      }
                    </div>
                    <span class="shrink-0 bp-pill bp-body-small min-w-[8rem] justify-center text-center" [class]="pillClass(row)" [title]="hoverText(row)">
                      {{ pillLabel(row) }}
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
                                          aria-label="Show last message"
                                          (click)="$event.preventDefault(); $event.stopPropagation()"
                                          (mouseenter)="showBubble($event, s)" (mouseleave)="hideBubble()">
                                    <lucide-icon name="mail" [size]="15" />
                                  </button>
                                }
                                <span class="bp-pill bp-body-small min-w-[8rem] justify-center text-center" [class]="pillClass(s)" [title]="hoverText(s)">
                                  {{ pillLabel(s, true) }}
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

  protected readonly rows = resource<InboxSummaryRow[], void>({
    loader: () => firstValueFrom(this.inbox.summary()),
  });

  /** Which project cards have their supplier list expanded. */
  private readonly expanded = signal(new Set<string>());
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

  /** One pill for a project OR a supplier. Action Required wins; else waiting
   *  on the supplier(s); else everything settled. Shared so the project pill
   *  and each supplier pill read identically. */
  protected pillLabel(c: InboxWaitingCounts, supplier = false): string {
    if (c.actionRequired) return 'Action Required';
    if (c.waitingSupplier > 0) return supplier ? 'Awaiting supplier' : 'Awaiting suppliers';
    return 'All confirmed';
  }

  protected pillClass(c: InboxWaitingCounts): string {
    if (c.actionRequired) return 'bp-pill--danger';
    if (c.waitingSupplier > 0) return 'bp-pill--outline';
    return 'bp-pill--success';
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
