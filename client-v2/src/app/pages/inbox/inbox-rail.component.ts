import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { InboxProjectSummary, InboxThreadItem } from '../../core/inbox/inbox.service';
import { statusPill, supplierRollup } from './inbox-status';

/** A category thread inside an outer counterparty card — the middle band of the
 *  Final-Quote containment pattern (cat icon + name), with its item rows. */
export interface RailCat {
  threadId: string;
  categoryName: string;
  iconName: string | null;
  items: InboxThreadItem[];
}

/** The outer counterparty card — a supplier (agency view) or the agency
 *  (supplier view): logo/glyph + name + total + chevron, containing its
 *  category bands. Mirrors the Final Quote category card. */
export interface RailOuter {
  id: string;
  label: string;
  iconName: string | null;
  iconUrl: string | null;
  total: number;
  cats: RailCat[];
}

/** pV2-INBOX — the conversation rail. A project context card, then the
 *  Final-Quote containment pattern applied to the inbox hierarchy: an outer
 *  counterparty card (supplier / agency) → category bands → slim item rows
 *  (name + status). Clicking a category band opens its conversation; an item
 *  focuses it; the outer card just expands/collapses. Extracted from
 *  inbox-project (audit M2); re-shaped for the nested pattern (pV2-INBOX-05). */
@Component({
  selector: 'app-inbox-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'hidden min-h-0 xl:flex xl:flex-col xl:gap-3 xl:overflow-y-auto' },
  template: `
    <!-- Project context card removed — that info now lives in the conversation
         header (Liam 2026-09-10). -->

    <!-- Outer counterparty cards (supplier / agency), the Final-Quote pattern:
         icon + name + total + chevron, expanding to category bands + items. -->
    @for (o of groups(); track o.id) {
      <div class="bp-card shrink-0 overflow-hidden">
        <!-- min-h keeps every collapsed supplier card the same height. -->
        <div class="flex min-h-[64px] w-full items-center gap-3 p-3">
          <button type="button" class="flex min-w-0 flex-1 items-center gap-3 text-left" (click)="toggle(o.id)">
            @if (o.iconUrl) {
              <img [src]="o.iconUrl" alt="" class="h-9 w-9 shrink-0 rounded-[var(--radius-card)] object-cover" />
            } @else {
              <lucide-icon [name]="o.iconName || 'store'" [size]="26" [strokeWidth]="1.5" class="shrink-0 text-[var(--theme-accent)]" />
            }
            <span class="min-w-0 flex-1">
              <span class="bp-list-title block truncate">{{ o.label }}</span>
              @let c = counts(o);
              <!-- Compact stats: items · accepted · action-required (icons keep it
                   on one line in the narrow rail; full words on hover). -->
              <span class="bp-meta mt-1 flex items-center gap-2.5">
                <span class="inline-flex items-center gap-1" [title]="c.items + ' items'">
                  <lucide-icon name="package" [size]="13" class="text-muted" />{{ c.items }}
                </span>
                <span class="inline-flex items-center gap-1" [title]="c.accepted + ' accepted'">
                  <lucide-icon name="circle-check" [size]="13" class="text-muted" />{{ c.accepted }}
                </span>
                <span class="inline-flex items-center gap-1" [title]="c.action + ' action required'"
                      [style.color]="c.action > 0 ? 'var(--theme-accent)' : null" [class.font-semibold]="c.action > 0">
                  <lucide-icon name="circle-alert" [size]="13" />{{ c.action }}
                </span>
              </span>
            </span>
          </button>
          <button type="button" class="shrink-0 rounded-md p-0.5 text-muted transition-colors hover:text-text"
                  [attr.aria-label]="isExpanded(o.id) ? 'Collapse' : 'Expand'" (click)="toggle(o.id)">
            <lucide-icon [name]="isExpanded(o.id) ? 'chevron-down' : 'chevron-right'" [size]="16" />
          </button>
        </div>

        @if (isExpanded(o.id)) {
          <div class="border-t border-hairline">
            @for (cat of o.cats; track cat.threadId) {
              <!-- Category band — the middle level, clickable to open the
                   whole conversation for that category thread. -->
              <button type="button" class="flex w-full items-center gap-2 border-b border-hairline bg-fill px-3 py-2 text-left"
                      [class.bp-item--selected]="cat.threadId === selectedThreadId()" (click)="selectThread.emit(cat.threadId)">
                <lucide-icon [name]="cat.iconName || 'folder'" [size]="13" class="shrink-0 text-muted" />
                <span class="bp-meta truncate font-medium text-text">{{ cat.categoryName }}</span>
              </button>
              <!-- Item rows — name + status (You/They/Both Accepted, or the
                   negotiation state). Focuses the item in the conversation. -->
              @for (it of cat.items; track it.id) {
                <button type="button" class="flex w-full flex-col items-start gap-1 border-b border-hairline px-3 py-2.5 pl-8 text-left last:border-b-0 hover:bg-fill"
                        [class.bp-item--selected]="it.id === selectedId()" (click)="selectItem.emit(it.id)">
                  <span class="bp-list-title w-full truncate">{{ it.name }}</span>
                  <span class="flex flex-wrap items-center gap-1.5">
                    <span [class]="'bp-spill bp-spill--' + pill(it).tone">{{ pill(it).label }}</span>
                    @if (it.hasOpenQuestion) {
                      <span class="bp-spill bp-spill--yellow">Question</span>
                    }
                  </span>
                </button>
              }
            }
          </div>
        }
      </div>
    }
  `,
})
export class InboxRailComponent {
  readonly project = input<InboxProjectSummary | null>(null);
  readonly groups = input.required<RailOuter[]>();
  readonly selectedThreadId = input<string | null>(null);
  readonly selectedId = input<string | null>(null);
  readonly isAgency = input<boolean>(false);
  readonly selectThread = output<string>();
  readonly selectItem = output<string>();

  // Outer expand — expanded-by-id; DEFAULT MINIMIZED (Liam 2026-09-10): the
  // supplier cards start collapsed, showing just name + counts.
  private readonly expanded = signal<ReadonlySet<string>>(new Set());
  protected isExpanded(id: string): boolean {
    return this.expanded().has(id);
  }
  protected toggle(id: string): void {
    this.expanded.update((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected pill(it: InboxThreadItem) {
    return statusPill(it, this.isAgency());
  }

  /** Header rollup: total items · accepted · action-required-by-me. */
  protected counts(o: RailOuter) {
    return supplierRollup(o.cats.flatMap((c) => c.items), this.isAgency());
  }
}
