import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';

/** pV2-04 — launcher tile (the v2 rebuild of v1's <app-action-tile>, p0019).
 *  A focusable button card: icon square above title + subtitle. `href` tiles
 *  navigate; tiles without an href emit (pressed) and the parent wires the
 *  action (modal, stub, …). The primary variant wears the brand gradient. */
@Component({
  selector: 'app-launcher-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideAngularModule,
  ],
  host: { class: 'block' },
  template: `
    <button
      type="button"
      class="bp-launcher-tile"
      [class.bp-launcher-tile--primary]="primary()"
      [attr.aria-label]="label()"
      (click)="activate()"
    >
      <span class="bp-launcher-tile__icon">
        <lucide-icon [name]="icon()" [size]="20" />
      </span>
      <span class="block text-sm font-semibold">{{ label() }}</span>
      @if (sublabel()) {
        <span class="bp-launcher-tile__sub mt-1 block text-xs">{{ sublabel() }}</span>
      }
    </button>
  `,
  styles: [
    `
      .bp-launcher-tile {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 14px;
        width: 100%;
        min-height: 150px;
        padding: 20px;
        text-align: left;
        cursor: pointer;
        background: var(--color-surface);
        color: var(--theme-text);
        border: var(--border-hairline);
        border-radius: var(--radius-card);
        box-shadow: var(--shadow-md);
        transition: transform 0.12s ease, box-shadow 0.12s ease;
      }
      .bp-launcher-tile:hover {
        transform: translateY(-1px);
        box-shadow: var(--shadow-lg);
      }
      .bp-launcher-tile:active {
        transform: translateY(0);
      }
      .bp-launcher-tile:focus-visible {
        outline: 2px solid var(--theme-accent);
        outline-offset: 2px;
      }
      .bp-launcher-tile__icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border-radius: 14px;
        background: var(--theme-soft);
        color: var(--theme-accent);
      }
      .bp-launcher-tile__sub {
        color: var(--color-text-secondary);
      }

      /* Primary CTA — vivid brand gradient (DESIGN.md: gradient is brand-mark
         territory; the first tile is the home's primary action). */
      .bp-launcher-tile--primary {
        background: var(--bp-gradient);
        color: var(--bp-text-on-gradient);
        border: none;
      }
      .bp-launcher-tile--primary .bp-launcher-tile__icon {
        background: var(--color-surface-alt);
        color: var(--theme-accent);
      }
      .bp-launcher-tile--primary .bp-launcher-tile__sub {
        color: var(--bp-text-on-gradient);
        opacity: 0.85;
      }
    `,
  ],
})
export class LauncherTileComponent {
  private readonly router = inject(Router);

  /** Lucide icon name (must be in this component's pick). */
  readonly icon = input.required<string>();
  readonly label = input.required<string>();
  readonly sublabel = input<string>('');
  /** Router target; omit for tiles whose parent wires (pressed) instead. */
  readonly href = input<string | null>(null);
  /** Vivid gradient treatment for the primary CTA tile. */
  readonly primary = input<boolean>(false);

  /** Emitted when the tile has no href (parent-wired action). */
  readonly pressed = output<void>();

  protected activate(): void {
    const target = this.href();
    if (target) {
      void this.router.navigate([target]);
    } else {
      this.pressed.emit();
    }
  }
}
