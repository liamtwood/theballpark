import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { LucideAngularModule } from 'lucide-angular';
import { ApiService } from '../../core/api.service';
import { environment } from '../../../environments/environment';

/** API reachability state for the scaffold health check. */
type ApiStatus = 'checking' | 'connected' | 'unreachable';

/** Hello-world surface — proves the full stack: Angular 21 render, runtime
 *  config → API call, PrimeNG Aura button (themed via the token bridge),
 *  a Lucide icon, and the version chip. No real feature lives here. */
@Component({
  selector: 'app-hello',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, LucideAngularModule],
  template: `
    <section class="mx-auto max-w-2xl">
      <div class="mb-2 inline-flex items-center gap-2">
        <lucide-icon name="rocket" [size]="28" [strokeWidth]="1.5" style="color: var(--theme-accent)"></lucide-icon>
        <h1 class="text-3xl font-semibold tracking-tight">Ballpark v2</h1>
      </div>
      <p class="text-slate-500">Scaffold online · Angular 21 · PrimeNG 21</p>

      <div class="mt-4 inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-slate-600">
        {{ versionChip }}
      </div>

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
          ↑ PrimeNG Aura button, themed via the <code>--theme-accent</code> token bridge.
        </p>
      </div>
    </section>
  `,
})
export class HelloComponent implements OnInit {
  private readonly api = inject(ApiService);

  /** Version chip from the build-time environment. */
  protected readonly versionChip = environment.versionChip;

  /** Live API reachability — drives the status dot. */
  protected readonly apiStatus = signal<ApiStatus>('checking');

  ngOnInit(): void {
    this.api.get<{ status: string }>('/api/health').subscribe({
      next: () => this.apiStatus.set('connected'),
      error: () => this.apiStatus.set('unreachable'),
    });
  }
}
