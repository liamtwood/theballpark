import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
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
    <div class="flex flex-col gap-4">
      <label class="block">
        <span class="ed-label mb-1.5 block">Project name</span>
        <input type="text" class="ed-input" [value]="name()" (input)="name.set($any($event.target).value)" />
      </label>
    </div>
    <div class="mt-4 grid grid-cols-1 gap-4">
      <label class="block">
        <span class="ed-label mb-1.5 block">Client</span>
        <input type="text" class="ed-input" [value]="client()" (input)="client.set($any($event.target).value)" />
      </label>
      <label class="block">
        <span class="ed-label mb-1.5 block">Event type</span>
        <app-select ariaLabel="Event type" placeholder="Select…" [options]="eventTypeOptions()" [value]="eventType()" (changed)="eventType.set($event)" />
      </label>
    </div>
    <div class="mt-4 grid grid-cols-1 gap-4">
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
    </div>
    <div class="mt-4 grid grid-cols-2 gap-4">
      <label class="block">
        <span class="ed-label mb-1.5 block">Guests</span>
        <input type="number" min="0" class="ed-input" [value]="guests()" (input)="guests.set($any($event.target).value)" />
      </label>
      <label class="block">
        <span class="ed-label mb-1.5 block">Budget (£)</span>
        <input type="number" min="0" class="ed-input" [value]="budget()" (input)="budget.set($any($event.target).value)" />
      </label>
    </div>
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
