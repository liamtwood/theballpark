import { ChangeDetectionStrategy, Component } from '@angular/core';
import { HomeLauncherComponent } from '../../shared/launcher/home-launcher.component';
import { ADMIN_HUB_TILES } from '../../shared/launcher/launcher-tiles';

/** BE-00128 — the platform Admin hub at /admin. Groups the five config surfaces
 *  (Early Access, Page Settings, Categories, Codelists, Coachmarks) that used to
 *  clutter the admin top-level nav + leak into the user menu. Ballpark admins
 *  only (route carries ballparkAdminGuard). Reuses the shared launcher chrome so
 *  it matches /home. */
@Component({
  selector: 'app-admin-hub',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HomeLauncherComponent],
  host: { class: 'block' },
  template: `
    <app-home-launcher
      eyebrow="Ballpark admin"
      title="Admin"
      subtitle="Platform settings and configuration."
      align="left"
      [tiles]="tiles"
    />
  `,
})
export class AdminHubComponent {
  protected readonly tiles = ADMIN_HUB_TILES;
}
