import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { PageConfigService } from '../../core/config/page-config.service';
import { LauncherTileComponent } from './launcher-tile.component';

/** pV2-04 — the agent launcher (centre column of /home): five tiles per the
 *  p0019 set, labels interpolating the configurable event label. The first
 *  tile is the primary CTA (gradient). pV2-05 adds variant="supplier" — until
 *  then this component IS the agent set. */
@Component({
  selector: 'app-launcher-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LauncherTileComponent, ToastModule],
  providers: [MessageService],
  host: { class: 'grid grid-cols-1 gap-4 sm:grid-cols-2' },
  template: `
    <app-launcher-tile
      icon="folder-plus"
      [label]="'Add ' + config.eventLabel().toLowerCase()"
      [sublabel]="'Start a new ' + config.eventLabel().toLowerCase()"
      [primary]="true"
      (pressed)="stubCreate()"
    />
    <app-launcher-tile
      icon="folder-open"
      [label]="'View ' + config.eventLabel().toLowerCase() + 's'"
      [sublabel]="'Browse all your ' + config.eventLabel().toLowerCase() + 's'"
      href="/projects"
    />
    <app-launcher-tile icon="inbox" label="Inbox" sublabel="Supplier replies and threads" href="/inbox" />
    <app-launcher-tile icon="store" label="Marketplace" sublabel="Browse items and suppliers" href="/marketplace" />
    <app-launcher-tile icon="circle-user" label="Profile" sublabel="Your account and settings" href="/settings/profile" />

    <p-toast position="bottom-right" />
  `,
})
export class LauncherGridComponent {
  protected readonly config = inject(PageConfigService);
  private readonly toast = inject(MessageService);

  /** Create-project modal is pV2-06 territory — visible stub per the spec. */
  protected stubCreate(): void {
    this.toast.add({
      severity: 'info',
      summary: 'Coming soon',
      detail: `TODO(pV2-06): the create-${this.config.eventLabel().toLowerCase()} modal lands with the projects arc.`,
      life: 3000,
    });
  }
}
