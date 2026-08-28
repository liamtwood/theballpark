import { ChangeDetectionStrategy, Component, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { ProjectService } from '../../core/projects/project.service';
import { ProjectDetail, ProjectUpdate } from '../../core/projects/project.types';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/** pV2-BUILDUP-04 — the editable "Event details" card at the top of the
 *  Cart/Final, replacing the read-only summary tiles. Same five facts (Date /
 *  Location / Duration / Guest count / Budget); each saves on blur via a
 *  targeted ProjectUpdate patch, then (saved) tells the host to reload its
 *  project resource so every surface re-reads. No optimism — the write is a
 *  single nullable column and the fresh detail is authoritative. */
@Component({
  selector: 'app-event-details-edit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule],
  host: { class: 'block' },
  template: `
    <div class="bp-card p-4 sm:p-5">
      <div class="flex items-center justify-between">
        <span class="bp-list-title">Event details</span>
        @switch (state()) {
          @case ('saving') {
            <span class="bp-pill bp-body-small text-secondary">Saving…</span>
          }
          @case ('error') {
            <span class="bp-pill bp-pill--danger bp-body-small">Couldn't save</span>
          }
          @default {
            <span class="bp-pill bp-pill--success bp-body-small inline-flex items-center gap-1.5">
              <lucide-icon name="check" [size]="14" [strokeWidth]="2" /> Details saved
            </span>
          }
        }
      </div>

      <div class="mt-4 grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2 md:grid-cols-3">
        <label class="block">
          <span class="bp-field-label mb-1 block">Client name</span>
          <input class="bp-input-field" type="text" placeholder="e.g. Acme Ltd"
                 [ngModel]="dClient()" (ngModelChange)="dClient.set($event)" (blur)="saveClient()" />
        </label>

        <label class="block sm:col-span-2">
          <span class="bp-field-label mb-1 block">Event type</span>
          <input class="bp-input-field" type="text" placeholder="e.g. Product launch party"
                 [ngModel]="dEventType()" (ngModelChange)="dEventType.set($event)" (blur)="saveEventType()" />
        </label>

        <label class="block">
          <span class="bp-field-label mb-1 block">Date</span>
          <input class="bp-input-field" type="text" placeholder="e.g. 31-Dec-2026 / TBC"
                 [ngModel]="dDate()" (ngModelChange)="dDate.set($event)" (blur)="saveDate()" />
        </label>

        <label class="block">
          <span class="bp-field-label mb-1 block">Location</span>
          <input class="bp-input-field" type="text" placeholder="e.g. Victorian Ballroom"
                 [ngModel]="dLocation()" (ngModelChange)="dLocation.set($event)" (blur)="saveLocation()" />
        </label>

        <label class="block">
          <span class="bp-field-label mb-1 block">Duration (days)</span>
          <input class="bp-input-field" type="number" min="0" inputmode="numeric" placeholder="e.g. 1"
                 [ngModel]="dDuration()" (ngModelChange)="dDuration.set($event)" (blur)="saveDuration()" />
        </label>

        <label class="block">
          <span class="bp-field-label mb-1 block">Guest count</span>
          <input class="bp-input-field" type="number" min="0" inputmode="numeric" placeholder="e.g. 150"
                 [ngModel]="dGuests()" (ngModelChange)="dGuests.set($event)" (blur)="saveGuests()" />
        </label>

        <label class="block">
          <span class="bp-field-label mb-1 block">Budget ({{ symbol() }})</span>
          <input class="bp-input-field" type="number" min="0" inputmode="numeric" placeholder="e.g. 100000"
                 [ngModel]="dBudget()" (ngModelChange)="dBudget.set($event)" (blur)="saveBudget()" />
        </label>
      </div>
    </div>
  `,
})
export class EventDetailsEditComponent {
  private readonly projects = inject(ProjectService);

  readonly project = input.required<ProjectDetail>();
  readonly projectId = input.required<string>();
  readonly currency = input.required<string>();

  /** Fires after a field persists so the host reloads its project resource. */
  readonly saved = output<void>();

  protected readonly state = signal<SaveState>('idle');

  // Drafts re-seed whenever the project reloads (linkedSignal tracks source).
  protected readonly dClient = linkedSignal(() => this.project().clientName ?? '');
  protected readonly dEventType = linkedSignal(() => this.project().eventType ?? '');
  protected readonly dDate = linkedSignal(() => this.project().eventDate ?? '');
  protected readonly dLocation = linkedSignal(() => this.project().venueName ?? '');
  protected readonly dDuration = linkedSignal(() => numStr(this.project().durationDays));
  protected readonly dGuests = linkedSignal(() => numStr(this.project().guestCount));
  protected readonly dBudget = linkedSignal(() => numStr(this.project().projectBudget));

  protected symbol(): string {
    return this.currency() === 'USD' ? '$' : this.currency() === 'EUR' ? '€' : '£';
  }

  protected saveClient(): void {
    const next = this.dClient().trim() || null;
    if (next === (this.project().clientName ?? null)) return;
    this.persist({ clientName: next });
  }

  protected saveEventType(): void {
    const next = this.dEventType().trim() || null;
    if (next === (this.project().eventType ?? null)) return;
    this.persist({ eventType: next });
  }

  protected saveDate(): void {
    const next = this.dDate().trim() || null;
    if (next === (this.project().eventDate ?? null)) return;
    this.persist({ eventDate: next });
  }

  protected saveLocation(): void {
    const next = this.dLocation().trim() || null;
    if (next === (this.project().venueName ?? null)) return;
    this.persist({ venueName: next });
  }

  protected saveDuration(): void {
    const next = parseNum(this.dDuration());
    if (next === (this.project().durationDays ?? null)) return;
    this.persist({ durationDays: next });
  }

  protected saveGuests(): void {
    const next = parseNum(this.dGuests());
    if (next === (this.project().guestCount ?? null)) return;
    this.persist({ guestCount: next });
  }

  protected saveBudget(): void {
    const next = parseNum(this.dBudget());
    if (next === (this.project().projectBudget ?? null)) return;
    this.persist({ projectBudget: next });
  }

  private async persist(patch: ProjectUpdate): Promise<void> {
    this.state.set('saving');
    try {
      await firstValueFrom(this.projects.update(this.projectId(), patch));
      this.state.set('saved');
      this.saved.emit();
    } catch {
      this.state.set('error');
    }
  }
}

/** number|null → the input's string draft ('' for null). */
function numStr(n: number | null): string {
  return n != null ? String(n) : '';
}

/** A numeric draft → number|null (blank or non-finite → null). */
function parseNum(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
