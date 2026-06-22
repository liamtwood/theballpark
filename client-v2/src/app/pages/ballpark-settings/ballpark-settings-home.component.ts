import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';

interface AdminTile {
  title: string;
  description: string;
  icon: string;
  link?: string;        // internal route (active tiles)
  comingSoon?: boolean; // dimmed + badge, non-navigating
}

/** pV2-EA-02 — `/ballpark-settings/` home. Ballpark-team-only admin umbrella
 *  (BALLPARK_ADMIN §Layout). Five tiles; only Early Access is built this ship,
 *  Profile cross-links to the org profile, the rest are coming-soon (Orgs +
 *  Users stubs + the Admin URL-move land in pV2-EA-04). */
@Component({
  selector: 'app-ballpark-settings-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  imports: [RouterLink, NgTemplateOutlet, LucideAngularModule],
  template: `
    <div class="bp-bs-page">
      <header class="bp-bs-head">
        <h1 class="bp-bs-title">Ballpark Settings</h1>
        <p class="bp-bs-sub">Manage signups, content, and system config.</p>
      </header>

      <div class="bp-bs-grid">
        @for (tile of tiles; track tile.title) {
          @if (tile.link && !tile.comingSoon) {
            <a class="bp-card bp-card--lifted bp-bs-tile" [routerLink]="tile.link">
              <ng-container [ngTemplateOutlet]="body" [ngTemplateOutletContext]="{ $implicit: tile }" />
            </a>
          } @else {
            <div class="bp-card bp-bs-tile bp-bs-tile--soon" [attr.aria-disabled]="true">
              <ng-container [ngTemplateOutlet]="body" [ngTemplateOutletContext]="{ $implicit: tile }" />
            </div>
          }
        }
      </div>
    </div>

    <ng-template #body let-tile>
      <span class="bp-icon-block"><lucide-icon [name]="tile.icon" [size]="20" /></span>
      <span class="bp-bs-tile-text">
        <span class="bp-bs-tile-title">
          {{ tile.title }}
          @if (tile.comingSoon) { <span class="bp-bs-soon-badge">Coming soon</span> }
        </span>
        <span class="bp-bs-tile-desc">{{ tile.description }}</span>
      </span>
      @if (!tile.comingSoon) {
        <lucide-icon name="chevron-right" [size]="18" class="bp-bs-tile-chev" />
      }
    </ng-template>
  `,
  styles: `
    .bp-bs-page { max-width: 880px; margin: 0 auto; padding: 40px 24px; }
    .bp-bs-head { margin-bottom: 28px; }
    .bp-bs-title { font-size: var(--text-4xl); font-weight: 400; color: var(--color-text-strong); }
    .bp-bs-sub { font-size: var(--text-base); color: var(--color-text-secondary); margin-top: 4px; }
    .bp-bs-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }
    @media (max-width: 640px) { .bp-bs-grid { grid-template-columns: 1fr; } }
    .bp-bs-tile {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 18px 18px;
      text-decoration: none;
      color: inherit;
    }
    .bp-bs-tile--soon { opacity: 0.55; }
    .bp-bs-tile-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
    .bp-bs-tile-title {
      display: inline-flex; align-items: center; gap: 8px;
      font-size: var(--text-md); font-weight: 500; color: var(--color-text);
    }
    .bp-bs-tile-desc { font-size: var(--text-sm); color: var(--color-text-secondary); }
    .bp-bs-tile-chev { color: var(--color-text-muted); }
    .bp-bs-soon-badge {
      font-size: var(--text-2xs); font-weight: 600; text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      padding: 2px 8px; border-radius: 999px;
      background: var(--theme-soft); color: var(--theme-accent);
    }
  `,
})
export class BallparkSettingsHomeComponent {
  protected readonly tiles: AdminTile[] = [
    { title: 'Profile', description: "Your org's profile and team", icon: 'circle-user', link: '/settings/profile' },
    { title: 'Early Access', description: 'Waitlist signups, page content, notifications', icon: 'rocket', link: '/ballpark-settings/early-access' },
    { title: 'Orgs', description: 'Manage all organisations', icon: 'building-2', comingSoon: true },
    { title: 'All Users', description: 'Manage all users across orgs', icon: 'users', comingSoon: true },
    { title: 'Admin', description: 'Page Settings, Categories, Codelists', icon: 'settings', comingSoon: true },
  ];
}
