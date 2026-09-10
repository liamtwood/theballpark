import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LucideAngularModule } from 'lucide-angular';
import { AiService } from '../../core/ai/ai.service';
import { CodelistService } from '../../core/codelists/codelist.service';
import { PageConfigService } from '../../core/config/page-config.service';
import { ProjectService } from '../../core/projects/project.service';
import { parsedBriefToCreate } from '../../core/projects/project.types';
import { errorDetail } from '../../core/http-error';
import { PageHeroComponent } from '../../shell/page-hero/page-hero.component';

/** pV2-PROJECTS-03 (scoped — brief → project, no items) — /projects/new
 *  per add-project-1.png: Upload Brief OR Write Brief. The AI parses the
 *  brief into project fields (reusing the v1 /api/ai endpoints); we create
 *  the project (status draft) and land on the list. The "Your ballpark is
 *  ready" item accordion (add-project-2.png) is deferred. */
@Component({
  selector: 'app-projects-new',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToastModule, LucideAngularModule, PageHeroComponent],
  providers: [MessageService],
  // bp-vpfit: the PAGE never scrolls — the hero stays anchored and only the
  // form body scrolls within itself (matches the catalogue pages). This keeps
  // the scrollbar below the fixed header, not spanning it.
  host: { class: 'bp-vpfit' },
  template: `
    <app-page-hero
      align="block"
      [eyebrow]="hero().eyebrow"
      [title]="hero().title"
      [subtitle]="hero().subtitle"
    />

    <div class="bp-page-body bp-page-body--workspace">
      <!-- Own the overflow so the body scrolls, not the whole page. -->
      <div class="min-h-0 flex-1 overflow-y-auto">
      @if (busy()) {
        <!-- Recommend progress (mockup 160953) — steps advance as the brief is
             parsed, items matched, and the ballpark cost is built. -->
        <div class="mx-auto max-w-xl py-4 text-center">
          <h2 class="bp-page-title">Building your {{ label().toLowerCase() }}…</h2>
          <p class="bp-body-small mt-2 text-secondary">We're reading your brief, pulling out key details, matching marketplace suppliers and estimating the project cost.</p>
          <div class="mt-6 flex flex-col gap-2.5 text-left">
            @for (s of steps; track s.label; let i = $index) {
              <div class="bp-card flex items-center gap-3 p-3.5" [class.opacity-40]="i > step()">
                <span class="bp-icon-block h-9 w-9 shrink-0">
                  @if (i < step()) {
                    <lucide-icon name="check" [size]="16" />
                  } @else {
                    <lucide-icon [name]="s.icon" [size]="16" [class.animate-pulse]="i === step()" />
                  }
                </span>
                <span class="bp-body">{{ s.label }}</span>
              </div>
            }
          </div>
        </div>
      } @else {
        <div class="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
          <!-- Left: the brief (upload + paste). Fills the column so it matches
               the right side's full height (details + button + disclaimer). -->
          <div class="bp-card bp-card--lifted flex h-full flex-col p-6">
            <h2 class="bp-card-title">The brief</h2>

            <label class="mt-4 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-medium px-4 py-8 text-center hover:bg-fill">
              <input type="file" class="hidden" accept=".txt,.md,.csv,.rtf" (change)="onFile($event)" />
              <lucide-icon name="upload" [size]="20" [strokeWidth]="1.75" class="text-accent" />
              <span class="bp-body-small font-medium">{{ fileName() || 'Upload a brief' }}</span>
              <span class="bp-caption">.txt, .md, .csv or .rtf — or paste the text below</span>
            </label>

            <label class="mt-5 flex flex-1 flex-col">
              <span class="bp-field-label">Brief text</span>
              <textarea
                class="mt-1.5 min-h-64 w-full flex-1 resize-none rounded-xl border border-hairline bg-surface p-3 text-md outline-none focus:border-accent"
                placeholder="Paste the client brief: objectives, audience, dates, venue thoughts, guest numbers, deliverables, budget guidance…"
                [value]="briefText()"
                (input)="briefText.set($any($event.target).value)"
              ></textarea>
              <p class="bp-caption mt-1.5">{{ briefLen() }} characters · at least {{ MIN_BRIEF }} needed</p>
            </label>
          </div>

          <!-- Right: project details + submit. -->
          <div class="flex flex-col gap-6">
            <div class="bp-card bp-card--lifted p-6">
              <h2 class="bp-card-title">Project details</h2>

              <div class="mt-4 flex gap-4">
                <label class="block w-[calc(11ch+2.5rem)] shrink-0">
                  <span class="bp-field-label">Ref</span>
                  <input type="text" class="bp-np-input" placeholder="Auto" title="Leave blank to auto-assign, or set your own" [value]="ref()" (input)="ref.set($any($event.target).value)" />
                </label>
                <label class="block min-w-0 flex-1">
                  <span class="bp-field-label">Project name</span>
                  <input type="text" class="bp-np-input" [value]="name()" (input)="name.set($any($event.target).value)" />
                </label>
              </div>
              <div class="mt-4 grid grid-cols-2 gap-4">
                <label class="block">
                  <span class="bp-field-label">Client</span>
                  <input type="text" class="bp-np-input" [value]="client()" (input)="client.set($any($event.target).value)" />
                </label>
                <label class="block">
                  <span class="bp-field-label">Event type</span>
                  <select class="bp-np-input bp-np-select" [value]="eventType()" (change)="eventType.set($any($event.target).value)">
                    <option value="">Select…</option>
                    @for (o of eventTypeOptions(); track o.value) {
                      <option [value]="o.value">{{ o.label }}</option>
                    }
                  </select>
                </label>
              </div>
              <div class="mt-4 grid grid-cols-2 gap-4">
                <label class="block">
                  <span class="bp-field-label">Event date</span>
                  <input type="date" class="bp-np-input" [value]="eventDate()" (input)="eventDate.set($any($event.target).value)" />
                </label>
                <label class="block">
                  <span class="bp-field-label">Location</span>
                  <input type="text" class="bp-np-input" placeholder="London" [value]="location()" (input)="location.set($any($event.target).value)" />
                </label>
              </div>
              <div class="mt-4 grid grid-cols-2 gap-4">
                <label class="block">
                  <span class="bp-field-label">Guests</span>
                  <input type="number" min="0" class="bp-np-input" [value]="guests()" (input)="guests.set($any($event.target).value)" />
                </label>
                <label class="block">
                  <span class="bp-field-label">Budget (£)</span>
                  <input type="number" min="0" class="bp-np-input" [value]="budget()" (input)="budget.set($any($event.target).value)" />
                </label>
              </div>
            </div>

            <button type="button" class="bp-msg-btn w-full justify-center" [disabled]="!canSubmit()" (click)="submit()">
              <lucide-icon name="sparkles" [size]="16" />
              Create ballpark
            </button>
            <p class="bp-caption">
              Ballpark estimates are indicative and subject to supplier confirmation, final scope,
              availability, delivery requirements and VAT.
            </p>
          </div>
        </div>
      }
      </div>
    </div>

    <!-- MessageService supplies aria-live by severity (audit F-10). -->
    <p-toast position="bottom-right" styleClass="bp-toast" />
  `,
  styles: [
    `
      .bp-np-input {
        margin-top: 6px;
        width: 100%;
        border-radius: var(--radius-field, 10px);
        border: 1px solid var(--color-border-hairline);
        background: var(--color-surface);
        padding: 10px 14px;
        font-family: var(--font-body);
        font-size: var(--text-md);
        color: var(--color-text);
        outline: none;
      }
      .bp-np-input:focus {
        border-color: var(--theme-accent);
      }
      .bp-np-input:disabled {
        background: var(--color-fill);
        color: var(--color-text-secondary);
        cursor: not-allowed;
      }
      /* Native <select> arrow crowds the value — swap for a padded chevron. */
      select.bp-np-select {
        appearance: none;
        -webkit-appearance: none;
        padding-right: 2rem;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='none' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 4.5 6 7.5 9 4.5'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 0.7rem center;
        background-size: 0.8rem;
      }
    `,
  ],
})
export class ProjectsNewComponent {
  private readonly ai = inject(AiService);
  private readonly projects = inject(ProjectService);
  private readonly codelists = inject(CodelistService);
  private readonly pageConfig = inject(PageConfigService);

