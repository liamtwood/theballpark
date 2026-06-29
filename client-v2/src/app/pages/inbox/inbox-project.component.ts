import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, linkedSignal, resource, signal, viewChild } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { PageConfigService } from '../../core/config/page-config.service';
import { PageHeroComponent } from '../../shell/page-hero/page-hero.component';
import { StatusPillComponent } from '../../shared/status-pill/status-pill.component';
import { InboxProjectSummary, InboxService, InboxThread, InboxThreadItem } from '../../core/inbox/inbox.service';

/** pV2-INBOX-01 — the supplier's per-project conversation surface
 *  (/inbox/:projectId). Left rail = THEIR items, grouped by category and
 *  collapsed to a flat list when there's only one (the single-category
 *  rule); right pane = the conversation with the reaching-out agency
 *  (counterparty · project · status · total header, gradient/white
 *  bubbles, compose). Read-only first — compose + per-item Accept/Propose
 *  land in the next slices. */
@Component({
  selector: 'app-inbox-project',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, DatePipe, LucideAngularModule, PageHeroComponent, StatusPillComponent],
  host: { class: 'block bp-vpfit' },
  template: `
    <app-page-hero [back]="{ label: 'Back', href: '/projects', history: true }" title="Inbox" [subtitle]="heroSubtitle()" />

    <div class="bp-page-body">
      @if (threadsRes.isLoading()) {
        <p class="bp-body-small text-secondary">Loading…</p>
      } @else if (threadsRes.error()) {
        <p class="bp-body-small text-warn">Couldn't load this conversation — please refresh.</p>
      } @else if (threads().length === 0) {
        <p class="bp-body-small text-secondary">No quote requests in this project yet.</p>
      } @else {
        <div class="grid min-h-0 flex-1 grid-cols-1 gap-6 xl:grid-cols-[300px_1fr]">
          <!-- Left rail: project context card + their items. -->
          <div class="hidden min-h-0 xl:flex xl:flex-col xl:gap-3 xl:overflow-y-auto">
            @if (project(); as p) {
              <div class="bp-card p-4">
                <h3 class="bp-list-title leading-snug">{{ p.clientName ? p.clientName + ' — ' : '' }}{{ p.name }}</h3>
                <div class="mt-2.5 flex items-center gap-1.5 text-secondary">
                  <lucide-icon name="calendar" [size]="14" [strokeWidth]="1.75" />
                  <span class="bp-body-small">{{ p.eventDate || 'Date TBC' }}</span>
                </div>
                <div class="mt-1.5 flex items-center gap-1.5 text-secondary">
                  <lucide-icon name="map-pin" [size]="14" [strokeWidth]="1.75" />
                  <span class="bp-body-small">{{ p.location || '—' }}</span>
                </div>
                <div class="mt-2 bp-meta">{{ p.agencyName }}</div>
              </div>
            }
            <!-- Always a tree header: the category name when there are
                 several, else "PROJECT ITEMS". Expand to reveal the items. -->
            @for (t of threads(); track t.id) {
              <button
                type="button"
                class="flex w-full items-center gap-1.5 px-2 pb-1 pt-3 text-left first:pt-1"
                (click)="toggle(t.id)"
              >
                <lucide-icon [name]="isExpanded(t.id) ? 'chevron-down' : 'chevron-right'" [size]="15" class="shrink-0 text-muted" />
                <span class="bp-field-label flex-1 uppercase tracking-wide">{{ headerLabel(t) }}</span>
                <span class="bp-meta">{{ t.items.length }}</span>
              </button>
              @if (isExpanded(t.id)) {
                @for (it of t.items; track it.id) {
                  <button
                    type="button"
                    class="flex w-full flex-col items-start gap-1.5 rounded-lg px-3 py-2.5 text-left hover:bg-fill"
                    [class.bp-item--selected]="it.id === selectedId()"
                    (click)="selectedId.set(it.id)"
                  >
                    <span class="bp-list-title w-full truncate">{{ it.name }}</span>
                    <app-status-pill list="message_item_status" [code]="it.status" />
                  </button>
                }
              }
            }
          </div>

          <!-- Right pane: the selected item's category conversation. -->
          @if (selectedThread(); as t) {
            <div class="flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-surface shadow-[var(--shadow-xs)]">
              <!-- Header — project name with original/revised cost beneath
                   (no agency line / status pill / category·items; that
                   context lives in the rail card). -->
              <div class="border-b border-hairline px-5 py-4">
                <h2 class="bp-card-title text-lg">{{ t.projectName }}</h2>
                <div class="mt-1.5 flex items-center gap-6">
                  <span>
                    <span class="bp-caption">Original</span>
                    <span class="bp-body-small ml-1.5 text-secondary">{{ t.originalTotal | currency: 'GBP' : 'symbol' : '1.0-0' }}</span>
                  </span>
                  <span>
                    <span class="bp-caption">Revised</span>
                    <span class="bp-body-small ml-1.5 font-semibold text-text">{{ t.revisedTotal | currency: 'GBP' : 'symbol' : '1.0-0' }}</span>
                  </span>
                </div>
              </div>

              <!-- Bubbles -->
              <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
                @for (m of t.messages; track m.id) {
                  <div class="flex flex-col" [class.items-end]="m.mine" [class.items-start]="!m.mine">
                    <div class="bp-bubble" [class.bp-bubble--mine]="m.mine">
                      <span class="bp-bubble__author">{{ m.author }}</span>
                      <span class="bp-bubble__body">{{ m.body }}</span>
                    </div>
                    <span class="bp-meta mt-1 px-1">{{ m.createdAt | date: 'shortTime' }}</span>
                  </div>
                }
              </div>

              <!-- Per-item actions — the selected item, when it's still
                   actionable (not terminal). Accept at the current price, or
                   propose a new one. -->
              @if (selectedItem(); as it) {
                @if (!isTerminal(it.status)) {
                  <div class="flex flex-wrap items-center gap-2 border-t border-hairline px-4 py-2.5">
                    <span class="bp-body-small min-w-0 flex-1 truncate text-secondary">
                      <span class="font-semibold text-text">{{ it.name }}</span>
                      · {{ (it.priceCurrent ?? it.priceRef) | currency: 'GBP' : 'symbol' : '1.0-0' }}
                    </span>
                    @if (proposing()) {
                      <input
                        type="number"
                        class="h-8 w-28 rounded-[var(--radius-field)] border border-hairline bg-surface px-2 text-md outline-none focus:border-accent"
                        [value]="proposePrice() ?? ''"
                        [disabled]="sending()"
                        placeholder="New cost"
                        (input)="proposePrice.set($any($event.target).valueAsNumber)"
                        (keydown.enter)="submitPropose(it)"
                      />
                      <button type="button" class="bp-btn-outline" [disabled]="sending()" (click)="proposing.set(false)">Cancel</button>
                      <button type="button" class="bp-btn-grad" [disabled]="sending() || proposePrice() == null" (click)="submitPropose(it)">Send cost</button>
                    } @else {
                      <button type="button" class="bp-act bp-act--green" [disabled]="sending()" (click)="accept(it)">
                        <lucide-icon name="circle-check-big" [size]="15" /> Accept Cost
                      </button>
                      <button type="button" class="bp-act bp-act--yellow" [disabled]="sending()" (click)="startPropose(it)">
                        <lucide-icon name="circle-dollar-sign" [size]="15" /> Suggest New Cost
                      </button>
                      <button type="button" class="bp-act bp-act--gray" [disabled]="sending()" (click)="requestInfo()">
                        <lucide-icon name="info" [size]="15" /> Request Information
                      </button>
                    }
                  </div>
                }
              }

              <!-- Compose — the standard field chrome (catalogue-search rhythm). -->
              <div class="border-t border-hairline px-4 py-3">
                <div class="flex h-[42px] items-center gap-2 rounded-[var(--radius-field)] border border-hairline bg-surface px-3 shadow-[var(--shadow-xs)] focus-within:border-accent">
                  <button type="button" class="shrink-0 text-muted hover:text-text" aria-label="Attach a file" disabled>
                    <lucide-icon name="paperclip" [size]="16" />
                  </button>
                  <input
                    #composeInput
                    class="w-full border-none bg-transparent p-0 text-md outline-none ring-0 placeholder:text-muted focus:ring-0"
                    placeholder="Type your message…"
                    [value]="draft()"
                    [disabled]="sending()"
                    (input)="draft.set($any($event.target).value)"
                    (keydown.enter)="send(t.id)"
                  />
                  <button
                    type="button"
                    class="bp-send-circle shrink-0"
                    [class.opacity-50]="!draft().trim() || sending()"
                    aria-label="Send"
                    [disabled]="!draft().trim() || sending()"
                    (click)="send(t.id)"
                  >
                    <lucide-icon name="send" [size]="15" />
                  </button>
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      /* Selected item card — soft brand-gradient tint (not the full
         intensity). */
      .bp-item--selected {
        background: var(--bp-gradient-soft);
      }
      /* Per-item action buttons — soft colour fills, all forced to one
         (Request-Information) width so the three line up. */
      .bp-act {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        min-width: 12rem;
        white-space: nowrap;
        padding: 8px 14px;
        border-radius: var(--radius-pill);
        font-size: var(--text-sm);
        font-weight: 500;
        border: 1px solid transparent;
        cursor: pointer;
        transition: box-shadow 0.15s, background 0.15s;
      }
      .bp-act:hover:not(:disabled) {
        box-shadow: var(--shadow-xs);
      }
      .bp-act:disabled {
        opacity: 0.55;
        cursor: default;
      }
      .bp-act--green {
        background: var(--color-success-soft);
        color: var(--color-success);
      }
      .bp-act--yellow {
        background: var(--color-warn-soft);
        color: var(--color-warn);
      }
      .bp-act--gray {
        background: var(--color-fill);
        color: var(--color-text-secondary);
      }
      .bp-bubble {
        max-width: 78%;
        border-radius: 14px;
        padding: 8px 12px;
        background: var(--color-surface);
        border: 1px solid var(--color-hairline);
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .bp-bubble--mine {
        background: var(--bp-gradient);
        border: none;
        color: var(--bp-text-on-gradient);
      }
      .bp-bubble__author {
        font-size: 11px;
        font-weight: 600;
        opacity: 0.85;
      }
      .bp-bubble__body {
        font-size: 14px;
        line-height: 1.5;
        white-space: pre-line;
      }
      .bp-send-circle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        border-radius: 9999px;
        background: var(--bp-gradient);
        color: var(--bp-text-on-gradient);
      }
    `,
  ],
})
export class InboxProjectComponent {
  private readonly inbox = inject(InboxService);
  private readonly route = inject(ActivatedRoute);
  private readonly pageConfig = inject(PageConfigService);

