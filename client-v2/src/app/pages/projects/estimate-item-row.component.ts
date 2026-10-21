import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { QuoteLine } from '../../core/projects/project.types';
import { QtyInputComponent } from './qty-input.component';
import { editable, hasInstall, isDeclined, isInstalled, lineCost, statusLabel, statusPill, unitPlain, unitPrice } from './quote-line.util';

/** pV2-CART-01 — one quote line row (thumb + name/status + cost·unit +
 *  Installed? + qty + line total + trash/lock). Read-only once out for quote.
 *  Extracted from project-estimate (audit M1). */
@Component({
  selector: 'app-estimate-item-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, LucideAngularModule, QtyInputComponent],
  // One row = the shared estimate grid (ITEM | QTY | COSTED BY | QUICK VIEW |
  // BALLPARK | trash), aligned to the column-header row in project-estimate via
  // the same .bp-estimate-grid template. Full-width with only a BOTTOM hairline
  // divider — no side border, no per-row card (Liam, 2026-10-15).
  host: {
    class: 'bp-estimate-grid border-b border-hairline px-3 py-3',
    '[class.bp-eir--selected]': 'selected()',
    // Declined/cancelled lines dim — they stay on the Final Quote for the
    // record but are excluded from every total (pV2-INBOX-05).
    '[class.opacity-55]': 'isDeclined()',
  },
  // Only the image + name + Quick view open the item preview (Liam QC) — the row
  // carries interactive controls (qty, Installed?, remove), so a whole-row click
  // kept opening the preview by accident.
  template: `
    <!-- ITEM — thumb + name (+ Custom/status/variant) + per-unit price + install -->
    <div class="flex min-w-0 items-start gap-3">
      @if (line().imageUrl) {
        <img [src]="line().imageUrl" alt="" role="button" tabindex="0" [attr.aria-label]="'View ' + line().name"
             class="h-14 w-14 shrink-0 cursor-pointer rounded-[var(--radius-field)] object-cover"
             (click)="select.emit()" (keydown.enter)="select.emit()" />
      } @else {
        <span class="bp-icon-block h-14 w-14 shrink-0 cursor-pointer" role="button" tabindex="0" [attr.aria-label]="'View ' + line().name"
              (click)="select.emit()" (keydown.enter)="select.emit()"><lucide-icon name="store" [size]="20" /></span>
      }
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <span class="bp-list-title cursor-pointer truncate hover:underline" role="button" tabindex="0"
                (click)="select.emit()" (keydown.enter)="select.emit()">{{ line().name }}</span>
          @if (line().isCustom) {
            <span class="bp-pill bp-pill--muted shrink-0" title="Custom line — no catalogue backing until a supplier quotes it">Custom</span>
          }
          <!-- Send-status only for lines that actually go to a supplier. An
               agent's own custom line (no supplier) never gets sent. -->
          @if (isFinal() && line().supplierId) {
            <span [class]="pill()">{{ label() }}</span>
          }
        </div>
        <!-- pV2-STORE-VARIANTS-UPCHARGE-01 — the chosen variant ("Ivory · Bedazzled"). -->
        @if (line().variant?.label) {
          <div class="bp-meta mt-0.5 truncate text-secondary"><lucide-icon name="layers" [size]="12" class="mr-1 inline align-[-1px]" />{{ line().variant!.label }}</div>
        }
        @if (line().basePrice != null) {
          <div class="bp-meta mt-0.5 truncate text-secondary">{{ displayUnit() | currency: cur() : 'symbol' : '1.0-2' }}@if (line().unit) { per {{ unitText() }} }</div>
        }
        <label class="mt-1.5 flex w-fit items-center gap-2.5" [class.opacity-40]="!canInstall() || !canEdit()"
               [title]="canInstall() ? 'Include installation' : 'No install price'">
          @if (canInstall()) {
            <!-- Install price + basis, so the agent sees what install costs. -->
            <span class="bp-meta text-secondary">
              @if (line().installUnit === 'percentage') {
                {{ line().installCost }}% install
              } @else {
                {{ line().installCost | currency: cur() : 'symbol' : '1.0-2' }} install@if (line().installUnit === 'per_order') { / order } @else { / {{ unitText() }} }
              }
            </span>
          }
          <span class="bp-meta">Installed?</span>
          <input type="checkbox" class="bp-check" [checked]="installed()" [disabled]="!canInstall() || !canEdit()" (change)="installToggle.emit()" />
        </label>
      </div>
    </div>

    <!-- QTY -->
    @if (canEdit()) {
      <!-- Stop clicks in the qty control from bubbling to the row's select
           (which opens the item preview) — you're editing qty, not opening. -->
      <app-qty-input [value]="line().quantity" [label]="line().name ?? 'item'"
                     (click)="$event.stopPropagation()" (qtyCommit)="qtyChange.emit($event)" />
    } @else {
      <span class="bp-body-small text-secondary" title="Out for quote — change it in the inbox">× {{ line().quantity }}</span>
    }

    <!-- COSTED BY — the supplier (catalogue owner); custom lines have none. -->
    <span class="bp-meta min-w-0 truncate text-secondary" [title]="line().supplierName ?? ''">{{ line().supplierName || (line().isCustom ? '—' : 'Supplier') }}</span>

    <!-- QUICK VIEW — opens the same item preview as the name/thumb. -->
    <button type="button" class="bp-pill bp-pill--accent justify-self-start" (click)="$event.stopPropagation(); select.emit()" [attr.aria-label]="'Quick view ' + line().name">Quick view</button>

    <!-- BALLPARK — the line total. -->
    <span class="bp-body-small tabular-nums text-secondary" [class.line-through]="isDeclined()" [class.text-muted]="isDeclined()"
          [title]="isDeclined() ? 'Declined — not included in the total' : ''">{{ displayCost() | currency: cur() : 'symbol' : '1.0-0' }}</span>

    <!-- trash / lock -->
    @if (canEdit()) {
      <button type="button" class="justify-self-start rounded-md p-1 text-muted transition-colors hover:text-danger"
              (click)="$event.stopPropagation(); remove.emit()" [attr.aria-label]="'Remove ' + line().name" title="Remove item">
        <lucide-icon name="trash-2" [size]="15" />
      </button>
    } @else {
      <span class="justify-self-start p-1 text-muted" title="Out for quote — locked"><lucide-icon name="lock" [size]="14" /></span>
    }
  `,
  styles: [
    `
      /* Borderless row: a left accent bar marks the selected line (no full
         border/ring now that the rows are divider-separated). */
      :host(.bp-eir--selected) {
        box-shadow: inset 3px 0 0 var(--theme-accent);
      }
    `,
  ],
})
export class EstimateItemRowComponent {
  readonly line = input.required<QuoteLine>();
  /** Display markup (1 + margin%) — hard-cost lines show the marked-up price the
   *  client sees; the raw supplier price stays in the inbox. Fees pass 1. */
  readonly markup = input<number>(1);
  readonly isFinal = input<boolean>(false);
  readonly selected = input<boolean>(false);
  readonly cur = input.required<string>();
  readonly select = output<void>();
  readonly qtyChange = output<number>();
  readonly installToggle = output<void>();
  readonly remove = output<void>();
  readonly options = output<void>();

  protected readonly canEdit = computed(() => editable(this.line()));
  protected readonly canInstall = computed(() => hasInstall(this.line()));
  protected readonly installed = computed(() => isInstalled(this.line()));
  protected readonly cost = computed(() => lineCost(this.line()));
  /** Marked-up unit price + line total for display (raw × markup). Unit uses the
   *  volume-tier price at the current qty (BE-00105) so unit × qty reconciles
   *  with the displayed line total. */
  protected displayUnit(): number { return unitPrice(this.line()) * this.markup(); }
  protected displayCost(): number { return this.cost() * this.markup(); }
  protected readonly isDeclined = computed(() => isDeclined(this.line()));
  protected label(): string { return statusLabel(this.line()); }
  protected pill(): string { return statusPill(this.line()); }
  protected unitText(): string { return unitPlain(this.line().unit); }
}
