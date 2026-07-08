import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, linkedSignal, resource, signal, viewChild } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { PageConfigService } from '../../core/config/page-config.service';
import { PageHeroComponent } from '../../shell/page-hero/page-hero.component';
import { InboxBubble, InboxProjectSummary, InboxService, InboxThread, InboxThreadItem } from '../../core/inbox/inbox.service';
import { TERMINAL_STATUSES, gbp } from './inbox-status';
import { InboxRailComponent } from './inbox-rail.component';

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
  imports: [CurrencyPipe, DatePipe, LucideAngularModule, PageHeroComponent, InboxRailComponent],
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
          <!-- Left rail: project context card + thread cards + their items. -->
          <app-inbox-rail
            [project]="project()"
            [groups]="railGroups()"
            [selectedThreadId]="selectedThreadId()"
            [selectedId]="selectedId()"
            [isAgency]="isAgency()"
            (selectThread)="selectThread($event)"
            (selectItem)="selectItem($event)" />

          <!-- Right pane: the selected item's category conversation. -->
          @if (selectedThread(); as t) {
            <div class="flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-surface shadow-[var(--shadow-xs)]">
              <!-- Header — project name with original/revised cost beneath
                   (no agency line / status pill / category·items; that
                   context lives in the rail card). -->
              <div class="border-b border-hairline px-5 py-4">
                <h2 class="bp-card-title text-lg">
                  @if (selectedItem(); as it) {
                    {{ it.name }} <span class="text-muted">· {{ isAgency() ? (t.supplierName ?? 'Supplier') : t.projectName }}</span>
                  } @else {
                    {{ isAgency() ? (t.supplierName ?? 'Supplier') : t.projectName }}
                  }
                </h2>
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
                   agency bubbles read as cards; "You" stays gradient. In a
                   filtered (item) view, broadcasts fade + carry a General tag. -->
              <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-bg px-5 py-4">
                @for (m of visibleMessages(); track m.id) {
                  <div class="flex flex-col" [class.items-end]="m.mine" [class.items-start]="!m.mine">
                    <div class="bp-bubble" [class.bp-bubble--mine]="m.mine" [class.bp-bubble--general]="isGeneral(m)">
                      <span class="bp-bubble__author">
                        {{ m.author }}
                        @if (isGeneral(m)) {
                          <span class="bp-bubble__general">General</span>
                        }
                      </span>
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

  /** One rail card per thread. Agency view labels by supplier; supplier
   *  view is the category tree ("PROJECT ITEMS" when single). The card's
   *  top row selects the whole thread; "N Items" expands. (Multi-category
   *  suppliers show one card per category — punted edge.) */
  protected readonly railGroups = computed(() =>
    this.threads().map((t) => ({
      id: t.id,
      threadId: t.id,
      label: this.isAgency() ? t.supplierName ?? 'Supplier' : this.headerLabel(t),
      items: t.items,
    }))
  );

  /** No item is auto-selected — you land on thread-level chat (action bar
   *  hidden). Selecting an item arms its actions; clicking it again
   *  deselects. The visible conversation is its own pick so it survives a
   *  deselect (Liam 2026-06-29). */
  protected readonly selectedId = linkedSignal<InboxThread[], string | null>({
    source: this.threads,
    computation: () => null,
  });
  protected readonly selectedThreadId = linkedSignal<InboxThread[], string | null>({
    source: this.threads,
    computation: (ts) => ts[0]?.id ?? null,
  });

  protected readonly selectedThread = computed<InboxThread | null>(() => {
    const ts = this.threads();
    return ts.find((t) => t.id === this.selectedThreadId()) ?? ts[0] ?? null;
  });

  protected readonly selectedItem = computed<InboxThreadItem | null>(() => {
    const id = this.selectedId();
    if (!id) return null;
    return this.selectedThread()?.items.find((i) => i.id === id) ?? null;
  });

  /** Click a thread card's top row: view the whole thread (clears any item
   *  filter — also the "back to all" gesture). */
  protected selectThread(threadId: string): void {
    this.selectedThreadId.set(threadId);
    this.selectedId.set(null);
  }

  /** Click an item: arm it (and switch to its thread); clicking the armed
   *  item again clears it back to thread-level chat. */
  protected selectItem(itemId: string): void {
    if (this.selectedId() === itemId) {
      this.selectedId.set(null);
      return;
    }
    const t = this.threads().find((th) => th.items.some((i) => i.id === itemId));
    if (t) this.selectedThreadId.set(t.id);
    this.selectedId.set(itemId);
  }

  /** The bubbles to render: the whole thread at parent level; when an item
   *  is selected, its tagged messages PLUS the untagged broadcasts. */
  protected readonly visibleMessages = computed(() => {
    const t = this.selectedThread();
    if (!t) return [];
    const itemId = this.selectedItem()?.itemId;
    if (!itemId) return t.messages;
    return t.messages.filter((m) => m.taggedItemIds.length === 0 || m.taggedItemIds.includes(itemId));
  });

  /** A broadcast shown inside a filtered (item) view — gets the faded
   *  "general" treatment so it doesn't read as misplaced. */
  protected isGeneral(m: InboxBubble): boolean {
    return !!this.selectedItem() && m.taggedItemIds.length === 0;
  }

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
      // A message composed with an item selected tags it; otherwise it's a
      // thread-level broadcast.
      const taggedItemId = this.selectedItem()?.itemId ?? undefined;
      await firstValueFrom(this.inbox.reply(threadId, { text, taggedItemId }));
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

}

