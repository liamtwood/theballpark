import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { currencySymbol, detailsCalcLine, detailsDateLine, detailsTotalStr } from './details-format';

export type DetailsMode = 'calc' | 'date' | 'plain';

/** pV2-BUILDUP-04 — the shared free-text "Details"-style editor, extracted from
 *  the inbox line-editor so item Details, the SOW Timeline, and Special Terms /
 *  Payment Terms all use ONE widget (markdown, plus per-line auto-formatting):
 *   - `calc`  → item Details: a `qty@price` / `N×M` line auto-totals, with a
 *               running total header (the original behaviour).
 *   - `date`  → SOW Timeline: a numeric date in a line normalises to NATO.
 *   - `plain` → Special/Payment Terms: markdown only, no per-line logic.
 *  Controlled input: `value` in, `valueChange` out (already formatted). */
@Component({
  selector: 'app-details-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  host: { class: 'block' },
  template: `
    @if (label()) {
      <div class="flex items-center justify-between gap-2">
        <span class="bp-field-label">{{ label() }}</span>
        @if (mode() === 'calc' && total(); as tot) {
          <span class="bp-body-small font-semibold tabular-nums text-text">{{ tot }}</span>
        }
      </div>
    }
    <textarea [rows]="rows()" class="bp-store-textarea mt-1 w-full" [placeholder]="placeholder()"
              [ngModel]="draft()" (ngModelChange)="draft.set($event)"
              (keydown.enter)="onEnter($event)" (blur)="onBlur()"></textarea>
  `,
})
export class DetailsEditorComponent {
  readonly value = input<string>('');
  readonly label = input<string>('Details');
  readonly mode = input<DetailsMode>('calc');
  /** Currency for `calc` mode (line totals + running total). */
  readonly currency = input<string | null>(null);
  readonly rows = input<number>(4);
  readonly placeholder = input<string>('Free text — **bold**, _italic_, - lists.');
  readonly valueChange = output<string>();

  /** Draft re-seeds whenever the bound value changes (parent reset). */
  protected readonly draft = linkedSignal<string>(() => this.value());
  private readonly sym = computed(() => currencySymbol(this.currency()));
  protected readonly total = computed(() => detailsTotalStr(this.draft(), this.sym()));

  /** Per-line formatter for the current mode. */
  private fmt(line: string): string {
    switch (this.mode()) {
      case 'calc': return detailsCalcLine(line, this.sym());
      case 'date': return detailsDateLine(line);
      default: return line;
    }
  }

  /** Enter formats the caret's line, then inserts a newline AT the caret. */
  protected onEnter(ev: Event): void {
    ev.preventDefault();
    const ta = ev.target as HTMLTextAreaElement;
    const pos = ta.selectionStart ?? ta.value.length;
    const before = ta.value.slice(0, pos);
    const after = ta.value.slice(pos);
    const lineStart = before.lastIndexOf('\n') + 1;
    const finalised = before.slice(0, lineStart) + this.fmt(before.slice(lineStart)) + '\n';
    const caret = finalised.length;
    this.commit(finalised + after);
    setTimeout(() => { try { ta.setSelectionRange(caret, caret); } catch { /* detached */ } }, 0);
  }
  protected onBlur(): void {
    this.commit(this.draft().split('\n').map((l) => this.fmt(l)).join('\n'));
  }
  private commit(next: string): void {
    if (next !== this.draft()) this.draft.set(next);
    this.valueChange.emit(this.draft());
  }
}
