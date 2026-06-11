import { ChangeDetectionStrategy, Component, inject, resource } from '@angular/core';
import { PopoverModule, Popover } from 'primeng/popover';
import { AuthService, SessionUser } from '../../core/auth/auth.service';
import { UserAvatarComponent } from '../../shared/user-avatar/user-avatar.component';

/** Header avatar + dropdown: current identity, dev user switcher (hidden when
 *  /api/dev/users 403s in prod), sign out. `p-popover` over `p-menu` — rich
 *  content (avatar header + user rows) fits a free-content overlay. */
@Component({
  selector: 'app-user-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PopoverModule, UserAvatarComponent],
  template: `
    @if (auth.user(); as user) {
      <button
        type="button"
        class="block cursor-pointer rounded-full transition-opacity hover:opacity-80"
        (click)="menu.toggle($event)"
        aria-label="Account menu"
      >
        <app-user-avatar
          [displayName]="user.displayName"
          [email]="user.email"
          [imageUrl]="user.avatarUrl"
          [size]="40"
        />
      </button>

      <p-popover #menu>
        <div class="w-64">
          <!-- Current user -->
          <div class="flex items-center gap-3 px-1 pb-3">
            <app-user-avatar
              [displayName]="user.displayName"
              [email]="user.email"
              [imageUrl]="user.avatarUrl"
              [size]="36"
            />
            <div class="min-w-0">
              <div class="truncate text-sm font-semibold">{{ user.displayName ?? user.email }}</div>
              <div class="truncate text-xs text-secondary">
                {{ user.role }} · {{ user.activeOrgName }}
              </div>
            </div>
          </div>

          <!-- Dev switcher — renders only while the dev endpoint returns users -->
          @if (devUsers.value(); as devs) {
            @if (devs.length > 0) {
              <div class="border-t border-hairline pt-2">
                <div class="px-1 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted">
                  Switch user (dev)
                </div>
                @for (dev of devs; track dev.id) {
                  <button
                    type="button"
                    class="flex w-full cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 text-left hover:bg-fill"
                    [class.opacity-50]="dev.id === user.id"
                    (click)="switchUser(dev.id, menu)"
                  >
                    <app-user-avatar [displayName]="dev.displayName" [email]="dev.email" [size]="24" />
                    <span class="min-w-0">
                      <span class="block truncate text-sm">{{ dev.displayName }}</span>
                      <span class="block truncate text-xs text-secondary">{{ dev.role }}</span>
                    </span>
                  </button>
                }
              </div>
            }
          }

          <!-- Sign out -->
          <div class="mt-2 border-t border-hairline pt-2">
            <button
              type="button"
              class="w-full cursor-pointer rounded-md px-1 py-1.5 text-left text-sm text-text hover:bg-fill"
              (click)="signOut(menu)"
            >
              Sign out
            </button>
          </div>
        </div>
      </p-popover>
    }
  `,
})
export class UserMenuComponent {
  protected readonly auth = inject(AuthService);

  /** Seeded dev identities (resource per the v2 fetch-into-state standard);
   *  listDevUsers never rejects (401/403 → empty list, faults logged there).
   *  TODO(third-use): login holds this resource's twin — a third consumer
   *  extracts a shared devUsersResource() helper. */
  protected readonly devUsers = resource<SessionUser[], void>({
    loader: () => this.auth.listDevUsers(),
  });

  protected switchUser(userId: string, menu: Popover): void {
    menu.hide();
    void this.auth.devLogin(userId); // cookie + hard reload
  }

  protected signOut(menu: Popover): void {
    menu.hide();
    void this.auth.logout();
  }
}
