import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { PopoverModule, Popover } from 'primeng/popover';
import { AuthService } from '../../core/auth/auth.service';
import { UserAvatarComponent } from '../../shared/user-avatar/user-avatar.component';

/** Header avatar + dropdown: current identity, dev user switcher (stub-only),
 *  sign out. `p-popover` over `p-menu` — the content is rich (avatar header +
 *  user rows), which fits a free-content overlay better than MenuItem[]. */
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
              <div class="truncate text-xs text-slate-500">
                {{ user.role }} · {{ user.activeOrgName }}
              </div>
            </div>
          </div>

          <!-- Dev switcher — renders only while the stub list exists -->
          @if (devUsers.length > 0) {
            <div class="border-t border-black/5 pt-2">
              <div class="px-1 pb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Switch user (dev)
              </div>
              @for (dev of devUsers; track dev.id) {
                <button
                  type="button"
                  class="flex w-full cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 text-left hover:bg-black/5"
                  [class.opacity-50]="dev.id === user.id"
                  (click)="switchUser(dev.id, menu)"
                >
                  <app-user-avatar
                    [displayName]="dev.displayName"
                    [email]="dev.email"
                    [size]="24"
                  />
                  <span class="min-w-0">
                    <span class="block truncate text-sm">{{ dev.displayName }}</span>
                    <span class="block truncate text-xs text-slate-500">{{ dev.role }}</span>
                  </span>
                </button>
              }
            </div>
          }

          <!-- Sign out -->
          <div class="mt-2 border-t border-black/5 pt-2">
            <button
              type="button"
              class="w-full cursor-pointer rounded-md px-1 py-1.5 text-left text-sm text-slate-700 hover:bg-black/5"
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
  private readonly router = inject(Router);

  protected readonly devUsers = this.auth.listDevUsers();

  protected switchUser(userId: string, menu: Popover): void {
    this.auth.devLogin(userId);
    menu.hide();
  }

  protected signOut(menu: Popover): void {
    menu.hide();
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
