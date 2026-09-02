import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { ProjectService, IntentAction, ComponentInput } from '../../core/projects/project.service';
import { revisedFromParts } from './quote-line.util';
import { currencySymbol } from '../../shared/details-format';
import { MarkdownPipe } from '../../shared/markdown.pipe';

/** What the host hands the rail: the line it should act on + who's asking. */
export interface AgentRailContext {
  projectId: string;
  lineId: string;
  itemName: string | null;
  baseCost: number | null;   // per-unit price_ref
  unit: string | null;
  quantity: number | null;
  currentTotal: number | null;   // the line's current (revised) total
  deliveryDate: string | null;   // the event/delivery date (already formatted)
  currentDescription: string | null;
  componentNames: string[];
  role: 'agent' | 'supplier';
  currencyCode: string | null;
  canAccept: boolean;
  canDecline: boolean;
}

interface Turn {
  who: 'you' | 'assistant';
  text: string;
  actions?: IntentAction[];
  suggestions?: string[];
  applied?: Set<IntentAction>;
  wrap?: boolean;         // offer "send them an update" after a change
  draft?: boolean;        // an editable message + Send button
  acceptConfirm?: boolean; // "Accept … and send a confirmation? [Back][Accept]"
  strong?: boolean;        // render the text bold/black
  concluded?: 'accepted' | 'declined' | 'sent'; // a terminal outcome + time-ago
  at?: number;             // timestamp for the time-ago label
}

/** pV2-INTENT-01 — the reusable conversational agent rail. You talk to it about
 *  the current line; it proposes confirm-first action chips (Apply/Send) and
 *  next-step suggestions. Buildup edits (base cost/description/extras) are applied
 *  in place via the existing saveComponents path; negotiation moves (accept /
 *  decline / suggest cost / send a drafted message) are emitted for the host,
 *  which owns the thread. Droppable on any page that can name a target line. */
