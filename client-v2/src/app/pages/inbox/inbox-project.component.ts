import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, linkedSignal, resource, signal, viewChild } from '@angular/core';
import { CurrencyPipe, DatePipe, NgClass } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { PageConfigService } from '../../core/config/page-config.service';
import { PageHeroComponent } from '../../shell/page-hero/page-hero.component';
import { InboxBubble, InboxProjectSummary, InboxService, InboxThread, InboxThreadItem } from '../../core/inbox/inbox.service';
import { QuoteLine } from '../../core/projects/project.types';
import { TERMINAL_STATUSES, gbp } from './inbox-status';
import { InboxRailComponent, RailOuter } from './inbox-rail.component';
import { LinePreviewComponent } from '../projects/line-preview.component';
import { lineCost } from '../projects/quote-line.util';
import { LineEditorComponent, LineEdit } from '../projects/line-editor.component';
import { CustomizeDialogComponent } from '../projects/customize-dialog.component';
import { ProjectService } from '../../core/projects/project.service';
import { AgentRailComponent, AgentRailContext } from '../projects/agent-rail.component';

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
  imports: [CurrencyPipe, DatePipe, NgClass, LucideAngularModule, PageHeroComponent, InboxRailComponent, LinePreviewComponent, CustomizeDialogComponent, LineEditorComponent, AgentRailComponent],
  host: { '[class]': 'hostClass()' },
  template: `
    @if (!embedded()) {
      <app-page-hero [back]="{ label: 'Back', href: '/projects', history: true }" title="Inbox" [subtitle]="heroSubtitle()" />
    }

    <div [class]="embedded() ? 'flex min-h-0 flex-1 flex-col px-4 pt-4' : 'bp-page-body'">
      <!-- FIRST load only. isLoading() is also true while RELOADING, and every
           send/accept/decline reloads — so gating on it alone tore the whole pane
           down each time: the rail's collapse state reset and the compose input
           was destroyed, losing focus after every message (audit 2026-07-17 S1). -->
      @if (threadsRes.isLoading() && !threadsRes.hasValue()) {
        <p class="bp-body-small text-secondary">Loading…</p>
      } @else if (threadsRes.error()) {
        <p class="bp-body-small text-warn">Couldn't load this conversation — please refresh.</p>
      } @else if (threads().length === 0) {
        <p class="bp-body-small text-secondary">No quote requests in this project yet.</p>
      } @else {
        <div class="grid min-h-0 flex-1 grid-cols-1 gap-6"
             [ngClass]="showAgent() ? 'xl:grid-cols-[280px_1fr_340px]' : 'xl:grid-cols-[300px_1fr]'">
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
                <!-- When a specific item is selected the header is ITEM-scoped
                     (its own priceRef/priceCurrent) so it lines up with the item
                     card / Customize base; with no item selected it's the whole
                     thread's totals. -->
                <div class="mt-1.5 flex flex-wrap items-center gap-x-6 gap-y-1.5">
                  @if (selectedItem(); as it) {
                    <span>
                      <span class="bp-caption">Original</span>
                      <span class="bp-body-small ml-1.5 text-secondary">{{ (it.priceRef ?? 0) | currency: 'GBP' : 'symbol' : '1.0-0' }}</span>
                    </span>
                    <span>
                      <span class="bp-caption">Revised</span>
                      <span class="bp-body-small ml-1.5 font-semibold text-text">{{ (it.priceCurrent ?? it.priceRef ?? 0) | currency: 'GBP' : 'symbol' : '1.0-0' }}</span>
                    </span>
                    <!-- pV2-BUILDUP-02 — supplier's estimate buildup on the line. -->
                    @if (!isAgency() && custoTotal() != null) {
                      <span>
                        <span class="bp-caption">Upgrades</span>
                        <span class="bp-body-small ml-1.5 text-secondary">{{ custoTotal() | currency: 'GBP' : 'symbol' : '1.0-0' }}</span>
                      </span>
                    }
                  } @else {
                    <span>
                      <span class="bp-caption">Original</span>
                      <span class="bp-body-small ml-1.5 text-secondary">{{ t.originalTotal | currency: 'GBP' : 'symbol' : '1.0-0' }}</span>
                    </span>
                    <span>
                      <span class="bp-caption">Revised</span>
                      <span class="bp-body-small ml-1.5 font-semibold text-text">{{ t.revisedTotal | currency: 'GBP' : 'symbol' : '1.0-0' }}</span>
                    </span>
                  }
                </div>
              </div>

              @if (customizing(); as c) {
                <!-- pV2-BUILDUP-02 — the estimate builder, inline in the thread
                     pane (replaces the conversation while customizing). -->
                <div class="min-h-0 flex-1 overflow-y-auto">
                  <app-customize-dialog
                    [projectId]="projectId()"
                    [lineId]="c.id"
                    [itemName]="c.name"
                    [originalPrice]="c.priceRef"
                    [currentPrice]="c.priceCurrent ?? c.priceRef"
                    [baseUnitPrice]="c.unitPriceRef"
                    [baseUnit]="c.unit"
                    [baseQuantity]="c.quantity"
                    [baseCategoryId]="c.line?.categoryId ?? null"
                    [previewLine]="c.line"
                    (saved)="onCustomizeSaved()"
                    (changed)="onCustomizeChanged()"
                    (sendCost)="onSendCost($event)"
                    (cancel)="customizing.set(null)" />
                </div>
              } @else {

              <!-- Bubbles — on the page (parchment) ground so the white
                   agency bubbles read as cards; "You" stays gradient. In a
                   filtered (item) view, broadcasts fade + carry a General tag. -->
              <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-bg px-5 py-4">
                @if (selectedItem()) {
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
                  <!-- The item(s) this quote request covers, as attachments:
                       collapsed to a name bar, expanding in place to the SAME
                       preview card the Estimate rail renders. Fixed w-80 in both
                       states so expanding never changes the width. -->
                  @for (line of cardsFor(m); track line.id) {
                    <!-- Align to the sender's side — the brief is the agent's
                         own message, so in the agent inbox the attachment sits
                         right (mine); on the supplier side it sits left. -->
                    <div class="w-80 max-w-full" [class.self-end]="m.mine">
                      @if (isAttachmentOpen(m.id, line.id)) {
                        <div class="bp-card p-4">
                          <app-line-preview [line]="line" [collapsible]="true" closeIcon="chevron-up" closeLabel="Minimise"
                                            (closed)="toggleAttachment(m.id, line.id)" />
                        </div>
                      } @else {
                        <button type="button"
                                class="flex w-full items-center gap-2 rounded-[var(--radius-card)] border border-hairline bg-surface px-3 py-2.5 text-left shadow-[var(--shadow-xs)] transition-colors hover:bg-fill"
                                (click)="toggleAttachment(m.id, line.id)">
                          <lucide-icon name="paperclip" [size]="14" class="shrink-0 text-muted" />
                          <span class="bp-list-title min-w-0 flex-1 truncate">{{ line.name }}</span>
                          <lucide-icon name="chevron-down" [size]="15" class="shrink-0 text-muted" />
                        </button>
                      }
                    </div>
                  }
                  <!-- Revised item card delivered with a "New Cost" message —
                       show/hide collapsible, same pattern as the brief
                       attachment above (independent toggle: different message id). -->
                  @for (line of proposalCardsFor(m); track line.id) {
                    <div class="w-80 max-w-full" [class.self-end]="m.mine">
                      @if (isAttachmentOpen(m.id, line.id)) {
                        <div class="bp-card p-4">
                          @if (isEditingLine(line)) {
                            <!-- Inline edit — shared LineEditor (name/cost/unit/
                                 description/services/details). Supplier: a cost
                                 change fires a New-Cost proposal (onLineSave). -->
                            <app-line-editor [line]="line" [saving]="savingDetails()"
                                             (save)="onLineSave(line, $event)" (cancel)="cancelEdit()" />
                          } @else {
                            <!-- Read-only; the supplier clicks the card to edit. -->
                            <div [class.cursor-pointer]="!isAgency()" [attr.title]="isAgency() ? null : 'Click to edit'" (click)="beginEdit(line)">
                              <app-line-preview [line]="line" [collapsible]="true" closeIcon="chevron-up" closeLabel="Minimise"
                                                (closed)="toggleAttachment(m.id, line.id)" />
                            </div>
                          }
                        </div>
                      } @else {
                        <button type="button"
                                class="flex w-full items-center gap-2 rounded-[var(--radius-card)] border border-hairline bg-surface px-3 py-2.5 text-left shadow-[var(--shadow-xs)] transition-colors hover:bg-fill"
                                (click)="toggleAttachment(m.id, line.id)">
                          <lucide-icon name="paperclip" [size]="14" class="shrink-0 text-muted" />
                          <span class="bp-list-title min-w-0 flex-1 truncate">{{ line.name }}</span>
                          <span class="bp-pill bp-pill--muted shrink-0">Revised</span>
                          <lucide-icon name="chevron-down" [size]="15" class="shrink-0 text-muted" />
                        </button>
                      }
                    </div>
                  }
                }
                } @else {
                  <!-- No conversation until an item is picked (Liam 2026-08-30). -->
                  <div class="flex flex-1 items-center justify-center px-6 text-center">
                    <p class="bp-body-small text-secondary">Select an item above to view its conversation.</p>
                  </div>
                }
              </div>

              <!-- Per-item actions — the selected item, when it's still
                   actionable (not terminal). Accept the current cost, or
                   propose a new one. Both viewers act; the server maps the
                   side (supplier vs agency). -->
              <!-- pV2-INTENT-01 — the standing Accept / Suggest / Request / Decline
                   / Customize actions moved to the Assistant rail's chips. Only the
                   Suggest-new-cost rate entry stays here (opened by that chip). -->
              @if (selectedItem(); as it) {
                @if (!isTerminal(it.status) && proposing()) {
                  <div class="flex flex-wrap items-center gap-2 border-t border-hairline px-4 py-2.5">
                    <span class="bp-body-small text-secondary">New cost for <span class="font-semibold text-text">{{ it.name }}</span></span>
                    <input
                      type="number"
                      class="h-8 w-24 rounded-[var(--radius-field)] border border-hairline bg-surface px-2 text-md outline-none focus:border-accent"
                      [value]="proposePrice() ?? ''"
                      [disabled]="sending()"
                      placeholder="New rate"
                      (input)="proposePrice.set($any($event.target).valueAsNumber)"
                      (keydown.enter)="submitPropose(it)"
                    />
                    <span class="bp-body-small text-muted">/ {{ unitLabel(it) }}</span>
                    @if (canInstall(it)) {
                      <span class="bp-body-small text-muted">+ install</span>
                      <input
                        type="number"
                        class="h-8 w-20 rounded-[var(--radius-field)] border border-hairline bg-surface px-2 text-md outline-none focus:border-accent"
                        [value]="proposeInstall() ?? ''"
                        [disabled]="sending()"
                        placeholder="install"
                        (input)="proposeInstall.set($any($event.target).valueAsNumber)"
                        (keydown.enter)="submitPropose(it)"
                      />
                      <span class="bp-body-small text-muted">{{ it.installUnit === 'percentage' ? '%' : (it.installUnit === 'per_order' ? '/ order' : '/ ' + unitLabel(it)) }}</span>
                    }
                    @if (proposedTotal() != null) {
                      <span class="bp-body-small text-secondary">= <span class="font-semibold text-text">{{ proposedTotal() | currency: 'GBP' : 'symbol' : '1.0-0' }}</span></span>
                    }
                    <button type="button" class="bp-btn-outline" [disabled]="sending()" (click)="proposing.set(false)">Cancel</button>
                    <button type="button" class="bp-btn-grad" [disabled]="sending() || proposePrice() == null" (click)="submitPropose(it)">Send cost</button>
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
                    [placeholder]="selectedItem() ? 'Type your message…' : 'Select an item above to reply'"
                    [value]="draft()"
                    [disabled]="sending() || !selectedItem()"
                    (input)="draft.set($any($event.target).value)"
                    (keydown.enter)="send(t.id)"
                  />
                </div>
                <button
                  type="button"
                  class="bp-send-btn shrink-0"
                  [disabled]="!draft().trim() || sending() || !selectedItem()"
                  (click)="send(t.id)"
                >
                  <lucide-icon name="send" [size]="15" /> Send
                </button>
              </div>
              }
            </div>
          }

          <!-- pV2-INTENT-01 — the reusable conversational assistant rail (xl only),
               acting on the selected line; hidden while the Customize builder owns
               the pane. -->
          @if (showAgent()) {
            <aside class="hidden min-h-0 xl:block">
              <app-agent-rail [context]="agentContext()!"
                              (quickAction)="onAgentQuick($event)"
                              (changed)="onCustomizeChanged()"
                              (accept)="onAgentAccept()" (decline)="onAgentDecline($event)"
                              (suggestCost)="onAgentSuggestCost($event)" (sendMessage)="onAgentSend($event)" />
            </aside>
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
  protected readonly projectId = computed(() => this.projectIdInput() || this.routeProjectId());

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
  /** The nested rail tree — the Final-Quote containment pattern applied to the
   *  inbox hierarchy. Outer card = the counterparty (agency view groups by
   *  SUPPLIER; supplier view groups by the AGENCY); each thread becomes a
   *  category band with its items. Threads arrive newest-first, so the outers
   *  and their cats keep that order. */
  protected readonly railGroups = computed<RailOuter[]>(() => {
    const outers = new Map<string, RailOuter>();
    for (const t of this.threads()) {
      const key = (this.isAgency() ? t.supplierOrgId : t.agencyOrgId) ?? t.id;
      let o = outers.get(key);
      if (!o) {
        o = {
          id: key,
          label: (this.isAgency() ? t.supplierName : t.agencyName) ?? (this.isAgency() ? 'Supplier' : 'Agency'),
          // Agency view = the supplier's logo (else a store glyph); supplier
          // view = the agency's logo (else a building glyph).
          iconUrl: (this.isAgency() ? t.supplierLogoUrl : t.agencyLogoUrl) ?? null,
          iconName: this.isAgency() ? 'store' : 'building-2',
          total: 0,
          cats: [],
        };
        outers.set(key, o);
      }
      o.cats.push({
        threadId: t.id,
        categoryName: t.categoryName ?? 'Project items',
        // Same category icon the Final Quote card uses (from the QuoteLine).
        iconName: t.items[0]?.line?.categoryIconName ?? 'folder',
        items: t.items,
      });
      o.total += t.revisedTotal;
    }
    return [...outers.values()];
  });

  /** The FIRST item is auto-selected on load (Liam 2026-09-02) so you land
   *  straight in its conversation + Assistant. Selecting arms another item;
   *  the pick is preserved across reloads. */
  protected readonly selectedId = linkedSignal<InboxThread[], string | null>({
    source: this.threads,
    // Preserve the armed item across reloads (a send/accept/customize reloads
    // the threads) — only re-default when it's gone (else replies fell back to
    // "General", Liam 2026-08-28). Default = the first item of the first thread
    // that has one.
    computation: (ts, prev) => {
      const id = prev?.value ?? null;
      if (id && ts.some((t) => t.items.some((i) => i.id === id))) return id;
      return ts.find((t) => t.items.length)?.items[0]?.id ?? null;
    },
  });
  protected readonly selectedThreadId = linkedSignal<InboxThread[], string | null>({
    source: this.threads,
    // Keep the current thread across reloads; default to the first thread that
    // has items (matching the auto-selected item above) when the previous is gone.
    computation: (ts, prev) => {
      const id = prev?.value ?? null;
      if (id && ts.some((t) => t.id === id)) return id;
      return (ts.find((t) => t.items.length) ?? ts[0])?.id ?? null;
    },
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

  // ── pV2-INTENT-01 — the conversational assistant rail on the selected line ──
  /** Context handed to the reusable agent rail (null → no line selected). */
  protected readonly agentContext = computed<AgentRailContext | null>(() => {
    const it = this.selectedItem();
    if (!it) return null;
    const terminal = this.isTerminal(it.status);
    return {
      projectId: this.projectId(),
      lineId: it.id,
      itemName: it.name,
      baseCost: it.unitPriceRef ?? null,
      unit: it.unit ?? null,
      quantity: it.quantity ?? null,
      currentTotal: it.priceCurrent ?? it.priceRef ?? null,
      currentDescription: it.description ?? it.line?.description ?? null,
      componentNames: it.line?.components?.map((c) => c.name) ?? it.line?.extras ?? [],
      role: this.isAgency() ? 'agent' : 'supplier',
      currencyCode: it.line?.supplierCurrency ?? null,
      canAccept: !terminal,
      canDecline: !terminal,
    };
  });
  /** Show the rail (xl) when a line is selected and Customize isn't taking the pane. */
  protected readonly showAgent = computed(() => !!this.agentContext() && !this.customizing());
  protected onAgentQuick(key: string): void {
    const it = this.selectedItem();
    if (!it) return;
    switch (key) {
      case 'accept': this.accept(it); break;
      case 'suggest': this.startPropose(it); break;
      case 'info': this.requestInfo(it); break;
      case 'decline': this.decline(it); break;
      case 'customize': this.toggleCustomize(it); break;
    }
  }
  protected onAgentAccept(): void { const it = this.selectedItem(); if (it) this.accept(it); }
  /** Decline/cancel; when the Assistant supplies a reason, post it straight away. */
  protected async onAgentDecline(reason: string): Promise<void> {
    const it = this.selectedItem();
    const t = this.selectedThread();
    if (!it) return;
    this.decline(it); // arms the decline + prefills the composer
    if (reason && t) {
      const verb = this.isAgency() ? 'Cancel' : 'Decline';
      this.draft.set(`${it.name} — ${verb} because ${reason}`);
      await this.send(t.id);
    }
  }
  protected onAgentSuggestCost(total: number): void {
    const it = this.selectedItem();
    if (!it) return;
    const rate = total / (it.quantity || 1); // price_current is the per-unit rate
    const from = it.priceCurrent ?? it.priceRef ?? 0;
    void this.itemAction(it.id, 'adjust', rate, `${it.name} ${gbp(from)} New Cost Suggested ${gbp(total)} by ${this.actorName()}`);
  }
  protected onAgentSend(text: string): void {
    if (!text.trim() || !this.selectedThread()) return;
    this.draft.set(text);
    void this.send(this.selectedThread()!.id);
  }

  /** Click a thread card's top row: view the whole thread (clears any item
   *  filter — also the "back to all" gesture). */
  protected selectThread(threadId: string): void {
    this.selectedThreadId.set(threadId);
    this.selectedId.set(null);
    this.decliningId.set(null);
  }

  /** Click an item: arm it (and switch to its thread); clicking the armed
   *  item again clears it back to thread-level chat. */
  protected selectItem(itemId: string): void {
    this.decliningId.set(null); // switching items abandons a pending decline
    if (this.selectedId() === itemId) {
      this.selectedId.set(null);
      return;
    }
    const t = this.threads().find((th) => th.items.some((i) => i.id === itemId));
    if (t) this.selectedThreadId.set(t.id);
    this.selectedId.set(itemId);
    // If a DIFFERENT line is being customized, don't leave the builder stranded
    // on the old line while the header shows the new one: save the current draft,
    // then reopen the builder fresh on the newly-selected line.
    const cur = this.customizing();
    if (cur && cur.id !== itemId) {
      this.customizeDialog()?.saveDraftPublic(); // captures rows synchronously
      const next = t?.items.find((i) => i.id === itemId) ?? null;
      this.customizing.set(null); // tear the builder down…
      if (next) setTimeout(() => this.customizing.set(next)); // …and reopen on the new line
    }
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

  /** The item attachments hang under the INITIAL quote-request (brief) message —
   *  the thread's first bubble ("review the item(s) below"). Each mounts the
   *  SAME preview card the Estimate rail uses, collapsed to a name bar by
   *  default. In a filtered (item-selected) view only that one line shows. */
  private readonly briefMessageId = computed(() => this.selectedThread()?.messages[0]?.id ?? null);
  protected readonly cardsByMessage = computed(() => {
    const t = this.selectedThread();
    const briefId = this.briefMessageId();
    const map = new Map<string, QuoteLine[]>();
    if (!t || !briefId) return map;
    const selKey = this.selectedItem()?.itemId ?? null;
    const lines: QuoteLine[] = [];
    for (const it of t.items) {
      if (selKey && it.itemId !== selKey) continue;
      if (it.line) lines.push(it.line);
    }
    if (lines.length) map.set(briefId, lines);
    return map;
  });

  protected cardsFor(m: InboxBubble): QuoteLine[] {
    return this.cardsByMessage().get(m.id) ?? [];
  }
  /** The id of the LAST "New Cost Suggested" message in the current view — the
   *  revised card renders under this message only, so it appears ONCE (at the
   *  latest revision) instead of under every proposal in the history. */
  protected readonly lastProposalMessageId = computed<string | null>(() => {
    const msgs = this.visibleMessages();
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (/new cost suggested/i.test(msgs[i].body)) return msgs[i].id;
    }
    return null;
  });
  /** The revised item card(s) delivered with a "New Cost" message — the current
   *  line (supplier's edited name/description/services + revised price) for the
   *  item(s) the message proposed a new cost on. Only the LATEST proposal
   *  renders the card (it reflects the last-edited line), so it appears once. */
  protected proposalCardsFor(m: InboxBubble): QuoteLine[] {
    if (m.id !== this.lastProposalMessageId()) return [];
    const t = this.selectedThread();
    if (!t) return [];
    return t.items
      .filter((it) => it.itemId && m.taggedItemIds.includes(it.itemId) && it.line)
      .map((it) => it.line!);
  }


  /** Per-attachment expand state, keyed `<messageId>:<lineId>` so the same item
   *  can be open under one message and closed under another. */
  private readonly openAttachments = signal<ReadonlySet<string>>(new Set());
  protected isAttachmentOpen(messageId: string, lineId: string): boolean {
    return this.openAttachments().has(`${messageId}:${lineId}`);
  }
  protected toggleAttachment(messageId: string, lineId: string): void {
    const key = `${messageId}:${lineId}`;
    this.openAttachments.update((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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
  /** When set, the composed message ALSO declines this item id on send — armed
   *  by the Decline/Cancel action, which seeds the box with a reason to finish
   *  (mirrors Request Info). Cleared on send or when the selection changes. */
  protected readonly decliningId = signal<string | null>(null);

  /** Send the composed message in the given thread, then refresh so the new
   *  bubble appears. When a decline is armed, the reason is posted AND the item
   *  is marked declined in the same reply. */
  protected async send(threadId: string): Promise<void> {
    const text = this.draft().trim();
    if (!text || this.sending()) return;
    this.sending.set(true);
    try {
      const decId = this.decliningId();
      if (decId) {
        // The typed reason becomes the bubble; the action marks it declined.
        await firstValueFrom(this.inbox.reply(threadId, { text, itemActions: [{ itemId: decId, action: 'decline' }] }));
      } else {
        // A message composed with an item selected tags it; otherwise it's a
        // thread-level broadcast.
        const taggedItemId = this.selectedItem()?.itemId ?? undefined;
        await firstValueFrom(this.inbox.reply(threadId, { text, taggedItemId }));
      }
      this.draft.set('');
      this.decliningId.set(null);
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
  /** The proposed per-line install cost (raw value under the item's basis). */
  protected readonly proposeInstall = signal<number | null>(null);

  /** Terminal items are read-only (no actions). */
  protected isTerminal(status: string): boolean {
    return TERMINAL_STATUSES.has(status);
  }

  // ── pV2-BUILDUP-02 — supplier Customize (build the line from components) ──
  private readonly projects = inject(ProjectService);
  protected readonly customizing = signal<InboxThreadItem | null>(null);
  /** The live builder instance (present only while customizing) — used to
   *  save-before-switch when the user picks a different line. */
  private readonly customizeDialog = viewChild(CustomizeDialogComponent);
  /** The selected line's estimate (component cost) total — the header's
   *  "Customizations" figure. Loaded on selection (supplier viewer only). */
  protected readonly custoTotal = signal<number | null>(null);
  private readonly custoLoader = effect(() => {
    const it = this.selectedItem();
    if (this.isAgency() || !it) { this.custoTotal.set(null); return; }
    this.loadCustoTotal(it.id);
  });
  private loadCustoTotal(lineId: string): void {
    this.projects.getComponents(this.projectId(), lineId).subscribe({
      next: (res) => this.custoTotal.set(
        res.components.length ? res.components.reduce((s, c) => s + (c.selection_type === 'selected' ? (Number(c.base_price) || 0) * Math.max(1, c.quantity || 1) : 0), 0) : null
      ),
      error: () => this.custoTotal.set(null),
    });
  }
  protected openCustomize(it: InboxThreadItem): void { this.customizing.set(it); }
  protected isCustomizing(it: InboxThreadItem | null): boolean { return !!it && this.customizing()?.id === it.id; }
  /** Header toggle: open the inline estimate for this line, or close it. */
  protected toggleCustomize(it: InboxThreadItem): void {
    this.customizing.set(this.isCustomizing(it) ? null : it);
  }
  protected onCustomizeSaved(): void {
    const it = this.customizing();
    this.customizing.set(null);
    if (it) this.loadCustoTotal(it.id); // refresh the header figure
    this.threadsRes.reload(); // pull the revised price back in
  }
  /** Draft saved (estimate stays open) — reload so the thread header's revised
   *  total reflects the current buildup. */
  protected onCustomizeChanged(): void {
    const it = this.customizing();
    if (it) this.loadCustoTotal(it.id);
    this.threadsRes.reload();
  }
  /** Send New Cost — post the built-up total as a new-cost proposal (the same
   *  negotiation move as "Suggest New Cost": message + status + price). */
  protected async onSendCost(total: number): Promise<void> {
    const it = this.customizing();
    this.customizing.set(null);
    if (!it) return;
    const rate = total / (it.quantity || 1); // price_current is the per-unit rate
    const from = it.priceCurrent ?? it.priceRef ?? 0;
    await this.itemAction(it.id, 'adjust', rate, `${it.name} ${gbp(from)} New Cost Suggested ${gbp(total)} by ${this.actorName()}`);
    this.loadCustoTotal(it.id);
  }

  // ── Edit a line inline — the supplier clicks the read-only revised card and
  //    it becomes the shared <app-line-editor>. The read-only Details total
  //    reuses the same shared formatter. ────────────────────────────────────
  protected readonly editingLine = signal<QuoteLine | null>(null);
  protected readonly savingDetails = signal(false);

  /** Fallback currency symbol — a code, else the project currency, else £. */
  /** The client-facing line TOTAL shown as the preview headline. */
  protected isEditingLine(line: QuoteLine): boolean {
    return this.editingLine()?.id === line.id;
  }
  /** Supplier clicks the read-only revised card → open the inline editor.
   *  Agent view is read-only (no-op). */
  protected beginEdit(line: QuoteLine): void {
    if (this.isAgency()) return;
    this.editingLine.set(line);
  }
  protected cancelEdit(): void {
    this.editingLine.set(null);
  }
  /** Persist the edit. Text fields (name/unit/description/services/details) go
   *  via updateLineDetails; a PRICE change fires the same "New Cost Suggested"
   *  proposal as the propose flow (supplier→agent negotiation), keeping
   *  price_current + the chat line in sync. */
  protected async onLineSave(line: QuoteLine, edit: LineEdit): Promise<void> {
    if (this.savingDetails()) return;
    this.savingDetails.set(true);
    try {
      await firstValueFrom(this.projects.updateLineDetails(this.projectId(), line.id, {
        name: edit.name,
        unit: edit.unit,
        description: edit.description,
        services: edit.services,
        details: edit.details,
      }));
      const oldRate = line.basePrice ?? 0;
      const newRate = Number(edit.cost);
      if (Number.isFinite(newRate) && newRate >= 0 && Math.abs(newRate - oldRate) > 0.005) {
        const nm = edit.name?.trim() || line.name || 'Item';
        const fromTotal = lineCost(line);
        const newTotal = lineCost({ ...line, basePrice: newRate });
        await this.itemAction(line.id, 'adjust', newRate, `${nm} ${gbp(fromTotal)} New Cost Suggested ${gbp(newTotal)} by ${this.actorName()}`);
      }
      this.editingLine.set(null);
      this.threadsRes.reload();
    } catch {
      // Keep the editor open on failure; nothing cleared locally.
    } finally {
      this.savingDetails.set(false);
    }
  }

  protected accept(it: InboxThreadItem): void {
    this.disarmDecline(); // superseding action — see disarmDecline()
    const cost = it.priceCurrent ?? it.priceRef ?? 0;
    void this.itemAction(it.id, 'accept', undefined, `${it.name} ${gbp(cost)} Cost Accepted by ${this.actorName()}`);
  }
  /** Decline the item — marks it declined (never removed). Like Request Info,
   *  seed the compose box with the item + reason stem and focus it; the user
   *  finishes the reason and Sends, which posts it AND declines the line. The
   *  server maps `decline` to declined_by_supplier / declined_by_agent. */
  protected decline(it: InboxThreadItem): void {
    const verb = this.isAgency() ? 'Cancel' : 'Decline';
    this.decliningId.set(it.id);
    this.draft.set(`${it.name} — ${verb} because `);
    this.composeInput()?.nativeElement.focus();
  }
  protected startPropose(it: InboxThreadItem): void {
    this.disarmDecline(); // superseding action — see disarmDecline()
    // Negotiate the per-unit RATE + the install cost (pV2-UNIFY-01) — the line
    // total derives from both.
    this.proposePrice.set(it.unitPriceCurrent ?? it.unitPriceRef ?? 0);
    this.proposeInstall.set(it.installCost ?? null);
    this.proposing.set(true);
  }

  /** Cancel a pending decline.
   *
   *  ARMED-STATE HYGIENE (audit 2026-07-17 B1): `decline()` arms `decliningId` and
   *  the NEXT send() posts the decline. Every sibling action a user could
   *  plausibly reach instead — Accept, Suggest New Cost, Request Information —
   *  therefore has to disarm it, or clicking Decline then changing your mind
   *  silently declines the line on your next message. Request Info was the sharp
   *  one: it OVERWRITES the seeded reason text, so the only visible clue was gone
   *  and the user believed they'd asked a question.
   *
   *  Rule for anything added here later: any `xxxId` signal that one action arms
   *  must be cleared by every sibling action that can follow it. */
  private disarmDecline(): void {
    this.decliningId.set(null);
  }

  /** The item's unit as a plain label ("head", "linear m"). */
  protected unitLabel(it: InboxThreadItem): string {
    return it.unit ? it.unit.replace(/_/g, ' ') : 'unit';
  }

  /** Install-basis label for the breakdown ('' when the line isn't installed). */
  protected installLabel(it: InboxThreadItem): string {
    if (it.installed === false || !it.installCost) return '';
    switch (it.installUnit) {
      case 'percentage': return `${it.installCost}% install`;
      case 'per_order': return `${gbp(it.installCost)} install / order`;
      default: return `${gbp(it.installCost)} install / ${this.unitLabel(it)}`;
    }
  }

  /** Line total at a given per-unit rate + install cost — mirrors the server
   *  formula (rate × qty + install: per_order flat, percentage of subtotal,
   *  else per_item). `install` defaults to the line's current install cost. */
  protected lineTotalAt(it: InboxThreadItem, rate: number, install?: number | null): number {
    const qty = it.quantity ?? 1;
    const base = rate * qty;
    const ic = install === undefined ? it.installCost : install;
    if (it.installed === false || !ic) return base;
    switch (it.installUnit) {
      case 'per_order': return base + ic;
      case 'percentage': return base + base * (ic / 100);
      default: return base + ic * qty;
    }
  }

  /** Live line total for the rate + install being typed in the propose box. */
  protected readonly proposedTotal = computed<number | null>(() => {
    const it = this.selectedItem();
    const rate = this.proposePrice();
    return it && rate != null && rate >= 0 ? this.lineTotalAt(it, rate, this.proposeInstall()) : null;
  });

  /** Whether the selected line has an install charge to negotiate. */
  protected canInstall(it: InboxThreadItem): boolean {
    return it.installed !== false && it.installCost != null;
  }

  /** "Request Information" — seed the compose box with the item + cost so
   *  the supplier edits/adds detail, then send (chat-only; no status change). */
  private readonly composeInput = viewChild<ElementRef<HTMLInputElement>>('composeInput');
  protected requestInfo(it: InboxThreadItem): void {
    this.disarmDecline(); // superseding action — this OVERWRITES the decline stem
    const cost = it.priceCurrent ?? it.priceRef ?? 0;
    this.draft.set(`${it.name} ${gbp(cost)} `);
    this.composeInput()?.nativeElement.focus();
  }
  protected async submitPropose(it: InboxThreadItem): Promise<void> {
    // `price` is the new per-unit RATE (stored in price_current); the thread
    // bubble + header show the derived line total so the money reads clearly.
    const rate = this.proposePrice();
    if (rate == null || rate < 0) return;
    const install = this.proposeInstall();
    const fromTotal = it.priceCurrent ?? it.priceRef ?? 0;
    const newTotal = this.lineTotalAt(it, rate, install);
    await this.itemAction(it.id, 'adjust', rate, `${it.name} ${gbp(fromTotal)} New Cost Suggested ${gbp(newTotal)} by ${this.actorName()}`, install ?? undefined);
    this.proposing.set(false);
  }

  /** The acting user's name for the action chat line ("… by Ryan"). */
  private actorName(): string {
    const u = this.auth.user();
    return u?.displayName || u?.email || 'you';
  }

  /** A per-item action posts a matching chat line + the state change, then
   *  refreshes so the bubble + the item's pill update together. */
  private async itemAction(itemId: string, action: 'accept' | 'adjust', price?: number, text?: string, installCost?: number): Promise<void> {
    const thread = this.selectedThread();
    if (!thread || this.sending()) return;
    this.sending.set(true);
    try {
      await firstValueFrom(this.inbox.reply(thread.id, { text, itemActions: [{ itemId, action, price, installCost }] }));
      this.threadsRes.reload();
    } catch {
      // Retry on the next click; shared toast surface lands later.
    } finally {
      this.sending.set(false);
    }
  }

}

