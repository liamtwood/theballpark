import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { PageHeroComponent } from '../../shell/page-hero/page-hero.component';
import { StatusPillComponent } from '../../shared/status-pill/status-pill.component';
import { InboxService, InboxThread, InboxThreadItem } from '../../core/inbox/inbox.service';

/** pV2-INBOX-01 — the supplier's per-project conversation surface
 *  (/inbox/:projectId). Left rail = THEIR items, grouped by category and
 *  collapsed to a flat list when there's only one (the single-category
 *  rule); right pane = the conversation with the reaching-out agency
 *  (counterparty · project · status · total header, gradient/white
 *  bubbles, compose). Read-only first — compose + per-item Accept/Propose
 *  land in the next slices. */
@Component({
  selector: 'app-inbox-project',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, DatePipe, LucideAngularModule, PageHeroComponent, StatusPillComponent],
  host: { class: 'block bp-vpfit' },
  template: `
    <app-page-hero [back]="{ label: 'Back', href: '/projects', history: true }" title="Inbox" [subtitle]="heroSubtitle()" />

    <div class="bp-page-body">
      @if (threadsRes.isLoading()) {
        <p class="bp-body-small text-secondary">Loading…</p>
      } @else if (threadsRes.error()) {
        <p class="bp-body-small text-warn">Couldn't load this conversation — please refresh.</p>
      } @else if (threads().length === 0) {
        <p class="bp-body-small text-secondary">No quote requests in this project yet.</p>
      } @else {
        <div class="grid min-h-0 flex-1 grid-cols-1 gap-6 xl:grid-cols-[300px_1fr]">
          <!-- Left rail: their items (category-grouped only when >1). -->
          <div class="hidden min-h-0 xl:flex xl:flex-col xl:overflow-y-auto">
            @for (t of threads(); track t.id) {
              @if (!singleCategory() && t.categoryName) {
                <div class="bp-cart-cat-band mt-2 first:mt-0">{{ t.categoryName }}</div>
              }
              @for (it of t.items; track it.id) {
                <button
                  type="button"
                  class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left hover:bg-fill"
                  [class.bg-fill]="it.id === selectedId()"
                  (click)="selectedId.set(it.id)"
                >
                  <span class="min-w-0 flex-1">
                    <span class="bp-list-title block truncate">{{ it.name }}</span>
                    <span class="bp-meta">{{ (it.priceCurrent ?? it.priceRef) | currency: 'GBP' : 'symbol' : '1.0-0' }}</span>
                  </span>
                  <app-status-pill list="message_item_status" [code]="it.status" />
                </button>
              }
            }
          </div>

          <!-- Right pane: the selected item's category conversation. -->
          @if (selectedThread(); as t) {
            <div class="flex min-h-0 flex-col rounded-xl border border-hairline bg-surface">
              <!-- Header -->
              <div class="border-b border-hairline px-5 py-4">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <h2 class="bp-card-title text-lg">{{ t.agencyName ?? 'Agency' }}</h2>
                    <p class="bp-meta truncate">{{ t.projectName }}{{ t.categoryName ? ' · ' + t.categoryName : '' }} · {{ t.items.length }} item{{ t.items.length === 1 ? '' : 's' }}</p>
                  </div>
                  <span class="bp-pill shrink-0 border border-hairline bg-fill text-secondary">{{ statusLabel(t.status) }}</span>
                </div>
                <div class="mt-2 flex items-center gap-4">
                  <span class="bp-body-small font-semibold text-text">{{ t.total | currency: 'GBP' : 'symbol' : '1.0-0' }}</span>
                  @if (t.refCode) {
                    <span class="bp-meta">{{ t.refCode }}</span>
                  }
                </div>
              </div>

              <!-- Bubbles -->
              <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
                @for (m of t.messages; track m.id) {
                  <div class="flex flex-col" [class.items-end]="m.mine" [class.items-start]="!m.mine">
                    <div class="bp-bubble" [class.bp-bubble--mine]="m.mine">
                      <span class="bp-bubble__author">{{ m.author }}</span>
                      <span class="bp-bubble__body">{{ m.body }}</span>
                    </div>
                    <span class="bp-meta mt-1 px-1">{{ m.createdAt | date: 'shortTime' }}</span>
                  </div>
                }
              </div>

              <!-- Compose (read-only this slice — wired in the next one). -->
              <div class="border-t border-hairline px-4 py-3">
                <div class="flex items-center gap-2 rounded-full border border-hairline bg-fill px-3 py-1.5 opacity-60">
                  <lucide-icon name="paperclip" [size]="16" class="text-muted" />
                  <input class="flex-1 bg-transparent text-base outline-none" placeholder="Type your message…" disabled />
                  <span class="bp-send-circle"><lucide-icon name="send" [size]="15" /></span>
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .bp-bubble {
        max-width: 78%;
        border-radius: 14px;
        padding: 8px 12px;
        background: var(--color-surface);
        border: 1px solid var(--color-hairline);
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .bp-bubble--mine {
        background: var(--bp-gradient);
        border: none;
        color: var(--bp-text-on-gradient);
      }
      .bp-bubble__author {
        font-size: 11px;
        font-weight: 600;
        opacity: 0.85;
      }
      .bp-bubble__body {
        font-size: 14px;
        line-height: 1.5;
        white-space: pre-line;
      }
      .bp-send-circle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        border-radius: 9999px;
        background: var(--bp-gradient);
        color: var(--bp-text-on-gradient);
      }
    `,
  ],
})
export class InboxProjectComponent {
  private readonly inbox = inject(InboxService);
  private readonly route = inject(ActivatedRoute);

  private readonly projectId = toSignal(this.route.paramMap.pipe(map((p) => p.get('projectId') ?? '')), {
    initialValue: '',
  });

  protected readonly threadsRes = resource({
    params: () => this.projectId() || undefined,
    loader: ({ params }) => firstValueFrom(this.inbox.supplierThreads(params)),
  });
  protected readonly threads = computed<InboxThread[]>(() => this.threadsRes.value() ?? []);
  protected readonly singleCategory = computed(() => this.threads().length <= 1);

  /** Selected item drives the visible thread; defaults to the first item,
   *  resetting whenever the loaded threads change. */
  protected readonly selectedId = linkedSignal<InboxThread[], string | null>({
    source: this.threads,
    computation: (ts) => ts[0]?.items[0]?.id ?? null,
  });

  protected readonly selectedThread = computed<InboxThread | null>(() => {
    const ts = this.threads();
    const id = this.selectedId();
    return ts.find((t) => t.items.some((i) => i.id === id)) ?? ts[0] ?? null;
  });

  protected readonly selectedItem = computed<InboxThreadItem | null>(() => {
    const t = this.selectedThread();
    if (!t) return null;
    return t.items.find((i) => i.id === this.selectedId()) ?? t.items[0] ?? null;
  });

  protected readonly heroSubtitle = computed(
    () => this.threads()[0]?.projectName ?? 'Supplier conversations for this project.'
  );

  /** The supplier-side aggregate status as a friendly header label. */
  protected statusLabel(status: string): string {
    return AGG_STATUS_LABELS[status] ?? 'In Progress';
  }
}

const AGG_STATUS_LABELS: Record<string, string> = {
  action: 'Action needed',
  waiting: 'Awaiting agency',
  quoted: 'Quoted',
  booked: 'Booked',
  closed: 'Closed',
};
