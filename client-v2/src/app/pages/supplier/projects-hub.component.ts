import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PageConfigService } from '../../core/config/page-config.service';
import { HomeLauncherComponent } from '../../shared/launcher/home-launcher.component';
import { PROJECTS_HUB_TILES } from '../../shared/launcher/launcher-tiles';

/** v2.13a — the supplier Projects hub (v1.68t port): the launcher master
 *  with three stage-bucket tiles drilling into the pre-filtered /projects
 *  list. Title rides the configurable event label (pluralised), same as v1;
 *  live tile counts are deferred until a v2 projects count endpoint exists. */
@Component({
  selector: 'app-projects-hub',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HomeLauncherComponent],
  host: { class: 'block' },
  template: `
    <app-home-launcher
      [title]="title()"
      subtitle="Manage opportunities from quote to completion."
      [tiles]="tiles"
    />
  `,
})
export class ProjectsHubComponent {
  private readonly config = inject(PageConfigService);

  /** "Projects" by default; follows the org-type's configured event label. */
  protected readonly title = computed(() => `${this.config.eventLabel()}s`);

  protected readonly tiles = PROJECTS_HUB_TILES;
}
