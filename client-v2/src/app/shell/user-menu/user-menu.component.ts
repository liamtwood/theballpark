import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { PopoverModule, Popover } from 'primeng/popover';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { can } from '../../core/auth/permissions';
import { UserAvatarComponent } from '../../shared/user-avatar/user-avatar.component';

/** Header avatar + dropdown: current identity, admin links, sign out.
 *  `p-popover` over `p-menu` — rich content (avatar header + rows) fits a
 *  free-content overlay. The View-as (dev) switcher was REMOVED in v2.12d
 *  (Liam, 2026-06-12: one account = one role; role testing uses separate
 *  accounts via the login page's dev picker). */
@Component({
  selector: 'app-user-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideAngularModule, PopoverModule, UserAvatarComponent],
  template: `
    @if (auth.user(); as user) {
      <button
        type="button"
        class="bp-itemprev-close"
        (click)="menu.toggle($event)"
        aria-label="Account menu"
        title="Account menu"
      >
        <lucide-icon name="ellipsis-vertical" [size]="18" />
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
                {{ roleLabel(user.role) }} · {{ user.activeOrgName }}
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
              <a
                routerLink="/settings/early-access"
                class="block w-full cursor-pointer rounded-md px-1 py-1.5 text-left text-md text-text no-underline hover:bg-fill"
                (click)="menu.hide()"
              >
                Early access
              </a>
              <a
                routerLink="/settings/coachmarks"
                class="block w-full cursor-pointer rounded-md px-1 py-1.5 text-left text-md text-text no-underline hover:bg-fill"
                (click)="menu.hide()"
              >
                Coachmarks
              </a>
            </div>
          }

          <!-- Build chip + sign out (the chip moved here off the floating
               footer — Liam, 2026-06-12). -->
          <div class="mt-2 border-t border-hairline pt-2">
            <!-- About: client release headline + source build (single source =
                 environment). Dev's chip already IS the build, so skip the sub. -->
            <div class="px-1 pb-1">
              <div class="bp-meta">{{ versionChip }}</div>
              @if (release !== 'dev') {
                <div class="bp-caption text-muted">built from {{ build }}</div>
              }
            </div>
            <!-- Version history — what's on dev vs already on preview
                 (the demo list). Liam, 2026-07-17. -->
            <a
              routerLink="/whats-new"
              class="block w-full cursor-pointer rounded-md px-1 py-1.5 text-left text-md text-text no-underline hover:bg-fill"
              (click)="menu.hide()"
            >
              What's new
            </a>
            <!-- Feedback — report an issue + view your own (pV2-WHATSNEW-REDESIGN-01). -->
            <a
              routerLink="/feedback"
              class="block w-full cursor-pointer rounded-md px-1 py-1.5 text-left text-md text-text no-underline hover:bg-fill"
              (click)="menu.hide()"
            >
              Feedback
            </a>
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

  /** The build chip — lives here since the floating footer retired. */
  protected readonly versionChip = environment.versionChip;
  protected readonly release = environment.release;
  protected readonly build = environment.build;

  /** Page-settings link mirrors the route's ballparkAdminGuard gate. */
  protected readonly canEditPageSettings = computed(() => can(this.auth.role(), 'admin.cross_org_view'));

  protected signOut(menu: Popover): void {
    menu.hide();
    void this.auth.logout();
  }

  /** Humanise a raw role code for display — "supplier_admin" → "Supplier admin"
   *  (never show the underscored enum to a user). */
  protected roleLabel(role: string | null | undefined): string {
    if (!role) return '';
    const words = role.replace(/_/g, ' ').trim();
    return words ? words.charAt(0).toUpperCase() + words.slice(1) : '';
  }
}