  private readonly projectId = toSignal(this.route.paramMap.pipe(map((p) => p.get('projectId') ?? '')), {
    initialValue: '',
  });

  protected readonly threadsRes = resource({
    params: () => this.projectId() || undefined,
    loader: ({ params }) => firstValueFrom(this.inbox.supplierInbox(params)),
  });
  protected readonly project = computed<InboxProjectSummary | null>(() => this.threadsRes.value()?.project ?? null);
  protected readonly threads = computed<InboxThread[]>(() => this.threadsRes.value()?.threads ?? []);
  protected readonly singleCategory = computed(() => this.threads().length <= 1);

  /** Selected item drives the visible thread; defaults to the first item,
   *  resetting whenever the loaded threads change. */
  protected readonly selectedId = linkedSignal<InboxThread[], string | null>({
    source: this.threads,
    computation: (ts) => ts[0]?.items[0]?.id ?? null,
  });

  protected readonly selectedThread = computed<InboxThread | null>(() => {
    const ts = this.threads();
    const id = this.selectedId();
    return ts.find((t) => t.items.some((i) => i.id === id)) ?? ts[0] ?? null;
  });

  protected readonly selectedItem = computed<InboxThreadItem | null>(() => {
    const t = this.selectedThread();
    if (!t) return null;
    return t.items.find((i) => i.id === this.selectedId()) ?? t.items[0] ?? null;
  });

