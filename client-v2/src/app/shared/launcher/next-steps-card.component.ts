import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';

/** One Next-steps action: a deep-link (or a coming-soon stub), with an optional
 *  count badge and a helper line. */
export interface NextStep {
  icon: string;
  label: string;
  /** Router path; omit for a coming-soon stub. */
  href?: string;
  /** Optional query params for the link (e.g. { tab: 'store', status: 'draft' }). */
  query?: Record<string, string>;
  /** Optional count badge (e.g. how many drafts need submitting). */
  count?: number;
  /** Optional helper line under the label. */
  description?: string;
  /** Renders disabled with a "Coming soon" tag instead of a link. */
  comingSoon?: boolean;
}

/** Home "Next steps" panel — a data-driven action list rendered as a launcher
 *  grid child (inherits the tile column width). The agency and supplier homes
 *  pass different `items`; each row is a deep-link with an optional count badge
 *  (right-aligned, marketplace-strip style) + helper line, or a coming-soon
 *  stub. Optional `note` footer (the estimate disclaimer). */
@Component({
  selector: 'app-next-steps-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, RouterLink],
  host: { class: 'bp-card bp-card--lifted bp-next-steps' },
  template: `
    <div class="bp-next-steps__body">
      <h2 class="bp-card-title bp-next-steps__title">Next steps</h2>

      <ul class="bp-next-steps__list">
        @for (step of items(); track step.label) {
          <li>
            @if (step.comingSoon) {
              <span class="bp-next-steps__link ns-soon-row">
                <lucide-icon [name]="step.icon" [size]="18" [strokeWidth]="1.5" />
                <span class="ns-text">
                  <span class="ns-label">{{ step.label }}</span>
                  @if (step.description) { <span class="ns-desc">{{ step.description }}</span> }
                </span>
                <span class="ns-soon">Soon</span>
              </span>
            } @else {
              <a [routerLink]="step.href" [queryParams]="step.query ?? null" class="bp-next-steps__link">
                <lucide-icon [name]="step.icon" [size]="18" [strokeWidth]="1.5" />
                <span class="ns-text">
                  <span class="ns-label">{{ step.label }}</span>
                  @if (step.description) { <span class="ns-desc">{{ step.description }}</span> }
                </span>
                <!-- Count badge right-aligned (marketplace strip style); the
                     go-arrow only when there's no count. -->
                @if (step.count !== undefined) {
                  <span class="bp-count-badge ns-count">{{ step.count }}</span>
                } @else {
                  <lucide-icon name="arrow-up-right" [size]="15" [strokeWidth]="1.5" class="bp-next-steps__go" />
                }
              </a>
            }
          </li>
        }
      </ul>

      @if (note()) {
        <p class="bp-next-steps__note">{{ note() }}</p>
      }
    </div>
  `,
  styles: [
    `
      .bp-next-steps__body {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 24px;
      }
      .bp-next-steps__title {
        margin: 0;
      }
      .bp-next-steps__list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .bp-next-steps__link {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: start;
        gap: 10px;
        text-decoration: none;
        color: var(--theme-accent);
        font-family: var(--font-body);
        font-size: var(--text-sm);
        line-height: 1.35;
        outline: none;
      }
      .bp-next-steps__link lucide-icon {
        margin-top: 1px;
      }
      .ns-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      .ns-label {
        font-weight: 400;
      }
      .ns-desc {
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
        line-height: 1.4;
      }
      .bp-next-steps__go {
        color: var(--theme-accent);
        opacity: 0.8;
      }
      .ns-count {
        align-self: center;
      }
      .bp-next-steps__link:hover .ns-label {
        text-decoration: underline;
      }
      .bp-next-steps__link:focus-visible {
        outline: 2px solid var(--theme-accent);
        outline-offset: 2px;
        border-radius: 6px;
      }
      /* Coming-soon stub: muted, non-interactive, with a small tag. */
      .ns-soon-row {
        color: var(--color-text-secondary);
        cursor: default;
      }
      .ns-soon {
        align-self: center;
        flex: none;
        padding: 2px 8px;
        border-radius: var(--radius-pill);
        background: var(--color-fill);
        color: var(--color-text-secondary);
        font-size: var(--text-2xs);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .bp-next-steps__note {
        margin: 4px 0 0;
        color: var(--color-text-secondary);
        font-family: var(--font-body);
        font-size: var(--text-xs);
        line-height: 1.45;
      }
    `,
  ],
})
export class NextStepsCardComponent {
  readonly items = input.required<readonly NextStep[]>();
  readonly note = input<string>('');
}
