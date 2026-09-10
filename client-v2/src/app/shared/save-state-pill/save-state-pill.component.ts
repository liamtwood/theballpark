import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

/** The save lifecycle for an implicitly-saved (save-on-blur) surface. */
export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/** The standard "Details saved" pill — the shared confirmation for surfaces
 *  that dropped explicit Edit/Save buttons in favour of save-on-blur (About
 *  Project, the Ballpark Cost Event details, New Project, …). One definition
 *  so the wording, colours and icon can't drift between surfaces.
 *
 *  - saving → "Saving…" (neutral)
 *  - error  → "Couldn't save" (danger)
 *  - saved  → the success pill (check + label)
 *  - idle   → nothing, unless `idleShowsSaved` (then the success pill, i.e. a
 *             "resting = already saved" surface).
 *
 *  `label` customises the success text (default "Details saved"). */
@Component({
  selector: 'app-save-state-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'contents' },
  template: `
    @switch (state()) {
      @case ('saving') {
        <span class="bp-pill bp-body-small text-secondary">Saving…</span>
      }
      @case ('error') {
        <span class="bp-pill bp-pill--danger bp-body-small">Couldn't save</span>
      }
      @case ('saved') {
        <span class="bp-pill bp-pill--success bp-body-small inline-flex items-center gap-1.5">
          <lucide-icon name="check" [size]="14" [strokeWidth]="2" /> {{ label() }}
        </span>
      }
      @default {
        @if (idleShowsSaved()) {
          <span class="bp-pill bp-pill--success bp-body-small inline-flex items-center gap-1.5">
            <lucide-icon name="check" [size]="14" [strokeWidth]="2" /> {{ label() }}
          </span>
        }
      }
    }
  `,
})
export class SaveStatePillComponent {
  readonly state = input<SaveState>('idle');
  readonly label = input('Details saved');
  /** When true, the resting (idle) state also shows the success pill — for a
   *  surface that's "already saved" the moment it loads. */
  readonly idleShowsSaved = input(false);
}
