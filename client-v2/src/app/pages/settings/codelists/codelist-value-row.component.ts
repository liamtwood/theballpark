import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CodelistValue, CodelistValuePatch } from '../../../core/codelists/codelist.types';
import { StatusPillComponent } from '../../../shared/status-pill/status-pill.component';

/** pV2-CODELISTS-02 (audit F-7 extraction) — ONE value row of the
 *  /settings/codelists curation table. Ballpark lists edit in place;
 *  system lists render read-only (locked rule 1). The parent owns data,
 *  saves and the deactivation gate — this row just emits. */
@Component({
  selector: 'app-codelist-value-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, StatusPillComponent],
  host: {
    class:
      'grid grid-cols-[100px_1fr_70px_60px_110px_130px_80px] items-center gap-x-4 border-b border-hairline px-4 py-1.5 last:border-b-0',
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
    <!-- Color — the picker (stores the hex in meta.color). Clear sits right after
         the input so it lines up down the column; clearing → neutral pill. Read-only
         (system) lists show no picker. -->
    <span>
      @if (editable()) {
        <div class="flex items-center gap-3">
          <input type="color" class="h-6 w-8 shrink-0 cursor-pointer rounded border border-hairline bg-surface p-0"
            [value]="currentHex()" (change)="pickColor($event)"
            [attr.aria-label]="'Colour for ' + value().code" />
          @if (value().meta.color) {
            <button type="button" class="bp-meta shrink-0 underline" (click)="save.emit({ color: '' })">Clear</button>
          }
        </div>
      } @else {
        <span class="bp-meta">—</span>
      }
    </span>
    <!-- Preview — the live pill (label + colour). -->
    <span>
      @if (value().meta.color) {
        <app-status-pill [list]="listName()" [code]="value().code" />
      } @else {
        <span class="bp-meta">—</span>
      }
    </span>
    <!-- Visible — checkbox; unchecking deactivates (via the parent's in-use gate). -->
    <label class="inline-flex cursor-pointer items-center">
      <input type="checkbox" class="h-4 w-4 cursor-pointer" style="accent-color: var(--theme-accent)"
        [checked]="value().isActive" (change)="toggleActive.emit($any($event.target).checked)"
        aria-label="Visible" />
    </label>
  `,
})
export class CodelistValueRowComponent {
  protected readonly String = String;

  /** The current colour as a hex, for the native <input type="color"> value. A hex
   *  passes through; a design-token ref (--color-…) is resolved to its computed hex;
   *  anything unresolvable (or no colour) falls back to a neutral grey. */
  protected currentHex(): string {
    const c = this.value().meta.color;
    if (!c) return '#6b7280';
    if (c.startsWith('#')) return c;
    const v = getComputedStyle(document.documentElement).getPropertyValue(c).trim();
    return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? v : '#6b7280';
  }

  /** Commit the picked hex to meta.color. */
  protected pickColor(ev: Event): void {
    this.save.emit({ color: (ev.target as HTMLInputElement).value });
  }

  readonly listName = input.required<string>();
  readonly value = input.required<CodelistValue>();
  /** true = ballpark list (edit in place); false = system (read-only). */
  readonly editable = input.required<boolean>();

  readonly save = output<CodelistValuePatch>();
  readonly toggleActive = output<boolean>();

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
