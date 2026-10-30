import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { InboxProjectSummary, InboxThreadItem } from '../../core/inbox/inbox.service';
import { supplierRollup, itemAction } from './inbox-status';
import { lineDisplayCode } from '../../core/status/line-display-status';
import { StatusPillComponent } from '../../shared/status-pill/status-pill.component';

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
  imports: [LucideAngularModule, StatusPillComponent],
  host: { class: 'hidden min-h-0 lg:flex lg:flex-col lg:gap-3 lg:overflow-y-auto' },
  template: `
    <!-- "Project inbox" title moved ABOVE both columns (in inbox-project) so the
         rail cards line up vertically with the top of the conversation box
         (Liam 2026-10-29). Project context now lives in the conversation header. -->

    <!-- Outer counterparty cards (supplier / agency), the Final-Quote pattern:
         icon + name + total + chevron, expanding to category bands + items. -->
    @for (o of groups(); track o.id) {
      @let c = counts(o);
      <!-- Collapsed: the whole card glistens when the user has an action.
           Expanded: only the specific item row glistens (below). -->
      <div class="bp-card shrink-0 overflow-hidden" [class.bp-glisten]="!isExpanded(o.id) && c.action > 0">
        <!-- min-h keeps every collapsed supplier card the same height. -->
        <div class="flex min-h-[64px] w-full items-center gap-3 p-3">
          <button type="button" class="flex min-w-0 flex-1 flex-col items-start gap-1 text-left" (click)="toggle(o.id)">
            <!-- Icon sits inline with the supplier name, sized to the title line
                 (Liam 2026-10-19). Always the pink Ballpark glyph — the supplier's
                 own logo is NOT shown here: a consistent icon reads cleaner than
                 mixed-quality supplier images in the dense rail. -->
            <span class="flex w-full min-w-0 items-center gap-2">
              <lucide-icon [name]="o.iconName || 'building-2'" [size]="18" [strokeWidth]="1.75" class="shrink-0 text-[var(--theme-accent)]" />
              <span class="bp-list-title min-w-0 truncate">{{ o.label }}</span>
            </span>
            <!-- Line count · how many are accepted by BOTH sides. Action-required
                 is signalled by the card glisten, so it isn't repeated here.
                 pl-[26px] = icon width (18) + gap-2 (8) so it left-aligns under the
                 supplier name, not the icon. bp-caption = the light "ballpark cost"
                 weight (Liam 2026-10-19). -->
            <span class="bp-caption pl-[26px]">
              {{ c.items }} {{ c.items === 1 ? 'item' : 'items' }} · {{ c.accepted }} accepted
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
                <!-- Glisten the specific line the current user must act on. -->
                <button type="button" class="flex w-full items-center gap-2.5 border-b border-hairline px-3 py-2.5 text-left last:border-b-0 hover:bg-fill"
                        [class.bp-item--selected]="it.id === selectedId()" [class.bp-glisten]="isMyAction(it)" (click)="selectItem.emit(it.id)">
                  <!-- Cover thumbnail — same style as the Running budget (Liam 2026-10-29). -->
                  @if (it.imageUrl) {
                    <img [src]="it.imageUrl" alt="" class="h-9 w-9 shrink-0 rounded-[var(--radius-card)] object-cover" />
                  } @else {
                    <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-fill text-muted">
                      <lucide-icon name="image" [size]="14" />
                    </div>
                  }
                  <span class="flex min-w-0 flex-1 flex-col items-start gap-1">
                    <span class="bp-list-title w-full truncate">{{ it.name }}</span>
                    <span class="flex flex-wrap items-center gap-1.5">
                      <!-- Codelist-driven status pill (line_display_status): text +
                           colour editable in Settings ▸ Codelists (Liam 2026-10-29). -->
                      <app-status-pill list="line_display_status" [code]="railCode(it)" />
                      @if (it.hasOpenQuestion) {
                        <span class="bp-spill bp-spill--yellow">Question</span>
                      }
                    </span>
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

  /** The canonical display code for the item's status pill (codelist-driven via
   *  app-status-pill). Agency = buyer, supplier = seller. */
  protected railCode(it: InboxThreadItem): string {
    return lineDisplayCode(it, this.isAgency() ? 'buyer' : 'seller');
  }

  /** True when this line is waiting on the current user (drives the glisten). */
  protected isMyAction(it: InboxThreadItem): boolean {
    return itemAction(it, this.isAgency()) === 'me';
  }

  /** Header rollup: total items · accepted · action-required-by-me. */
  protected counts(o: RailOuter) {
    return supplierRollup(o.cats.flatMap((c) => c.items), this.isAgency());
  }
}
