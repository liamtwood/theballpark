import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, linkedSignal, resource, signal, viewChild } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { PageConfigService } from '../../core/config/page-config.service';
import { PageHeroComponent } from '../../shell/page-hero/page-hero.component';
import { InboxProjectSummary, InboxService, InboxThread, InboxThreadItem } from '../../core/inbox/inbox.service';

/** pV2-INBOX-01/03 — the per-project conversation surface, viewer-aware.
 *  Supplier (standalone /inbox/:projectId): the left rail is THEIR items
 *  (category tree, "PROJECT ITEMS" when single); they get compose + the
 *  Accept/Suggest/Request actions. Agency (embedded in the project Inbox
 *  tab): the rail groups by SUPPLIER → their items; read-only for now
 *  (agent compose + actions are the next slice). Right pane = the
 *  conversation (project/counterparty + original/revised header,
 *  gradient/white bubbles). */
@Component({
  selector: 'app-inbox-project',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, DatePipe, LucideAngularModule, PageHeroComponent],
  host: { '[class]': 'hostClass()' },
  template: `
    @if (!embedded()) {
      <app-page-hero [back]="{ label: 'Back', href: '/projects', history: true }" title="Inbox" [subtitle]="heroSubtitle()" />
    }

    <div [class]="embedded() ? 'flex min-h-0 flex-1 flex-col px-4 pt-4' : 'bp-page-body'">
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
            <!-- Tree header: per supplier (agency view) or per category /
                 "PROJECT ITEMS" (supplier view). Expand to reveal items. -->
            @for (g of railGroups(); track g.id) {
              <button
                type="button"
                class="flex w-full items-center gap-1.5 px-2 pb-1 pt-3 text-left first:pt-1"
                (click)="toggle(g.id)"
              >
                <lucide-icon [name]="isExpanded(g.id) ? 'chevron-down' : 'chevron-right'" [size]="15" class="shrink-0 text-muted" />
                <span class="bp-field-label flex-1 uppercase tracking-wide">{{ g.label }}</span>
                <span class="bp-meta">{{ g.items.length }}</span>
              </button>
              @if (isExpanded(g.id)) {
                @for (it of g.items; track it.id) {
                  <button
                    type="button"
                    class="flex w-full flex-col items-start gap-1.5 rounded-lg px-3 py-2.5 text-left hover:bg-fill"
                    [class.bp-item--selected]="it.id === selectedId()"
                    (click)="selectedId.set(it.id)"
                  >
                    <span class="bp-list-title w-full truncate">{{ it.name }}</span>
                    <span [class]="'bp-spill bp-spill--' + sv(it.status).tone">{{ sv(it.status).label }}</span>
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
                <h2 class="bp-card-title text-lg">{{ isAgency() ? (t.supplierName ?? 'Supplier') : t.projectName }}</h2>
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

              <!-- Bubbles — on the page (parchment) ground so the white
                   agency bubbles read as cards; "You" stays gradient. -->
              <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-bg px-5 py-4">
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
                   actionable (not terminal). Accept the current cost, or
                   propose a new one. Both viewers act; the server maps the
                   side (supplier vs agency). -->
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
                      <button type="button" class="bp-act bp-act--gray" [disabled]="sending()" (click)="requestInfo(it)">
                        <lucide-icon name="info" [size]="15" /> Request Information
                      </button>
                    }
                  </div>
                }
              }

              <!-- Compose — on the parchment ground, standard field chrome +
                   a gradient Send button. -->
              <div class="flex items-center gap-2 border-t border-hairline bg-bg px-4 py-3">
                <div class="flex h-[42px] flex-1 items-center gap-2 rounded-[var(--radius-field)] border border-hairline bg-surface px-3 shadow-[var(--shadow-xs)] focus-within:border-accent">
                  <input
                    #composeInput
                    class="w-full border-none bg-transparent p-0 text-md outline-none ring-0 placeholder:text-muted focus:ring-0"
                    placeholder="Type your message…"
                    [value]="draft()"
                    [disabled]="sending()"
                    (input)="draft.set($any($event.target).value)"
                    (keydown.enter)="send(t.id)"
                  />
                </div>
                <button
                  type="button"
                  class="bp-send-btn shrink-0"
                  [disabled]="!draft().trim() || sending()"
                  (click)="send(t.id)"
                >
                  <lucide-icon name="send" [size]="15" /> Send
                </button>
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
      /* White agency bubble — reads as a card on the parchment ground. */
      .bp-bubble {
        max-width: 78%;
        border-radius: 14px;
        padding: 8px 12px;
        background: var(--color-surface);
        border: 1px solid var(--color-border-hairline);
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
      /* Gradient Send button. */
      .bp-send-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 42px;
        padding: 0 18px;
        border-radius: var(--radius-pill);
        border: none;
        background: var(--bp-gradient);
        color: var(--bp-text-on-gradient);
        font-size: var(--text-sm);
        font-weight: 600;
        cursor: pointer;
      }
      .bp-send-btn:disabled {
        opacity: 0.5;
        cursor: default;
      }
      /* Per-item status pill — supplier perspective, soft colour tones. */
      .bp-spill {
        display: inline-flex;
        align-items: center;
        padding: 2px 9px;
        border-radius: var(--radius-pill);
        font-size: var(--text-2xs);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        white-space: nowrap;
      }
      .bp-spill--green {
        background: var(--color-success-soft);
        color: var(--color-success);
      }
      .bp-spill--yellow {
        background: var(--color-warn-soft);
        color: var(--color-warn);
      }
      .bp-spill--gray {
        background: var(--color-fill);
        color: var(--color-text-secondary);
      }
      .bp-spill--red {
        background: var(--color-danger-soft);
        color: var(--color-danger);
      }
    `,
  ],
})
export class InboxProjectComponent {
  private readonly inbox = inject(InboxService);
  private readonly route = inject(ActivatedRoute);
  private readonly pageConfig = inject(PageConfigService);
  private readonly auth = inject(AuthService);

