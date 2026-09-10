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
    <!-- Cover -->
    <div class="relative overflow-hidden rounded-[var(--radius-lg)] border border-hairline shadow-md">
      @if (p.coverUrl) {
        <img [src]="p.coverUrl" alt=""
             [style.object-position]="p.coverFocalX + '% ' + p.coverFocalY + '%'"
             class="h-[220px] w-full object-cover" />
      } @else {
        <div class="h-[220px] w-full" style="background: var(--bp-gradient, linear-gradient(135deg,#f5add0,#d63384))"></div>
      }
      <!-- Legibility scrim — stronger at the bottom-left where the text sits. -->
      <div class="pointer-events-none absolute inset-0" style="background: linear-gradient(90deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.45) 45%, rgba(0,0,0,0.05) 78%)"></div>
      <div class="pointer-events-none absolute inset-0" style="background: linear-gradient(0deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 55%)"></div>

      <div class="absolute inset-0 flex flex-col justify-end p-6">
        <span class="bp-eyebrow" style="color: rgba(255,255,255,0.85)">Live {{ label() }}</span>
        <h1 class="bp-page-title mt-0.5" style="color: #fff">{{ p.name }}</h1>
        @if (subtitle()) {
          <p class="bp-body-small mt-1 max-w-[60%]" style="color: rgba(255,255,255,0.92)">{{ subtitle() }}</p>
        }
      </div>

      <!-- Cover actions -->
      <div class="absolute right-4 top-4 flex flex-wrap items-center gap-2">
        <button type="button" class="bp-cover-btn" (click)="buildCover.emit()">
          <lucide-icon name="sparkles" [size]="15" /> Build cover from your items
        </button>
        <button type="button" class="bp-cover-btn" (click)="changeImage.emit()">
          <lucide-icon name="image" [size]="15" /> Change image
        </button>
      </div>
    </div>

    <!-- Negotiation tiles -->
    <div class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
      <div class="bp-card p-4" [title]="'Your current estimated total — every line at its latest price (ex VAT).'">
        <span class="bp-tile-title">Working ballpark</span>
        <span class="bp-tile-value mt-1">{{ workingTotal() | currency: currency() : 'symbol' : '1.0-0' }}</span>
      </div>
      <div class="bp-card p-4" [title]="'Total value of items you and the supplier have both agreed.'">
        <span class="bp-tile-title">Confirmed so far</span>
        <span class="bp-tile-value mt-1">{{ (o()?.confirmedTotal ?? 0) | currency: currency() : 'symbol' : '1.0-0' }}</span>
      </div>
      <div class="bp-card p-4" [title]="'Line items both sides have accepted, out of the project total (excludes cancelled).'">
        <span class="bp-tile-title">Agreed items</span>
        <span class="bp-tile-value mt-1">{{ o()?.agreedItems ?? 0 }} of {{ o()?.totalItems ?? 0 }}</span>
      </div>
      <div class="bp-card p-4" [title]="'Supplier conversations with at least one item still to agree.'">
        <span class="bp-tile-title">Open threads</span>
        <span class="bp-tile-value mt-1">{{ o()?.openThreads ?? 0 }}</span>
      </div>
    </div>
  `,
  styles: [`
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
    /* Tile title — the standard title colour, small all-caps label. */
    .bp-tile-title {
      display: block;
      font-family: var(--bp-font);
      font-size: var(--text-md);
      font-weight: 400;
      line-height: var(--leading-snug);
      color: var(--color-text-strong);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
    }
    /* Tile value — the prominent figure. */
    .bp-tile-value {
      display: block;
      font-family: var(--bp-font);
      font-size: var(--text-xl);
      font-weight: 600;
      line-height: var(--leading-snug);
      color: var(--color-text);
    }
  `],
})
export class ProjectOverviewHeroComponent {
  readonly project = input.required<ProjectDetail>();
  readonly workingTotal = input<number>(0);
  readonly overview = input<ProjectOverview | null>(null);
  readonly currency = input<string>('GBP');
  readonly label = input<string>('project');

  readonly changeImage = output<void>();
  readonly buildCover = output<void>();

  protected readonly o = computed(() => this.overview());
  protected readonly subtitle = computed(() => {
    const p = this.project();
    return (p.description || p.ref || '').trim();
  });
}
