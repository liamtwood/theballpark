import { ChangeDetectionStrategy, Component, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { ProjectService } from '../../core/projects/project.service';
import { ProjectDetail, ProjectUpdate } from '../../core/projects/project.types';
import { withCommas } from '../../shared/details-format';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** NATO date (DD-Mmm-YYYY) when the string parses to a real date; otherwise the
 *  raw text is kept (event dates can be free text like "Q4"/"TBC"/a range). */
function natoDate(s: string): string {
  const t = Date.parse(s);
  if (Number.isNaN(t)) return s;
  const d = new Date(t);
  return `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

/** pV2-BUILDUP-04 — the editable "Event details" card at the top of the
 *  Cart/Final, replacing the read-only summary tiles. Each field saves on blur
 *  via a targeted ProjectUpdate patch, then (saved) tells the host to reload its
 *  project resource so every surface re-reads. No optimism — the write is a
 *  single nullable column and the fresh detail is authoritative. */
@Component({
  selector: 'app-event-details-edit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, NgTemplateOutlet, LucideAngularModule],
  host: { class: 'block' },
  styles: [`
    /* pV2-BUILDUP-04 workspace card — soft white on the pink ground. */
    .ed-card {
      background: var(--color-surface);
      border: 1px solid var(--card-border);
      border-radius: 32px;
      box-shadow: var(--shadow-quiet);
    }
    .ed-label { font-size: var(--text-xs, 0.75rem); color: var(--color-text-secondary); }
    .ed-input {
      height: 44px; width: 100%;
      border-radius: var(--radius-pill, 9999px);
      border: 1px solid var(--card-border);
      background: var(--color-surface);
      padding: 0 16px;
      font-size: var(--text-md);
      color: var(--color-text, var(--bp-text-color));
      outline: none;
    }
    .ed-input::placeholder { color: var(--color-text-secondary); opacity: 0.7; }
    .ed-input:focus { border-color: var(--theme-accent); }
    .ed-textarea {
      width: 100%; min-height: 84px;
      border-radius: 20px;
      border: 1px solid var(--card-border);
      background: var(--color-surface);
      padding: 12px 16px;
      font-size: var(--text-md);
      font-family: var(--bp-font);
      line-height: var(--leading-normal, 1.5);
      color: var(--color-text, var(--bp-text-color));
      outline: none;
      resize: vertical;
    }
    .ed-textarea::placeholder { color: var(--color-text-secondary); opacity: 0.7; }
    .ed-textarea:focus { border-color: var(--theme-accent); }
  `],
  template: `
    <ng-template #savedChip>
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
    </ng-template>

    <div class="ed-card p-6">
      <div class="flex items-center justify-between">
        <span class="bp-list-title">Event details</span>
        <ng-container [ngTemplateOutlet]="savedChip" />
      </div>

      <div class="mt-5 grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <label class="block">
          <span class="ed-label mb-1.5 block">Project</span>
          <input class="ed-input" type="text" placeholder="Project name"
                 [ngModel]="dName()" (ngModelChange)="dName.set($event)" (blur)="saveName()" />
        </label>

        <label class="block">
          <span class="ed-label mb-1.5 block">Client</span>
          <input class="ed-input" type="text" placeholder="e.g. Acme Ltd"
                 [ngModel]="dClient()" (ngModelChange)="dClient.set($event)" (blur)="saveClient()" />
        </label>

        <label class="block">
          <span class="ed-label mb-1.5 block">Event type</span>
          <input class="ed-input" type="text" placeholder="e.g. Product launch party"
                 [ngModel]="dEventType()" (ngModelChange)="dEventType.set($event)" (blur)="saveEventType()" />
        </label>

        <label class="block">
          <span class="ed-label mb-1.5 block">Event date</span>
          <input class="ed-input" type="text" placeholder="e.g. 31-Dec-2026 / TBC"
                 [ngModel]="dDate()" (ngModelChange)="dDate.set($event)" (blur)="saveDate()" />
        </label>

        <label class="block">
          <span class="ed-label mb-1.5 block">Location</span>
          <input class="ed-input" type="text" placeholder="e.g. Victorian Ballroom"
                 [ngModel]="dLocation()" (ngModelChange)="dLocation.set($event)" (blur)="saveLocation()" />
        </label>

        <label class="block">
          <span class="ed-label mb-1.5 block">Guests</span>
          <input class="ed-input" type="number" min="0" inputmode="numeric" placeholder="e.g. 150"
                 [ngModel]="dGuests()" (ngModelChange)="dGuests.set($event)" (blur)="saveGuests()" />
        </label>

        <label class="block">
          <span class="ed-label mb-1.5 block">Budget guide ({{ symbol() }})</span>
          <input class="ed-input" type="text" inputmode="numeric" placeholder="e.g. 100,000"
                 [ngModel]="dBudget()" (ngModelChange)="dBudget.set($event)" (blur)="saveBudget()" />
        </label>
      </div>
    </div>

    <div class="ed-card mt-4 p-6">
      <div class="flex items-center justify-between">
        <span class="bp-list-title">Event Description</span>
        <ng-container [ngTemplateOutlet]="savedChip" />
      </div>
      <textarea class="ed-textarea mt-4" rows="3"
                placeholder="A short overview of the event — shown on the quote document."
                [ngModel]="dDescription()" (ngModelChange)="dDescription.set($event)"
                (blur)="saveDescription()"></textarea>
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
  protected readonly dName = linkedSignal(() => this.project().name ?? '');
  protected readonly dClient = linkedSignal(() => this.project().clientName ?? '');
  protected readonly dEventType = linkedSignal(() => this.project().eventType ?? '');
  protected readonly dDate = linkedSignal(() => natoDate(this.project().eventDate ?? ''));
  protected readonly dLocation = linkedSignal(() => this.project().venueName ?? '');
  protected readonly dGuests = linkedSignal(() => numStr(this.project().guestCount));
  protected readonly dBudget = linkedSignal(() =>
    this.project().projectBudget != null ? withCommas(this.project().projectBudget!) : '',
  );
  protected readonly dDescription = linkedSignal(() => this.project().description ?? '');

  protected symbol(): string {
    return this.currency() === 'USD' ? '$' : this.currency() === 'EUR' ? '€' : '£';
  }

  protected saveName(): void {
    const next = this.dName().trim();
    // Name is required — never null it out from a blank blur.
    if (!next || next === this.project().name) return;
    this.persist({ name: next });
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
    const formatted = natoDate(this.dDate().trim());
    this.dDate.set(formatted); // reflect NATO in the box
    const next = formatted || null;
    if (next === (this.project().eventDate ?? null)) return;
    this.persist({ eventDate: next });
  }

  protected saveLocation(): void {
    const next = this.dLocation().trim() || null;
    if (next === (this.project().venueName ?? null)) return;
    this.persist({ venueName: next });
  }

  protected saveGuests(): void {
    const next = parseNum(this.dGuests());
    if (next === (this.project().guestCount ?? null)) return;
    this.persist({ guestCount: next });
  }

  protected saveBudget(): void {
    const next = parseNum(this.dBudget().replace(/,/g, ''));
    this.dBudget.set(next != null ? withCommas(next) : ''); // reflect commas in the box
    if (next === (this.project().projectBudget ?? null)) return;
    this.persist({ projectBudget: next });
  }

  protected saveDescription(): void {
    const next = this.dDescription().trim() || null;
    if (next === (this.project().description ?? null)) return;
    this.persist({ description: next });
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
