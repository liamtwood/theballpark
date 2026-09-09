import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';

/** Agent home — the "Next steps" panel (Liam, 2026-09-09). Rendered as a
 *  grid child of the launcher so it inherits the exact tile column width and
 *  sits directly under the Profile tile. Same .bp-card chrome as the tiles;
 *  three deep-link actions + the indicative-estimate disclaimer. */
@Component({
  selector: 'app-next-steps-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, RouterLink],
  host: { class: 'bp-card bp-card--lifted bp-next-steps' },
  template: `
    <div class="bp-next-steps__body">
      <h2 class="bp-card-title bp-next-steps__title">Next steps</h2>

      <ul class="bp-next-steps__list">
        <li>
          <a routerLink="/projects/new" class="bp-next-steps__link">
            <lucide-icon name="circle-plus" [size]="18" [strokeWidth]="1.5" />
            <span>Start a new project from a brief</span>
            <lucide-icon name="arrow-up-right" [size]="15" [strokeWidth]="1.5" class="bp-next-steps__go" />
          </a>
        </li>
        <li>
          <a routerLink="/marketplace" class="bp-next-steps__link">
            <lucide-icon name="store" [size]="18" [strokeWidth]="1.5" />
            <span>Browse approved suppliers</span>
            <lucide-icon name="arrow-up-right" [size]="15" [strokeWidth]="1.5" class="bp-next-steps__go" />
          </a>
        </li>
        <li>
          <a routerLink="/settings/profile" class="bp-next-steps__link">
            <lucide-icon name="user" [size]="18" [strokeWidth]="1.5" />
            <span>Complete your profile so approval is quicker</span>
            <lucide-icon name="arrow-up-right" [size]="15" [strokeWidth]="1.5" class="bp-next-steps__go" />
          </a>
        </li>
      </ul>

      <p class="bp-next-steps__note">
        Ballpark estimates are indicative and subject to supplier confirmation,
        final scope, availability, delivery requirements and VAT.
      </p>
    </div>
  `,
  styles: [
    `
      :host(.bp-next-steps) {
        border-radius: 28px;
      }
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
      .bp-next-steps__go {
        color: var(--theme-accent);
        opacity: 0.8;
      }
      .bp-next-steps__link:hover span {
        text-decoration: underline;
      }
      .bp-next-steps__link:focus-visible {
        outline: 2px solid var(--theme-accent);
        outline-offset: 2px;
        border-radius: 6px;
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
export class NextStepsCardComponent {}
