import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { natoDate } from '../../shared/details-format';
import { SelectComponent, SelectOption } from '../../shared/select/select.component';

/** The project logistics fields — name / client / event-type / date / location /
 *  guests / budget. ONE layout, shared by the add-project page AND the create
 *  welcome dialog (pV2-PROJ-UNIFY-01) so they can't drift. Two-way `model()`
 *  signals; the date field owns its NATO normalisation + OS picker. */
@Component({
  selector: 'app-project-details-fields',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, SelectComponent],
  template: `
    <!-- The project fields — one field per row, except Guests + Budget share a
         row. Shared by the add-project card AND the welcome/edit dialogs so they
         can't drift. -->
    <div class="flex flex-col gap-4">
      <label class="block">
        <span class="ed-label mb-1.5 block">Project name</span>
        <input type="text" class="ed-input" [value]="name()" (input)="name.set($any($event.target).value)" />
      </label>
      <label class="block">
        <span class="ed-label mb-1.5 block">Client</span>
        <input type="text" class="ed-input" [value]="client()" (input)="client.set($any($event.target).value)" />
      </label>
      <label class="block">
        <span class="ed-label mb-1.5 block">Event type</span>
        <app-select ariaLabel="Event type" placeholder="Select…" [options]="eventTypeOptions()" [value]="eventType()" (changed)="eventType.set($event)" />
      </label>
      <label class="block">
        <span class="ed-label mb-1.5 block">Event date</span>
        <div class="relative">
          <input type="text" class="ed-input pr-10" placeholder="e.g. 20-Aug-2026" title="Standard format: DD-Mmm-YYYY (free text like 'Q4' is fine too)" [value]="eventDate()" (input)="eventDate.set($any($event.target).value)" (blur)="onEventDateBlur()" />
          <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"><lucide-icon name="calendar" [size]="16" /></span>
          <input type="date" aria-label="Pick event date" class="absolute right-0 top-0 h-full w-11 cursor-pointer opacity-0" (change)="onEventDatePicked($any($event.target).value)" />
        </div>
      </label>
      <label class="block">
        <span class="ed-label mb-1.5 block">Location</span>
        <input type="text" class="ed-input" placeholder="London" [value]="location()" (input)="location.set($any($event.target).value)" />
      </label>
      <div class="grid grid-cols-2 gap-4">
        <label class="block">
          <span class="ed-label mb-1.5 block">Guests</span>
          <input type="number" min="0" class="ed-input" [value]="guests()" (input)="guests.set($any($event.target).value)" />
        </label>
        <label class="block">
          <span class="ed-label mb-1.5 block">Budget ({{ currencySymbol() }})</span>
          <input type="text" inputmode="numeric" class="ed-input" [value]="budgetDisplay()" (input)="onBudgetInput($any($event.target).value)" />
        </label>
      </div>
    </div>

    @if (showFinancials()) {
      <!-- Financials — a show/hide region (collapsed by default), single column.
           Feeds the estimate (margin + contingency) and the client-facing quote
           (VAT note); currency drives all formatting. Edit dialog only. -->
      <div class="mt-5 border-t border-hairline pt-4">
        <button type="button" class="flex w-full items-center justify-between" (click)="finOpen.set(!finOpen())"
                [attr.aria-expanded]="finOpen()">
          <span class="bp-eyebrow text-secondary">Financials</span>
          <lucide-icon [name]="finOpen() ? 'chevron-up' : 'chevron-down'" [size]="16" class="text-muted" />
        </button>
        @if (finOpen()) {
          <div class="mt-3 grid grid-cols-2 gap-4">
            <label class="block">
              <span class="ed-label mb-1.5 block">Currency</span>
              <app-select ariaLabel="Currency" [options]="currencyOptions" [value]="currency()" (changed)="currency.set($event)" />
            </label>
            <label class="block">
              <span class="ed-label mb-1.5 block">Margin (%)</span>
              <input type="number" min="0" class="ed-input" [value]="margin()" (input)="margin.set($any($event.target).value)" />
            </label>
            <label class="block">
              <span class="ed-label mb-1.5 block">Contingency (%)</span>
              <input type="number" min="0" class="ed-input" [value]="contingency()" (input)="contingency.set($any($event.target).value)" />
            </label>
            <label class="block">
              <span class="ed-label mb-1.5 block">VAT (%)</span>
              <input type="number" min="0" class="ed-input" [value]="vat()" (input)="vat.set($any($event.target).value)" />
            </label>
          </div>
        }
      </div>
    }
  `,
})
export class ProjectDetailsFieldsComponent {
  readonly eventTypeOptions = input<SelectOption[]>([]);
  readonly name = model('');
  readonly client = model('');
  readonly eventType = model('');
  readonly eventDate = model('');
  readonly location = model('');
  readonly guests = model('');
  readonly budget = model('');
  /** Financial defaults (edit dialog only) — margin / contingency / VAT / currency. */
  readonly showFinancials = input(false);
  readonly margin = model('');
  readonly contingency = model('');
  readonly vat = model('');
  readonly currency = model('GBP');
  /** The Financials region is a show/hide block — collapsed by default. */
  protected readonly finOpen = signal(false);

  protected readonly currencyOptions: SelectOption[] = [
    { label: '£ GBP', value: 'GBP' },
    { label: '$ USD', value: 'USD' },
    { label: '€ EUR', value: 'EUR' },
  ];
  protected readonly currencySymbol = computed(() =>
    this.currency() === 'USD' ? '$' : this.currency() === 'EUR' ? '€' : '£'
  );

  /** Budget shows thousands separators while the MODEL stays digit-only (so
   *  `Number(budget())` keeps working on every consumer). Input strips grouping. */
  protected readonly budgetDisplay = computed(() => {
    const digits = this.budget().replace(/\D/g, '');
    return digits ? Number(digits).toLocaleString('en-GB') : '';
  });
  protected onBudgetInput(v: string): void {
    this.budget.set(v.replace(/\D/g, ''));
  }

  protected onEventDateBlur(): void {
    const v = this.eventDate().trim();
    if (v) this.eventDate.set(natoDate(v));
  }

  protected onEventDatePicked(iso: string): void {
    if (!iso) return;
    const [y, m, d] = iso.split('-').map(Number);
    this.eventDate.set(natoDate(new Date(y, m - 1, d).toDateString()));
  }
}
