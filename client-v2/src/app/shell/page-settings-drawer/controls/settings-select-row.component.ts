import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';

/** Option shape for the select row. */
export interface SettingsOption {
  label: string;
  value: string;
}

/** pV2-04b — drawer control row: label left, p-select right. Save-on-change. */
@Component({
  selector: 'app-settings-select-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SelectModule],
  host: { class: 'bp-settings-row flex h-12 items-center justify-between gap-3' },
  template: `
    <span class="shrink-0 text-sm">{{ label() }}</span>
    <p-select
      class="w-44"
      styleClass="w-full"
      [options]="options()"
      optionLabel="label"
      optionValue="value"
      [ngModel]="value()"
      (ngModelChange)="valueChange.emit($event)"
      [ariaLabel]="label()"
      size="small"
    />
  `,
})
export class SettingsSelectRowComponent {
  readonly label = input.required<string>();
  readonly options = input.required<SettingsOption[]>();
  readonly value = input.required<string>();
  readonly valueChange = output<string>();
}
