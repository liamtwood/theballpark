import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** pV2-MEDIA-01 audit F-1 (RP-11) — Unsplash attribution surfaced wherever an
 *  image with `attribution` displays (MEDIA.md lock §4 — compliance, not
 *  optional). One definition; mount inside any `position: relative` image card.
 *  Renders nothing when there's no attribution. */
@Component({
  selector: 'app-unsplash-credit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    @if (attribution(); as a) {
      <span class="bp-unsplash-credit">
        Photo by
        <a [href]="a.photoUrl" target="_blank" rel="noopener">{{ a.photographerName }}</a>
        on Unsplash
      </span>
    }
  `,
  styles: `
    .bp-unsplash-credit {
      position: absolute;
      bottom: 6px;
      left: 6px;
      max-width: calc(100% - 12px);
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--color-surface);
      border: 1px solid var(--color-border-hairline);
      color: var(--color-text-muted);
      font-size: var(--text-2xs);
      line-height: var(--leading-normal);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .bp-unsplash-credit a {
      color: var(--color-text);
      text-decoration: underline;
    }
  `,
})
export class UnsplashCreditComponent {
  readonly attribution = input<{ photographerName: string; photoUrl: string } | undefined>(undefined);
}
