import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

/** v2.11c — the per-section edit lifecycle card: the v2 EDIT-FORM STANDARD
 *  (DESIGN.md §10; Profile is the reference consumer). Card chrome + a
 *  .bp-edit-section-title header, projected fields, and a bottom-left
 *  .bp-card-foot button row: view → "Edit" outline pill; editing →
 *  "Cancel" outline pill + "Save changes" gradient CTA (disabled while
 *  saving). The CONSUMER owns the data (snapshot on (edit), restore on
 *  (cancelled), persist on (save)) — this component owns only the chrome
 *  + state flips, so every edit surface behaves identically. */
@Component({
  selector: 'app-edit-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'block rounded-[var(--radius-card)] border border-hairline bg-surface p-6' },
  template: `
    <h2 class="bp-edit-section-title mb-6">{{ title() }}</h2>
    <ng-content />
    @if (editable()) {
      <div class="mt-6 flex items-center gap-2.5">
        @if (!editing()) {
          <button type="button" class="bp-btn-outline" (click)="startEdit()">
            <lucide-icon name="square-pen" [size]="16" />
            {{ editLabel() }}
          </button>
        } @else {
          <button type="button" class="bp-btn-outline" [disabled]="saving()" (click)="cancelEdit()">
            Cancel
          </button>
          <button type="button" class="bp-btn-grad" [disabled]="saving()" (click)="save.emit()">
            <lucide-icon name="check" [size]="16" />
            {{ saveLabel() }}
          </button>
        }
      </div>
    }
  `,
})
export class EditSectionComponent {
  readonly title = input.required<string>();
  /** Hide the button row entirely (read-only viewers, e.g. members). */
  readonly editable = input<boolean>(true);
  /** Two-way editing state — consumer reads it to flip its fields. */
  readonly editing = model<boolean>(false);
  /** Disables Cancel/Save while the consumer persists. */
  readonly saving = input<boolean>(false);
  /** Button copy overrides (per v1's edit-section parity). */
  readonly editLabel = input<string>('Edit');
  readonly saveLabel = input<string>('Save changes');

  /** Fired when edit starts — consumer snapshots its data. */
  readonly edit = output<void>();
  /** Fired on cancel — consumer restores its snapshot. (Named cancelled —
   *  the no-output-native lint bans outputs shadowing DOM events.) */
  readonly cancelled = output<void>();
  /** Fired on Save — consumer persists, then flips editing off itself. */
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
