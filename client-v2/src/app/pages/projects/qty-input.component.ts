import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output } from '@angular/core';

/** pV2-QUANTITY-01 — the compact quantity field used on cart + quote lines.
 *  Commits on blur AND Enter; validates integer ≥ 1 (reverts to the current
 *  value on anything else). The parent owns the optimistic update + revert,
 *  so this stays a dumb controlled input: it emits a committed integer and
 *  re-seeds its draft whenever the bound value changes (incl. a parent
 *  revert). Chrome from the .bp-qty-input role class (no native spinner). */
@Component({
  selector: 'app-qty-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <input
      type="number"
      min="1"
      step="1"
      inputmode="numeric"
      class="bp-qty-input"
      [value]="draft()"
      [attr.aria-label]="ariaLabel()"
      (input)="draft.set($any($event.target).value)"
      (blur)="commit()"
      (keydown.enter)="commit(); $any($event.target).blur()"
    />
  `,
})
export class QtyInputComponent {
  readonly value = input.required<number>();
  /** Item name — used only for the accessible label. */
  readonly label = input<string | null>('');
  readonly qtyCommit = output<number>();

  /** Draft string, re-seeded whenever the bound value changes (optimistic
   *  update lands, or a parent revert restores the old value). */
  protected readonly draft = linkedSignal<string>(() => String(this.value()));
  protected readonly ariaLabel = computed(() => (this.label() ? `Quantity for ${this.label()}` : 'Quantity'));

  protected commit(): void {
    const n = Math.floor(Number(this.draft()));
    if (!Number.isFinite(n) || n < 1) {
      this.draft.set(String(this.value())); // invalid → revert the field
      return;
    }
    if (n === this.value()) {
      this.draft.set(String(n)); // normalise (e.g. "007" → "7"); no emit
      return;
    }
    this.qtyCommit.emit(n);
  }
}
