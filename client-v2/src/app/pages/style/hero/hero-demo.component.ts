import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { PageHeroComponent } from '../../../shell/page-hero/page-hero.component';

/** Dev-only style sandbox for `<app-page-hero>` — the v2 equivalent of v1's
 *  component playground. Four variants, stacked, for visual QC. Transparent is
 *  the default (pV2-01d); variant 4 shows the opt-in theme wash. */
@Component({
  selector: 'app-hero-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, PageHeroComponent],
  host: { class: 'block' },
  template: `
    <div class="bp-page-body flex flex-col gap-8">
      <section>
        <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          1 · Title only — left, transparent (default)
        </p>
        <app-page-hero title="Inbox" class="overflow-hidden rounded-xl border border-hairline" />
      </section>

      <section>
        <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          2 · Title + subtitle — left, transparent (default)
        </p>
        <app-page-hero
          title="Inbox"
          subtitle="Project conversations"
          class="overflow-hidden rounded-xl border border-hairline"
        />
      </section>

      <section>
        <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          3 · Title + subtitle + back link — left, transparent (default, + actions slot)
        </p>
        <app-page-hero
          title="Inbox"
          subtitle="Project conversations"
          [back]="{ label: 'Home', href: '/' }"
          class="overflow-hidden rounded-xl border border-hairline"
        >
          <p-button hero-actions label="Action" size="small" />
        </app-page-hero>
      </section>

      <section>
        <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          4 · Title + subtitle — center, accent="theme" (the opt-in wash)
        </p>
        <app-page-hero
          title="Inbox"
          subtitle="Project conversations"
          align="center"
          accent="theme"
          class="overflow-hidden rounded-xl"
        />
      </section>
    </div>
  `,
})
export class HeroDemoComponent {}
