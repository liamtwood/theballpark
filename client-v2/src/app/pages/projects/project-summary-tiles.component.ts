import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { ProjectDetail } from '../../core/projects/project.types';

/** pV2-CART-01 — the 5 summary tiles (Date / Location / Duration / Guest count
 *  / Budget) at the top of the Cart/Final. Pure presentation; extracted from
 *  project-estimate (audit M1). */
@Component({
  selector: 'app-project-summary-tiles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'block' },
  template: `
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
      @for (t of tiles(); track t.label) {
        <div class="bp-card p-3.5">
          <div class="flex items-start gap-3">
            <span class="bp-icon-block h-10 w-10 shrink-0"><lucide-icon [name]="t.icon" [size]="18" [strokeWidth]="1.75" /></span>
            <span class="min-w-0">
              <span class="bp-field-label block">{{ t.label }}</span>
              <span class="bp-body-small block truncate text-text">{{ t.value }}</span>
            </span>
          </div>
        </div>
      }
    </div>
  `,
})
export class ProjectSummaryTilesComponent {
  private readonly currencyPipe = new CurrencyPipe('en-GB');

  readonly project = input.required<ProjectDetail>();
  readonly currency = input.required<string>();

  protected readonly tiles = computed(() => {
    const p = this.project();
    const money = (n: number) => this.currencyPipe.transform(n, this.currency(), 'symbol', '1.0-0') ?? '—';
    return [
      { icon: 'calendar', label: 'Date', value: p.eventDate || '—' },
      { icon: 'map-pin', label: 'Location', value: p.venueCity || p.venueName || '—' },
      { icon: 'clock', label: 'Duration', value: p.durationDays ? `${p.durationDays} ${p.durationDays === 1 ? 'day' : 'days'}` : '—' },
      { icon: 'users', label: 'Guest count', value: p.guestCount != null ? String(p.guestCount) : '—' },
      { icon: 'wallet', label: 'Budget', value: p.projectBudget ? money(p.projectBudget) : '—' },
    ];
  });
}
