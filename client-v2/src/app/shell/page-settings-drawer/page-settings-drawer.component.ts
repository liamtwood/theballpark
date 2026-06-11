import { ChangeDetectionStrategy, Component, inject, model } from '@angular/core';
import { DrawerModule } from 'primeng/drawer';
import { PageConfigService } from '../../core/config/page-config.service';
import { PageConfigPayload } from '../../core/config/page-config.types';
import { EditFieldComponent } from '../../shared/edit-field/edit-field.component';
import { ShellContextService } from '../shell-context.service';

/** pV2-04b1-qc — the page-settings drawer, rebuilt on <app-edit-field>
 *  (drawer density, always-editing, save-on-change): right p-drawer, single
 *  body, fields per the active page's registration. Mounted ONCE at the
 *  shell; pages register their settings via ShellContextService. Admin-gated
 *  by the shell's cog (the server re-checks org.invite_member on every PUT
 *  regardless). */
@Component({
  selector: 'app-page-settings-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DrawerModule, EditFieldComponent],
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
          <div class="bp-drawer-label">Page settings</div>
          <div class="bp-drawer-title">{{ drawerTitle() }}</div>
        </div>
      </ng-template>

      <div class="flex flex-col gap-4">
        <app-edit-field
          label="Title"
          type="select"
          [options]="titleModes"
          [value]="config.heroTitleMode()"
          density="drawer"
          [editing]="true"
          (valueChange)="saveTitleMode($event)"
        />
        @if (config.heroTitleMode() === 'fixed') {
          <app-edit-field
            label="Title text"
            type="text"
            [value]="config.heroTitleFixed()"
            placeholder="e.g. Mission Control"
            [maxLength]="80"
            density="drawer"
            [editing]="true"
            (valueChange)="save({ heroTitleFixed: $event })"
          />
        }
        <app-edit-field
          label="Subtitle"
          type="text"
          [value]="config.heroSubtitle()"
          placeholder="Shown under the title"
          density="drawer"
          [editing]="true"
          (valueChange)="save({ heroSubtitle: $event })"
        />
        <app-edit-field
          label="Position"
          type="select"
          [options]="aligns"
          [value]="config.heroAlign()"
          density="drawer"
          [editing]="true"
          (valueChange)="save({ heroAlign: $event === 'left' ? 'left' : 'center' })"
        />
      </div>
    </p-drawer>
  `,
})
export class PageSettingsDrawerComponent {
  protected readonly config = inject(PageConfigService);
  private readonly shellContext = inject(ShellContextService);

  /** Two-way visibility — the shell's cog flips this. */
  readonly visible = model<boolean>(false);

  protected drawerTitle(): string {
    return this.shellContext.pageSettings()?.label ?? 'Page settings';
  }

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
