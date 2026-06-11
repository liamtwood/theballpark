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
      [tiles]="tiles"
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

  /** The agent tile set — Figma copy verbatim (pV2-04b2-qc). Labels are
   *  FIXED copy now (the configurable events-label interpolation from p0019
   *  is dropped with this copy set — flagged in the ship report). Both
   *  project tiles target the /projects stub until the projects arc defines
   *  distinct destinations. */
  protected readonly tiles: LauncherTile[] = [
    {
      icon: 'folder-plus',
      label: 'New Project',
      subtitle: 'Manage active projects and supplier conversations.',
      href: '/projects',
    },
    {
      icon: 'folder-open',
      label: 'Past Projects',
      subtitle: 'View completed and archived work.',
      href: '/projects',
    },
    { icon: 'inbox', label: 'Inbox', subtitle: 'Messages, supplier responses and updates.', href: '/inbox' },
    { icon: 'store', label: 'Marketplace', subtitle: 'Browse suppliers, ideas and ballpark costs.', href: '/marketplace' },
    { icon: 'circle-user', label: 'Profile', subtitle: 'Manage your portfolio, pricing and account.', href: '/settings/profile' },
  ];
}
