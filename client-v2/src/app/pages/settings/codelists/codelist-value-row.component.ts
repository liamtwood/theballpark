import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CodelistValue, CodelistValuePatch } from '../../../core/codelists/codelist.types';
import { EditFieldComponent, EditFieldOption } from '../../../shared/edit-field/edit-field.component';
import { StatusPillComponent } from '../../../shared/status-pill/status-pill.component';

/** pV2-CODELISTS-02 (audit F-7 extraction) — ONE value row of the
 *  /settings/codelists curation table. Ballpark lists edit in place;
 *  system lists render read-only (locked rule 1). The parent owns data,
 *  saves and the deactivation gate — this row just emits. */
@Component({
  selector: 'app-codelist-value-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EditFieldComponent, StatusPillComponent],
  host: {
    class:
      'grid grid-cols-[110px_1fr_80px_70px_120px_110px] items-center gap-x-4 border-b border-hairline px-4 py-1.5 last:border-b-0',
    '[class.opacity-60]': '!value().isActive',
  },
  template: `
    <span class="bp-body-small truncate" [title]="value().code">
      {{ value().code }}@if (value().isDefault) {<span class="bp-meta"> ★</span>}
    </span>
    @if (editable()) {
      <app-edit-field label="" type="text" [maxLength]="100" [value]="value().label" [editing]="true" (valueChange)="save.emit({ label: $event })" />
      <app-edit-field label="" type="text" [maxLength]="20" [value]="value().symbol ?? ''" [editing]="true" (valueChange)="save.emit({ symbol: $event })" />
      <app-edit-field label="" type="number" [value]="String(value().sortOrder ?? 0)" [editing]="true" (valueChange)="save.emit({ sortOrder: Number($event) || 0 })" />
    } @else {
      <span class="bp-body-small truncate">{{ value().label }}</span>
      <span class="bp-body-small text-secondary">{{ value().symbol ?? '—' }}</span>
      <span class="bp-body-small text-secondary">{{ value().sortOrder ?? '—' }}</span>
    }
    <span>
      @if (value().meta.color) {
        <app-status-pill [list]="listName()" [code]="value().code" />
      } @else {
        <span class="bp-meta">—</span>
      }
    </span>
    <app-edit-field
      label=""
      type="select"
      [options]="visibility"
      [value]="value().isActive ? 'visible' : 'hidden'"
      [editing]="true"
      (valueChange)="toggleActive.emit($event === 'visible')"
    />
  `,
})
export class CodelistValueRowComponent {
  protected readonly String = String;
  protected readonly Number = Number;

  readonly listName = input.required<string>();
  readonly value = input.required<CodelistValue>();
  /** true = ballpark list (edit in place); false = system (read-only). */
  readonly editable = input.required<boolean>();

  readonly save = output<CodelistValuePatch>();
  readonly toggleActive = output<boolean>();

  /** Binary UI mapping of isActive — deliberately NOT a codelist
   *  (CODELISTS.md: booleans stay booleans). */
  protected readonly visibility: EditFieldOption[] = [
    { label: 'Visible', value: 'visible' },
    { label: 'Hidden', value: 'hidden' },
  ];
}
