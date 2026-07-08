import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { InboxProjectSummary, InboxThreadItem } from '../../core/inbox/inbox.service';
import { statusPill } from './inbox-status';

export interface RailGroup {
  id: string;
  threadId: string;
  label: string;
  items: InboxThreadItem[];
}

/** pV2-INBOX — the conversation rail: a project context card + one card per
 *  thread (top row = whole conversation, "N items" expands to the items with
 *  their status pills). Owns its own expand/collapse. Extracted from
 *  inbox-project (audit M2). */
@Component({
  selector: 'app-inbox-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'hidden min-h-0 xl:flex xl:flex-col xl:gap-3 xl:overflow-y-auto' },
  template: `
    @if (project(); as p) {
      <div class="bp-card shrink-0 p-4">
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
    <!-- One card per thread: top row selects the whole conversation (clears any
         item filter); "N items" expands to the items. The card stays active
         (breadcrumb) while a child item is selected — click it to unfilter. -->
    @for (g of groups(); track g.id) {
      <div class="bp-card shrink-0 overflow-hidden" [class.bp-item--selected]="g.threadId === selectedThreadId()">
        <button type="button" class="block w-full px-3 pt-2.5 pb-1 text-left" (click)="selectThread.emit(g.threadId)">
          <span class="bp-list-title block truncate">{{ g.label }}</span>
        </button>
        <button type="button" class="flex w-full items-center justify-between px-3 pb-2.5 text-left text-muted hover:text-text" (click)="toggle(g.id)">
          <span class="bp-meta">{{ g.items.length }} item{{ g.items.length === 1 ? '' : 's' }}</span>
          <lucide-icon [name]="isExpanded(g.id) ? 'chevron-down' : 'chevron-right'" [size]="14" />
        </button>
      </div>
      @if (isExpanded(g.id)) {
        <div class="mb-1 flex shrink-0 flex-col gap-0.5 pl-2">
          @for (it of g.items; track it.id) {
            <button type="button" class="flex w-full flex-col items-start gap-1.5 rounded-lg px-3 py-2.5 text-left hover:bg-fill"
                    [class.bp-item--selected]="it.id === selectedId()" (click)="selectItem.emit(it.id)">
              <span class="bp-list-title w-full truncate">{{ it.name }}</span>
              <span [class]="'bp-spill bp-spill--' + pill(it).tone">{{ pill(it).label }}</span>
            </button>
          }
        </div>
      }
    }
  `,
})
export class InboxRailComponent {
  readonly project = input<InboxProjectSummary | null>(null);
  readonly groups = input.required<RailGroup[]>();
  readonly selectedThreadId = input<string | null>(null);
  readonly selectedId = input<string | null>(null);
  readonly isAgency = input<boolean>(false);
  readonly selectThread = output<string>();
  readonly selectItem = output<string>();

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

  protected pill(it: InboxThreadItem) {
    return statusPill(it, this.isAgency());
  }
}
