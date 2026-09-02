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
  currentTotal: number | null;   // the line's current (revised) LINE total (incl install)
  currentUnitCost: number | null; // the current per-unit rate (price_current ?? price_ref)
  installCost: number | null;    // install amount (per the unit basis), else null
  installUnit: string | null;    // per_order | per_item | percentage
  installApplies: boolean;       // whether install is on for this line
  deliveryDate: string | null;   // the event/delivery date (already formatted)
  acceptedAt: number | null;     // when the current viewer's side accepted (ms), else null
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
              @if (context().canAccept || context().acceptedAt) {
                <label class="flex cursor-pointer items-center gap-2.5 rounded-lg border border-hairline px-3 py-2 transition-colors hover:bg-fill"><input type="radio" name="agentOpt" (change)="askAccept()" /><span class="bp-body-small text-text">Accept the cost @if (context().acceptedAt) { <span class="text-muted">(accepted {{ timeAgo(context().acceptedAt!) }})</span> }</span></label>
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
              <label class="flex cursor-pointer items-center gap-2.5 rounded-lg border border-hairline px-3 py-2 transition-colors hover:bg-fill"><input type="radio" name="chg" (change)="pickChange('suggest')" /><span class="bp-body-small text-text">Suggest new price</span></label>
              <label class="flex cursor-pointer items-center gap-2.5 rounded-lg border border-hairline px-3 py-2 transition-colors hover:bg-fill"><input type="radio" name="chg" (change)="pickChange('item')" /><span class="bp-body-small text-text">Change item</span></label>
              <label class="flex cursor-pointer items-center gap-2.5 rounded-lg border border-hairline px-3 py-2 transition-colors hover:bg-fill"><input type="radio" name="chg" (change)="pickChange('extras')" /><span class="bp-body-small text-text">Add extras</span></label>
            </div>
            @if (hint()) { <p class="bp-caption text-muted">{{ hint() }}</p> }
            <button type="button" class="bp-caption text-muted hover:text-text" (click)="reset()">Back</button>
          }
          @if (step() === 'suggest') {
            <p class="bp-caption text-muted">Suggest a new price:</p>
            <div class="space-y-2">
              <label class="flex items-center justify-between gap-3">
                <span class="bp-body-small text-secondary">New cost</span>
                <input type="number" min="0" max="1000000" class="h-9 w-32 rounded-[var(--radius-field)] border border-hairline bg-surface px-2.5 text-right text-md tabular-nums leading-none outline-none focus:border-accent"
                       [ngModel]="sugCost()" (ngModelChange)="sugCost.set($event); reseedTotal(); reseedMsg()" />
              </label>
              <label class="flex items-center justify-between gap-3">
                <span class="bp-body-small text-secondary">Qty</span>
                <input type="number" min="1" max="1000000" class="h-9 w-32 rounded-[var(--radius-field)] border border-hairline bg-surface px-2.5 text-right text-md tabular-nums leading-none outline-none focus:border-accent"
                       [ngModel]="sugQty()" (ngModelChange)="sugQty.set($event); reseedTotal(); reseedMsg()" />
              </label>
              <label class="flex items-center justify-between gap-3">
                <span class="bp-body-small text-secondary">Unit</span>
                <select class="h-9 w-32 rounded-[var(--radius-field)] border border-hairline bg-surface px-2.5 text-md leading-normal outline-none focus:border-accent"
                        [ngModel]="sugUnit()" (ngModelChange)="sugUnit.set($event || null)">
                  <option [ngValue]="null">—</option>
                  @for (u of units; track u) { <option [ngValue]="u">{{ u }}</option> }
                </select>
              </label>
              @if (context().installCost) {
                <label class="flex cursor-pointer items-center justify-between gap-3">
                  <span class="bp-body-small text-secondary">Install <span class="text-muted">({{ installLabel() }})</span></span>
                  <input type="checkbox" [ngModel]="sugInstall()" (ngModelChange)="sugInstall.set($event); reseedTotal(); reseedMsg()" />
                </label>
              }
              <div class="flex items-center justify-between gap-3 border-t border-hairline pt-2">
                <span class="bp-body-small text-secondary">Total</span>
                <div class="relative">
                  <span class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 bp-body-small text-muted">{{ sym() }}</span>
                  <input type="number" min="0" max="10000000" class="h-9 w-32 rounded-[var(--radius-field)] border border-hairline bg-surface pl-6 pr-2.5 text-right text-md font-semibold tabular-nums leading-none outline-none focus:border-accent"
                         [ngModel]="sugTotal()" (ngModelChange)="sugTotal.set($event); totalTouched.set(true); sugCost.set(null); sugInstall.set(false); reseedMsg()" />
                </div>
              </div>
            </div>
            <p class="bp-caption text-muted mt-1">Message to send:</p>
            <textarea rows="3" class="bp-store-textarea w-full" [ngModel]="sugMessage()" (ngModelChange)="sugMessage.set($event); msgTouched.set(true)"></textarea>
            <div class="flex items-center gap-3 pt-1">
              <button type="button" class="bp-caption text-muted hover:text-text" (click)="reset()">Back</button>
              <button type="button" class="bp-send-btn" [disabled]="!sugTotal()" (click)="confirmSuggest()">Send</button>
            </div>
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
  readonly suggestCost = output<{ total: number; message: string; installed: boolean }>();
  readonly sendMessage = output<string>();

  protected readonly turns = signal<Turn[]>([]);
  /** Re-show the opening options after a conclusion (accept/decline). */
  protected readonly menuOpen = signal(false);
  protected readonly showOptions = computed(() => !this.turns().length || this.menuOpen());
  /** Opening flow: root → decline (reasons) | change (sub-options). */
  protected readonly step = signal<'root' | 'accept' | 'decline' | 'change' | 'suggest'>('root');
  /** Suggest-new-price form state. */
  protected readonly sugCost = signal<number | null>(null);
  protected readonly sugQty = signal<number>(1);
  protected readonly sugUnit = signal<string | null>(null);
  protected readonly sugMessage = signal('');
  protected readonly msgTouched = signal(false);
  /** Total is editable: it tracks cost × qty until the user overrides it. */
  protected readonly sugTotal = signal(0);
  protected readonly totalTouched = signal(false);
  /** Whether install is included in the revised price (checkbox). */
  protected readonly sugInstall = signal(true);
  /** Human label for the install basis ("10%", "£X / order", "£X / head"). */
  protected installLabel(): string {
    const c = this.context();
    if (c.installCost == null) return '';
    if (c.installUnit === 'percentage') return `${c.installCost}%`;
    if (c.installUnit === 'per_order') return `${this.sym()}${c.installCost} / order`;
    return `${this.sym()}${c.installCost} / ${c.unit || 'unit'}`;
  }
  /** Add install to a goods subtotal (matching the line-total formula) when the
   *  Install checkbox is on. */
  private withInstall(goods: number): number {
    const c = this.context();
    if (!this.sugInstall() || c.installCost == null) return goods;
    switch (c.installUnit) {
      case 'per_order': return goods + c.installCost;
      case 'percentage': return goods + goods * (c.installCost / 100);
      default: return goods + c.installCost * Math.max(1, this.sugQty() || 1); // per_item
    }
  }
  /** Recompute the LINE total (cost × qty + install) unless the user overrode it. */
  protected reseedTotal(): void {
    if (this.totalTouched()) return;
    const goods = (Number(this.sugCost()) || 0) * Math.max(1, Number(this.sugQty()) || 1);
    this.sugTotal.set(Math.round(this.withInstall(goods)));
  }
  /** Unit picklist (mirrors the customize builder's list). */
  protected readonly units = ['day', 'hour', 'week', 'night', 'head', 'cover', 'each', 'unit', 'sheet', 'length', 'm', 'kg', 'litre', 'roll', 'pack', 'box', 'hire', 'job', 'lot'];
  /** Keep the suggest message in sync with the total until the user edits it. */
  protected reseedMsg(): void {
    if (this.msgTouched()) return;
    const item = this.context().itemName || 'This item';
    this.sugMessage.set(`${item} cost updated to ${this.sym()}${this.sugTotal().toLocaleString('en-GB')}, please see the updated item attached.`);
  }
  protected readonly reasonSel = signal<string | null>(null);
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
    this.step.set('root'); this.reasonSel.set(null);
    this.otherText.set(''); this.hint.set('');
  }

  /** Confirm the decline with the picked reason (radios → a single action button). */
  protected confirmDecline(): void {
    const r = this.reasonSel();
    const reason = r === '__other' ? (this.otherText().trim() || 'Other') : (r || '');
    this.decline.emit(reason);
    this.conclude('declined');
  }

  /** A make-a-change pick auto-advances (no Continue): Suggest opens the price
   *  form; Change item / Add extras drop a tailored hint to type the rest. */
  protected pickChange(kind: 'suggest' | 'item' | 'extras'): void {
    if (kind === 'suggest') {
      // Open the in-Assistant price form (New cost · Qty · Unit · Total + message).
      // Seed from the CURRENT price so a prior suggestion shows, not the original.
      this.sugCost.set(this.context().currentUnitCost ?? null);
      this.sugQty.set(this.context().quantity ?? 1);
      this.sugUnit.set(this.context().unit ?? null);
      this.sugInstall.set(this.context().installApplies);
      this.totalTouched.set(false);
      this.msgTouched.set(false);
      this.reseedTotal();
      this.reseedMsg();
      this.step.set('suggest');
      return;
    }
    this.hint.set(kind === 'item'
      ? 'Tell me what to change on the item — name, description, or base cost (e.g. “set the base to £120”).'
      : 'Tell me the extra to add — e.g. “add insurance at £200” or “wine pairing £15 a head”.');
  }
  /** Send the suggested new price (line total = cost × qty) + the message. */
  protected confirmSuggest(): void {
    this.suggestCost.emit({ total: this.sugTotal(), message: this.sugMessage().trim(), installed: this.sugInstall() });
    this.conclude('sent');
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
      else if (a.type === 'suggest_cost') this.suggestCost.emit({ total: a.amount, message: `${this.context().itemName || 'This item'} cost updated to ${this.sym()}${a.amount.toLocaleString('en-GB')}, please see the updated item attached.`, installed: this.context().installApplies });
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