  /** "<Project> conversations" — tracks the configurable event label. */
  protected readonly heroSubtitle = computed(() => `${this.pageConfig.eventLabel()} conversations`);

  /** Tree-header label: the category name when there's more than one
   *  category, else "PROJECT ITEMS". */
  protected headerLabel(t: InboxThread): string {
    return this.singleCategory() || !t.categoryName ? 'PROJECT ITEMS' : t.categoryName;
  }

  // ── Compose ───────────────────────────────────────────────────────────
  protected readonly draft = signal('');
  protected readonly sending = signal(false);

  /** Send the composed message in the given thread, then refresh so the new
   *  bubble appears. */
  protected async send(threadId: string): Promise<void> {
    const text = this.draft().trim();
    if (!text || this.sending()) return;
    this.sending.set(true);
    try {
      await firstValueFrom(this.inbox.reply(threadId, { text }));
      this.draft.set('');
      this.threadsRes.reload();
    } catch {
      // Keep the draft so the user can retry; a toast lands with the
      // shared error surface when the inbox gets one.
    } finally {
      this.sending.set(false);
    }
  }

  // ── Per-item actions (Accept / Propose new price) ──────────────────────
  protected readonly proposing = signal(false);
  protected readonly proposePrice = signal<number | null>(null);

  /** Terminal items are read-only (no actions). */
  protected isTerminal(status: string): boolean {
    return TERMINAL_STATUSES.has(status);
  }

