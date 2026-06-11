import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';

/** pV2-04b — drawer control row: label left, text input right. Commits on
 *  blur / Enter (not per keystroke — every commit is a PUT). */
@Component({
  selector: 'app-settings-input-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, InputTextModule],
  host: { class: 'bp-settings-row flex h-12 items-center justify-between gap-3' },
  template: `
    <span class="shrink-0 text-sm">{{ label() }}</span>
    <input
      pInputText
      class="w-44"
      pSize="small"
      [ngModel]="value()"
      [attr.placeholder]="placeholder()"
      [attr.maxlength]="maxLength()"
      [attr.aria-label]="label()"
      (blur)="commit($event)"
      (keydown.enter)="commit($event)"
    />
  `,
})
export class SettingsInputRowComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly placeholder = input<string>('');
  readonly maxLength = input<number>(120);
  readonly valueChange = output<string>();

  protected commit(ev: Event): void {
    const next = (ev.target as HTMLInputElement).value.trim();
    if (next !== this.value()) {
      this.valueChange.emit(next);
    }
  }
}
