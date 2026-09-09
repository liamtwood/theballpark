import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { PageConfigService } from '../../core/config/page-config.service';
import { HomeLauncherComponent } from '../../shared/launcher/home-launcher.component';
import { NextStepsCardComponent } from '../../shared/launcher/next-steps-card.component';
import { RecentProjectsCardComponent } from '../../shared/launcher/recent-projects-card.component';
import { tilesForOrgType } from '../../shared/launcher/launcher-tiles';
import { heroTitle } from './hero-title';

/** pV2-04b — the launcher-only agent home at /home (the port of v1's
 *  HomeComponent, NOT v1's /dashboard): centred title + subtitle + 5 tiles,
 *  no page-hero band — the launcher master owns the chrome. Page settings
 *  are edited by ballpark admins at /settings/pages (the per-page cog +
 *  drawer were removed in Liam's 2026-06-11 simplification). Supplier
 *  variant lands in pV2-05. */
@Component({
  selector: 'app-home-agent',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HomeLauncherComponent, RecentProjectsCardComponent, NextStepsCardComponent],
  host: { class: 'bp-home-agent block' },
  template: `
    <app-home-launcher
      [eyebrow]="eyebrow()"
      [title]="title()"
      [subtitle]="config.heroSubtitle()"
      [align]="config.heroAlign()"
      [tiles]="tiles()"
    >
      <!-- One @if per projected node: a control-flow block with >1 root node
           is not projected into the [gridExtra] slot (Angular NG8011). -->
      @if (showNextSteps()) {
        <app-recent-projects-card gridExtra />
      }
      @if (showNextSteps()) {
        <app-next-steps-card gridExtra />
      }
    </app-home-launcher>
  `,
})
export class HomeAgentComponent {
  private readonly auth = inject(AuthService);
  protected readonly config = inject(PageConfigService);

  protected readonly title = computed(() =>
    heroTitle(this.config.heroTitleMode(), this.auth.user(), this.config.heroTitleFixed())
  );

  /** "<ORG TYPE> WORKSPACE" eyebrow above the greeting (project-hero style). */
  protected readonly eyebrow = computed(() => {
    const t = this.auth.user()?.activeOrgType;
    return t ? `${t} workspace`.toUpperCase() : '';
  });

  /** Org-type-keyed tile set: ballpark admins get the two admin surfaces
   *  (v2.12a), suppliers the v1.68w three-tile port (v2.12f), agencies the
   *  five-tile registry. The same registry feeds the stub heroes. */
  protected readonly tiles = computed(() => tilesForOrgType(this.auth.user()?.activeOrgType));

  /** Next-steps panel is agent-only (agencies), not the ballpark/supplier homes. */
  protected readonly showNextSteps = computed(() => {
    const t = this.auth.user()?.activeOrgType;
    return t !== 'ballpark' && t !== 'supplier';
  });
}
