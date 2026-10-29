import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CodelistValue, CodelistValuePatch, metaColor } from '../../../core/codelists/codelist.types';
import { SelectComponent, SelectOption } from '../../../shared/select/select.component';
import { StatusPillComponent } from '../../../shared/status-pill/status-pill.component';

/** pV2-CODELISTS-02 (audit F-7 extraction) — ONE value row of the
 *  /settings/codelists curation table. Ballpark lists edit in place;
 *  system lists render read-only (locked rule 1). The parent owns data,
 *  saves and the deactivation gate — this row just emits. */
@Component({
  selector: 'app-codelist-value-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SelectComponent, StatusPillComponent],
  host: {
    class:
      'grid grid-cols-[110px_1fr_80px_70px_170px_110px] items-center gap-x-4 border-b border-hairline px-4 py-1.5 last:border-b-0',
    '[class.opacity-60]': '!value().isActive',
  },
  template: `
    <span class="bp-body-small truncate" [title]="value().code">
      {{ value().code }}@if (value().isDefault) {<span class="bp-meta"> ★</span>}
    </span>
    @if (editable()) {
      <input class="ed-input" maxlength="100" aria-label="Label" [ngModel]="value().label" (blur)="commitText($event, 'label')" />
      <input class="ed-input" maxlength="20" aria-label="Symbol" [ngModel]="value().symbol ?? ''" (blur)="commitText($event, 'symbol')" />
      <input class="ed-input" type="number" aria-label="Sort order" [ngModel]="String(value().sortOrder ?? 0)" (blur)="commitSort($event)" />
    } @else {
      <span class="bp-body-small truncate">{{ value().label }}</span>
      <span class="bp-body-small text-secondary">{{ value().symbol ?? '—' }}</span>
      <span class="bp-body-small text-secondary">{{ value().sortOrder ?? '—' }}</span>
    }
    <span>
      @if (editable()) {
        <!-- Colour picker — swatches set meta.color (first = clear). Shows the live
             pill too, so you see the result (Liam 2026-10-29). -->
        <div class="flex items-center gap-2">
          <div class="flex flex-wrap items-center gap-[3px]">
            @for (opt of colorOptions; track opt) {
              <button type="button"
                class="h-3.5 w-3.5 shrink-0 rounded-full border border-hairline"
                [style.background]="opt ? metaColor(opt) : 'var(--color-surface)'"
                [style.box-shadow]="(value().meta.color ?? '') === opt ? '0 0 0 2px var(--theme-accent)' : ''"
                [attr.title]="opt || 'None'" [attr.aria-label]="opt || 'None'"
                (click)="save.emit({ color: opt })"></button>
            }
          </div>
          @if (value().meta.color) {
            <app-status-pill [list]="listName()" [code]="value().code" />
          }
        </div>
      } @else if (value().meta.color) {
        <app-status-pill [list]="listName()" [code]="value().code" />
      } @else {
        <span class="bp-meta">—</span>
      }
    </span>
    <app-select
      ariaLabel="Visibility"
      [options]="visibility"
      [value]="value().isActive ? 'visible' : 'hidden'"
      (changed)="toggleActive.emit($event === 'visible')"
    />
  `,
})
export class CodelistValueRowComponent {
  protected readonly String = String;
  protected readonly metaColor = metaColor;

  /** The status-pill colour palette (design tokens). First '' = clear → the pill
   *  falls back to neutral. Pick any in Settings ▸ Codelists. */
  protected readonly colorOptions = [
    '', '--color-state-gray', '--color-info', '--color-warn', '--color-state-sky',
    '--color-state-orange', '--color-success', '--color-state-emerald', '--color-danger',
  ];

  readonly listName = input.required<string>();
  readonly value = input.required<CodelistValue>();
  /** true = ballpark list (edit in place); false = system (read-only). */
  readonly editable = input.required<boolean>();

  readonly save = output<CodelistValuePatch>();
  readonly toggleActive = output<boolean>();

  /** Binary UI mapping of isActive — deliberately NOT a codelist
   *  (CODELISTS.md: booleans stay booleans). */
  protected readonly visibility: SelectOption[] = [
    { label: 'Visible', value: 'visible' },
    { label: 'Hidden', value: 'hidden' },
  ];

  /** Save-on-blur: emit only when the trimmed text actually changed (parity
   *  with the legacy edit-field commitText — no redundant PATCH). */
  protected commitText(ev: Event, key: 'label' | 'symbol'): void {
    const next = (ev.target as HTMLInputElement).value.trim();
    if (key === 'label') {
      if (next !== this.value().label) this.save.emit({ label: next });
    } else if (next !== (this.value().symbol ?? '')) {
      this.save.emit({ symbol: next });
    }
  }

  protected commitSort(ev: Event): void {
    const next = (ev.target as HTMLInputElement).value.trim();
    if (next !== String(this.value().sortOrder ?? 0)) {
      this.save.emit({ sortOrder: Number(next) || 0 });
    }
  }
}
