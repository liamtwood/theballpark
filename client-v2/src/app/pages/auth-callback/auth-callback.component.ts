import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Placeholder OAuth callback surface. Wired in pV2-02. */
@Component({
  selector: 'app-auth-callback',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-md text-center">
      <h1 class="text-2xl font-semibold tracking-tight">Signing you in…</h1>
      <p class="mt-2 text-slate-500">Auth callback placeholder.</p>
    </section>
  `,
})
export class AuthCallbackComponent {}
