import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Placeholder login surface. Real Google OAuth lands in pV2-02. */
@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-md text-center">
      <h1 class="text-2xl font-semibold tracking-tight">Login</h1>
      <p class="mt-2 text-slate-500">Coming soon.</p>
    </section>
  `,
})
export class LoginComponent {}
