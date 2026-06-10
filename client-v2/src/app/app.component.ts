import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { VersionChipComponent } from './shell/version-chip/version-chip.component';

/** Root — routed content plus the always-visible build chip (rendered here,
 *  outside the shell, so it shows on full-bleed pages like /login too). */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, VersionChipComponent],
  template: `
    <router-outlet />
    <app-version-chip />
  `,
})
export class AppComponent {}
