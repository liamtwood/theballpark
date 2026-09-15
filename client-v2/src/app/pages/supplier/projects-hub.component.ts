import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PageConfigService } from '../../core/config/page-config.service';
import { PageHeroComponent } from '../../shell/page-hero/page-hero.component';
import { LauncherTileComponent } from '../../shared/launcher/launcher-tile.component';
import { PROJECTS_HUB_TILES } from '../../shared/launcher/launcher-tiles';

/** v2.13a — the supplier Projects hub (v1.68t port): three stage-bucket tiles
 *  drilling into the pre-filtered /projects list. v2.450: the hero now matches
 *  the agency Projects page — the shared page-hero band, align="block" (eyebrow
 *  / title / subtitle left-aligned to the workspace column) — instead of the
 *  centred launcher chrome, so the two Projects surfaces read consistently.
 *  Tiles sit below in the standard workspace grid. */
@Component({
  selector: 'app-projects-hub',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeroComponent, LauncherTileComponent],
  host: { class: 'block bp-vpfit' },
  template: `
    <app-page-hero
      align="block"
      [eyebrow]="title()"
      title="Your opportunities"
      subtitle="Manage opportunities from quote to completion."
    />

    <div class="bp-page-body">
      <div class="min-h-0 overflow-y-auto md:flex-1">
        <div class="bp-workspace-grid mx-auto w-full max-w-[var(--workspace-max)]">
          @for (tile of tiles; track tile.href + tile.label) {
            <app-launcher-tile
              [icon]="tile.icon"
              [label]="tile.label"
              [subtitle]="tile.subtitle ?? ''"
              [href]="tile.href"
              [query]="tile.query ?? null"
            />
          }
        </div>
      </div>
    </div>
  `,
})
export class ProjectsHubComponent {
  private readonly config = inject(PageConfigService);

  /** Eyebrow follows the org-type's configured event label (Projects / Events). */
  protected readonly title = computed(() => `${this.config.eventLabel()}s`);

  protected readonly tiles = PROJECTS_HUB_TILES;
}
