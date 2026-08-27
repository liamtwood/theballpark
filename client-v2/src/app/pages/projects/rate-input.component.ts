import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

/** pV2-BUILDUP-04 — the editable rate field on the Project Coverage card
 *  (Contingency %, Insurance % or £, Margin %). Visually IDENTICAL to the
 *  quantity control (same .bp-qty-stepper / .bp-qty-step / .bp-qty-input
 *  chrome), but allows 0 and decimals (rates, not counts). Commits on blur AND
 *  Enter, and on every stepper press; reverts the field on anything unparseable.
 *  The parent owns the persist + reload, so this stays a controlled input. */
@Component({
  selector: 'app-rate-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    <div class="bp-qty-stepper">
      <button type="button" class="bp-qty-step" [attr.aria-label]="'Decrease ' + ariaLabel()"
              (mousedown)="$event.preventDefault()" (click)="nudge(-1)">
        <lucide-icon name="minus" [size]="13" />
      </button>
      <input
        type="number"
        [min]="min()"
        [step]="stepBy()"
        inputmode="decimal"
        class="bp-qty-input"
        [value]="draft()"
        [attr.aria-label]="ariaLabel()"
        (click)="$event.stopPropagation()"
        (input)="draft.set($any($event.target).value)"
        (blur)="commit()"
        (keydown.enter)="commit(); $any($event.target).blur()"
      />
      <button type="button" class="bp-qty-step" [attr.aria-label]="'Increase ' + ariaLabel()"
              (mousedown)="$event.preventDefault()" (click)="nudge(1)">
        <lucide-icon name="plus" [size]="13" />
      </button>
    </div>
  `,
})
export class RateInputComponent {
  readonly value = input.required<number>();
  /** Accessible-label noun, e.g. "contingency %". */
  readonly label = input<string>('rate');
  /** Stepper increment (default 1 — a whole percent). */
  readonly stepBy = input<number>(1);
  readonly min = input<number>(0);
  readonly rateCommit = output<number>();

  /** Draft string, re-seeded whenever the bound value changes (persist lands,
   *  or a parent revert restores the old value). */
  protected readonly draft = linkedSignal<string>(() => String(this.value()));
  protected readonly ariaLabel = computed(() => this.label());

  protected commit(): void {
    const n = this.parsedDraft();
    if (n === null) {
      this.draft.set(String(this.value())); // invalid → revert
      return;
    }
    if (n === this.value()) {
      this.draft.set(String(n)); // normalise; no emit
      return;
    }
    this.rateCommit.emit(n);
  }

  protected nudge(delta: number): void {
    const base = this.parsedDraft() ?? this.value();
    const next = Math.max(this.min(), round2(base + delta * this.stepBy()));
    this.draft.set(String(next));
    if (next !== this.value()) this.rateCommit.emit(next);
  }

  private parsedDraft(): number | null {
    const n = Number(this.draft());
    return Number.isFinite(n) && n >= this.min() ? round2(n) : null;
  }
}

/** Keep rates to 2 dp — matches NUMERIC(_,2) and kills float drift. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
