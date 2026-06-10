import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** Root shell — minimal header placeholder + routed content. */
@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  template: `
    <header class="border-b border-black/5 bg-white/60 px-6 py-3">
      <span class="text-sm font-semibold tracking-tight" style="color: var(--theme-accent)">Ballpark</span>
      <span class="text-sm text-slate-500"> · v2 shell</span>
    </header>
    <main class="p-6">
      <router-outlet />
    </main>
  `,
})
export class AppComponent {}
