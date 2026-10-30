import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { InboxService, SupplierInboxItem } from '../../core/inbox/inbox.service';
import { lineDisplayCode } from '../../core/status/line-display-status';
import { StatusPillComponent } from '../status-pill/status-pill.component';

/** Supplier home — the "Inbox" panel (Liam 2026-10-30): the supplier's live line
 *  items across projects. Each row is the item name with the requesting agency,
 *  its status pill and price below, linking to that conversation. Replaces the
 *  Recent-projects card on the supplier home. Same .bp-card chrome, two columns. */
@Component({
  selector: 'app-supplier-inbox-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, StatusPillComponent],
  host: { class: 'bp-card bp-card--lifted bp-inboxcard' },
  template: `
    <div class="bp-inboxcard__body">
      <header class="bp-inboxcard__head">
        <h2 class="bp-card-title">Inbox</h2>
        <a routerLink="/inbox" class="bp-inboxcard__viewall">View inbox</a>
      </header>

      @if (loader.isLoading()) {
        <p class="bp-inboxcard__muted">Loading…</p>
      } @else if (loader.error()) {
        <p class="bp-inboxcard__muted">Couldn't load your inbox.</p>
      } @else if (items().length === 0) {
        <p class="bp-inboxcard__muted">No quote requests yet — an agency will reach out here.</p>
      } @else {
        <ul class="bp-inboxcard__list">
          @for (it of items(); track it.itemId) {
            <li>
              <a [routerLink]="['/inbox', it.projectId]" [queryParams]="{ item: it.itemId }" class="bp-inboxcard__row">
                <span class="bp-inboxcard__main">
                  <span class="bp-inboxcard__name">{{ it.name }}</span>
                  @if (it.agencyName) { <span class="bp-inboxcard__agency">{{ it.agencyName }}</span> }
                </span>
                <span class="bp-inboxcard__meta">
                  <app-status-pill list="line_display_status" [code]="pill(it)" />
                  @if (it.price != null) { <span class="bp-inboxcard__price">{{ money(it.price) }}</span> }
                </span>
              </a>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [
    `
      :host(.bp-inboxcard) { grid-column: span 2; }
      .bp-inboxcard__body { display: flex; flex-direction: column; gap: 16px; padding: 24px; height: 100%; }
      .bp-inboxcard__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .bp-inboxcard__head h2 { margin: 0; }
      .bp-inboxcard__viewall {
        flex: none; padding: 5px 14px; border: 1px solid var(--color-border-hairline);
        border-radius: var(--radius-pill); background: var(--color-surface); color: var(--color-text);
        text-decoration: none; font-family: var(--font-body); font-size: var(--text-sm);
        box-shadow: var(--shadow-md);
      }
      .bp-inboxcard__viewall:hover { background: var(--color-fill); box-shadow: var(--shadow-lg); }
      .bp-inboxcard__muted { margin: 0; color: var(--color-text-secondary); font-family: var(--font-body); font-size: var(--text-sm); }
      .bp-inboxcard__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
      .bp-inboxcard__row {
        display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0;
        border-top: 1px solid var(--color-border-hairline); text-decoration: none; color: var(--color-text);
      }
      .bp-inboxcard__list li:first-child .bp-inboxcard__row { border-top: none; }
      .bp-inboxcard__main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
      .bp-inboxcard__name { font-family: var(--font-body); font-size: var(--text-sm); font-weight: 500; }
      .bp-inboxcard__row:hover .bp-inboxcard__name { text-decoration: underline; }
      .bp-inboxcard__meta { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex: none; }
      .bp-inboxcard__agency { font-family: var(--font-body); font-size: var(--text-xs); color: var(--color-text-secondary); }
      .bp-inboxcard__price { font-family: var(--font-body); font-size: var(--text-xs); color: var(--color-text-secondary); white-space: nowrap; }
      @media (max-width: 1024px) { :host(.bp-inboxcard) { grid-column: 1 / -1; } }
    `,
  ],
})
export class SupplierInboxCardComponent {
  private readonly inbox = inject(InboxService);

  protected readonly loader = resource<SupplierInboxItem[], true>({
    params: () => true,
    loader: () => firstValueFrom(this.inbox.supplierInboxItems()),
  });
  protected readonly items = computed(() => this.loader.value() ?? []);

  /** The line_display_status pill code from the supplier's point of view. */
  protected pill(it: SupplierInboxItem): string {
    return lineDisplayCode(
      { status: it.status, buyerAccepted: it.buyerAccepted, sellerAccepted: it.sellerAccepted },
      'seller',
    );
  }

  protected money(value: number): string {
    try {
      return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value);
    } catch {
      return `£${value}`;
    }
  }
}