  /** Event type is a curated LOV (admins own it) — same list the project
   *  detail's Event type dropdown reads. */
  private readonly eventTypeRes = resource({
    loader: () => this.codelists.list('event_type'),
  });
  protected readonly eventTypeOptions = computed(
    () => this.eventTypeRes.value()?.map((v) => ({ label: v.label, value: v.code })) ?? []
  );
  private readonly router = inject(Router);
  private readonly toast = inject(MessageService);

  protected readonly label = computed(() => this.pageConfig.eventLabel());
  /** Admin-driven hero (eyebrow / title / subtitle), tokens resolved. */
  protected readonly hero = computed(() => this.pageConfig.pageHero('newProject'));

  protected readonly briefText = signal('');
  protected readonly fileName = signal('');
  private readonly file = signal<File | null>(null);
  protected readonly busy = signal(false);

  /** Project-detail fields the user can fill directly (override the parsed
   *  brief). All map to existing project attributes. */
  protected readonly ref = signal('');
  protected readonly name = signal('');
  protected readonly client = signal('');
  protected readonly eventType = signal('');
  protected readonly eventDate = signal('');
  protected readonly location = signal('');
  protected readonly guests = signal('');
  protected readonly budget = signal('');

  /** Minimum brief length before the AI parse is worthwhile. */
  protected readonly MIN_BRIEF = 40;
  protected readonly briefLen = computed(() => this.briefText().trim().length);

