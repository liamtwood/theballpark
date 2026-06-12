import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';

export type EditFieldType = 'text' | 'email' | 'tel' | 'number' | 'select';
export type EditFieldDensity = 'drawer' | 'page';

/** Option shape for type="select". */
export interface EditFieldOption {
  label: string;
  value: string;
}

/** The v2 `<app-edit-field>`: one labelled, zero-shift editable attribute
 *  field (the v1 primitive rebuilt on signals). One control serves view and
 *  edit with identical metrics; only the fill + border toggle on editing, so
 *  the value never moves or resizes (the v1 "zero-shift" law).
 *
 *  DENSITY — same field, two metric scales (NOT two idioms): 'drawer' = 34px
 *  (sidebar scale, pV2-04b1-qc), 'page' = 38px (settings-card scale, the
 *  Profile port). The consuming surface picks exactly one.
 *
 *  The v1 PrimeNG-wrapper gotcha carries over: for p-select / p-inputnumber
 *  the field class must ride `styleClass` so it lands on the SAME element
 *  PrimeNG styles — a host-level class never matches the inner span. */
@Component({
  selector: 'app-edit-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, InputTextModule, InputNumberModule, SelectModule],
  host: {
    class: 'bp-edit-field',
    '[class.bp-edit-field--drawer]': "density() === 'drawer'",
    '[class.bp-edit-field--page]': "density() === 'page'",
    '[class.bp-edit-field--editing]': 'editing()',
    '[class.bp-edit-field--span2]': 'span2()',
  },
  template: `
    @if (label()) {
      <div class="bp-field-label bp-edit-field__label">{{ label() }}</div>
    }
    @switch (type()) {
      @case ('select') {
        @if (editing()) {
          <p-select
            [styleClass]="'w-full bp-fld' + (editing() ? ' is-edit' : '')"
            appendTo="body"
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
      @case ('number') {
        @if (editing() && !readonlyAlways()) {
          <p-inputnumber
            [styleClass]="'w-full bp-fld is-edit'"
            [ngModel]="numberValue()"
            (ngModelChange)="commitNumber($event)"
            [suffix]="suffix()"
            [minFractionDigits]="0"
            [maxFractionDigits]="2"
          />
        } @else {
          <div class="bp-fld bp-edit-field__value">{{ value() }}{{ suffix() }}</div>
        }
      }
      @default {
        @if (editing() && !readonlyAlways()) {
          <input
            pInputText
            class="bp-fld"
            [class.is-edit]="editing()"
            [type]="type()"
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
         border toggle with .is-edit. Family inherits --bp-font; size from the
         Layer-1 token. Drawer = 34px, page = 38px (v1's two scales). */
      .bp-fld {
        display: flex;
        align-items: center;
        width: 100%;
        height: 34px;
        padding: 0 10px;
        font-size: var(--text-md);
        color: var(--color-text-strong);
        background: transparent;
        border: 1px solid transparent;
        border-radius: 10px;
        box-shadow: none;
        transition: none;
      }
      :host(.bp-edit-field--page) .bp-fld {
        height: 38px;
      }
      input.bp-fld.is-edit {
        background: var(--color-fill);
        border-color: var(--color-border-hairline);
      }
      input.bp-fld.is-edit:focus {
        outline: none;
        border-color: var(--theme-accent);
      }
      /* PrimeNG wrappers carry .bp-fld via styleClass on their own root. The
         inner label/input have their OWN size/color/padding tokens that don't
         inherit — pin them to the field metrics (pV2-TYPE-01 QC). */
      :host ::ng-deep .p-select.bp-fld.is-edit,
      :host ::ng-deep .p-inputnumber.bp-fld.is-edit {
        background: var(--color-fill);
        border: 1px solid var(--color-border-hairline);
      }
      :host ::ng-deep .p-select.bp-fld,
      :host ::ng-deep .p-inputnumber.bp-fld {
        height: 34px;
        border-radius: 10px;
        align-items: center;
      }
      :host(.bp-edit-field--page) ::ng-deep .p-select.bp-fld,
      :host(.bp-edit-field--page) ::ng-deep .p-inputnumber.bp-fld {
        height: 38px;
      }
      :host ::ng-deep .p-select.bp-fld .p-select-label {
        font-size: var(--text-md);
        color: var(--color-text-strong);
        padding: 0;
      }
      :host ::ng-deep .p-inputnumber.bp-fld .p-inputnumber-input {
        font-size: var(--text-md);
        color: var(--color-text-strong);
        background: transparent;
        border: none;
        box-shadow: none;
        padding: 0;
        width: 100%;
      }
      .bp-edit-field__value {
        cursor: default;
      }
    `,
  ],
})
export class EditFieldComponent {
  readonly label = input<string>('');
  readonly type = input<EditFieldType>('text');
  readonly value = input<string>('');
  readonly options = input<EditFieldOption[]>([]);
  readonly placeholder = input<string>('');
  readonly maxLength = input<number>(120);
  readonly density = input<EditFieldDensity>('drawer');
  readonly editing = input<boolean>(false);
  /** Display-only fields (e.g. server-driven counters) never enter edit. */
  readonly readonlyAlways = input<boolean>(false);
  /** Numeric suffix, e.g. "%" (type="number"). */
  readonly suffix = input<string>('');
  /** Spans both columns of a bp-field-grid-2. */
  readonly span2 = input<boolean>(false);
  readonly valueChange = output<string>();

  /** Text commits on blur/Enter — every commit is a save upstream. */
  protected commitText(ev: Event): void {
    const next = (ev.target as HTMLInputElement).value.trim();
    if (next !== this.value()) {
      this.valueChange.emit(next);
    }
  }

  protected commitNumber(v: number | null): void {
    this.valueChange.emit(v === null || v === undefined ? '' : `${v}`);
  }

  protected readonly numberValue = computed(() => {
    const n = Number(this.value());
    return Number.isFinite(n) ? n : null;
  });

  protected readonly selectedLabel = computed(() => {
    const v = this.value();
    return this.options().find((o) => o.value === v)?.label ?? v;
  });
}
