import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { LucideAngularModule } from 'lucide-angular';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { UserAvatarComponent } from '../../shared/user-avatar/user-avatar.component';

/** API reachability state for the scaffold health check. */
type ApiStatus = 'checking' | 'connected' | 'unreachable';

/** Landing surface — greets the session user (stub auth until pV2-02) and
 *  keeps the stack proofs from pV2-01: API health dot + one Aura-themed
 *  PrimeNG button. Version chip moved to the shell footer in pV2-01b. */
@Component({
  selector: 'app-hello',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, LucideAngularModule, UserAvatarComponent],
  host: { class: 'mx-auto block max-w-2xl' },
  template: `
    @if (auth.user(); as user) {
      <div class="flex items-center gap-3">
        <app-user-avatar
          [displayName]="user.displayName"
          [email]="user.email"
          [imageUrl]="user.avatarUrl"
          [size]="44"
        />
        <div>
          <h1 class="text-3xl font-semibold tracking-tight">Hello, {{ user.displayName ?? user.email }}</h1>
          <p class="text-slate-500">{{ user.activeOrgName }} · {{ user.role }}</p>
        </div>
      </div>
    } @else {
      <h1 class="text-3xl font-semibold tracking-tight">Ballpark v2</h1>
      <p class="text-slate-500">Signed out.</p>
    }

    <div class="mt-6 flex items-center gap-2 text-sm">
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
