import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SectionCardComponent } from '../../../shared/section-card/section-card.component';

/** pV2-04 — Quick Actions: secondary nav shortcuts (left column). Config-
 *  driven list per the plan; the p0019 trim applies — no Marketplace link
 *  (redundant with the launcher tile). */
@Component({
  selector: 'app-quick-actions-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SectionCardComponent, RouterLink],
  host: { class: 'block' },
  template: `
    <app-section-card icon="zap" label="Quick Actions">
      @for (a of actions; track a.href) {
        <a
          [routerLink]="a.href"
          class="block rounded-md px-1 py-1.5 text-[13px] text-text hover:bg-fill"
        >
          {{ a.label }}
        </a>
      }
    </app-section-card>
  `,
})
export class QuickActionsCardComponent {
  protected readonly actions = [
    { label: 'Invite a team member', href: '/settings/team' },
    { label: 'Browse suppliers', href: '/marketplace' },
  ];
}