  /** Supplier (standalone page) or agency (embedded project Inbox tab). */
  readonly viewer = input<'supplier' | 'agency'>('supplier');
  /** Embedded (agency tab) gets the project as an input; the supplier page
   *  reads it from the route. */
  readonly projectIdInput = input<string | null>(null, { alias: 'projectId' });
  readonly embedded = input(false);

  protected readonly isAgency = computed(() => this.viewer() === 'agency');
  protected readonly hostClass = computed(() =>
    this.embedded() ? 'flex min-h-0 flex-1 flex-col' : 'block bp-vpfit'
  );

  private readonly routeProjectId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('projectId') ?? '')),
    { initialValue: '' }
  );
  private readonly projectId = computed(() => this.projectIdInput() || this.routeProjectId());

  protected readonly threadsRes = resource({
    params: () => this.projectId() || undefined,
    loader: ({ params }) => firstValueFrom(this.inbox.projectInbox(params)),
  });
  protected readonly project = computed<InboxProjectSummary | null>(() => this.threadsRes.value()?.project ?? null);
  protected readonly threads = computed<InboxThread[]>(() => this.threadsRes.value()?.threads ?? []);
  protected readonly singleCategory = computed(() => this.threads().length <= 1);

  /** Rail groups: agency view groups by supplier → their items; supplier
   *  view is the category tree ("PROJECT ITEMS" when single). */
  protected readonly railGroups = computed<{ id: string; label: string; items: InboxThreadItem[] }[]>(() => {
    if (!this.isAgency()) {
      return this.threads().map((t) => ({ id: t.id, label: this.headerLabel(t), items: t.items }));
    }
    const bySupplier = new Map<string, { id: string; label: string; items: InboxThreadItem[] }>();
    for (const t of this.threads()) {
      const key = t.supplierOrgId ?? t.id;
      const g = bySupplier.get(key) ?? { id: key, label: t.supplierName ?? 'Supplier', items: [] };
      g.items.push(...t.items);
      bySupplier.set(key, g);
    }
    return [...bySupplier.values()];
  });

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
    const cost = it.priceCurrent ?? it.priceRef ?? 0;
    void this.itemAction(it.id, 'accept', undefined, `${it.name} ${gbp(cost)} Cost Accepted by ${this.actorName()}`);
  }
  protected startPropose(it: InboxThreadItem): void {
    this.proposePrice.set(it.priceCurrent ?? it.priceRef ?? 0);
    this.proposing.set(true);
  }

  /** "Request Information" — seed the compose box with the item + cost so
   *  the supplier edits/adds detail, then send (chat-only; no status change). */
  private readonly composeInput = viewChild<ElementRef<HTMLInputElement>>('composeInput');
  protected requestInfo(it: InboxThreadItem): void {
    const cost = it.priceCurrent ?? it.priceRef ?? 0;
    this.draft.set(`${it.name} ${gbp(cost)} `);
    this.composeInput()?.nativeElement.focus();
  }
  protected async submitPropose(it: InboxThreadItem): Promise<void> {
    const price = this.proposePrice();
    if (price == null || price < 0) return;
    const from = it.priceCurrent ?? it.priceRef ?? 0;
    await this.itemAction(it.id, 'adjust', price, `${it.name} ${gbp(from)} New Cost Suggested ${gbp(price)} by ${this.actorName()}`);
    this.proposing.set(false);
  }

  /** The acting user's name for the action chat line ("… by Ryan"). */
  private actorName(): string {
    const u = this.auth.user();
    return u?.displayName || u?.email || 'you';
  }

  /** A per-item action posts a matching chat line + the state change, then
   *  refreshes so the bubble + the item's pill update together. */
  private async itemAction(itemId: string, action: 'accept' | 'adjust', price?: number, text?: string): Promise<void> {
    const thread = this.selectedThread();
    if (!thread || this.sending()) return;
    this.sending.set(true);
    try {
      await firstValueFrom(this.inbox.reply(thread.id, { text, itemActions: [{ itemId, action, price }] }));
      this.threadsRes.reload();
    } catch {
      // Retry on the next click; shared toast surface lands later.
    } finally {
      this.sending.set(false);
    }
  }

  /** Status pill — viewer-perspective label + soft colour tone. */
  protected sv(status: string): { label: string; tone: 'green' | 'yellow' | 'gray' | 'red' } {
    const map = this.isAgency() ? STATUS_VIEW_AGENCY : STATUS_VIEW;
    return map[status] ?? { label: status, tone: 'gray' };
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

/** message_item_status → the supplier-perspective pill (label + tone). The
 *  pill text-transforms to uppercase, so "You accepted" → "YOU ACCEPTED". */
const STATUS_VIEW: Record<string, { label: string; tone: 'green' | 'yellow' | 'gray' | 'red' }> = {
  brief_sent: { label: 'Quote requested', tone: 'gray' },
  holding: { label: 'On hold', tone: 'gray' },
  quoted: { label: 'Quoted', tone: 'gray' },
  adjusted_by_supplier: { label: 'New cost suggested', tone: 'yellow' },
  adjusted_by_agent: { label: 'Agency revised', tone: 'yellow' },
  accepted: { label: 'You accepted', tone: 'green' },
  booked: { label: 'Booked', tone: 'green' },
  declined_by_supplier: { label: 'You declined', tone: 'red' },
  declined_by_agent: { label: 'Agency declined', tone: 'red' },
};

/** Same statuses, AGENCY perspective. */
const STATUS_VIEW_AGENCY: Record<string, { label: string; tone: 'green' | 'yellow' | 'gray' | 'red' }> = {
  brief_sent: { label: 'Quote requested', tone: 'gray' },
  holding: { label: 'On hold', tone: 'gray' },
  quoted: { label: 'Quoted', tone: 'gray' },
  adjusted_by_supplier: { label: 'New cost suggested', tone: 'yellow' },
  adjusted_by_agent: { label: 'You revised', tone: 'yellow' },
  accepted: { label: 'Accepted', tone: 'green' },
  booked: { label: 'Booked', tone: 'green' },
  declined_by_supplier: { label: 'Supplier declined', tone: 'red' },
  declined_by_agent: { label: 'You declined', tone: 'red' },
};

/** Whole-pound GBP for the action chat lines ("Cost Accepted £10,000"). */
function gbp(n: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);
}
