import { Component, Input, Output, EventEmitter, booleanAttribute } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { DropdownModule } from 'primeng/dropdown';

export type EditFieldType = 'text' | 'email' | 'tel' | 'number' | 'select' | 'textarea';
export type EditFieldDensity = 'card' | 'drawer';

/**
 * <app-edit-field> — the single home for the "zero-shift" editable attribute
 * field. One control serves both view and edit with identical metrics; only a
 * grey fill + border toggle on `.is-edit`, so the value never moves or resizes.
 *
 * Why this component exists: the `.bp-fld` / `.is-edit` wiring — including the
 * PrimeNG-wrapper gotcha — lives in exactly ONE place. The gotcha: Angular's
 * `[class.is-edit]` lands on the host element, but for `p-inputNumber` /
 * `p-dropdown` the `.bp-fld` class (via styleClass) lands on the inner
 * `.p-inputnumber` / `.p-dropdown` span — a DIFFERENT element — so the
 * `.bp-fld.is-edit` selector never matches. The fix is to route BOTH classes
 * through `styleClass` so they co-locate (see `wrapStyleClass`). Plain
 * `pInputText` / `textarea` carry both on the one element via `[class.is-edit]`.
 *
 * DENSITY — same field, two metric scales (NOT two idioms):
 *   - 'card'   (default) = 38px field, 11px label — the page/settings-card scale
 *     (/settings/organisation). Uses the global `.bp-fld` rules unchanged.
 *   - 'drawer' = 34px field, 10px label — the tighter scale for sidebar drawers.
 *     Same chrome scaled down via `.bp-fld--drawer` / `.bp-field--drawer`.
 *   The container (drawer vs page) is chosen by the consuming surface — exactly
 *   one at a time — and picks the density. Migration drawer→page is a flag flip.
 *
 * Verified types (Tier 1): text, email, tel, number. textarea/select are
 * implemented for completeness; their zero-shift polish (textarea height,
 * dropdown label metrics) is finalised when first used in a card section.
 */
@Component({
  selector: 'app-edit-field',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    InputTextModule, InputNumberModule, InputTextareaModule, DropdownModule,
  ],
  template: `
    <div class="bp-field" [class.bp-field-s2]="span2" [class.bp-field--drawer]="density === 'drawer'">
      <label class="bp-field-label" *ngIf="label">{{ label }}</label>

      <!-- text / email / tel -->
      <input *ngIf="type === 'text' || type === 'email' || type === 'tel'"
             pInputText
             [type]="type"
             [ngModel]="value"
             (ngModelChange)="onModel($event)"
             [readonly]="isReadonly"
             [attr.maxlength]="maxlength || null"
             [placeholder]="isEdit ? placeholder : ''"
             class="w-full"
             [ngClass]="fldBase"
             [class.is-edit]="isEdit"/>

      <!-- number (+ optional suffix). is-edit rides on styleClass — see header. -->
      <p-inputNumber *ngIf="type === 'number'"
             [ngModel]="value"
             (ngModelChange)="onModel($event)"
             [suffix]="suffix || ''"
             [readonly]="isReadonly"
             [styleClass]="wrapStyleClass"></p-inputNumber>

      <!-- select. is-edit rides on styleClass — see header. -->
      <p-dropdown *ngIf="type === 'select'"
             [ngModel]="value"
             (ngModelChange)="onModel($event)"
             [options]="options || []"
             optionLabel="label" optionValue="value"
             [readonly]="isReadonly"
             [placeholder]="placeholder"
             [styleClass]="wrapStyleClass"></p-dropdown>

      <!-- textarea -->
      <textarea *ngIf="type === 'textarea'"
             pInputTextarea
             [ngModel]="value"
             (ngModelChange)="onModel($event)"
             [readonly]="isReadonly"
             [placeholder]="isEdit ? placeholder : ''"
             [rows]="rows"
             class="w-full bp-fld-textarea"
             [ngClass]="fldBase"
             [class.is-edit]="isEdit"></textarea>

      <span *ngIf="hint" class="bp-field-hint">{{ hint }}</span>
    </div>
  `,
  styles: ['']
})
export class EditFieldComponent {
  @Input() label = '';
  @Input() value: any;
  @Output() valueChange = new EventEmitter<any>();

  @Input({ transform: booleanAttribute }) editing = false;
  @Input() type: EditFieldType = 'text';
  @Input() suffix?: string;
  @Input() options: { label: string; value: any }[] | null = null;
  @Input() placeholder = '';
  /** Visible rows for type="textarea" (height grows from here). */
  @Input() rows = 3;
  @Input() maxlength?: number;
  @Input({ transform: booleanAttribute }) uppercase = false;
  @Input({ transform: booleanAttribute }) span2 = false;
  @Input() hint?: string;
  /** Always read-only (display-only fields, e.g. a server-driven counter). */
  @Input({ transform: booleanAttribute }) readonlyAlways = false;
  @Input() density: EditFieldDensity = 'card';

  /** Editing AND not a display-only field. */
  get isEdit(): boolean { return this.editing && !this.readonlyAlways; }
  get isReadonly(): boolean { return this.readonlyAlways || !this.editing; }

  /** Base field class(es) — `.bp-fld` plus the drawer-density scale. */
  get fldBase(): string {
    return this.density === 'drawer' ? 'bp-fld bp-fld--drawer' : 'bp-fld';
  }

  /**
   * styleClass for PrimeNG wrapper controls (number/select): `.bp-fld` AND
   * `.is-edit` must sit on the SAME element, so both go through styleClass.
   */
  get wrapStyleClass(): string {
    return 'w-full ' + this.fldBase + (this.isEdit ? ' is-edit' : '');
  }

  onModel(v: any): void {
    let next = v;
    if (this.uppercase && typeof next === 'string') next = next.toUpperCase();
    this.value = next;
    this.valueChange.emit(next);
  }
}
