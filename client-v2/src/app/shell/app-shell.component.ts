import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../core/auth/auth.service';
import { can } from '../core/auth/permissions';
import { WordmarkComponent } from '../shared/wordmark/wordmark.component';
import { UserMenuComponent } from './user-menu/user-menu.component';
import { ShellContextService } from './shell-context.service';
import { PageSettingsDrawerComponent } from './page-settings-drawer/page-settings-drawer.component';

/** Chrome around every authenticated route: transparent fixed header
 *  (wordmark left; cog + user menu right) above the routed page. The cog
 *  (pV2-04b1-qc) renders when the ACTIVE PAGE registered a settings config
 *  via ShellContextService AND the user can author org config — one cog, one
 *  drawer, owned here; pages just register/unregister. Login/callback routes
 *  live OUTSIDE this component, so they get no header. */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    LucideAngularModule,
    WordmarkComponent,
    UserMenuComponent,
    PageSettingsDrawerComponent,
  ],
  host: { class: 'block min-h-screen' },
  template: `
    <header
      class="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between bg-transparent px-6"
    >
      <!-- Wordmark routes to /home (pV2-02b): the root is the public landing
           page now; authenticated users clicking the logo belong on home. -->
      <app-wordmark link="/home" />
      <div class="flex items-center gap-3">
        @if (showCog()) {
          <button
            type="button"
            class="bp-shell-cog"
            aria-label="Page settings"
            (click)="shellContext.openSettings()"
          >
            <lucide-icon name="settings" [size]="18" />
          </button>
        }
        @if (auth.isLoggedIn()) {
          <app-user-menu />
        }
      </div>
    </header>

    <main class="px-6 pb-12 pt-20">
      <router-outlet />
    </main>

    <app-page-settings-drawer
      [visible]="shellContext.settingsOpen()"
      (visibleChange)="shellContext.setSettingsOpen($event)"
    />
  `,
  styles: [
    `
      .bp-shell-cog {
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
      .bp-shell-cog:hover {
        background: var(--color-fill);
      }
      .bp-shell-cog:focus-visible {
        outline: 2px solid var(--theme-accent);
        outline-offset: 2px;
      }
    `,
  ],
})
export class AppShellComponent {
  protected readonly auth = inject(AuthService);
  protected readonly shellContext = inject(ShellContextService);

  /** Cog = a page registered settings AND the user can author org config
   *  (matches the server's PUT gate — see pV2-04b's cog-gate deviation). */
  protected readonly showCog = computed(
    () => this.shellContext.pageSettings() !== null && can(this.auth.role(), 'org.invite_member')
  );
}
