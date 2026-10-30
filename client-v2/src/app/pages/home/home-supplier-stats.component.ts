import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { SupplierHomeStats } from '../../core/inbox/inbox.service';

/** Supplier home dashboard — four stat cards (Needs a reply / Published listings /
 *  Live projects / Confirmed work) that replace the launcher tiles on the supplier
 *  home (Liam 2026-10-30). Static for now; links come later. */
@Component({
  selector: 'app-home-supplier-stats',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'block' },
  template: `
    <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
      @for (c of cards(); track c.label) {
        <div class="bp-card bp-card--lifted p-6">
          <!-- Icon + type match the agent launcher tiles: bare softer-pink glyph
               (size 20 / stroke 1.5), count in .bp-card-title (same as a tile's
               "Projects" label), label in .bp-card-subtitle (Liam 2026-10-30). -->
          <span class="stat-icon">
            <lucide-icon [name]="c.icon" [size]="16" [strokeWidth]="1.5" />
          </span>
          <div class="bp-card-title mt-3">{{ c.value }}</div>
          <div class="bp-card-subtitle mt-1">{{ c.label }}</div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      /* Bare icon, softer pink — the SAME treatment as .bp-launcher-tile__icon. */
      .stat-icon {
        display: inline-flex;
        color: color-mix(in srgb, var(--theme-accent) 58%, #fff);
      }
    `,
  ],
})
export class HomeSupplierStatsComponent {
  readonly stats = input.required<SupplierHomeStats>();

  protected readonly cards = computed(() => {
    const s = this.stats();
    return [
      { icon: 'messages-square', value: String(s.needsReply), label: 'Needs a reply' },
      { icon: 'package', value: String(s.publishedListings), label: 'Published listings' },
      { icon: 'briefcase-business', value: String(s.liveProjects), label: 'Live projects' },
      { icon: 'hand-coins', value: '£' + (s.confirmedWork ?? 0).toLocaleString('en-GB'), label: 'Confirmed work' },
    ];
  });
}
