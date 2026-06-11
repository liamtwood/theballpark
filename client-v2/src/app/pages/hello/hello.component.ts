import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { can } from '../../core/auth/permissions';
import { PageHeroComponent } from '../../shell/page-hero/page-hero.component';

/** API reachability state for the scaffold health check. */
type ApiStatus = 'checking' | 'connected' | 'unreachable';

/** Landing surface — page hero greets the real session user (pV2-02); body
 *  keeps the stack proofs (API dot + Aura button) plus the temporary can()
 *  permission proof from pV2-02 criterion 10. */
@Component({
  selector: 'app-hello',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, RouterLink, PageHeroComponent],
  host: { class: 'block' },
  template: `
    @let u = auth.user();

    @if (u) {
      <app-page-hero
        [title]="'Hello, ' + (u.displayName ?? u.email)"
        [subtitle]="'You are signed in as ' + u.role + ' at ' + u.activeOrgName"
      />
    } @else {
      <app-page-hero title="Welcome" subtitle="Sign in to get started." />
    }

    <div class="bp-page-body">
      @if (!u) {
        <a routerLink="/login" class="text-sm font-medium" style="color: var(--theme-accent)">Sign in →</a>
      }

      @if (hasCheckout()) {
        <!-- TEMP (pV2-02 criterion 10) — proves can() works end to end. -->
        <div class="mb-4 inline-block rounded-full bg-success-soft px-3 py-1 text-xs font-medium text-success">
          has checkout
        </div>
      }

      <div class="flex items-center gap-2 text-sm">
        @if (apiStatus() === 'checking') {
          <span class="inline-block h-2.5 w-2.5 rounded-full bg-muted"></span>
          <span class="text-secondary">API: checking…</span>
        } @else if (apiStatus() === 'connected') {
          <span class="inline-block h-2.5 w-2.5 rounded-full bg-success"></span>
          <span class="text-success">API: connected</span>
        } @else {
          <span class="inline-block h-2.5 w-2.5 rounded-full bg-warn"></span>
          <span class="text-warn">API: not reachable</span>
        }
      </div>

      <div class="mt-8">
        <p-button label="Primary action" />
        <p class="mt-2 text-xs text-muted">
          ↑ PrimeNG Aura button, themed via the <code>BallparkPreset</code> brand bridge.
        </p>
      </div>
    </div>
  `,
})
export class HelloComponent implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly auth = inject(AuthService);

  /** Live API reachability — drives the status dot. */
  protected readonly apiStatus = signal<ApiStatus>('checking');

  /** TEMP (criterion 10) — can() proof against the live role signal. */
  protected readonly hasCheckout = computed(() => can(this.auth.role(), 'cart.checkout'));

  ngOnInit(): void {
    this.api.get<{ status: string }>('/api/health').subscribe({
      next: () => this.apiStatus.set('connected'),
      error: () => this.apiStatus.set('unreachable'),
    });
  }
}
