import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';

export type EditFieldType = 'text' | 'select';
export type EditFieldDensity = 'drawer' | 'page';

/** Option shape for type="select". */
export interface EditFieldOption {
  label: string;
  value: string;
}

/** pV2-04b1-qc — the v2 `<app-edit-field>`: one labelled, zero-shift editable
 *  attribute field (the v1 primitive rebuilt on signals). One control serves
 *  view and edit with identical metrics; only the fill + border toggle on
 *  editing, so the value never moves or resizes (the v1 "zero-shift" law).
 *
 *  THIS PROMPT'S SCOPE: drawer density + text/select only, and drawer
 *  consumers run always-editing (save-on-change). Page density, more types
 *  and the per-section View/Edit lifecycle land in pV2-04c — extend, don't
 *  re-engineer.
 *
 *  The v1 PrimeNG-wrapper gotcha carries over: for p-select the field class
 *  must ride `styleClass` so it lands on the SAME element PrimeNG styles —
 *  a host-level class never matches `.bp-fld.is-edit` on the inner span. */
@Component({
  selector: 'app-edit-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, InputTextModule, SelectModule],
  host: {
    class: 'bp-edit-field',
    '[class.bp-edit-field--drawer]': "density() === 'drawer'",
    '[class.bp-edit-field--page]': "density() === 'page'",
    '[class.bp-edit-field--editing]': 'editing()',
  },
  template: `
    <div class="bp-field-label bp-edit-field__label">{{ label() }}</div>
    @switch (type()) {
      @case ('text') {
        @if (editing()) {
          <input
            pInputText
            class="bp-fld"
            [class.is-edit]="editing()"
            [ngModel]="value()"
            [attr.placeholder]="placeholder()"
            [attr.maxlength]="maxLength()"
            [attr.aria-label]="label()"
            (blur)="commitText($event)"
            (keydown.enter)="commitText($event)"
          />
        } @else {
          <div class="bp-fld bp-edit-field__value">{{ value() || placeholder() }}</div>
        }
      }
      @case ('select') {
        @if (editing()) {
          <p-select
            [styleClass]="'w-full bp-fld' + (editing() ? ' is-edit' : '')"
            [options]="options()"
            optionLabel="label"
            optionValue="value"
            [ngModel]="value()"
            (ngModelChange)="valueChange.emit($event)"
            [ariaLabel]="label()"
          />
        } @else {
          <div class="bp-fld bp-edit-field__value">{{ selectedLabel() }}</div>
        }
      }
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      /* Label type comes from .bp-field-label (pV2-TYPE-01); this structural
         class keeps only spacing. */
      .bp-edit-field__label {
        margin-bottom: 4px;
        padding-left: 10px;
      }
      /* The zero-shift field: identical metrics in view + edit; only fill and
         border toggle with .is-edit. Drawer density = 34px (v1's tighter
         sidebar scale); page density (pV2-04c) will set 38px. Family inherits
         --bp-font; size from the Layer-1 token. */
      .bp-fld {
        display: flex;
        align-items: center;
        width: 100%;
        height: 34px;
        padding: 0 10px;
        font-size: var(--text-md);
        color: var(--color-text);
        background: transparent;
        border: 1px solid transparent;
        border-radius: 10px;
        box-shadow: none;
        transition: none;
      }
      input.bp-fld.is-edit {
        background: var(--color-fill);
        border-color: var(--color-border-hairline);
      }
      input.bp-fld.is-edit:focus {
        outline: none;
        border-color: var(--theme-accent);
      }
      /* p-select carries .bp-fld via styleClass on its own root span. */
      :host ::ng-deep .p-select.bp-fld.is-edit {
        background: var(--color-fill);
        border-color: var(--color-border-hairline);
      }
      :host ::ng-deep .p-select.bp-fld {
        height: 34px;
        border-radius: 10px;
        align-items: center;
      }
      /* PrimeNG's select label carries its OWN size/color tokens (16px /
         --p-select-color) AND its own x-padding — which double-indents on
         top of .bp-fld's 10px root padding. Pin the value to the same field
         metrics as the text input and zero the inner padding so "Greeting"
         starts exactly where typed text does (pV2-TYPE-01 QC). */
      :host ::ng-deep .p-select.bp-fld .p-select-label {
        font-size: var(--text-md);
        color: var(--color-text);
        padding: 0;
      }
      .bp-edit-field__value {
        cursor: default;
      }
    `,
  ],
})
export class EditFieldComponent {
  readonly label = input.required<string>();
  readonly type = input.required<EditFieldType>();
  readonly value = input<string>('');
  readonly options = input<EditFieldOption[]>([]);
  readonly placeholder = input<string>('');
  readonly maxLength = input<number>(120);
  readonly density = input<EditFieldDensity>('drawer');
  readonly editing = input<boolean>(false);
  readonly valueChange = output<string>();

  /** Text commits on blur/Enter — every commit is a PUT upstream. */
  protected commitText(ev: Event): void {
    const next = (ev.target as HTMLInputElement).value.trim();
    if (next !== this.value()) {
      this.valueChange.emit(next);
    }
  }

  protected readonly selectedLabel = computed(() => {
    const v = this.value();
    return this.options().find((o) => o.value === v)?.label ?? v;
  });
}
