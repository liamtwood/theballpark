import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DashboardService, timeAgo } from '../../../core/dashboard/dashboard.service';
import { SectionCardComponent } from '../../../shared/section-card/section-card.component';

/** pV2-04 — Recent Activity (left column). Real events (v1's were hard-coded
 *  HTML): projects created, suppliers saved, replies received. */
@Component({
  selector: 'app-recent-activity-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SectionCardComponent],
  host: { class: 'block' },
  template: `
    <app-section-card icon="activity" label="Recent Activity">
      @if (activity.isLoading()) {
        <p class="text-xs text-muted">Loading…</p>
      } @else if (activity.error()) {
        <p class="text-xs text-warn">Couldn't load activity.</p>
      } @else if ((activity.value() ?? []).length === 0) {
        <p class="text-xs text-muted">Nothing yet — activity shows up as your team works.</p>
      } @else {
        @for (ev of activity.value(); track ev.id) {
          <div class="flex items-start gap-2 border-b border-hairline py-1.5 text-xs text-secondary last:border-b-0">
            <span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"></span>
            <span class="min-w-0">{{ describe(ev.kind) }} — {{ ev.subject }}</span>
            <span class="ml-auto shrink-0 pl-2 text-[11px] text-muted">{{ ago(ev.at) }}</span>
          </div>
        }
      }
    </app-section-card>
  `,
})
export class RecentActivityCardComponent {
  protected readonly activity = inject(DashboardService).activity(8);

  protected describe(kind: string): string {
    switch (kind) {
      case 'project_created': return 'Project created';
      case 'supplier_saved': return 'Supplier saved';
      case 'reply_received': return 'Reply received';
      default: return 'Activity';
    }
  }

  protected ago(iso: string): string {
    return timeAgo(iso);
  }
}
