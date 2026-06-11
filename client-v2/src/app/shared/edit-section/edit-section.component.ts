import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

/** pV2 Profile — the per-section edit lifecycle card (v1's reference
 *  standard, rebuilt on signals): a white card with a .bp-section-title
 *  header row; hover reveals the pencil (when editable), entering edit swaps
 *  it for tick/cross. The CONSUMER owns the data (snapshot on (edit),
 *  restore on (cancel), persist on (save)) — this component owns only the
 *  chrome + state flips, so every settings surface behaves identically. */
@Component({
  selector: 'app-edit-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'bp-edit-section block rounded-2xl border border-hairline bg-surface p-6' },
  template: `
    <div class="mb-4 flex items-center justify-between">
      <h2 class="bp-section-title">{{ title() }}</h2>
      @if (editable()) {
        @if (!editing()) {
          <button
            type="button"
            class="bp-edit-section__btn bp-edit-section__pencil"
            [attr.aria-label]="'Edit ' + title()"
            (click)="startEdit()"
          >
            <lucide-icon name="square-pen" [size]="16" />
          </button>
        } @else {
          <span class="flex items-center gap-1">
            <button
              type="button"
              class="bp-edit-section__btn"
              aria-label="Save"
              [disabled]="saving()"
              (click)="save.emit()"
            >
              <lucide-icon name="check" [size]="16" />
            </button>
            <button
              type="button"
              class="bp-edit-section__btn"
              aria-label="Cancel"
              [disabled]="saving()"
              (click)="cancelEdit()"
            >
              <lucide-icon name="x" [size]="16" />
            </button>
          </span>
        }
      }
    </div>
    <ng-content />
  `,
  styles: [
    `
      .bp-edit-section__btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        border-radius: 15px;
        background: transparent;
        border: 1px solid var(--color-border-hairline);
        color: var(--color-text-secondary);
        cursor: pointer;
      }
      .bp-edit-section__btn:hover {
        background: var(--color-fill);
        color: var(--theme-accent);
      }
      .bp-edit-section__btn:disabled {
        opacity: 0.5;
        cursor: default;
      }
      /* v1 pattern: the pencil appears on section hover. */
      .bp-edit-section__pencil {
        opacity: 0;
        transition: opacity 0.12s ease;
      }
      :host(:hover) .bp-edit-section__pencil,
      .bp-edit-section__pencil:focus-visible {
        opacity: 1;
      }
    `,
  ],
})
export class EditSectionComponent {
  readonly title = input.required<string>();
  /** Hide the pencil entirely (read-only viewers, e.g. members). */
  readonly editable = input<boolean>(true);
  /** Two-way editing state — consumer reads it to flip its fields. */
  readonly editing = model<boolean>(false);
  /** Disables tick/cross while the consumer persists. */
  readonly saving = input<boolean>(false);

  /** Fired when edit starts — consumer snapshots its data. */
  readonly edit = output<void>();
  /** Fired on cancel — consumer restores its snapshot. (Named cancelled —
   *  the no-output-native lint bans outputs shadowing DOM events.) */
  readonly cancelled = output<void>();
  /** Fired on tick — consumer persists, then flips editing off itself. */
  readonly save = output<void>();

  protected startEdit(): void {
    this.edit.emit();
    this.editing.set(true);
  }

  protected cancelEdit(): void {
    this.editing.set(false);
    this.cancelled.emit();
  }
}
