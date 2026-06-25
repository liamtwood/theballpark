import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { PageConfigService } from '../../core/config/page-config.service';
import { PageHeroComponent } from '../../shell/page-hero/page-hero.component';
import { StatusPillComponent } from '../../shared/status-pill/status-pill.component';
import { InboxProjectSummary, InboxService, InboxThread, InboxThreadItem } from '../../core/inbox/inbox.service';

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
          <!-- Left rail: project context card + their items. -->
          <div class="hidden min-h-0 xl:flex xl:flex-col xl:gap-3 xl:overflow-y-auto">
            @if (project(); as p) {
              <div class="bp-card p-4">
                <h3 class="bp-list-title leading-snug">{{ p.clientName ? p.clientName + ' — ' : '' }}{{ p.name }}</h3>
                <div class="mt-2.5 flex items-center gap-1.5 text-secondary">
                  <lucide-icon name="calendar" [size]="14" [strokeWidth]="1.75" />
                  <span class="bp-body-small">{{ p.eventDate || 'Date TBC' }}</span>
                </div>
                <div class="mt-1.5 flex items-center gap-1.5 text-secondary">
                  <lucide-icon name="map-pin" [size]="14" [strokeWidth]="1.75" />
                  <span class="bp-body-small">{{ p.location || '—' }}</span>
                </div>
                <div class="mt-2 bp-meta">{{ p.agencyName }}</div>
              </div>
            }
            <!-- Always a tree header: the category name when there are
                 several, else "PROJECT ITEMS". Expand to reveal the items. -->
            @for (t of threads(); track t.id) {
              <button
                type="button"
                class="flex w-full items-center gap-1.5 px-2 pb-1 pt-3 text-left first:pt-1"
                (click)="toggle(t.id)"
              >
                <lucide-icon [name]="isExpanded(t.id) ? 'chevron-down' : 'chevron-right'" [size]="15" class="shrink-0 text-muted" />
                <span class="bp-field-label flex-1 uppercase tracking-wide">{{ headerLabel(t) }}</span>
                <span class="bp-meta">{{ t.items.length }}</span>
              </button>
              @if (isExpanded(t.id)) {
                @for (it of t.items; track it.id) {
                  <button
                    type="button"
                    class="flex w-full flex-col items-start gap-1.5 rounded-lg px-3 py-2.5 text-left hover:bg-fill"
                    [class.bg-fill]="it.id === selectedId()"
                    (click)="selectedId.set(it.id)"
                  >
                    <span class="bp-list-title w-full truncate">{{ it.name }}</span>
                    <app-status-pill list="message_item_status" [code]="it.status" />
                  </button>
                }
              }
            }
          </div>

          <!-- Right pane: the selected item's category conversation. -->
          @if (selectedThread(); as t) {
            <div class="flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-surface shadow-[var(--shadow-xs)]">
              <!-- Header — project name with original/revised cost beneath
                   (no agency line / status pill / category·items; that
                   context lives in the rail card). -->
              <div class="border-b border-hairline px-5 py-4">
                <h2 class="bp-card-title text-lg">{{ t.projectName }}</h2>
                <div class="mt-1.5 flex items-center gap-6">
                  <span>
                    <span class="bp-caption">Original</span>
                    <span class="bp-body-small ml-1.5 text-secondary">{{ t.originalTotal | currency: 'GBP' : 'symbol' : '1.0-0' }}</span>
                  </span>
                  <span>
                    <span class="bp-caption">Revised</span>
                    <span class="bp-body-small ml-1.5 font-semibold text-text">{{ t.revisedTotal | currency: 'GBP' : 'symbol' : '1.0-0' }}</span>
                  </span>
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

              <!-- Compose — the standard field chrome (catalogue-search
                   rhythm). Read-only this slice; wired in the next one. -->
              <div class="border-t border-hairline px-4 py-3">
                <div class="flex h-[42px] items-center gap-2 rounded-[var(--radius-field)] border border-hairline bg-surface px-3 shadow-[var(--shadow-xs)] focus-within:border-accent">
                  <button type="button" class="shrink-0 text-muted hover:text-text" aria-label="Attach a file" disabled>
                    <lucide-icon name="paperclip" [size]="16" />
                  </button>
                  <input
                    class="w-full border-none bg-transparent p-0 text-md outline-none ring-0 placeholder:text-muted focus:ring-0"
                    placeholder="Type your message…"
                    disabled
                  />
                  <button type="button" class="bp-send-circle shrink-0" aria-label="Send" disabled>
                    <lucide-icon name="send" [size]="15" />
                  </button>
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
  private readonly pageConfig = inject(PageConfigService);

  private readonly projectId = toSignal(this.route.paramMap.pipe(map((p) => p.get('projectId') ?? '')), {
    initialValue: '',
  });

  protected readonly threadsRes = resource({
    params: () => this.projectId() || undefined,
    loader: ({ params }) => firstValueFrom(this.inbox.supplierInbox(params)),
  });
  protected readonly project = computed<InboxProjectSummary | null>(() => this.threadsRes.value()?.project ?? null);
  protected readonly threads = computed<InboxThread[]>(() => this.threadsRes.value()?.threads ?? []);
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

  /** "<Project> conversations" — tracks the configurable event label. */
  protected readonly heroSubtitle = computed(() => `${this.pageConfig.eventLabel()} conversations`);

  /** Tree-header label: the category name when there's more than one
   *  category, else "PROJECT ITEMS". */
  protected headerLabel(t: InboxThread): string {
    return this.singleCategory() || !t.categoryName ? 'PROJECT ITEMS' : t.categoryName;
  }

  // Tree expansion — collapsed-by-id (default expanded so items show).
  private readonly collapsed = signal<ReadonlySet<string>>(new Set());
  protected isExpanded(id: string): boolean {
    return !this.collapsed().has(id);
  }
  protected toggle(id: string): void {
    this.collapsed.update((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
}
