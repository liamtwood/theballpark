import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  resource,
  signal,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { firstValueFrom } from 'rxjs';
import { InboxService, ActiveAddContext } from '../../core/inbox/inbox.service';
import { AddToProjectItem } from './add-to-project-dialog.component';

/** pV2-STORE-ADD-ACTIVE-01 — adding an item to an ALREADY-LIVE project. The project
 *  is active, so the new line needs a supplier behind it: pick who prices it (the
 *  item's own supplier, or another supplier already on the project) and how the
 *  addition settles (final balance vs 50% up front — intent only, no payments yet),
 *  edit the brief, then "Add as ballpark and message". Parent-controlled: renders
 *  when both `item` and `projectId` are set. */
@Component({
  selector: 'app-add-to-active-project-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, FormsModule, DialogModule],
  template: `
    <p-dialog
      [visible]="!!item() && !!projectId()"
      (visibleChange)="onVisible($event)"
      styleClass="bp-modal"
      [closable]="true"
      [closeOnEscape]="true"
      [dismissableMask]="true"
      [modal]="true"
      [style]="{ width: '520px' }"
    >
      <ng-template pTemplate="header">
        @if (item(); as it) {
          <div>
            <h2 class="bp-card-title">Add {{ it.name }}</h2>
            <p class="bp-body-small mt-1 text-secondary">
              This project is already live, so a new item needs a supplier behind it.
              Choose who prices it — the cost stays a ballpark until it's agreed and paid.
            </p>
          </div>
        }
      </ng-template>

      @if (ctx.isLoading()) {
        <p class="bp-body-small py-2 text-secondary">Loading…</p>
      } @else if (ctx.error()) {
        <p class="bp-body-small py-2 text-warn">Couldn't load this project's suppliers.</p>
      } @else if (ctx.value(); as c) {
        <div class="flex flex-col gap-4 py-1">
          <!-- Settlement -->
          <div class="flex flex-col gap-2">
            <span class="bp-aap-label">How would you like to settle this addition?</span>
            <button type="button" class="bp-aap-opt" [class.bp-aap-opt--sel]="settlement() === 'balance'" (click)="settlement.set('balance')">
              <span class="bp-aap-radio" [class.bp-aap-radio--on]="settlement() === 'balance'"></span>
              <span class="min-w-0 flex-1 text-left">
                <span class="bp-aap-name">Add it to the final balance</span>
                <span class="bp-aap-sub">Nothing extra to pay now. Any deposit already paid stays as it is and the new value is settled with the balance.</span>
              </span>
            </button>
            <button type="button" class="bp-aap-opt" [class.bp-aap-opt--sel]="settlement() === 'deposit_50'" (click)="settlement.set('deposit_50')">
              <span class="bp-aap-radio" [class.bp-aap-radio--on]="settlement() === 'deposit_50'"></span>
              <span class="min-w-0 flex-1 text-left">
                <span class="bp-aap-name">Pay 50% up front @if (c.indicativePrice) { · {{ c.indicativePrice / 2 | currency: 'GBP' : 'symbol' : '1.0-0' }} }</span>
                <span class="bp-aap-sub">Best for bigger additions. Once the supplier agrees, the 50% becomes payable and the statement of work is redrafted for re-signing.</span>
              </span>
            </button>
          </div>

          <!-- Who prices it -->
          <div class="flex flex-col gap-2">
            <span class="bp-aap-label">Who should price it?</span>
            <!-- The item's own supplier. -->
            <button type="button" class="bp-aap-opt" [class.bp-aap-opt--sel]="supplier() === c.owner.orgId" (click)="supplier.set(c.owner.orgId)">
              <span class="bp-aap-radio" [class.bp-aap-radio--on]="supplier() === c.owner.orgId"></span>
              <span class="min-w-0 flex-1 text-left">
                <span class="bp-aap-name">Start a new conversation with {{ c.owner.name }}@if (c.owner.onProject) { (already on this project) }</span>
                <span class="bp-aap-sub">
                  @if (c.owner.onProject) {
                    Adds another item thread under this supplier.
                  } @else {
                    Full journey: agree the cost, both sign a statement of work, then a deposit link appears before they go live.
                  }
                </span>
              </span>
            </button>
            <!-- Other suppliers already on the project. -->
            @for (s of c.others; track s.orgId) {
              <button type="button" class="bp-aap-opt" [class.bp-aap-opt--sel]="supplier() === s.orgId" (click)="supplier.set(s.orgId)">
                <span class="bp-aap-radio" [class.bp-aap-radio--on]="supplier() === s.orgId"></span>
                <span class="min-w-0 flex-1 text-left">
                  <span class="bp-aap-name">Ask {{ s.name }} to quote for it</span>
                  <span class="bp-aap-sub">Already on the project — the item joins their existing thread and their statement of work is redrafted for the new total.</span>
                </span>
              </button>
            }
          </div>

          <!-- Brief message -->
          <div class="flex flex-col gap-1.5">
            <span class="bp-aap-label">Your message</span>
            <textarea class="bp-aap-textarea" rows="3" [ngModel]="message()" (ngModelChange)="message.set($event)"></textarea>
            @if (c.indicativePrice) {
              <span class="bp-aap-sub">Indicative marketplace price: {{ c.indicativePrice | currency: 'GBP' : 'symbol' : '1.0-0' }}{{ c.unit ? ' per ' + c.unit : '' }}</span>
            }
          </div>
        </div>
      }

      <ng-template pTemplate="footer">
        <button type="button" class="bp-btn-outline" (click)="close.emit()">Cancel</button>
        <button type="button" class="bp-btn-grad" [disabled]="busy() || !supplier()" (click)="confirm()">
          {{ busy() ? 'Adding…' : 'Add as ballpark and message' }}
        </button>
      </ng-template>
    </p-dialog>
  `,
  styles: [
    `
      .bp-aap-label { font-family: var(--bp-font); font-size: var(--text-sm); font-weight: 600; color: var(--color-text); }
      .bp-aap-opt {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        width: 100%;
        padding: 12px 14px;
        border: 1px solid var(--color-border-hairline);
        border-radius: var(--radius-lg);
        background: var(--color-surface);
        cursor: pointer;
        text-align: left;
      }
      .bp-aap-opt:hover { background: var(--color-fill); }
      .bp-aap-opt--sel { border-color: var(--theme-accent); background: var(--theme-soft); }
      .bp-aap-radio {
        flex: none;
        margin-top: 2px;
        width: 18px;
        height: 18px;
        border-radius: 999px;
        border: 2px solid var(--color-border-medium);
        background: var(--color-surface);
      }
      .bp-aap-radio--on {
        border-color: var(--theme-accent);
        background: radial-gradient(circle at center, var(--theme-accent) 0 5px, var(--color-surface) 6px);
      }
      .bp-aap-name { display: block; font-family: var(--bp-font); font-size: var(--text-base); font-weight: 600; color: var(--color-text); }
      .bp-aap-sub { display: block; font-family: var(--bp-font); font-size: var(--text-xs); color: var(--color-text-secondary); }
      .bp-aap-textarea {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid var(--color-border-hairline);
        border-radius: var(--radius-lg);
        background: var(--color-surface);
        font-family: var(--bp-font);
        font-size: var(--text-sm);
        color: var(--color-text);
        resize: vertical;
      }
    `,
  ],
})
export class AddToActiveProjectDialogComponent {
  private readonly inbox = inject(InboxService);

