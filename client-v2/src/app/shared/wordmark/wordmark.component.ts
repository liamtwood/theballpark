import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** The Ballpark wordmark anchor. Metrics exactly match the 40px avatar's
 *  initials (16px / 600 / line-height 1 / 0 tracking / --bp-font) — the
 *  pV2-01f QC rule. One Definition: shell header, public landing header and
 *  login chrome all mount THIS, never re-style their own anchor. */
@Component({
  selector: 'app-wordmark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  host: { class: 'inline-block' },
  template: `
    <!-- Metrics live in styles.css .bp-wordmark (pV2-TYPE-01 — the one legal
         site for the 16px brand literal). -->
    <a [routerLink]="link()" class="bp-wordmark">Ballpark</a>
  `,
})
export class WordmarkComponent {
  /** Router target — '/' on public chrome, '/home' inside the auth shell. */
  readonly link = input<string>('/');
}
