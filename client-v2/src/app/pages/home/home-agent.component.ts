import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { PageConfigService } from '../../core/config/page-config.service';
import { HomeLauncherComponent } from '../../shared/launcher/home-launcher.component';
import { LauncherTile } from '../../shared/launcher/launcher-tile.types';
import { ShellContextService } from '../../shell/shell-context.service';
import { heroTitle } from './hero-title';

/** pV2-04b — the launcher-only agent home at /home (the port of v1's
 *  HomeComponent, NOT v1's /dashboard): centred title + subtitle + 5 tiles,
 *  no page-hero band — the launcher master owns the chrome. The settings cog
 *  + drawer live in the SHELL since pV2-04b1-qc; this page just registers
 *  its settings surface. Supplier variant lands in pV2-05. */
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

  constructor() {
    // Register this page's settings surface with the shell (the shell owns
    // the cog + the one drawer instance); unregister on destroy.
    const shellContext = inject(ShellContextService);
    shellContext.setPageSettings({ pageKey: 'v2Home', label: 'Customise your home' });
    inject(DestroyRef).onDestroy(() => shellContext.setPageSettings(null));
  }

  protected readonly title = computed(() =>
    heroTitle(this.config.heroTitleMode(), this.auth.user(), this.config.heroTitleFixed())
  );

  /** The agent tile set (p0019) with the v1 subtitle copy. Add/View
   *  interpolate the configurable events label live. */
  protected readonly tiles = computed<LauncherTile[]>(() => {
    const label = this.config.eventLabel();
    const lower = label.toLowerCase();
    return [
      {
        icon: 'folder-plus',
        label: `Add ${lower}`,
        subtitle: `Start a new ${lower}`,
        href: '/projects',
        primary: true,
      },
      {
        icon: 'folder-open',
        label: `View ${lower}s`,
        subtitle: `Browse all your ${lower}s`,
        href: '/projects',
      },
      { icon: 'inbox', label: 'Inbox', subtitle: 'Supplier replies and threads', href: '/inbox' },
      { icon: 'store', label: 'Marketplace', subtitle: 'Browse items and suppliers', href: '/marketplace' },
      { icon: 'circle-user', label: 'Profile', subtitle: 'Your account and settings', href: '/settings/profile' },
    ];
  });
}
