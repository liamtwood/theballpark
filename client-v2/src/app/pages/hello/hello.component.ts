import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { PageHeroComponent } from '../../shell/page-hero/page-hero.component';

/** API reachability state for the scaffold health check. */
type ApiStatus = 'checking' | 'connected' | 'unreachable';

/** Landing surface — the standard page hero greets the session user; the body
 *  keeps the stack proofs from pV2-01 (API health dot + Aura button). */
@Component({
  selector: 'app-hello',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, PageHeroComponent],
  host: { class: 'block' },
  template: `
    @let u = auth.user();

    <app-page-hero
      [title]="'Hello, ' + (u?.displayName ?? 'friend')"
      [subtitle]="(u?.activeOrgName ?? '') + ' · ' + (u?.role ?? '')"
    />

    <div class="bp-page-body">
      <div class="flex items-center gap-2 text-sm">
        @if (apiStatus() === 'checking') {
          <span class="inline-block h-2.5 w-2.5 rounded-full bg-slate-300"></span>
          <span class="text-slate-500">API: checking…</span>
        } @else if (apiStatus() === 'connected') {
          <span class="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
          <span class="text-emerald-700">API: connected</span>
        } @else {
          <span class="inline-block h-2.5 w-2.5 rounded-full bg-orange-500"></span>
          <span class="text-orange-700">API: not reachable</span>
        }
      </div>

      <div class="mt-8">
        <p-button label="Primary action" />
        <p class="mt-2 text-xs text-slate-400">
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

  ngOnInit(): void {
    this.api.get<{ status: string }>('/api/health').subscribe({
      next: () => this.apiStatus.set('connected'),
      error: () => this.apiStatus.set('unreachable'),
    });
  }
}
