import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { PageConfigService } from '../../core/config/page-config.service';
import { HomeLauncherComponent } from '../../shared/launcher/home-launcher.component';
import { AGENT_TILES, BALLPARK_TILES } from '../../shared/launcher/agent-tiles';
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
  imports: [HomeLauncherComponent],
  host: { class: 'bp-home-agent block' },
  template: `
    <app-home-launcher
      [title]="title()"
      [subtitle]="config.heroSubtitle()"
      [align]="config.heroAlign()"
      [tiles]="tiles()"
    />
  `,
})
export class HomeAgentComponent {
  private readonly auth = inject(AuthService);
  protected readonly config = inject(PageConfigService);

  protected readonly title = computed(() =>
    heroTitle(this.config.heroTitleMode(), this.auth.user(), this.config.heroTitleFixed())
  );

  /** Role-keyed tile set (Liam, 2026-06-12): ballpark admins get just
   *  Profile + Page Settings; everyone else the agent registry until the
   *  supplier variant lands (pV2-05). Same registry feeds stub heroes. */
  protected readonly tiles = computed(() =>
    this.auth.role() === 'ballpark_admin' ? BALLPARK_TILES : AGENT_TILES
  );
}