  protected accept(it: InboxThreadItem): void {
    void this.itemAction(it.id, 'accept');
  }
  protected startPropose(it: InboxThreadItem): void {
    this.proposePrice.set(it.priceCurrent ?? it.priceRef ?? 0);
    this.proposing.set(true);
  }

  /** "Request Information" — drop the supplier into the compose box to ask
   *  the agency (a dedicated request-info action can come later). */
  private readonly composeInput = viewChild<ElementRef<HTMLInputElement>>('composeInput');
  protected requestInfo(): void {
    this.composeInput()?.nativeElement.focus();
  }
  protected async submitPropose(it: InboxThreadItem): Promise<void> {
    const price = this.proposePrice();
    if (price == null || price < 0) return;
    await this.itemAction(it.id, 'adjust', price);
    this.proposing.set(false);
  }

  private async itemAction(itemId: string, action: 'accept' | 'adjust', price?: number): Promise<void> {
    const thread = this.selectedThread();
    if (!thread || this.sending()) return;
    this.sending.set(true);
    try {
      await firstValueFrom(this.inbox.reply(thread.id, { itemActions: [{ itemId, action, price }] }));
      this.threadsRes.reload();
    } catch {
      // Retry on the next click; shared toast surface lands later.
    } finally {
      this.sending.set(false);
    }
  }

  // Tree expansion — collapsed-by-id (default expanded so items show).
  private readonly collapsed = signal<ReadonlySet<string>>(new Set());
  protected isExpanded(id: string): boolean {
    return !this.collapsed().has(id);
  }
  protected toggle(id: string): void {
    this.collapsed.update((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
}

/** Terminal item statuses — no further supplier action. */
const TERMINAL_STATUSES = new Set(['declined_by_supplier', 'declined_by_agent', 'booked']);
