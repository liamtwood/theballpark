import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { MarkdownPipe } from '../markdown.pipe';

/** The "What's included" copy block — ONE implementation shared by the variant picker and
 *  the add-on/options multipicker (Liam 2026-11-25: "these should be the same code"). An
 *  uppercase label + the markdown description(s) of the chosen variant/option. Renders
 *  nothing when there's no copy. */
@Component({
  selector: 'app-whats-included',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, MarkdownPipe],
  template: `
    @if (descriptions().length) {
      <div class="bp-whats-incl">
        <span class="bp-whats-incl__label"><lucide-icon name="circle-check" [size]="13" /> What's included</span>
        @for (d of descriptions(); track $index) {
          <div class="bp-whats-incl__item bp-md bp-body-small text-secondary" [innerHTML]="d | md"></div>
        }
      </div>
    }
  `,
  styles: [
    `
      .bp-whats-incl { display: flex; flex-direction: column; gap: 0.4rem; }
      .bp-whats-incl__label {
        display: inline-flex; align-items: center; gap: 0.4rem;
        font-size: var(--text-xs); font-weight: 600; letter-spacing: 0.05em;
        text-transform: uppercase; color: var(--color-text-secondary);
      }
      .bp-whats-incl__item.bp-md :first-child { margin-top: 0; }
      .bp-whats-incl__item.bp-md :last-child { margin-bottom: 0; }
    `,
  ],
})
export class WhatsIncludedComponent {
  /** One entry per description to show (variants stack one per picked dimension). */
  readonly descriptions = input<string[]>([]);
}
