import { ChangeDetectionStrategy, Component } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Build-identity chip, fixed bottom-right on every page. The host IS the chip
 *  (no inner wrapper) per the host:-binding standard. */
@Component({
  selector: 'app-version-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'bp-version-chip' },
  template: `{{ chip }}`,
  styles: [
    `
      :host {
        position: fixed;
        bottom: 12px;
        right: 16px;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 11px;
        color: var(--color-text-secondary);
        pointer-events: none;
        z-index: 50;
        opacity: 0.55;
        user-select: none;
      }
    `,
  ],
})
export class VersionChipComponent {
  /** The environment's build chip, e.g. "[Dev v2] v2.01a". */
  protected readonly chip = environment.versionChip;
}
