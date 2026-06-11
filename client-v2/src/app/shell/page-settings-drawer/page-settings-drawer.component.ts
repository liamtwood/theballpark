import { ChangeDetectionStrategy, Component, inject, model } from '@angular/core';
import { DrawerModule } from 'primeng/drawer';
import { PageConfigService } from '../../core/config/page-config.service';
import { PageConfigPayload } from '../../core/config/page-config.types';
import { SettingsSelectRowComponent } from './controls/settings-select-row.component';
import { SettingsInputRowComponent } from './controls/settings-input-row.component';

/** pV2-04b — the page-settings drawer for the launcher-only home: right
 *  p-drawer, SINGLE body (no tabs — there's no Sections group on this
 *  surface), every control saves on change via PageConfigService. Admin-gated
 *  by the PARENT (the cog only renders for admins; the server re-checks
 *  org.invite_member on every PUT regardless). */
@Component({
  selector: 'app-page-settings-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DrawerModule, SettingsSelectRowComponent, SettingsInputRowComponent],
  template: `
    <p-drawer
      [visible]="visible()"
      (visibleChange)="visible.set($event)"
      position="right"
      styleClass="bp-drawer"
      [style]="{ width: '420px' }"
    >
      <ng-template #header>
        <div>
          <div class="text-[11px] font-medium uppercase tracking-wide text-secondary">Page settings</div>
          <div class="text-lg font-semibold">Customise your home</div>
        </div>
      </ng-template>

      <app-settings-select-row
        label="Title"
        [options]="titleModes"
        [value]="config.heroTitleMode()"
        (valueChange)="saveTitleMode($event)"
      />
      @if (config.heroTitleMode() === 'fixed') {
        <app-settings-input-row
          label="Title text"
          [value]="config.heroTitleFixed()"
          placeholder="e.g. Mission Control"
          [maxLength]="80"
          (valueChange)="save({ heroTitleFixed: $event })"
        />
      }
      <app-settings-input-row
        label="Subtitle"
        [value]="config.heroSubtitle()"
        placeholder="Shown under the title"
        (valueChange)="save({ heroSubtitle: $event })"
      />
      <app-settings-select-row
        label="Align"
        [options]="aligns"
        [value]="config.heroAlign()"
        (valueChange)="save({ heroAlign: $event === 'left' ? 'left' : 'center' })"
      />

      <hr class="my-3 border-hairline" />

      <app-settings-input-row
        label="Credits label"
        [value]="config.creditLabel()"
        [maxLength]="30"
        (valueChange)="save({ creditLabel: $event || undefined })"
      />
      <app-settings-input-row
        label="Events label"
        [value]="config.eventLabel()"
        [maxLength]="30"
        (valueChange)="save({ eventLabel: $event || undefined })"
      />
      <app-settings-input-row
        label="Clients label"
        [value]="config.clientLabel()"
        [maxLength]="30"
        (valueChange)="save({ clientLabel: $event || undefined })"
      />
    </p-drawer>
  `,
})
export class PageSettingsDrawerComponent {
  protected readonly config = inject(PageConfigService);

  /** Two-way visibility — the parent's cog flips this. */
  readonly visible = model<boolean>(false);

  protected readonly titleModes = [
    { label: 'Greeting', value: 'greeting' },
    { label: 'Username', value: 'username' },
    { label: 'Org name', value: 'orgName' },
    { label: 'Fixed text', value: 'fixed' },
  ];
  protected readonly aligns = [
    { label: 'Center', value: 'center' },
    { label: 'Left', value: 'left' },
  ];

  protected save(patch: Partial<PageConfigPayload>): void {
    void this.config.update(patch);
  }

  protected saveTitleMode(mode: string): void {
    const valid = ['greeting', 'username', 'orgName', 'fixed'] as const;
    const next = valid.find((m) => m === mode) ?? 'greeting';
    void this.config.update({ heroTitleMode: next });
  }
}
