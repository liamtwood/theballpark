import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DashboardService } from '../../../core/dashboard/dashboard.service';
import { SectionCardComponent } from '../../../shared/section-card/section-card.component';

/** pV2-04 — Upcoming: the next few dated projects (left column). */
@Component({
  selector: 'app-upcoming-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SectionCardComponent],
  host: { class: 'block' },
  template: `
    <app-section-card icon="calendar-days" label="Upcoming">
      @if (upcoming.isLoading()) {
        <p class="text-xs text-muted">Loading…</p>
      } @else if (upcoming.error()) {
        <p class="text-xs text-warn">Couldn't load upcoming events.</p>
      } @else if ((upcoming.value() ?? []).length === 0) {
        <p class="text-xs text-muted">No upcoming events.</p>
      } @else {
        @for (p of upcoming.value(); track p.id) {
          <div class="border-b border-hairline py-2 last:border-b-0">
            <p class="text-[13px] font-medium">{{ p.name }}</p>
            @if (p.clientName) {
              <p class="text-[11px] text-muted">{{ p.clientName }}</p>
            }
            @if (p.venueName) {
              <p class="text-[11px] text-muted">{{ p.venueName }}</p>
            }
            <p class="mt-0.5 text-[11px] font-medium text-accent">{{ p.dateLabel }}</p>
          </div>
        }
      }
    </app-section-card>
  `,
})
export class UpcomingCardComponent {
  protected readonly upcoming = inject(DashboardService).upcoming(3);
}
