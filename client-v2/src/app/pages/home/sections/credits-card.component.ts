import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DashboardService } from '../../../core/dashboard/dashboard.service';
import { PageConfigService } from '../../../core/config/page-config.service';
import { SectionCardComponent } from '../../../shared/section-card/section-card.component';

/** pV2-04 — Credits (right column): the org's balls balance. */
@Component({
  selector: 'app-credits-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SectionCardComponent],
  host: { class: 'block' },
  template: `
    <app-section-card icon="coins" [label]="config.creditLabel() + 's'">
      @if (credits.isLoading()) {
        <p class="text-xs text-muted">Loading…</p>
      } @else if (credits.error()) {
        <p class="text-xs text-warn">Couldn't load your balance.</p>
      } @else {
        @let c = credits.value();
        <div class="text-3xl font-bold">{{ c?.balance ?? 0 }}</div>
        <p class="mt-1 text-xs text-secondary">
          {{ config.creditLabel().toLowerCase() }}s available
          @if (c && c.monthlyAllowance > 0) {
            · {{ c.monthlyAllowance }} / month
          }
        </p>
      }
    </app-section-card>
  `,
})
export class CreditsCardComponent {
  protected readonly config = inject(PageConfigService);
  protected readonly credits = inject(DashboardService).credits();
}
