import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { can } from '../../core/auth/permissions';
import { PageConfigService } from '../../core/config/page-config.service';
import { HomeLauncherComponent } from '../../shared/launcher/home-launcher.component';
import { LauncherTile } from '../../shared/launcher/launcher-tile.types';
import { PageSettingsDrawerComponent } from '../../shell/page-settings-drawer/page-settings-drawer.component';
import { heroTitle } from './hero-title';

/** pV2-04b — the launcher-only agent home at /home (the port of v1's
 *  HomeComponent, NOT v1's /dashboard): centred title + subtitle + 5 tiles,
 *  no page-hero band — the launcher master owns the chrome. Cog (admins
 *  only) opens the page-settings drawer. Supplier variant lands in pV2-05. */
@Component({
  selector: 'app-home-agent',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, HomeLauncherComponent, PageSettingsDrawerComponent],
  host: { class: 'bp-home-agent relative block' },
  template: `
    <app-home-launcher
      [title]="title()"
      [subtitle]="config.heroSubtitle()"
      [align]="config.heroAlign()"
      [tiles]="tiles()"
    />

    @if (canEditSettings()) {
      <button
        type="button"
        class="bp-home-agent__cog"
        aria-label="Page settings"
        (click)="settingsOpen.set(true)"
      >
        <lucide-icon name="settings" [size]="18" />
      </button>
    }

    <app-page-settings-drawer [(visible)]="settingsOpen" />
  `,
  styles: [
    `
      .bp-home-agent__cog {
        position: absolute;
        top: 24px; /* host sits below the shell header already */
        right: 24px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 18px;
        background: transparent;
        border: 1px solid var(--color-border-hairline);
        color: var(--color-text-secondary);
        cursor: pointer;
      }
      .bp-home-agent__cog:hover {
        background: var(--color-fill);
      }
      .bp-home-agent__cog:focus-visible {
        outline: 2px solid var(--theme-accent);
        outline-offset: 2px;
      }
    `,
  ],
})
export class HomeAgentComponent {
  private readonly auth = inject(AuthService);
  protected readonly config = inject(PageConfigService);

  protected readonly settingsOpen = signal(false);

  /** Cog matches the SERVER's PUT gate (org.invite_member), not bare
   *  isAdmin — a ballpark_admin has isAdmin=true but cannot author org
   *  config, and a mismatched cog would open a drawer whose saves 403. */
  protected readonly canEditSettings = computed(() => can(this.auth.role(), 'org.invite_member'));

  protected readonly title = computed(() =>
    heroTitle(this.config.heroTitleMode(), this.auth.user(), this.config.heroTitleFixed())
  );

  /** The agent tile set (p0019). Add/View interpolate the configurable
   *  events label live. */
  protected readonly tiles = computed<LauncherTile[]>(() => {
    const label = this.config.eventLabel();
    const lower = label.toLowerCase();
    return [
      { icon: 'folder-plus', label: `Add ${lower}`, href: '/projects', primary: true },
      { icon: 'folder-open', label: `View ${lower}s`, href: '/projects' },
      { icon: 'inbox', label: 'Inbox', href: '/inbox' },
      { icon: 'store', label: 'Marketplace', href: '/marketplace' },
      { icon: 'circle-user', label: 'Profile', href: '/settings/profile' },
    ];
  });
}
