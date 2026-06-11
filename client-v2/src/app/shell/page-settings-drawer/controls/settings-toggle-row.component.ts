import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToggleSwitchModule } from 'primeng/toggleswitch';

/** pV2-04 — drawer control row: label left, toggle right. Save-on-change:
 *  emits immediately, the drawer persists. */
@Component({
  selector: 'app-settings-toggle-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ToggleSwitchModule],
  host: { class: 'bp-settings-row flex h-10 items-center justify-between gap-3' },
  template: `
    <span class="text-sm">{{ label() }}</span>
    <p-toggleswitch
      [ngModel]="checked()"
      (ngModelChange)="changed.emit($event)"
      [ariaLabel]="label()"
    />
  `,
})
export class SettingsToggleRowComponent {
  readonly label = input.required<string>();
  readonly checked = input.required<boolean>();
  readonly changed = output<boolean>();
}
