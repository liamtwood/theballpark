import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { CompletenessConfig } from './completeness.types';

/** pV2-MEDIA-01f — `<app-completeness-card>`. Computes a weighted "% complete"
 *  for an entity from a client-side config and renders a progress bar plus the
 *  unmet items as suggested actions that deep-link (via `actionClicked`) into
 *  the host's editors. No schema (MEDIA.md decision §7); generic over the
 *  entity type so any consumer feeds its own object + config.
 *
 *    <app-completeness-card [entity]="org" [config]="cfg"
 *      (actionClicked)="open($event)" /> */
@Component({
  selector: 'app-completeness-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  imports: [LucideAngularModule],
  template: `
    <div class="bp-card p-5">
      <div class="flex items-center justify-between gap-3">
        <h3 class="bp-edit-section-title">{{ title() }}</h3>
        <span class="text-md font-medium" [class.text-accent]="percent() === 100">{{ percent() }}%</span>
      </div>

      <div
        class="bp-progress mt-3"
        role="progressbar"
        [attr.aria-valuenow]="percent()"
        aria-valuemin="0"
        aria-valuemax="100"
        [attr.aria-valuetext]="percent() + '% complete'"
      >
        <span [style.width.%]="percent()"></span>
      </div>

      @if (remaining().length) {
        <p class="bp-caption mt-3">Complete your {{ entityLabel() }}:</p>
        <ul class="mt-2 flex flex-col gap-1">
          @for (item of remaining(); track item.action + item.label) {
            <li>
              <button type="button" class="bp-suggested-action" (click)="actionClicked.emit(item.action)">
                <lucide-icon name="plus" [size]="14" />
                <span>{{ item.label }}</span>
              </button>
            </li>
          }
        </ul>
      } @else {
        <p class="bp-caption mt-3 inline-flex items-center gap-1.5">
          <lucide-icon name="check" [size]="14" class="text-accent" />
          All set — your {{ entityLabel() }} is complete.
        </p>
      }
    </div>
  `,
  styles: `
    .bp-progress {
      height: 8px;
      border-radius: 999px;
      background: var(--color-border-hairline);
      overflow: hidden;
    }
    .bp-progress > span {
      display: block;
      height: 100%;
      border-radius: 999px;
      background: var(--bp-gradient);
      transition: width 0.4s ease;
    }
    .bp-suggested-action {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--theme-accent);
      font-size: var(--text-sm);
      line-height: var(--leading-normal);
      cursor: pointer;
    }
    .bp-suggested-action:hover {
      text-decoration: underline;
    }
    .bp-suggested-action:focus-visible {
      outline: 2px solid var(--theme-accent);
      outline-offset: 2px;
      border-radius: 4px;
    }
  `,
})
export class CompletenessCardComponent<T> {
  readonly entity = input.required<T>();
  readonly config = input.required<CompletenessConfig<T>>();
  readonly title = input('Profile completeness');
  /** Used in the body copy ("Complete your <label>"). */
  readonly entityLabel = input('profile');

  /** Emits the unmet item's `action` token; the host opens the matching editor. */
  readonly actionClicked = output<string>();

  protected readonly percent = computed(() => {
    const cfg = this.config();
    const e = this.entity();
    const total = cfg.reduce((sum, i) => sum + i.weight, 0) || 1;
    const got = cfg.reduce((sum, i) => (i.done(e) ? sum + i.weight : sum), 0);
    return Math.round((got / total) * 100);
  });

  protected readonly remaining = computed(() => {
    const e = this.entity();
    return this.config().filter((i) => !i.done(e));
  });
}