  /** Recommend progress steps (mockup 160953). `step()` is the active index. */
  protected readonly steps = [
    { icon: 'file-text', label: 'Reading brief' },
    { icon: 'calendar', label: 'Finding dates and deliverables' },
    { icon: 'store', label: 'Matching marketplace items' },
    { icon: 'wallet', label: 'Building ballpark cost' },
  ];
  protected readonly step = signal(0);

  protected readonly canSubmit = computed(
    () => !this.busy() && (this.briefLen() >= this.MIN_BRIEF || !!this.file())
  );

  protected onFile(e: Event): void {
    const f = (e.target as HTMLInputElement).files?.[0] ?? null;
    this.file.set(f);
    this.fileName.set(f?.name ?? '');
  }

  protected async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    this.busy.set(true);
    this.step.set(0);
    let projectId: string | null = null;
    try {
      // Step 0 — read the brief (extract text for uploads, then parse).
      let text = this.briefText().trim();
      const f = this.file();
      if (f && !text) {
        text = (await firstValueFrom(this.ai.extractText(f))).text;
      }
      const parsed = await firstValueFrom(this.ai.parseBrief(text));
      this.step.set(1); // finding dates & deliverables

      // Manual detail fields win over the parsed brief (both map to existing
      // project attributes). Client + Budget aren't on the create schema, so
      // they're PATCHed straight after (create-then-update — no backend change).
      const base = parsedBriefToCreate(parsed, text);
      const payload = {
        ...base,
        ref: this.ref().trim() || undefined,
        name: this.name().trim() || base.name,
        eventType: this.eventType().trim() || base.eventType,
        eventDate: this.eventDate().trim() || base.eventDate,
        venueName: this.location().trim() || base.venueName,
        guestCount: this.guests().trim() ? Number(this.guests()) : base.guestCount,
      };
      const card = await firstValueFrom(this.projects.create(payload));
      projectId = card.id;

      const detailPatch: { clientName?: string; projectBudget?: number } = {};
      if (this.client().trim()) detailPatch.clientName = this.client().trim();
      if (this.budget().trim()) detailPatch.projectBudget = Number(this.budget());
      if (Object.keys(detailPatch).length) {
        try {
          await firstValueFrom(this.projects.update(card.id, detailPatch));
        } catch (patchErr) {
          console.warn('[ProjectsNew] client/budget update failed', patchErr);
        }
      }

      // Step 2 — match marketplace items (v1 recommender, per category). A
      // failure here shouldn't lose the created project: warn and still land
      // them on the (empty) estimate to add items manually.
      this.step.set(2);
      try {
        await firstValueFrom(this.projects.recommend(card.id));
      } catch (recErr) {
        console.warn('[ProjectsNew] recommend failed', recErr);
        this.toast.add({
          severity: 'warn',
          summary: 'Created — but auto-recommend didn’t run. Add items from the marketplace.',
          detail: errorDetail(recErr),
          life: 6000,
        });
      }
      this.step.set(3); // building ballpark cost
      await this.router.navigate(['/projects', card.id], { queryParams: { tab: 'estimate' } });
    } catch (err) {
      console.warn('[ProjectsNew] brief → create failed', err);
      if (projectId) {
        // Created, but a post-create step threw — take them into the project.
        await this.router.navigate(['/projects', projectId], { queryParams: { tab: 'estimate' } });
        return;
      }
      this.toast.add({
        severity: 'error',
        summary: "Couldn't build your " + this.label().toLowerCase() + ' — please try again.',
        detail: errorDetail(err),
        life: 6000,
      });
      this.busy.set(false);
    }
  }
}
