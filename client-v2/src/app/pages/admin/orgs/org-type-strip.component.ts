import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface OrgTypeBucket {
  /** type value ('agency' | 'supplier' | 'ballpark'). */
  id: string;
  name: string;
  count: number;
}

/** pV2-ADMIN-ORGS-UX-01 — a thin, FLAT left rail for the admin Orgs page: an
 *  "All Orgs" row + one row per org type, each with a live count. An approved
 *  fork of the marketplace category-strip's LOOK (reuses the global .bp-catstrip-*
 *  classes) WITHOUT its drill-down/tree behaviour or MarketplaceStore coupling —
 *  org types are a fixed flat set, not a category tree. */
@Component({
  selector: 'app-org-type-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <nav class="flex flex-col gap-0.5">
      <button type="button" class="bp-catstrip-row" [class.bp-catstrip-row--active]="activeId() === 'all'"
        (click)="selected.emit('all')">
        <span class="truncate">{{ allLabel() }}</span>
        <span class="bp-meta">{{ totalCount() }}</span>
      </button>
      @for (b of buckets(); track b.id) {
        <button type="button" class="bp-catstrip-row" [class.bp-catstrip-row--active]="activeId() === b.id"
          (click)="selected.emit(b.id)">
          <span class="truncate">{{ b.name }}</span>
          <span class="bp-meta">{{ b.count }}</span>
        </button>
      }
    </nav>
  `,
})
export class OrgTypeStripComponent {
  readonly buckets = input.required<readonly OrgTypeBucket[]>();
  readonly activeId = input<string>('all');
  readonly allLabel = input<string>('All Orgs');
  readonly totalCount = input<number>(0);
  readonly selected = output<string>();
}
