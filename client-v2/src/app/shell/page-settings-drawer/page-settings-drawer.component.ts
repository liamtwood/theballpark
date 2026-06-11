import { ChangeDetectionStrategy, Component, inject, model } from '@angular/core';
import { DrawerModule } from 'primeng/drawer';
import { TabsModule } from 'primeng/tabs';
import { PageConfigService } from '../../core/config/page-config.service';
import { PageConfigPayload, SectionFlag } from '../../core/config/page-config.types';
import { SettingsSelectRowComponent } from './controls/settings-select-row.component';
import { SettingsTextRowComponent } from './controls/settings-text-row.component';
import { SettingsToggleRowComponent } from './controls/settings-toggle-row.component';

/** pV2-04 — the page-settings drawer (the v2 rebuild of v1's p0017/p0032
 *  cog drawer): right-side p-drawer, two tabs (Dashboard / General), every
 *  control saves on change via PageConfigService.update — no Save/Cancel.
 *  Admin-gated by the PARENT (the cog only renders for org admins; the
 *  server re-checks org.invite_member on every PUT regardless). */
@Component({
  selector: 'app-page-settings-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DrawerModule,
    TabsModule,
    SettingsToggleRowComponent,
    SettingsSelectRowComponent,
    SettingsTextRowComponent,
  ],
  template: `
    <p-drawer
      [visible]="open()"
      (visibleChange)="open.set($event)"
      position="right"
      styleClass="bp-drawer"
      [style]="{ width: '480px' }"
    >
      <ng-template #header>
        <div>
          <div class="text-[11px] font-medium uppercase tracking-wide text-secondary">Page settings</div>
          <div class="text-lg font-semibold">Customise your home</div>
        </div>
      </ng-template>

      <p-tabs value="dashboard">
        <p-tablist>
          <p-tab value="dashboard">Dashboard</p-tab>
          <p-tab value="general">General</p-tab>
        </p-tablist>
        <p-tabpanels>
          <p-tabpanel value="dashboard">
            <app-settings-select-row
              label="Title"
              [options]="titleModes"
              [value]="config.heroTitleMode()"
              (changed)="save({ heroTitleMode: $event === 'greeting' ? 'greeting' : $event === 'username' ? 'username' : $event === 'orgName' ? 'orgName' : 'fixed' })"
            />
            @if (config.heroTitleMode() === 'fixed') {
              <app-settings-text-row
                label="Fixed title"
                [value]="config.heroTitleFixed()"
                placeholder="e.g. Mission Control"
                [maxLength]="80"
                (changed)="save({ heroTitleFixed: $event })"
              />
            }
            <app-settings-text-row
              label="Subtitle"
              [value]="config.heroSubtitle()"
              placeholder="Shown under the title"
              (changed)="save({ heroSubtitle: $event })"
            />

            <div class="mt-4 mb-1 text-[11px] font-medium uppercase tracking-wide text-secondary">Sections</div>
            @for (s of sections; track s.flag) {
              <app-settings-toggle-row
                [label]="s.label()"
                [checked]="config.sectionFlag(s.flag)"
                (changed)="saveFlag(s.flag, $event)"
              />
            }
          </p-tabpanel>

          <p-tabpanel value="general">
            <app-settings-select-row
              label="Hero color"
              [options]="heroColors"
              [value]="config.heroColor()"
              (changed)="save({ heroColor: $event === 'none' ? 'none' : 'theme' })"
            />
            <app-settings-select-row
              label="Hero align"
              [options]="heroAligns"
              [value]="config.heroAlign()"
              (changed)="save({ heroAlign: $event === 'center' ? 'center' : 'left' })"
            />

            <div class="mt-4 mb-1 text-[11px] font-medium uppercase tracking-wide text-secondary">Labels</div>
            <app-settings-text-row
              label="Credits"
              [value]="config.creditLabel()"
              [maxLength]="30"
              (changed)="save({ creditLabel: $event || undefined })"
            />
            <app-settings-text-row
              label="Events"
              [value]="config.eventLabel()"
              [maxLength]="30"
              (changed)="save({ eventLabel: $event || undefined })"
            />
            <app-settings-text-row
              label="Clients"
              [value]="config.clientLabel()"
              [maxLength]="30"
              (changed)="save({ clientLabel: $event || undefined })"
            />
          </p-tabpanel>
        </p-tabpanels>
      </p-tabs>
    </p-drawer>
  `,
})
export class PageSettingsDrawerComponent {
  protected readonly config = inject(PageConfigService);

  /** Two-way visibility — the parent's cog flips this. */
  readonly open = model<boolean>(false);

  protected readonly titleModes = [
    { label: 'Greeting', value: 'greeting' },
    { label: 'Username', value: 'username' },
    { label: 'Org name', value: 'orgName' },
    { label: 'Fixed text', value: 'fixed' },
  ];
  protected readonly heroColors = [
    { label: 'Theme', value: 'theme' },
    { label: 'None', value: 'none' },
  ];
  protected readonly heroAligns = [
    { label: 'Left', value: 'left' },
    { label: 'Center', value: 'center' },
  ];

  /** Section rows — labels interpolate the configurable labels live (p0018). */
  protected readonly sections: { flag: SectionFlag; label: () => string }[] = [
    { flag: 'showStats', label: () => 'Stats strip' },
    { flag: 'showUpcoming', label: () => 'Upcoming' },
    { flag: 'showQuickActions', label: () => 'Quick Actions' },
    { flag: 'showRecentActivity', label: () => 'Recent Activity' },
    { flag: 'showCredits', label: () => `${this.config.creditLabel()}s card` },
    { flag: 'showSavedSuppliers', label: () => 'Saved Suppliers' },
  ];

  protected save(patch: Partial<PageConfigPayload>): void {
    void this.config.update(patch);
  }

  protected saveFlag(flag: SectionFlag, on: boolean): void {
    void this.config.update({ [flag]: on });
  }
}