@Component({
  selector: 'app-agent-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule, MarkdownPipe],
  host: { class: 'contents' },
  template: `
    <!-- display:flex inline — beats .bp-card's display:block so the flex-col
         layout works and the composer pins to the bottom. -->
    <div class="bp-card min-h-0 flex-1 flex-col p-0" style="display: flex">
      <div class="flex items-center gap-2 border-b border-hairline px-4 py-3">
        <lucide-icon name="sparkles" [size]="16" class="text-[var(--theme-accent)]" />
        <span class="bp-list-title">Assistant</span>
        <label class="ml-auto flex cursor-pointer items-center gap-1.5 bp-caption text-muted" title="Apply changes automatically instead of tapping Apply (accept/decline still ask).">
          <input type="checkbox" [ngModel]="autoApply()" (ngModelChange)="autoApply.set($event)" />
          Auto-apply
        </label>
      </div>

      <div class="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        @if (!turns().length) {
          <p class="bp-body-small text-secondary">
            Tell me what you'd like to do with <span class="text-text">{{ context().itemName || 'this item' }}</span> — pick an option below, or just send me a message.
          </p>
        }
        @for (t of turns(); track $index) {
          @if (t.who === 'you') {
            <div class="ml-6 rounded-2xl rounded-br-sm bg-fill px-3 py-2">
              <p class="bp-body-small text-text">{{ t.text }}</p>
            </div>
          } @else {
            <div class="mr-6 space-y-2">
              @if (t.text) { <div class="bp-md bp-body-small" [class.text-secondary]="!t.strong" [class.text-text]="t.strong" [class.font-semibold]="t.strong" [innerHTML]="t.text | md"></div> }
              @if (t.actions?.length) {
                <div class="flex flex-col gap-1.5">
                  @for (a of t.actions; track $index) {
                    <button type="button" class="flex items-center justify-between gap-2 rounded-lg border border-hairline px-3 py-2 text-left transition-colors hover:bg-fill disabled:opacity-50"
                            [disabled]="applying() || t.applied?.has(a)" (click)="apply(t, a)">
                      <span class="bp-body-small text-text">{{ label(a) }}</span>
                      <span class="bp-caption shrink-0">
                        {{ t.applied?.has(a) ? 'Done' : (isNegotiation(a) ? 'Send' : 'Apply') }}
                      </span>
                    </button>
                  }
                </div>
              }
              @if (t.suggestions?.length) {
                <div class="flex flex-wrap gap-1.5">
                  @for (s of t.suggestions; track $index) {
                    <button type="button" class="rounded-full border border-hairline px-2.5 py-1 bp-caption text-secondary transition-colors hover:bg-fill hover:text-text"
                            [disabled]="busy()" (click)="useSuggestion(s)">{{ s }}</button>
                  }
                </div>
              }
              @if (t.wrap) {
                <p class="bp-caption text-muted">Anything else you'd like to change? If not:</p>
                <button type="button" class="bp-send-btn" (click)="startDraft()">
                  <lucide-icon name="send" [size]="14" /> Send them an update
                </button>
              }
              @if (t.draft) {
                <textarea rows="4" class="bp-store-textarea w-full" [ngModel]="draftText()" (ngModelChange)="draftText.set($event)"></textarea>
                <button type="button" class="bp-send-btn" (click)="sendDraft()">
                  <lucide-icon name="send" [size]="14" /> Send
                </button>
              }
              @if (t.acceptConfirm) {
                <div class="flex items-center gap-3 pt-1">
                  <button type="button" class="bp-caption text-muted hover:text-text" (click)="dropTurn(t)">Back</button>
                  <button type="button" class="bp-send-btn" (click)="confirmAcceptDo(t)">Accept</button>
                </div>
              }
              @if (t.concluded) {
                <p class="bp-body-small font-semibold text-text">{{ t.concluded === 'accepted' ? 'Accepted' : (t.concluded === 'declined' ? 'Declined' : 'Sent') }} · {{ timeAgo(t.at!) }}</p>
              }
            </div>
          }
        }

        <!-- The opening options — shown initially and re-shown after a conclusion
             (so you're never left in limbo). -->
        @if (showOptions()) {
          @if (turns().length) { <p class="bp-body-small font-semibold text-text">Is there anything else?</p> }
          @if (step() === 'root') {
            <div role="radiogroup" class="space-y-1.5">
              @if (context().canAccept) {
                <label class="flex cursor-pointer items-center gap-2.5 rounded-lg border border-hairline px-3 py-2 transition-colors hover:bg-fill"><input type="radio" name="agentOpt" (change)="askAccept()" /><span class="bp-body-small text-text">Accept the cost</span></label>
              }
              @if (context().canDecline) {
                <label class="flex cursor-pointer items-center gap-2.5 rounded-lg border border-hairline px-3 py-2 transition-colors hover:bg-fill"><input type="radio" name="agentOpt" (change)="step.set('decline')" /><span class="bp-body-small text-text">{{ context().role === 'agent' ? 'Cancel the request' : 'Decline' }}</span></label>
              }
              <label class="flex cursor-pointer items-center gap-2.5 rounded-lg border border-hairline px-3 py-2 transition-colors hover:bg-fill"><input type="radio" name="agentOpt" (change)="step.set('change')" /><span class="bp-body-small text-text">Make a change</span></label>
            </div>
          }
          @if (step() === 'decline') {
            <p class="bp-caption text-muted">{{ context().role === 'agent' ? 'Why are you cancelling?' : 'Why are you declining?' }}</p>
            <div role="radiogroup" class="space-y-1.5">
              @for (r of declineReasons(); track r) {
                <label class="flex cursor-pointer items-center gap-2.5 rounded-lg border border-hairline px-3 py-2 transition-colors hover:bg-fill"><input type="radio" name="declineReason" (change)="reasonSel.set(r)" /><span class="bp-body-small text-text">{{ r }}</span></label>
              }
              <label class="flex cursor-pointer items-center gap-2.5 rounded-lg border border-hairline px-3 py-2 transition-colors hover:bg-fill"><input type="radio" name="declineReason" (change)="reasonSel.set('__other')" /><span class="bp-body-small text-text">Other…</span></label>
            </div>
            @if (reasonSel() === '__other') {
              <textarea rows="2" class="bp-store-textarea w-full" placeholder="Enter a reason…" [ngModel]="otherText()" (ngModelChange)="otherText.set($event)"></textarea>
            }
            <div class="flex items-center gap-3 pt-1">
              <button type="button" class="bp-caption text-muted hover:text-text" (click)="reset()">Back</button>
              <button type="button" class="bp-send-btn" [disabled]="!reasonReady()" (click)="confirmDecline()">{{ context().role === 'agent' ? 'Cancel request' : 'Decline' }}</button>
            </div>
          }
          @if (step() === 'change') {
            <p class="bp-caption text-muted">What would you like to change?</p>
            <div role="radiogroup" class="space-y-1.5">
              <label class="flex cursor-pointer items-center gap-2.5 rounded-lg border border-hairline px-3 py-2 transition-colors hover:bg-fill"><input type="radio" name="chg" (change)="changeSel.set('suggest')" /><span class="bp-body-small text-text">Suggest new price</span></label>
              <label class="flex cursor-pointer items-center gap-2.5 rounded-lg border border-hairline px-3 py-2 transition-colors hover:bg-fill"><input type="radio" name="chg" (change)="changeSel.set('item')" /><span class="bp-body-small text-text">Change item</span></label>
              <label class="flex cursor-pointer items-center gap-2.5 rounded-lg border border-hairline px-3 py-2 transition-colors hover:bg-fill"><input type="radio" name="chg" (change)="changeSel.set('extras')" /><span class="bp-body-small text-text">Add extras</span></label>
            </div>
            <div class="flex items-center gap-3 pt-1">
              <button type="button" class="bp-caption text-muted hover:text-text" (click)="reset()">Back</button>
              <button type="button" class="bp-send-btn" [disabled]="!changeSel()" (click)="confirmChange()">Continue</button>
            </div>
            @if (hint()) { <p class="bp-caption text-muted">{{ hint() }}</p> }
          }
        }
        @if (busy()) { <p class="bp-caption text-muted">Thinking…</p> }
      </div>

      <div class="border-t border-hairline p-3">
        <!-- Send lives INSIDE the field as an up-arrow (no separate button). -->
        <div class="relative">
          <textarea rows="2" class="bp-store-textarea w-full resize-none pr-11" placeholder="Message the assistant…"
                    [ngModel]="draft()" (ngModelChange)="draft.set($event)"
                    (keydown.enter)="$event.preventDefault(); send()"></textarea>
          <button type="button" aria-label="Send"
                  class="absolute bottom-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--theme-accent)] text-white transition-opacity disabled:opacity-40"
                  [disabled]="busy() || !draft().trim()" (click)="send()">
            <lucide-icon name="arrow-up" [size]="16" [strokeWidth]="2.5" />
          </button>
        </div>
      </div>
    </div>
  `,
})
export class AgentRailComponent {
  private readonly projects = inject(ProjectService);
  readonly context = input.required<AgentRailContext>();
  /** Opening radio picks + the supplier "open builder" link go to the host
   *  (keys: 'accept' | 'decline' | 'customize') → its existing handlers. */
  readonly quickAction = output<string>();
  /** A buildup edit was applied + persisted — the host should reload the line. */
  readonly changed = output<void>();
  readonly accept = output<void>();
  /** Decline/cancel with an optional reason (empty = no reason given). */
  readonly decline = output<string>();
  readonly suggestCost = output<number>();
  readonly sendMessage = output<string>();

