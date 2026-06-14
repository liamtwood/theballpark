import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

/** pV2-QUANTITY-01 — the quantity control on cart + quote lines. A centered,
 *  still-typeable field (event scale means people type large numbers) flanked
 *  by −/+ steppers for quick nudges. Commits on blur AND Enter, and on every
 *  stepper press; validates integer ≥ 1 (reverts to the current value on
 *  anything else). The parent owns the optimistic update + revert, so this
 *  stays a controlled input: it emits a committed integer and re-seeds its
 *  draft whenever the bound value changes (incl. a parent revert). Chrome
 *  from .bp-qty-stepper / .bp-qty-step / .bp-qty-input role classes. */
@Component({
  selector: 'app-qty-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    <div class="bp-qty-stepper">
      <!-- mousedown.preventDefault keeps focus on the input (no blur-commit
           race with the click). -->
      <button type="button" class="bp-qty-step" [attr.aria-label]="'Decrease ' + ariaLabel()" (mousedown)="$event.preventDefault()" (click)="step(-1)">
        <lucide-icon name="minus" [size]="13" />
      </button>
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
      <button type="button" class="bp-qty-step" [attr.aria-label]="'Increase ' + ariaLabel()" (mousedown)="$event.preventDefault()" (click)="step(1)">
        <lucide-icon name="plus" [size]="13" />
      </button>
    </div>
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
  protected readonly ariaLabel = computed(() => (this.label() ? `quantity for ${this.label()}` : 'quantity'));

  protected commit(): void {
    const n = this.parsedDraft();
    if (n === null) {
      this.draft.set(String(this.value())); // invalid → revert the field
      return;
    }
    if (n === this.value()) {
      this.draft.set(String(n)); // normalise (e.g. "007" → "7"); no emit
      return;
    }
    this.qtyCommit.emit(n);
  }

  /** Nudge up/down — base off the current draft when valid, else the bound
   *  value. Clamps to ≥ 1; emits only when it actually changes. */
  protected step(delta: number): void {
    const base = this.parsedDraft() ?? this.value();
    const next = Math.max(1, base + delta);
    this.draft.set(String(next));
    if (next !== this.value()) this.qtyCommit.emit(next);
  }

  private parsedDraft(): number | null {
    const n = Math.floor(Number(this.draft()));
    return Number.isFinite(n) && n >= 1 ? n : null;
  }
}
