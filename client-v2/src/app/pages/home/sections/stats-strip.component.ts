import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DashboardService } from '../../../core/dashboard/dashboard.service';
import { PageConfigService } from '../../../core/config/page-config.service';

/** pV2-04 — the four stat cells above the three-column body. Own fetch via
 *  httpResource; loading renders muted dashes, error renders a quiet note
 *  (5xx visibility per Rule 5 comes from the resource's error signal — the
 *  state is VISIBLE, not a silent blank). */
@Component({
  selector: 'app-stats-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'grid grid-cols-2 gap-4 md:grid-cols-4' },
  template: `
    @if (stats.error()) {
      <div class="col-span-full rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">
        Stats are unavailable right now.
      </div>
    } @else {
      @let s = stats.value();
      <div class="bp-stat">
        <span class="bp-stat__label">Active {{ config.eventLabel().toLowerCase() }}s</span>
        <span class="bp-stat__value">{{ s ? s.active : '—' }}</span>
      </div>
      <div class="bp-stat">
        <span class="bp-stat__label">Open briefs</span>
        <span class="bp-stat__value">{{ s ? s.openBriefs : '—' }}</span>
      </div>
      <div class="bp-stat">
        <span class="bp-stat__label">Awaiting reply</span>
        <span class="bp-stat__value">{{ s ? s.awaiting : '—' }}</span>
      </div>
      <div class="bp-stat">
        <span class="bp-stat__label">{{ config.creditLabel() }}s</span>
        <span class="bp-stat__value">{{ s ? s.credits : '—' }}</span>
      </div>
    }
  `,
  styles: [
    `
      .bp-stat {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 16px 20px;
        background: var(--color-surface);
        border-radius: var(--radius-card);
        box-shadow: var(--shadow-xs);
      }
      .bp-stat__label {
        font-size: 11px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--color-text-secondary);
      }
      .bp-stat__value {
        font-size: 24px;
        font-weight: 700;
        color: var(--theme-text);
      }
    `,
  ],
})
export class StatsStripComponent {
  protected readonly config = inject(PageConfigService);
  protected readonly stats = inject(DashboardService).stats();
}
