import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth/auth.service';
import { PageHeroComponent } from '../../shell/page-hero/page-hero.component';
import { tileForPath } from '../../shared/launcher/launcher-tiles';

/** pV2-04b — placeholder for launcher targets that land in later prompts.
 *  The hero (title2/subtitle2 roles via page-hero) derives from the SAME
 *  action-card strings the launcher shows (Liam, 2026-06-11 — one registry,
 *  two consumers); route data.feature stays as the fallback. */
@Component({
  selector: 'app-coming-soon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeroComponent],
  host: { class: 'block' },
  template: `
    <app-page-hero [back]="{ label: 'Back', href: '/home' }" [title]="title()" [subtitle]="subtitle()" />
    <div class="bp-page-body">
      <p class="bp-body-small text-secondary">
        The {{ title() }} page isn't built yet — it lands in a later prompt. The route exists so
        the home launcher navigates somewhere real instead of 404ing.
      </p>
    </div>
  `,
})
export class ComingSoonComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly data = toSignal(this.route.data, { initialValue: {} as Record<string, unknown> });
  private readonly queryParams = toSignal(this.route.queryParams, {
    initialValue: {} as Record<string, string>,
  });

  /** Query-aware (v2.13c): hub bucket drills (/projects?bucket=quoting)
   *  resolve to their bucket tile's copy, not the generic list tile. */
  private readonly tile = computed(() =>
    tileForPath(this.router.url.split('?')[0], this.auth.user()?.activeOrgType, this.queryParams())
  );

  protected readonly title = computed(
    () => this.tile()?.label ?? String(this.data()['feature'] ?? 'This page')
  );
  protected readonly subtitle = computed(() => this.tile()?.subtitle ?? '');
}
