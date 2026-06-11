import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '../../core/auth/auth.service';
import { PublicHeaderComponent } from '../../shared/public-header/public-header.component';

/** Public landing page — the Ballpark front door at `/` (pV2-02b). Anonymous
 *  visitors see brand + two CTAs; BOTH call the same /auth/google endpoint
 *  (the Sign In / Sign Up framing is UI-only — the server upsert handles new
 *  vs existing). No auth check, no redirect: signed-in users who type `/`
 *  see this page too (intentional for now, per the prompt's edge-case table). */
@Component({
  selector: 'app-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, PublicHeaderComponent],
  host: { class: 'block min-h-screen' },
  template: `
    <app-public-header />

    <main class="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 class="max-w-xl text-4xl font-semibold tracking-tight">
        Plan events with the right suppliers.
      </h1>
      <p class="mt-4 max-w-md text-secondary">
        Ballpark connects agencies and suppliers — build estimates, send briefs, close deals.
        Free to start.
      </p>
      <p-button
        label="Sign Up — it's free"
        size="large"
        class="mt-8 block"
        (onClick)="auth.loginWithGoogle()"
      />
    </main>
  `,
})
export class LandingComponent {
  protected readonly auth = inject(AuthService);
}