  protected readonly turns = signal<Turn[]>([]);
  /** Re-show the opening options after a conclusion (accept/decline). */
  protected readonly menuOpen = signal(false);
  protected readonly showOptions = computed(() => !this.turns().length || this.menuOpen());
  /** Opening flow: root → decline (reasons) | change (sub-options). */
  protected readonly step = signal<'root' | 'accept' | 'decline' | 'change'>('root');
  protected readonly reasonSel = signal<string | null>(null);
  protected readonly changeSel = signal<'suggest' | 'item' | 'extras' | null>(null);
  protected readonly otherText = signal('');
  protected readonly hint = signal('');
  protected readonly draft = signal('');
  /** Short summaries of the changes made this session (for the update message). */
  private readonly changeLog = signal<string[]>([]);
  protected readonly draftText = signal('');
  /** Opt-in "let the Assistant do it": auto-apply the buildup edits (accept /
   *  decline / suggest / send still ask). Default off — confirm-first. */
  protected readonly autoApply = signal(false);

  /** The self-contained edits that are safe to auto-apply (no negotiation). */
  private isBuildup(a: IntentAction): boolean {
    return a.type === 'set_base_cost' || a.type === 'set_base_description' || a.type === 'upsert_extra';
  }

  /** Decline reasons depend on who's declining. */
  protected readonly declineReasons = computed(() =>
    this.context().role === 'agent'
      ? ['Over budget', 'No longer needed', 'Going another way']
      : ['Not available', 'Out of stock', "Can't provide this"]);
  /** The decline action button is enabled once a reason (or Other text) is set. */
  protected readonly reasonReady = computed(() => {
    const r = this.reasonSel();
    return !!r && (r !== '__other' || !!this.otherText().trim());
  });

