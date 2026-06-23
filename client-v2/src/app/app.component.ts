import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** Root — routed content. The build chip moved off the floating footer
 *  into the user menu, above Sign out (Liam, 2026-06-12) — the footer
 *  fought the viewport-fit pages for the bottom edge. */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class AppComponent {}
