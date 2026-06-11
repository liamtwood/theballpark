import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';

/** pV2-04 — drawer control row: label left, text input right. Commits on
 *  blur / Enter (not per keystroke — every commit is a PUT). Not in the
 *  spec's two-row list, but the drawer has five text fields; same
 *  extraction logic as the toggle/select rows. */
@Component({
  selector: 'app-settings-text-row',
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
export class SettingsTextRowComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly placeholder = input<string>('');
  readonly maxLength = input<number>(120);
  readonly changed = output<string>();

  protected commit(ev: Event): void {
    const next = (ev.target as HTMLInputElement).value.trim();
    if (next !== this.value()) {
      this.changed.emit(next);
    }
  }
}
