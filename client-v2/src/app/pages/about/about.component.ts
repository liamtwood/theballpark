import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { environment } from '../../../environments/environment';
import { PageHeroComponent } from '../../shell/page-hero/page-hero.component';

/** pV2-ABOUT-01 (FR-00207) — in-app About. App name + client release headline +
 *  source build + environment, all read from `environment` (the SAME single
 *  source as the version chip / About-line), so it updates every release with no
 *  separate edit. Links through to What's New. No backend. */
@Component({
  selector: 'app-about',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideAngularModule, PageHeroComponent],
  host: { class: 'block' },
  template: `
    <app-page-hero align="block" [back]="{ label: 'Back', href: '/home', history: true }" title="About" subtitle="App version & release" />

    <div class="bp-page-body bp-page-body--workspace">
      <div class="mx-auto max-w-xl">
        <div class="bp-card bp-card--lifted p-6">
          <div class="flex items-center gap-3 border-b border-hairline pb-4">
            <span class="bp-icon-block h-11 w-11 shrink-0"><lucide-icon name="rocket" [size]="22" /></span>
            <div class="min-w-0">
              <h2 class="bp-card-title">Ballpark</h2>
              <p class="bp-body-small text-secondary">Event-costing marketplace — brief to ballpark to quote.</p>
            </div>
          </div>

          <dl class="mt-4 grid grid-cols-[128px_minmax(0,1fr)] items-baseline gap-x-4 gap-y-3">
            <dt class="bp-field-label">Version</dt>
            <dd class="min-w-0">
              <div class="text-md font-semibold text-text">{{ versionChip }}</div>
              @if (release !== 'dev') {
                <div class="bp-caption text-muted">built from {{ build }}</div>
              }
            </dd>

            <dt class="bp-field-label">Environment</dt>
            <dd class="bp-body-small text-secondary">{{ envLabel }}</dd>
          </dl>

          <div class="mt-5 border-t border-hairline pt-4">
            <a routerLink="/whats-new" class="bp-btn-outline no-underline">
              <lucide-icon name="sparkles" [size]="16" />
              What's new
            </a>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class AboutComponent {
  protected readonly versionChip = environment.versionChip;
  protected readonly release = environment.release;
  protected readonly build = environment.build;

  /** Dev / Preview / Production, derived from the single environment source —
   *  dev has release 'dev'; prod sets production true (release v1.x); the
   *  staging build in between is Preview. */
  protected readonly envLabel =
    environment.release === 'dev' ? 'Development' : environment.production ? 'Production' : 'Preview';
}
