import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PopoverModule, Popover } from 'primeng/popover';
import { AuthService, SessionUser } from '../../core/auth/auth.service';
import { devPersonas } from '../../core/auth/dev-personas';
import { can } from '../../core/auth/permissions';
import { UserAvatarComponent } from '../../shared/user-avatar/user-avatar.component';

/** Header avatar + dropdown: current identity, dev user switcher (hidden when
 *  /api/dev/users 403s in prod), sign out. `p-popover` over `p-menu` — rich
 *  content (avatar header + user rows) fits a free-content overlay. */
@Component({
  selector: 'app-user-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PopoverModule, UserAvatarComponent],
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
              <div class="truncate text-md font-semibold">{{ user.displayName ?? user.email }}</div>
              <div class="truncate text-sm text-secondary">
                {{ user.role }} · {{ user.activeOrgName }}
              </div>
            </div>
          </div>

          <!-- Platform-admin links — same gate as the pages they open. -->
          @if (canEditPageSettings()) {
            <div class="border-t border-hairline pt-2">
              <a
                routerLink="/settings/pages"
                class="block w-full cursor-pointer rounded-md px-1 py-1.5 text-left text-md text-text no-underline hover:bg-fill"
                (click)="menu.hide()"
              >
                Page settings
              </a>
            </div>
          }

          <!-- Dev switcher — three ROLE personas (Liam 2026-06-11), each
               backed by a representative seeded user. Hidden in prod. -->
          @if (personas(); as roles) {
            @if (roles.length > 0) {
              <div class="border-t border-hairline pt-2">
                <div class="px-1 pb-1 text-2xs font-medium uppercase tracking-wide text-muted">
                  View as (dev)
                </div>
                @for (p of roles; track p.role) {
                  <button
                    type="button"
                    class="block w-full cursor-pointer rounded-md px-1 py-1.5 text-left text-md hover:bg-fill"
                    [class.opacity-50]="p.role === user.role"
                    (click)="switchUser(p.user.id, menu)"
                  >
                    {{ p.label }}
                  </button>
                }
              </div>
            }
          }

          <!-- Sign out -->
          <div class="mt-2 border-t border-hairline pt-2">
            <button
              type="button"
              class="w-full cursor-pointer rounded-md px-1 py-1.5 text-left text-md text-text hover:bg-fill"
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

  /** Page-settings link mirrors the route's ballparkAdminGuard gate. */
  protected readonly canEditPageSettings = computed(() => can(this.auth.role(), 'admin.cross_org_view'));

  /** The three role personas derived from the seeded users. */
  protected readonly personas = computed(() => devPersonas(this.devUsers.value() ?? []));

  protected switchUser(userId: string, menu: Popover): void {
    menu.hide();
    void this.auth.devLogin(userId); // cookie + hard reload
  }

  protected signOut(menu: Popover): void {
    menu.hide();
    void this.auth.logout();
  }
}
