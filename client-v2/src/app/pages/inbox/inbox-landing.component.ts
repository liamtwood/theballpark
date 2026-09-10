import { ChangeDetectionStrategy, Component, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { InboxService, InboxSummaryRow } from '../../core/inbox/inbox.service';
import { PageHeroComponent } from '../../shell/page-hero/page-hero.component';

/** pV2-INBOX (Messages landing) — /inbox for the agency: one card per active
 *  project it's negotiating, each listing its suppliers and a SINGLE project
 *  status pill. "Action Required" when the agent has ≥1 item to respond to;
 *  hovering the pill breaks down the waiting counts. Click → the project inbox.
 *  Layout follows the Past projects standard (bp-vpfit + centred 2-wide grid). */
@Component({
  selector: 'app-inbox-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideAngularModule, PageHeroComponent],
  host: { class: 'block bp-vpfit' },
  template: `
    <app-page-hero
      align="block"
      eyebrow="Messages"
      title="Your conversations"
      subtitle="Projects you're negotiating with suppliers."
    />

    <div class="bp-page-body">
      <div class="min-h-0 overflow-y-auto md:flex-1">
        @if (rows.isLoading()) {
          <p class="bp-body-small text-secondary">Loading…</p>
        } @else if (rows.error()) {
          <p class="bp-body-small text-warn">Couldn't load your messages.</p>
        } @else if ((rows.value() ?? []).length === 0) {
          <p class="bp-body-small text-secondary">No active conversations yet. Send a project out for quotes to start one.</p>
        } @else {
          <div class="mx-auto grid w-full max-w-[var(--workspace-max)] grid-cols-1 gap-6 sm:grid-cols-2">
            @for (row of rows.value(); track row.id) {
              <a [routerLink]="['/inbox', row.id]" class="bp-card bp-card--lifted block no-underline text-text" [attr.aria-label]="row.name">
                <div class="flex flex-col gap-3 p-5">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <div class="bp-card-title truncate">{{ row.name }}</div>
                      @if (row.clientName) {
                        <div class="bp-meta truncate">{{ row.clientName }}</div>
                      }
                    </div>
                    <span class="shrink-0 bp-pill bp-body-small" [class]="pillClass(row)" [title]="hoverText(row)">
                      {{ pillLabel(row) }}
                    </span>
                  </div>

                  <!-- Suppliers on the project — collapsed behind a toggle. -->
                  @if (row.suppliers.length) {
                    <div>
                      <button type="button" class="inline-flex items-center gap-1 bp-body-small text-secondary transition-colors hover:text-text"
                              (click)="toggle(row.id, $event)">
                        <lucide-icon [name]="isOpen(row.id) ? 'chevron-down' : 'chevron-right'" [size]="15" />
                        {{ isOpen(row.id) ? 'Hide suppliers' : 'Show suppliers' }} ({{ row.suppliers.length }})
                      </button>
                      @if (isOpen(row.id)) {
                        <div class="mt-1.5 flex flex-col gap-0.5 pl-5">
                          @for (s of row.suppliers; track s) {
                            <span class="bp-body-small text-secondary truncate">{{ s }}</span>
                          }
                        </div>
                      }
                    </div>
                  } @else {
                    <span class="bp-caption">No suppliers yet</span>
                  }
                </div>
              </a>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class InboxLandingComponent {
  private readonly inbox = inject(InboxService);

  protected readonly rows = resource<InboxSummaryRow[], void>({
    loader: () => firstValueFrom(this.inbox.summary()),
  });

  /** Which project cards have their supplier list expanded. */
  private readonly expanded = signal(new Set<string>());
  protected isOpen(id: string): boolean {
    return this.expanded().has(id);
  }
  /** Toggle a card's supplier list without following the card's link. */
  protected toggle(id: string, ev: Event): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.expanded.update((set) => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  /** One pill for the whole project. Action Required wins; else waiting on
   *  suppliers; else everything settled. */
  protected pillLabel(r: InboxSummaryRow): string {
    if (r.actionRequired) return 'Action Required';
    if (r.waitingSupplier > 0) return 'Awaiting suppliers';
    return 'All confirmed';
  }

  protected pillClass(r: InboxSummaryRow): string {
    if (r.actionRequired) return 'bp-pill--danger';
    if (r.waitingSupplier > 0) return '';
    return 'bp-pill--success';
  }

  /** Hover breakdown on the pill. */
  protected hoverText(r: InboxSummaryRow): string {
    const items = `${r.itemCount} item${r.itemCount === 1 ? '' : 's'}`;
    return `${items} · ${r.waitingAgent} waiting on you, ${r.waitingSupplier} waiting on the supplier`;
  }
}
