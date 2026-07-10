import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { QuoteLine } from '../../core/projects/project.types';
import { QtyInputComponent } from './qty-input.component';
import { editable, hasInstall, isInstalled, lineCost, statusLabel, statusPill, unitPlain } from './quote-line.util';

/** pV2-CART-01 — one quote line row (thumb + name/status + cost·unit +
 *  Installed? + qty + line total + trash/lock). Read-only once out for quote.
 *  Extracted from project-estimate (audit M1). */
@Component({
  selector: 'app-estimate-item-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, LucideAngularModule, QtyInputComponent],
  host: {
    class: 'flex cursor-pointer items-center gap-3 border-b border-hairline px-3 py-3',
    '[class.bg-fill]': 'selected()',
    // Declined/cancelled lines dim — they stay on the Final Quote for the
    // record but are excluded from every total (pV2-INBOX-05).
    '[class.opacity-55]': 'isDeclined()',
    '(click)': 'select.emit()',
  },
  template: `
    @if (line().imageUrl) {
      <img [src]="line().imageUrl" alt="" class="h-16 w-16 shrink-0 rounded-[var(--radius-card)] object-cover" />
    } @else {
      <span class="bp-icon-block h-16 w-16 shrink-0"><lucide-icon name="store" [size]="22" /></span>
    }
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <span class="bp-list-title truncate">{{ line().name }}</span>
        @if (line().isCustom) {
          <span class="bp-pill bp-pill--muted shrink-0" title="Custom line — no catalogue backing until a supplier quotes it">Custom</span>
        }
        @if (isFinal()) {
          <span [class]="pill()">{{ label() }}</span>
        }
      </div>
      @if (line().basePrice != null || line().unit) {
        <div class="bp-meta mt-0.5">{{ line().basePrice != null ? (line().basePrice | currency: cur() : 'symbol' : '1.0-0') : '' }}@if (line().unit) { / {{ unitText() }} }</div>
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
    @if (canEdit()) {
      <app-qty-input class="shrink-0" [value]="line().quantity" [label]="line().name ?? 'item'" (qtyCommit)="qtyChange.emit($event)" />
    } @else {
      <span class="bp-body-small shrink-0 text-center text-secondary" title="Out for quote — change it in the inbox">× {{ line().quantity }}</span>
    }
    <span class="bp-body-small w-20 shrink-0 text-right text-secondary" [class.line-through]="isDeclined()" [class.text-muted]="isDeclined()"
          [title]="isDeclined() ? 'Declined — not included in the total' : ''">{{ cost() | currency: cur() : 'symbol' : '1.0-0' }}</span>
    @if (canEdit()) {
      <button type="button" class="shrink-0 rounded-md p-1 text-muted transition-colors hover:text-danger"
              (click)="$event.stopPropagation(); remove.emit()" [attr.aria-label]="'Remove ' + line().name" title="Remove item">
        <lucide-icon name="trash-2" [size]="15" />
      </button>
    } @else {
      <span class="shrink-0 p-1 text-muted" title="Out for quote — locked"><lucide-icon name="lock" [size]="14" /></span>
    }
  `,
})
export class EstimateItemRowComponent {
  readonly line = input.required<QuoteLine>();
  readonly isFinal = input<boolean>(false);
  readonly selected = input<boolean>(false);
  readonly cur = input.required<string>();
  readonly select = output<void>();
  readonly qtyChange = output<number>();
  readonly installToggle = output<void>();
  readonly remove = output<void>();

  protected readonly canEdit = computed(() => editable(this.line()));
  protected readonly canInstall = computed(() => hasInstall(this.line()));
  protected readonly installed = computed(() => isInstalled(this.line()));
  protected readonly cost = computed(() => lineCost(this.line()));
  protected readonly isDeclined = computed(() => this.line().status === 'declined');
  protected label(): string { return statusLabel(this.line()); }
  protected pill(): string { return statusPill(this.line()); }
  protected unitText(): string { return unitPlain(this.line().unit); }
}
