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
          <lucide-icon [name]="c.icon" [size]="20" [strokeWidth]="1.75" class="text-accent" />
          <div class="bp-amount-hero mt-3 text-text">{{ c.value }}</div>
          <div class="bp-caption mt-1">{{ c.label }}</div>
        </div>
      }
    </div>
  `,
})
export class HomeSupplierStatsComponent {
  readonly stats = input.required<SupplierHomeStats>();

  protected readonly cards = computed(() => {
    const s = this.stats();
    return [
      { icon: 'messages-square', value: String(s.needsReply), label: 'Needs a reply' },
      { icon: 'package', value: String(s.publishedListings), label: 'Published listings' },
      { icon: 'briefcase', value: String(s.liveProjects), label: 'Live projects' },
      { icon: 'pound-sterling', value: '£' + (s.confirmedWork ?? 0).toLocaleString('en-GB'), label: 'Confirmed work' },
    ];
  });
}
