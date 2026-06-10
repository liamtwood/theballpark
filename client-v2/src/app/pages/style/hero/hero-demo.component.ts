import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { PageHeroComponent } from '../../../shell/page-hero/page-hero.component';

/** Dev-only style sandbox for `<app-page-hero>` — the v2 equivalent of v1's
 *  component playground. Four variants, stacked, for visual QC. */
@Component({
  selector: 'app-hero-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, PageHeroComponent],
  host: { class: 'block' },
  template: `
    <div class="bp-page-body flex flex-col gap-8">
      <section>
        <p class="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          1 · Title only — left, theme wash
        </p>
        <app-page-hero title="Inbox" class="overflow-hidden rounded-xl" />
      </section>

      <section>
        <p class="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          2 · Title + subtitle — left, theme wash
        </p>
        <app-page-hero
          title="Inbox"
          subtitle="Project conversations"
          class="overflow-hidden rounded-xl"
        />
      </section>

      <section>
        <p class="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          3 · Title + subtitle + back link — left, theme wash (+ actions slot)
        </p>
        <app-page-hero
          title="Inbox"
          subtitle="Project conversations"
          [back]="{ label: 'Home', href: '/' }"
          class="overflow-hidden rounded-xl"
        >
          <p-button hero-actions label="Action" size="small" />
        </app-page-hero>
      </section>

      <section>
        <p class="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          4 · Title + subtitle — center, no accent
        </p>
        <app-page-hero
          title="Inbox"
          subtitle="Project conversations"
          align="center"
          accent="none"
          class="overflow-hidden rounded-xl border border-black/5"
        />
      </section>
    </div>
  `,
})
export class HeroDemoComponent {}
