import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { ProjectService, IntentAction, ComponentInput } from '../../core/projects/project.service';
import { revisedFromParts } from './quote-line.util';
import { currencySymbol } from '../../shared/details-format';

/** What the host hands the rail: the line it should act on + who's asking. */
export interface AgentRailContext {
  projectId: string;
  lineId: string;
  itemName: string | null;
  baseCost: number | null;   // per-unit price_ref
  unit: string | null;
  quantity: number | null;
  currentTotal: number | null;   // the line's current (revised) total
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
  imports: [FormsModule, LucideAngularModule],
  host: { class: 'contents' },
  template: `
    <div class="bp-card flex h-full min-h-0 flex-col p-0">
      <div class="flex items-center gap-2 border-b border-hairline px-4 py-3">
        <lucide-icon name="sparkles" [size]="16" class="text-[var(--theme-accent)]" />
        <span class="bp-list-title">Assistant</span>
      </div>

      <div class="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        @if (!turns().length) {
          <p class="bp-body-small text-secondary">
            Tell me what you'd like to do with <span class="text-text">{{ context().itemName || 'this item' }}</span> — pick an option below, or just send me a message.
          </p>

          <!-- Step 1: the three opening options. -->
          @if (step() === 'root') {
            <div role="radiogroup" class="mt-1 space-y-1.5">
              @if (context().canAccept) {
                <label class="flex cursor-pointer items-center gap-2.5 rounded-lg border border-hairline px-3 py-2 transition-colors hover:bg-fill"><input type="radio" name="agentOpt" (change)="step.set('accept')" /><span class="bp-body-small text-text">Accept the cost</span></label>
              }
              @if (context().canDecline) {
                <label class="flex cursor-pointer items-center gap-2.5 rounded-lg border border-hairline px-3 py-2 transition-colors hover:bg-fill"><input type="radio" name="agentOpt" (change)="step.set('decline')" /><span class="bp-body-small text-text">{{ context().role === 'agent' ? 'Cancel the request' : 'Decline' }}</span></label>
              }
              <label class="flex cursor-pointer items-center gap-2.5 rounded-lg border border-hairline px-3 py-2 transition-colors hover:bg-fill"><input type="radio" name="agentOpt" (change)="step.set('change')" /><span class="bp-body-small text-text">Make a change</span></label>
            </div>
          }

          <!-- Step 2: confirm accept. -->
          @if (step() === 'accept') {
            <p class="bp-body-small text-secondary">Accept the current cost@if (context().currentTotal != null) { of <span class="font-semibold text-text">{{ sym() }}{{ context().currentTotal!.toLocaleString('en-GB') }}</span>}?</p>
            <div class="flex gap-2 pt-1">
              <button type="button" class="bp-btn-outline" (click)="reset()">Back</button>
              <button type="button" class="bp-btn-grad flex-1" (click)="confirmAccept()">Accept</button>
            </div>
          }

          <!-- Step 2a: decline reasons (role-aware). -->
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
            <div class="flex gap-2 pt-1">
              <button type="button" class="bp-btn-outline" (click)="reset()">Back</button>
              <button type="button" class="bp-btn-grad flex-1" [disabled]="!reasonReady()" (click)="confirmDecline()">{{ context().role === 'agent' ? 'Cancel request' : 'Decline' }}</button>
            </div>
          }

          <!-- Step 2b: make-a-change sub-options. -->
          @if (step() === 'change') {
            <p class="bp-caption text-muted">What would you like to change?</p>
            <div role="radiogroup" class="space-y-1.5">
              <label class="flex cursor-pointer items-center gap-2.5 rounded-lg border border-hairline px-3 py-2 transition-colors hover:bg-fill"><input type="radio" name="chg" (change)="changeSel.set('suggest')" /><span class="bp-body-small text-text">Suggest new price</span></label>
              <label class="flex cursor-pointer items-center gap-2.5 rounded-lg border border-hairline px-3 py-2 transition-colors hover:bg-fill"><input type="radio" name="chg" (change)="changeSel.set('item')" /><span class="bp-body-small text-text">Change item</span></label>
              <label class="flex cursor-pointer items-center gap-2.5 rounded-lg border border-hairline px-3 py-2 transition-colors hover:bg-fill"><input type="radio" name="chg" (change)="changeSel.set('extras')" /><span class="bp-body-small text-text">Add extras</span></label>
            </div>
            <div class="flex gap-2 pt-1">
              <button type="button" class="bp-btn-outline" (click)="reset()">Back</button>
              <button type="button" class="bp-btn-grad flex-1" [disabled]="!changeSel()" (click)="confirmChange()">Continue</button>
            </div>
            @if (hint()) { <p class="bp-caption text-muted">{{ hint() }}</p> }
          }
        }
        @for (t of turns(); track $index) {
          @if (t.who === 'you') {
            <div class="ml-6 rounded-2xl rounded-br-sm bg-fill px-3 py-2">
              <p class="bp-body-small text-text">{{ t.text }}</p>
            </div>
          } @else {
            <div class="mr-6 space-y-2">
              @if (t.text) { <p class="bp-body-small text-secondary">{{ t.text }}</p> }
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
            </div>
          }
        }
        @if (busy()) { <p class="bp-caption text-muted">Thinking…</p> }
      </div>

      <div class="border-t border-hairline p-3">
        <div class="flex items-end gap-2">
          <textarea rows="2" class="bp-store-textarea flex-1" [placeholder]="'Message the assistant…'"
                    [ngModel]="draft()" (ngModelChange)="draft.set($event)"
                    (keydown.enter)="$event.preventDefault(); send()"></textarea>
          <button type="button" class="bp-btn-grad shrink-0" [disabled]="busy() || !draft().trim()" (click)="send()">
            <lucide-icon name="arrow-up" [size]="16" />
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
  /** Opening flow: root → decline (reasons) | change (sub-options). */
  protected readonly step = signal<'root' | 'accept' | 'decline' | 'change'>('root');
  protected readonly reasonSel = signal<string | null>(null);
  protected readonly changeSel = signal<'suggest' | 'item' | 'extras' | null>(null);
  protected readonly otherText = signal('');
  protected readonly hint = signal('');
  protected readonly draft = signal('');

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

  protected confirmAccept(): void { this.quickAction.emit('accept'); this.reset(); }
  protected reset(): void {
    this.step.set('root'); this.reasonSel.set(null); this.changeSel.set(null);
    this.otherText.set(''); this.hint.set('');
  }

  /** Confirm the decline with the picked reason (radios → a single action button). */
  protected confirmDecline(): void {
    const r = this.reasonSel();
    const reason = r === '__other' ? (this.otherText().trim() || 'Other') : (r || '');
    this.decline.emit(reason);
    this.reset();
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
      const actions = (res.actions ?? []).filter((a) => this.permitted(a));
      this.turns.update((t) => [...t, {
        who: 'assistant',
        text: res.reply || (actions.length ? '' : "I couldn't turn that into an action — try naming a cost, an extra, or accept/decline."),
        actions, suggestions: res.suggestions ?? [], applied: new Set<IntentAction>(),
      }]);
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
      this.turns.update((t) => [...t]); // reflect the "Done" state
    } catch {
      this.turns.update((t) => [...t, { who: 'assistant', text: "That didn't save — please try again or use the buttons." }]);
    } finally {
      this.applying.set(false);
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