  readonly item = input<AddToProjectItem | null>(null);
  readonly projectId = input<string | null>(null);
  readonly close = output<void>();
  readonly added = output<{ projectId: string; itemName: string }>();

  protected readonly busy = signal(false);
  protected readonly settlement = signal<'balance' | 'deposit_50'>('balance');

  /** Dialog context — the item owner + existing suppliers. Loads when both the
   *  item and the project are set. */
  protected readonly ctx = resource<ActiveAddContext | null, { itemId: string; projectId: string } | null>({
    params: () => {
      const it = this.item();
      const pid = this.projectId();
      return it && pid ? { itemId: it.id, projectId: pid } : null;
    },
    loader: ({ params }) => (params ? firstValueFrom(this.inbox.activeAddContext(params.projectId, params.itemId)) : Promise.resolve(null)),
  });

  /** Default the supplier to the item's own owner once the context loads. */
  protected readonly supplier = linkedSignal<ActiveAddContext | null, string | null>({
    source: () => this.ctx.value() ?? null,
    computation: (c) => c?.owner.orgId ?? null,
  });

  /** The brief, pre-filled from the item + project names; editable. */
  protected readonly message = linkedSignal<ActiveAddContext | null, string>({
    source: () => this.ctx.value() ?? null,
    computation: (c) =>
      c ? `We'd like to add "${c.itemName}" to ${c.projectName ?? 'the project'}. Could you confirm availability and a price for this item?` : '',
  });

  protected onVisible(visible: boolean): void {
    if (!visible) this.close.emit();
  }

  protected async confirm(): Promise<void> {
    const it = this.item();
    const pid = this.projectId();
    const supplierOrgId = this.supplier();
    if (!it || !pid || !supplierOrgId) return;
    this.busy.set(true);
    try {
      await firstValueFrom(
        this.inbox.addToActiveProject(pid, {
          itemId: it.id,
          supplierOrgId,
          settlement: this.settlement(),
          message: this.message(),
        })
      );
      this.added.emit({ projectId: pid, itemName: it.name });
      this.close.emit();
    } catch (err) {
      console.warn('[AddToActiveProject] add failed', err);
    } finally {
      this.busy.set(false);
    }
  }
}