  /** Ask to accept (radio OR typed): shows the total + delivery date and that a
   *  confirmation message will be sent, then Back / Accept. */
  protected askAccept(): void {
    const s = this.sym();
    const c = this.context();
    const total = c.currentTotal != null ? `**${s}${c.currentTotal.toLocaleString('en-GB')}**` : 'the current cost';
    const del = c.deliveryDate ? ` with delivery ${c.deliveryDate}` : '';
    this.reset();
    this.menuOpen.set(false); // hide the menu while confirming
    this.turns.update((t) => [...t, { who: 'assistant', text: `Accept ${total}${del} and send a confirmation message?`, acceptConfirm: true }]);
  }
  protected confirmAcceptDo(turn: Turn): void {
    turn.acceptConfirm = false; // collapse the buttons
    this.quickAction.emit('accept'); // host accepts + posts the confirmation message
    this.conclude('accepted');
  }
  protected dropTurn(turn: Turn): void {
    this.turns.update((t) => t.filter((x) => x !== turn));
    this.menuOpen.set(true); // backing out returns to the options, never a dead end
  }

  /** End a flow: a bold outcome line + time-ago, then re-open the options so the
   *  user isn't stuck. */
  private conclude(kind: 'accepted' | 'declined' | 'sent'): void {
    this.reset();
    this.turns.update((t) => [...t, { who: 'assistant', text: '', concluded: kind, at: Date.now() }]);
    this.menuOpen.set(true);
  }
  /** Relative time for a conclusion ("just now", "5 mins ago", "2 days ago"). */
  protected timeAgo(ts: number): string {
    const secs = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (secs < 45) return 'just now';
    const mins = Math.round(secs / 60);
    if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
    const days = Math.round(hrs / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }
  protected reset(): void {
    this.step.set('root'); this.reasonSel.set(null); this.changeSel.set(null);
    this.otherText.set(''); this.hint.set('');
  }

  /** Confirm the decline with the picked reason (radios → a single action button). */
  protected confirmDecline(): void {
    const r = this.reasonSel();
    const reason = r === '__other' ? (this.otherText().trim() || 'Other') : (r || '');
    this.decline.emit(reason);
    this.conclude('declined');
  }

  /** Continue from the make-a-change picks: Suggest opens the propose entry;
   *  Change item / Add extras drop a tailored hint to type the rest. */
  protected confirmChange(): void {
    const c = this.changeSel();
    if (c === 'suggest') { this.quickAction.emit('suggest'); this.reset(); return; }
    if (c === 'item') this.hint.set('Tell me what to change on the item — name, description, or base cost (e.g. “set the base to £120”).');
    else if (c === 'extras') this.hint.set('Tell me the extra to add — e.g. “add insurance at £200” or “wine pairing £15 a head”.');
  }
  protected readonly busy = signal(false);
  protected readonly applying = signal(false);
  protected readonly sym = computed(() => currencySymbol(this.context().currencyCode));

  protected isNegotiation(a: IntentAction): boolean {
    return a.type === 'accept_cost' || a.type === 'decline' || a.type === 'suggest_cost' || a.type === 'draft_message';
  }

  protected label(a: IntentAction): string {
    const s = this.sym();
    switch (a.type) {
      case 'set_base_cost': return `Set base cost to ${s}${a.amount.toLocaleString('en-GB')}`;
      case 'set_base_description': return 'Update the item description';
      case 'upsert_extra': {
        const bits = [a.name];
        if (a.cost != null) bits.push(`${s}${a.cost.toLocaleString('en-GB')}`);
        if (a.qty != null || a.unit) bits.push(`${a.qty ?? 1}${a.unit ? ' ' + a.unit : ''}`);
        return `Add / update: ${bits.join(' · ')}`;
      }
      case 'accept_cost': return 'Accept the cost';
      case 'decline': return 'Decline';
      case 'suggest_cost': return `Suggest a new cost of ${s}${a.amount.toLocaleString('en-GB')}`;
      case 'draft_message': return `Send: “${a.text.length > 80 ? a.text.slice(0, 80) + '…' : a.text}”`;
    }
  }

  protected async send(): Promise<void> {
    const text = this.draft().trim();
    if (!text || this.busy()) return;
    const ctx = this.context();
    this.menuOpen.set(false); // typing takes over from the options menu
    this.turns.update((t) => [...t, { who: 'you', text }]);
    this.draft.set('');
    this.busy.set(true);
    try {
      const res = await firstValueFrom(this.projects.parseIntent(ctx.projectId, ctx.lineId, text, {
        itemName: ctx.itemName, baseCost: ctx.baseCost, unit: ctx.unit, quantity: ctx.quantity,
        currencySymbol: this.sym(), componentNames: ctx.componentNames,
        currentDescription: ctx.currentDescription, role: ctx.role,
      }));
      // Only surface actions the current viewer may actually take.
      const all = (res.actions ?? []).filter((a) => this.permitted(a));
      const hasAccept = all.some((a) => a.type === 'accept_cost');
      // Accept goes through the same confirm step as the radio (not a plain chip).
      const actions = all.filter((a) => a.type !== 'accept_cost');
      const at: Turn = {
        who: 'assistant',
        text: res.reply || (all.length ? '' : "I couldn't turn that into an action — try naming a cost, an extra, or accept/decline."),
        actions, suggestions: res.suggestions ?? [], applied: new Set<IntentAction>(),
      };
      this.turns.update((t) => [...t, at]);
      if (hasAccept) this.askAccept();
      // "Let the Assistant do it": auto-apply the buildup edits (not negotiation).
      if (this.autoApply()) {
        for (const a of actions) { if (this.isBuildup(a)) await this.apply(at, a); }
      }
    } catch {
      this.turns.update((t) => [...t, { who: 'assistant', text: 'Sorry — I had trouble with that. Please try again.' }]);
    } finally {
      this.busy.set(false);
    }
  }

  protected useSuggestion(s: string): void { this.draft.set(s); void this.send(); }

  private permitted(a: IntentAction): boolean {
    const ctx = this.context();
    if (a.type === 'accept_cost') return ctx.canAccept;
    if (a.type === 'decline') return ctx.canDecline;
    // Supplier owns the buildup edits; the agent asks (draft_message) / counters.
    if (a.type === 'set_base_cost' || a.type === 'set_base_description' || a.type === 'upsert_extra') return ctx.role === 'supplier';
    return true; // suggest_cost / draft_message
  }

  protected async apply(turn: Turn, a: IntentAction): Promise<void> {
    if (this.applying() || turn.applied?.has(a)) return;
    this.applying.set(true);
    try {
      if (a.type === 'accept_cost') this.accept.emit();
      else if (a.type === 'decline') this.decline.emit('');
      else if (a.type === 'suggest_cost') this.suggestCost.emit(a.amount);
      else if (a.type === 'draft_message') this.sendMessage.emit(a.text);
      else { await this.applyBuildup(a); this.changed.emit(); }
      turn.applied?.add(a);
      // Echo back exactly what changed; buildup edits also log a summary and offer
      // to send the counterparty an update.
      const buildup = this.isBuildup(a);
      if (buildup) this.changeLog.update((l) => [...l, this.changeSummary(a)]);
      const done = this.confirmMessage(a);
      this.turns.update((t) => done ? [...t, { who: 'assistant', text: done, wrap: buildup }] : [...t]);
    } catch {
      this.turns.update((t) => [...t, { who: 'assistant', text: "That didn't save — please try again or use the buttons." }]);
    } finally {
      this.applying.set(false);
    }
  }

  /** A short third-person summary of a change, for the wrap-up update message. */
  private changeSummary(a: IntentAction): string {
    const s = this.sym();
    switch (a.type) {
      case 'set_base_description': return 'updated the description';
      case 'set_base_cost': return `set the base cost to ${s}${a.amount.toLocaleString('en-GB')}`;
      case 'upsert_extra': {
        let out = `added ${a.name}`;
        if (a.cost != null) out += ` at ${s}${a.cost.toLocaleString('en-GB')}`;
        if (a.unit) out += ` per ${a.unit}`;
        return out;
      }
      default: return '';
    }
  }

  /** "Send them an update" → draft an editable message from the change log. */
  protected startDraft(): void {
    const log = this.changeLog().filter(Boolean);
    const item = this.context().itemName || 'this item';
    this.draftText.set(log.length
      ? `Hi — I've updated ${item}: ${log.join('; ')}. Let me know if that works for you.`
      : `Hi — a quick update on ${item}.`);
    this.turns.update((t) => [...t, { who: 'assistant', text: "OK — I'll send them this message. Edit if you like, then Send:", draft: true }]);
  }
  /** Send the (edited) update message to the counterparty via the host. */
  protected sendDraft(): void {
    const txt = this.draftText().trim();
    if (!txt) return;
    this.sendMessage.emit(txt);
    this.changeLog.set([]);
    this.conclude('sent'); // "Sent · just now" + re-open the options
  }

  /** After applying, echo the exact change so the user can eyeball + confirm it. */
  private confirmMessage(a: IntentAction): string {
    const s = this.sym();
    switch (a.type) {
      case 'set_base_description': return `I updated the description to:\n\n${a.text}\n\nIs this what you wanted?`;
      case 'set_base_cost': return `I set the base cost to **${s}${a.amount.toLocaleString('en-GB')}**. Is this what you wanted?`;
      case 'upsert_extra': {
        const bits = [a.name];
        if (a.cost != null) bits.push(`${s}${a.cost.toLocaleString('en-GB')}`);
        if (a.qty != null || a.unit) bits.push(`${a.qty ?? 1}${a.unit ? ' ' + a.unit : ''}`);
        return `I added **${bits.join(' · ')}**. Is this what you wanted?`;
      }
      case 'accept_cost': return 'Done — I accepted the cost.';
      case 'decline': return 'Done — I declined.';
      case 'suggest_cost': return `I suggested a new cost of **${s}${a.amount.toLocaleString('en-GB')}**.`;
      case 'draft_message': return 'Sent your message.';
    }
  }

  /** Apply a base/description/extra edit in place, preserving the other
   *  components, via the existing saveComponents path (shared revised formula). */
  private async applyBuildup(a: IntentAction): Promise<void> {
    const ctx = this.context();
    // A description change is a direct field write — never touch components/price.
    if (a.type === 'set_base_description') {
      await firstValueFrom(this.projects.updateLineDetails(ctx.projectId, ctx.lineId, { description: a.text }));
      return;
    }
    const res = await firstValueFrom(this.projects.getComponents(ctx.projectId, ctx.lineId));
    const comps: ComponentInput[] = res.components.map((c) => ({
      id: c.id, categoryId: c.category_id, name: c.name, cost: c.base_price, unit: c.unit,
      quantity: c.quantity, kind: c.kind, included: c.selection_type === 'selected',
      description: c.description, image: c.image_url,
    }));
    let baseRate = ctx.baseCost;
    let description = res.parentDescription;
    const margin = res.marginPct ?? res.defaultMarginPct ?? 20;

    if (a.type === 'set_base_cost') {
      baseRate = a.amount;
    } else if (a.type === 'upsert_extra') {
      const hit = comps.find((c) => c.name.trim().toLowerCase() === a.name.trim().toLowerCase());
      if (hit) {
        if (a.cost != null) hit.cost = a.cost;
        if (a.qty != null) hit.quantity = Math.max(1, Math.round(a.qty));
        if (a.unit != null) hit.unit = a.unit;
        hit.included = true;
      } else {
        comps.push({ id: undefined, categoryId: null, name: a.name, cost: a.cost, unit: a.unit,
          quantity: a.qty != null ? Math.max(1, Math.round(a.qty)) : 1, kind: 'estimate', included: true });
      }
    }

    const baseQty = Math.max(1, ctx.quantity ?? 1);
    const costTotal = comps.filter((c) => c.included).reduce((s, c) => s + (c.cost ?? 0) * Math.max(1, c.quantity || 1), 0);
    const revised = revisedFromParts((baseRate ?? 0) * baseQty, costTotal, margin);
    await firstValueFrom(this.projects.saveComponents(ctx.projectId, ctx.lineId, comps, revised, margin, {
      name: res.parentName || ctx.itemName || undefined, description, services: res.parentServices,
      quantity: baseQty, unit: ctx.unit, unitPrice: baseRate,
    }));
  }
}
