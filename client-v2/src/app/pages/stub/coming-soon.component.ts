import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { PageHeroComponent } from '../../shell/page-hero/page-hero.component';

/** pV2-04 — placeholder for launcher targets that land in later prompts.
 *  Renders the standard hero with the feature name from route data. */
@Component({
  selector: 'app-coming-soon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeroComponent],
  host: { class: 'block' },
  template: `
    <app-page-hero [title]="feature()" subtitle="Coming soon — this surface lands in a later prompt." />
    <div class="bp-page-body">
      <p class="text-sm text-secondary">
        The {{ feature() }} page isn't built yet. The route exists so the home launcher navigates
        somewhere real instead of 404ing.
      </p>
    </div>
  `,
})
export class ComingSoonComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly data = toSignal(this.route.data, { initialValue: {} as Record<string, unknown> });

  protected readonly feature = computed(() => String(this.data()['feature'] ?? 'This page'));
}
