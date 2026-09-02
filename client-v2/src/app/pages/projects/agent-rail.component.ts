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
          <!-- Opening options (radios). Accept / Decline run the existing handlers
               via the host; "Make a change" just invites a free-text prompt. -->
          <div role="radiogroup" class="mt-1 space-y-1.5">
            @if (context().canAccept) {
              <label class="flex cursor-pointer items-center gap-2.5 rounded-lg border border-hairline px-3 py-2 transition-colors hover:bg-fill">
                <input type="radio" name="agentOpt" (change)="pickOption('accept')" />
                <span class="bp-body-small text-text">Accept the cost</span>
              </label>
            }
            @if (context().canDecline) {
              <label class="flex cursor-pointer items-center gap-2.5 rounded-lg border border-hairline px-3 py-2 transition-colors hover:bg-fill">
                <input type="radio" name="agentOpt" (change)="pickOption('decline')" />
                <span class="bp-body-small text-text">{{ context().role === 'agent' ? 'Cancel the request' : 'Decline' }}</span>
              </label>
            }
            <label class="flex cursor-pointer items-center gap-2.5 rounded-lg border border-hairline px-3 py-2 transition-colors hover:bg-fill">
              <input type="radio" name="agentOpt" (change)="pickOption('change')" />
              <span class="bp-body-small text-text">Make a change</span>
            </label>
          </div>
          @if (changeMode()) {
            <p class="bp-caption text-muted">
              Tell me what to change — e.g.
              {{ context().role === 'agent' ? '“ask for a fridge”, “can we get 10% off?”' : '“set the base to £120”, “add insurance at £200”.' }}
            </p>
            @if (context().role === 'supplier') {
              <button type="button" class="bp-caption text-[var(--theme-accent)] hover:underline" (click)="quickAction.emit('customize')">Or open the full builder →</button>
            }
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
  readonly decline = output<void>();
  readonly suggestCost = output<number>();
  readonly sendMessage = output<string>();

  protected readonly turns = signal<Turn[]>([]);
  protected readonly changeMode = signal(false);
  protected readonly draft = signal('');

  /** Opening radio pick: accept/decline run via the host; "change" just invites
   *  a typed prompt (nothing destructive). */
  protected pickOption(key: 'accept' | 'decline' | 'change'): void {
    if (key === 'change') { this.changeMode.set(true); return; }
    this.quickAction.emit(key);
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
        currencySymbol: this.sym(), componentNames: ctx.componentNames, role: ctx.role,
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
      else if (a.type === 'decline') this.decline.emit();
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
    } else if (a.type === 'set_base_description') {
      description = a.text;
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
