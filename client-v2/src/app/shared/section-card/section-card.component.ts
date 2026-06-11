import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

/** pV2-04 — the home section-card primitive: eyebrow row (Lucide icon +
 *  small-caps label) above projected body content. Extracted BEFORE the six
 *  consumers existed (Extract Before Duplicate — same chrome on every card).
 *  The icon names this card can render are picked here, in one place; a new
 *  section adds its icon to this pick. */
@Component({
  selector: 'app-section-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideAngularModule,
  ],
  host: { class: 'bp-section-card block rounded-2xl bg-surface p-5' },
  template: `
    <div class="mb-3 flex items-center gap-2">
      <lucide-icon [name]="icon()" [size]="13" class="text-secondary" />
      <span class="text-[11px] font-medium uppercase tracking-wide text-secondary">
        {{ label() }}
      </span>
    </div>
    <ng-content />
  `,
  styles: [
    `
      :host {
        box-shadow: var(--shadow-xs);
        border-radius: var(--radius-card);
      }
    `,
  ],
})
export class SectionCardComponent {
  /** Lucide icon name for the eyebrow (must be in this component's pick). */
  readonly icon = input.required<string>();
  /** Small-caps eyebrow label. */
  readonly label = input.required<string>();
}
