import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** The Ballpark wordmark anchor. Renders the brand logo image (served from
 *  public/ballpark-logo.png); the alt text "Ballpark" shows if the image is
 *  missing. One Definition: shell header, public landing header and login
 *  chrome all mount THIS, never re-style their own anchor. */
@Component({
  selector: 'app-wordmark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  host: { class: 'inline-block' },
  template: `
    <a [routerLink]="link()" class="bp-wordmark" aria-label="Ballpark">
      <img src="/ballpark-logo.png" alt="Ballpark" class="bp-wordmark-img" />
    </a>
  `,
  styles: [
    `
      .bp-wordmark-img {
        display: block;
        height: 22px;
        width: auto;
      }
    `,
  ],
})
export class WordmarkComponent {
  /** Router target — '/' on public chrome, '/home' inside the auth shell. */
  readonly link = input<string>('/');
}
