import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { ProjectDetail } from '../../core/projects/project.types';
import { ProjectOverview } from '../../core/inbox/inbox.service';

/** The LIVE-project hero: the project cover image with the name/subtitle
 *  overlaid + cover actions, followed by four negotiation tiles (Working
 *  Ballpark / Confirmed so far / Agreed items / Open threads). Shown on an
 *  Active project in place of the plain text hero. Each tile carries a hover
 *  tooltip explaining what it counts. */
@Component({
  selector: 'app-project-overview-hero',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, LucideAngularModule],
  host: { class: 'block' },
  template: `
    @let p = project();
    <!-- collapsed → the cover shrinks to a slim name band + the tiles collapse
         away, both animated (see styles). Reverses automatically. -->
    <div class="ovh" [class.is-collapsed]="collapsed()">
      <!-- Cover -->
      <div class="ovh-cover relative overflow-hidden rounded-[var(--radius-lg)] border border-hairline shadow-md">
        @if (p.coverUrl) {
          <img [src]="p.coverUrl" alt=""
               [style.object-position]="p.coverFocalX + '% ' + p.coverFocalY + '%'"
               class="h-full w-full object-cover" />
        } @else {
          <div class="h-full w-full" style="background: var(--bp-gradient, linear-gradient(135deg,#f5add0,#d63384))"></div>
        }
        <!-- Legibility scrim — stronger at the bottom-left where the text sits. -->
        <div class="pointer-events-none absolute inset-0" style="background: linear-gradient(90deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.45) 45%, rgba(0,0,0,0.05) 78%)"></div>
        <div class="pointer-events-none absolute inset-0" style="background: linear-gradient(0deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 55%)"></div>

        <div class="ovh-overlay absolute inset-0 flex flex-col justify-end">
          <span class="ovh-eyebrow bp-eyebrow" style="color: rgba(255,255,255,0.85)">Live {{ label() }}</span>
          <h1 class="ovh-name bp-page-title mt-0.5" style="color: #fff">{{ p.name }}</h1>
          @if (subtitle()) {
            <p class="ovh-sub bp-body-small mt-1 max-w-[60%]" style="color: rgba(255,255,255,0.92)">{{ subtitle() }}</p>
          }
        </div>

        <!-- Cover actions -->
        <div class="ovh-actions absolute right-4 top-4 flex flex-wrap items-center gap-2">
          <button type="button" class="bp-cover-btn" (click)="buildCover.emit()">
            <lucide-icon name="sparkles" [size]="15" /> Build cover from your items
          </button>
          <button type="button" class="bp-cover-btn" (click)="changeImage.emit()">
            <lucide-icon name="image" [size]="15" /> Change image
          </button>
        </div>
      </div>

      <!-- Negotiation stats — ONE rounded pill, inline: title-case gray label +
           bold value (Liam 2026-10-22). "Confirmed so far" only once ≥1 agreed.
           Inline radius beats the .bp-card radius cascade. -->
      <!-- .bp-card forces display:block + its own radius (cascade) — inline
           style beats it so the stats sit on ONE flex row in a pill. -->
      <div class="ovh-tiles bp-card px-6 py-3" style="border-radius: 999px; display: flex; flex-wrap: nowrap; align-items: center; column-gap: 2rem;">
        <span class="flex shrink-0 items-baseline gap-2 whitespace-nowrap" [title]="'Your current estimated total — every line at its latest price (ex VAT).'">
          <span class="bp-body-small text-secondary">Working ballpark</span>
          <span class="bp-body-small text-text" style="font-weight: 700">{{ workingTotal() | currency: currency() : 'symbol' : '1.0-0' }}</span>
        </span>
        @if ((o()?.agreedItems ?? 0) > 0) {
          <span class="flex shrink-0 items-baseline gap-2 whitespace-nowrap" [title]="'Total value of items you and the supplier have both agreed.'">
            <span class="bp-body-small text-secondary">Confirmed so far</span>
            <span class="bp-body-small text-text" style="font-weight: 700">{{ (o()?.confirmedTotal ?? 0) | currency: currency() : 'symbol' : '1.0-0' }}</span>
          </span>
        }
        <span class="flex shrink-0 items-baseline gap-2 whitespace-nowrap" [title]="'Line items both sides have accepted, out of the project total (excludes cancelled).'">
          <span class="bp-body-small text-secondary">Agreed items</span>
          <span class="bp-body-small text-text" style="font-weight: 700">{{ o()?.agreedItems ?? 0 }} of {{ o()?.totalItems ?? 0 }}</span>
        </span>
        <span class="flex shrink-0 items-baseline gap-2 whitespace-nowrap" [title]="'Supplier conversations with at least one item still to agree.'">
          <span class="bp-body-small text-secondary">Open threads</span>
          <span class="bp-body-small text-text" style="font-weight: 700">{{ o()?.openThreads ?? 0 }}</span>
        </span>
      </div>
    </div>
  `,
  styles: [`
    /* Collapsing hero — full cover+tiles ⇄ slim name band. All animated so it
       dissolves both ways; honours reduced-motion. */
    .ovh-cover { height: 220px; transition: height 0.3s ease; }
    .ovh-overlay { padding: 24px; transition: padding 0.3s ease; }
    .ovh-eyebrow, .ovh-sub {
      overflow: hidden;
      transition: opacity 0.24s ease, max-height 0.3s ease, margin 0.3s ease;
    }
    .ovh-actions { transition: opacity 0.24s ease; }
    .ovh-name { transition: font-size 0.3s ease; }
    .ovh.is-collapsed .ovh-name { font-size: var(--text-2xl); }
    .ovh-tiles {
      max-height: 260px; opacity: 1; margin-top: 16px; overflow: hidden;
      transition: max-height 0.3s ease, opacity 0.24s ease, margin-top 0.3s ease;
    }
    .ovh.is-collapsed .ovh-cover { height: 72px; }
    .ovh.is-collapsed .ovh-overlay { padding: 12px 20px; justify-content: center; }
    .ovh.is-collapsed .ovh-eyebrow,
    .ovh.is-collapsed .ovh-sub { opacity: 0; max-height: 0; margin-top: 0; margin-bottom: 0; }
    .ovh.is-collapsed .ovh-actions { opacity: 0; pointer-events: none; }
    .ovh.is-collapsed .ovh-tiles { max-height: 0; opacity: 0; margin-top: 0; }
    @media (prefers-reduced-motion: reduce) {
      .ovh-cover, .ovh-overlay, .ovh-eyebrow, .ovh-sub, .ovh-actions, .ovh-tiles, .ovh-name { transition: none; }
    }
    .bp-cover-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 14px;
      border-radius: var(--radius-pill);
      background: var(--color-surface);
      color: var(--color-text);
      font-size: var(--text-sm); font-weight: 500;
      box-shadow: var(--shadow-sm);
      cursor: pointer;
    }
    .bp-cover-btn:hover { background: var(--color-fill); }
  `],
})
export class ProjectOverviewHeroComponent {
  readonly project = input.required<ProjectDetail>();
  readonly workingTotal = input<number>(0);
  readonly overview = input<ProjectOverview | null>(null);
  readonly currency = input<string>('GBP');
  readonly label = input<string>('project');
  /** Collapse to a slim name band (work tabs) — reverses automatically. */
  readonly collapsed = input<boolean>(false);

  readonly changeImage = output<void>();
  readonly buildCover = output<void>();

  protected readonly o = computed(() => this.overview());
  protected readonly subtitle = computed(() => {
    const p = this.project();
    return (p.description || p.ref || '').trim();
  });
}
